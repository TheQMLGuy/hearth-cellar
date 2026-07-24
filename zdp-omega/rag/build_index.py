#!/usr/bin/env python3
"""
build_index.py — ZDP-Omega RAG indexer.

Parses every PHASE_*.md, APPENDIX_*.md, 00_MASTER_PROTOCOL.md, and AGENT_BOOT.md
in the project root into a queryable knowledge base:

  index/chunks.jsonl       every retrievable unit, one JSON object per line
  index/flight_plan.json   the same audit flattened into ONE strict, ordered
                           list of atomic steps (every falsification procedure,
                           every rule, every exit-gate item, every setup step,
                           in document order, phase 00 -> 25) — this is what
                           makes "don't miss anything" a mechanical property
                           instead of something a model has to remember to do
  index/zdp_index.sqlite   the same two things in SQLite, with FTS5 full-text
                           search over chunk text (falls back to a pure-Python
                           keyword scorer if FTS5 isn't compiled in)

No third-party dependencies — Python 3.9+ stdlib only (re, json, sqlite3).
This is deliberate: the whole point is that this runs next to a small local
model with zero install friction, on any machine, with no network access.

Run:  python3 build_index.py
Re-run any time the .md source files change — it fully rebuilds the index
(it does not try to diff/merge; state files in rag/state/ are untouched).
"""
import re, json, glob, os, sqlite3, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / "index"
OUT.mkdir(exist_ok=True)

# One header regex handles both phase-file headers ("## 10.3 TITLE") and
# appendix headers ("## A.0 TITLE", "## E.4 TITLE") — both are "word.word".
HEADER_RE = re.compile(r'^## ([A-Za-z0-9]+\.[A-Za-z0-9]+) (.+)$', re.MULTILINE)
RULE_RE = re.compile(r'^- \*\*(R\d+\.\d+)[^*\n]*\*\*', re.MULTILINE)
STEP_RE = re.compile(r'^### (Step \d+.*)$', re.MULTILINE)
SUBHEAD_RE = re.compile(r'^### (?!Step )(.+)$', re.MULTILINE)
GATE_ITEM_RE = re.compile(r'^- \[ \] ', re.MULTILINE)
BULLET_RE = re.compile(r'^- ', re.MULTILINE)
PHASE_H1_RE = re.compile(r'^# PHASE (\d+) [—-] (.+)$', re.MULTILINE)
GENERIC_H1_RE = re.compile(r'^# (.+)$', re.MULTILINE)

chunks = []
flight = []


def add_chunk(**kw):
    kw.setdefault("chunk_id", f"C{len(chunks) + 1:05d}")
    chunks.append(kw)
    return kw["chunk_id"]


def section_spans(text):
    """[(header_start, section_num, title, body_start, body_end), ...] for every '## x.y Title'."""
    heads = list(HEADER_RE.finditer(text))
    spans = []
    for i, m in enumerate(heads):
        body_start = m.end()
        body_end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        spans.append((m.start(), m.group(1), m.group(2).strip(), body_start, body_end))
    return spans


def nearest_subheading(text, pos):
    sub = None
    for m in SUBHEAD_RE.finditer(text[:pos]):
        sub = m.group(1).strip()
    return sub


def bullet_spans(text, bullet_re):
    starts = [m.start() for m in bullet_re.finditer(text)]
    spans = []
    for i, s in enumerate(starts):
        e = starts[i + 1] if i + 1 < len(starts) else len(text)
        spans.append((s, e))
    return spans


def process_phase_file(path):
    text = path.read_text(encoding="utf-8")
    h1 = PHASE_H1_RE.search(text)
    if not h1:
        print(f"WARN: no phase H1 header found in {path.name}", file=sys.stderr)
        return
    phase_num, phase_name = h1.group(1), h1.group(2).strip()
    phase_int = int(phase_num)

    first_head = HEADER_RE.search(text)
    overview_end = first_head.start() if first_head else len(text)
    add_chunk(doc=path.name, phase=phase_num, phase_name=phase_name, section="0.0",
              title="PHASE OVERVIEW", kind="overview", mind="NEUTRAL", rule_id=None,
              text=text[:overview_end].strip())

    for (_, num, title, bstart, bend) in section_spans(text):
        body = text[bstart:bend]
        upper = title.upper()

        add_chunk(doc=path.name, phase=phase_num, phase_name=phase_name, section=num,
                   title=title, kind="section", mind="NEUTRAL", rule_id=None,
                   text=f"## {num} {title}\n{body.strip()}")

        if "FALSIFICATION PROCEDURES" in upper:
            for (s, e) in bullet_spans(body, BULLET_RE):
                btxt = body[s:e].strip()
                if not btxt.startswith("-"):
                    continue
                cid = add_chunk(doc=path.name, phase=phase_num, phase_name=phase_name,
                                  section=num, title=title, kind="falsification",
                                  mind="RIVAL", rule_id=None, text=btxt)
                label = btxt.split("**")[1] if btxt.count("**") >= 2 else btxt[:60]
                flight.append(dict(phase=phase_int, phase_num=phase_num, phase_name=phase_name,
                                     pos=bstart + s, kind="falsification", mind="RIVAL",
                                     chunk_id=cid, rule_id=None, title=label))

        if upper.startswith("EXIT GATE"):
            for (s, e) in bullet_spans(body, GATE_ITEM_RE):
                btxt = body[s:e].strip()
                if not btxt.startswith("- ["):
                    continue
                cid = add_chunk(doc=path.name, phase=phase_num, phase_name=phase_name,
                                  section=num, title=title, kind="gate", mind="PRINCIPAL",
                                  rule_id=None, text=btxt)
                flight.append(dict(phase=phase_int, phase_num=phase_num, phase_name=phase_name,
                                     pos=bstart + s, kind="gate", mind="PRINCIPAL",
                                     chunk_id=cid, rule_id=None, title=btxt[:70]))

    # Rules are scanned across the WHOLE file, not section-scoped: P22/P23/P25
    # keep their R-numbered rules under differently-named sections (e.g. "THE
    # COMMIT DISCIPLINE"), not under a section literally titled "EXHAUSTIVE RULES".
    rule_matches = list(RULE_RE.finditer(text))
    for i, m in enumerate(rule_matches):
        s = m.start()
        e = rule_matches[i + 1].start() if i + 1 < len(rule_matches) else len(text)
        nh = HEADER_RE.search(text, m.end())
        if nh and nh.start() < e:
            e = nh.start()
        rid = m.group(1)
        cid = add_chunk(doc=path.name, phase=phase_num, phase_name=phase_name,
                          section=nearest_subheading(text, s) or "", title=f"Rule {rid}",
                          kind="rule", mind="STANDARD", rule_id=rid, text=text[s:e].strip())
        flight.append(dict(phase=phase_int, phase_num=phase_num, phase_name=phase_name,
                             pos=s, kind="rule", mind="STANDARD", chunk_id=cid,
                             rule_id=rid, title=rid))

    # "### Step N ..." procedure blocks (P00/P01/P02 style setup phases)
    step_matches = list(STEP_RE.finditer(text))
    for i, m in enumerate(step_matches):
        s = m.start()
        e = step_matches[i + 1].start() if i + 1 < len(step_matches) else len(text)
        nh = HEADER_RE.search(text, m.end())
        if nh and nh.start() < e:
            e = nh.start()
        title = m.group(1).strip()
        cid = add_chunk(doc=path.name, phase=phase_num, phase_name=phase_name, section="",
                          title=title, kind="procedure_step", mind="STANDARD", rule_id=None,
                          text=text[s:e].strip())
        flight.append(dict(phase=phase_int, phase_num=phase_num, phase_name=phase_name,
                             pos=s, kind="procedure_step", mind="STANDARD", chunk_id=cid,
                             rule_id=None, title=title[:60]))


def process_reference_file(path):
    """Appendices, the master protocol, the boot file: indexed for search only —
    never part of the flight plan (nothing to 'complete' about a definition)."""
    text = path.read_text(encoding="utf-8")
    h1 = GENERIC_H1_RE.search(text)
    doc_title = h1.group(1).strip() if h1 else path.name
    spans = section_spans(text)

    if not spans:
        add_chunk(doc=path.name, phase=None, phase_name=doc_title, section="", title=doc_title,
                   kind="reference", mind="NEUTRAL", rule_id=None, text=text.strip())
        return

    lead = text[:spans[0][0]].strip()
    if lead:
        add_chunk(doc=path.name, phase=None, phase_name=doc_title, section="0.0",
                   title="OVERVIEW", kind="reference", mind="NEUTRAL", rule_id=None, text=lead)

    for (_, num, title, bstart, bend) in spans:
        body = text[bstart:bend].strip()
        add_chunk(doc=path.name, phase=None, phase_name=doc_title, section=num, title=title,
                   kind="reference", mind="NEUTRAL", rule_id=None, text=f"## {num} {title}\n{body}")


def main():
    phase_files = sorted(ROOT.glob("PHASE_*.md"))
    other_files = sorted(ROOT.glob("APPENDIX_*.md")) + [ROOT / "00_MASTER_PROTOCOL.md", ROOT / "AGENT_BOOT.md"]

    if not phase_files:
        print(f"ERROR: no PHASE_*.md files found under {ROOT}", file=sys.stderr)
        sys.exit(1)

    for p in phase_files:
        process_phase_file(p)
    for p in other_files:
        if p.exists():
            process_reference_file(p)

    flight.sort(key=lambda r: (r["phase"], r["pos"]))
    for i, r in enumerate(flight, start=1):
        r["order_idx"] = i
        r["step_id"] = f"P{r['phase_num']}-{r['kind'].upper()[:4]}-{i:04d}"

    with open(OUT / "chunks.jsonl", "w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")

    with open(OUT / "flight_plan.json", "w", encoding="utf-8") as f:
        json.dump(flight, f, ensure_ascii=False, indent=2)

    db_path = OUT / "zdp_index.sqlite"
    if db_path.exists():
        db_path.unlink()
    conn = sqlite3.connect(db_path)
    conn.execute("""CREATE TABLE chunks (
        chunk_id TEXT PRIMARY KEY, doc TEXT, phase TEXT, phase_name TEXT,
        section TEXT, title TEXT, kind TEXT, mind TEXT, rule_id TEXT, text TEXT)""")
    conn.executemany("INSERT INTO chunks VALUES (?,?,?,?,?,?,?,?,?,?)", [
        (c["chunk_id"], c["doc"], c.get("phase"), c.get("phase_name"), c.get("section"),
         c.get("title"), c["kind"], c["mind"], c.get("rule_id"), c["text"]) for c in chunks
    ])

    fts5_ok = True
    try:
        conn.execute("CREATE VIRTUAL TABLE chunks_fts USING fts5(chunk_id UNINDEXED, title, text)")
        conn.executemany("INSERT INTO chunks_fts (chunk_id, title, text) VALUES (?,?,?)",
                          [(c["chunk_id"], c.get("title") or "", c["text"]) for c in chunks])
    except sqlite3.OperationalError as e:
        fts5_ok = False
        print(f"NOTE: FTS5 unavailable ({e}) — search will fall back to a keyword scorer.", file=sys.stderr)

    conn.execute("""CREATE TABLE flight_plan (
        step_id TEXT PRIMARY KEY, order_idx INTEGER, phase TEXT, phase_name TEXT,
        kind TEXT, mind TEXT, title TEXT, chunk_id TEXT, rule_id TEXT)""")
    conn.executemany("INSERT INTO flight_plan VALUES (?,?,?,?,?,?,?,?,?)", [
        (r["step_id"], r["order_idx"], r["phase_num"], r["phase_name"], r["kind"], r["mind"],
         r["title"], r["chunk_id"], r["rule_id"]) for r in flight
    ])
    conn.execute("CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)")
    conn.execute("INSERT INTO meta VALUES ('fts5_ok', ?)", (str(fts5_ok),))
    conn.execute("INSERT INTO meta VALUES ('total_chunks', ?)", (str(len(chunks)),))
    conn.execute("INSERT INTO meta VALUES ('total_steps', ?)", (str(len(flight)),))
    conn.commit()
    conn.close()

    print(f"chunks indexed:      {len(chunks)}")
    print(f"flight plan steps:   {len(flight)}")
    by_kind = {}
    for r in flight:
        by_kind[r["kind"]] = by_kind.get(r["kind"], 0) + 1
    print(f"by kind:             {by_kind}")
    by_phase = {}
    for r in flight:
        by_phase[r["phase_num"]] = by_phase.get(r["phase_num"], 0) + 1
    print("by phase:")
    for k in sorted(by_phase, key=lambda x: int(x)):
        print(f"  P{k}: {by_phase[k]}")
    print(f"FTS5 available:      {fts5_ok}")
    print(f"wrote: {OUT/'chunks.jsonl'}")
    print(f"wrote: {OUT/'flight_plan.json'}")
    print(f"wrote: {OUT/'zdp_index.sqlite'}")


if __name__ == "__main__":
    main()
