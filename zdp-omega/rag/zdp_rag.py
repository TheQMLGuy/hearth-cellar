#!/usr/bin/env python3
"""
zdp_rag.py — the runtime tool a model (large or small) calls to execute the
ZDP-Omega audit one atomic step at a time, without ever needing to hold the
whole 26-phase protocol in context.

Five commands are the entire interface:

  next                       -> the next unresolved step, in full, ready to act on
  complete STEP_ID           -> record a verdict for a step, advance the plan
  search "query"             -> keyword search across every chunk in the corpus
  get ID                     -> exact fetch by step_id / chunk_id / rule_id
  status                     -> progress summary, open findings, phase position

Everything is stdlib-only (sqlite3, json, argparse). No network, no install.

State for a given audit run lives in state/<run>.json (default run: "default"),
separately from the shared, read-only index/ built by build_index.py — so one
protocol index serves any number of concurrent audits of different codebases.
"""
import argparse, json, sqlite3, sys, textwrap, datetime, signal
from pathlib import Path

try:
    signal.signal(signal.SIGPIPE, signal.SIG_DFL)  # quiet exit if piped into head/less, etc.
except (AttributeError, ValueError):
    pass  # SIGPIPE doesn't exist on this platform (e.g. Windows) — nothing to do

HERE = Path(__file__).resolve().parent
INDEX_DB = HERE / "index" / "zdp_index.sqlite"
STATE_DIR = HERE / "state"
STATE_DIR.mkdir(exist_ok=True)

MIND_BLURB = {
    "RIVAL": ('MIND: THE RIVAL. You are the most capable attacker this system will ever face, '
              'and the founder of the product that replaces it if it stumbles. No benefit of the '
              'doubt. No courtesy notice. If it isn\'t broken, that\'s yours to prove with evidence.'),
    "PRINCIPAL": ('MIND: THE PRINCIPAL. You financed this and could have built it yourself, faster, '
                  'on a Sunday. "Mostly done" does not finish as a sentence. Guilty until the evidence '
                  'tier actually matches what this step demands.'),
    "STANDARD": ('MIND: STANDARD RULE-CHECK. No benefit of the doubt on ambiguous behavior — score it '
                 'as the worst plausible case until a test proves otherwise.'),
    "NEUTRAL": ("Reference material."),
}

VERDICTS = {"PASS", "FAIL", "BLOCKED", "N/A"}


def die(msg, code=1):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def connect():
    if not INDEX_DB.exists():
        die(f"index not found at {INDEX_DB} — run build_index.py first.")
    return sqlite3.connect(INDEX_DB)


def fts5_available(conn):
    row = conn.execute("SELECT v FROM meta WHERE k='fts5_ok'").fetchone()
    return row and row[0] == "True"


def state_path(run):
    return STATE_DIR / f"{run}.json"


def load_state(run):
    p = state_path(run)
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {"run": run, "codebase": None,
            "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "steps": {}, "findings": [], "last_phase_shown": None}


def save_state(run, state):
    state_path(run).write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def get_chunk_text(conn, chunk_id):
    row = conn.execute("SELECT text FROM chunks WHERE chunk_id=?", (chunk_id,)).fetchone()
    return row[0] if row else "(chunk not found)"


def total_steps(conn):
    return conn.execute("SELECT COUNT(*) FROM flight_plan").fetchone()[0]


# ---------------------------------------------------------------- next
def cmd_next(args):
    conn = connect()
    state = load_state(args.run)
    total = total_steps(conn)

    q = "SELECT step_id, order_idx, phase, phase_name, kind, mind, title, chunk_id, rule_id FROM flight_plan"
    params = []
    if args.phase:
        q += " WHERE phase=?"
        params.append(args.phase.zfill(2))
    q += " ORDER BY order_idx"

    for row in conn.execute(q, params):
        step_id, order_idx, phase, phase_name, kind, mind, title, chunk_id, rule_id = row
        if step_id in state["steps"] and state["steps"][step_id].get("verdict") in VERDICTS:
            continue
        # found the first unresolved step
        phase_banner = ""
        if state.get("last_phase_shown") != phase:
            phase_banner = f"\n{'='*70}\n>>> ENTERING PHASE {phase} — {phase_name}\n{'='*70}\n"
            state["last_phase_shown"] = phase
            save_state(args.run, state)

        text = get_chunk_text(conn, chunk_id)
        print(phase_banner)
        print(f"STEP {order_idx} of {total}   |   step_id = {step_id}")
        print(f"Phase {phase} — {phase_name}   |   kind = {kind}")
        print(f"\n{MIND_BLURB.get(mind, '')}\n")
        print(textwrap.indent(text, "  "))
        print("\nDo this now against the actual codebase (read real files — never guess).")
        print("Decide exactly one verdict: PASS, FAIL, BLOCKED, or N/A. Never UNKNOWN.")
        print(f"Then run:\n  python3 zdp_rag.py complete {step_id} --verdict <VERDICT> --evidence \"...\" "
              f"[--severity P0|P1|P2|P3] [--file path:line]")
        return
    print(f"No unresolved steps remain{' in phase ' + args.phase if args.phase else ''}. "
          f"Run 'python3 zdp_rag.py status' for the full picture.")


# ------------------------------------------------------------ complete
def cmd_complete(args):
    if args.verdict not in VERDICTS:
        die(f"--verdict must be one of {sorted(VERDICTS)}")
    conn = connect()
    row = conn.execute("SELECT order_idx, phase, phase_name, kind, mind, title, rule_id FROM flight_plan WHERE step_id=?",
                        (args.step_id,)).fetchone()
    if not row:
        die(f"unknown step_id '{args.step_id}' — run 'next' to get a real one.")
    order_idx, phase, phase_name, kind, mind, title, rule_id = row

    if args.verdict == "FAIL" and not args.severity:
        die("a FAIL verdict requires --severity P0|P1|P2|P3 — severity is law, it does not default (AGENT_BOOT PD #8).")
    if not args.evidence:
        die("--evidence is required (a pointer, not a feeling — MASTER §3 Evidence Model). "
            "'looks fine' is a protocol violation, not evidence.")

    state = load_state(args.run)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    state["steps"][args.step_id] = {
        "verdict": args.verdict, "evidence": args.evidence, "file": args.file,
        "severity": args.severity, "completed_at": now,
    }

    finding_id = None
    if args.verdict == "FAIL":
        finding_id = f"FND-{now[:10].replace('-', '')}-{len(state['findings']) + 1:04d}"
        state["findings"].append({
            "id": finding_id, "step_id": args.step_id, "phase": phase, "phase_name": phase_name,
            "rule_id": rule_id, "title": title, "severity": args.severity,
            "evidence": args.evidence, "file_ref": args.file, "sourced_by_mind": mind,
            "opened_at": now, "status": "OPEN",
        })
        state["steps"][args.step_id]["finding_id"] = finding_id

    save_state(args.run, state)
    print(f"recorded: {args.step_id} -> {args.verdict}" + (f"  (opened {finding_id}, {args.severity})" if finding_id else ""))
    if args.verdict == "FAIL" and args.severity == "P0":
        print("\n*** P0 — per AGENT_BOOT PD #8 / MASTER §7: freeze new phase work, this routes to Phase 22 first. ***")


# --------------------------------------------------------------- search
def cmd_search(args):
    conn = connect()
    limit = args.k
    where = []
    params = []
    if args.kind:
        where.append("kind=?")
        params.append(args.kind)
    if args.phase:
        where.append("phase=?")
        params.append(args.phase.zfill(2))
    where_sql = (" AND " + " AND ".join(where)) if where else ""

    if fts5_available(conn):
        # Quote each term as a literal FTS5 string — unquoted hyphenated terms
        # (e.g. "cross-site", "time-of-check") get misparsed as FTS5 operators
        # and raise "no such column" instead of just not matching.
        fts_query = " OR ".join(f'"{w}"' for w in args.query.replace('"', '').split() if w)
        sql = f"""
            SELECT c.chunk_id, c.phase, c.title, c.kind, c.mind, snippet(chunks_fts, 2, '[', ']', ' ... ', 12)
            FROM chunks_fts JOIN chunks c ON c.chunk_id = chunks_fts.chunk_id
            WHERE chunks_fts MATCH ? {where_sql}
            ORDER BY bm25(chunks_fts) LIMIT ?
        """
        try:
            rows = conn.execute(sql, [fts_query] + params + [limit]).fetchall()
        except sqlite3.OperationalError:
            rows = []
    else:
        rows = []

    if not rows:
        # pure-python fallback: naive keyword overlap scoring, no dependencies
        terms = [t.lower() for t in args.query.split() if t]
        sql = f"SELECT chunk_id, phase, title, kind, mind, text FROM chunks WHERE 1=1{where_sql}"
        scored = []
        for chunk_id, phase, title, kind, mind, text in conn.execute(sql, params):
            low = text.lower()
            score = sum(low.count(t) for t in terms)
            if score:
                idx = low.find(terms[0]) if terms else 0
                snippet = text[max(0, idx - 60):idx + 140].replace("\n", " ")
                scored.append((score, chunk_id, phase, title, kind, mind, snippet))
        scored.sort(key=lambda r: -r[0])
        rows = [(c, p, t, k, m, s) for (_, c, p, t, k, m, s) in scored[:limit]]

    if not rows:
        print("no matches.")
        return
    for chunk_id, phase, title, kind, mind, snippet in rows:
        phase_lbl = f"P{phase}" if phase else "ref"
        print(f"[{chunk_id}] {phase_lbl:>4} | {kind:<13} | {mind:<9} | {title}")
        print(f"    {snippet}\n")


# ------------------------------------------------------------------ get
def cmd_get(args):
    conn = connect()
    row = conn.execute("SELECT chunk_id, doc, phase, phase_name, section, title, kind, mind, rule_id, text "
                        "FROM chunks WHERE chunk_id=? OR rule_id=?", (args.id, args.id)).fetchone()
    if row:
        chunk_id, doc, phase, phase_name, section, title, kind, mind, rule_id, text = row
        print(f"[{chunk_id}] {doc} §{section} — {title}  (kind={kind}, mind={mind})")
        print(textwrap.indent(text, "  "))
        return
    row = conn.execute("SELECT step_id, order_idx, phase, phase_name, kind, mind, title, chunk_id, rule_id "
                        "FROM flight_plan WHERE step_id=?", (args.id,)).fetchone()
    if row:
        step_id, order_idx, phase, phase_name, kind, mind, title, chunk_id, rule_id = row
        print(f"step {order_idx}: {step_id}  |  Phase {phase} — {phase_name}  |  kind={kind} mind={mind}")
        print(textwrap.indent(get_chunk_text(conn, chunk_id), "  "))
        return
    die(f"nothing found for id '{args.id}'")


# --------------------------------------------------------------- status
def cmd_status(args):
    conn = connect()
    state = load_state(args.run)
    total = total_steps(conn)
    resolved = sum(1 for s in state["steps"].values() if s.get("verdict") in VERDICTS)
    print(f"run: {args.run}   codebase: {state.get('codebase') or '(not set — use init --codebase)'}")
    print(f"progress: {resolved}/{total} steps resolved ({100*resolved//total if total else 0}%)")

    by_phase_total = {}
    for row in conn.execute("SELECT phase FROM flight_plan"):
        by_phase_total[row[0]] = by_phase_total.get(row[0], 0) + 1
    by_phase_done = {}
    for step_id, rec in state["steps"].items():
        if rec.get("verdict") in VERDICTS:
            phase = step_id.split("-")[0][1:]
            by_phase_done[phase] = by_phase_done.get(phase, 0) + 1
    print("\nby phase:")
    for p in sorted(by_phase_total, key=lambda x: int(x)):
        done = by_phase_done.get(p, 0)
        tot = by_phase_total[p]
        flag = " <- CLOSED" if done == tot else ""
        print(f"  P{p}: {done:>3}/{tot:<3}{flag}")

    sev_counts = {"P0": 0, "P1": 0, "P2": 0, "P3": 0}
    open_p0 = []
    for f in state["findings"]:
        if f["status"] == "OPEN":
            sev_counts[f["severity"]] = sev_counts.get(f["severity"], 0) + 1
            if f["severity"] == "P0":
                open_p0.append(f)
    print(f"\nopen findings by severity: {sev_counts}")
    if open_p0:
        print("\n*** OPEN P0s — per doctrine, ZDS = 0 while any of these are open ***")
        for f in open_p0:
            print(f"  {f['id']}  P{f['phase']} {f['title']}  -> {f['evidence'][:80]}")

    blocked = [sid for sid, r in state["steps"].items() if r.get("verdict") == "BLOCKED"]
    if blocked:
        print(f"\nBLOCKED steps needing a human ({len(blocked)}): {', '.join(blocked[:10])}"
              + (" ..." if len(blocked) > 10 else ""))


# --------------------------------------------------------------- init
def cmd_init(args):
    state = load_state(args.run)
    state["codebase"] = args.codebase
    save_state(args.run, state)
    print(f"run '{args.run}' initialized for codebase: {args.codebase}")


# -------------------------------------------------------------- findings
def cmd_findings(args):
    state = load_state(args.run)
    findings = state["findings"]
    if args.severity:
        findings = [f for f in findings if f["severity"] == args.severity]
    print(json.dumps(findings, indent=2, ensure_ascii=False))


def build_parser():
    ap = argparse.ArgumentParser(description="ZDP-Omega RAG runtime")
    ap.add_argument("--run", default="default", help="audit run name (lets you track several codebases at once)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("init", help="start/label a run for a specific codebase")
    p.add_argument("--codebase", required=True)
    p.set_defaults(func=cmd_init)

    p = sub.add_parser("next", help="get the next unresolved step")
    p.add_argument("--phase", help="restrict to one phase, e.g. 10")
    p.set_defaults(func=cmd_next)

    p = sub.add_parser("complete", help="record a verdict for a step")
    p.add_argument("step_id")
    p.add_argument("--verdict", required=True, choices=sorted(VERDICTS))
    p.add_argument("--evidence", required=True)
    p.add_argument("--severity", choices=["P0", "P1", "P2", "P3"])
    p.add_argument("--file", help="file:line pointer")
    p.set_defaults(func=cmd_complete)

    p = sub.add_parser("search", help="keyword search over the whole corpus")
    p.add_argument("query")
    p.add_argument("--kind", choices=["rule", "falsification", "gate", "procedure_step", "reference", "section", "overview"])
    p.add_argument("--phase")
    p.add_argument("-k", type=int, default=5)
    p.set_defaults(func=cmd_search)

    p = sub.add_parser("get", help="exact fetch by step_id / chunk_id / rule_id")
    p.add_argument("id")
    p.set_defaults(func=cmd_get)

    p = sub.add_parser("status", help="progress + open findings summary")
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("findings", help="dump recorded findings as JSON")
    p.add_argument("--severity", choices=["P0", "P1", "P2", "P3"])
    p.set_defaults(func=cmd_findings)

    return ap


if __name__ == "__main__":
    parser = build_parser()
    ns = parser.parse_args()
    ns.func(ns)
