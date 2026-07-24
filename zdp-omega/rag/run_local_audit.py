#!/usr/bin/env python3
"""
run_local_audit.py — Runs the ZDP-Omega audit automatically using a local LLM via Ollama.
Standard library only (urllib, json, sqlite3, subprocess, os).
"""

import argparse
import datetime
import json
import os
import re
import subprocess
import sys
import urllib.request
import urllib.error
import sqlite3
from pathlib import Path

# Paths
HERE = Path(__file__).resolve().parent
INDEX_DB = HERE / "index" / "zdp_index.sqlite"
STATE_DIR = HERE / "state"

# Mind Contexts
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

class OllamaClient:
    def __init__(self, model_name, base_url="http://localhost:11434", timeout=600):
        self.model_name = model_name
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout

    def check_connection(self):
        url = f"{self.base_url}/api/tags"
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    models = [m["name"] for m in data.get("models", [])]
                    return True, models
        except Exception as e:
            return False, str(e)
        return False, "Unknown connection issue"

    def chat(self, messages, tools=None):
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model_name,
            "messages": messages,
            "stream": False
        }
        if tools:
            payload["tools"] = tools

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                if response.status == 200:
                    resp_data = json.loads(response.read().decode("utf-8"))
                    return resp_data.get("message", {})
                else:
                    raise RuntimeError(f"Ollama returned HTTP status {response.status}")
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Ollama HTTP Error {e.code}: {err_body}")
        except Exception as e:
            raise RuntimeError(f"Failed to communicate with Ollama: {e}")

class ToolBox:
    def __init__(self, codebase_root, conn, run_name, state):
        self.codebase_root = Path(codebase_root).resolve()
        self.conn = conn
        self.run_name = run_name
        self.state = state
        self.step_completed = False
        self.completed_data = None

    def execute(self, name, args):
        if not hasattr(self, name):
            return f"Error: Tool '{name}' is not supported."
        try:
            return getattr(self, name)(**args)
        except Exception as e:
            return f"Error executing tool '{name}': {e}"

    def list_dir(self, path=""):
        target_path = (self.codebase_root / path).resolve()
        if not target_path.as_posix().startswith(self.codebase_root.as_posix()):
            return "Error: Path traversal outside codebase is blocked."
        if not target_path.exists():
            return f"Error: Path '{path}' does not exist."
        if not target_path.is_dir():
            return f"Error: Path '{path}' is a file, use read_file instead."

        try:
            entries = []
            for entry in os.scandir(target_path):
                if entry.name in {".git", "node_modules", "venv", ".venv", "__pycache__", "build", "dist", "index", "state", ".gemini", ".agents"}:
                    continue
                t = "DIR" if entry.is_dir() else "FILE"
                entries.append(f"{entry.name} [{t}]")
            entries.sort()
            if not entries:
                return "Directory is empty."
            return "\n".join(entries)
        except Exception as e:
            return f"Error listing directory: {e}"

    def read_file(self, path, start_line=1, end_line=None):
        target_path = (self.codebase_root / path).resolve()
        if not target_path.as_posix().startswith(self.codebase_root.as_posix()):
            return "Error: Path traversal outside codebase is blocked."
        if not target_path.exists():
            return f"Error: File '{path}' does not exist."
        if not target_path.is_file():
            return f"Error: Path '{path}' is a directory, use list_dir instead."

        try:
            with open(target_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            
            total_lines = len(lines)
            start = max(1, start_line)
            
            if end_line is None:
                end = min(total_lines, start + 99)
            else:
                end = min(total_lines, max(start, end_line))
            
            output = []
            for idx in range(start - 1, end):
                output.append(f"{idx + 1}: {lines[idx].rstrip()}")
            
            header = f"=== File: {path} (Lines {start}-{end} of {total_lines}) ===\n"
            return header + "\n".join(output)
        except Exception as e:
            return f"Error reading file: {e}"

    def grep_search(self, query, path=""):
        target_path = (self.codebase_root / path).resolve()
        if not target_path.as_posix().startswith(self.codebase_root.as_posix()):
            return "Error: Path traversal outside codebase is blocked."
        if not target_path.exists():
            return f"Error: Search path '{path}' does not exist."

        ignored_dirs = {".git", "node_modules", "venv", ".venv", "__pycache__", "build", "dist", "index", "state", ".gemini", ".agents"}
        ignored_exts = {".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".tar.gz", ".db", ".sqlite", ".sqlite3", ".exe", ".dll", ".so", ".dylib", ".woff", ".woff2", ".ttf", ".eot", ".svg", ".ico"}

        results = []
        match_count = 0
        max_matches = 100
        max_files = 50
        file_count = 0

        for current_dir, dirs, files in os.walk(target_path):
            dirs[:] = [d for d in dirs if d not in ignored_dirs]
            
            for file in files:
                file_path = Path(current_dir) / file
                if file_path.suffix.lower() in ignored_exts:
                    continue
                
                try:
                    rel_path = file_path.relative_to(self.codebase_root).as_posix()
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        for line_num, line in enumerate(f, 1):
                            if query.lower() in line.lower():
                                results.append(f"{rel_path}:{line_num}: {line.strip()}")
                                match_count += 1
                                if match_count >= max_matches:
                                    break
                except Exception:
                    continue
                
                if match_count >= max_matches:
                    break
                
                file_count += 1
                if file_count >= max_files:
                    break
            
            if match_count >= max_matches or file_count >= max_files:
                break

        if not results:
            return "No matches found."
        
        output = "\n".join(results)
        if match_count >= max_matches:
            output += "\n... (truncated: reached max match limit)"
        return output

    def run_command(self, command):
        print(f"\n[AGENT PROPOSED COMMAND]: {command}")
        auth = input("Authorize execution? (y/N): ").strip().lower()
        if auth not in ("y", "yes"):
            return "Error: Command execution rejected by human operator."

        try:
            res = subprocess.run(
                command,
                shell=True,
                cwd=self.codebase_root,
                capture_output=True,
                text=True,
                timeout=60
            )
            output = f"Exit code: {res.returncode}\n"
            if res.stdout:
                output += f"Stdout:\n{res.stdout}\n"
            if res.stderr:
                output += f"Stderr:\n{res.stderr}\n"
            return output
        except subprocess.TimeoutExpired:
            return "Error: Command timed out after 60 seconds."
        except Exception as e:
            return f"Error executing command: {e}"

    def search_rules(self, query):
        row = self.conn.execute("SELECT v FROM meta WHERE k='fts5_ok'").fetchone()
        fts5_ok = row and row[0] == "True"
        limit = 5

        if fts5_ok:
            fts_query = " OR ".join(f'"{w}"' for w in query.replace('"', '').split() if w)
            sql = """
                SELECT c.chunk_id, c.phase, c.title, c.kind, snippet(chunks_fts, 2, '[', ']', ' ... ', 12)
                FROM chunks_fts JOIN chunks c ON c.chunk_id = chunks_fts.chunk_id
                WHERE chunks_fts MATCH ?
                ORDER BY bm25(chunks_fts) LIMIT ?
            """
            try:
                rows = self.conn.execute(sql, [fts_query, limit]).fetchall()
                if rows:
                    output = []
                    for cid, phase, title, kind, snippet in rows:
                        p_lbl = f"P{phase}" if phase else "ref"
                        output.append(f"[{cid}] {p_lbl} | {kind} | {title}\n    Snippet: {snippet}\n")
                    return "\n".join(output)
            except sqlite3.OperationalError:
                pass

        # Fallback naive search
        terms = [t.lower() for t in query.split() if t]
        sql = "SELECT chunk_id, phase, title, kind, text FROM chunks"
        scored = []
        for chunk_id, phase, title, kind, text in self.conn.execute(sql):
            low = text.lower()
            score = sum(low.count(t) for t in terms)
            if score:
                idx = low.find(terms[0]) if terms else 0
                snippet = text[max(0, idx - 60):idx + 140].replace("\n", " ")
                scored.append((score, chunk_id, phase, title, kind, snippet))
        
        scored.sort(key=lambda r: -r[0])
        rows = scored[:limit]
        if not rows:
            return "No matching rules found."
        
        output = []
        for _, cid, phase, title, kind, snippet in rows:
            p_lbl = f"P{phase}" if phase else "ref"
            output.append(f"[{cid}] {p_lbl} | {kind} | {title}\n    Snippet: {snippet}\n")
        return "\n".join(output)

    def complete_step(self, step_id, verdict, evidence, severity=None, file=None):
        if verdict not in {"PASS", "FAIL", "BLOCKED", "N/A"}:
            return "Error: --verdict must be PASS, FAIL, BLOCKED, or N/A."
        if verdict == "FAIL" and not severity:
            return "Error: A FAIL verdict requires severity P0, P1, P2, or P3."
        if not evidence:
            return "Error: Evidence must be provided."

        try:
            # Query step details to verify
            row = self.conn.execute("SELECT phase, phase_name, kind, mind, title, rule_id FROM flight_plan WHERE step_id=?", (step_id,)).fetchone()
            if not row:
                return f"Error: Unknown step_id '{step_id}'."
            phase, phase_name, kind, mind, title, rule_id = row

            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            self.state["steps"][step_id] = {
                "verdict": verdict, "evidence": evidence, "file": file,
                "severity": severity, "completed_at": now,
            }

            finding_id = None
            if verdict == "FAIL":
                finding_id = f"FND-{now[:10].replace('-', '')}-{len(self.state['findings']) + 1:04d}"
                self.state["findings"].append({
                    "id": finding_id, "step_id": step_id, "phase": phase, "phase_name": phase_name,
                    "rule_id": rule_id, "title": title, "severity": severity,
                    "evidence": evidence, "file_ref": file, "sourced_by_mind": mind,
                    "opened_at": now, "status": "OPEN",
                })
                self.state["steps"][step_id]["finding_id"] = finding_id

            save_state(self.run_name, self.state)
            self.step_completed = True
            self.completed_data = {
                "step_id": step_id,
                "verdict": verdict,
                "finding_id": finding_id,
                "severity": severity,
                "evidence": evidence
            }
            return f"Success: Recorded {step_id} -> {verdict}" + (f" (Opened {finding_id}, {severity})" if finding_id else "")
        except Exception as e:
            return f"Error completing step: {e}"

def load_state(run):
    p = STATE_DIR / f"{run}.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {"run": run, "codebase": None,
            "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "steps": {}, "findings": [], "last_phase_shown": None}

def save_state(run, state):
    STATE_DIR.mkdir(exist_ok=True)
    p = STATE_DIR / f"{run}.json"
    p.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")

def get_next_step(conn, state, phase_filter=None):
    q = "SELECT step_id, order_idx, phase, phase_name, kind, mind, title, chunk_id, rule_id FROM flight_plan"
    params = []
    if phase_filter:
        q += " WHERE phase=?"
        params.append(phase_filter.zfill(2))
    q += " ORDER BY order_idx"

    for row in conn.execute(q, params):
        step_id, order_idx, phase, phase_name, kind, mind, title, chunk_id, rule_id = row
        if step_id in state["steps"] and state["steps"][step_id].get("verdict") in {"PASS", "FAIL", "BLOCKED", "N/A"}:
            continue
        
        # Retrieve chunk text
        chunk_row = conn.execute("SELECT text FROM chunks WHERE chunk_id=?", (chunk_id,)).fetchone()
        text = chunk_row[0] if chunk_row else ""
        return {
            "step_id": step_id,
            "order_idx": order_idx,
            "phase": phase,
            "phase_name": phase_name,
            "kind": kind,
            "mind": mind,
            "title": title,
            "rule_id": rule_id,
            "chunk_id": chunk_id,
            "text": text
        }
    return None

def get_tool_definitions():
    return [
        {
            "type": "function",
            "function": {
                "name": "list_dir",
                "description": "List the contents of a directory in the target codebase. Excludes common folders like .git, node_modules.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Relative path from the codebase root (e.g. '', 'src', or 'lib/helpers')."
                        }
                    },
                    "required": []
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "Read the contents of a file in the target codebase. Returns content annotated with line numbers.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Relative path to the file from the codebase root."
                        },
                        "start_line": {
                            "type": "integer",
                            "description": "Line number to start reading from (1-indexed). Defaults to 1."
                        },
                        "end_line": {
                            "type": "integer",
                            "description": "Line number to stop reading at (inclusive). Defaults to start_line + 99."
                        }
                    },
                    "required": ["path"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "grep_search",
                "description": "Perform a recursive text search for a query string in codebase files.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The case-insensitive substring search pattern."
                        },
                        "path": {
                            "type": "string",
                            "description": "Optional relative path directory to restrict the search."
                        }
                    },
                    "required": ["query"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "run_command",
                "description": "Propose and execute a shell command (like a test suite or linter) within the codebase directory. This requires human approval first.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {
                            "type": "string",
                            "description": "The command line string to run."
                        }
                    },
                    "required": ["command"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "search_rules",
                "description": "Search the ZDP-Omega rules database for protocol requirements and details using keywords.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The keyword search query."
                        }
                    },
                    "required": ["query"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "complete_step",
                "description": "Record the audit verdict and evidence for the current step. Calling this resolves the step.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "step_id": {
                            "type": "string",
                            "description": "The step_id of the current step."
                        },
                        "verdict": {
                            "type": "string",
                            "enum": ["PASS", "FAIL", "BLOCKED", "N/A"],
                            "description": "The audit verdict."
                        },
                        "evidence": {
                            "type": "string",
                            "description": "Detailed explanation of code observed, line references, or command outputs. No vague remarks."
                        },
                        "severity": {
                            "type": "string",
                            "enum": ["P0", "P1", "P2", "P3"],
                            "description": "Required if verdict is 'FAIL'. Select based on severity of finding."
                        },
                        "file": {
                            "type": "string",
                            "description": "Optional file and line number pointer (e.g. 'src/app.py:55')."
                        }
                    },
                    "required": ["step_id", "verdict", "evidence"]
                }
            }
        }
    ]

def get_top_level_files(codebase_path):
    try:
        entries = []
        for entry in os.scandir(codebase_path):
            if entry.name in {".git", "node_modules", "venv", ".venv", "__pycache__", "build", "dist", "index", "state", ".gemini", ".agents"}:
                continue
            t = "DIR" if entry.is_dir() else "FILE"
            entries.append(f"{entry.name} [{t}]")
        entries.sort()
        return ", ".join(entries)
    except Exception:
        return "Unable to list files"

def main():
    parser = argparse.ArgumentParser(description="ZDP-Omega Offline LLM Agent Runner")
    parser.add_argument("--run", default="default", help="Audit run name")
    parser.add_argument("--model", default="gemma4:e2b", help="Ollama model name")
    parser.add_argument("--codebase", help="Path to codebase directory (initializes the run codebase)")
    parser.add_argument("--ollama-url", default="http://localhost:11434", help="Ollama base URL")
    parser.add_argument("--limit", type=int, default=1, help="Maximum number of steps to resolve in this session")
    parser.add_argument("--interactive", action="store_true", help="Confirm before starting each step and after step completion")
    parser.add_argument("--phase", help="Restrict to a specific phase, e.g. 01")
    args = parser.parse_args()

    # Load State
    state = load_state(args.run)
    if args.codebase:
        state["codebase"] = str(Path(args.codebase).resolve())
        save_state(args.run, state)
        print(f"Run '{args.run}' initialized with codebase: {state['codebase']}")

    if not state.get("codebase"):
        print("ERROR: Codebase is not set. Run with '--codebase <path>' to initialize.", file=sys.stderr)
        sys.exit(1)

    codebase_root = Path(state["codebase"]).resolve()
    if not codebase_root.exists() or not codebase_root.is_dir():
        print(f"ERROR: Codebase path '{codebase_root}' does not exist or is not a directory.", file=sys.stderr)
        sys.exit(1)

    # Connect to SQLite Database
    if not INDEX_DB.exists():
        print(f"ERROR: ZDP Index DB not found at {INDEX_DB}. Run build_index.py first.", file=sys.stderr)
        sys.exit(1)
    
    conn = sqlite3.connect(INDEX_DB)

    # Initialize Ollama Client
    client = OllamaClient(args.model, base_url=args.ollama_url)
    connected, info = client.check_connection()
    if not connected:
        print(f"ERROR: Cannot connect to Ollama at {args.ollama_url}. Is Ollama running? Details: {info}", file=sys.stderr)
        conn.close()
        sys.exit(1)

    if args.model not in info:
        print(f"WARNING: Model '{args.model}' is not listed in Ollama. Available models: {', '.join(info)}")
        ans = input("Do you want to proceed anyway? (y/N): ").strip().lower()
        if ans not in ("y", "yes"):
            conn.close()
            sys.exit(0)

    print(f"\nConnected to Ollama! Using model: {args.model}")
    print(f"Codebase: {codebase_root}")
    print(f"RAG Run: {args.run}\n")

    steps_resolved = 0
    tools_config = get_tool_definitions()

    while steps_resolved < args.limit:
        # Find the next step
        step = get_next_step(conn, state, phase_filter=args.phase)
        if not step:
            print("No unresolved steps remain. Audit complete!")
            break

        print("=" * 80)
        print(f"STARTING STEP {step['order_idx']}: {step['step_id']}")
        print(f"Phase {step['phase']} — {step['phase_name']}  |  Kind: {step['kind']}")
        print(f"Title: {step['title']}")
        print("=" * 80)

        if args.interactive:
            ans = input("Proceed with this step? (Y/n): ").strip().lower()
            if ans in ("n", "no"):
                print("Skipping/exiting.")
                break

        # Setup toolbox for the step
        toolbox = ToolBox(codebase_root, conn, args.run, state)

        # Prepare System Prompt
        system_prompt = (
            "You are an expert AI software auditor executing the ZDP-Ω (Zero-Defect Protocol Omega) audit.\n"
            "You run inside an agent loop with tool-calling capabilities. Your task is to verify individual audit steps.\n\n"
            "CRITICAL RULES:\n"
            "1. Inspect the codebase using your tools (`list_dir`, `read_file`, `grep_search`, `run_command`). Never guess.\n"
            "2. Adopt the requested MIND posture strictly. Keep an adversarial/demanding outlook where requested.\n"
            "3. You MUST invoke the `complete_step` tool once you have checked the code and determined a verdict. You cannot complete a step without calling `complete_step`.\n"
            "4. Verdicts are: PASS (verified correct), FAIL (flaw found), BLOCKED (cannot check in this environment), or N/A (does not apply).\n"
            "5. If verdict is FAIL, you MUST supply a severity (P0, P1, P2, P3).\n"
            "6. Provide concrete evidence (file names, line numbers, snippet details, command output) in the evidence parameter. Vague remarks like 'looks good' violate the protocol.\n"
        )

        top_files = get_top_level_files(codebase_root)
        user_message_content = (
            f"AUDIT STEP TO RESOLVE:\n"
            f"Step ID: {step['step_id']}\n"
            f"Title: {step['title']}\n"
            f"Postures/Mind: {step['mind']} - {MIND_BLURB.get(step['mind'], '')}\n\n"
            f"INSTRUCTION TO VERIFY:\n"
            f"{step['text']}\n\n"
            f"Codebase Top-Level Contents:\n"
            f"{top_files}\n\n"
            f"Please check the codebase and resolve this step using your tools. Make sure to call `complete_step` when you are done."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message_content}
        ]

        turns = 0
        max_turns = 15
        
        while not toolbox.step_completed and turns < max_turns:
            turns += 1
            print(f"\n[Turn {turns}/{max_turns}] Querying local model...")
            
            try:
                response = client.chat(messages, tools=tools_config)
            except Exception as e:
                print(f"API Error: {e}", file=sys.stderr)
                break

            # Process Model Response text
            content = response.get("content")
            if content:
                print(f"\n[Model Thoughts]:\n{content}")
            
            messages.append(response)

            # Process Tool Calls
            tool_calls = response.get("tool_calls", [])
            if not tool_calls:
                if not toolbox.step_completed:
                    # Model gave text response without tool call
                    print("\n[System Warning] Model did not call complete_step or any tool.")
                    prompt_msg = (
                        "You must use the `complete_step` tool to record your verdict (PASS, FAIL, BLOCKED, or N/A) "
                        "and submit evidence for this step to progress the audit. If you need to inspect files first, "
                        "use the codebase tools."
                    )
                    messages.append({"role": "user", "content": prompt_msg})
                continue

            for tc in tool_calls:
                tc_id = tc.get("id")
                func_info = tc.get("function", {})
                name = func_info.get("name")
                raw_args = func_info.get("arguments", {})

                # Some models return arguments as JSON strings, others as dicts
                if isinstance(raw_args, str):
                    try:
                        args_dict = json.loads(raw_args)
                    except Exception:
                        args_dict = {}
                else:
                    args_dict = raw_args

                print(f"-> Model requested tool: {name}({args_dict})")
                
                # Execute the tool
                tool_output = toolbox.execute(name, args_dict)
                
                # Limit tool output print size to avoid spamming the console
                display_output = tool_output if len(tool_output) < 300 else tool_output[:300] + "\n... (truncated)"
                print(f"<- Tool returned:\n{display_output}")

                # Append tool response
                tool_msg = {
                    "role": "tool",
                    "name": name,
                    "content": tool_output
                }
                if tc_id:
                    tool_msg["tool_call_id"] = tc_id
                messages.append(tool_msg)

        if toolbox.step_completed:
            res = toolbox.completed_data
            print("\n" + "=" * 50)
            print(f"STEP RESOLVED: {res['step_id']}")
            print(f"Verdict: {res['verdict']}")
            if res['finding_id']:
                print(f"Opened Finding: {res['finding_id']} ({res['severity']})")
            print(f"Evidence: {res['evidence']}")
            print("=" * 50 + "\n")
            steps_resolved += 1
            # Refresh local state
            state = toolbox.state
        else:
            print(f"\n[Warning] Step {step['step_id']} was NOT resolved after {max_turns} turns.\n", file=sys.stderr)
            if args.interactive:
                ans = input("Retry this step? (y/N): ").strip().lower()
                if ans in ("y", "yes"):
                    continue
            break

    conn.close()
    print(f"Session finished. Resolved {steps_resolved} steps in this run.")

if __name__ == "__main__":
    main()
