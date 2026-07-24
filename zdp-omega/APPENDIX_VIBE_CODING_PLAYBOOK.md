# APPENDIX D — THE VIBE-CODING PLAYBOOK
> How the AI agent MUST behave *during* coding sessions to prevent the failure modes that trigger this whole system. If Phase 22 is remediation, this appendix is prevention **while you type**.

This document exists because the audit finds defects the AI itself introduced. The best cure is not injecting them.

---

## D.0 THE FOUR FAILURE MODES OF AI-ASSISTED CODING
Any defect an AI assistant introduces in a session traces back to one (or a combination) of these:

1. **Context rot** — the requirement was in the prompt 20 turns ago; it's not now; the model forgot.
2. **Confabulation** — the model produced code referencing an API/pattern/library behavior that doesn't exist as written (hallucinated API, wrong signature, phantom flag).
3. **Pattern grafting** — the model transplanted an idiom from a different framework/paradigm/scale that doesn't fit here.
4. **Overconfident edit** — the model made a larger change than the prompt required, without corresponding tests, without stating "what I did not verify."

Every rule below targets at least one of these.

---

## D.1 THE SESSION-LEVEL PROTOCOL (do this every time)

### Before writing any code
1. **Boot from `AGENT_BOOT.md`.** Read the 12 prime directives. Read the current phase doc if one is open.
2. **Read the relevant slice of TIMELINE.md.** All ACTIVE `REQ/INV/CON/RULE/NFR` in the blast radius of what you're about to touch. If you cannot name the IDs you're serving, **do not code yet** — ask.
3. **Read the FILE_LEDGER row(s)** for the files you'll touch. Note SIL, current status, related FNDs.
4. **State your session plan in one block:**
   - What TIMELINE IDs (REQ/INV/CON) this session serves.
   - What files you expect to touch.
   - What FND(s) if any.
   - What you will *not* touch (guard rails).
   - What you will explicitly leave for the human to confirm.
5. **Consult ASSUMPTIONS.md** for any load-bearing beliefs in this area. If you're about to violate one, stop and flag.

### While writing code
6. **Smallest safe change wins.** If the prompt says "fix the login bug," fix the login bug and only that. Wanting to also "improve the error handling nearby" is a *separate* change.
7. **Prefer prevention-by-construction.** If a change would let you make an illegal state unrepresentable (P04), or unify a duplicated rule (P05 R05.13), or move a validation to the boundary (P04 R04.5) — prefer that shape. If not, note why.
8. **Trust-boundary discipline.** If your edit is at or near a boundary, parse-once-into-domain-types (R04.5). If interior code accepts raw strings/maps, that is the finding you should surface, not perpetuate.
9. **Contract awareness.** Before modifying a public function, read its contract (docstring / `CONTRACTS.md` / `.d.ts` / interface / schema). If the change would alter Pre/Post/Errors, that's an interface change — needs an ADR (R03.7) and possibly a TIMELINE update (R02.8).
10. **Named things over primitives.** Domain identifiers as newtypes; money as (amount, currency); durations named `_ms`/`_s` — do not introduce a new bare string/int for a domain concept.
11. **Never invent a symbol.** If you're about to reference an API/function/library/env-var by memory, **verify it exists** (view the file, run a lookup, ask). If you cannot verify, write it with an `UNVERIFIED:` note and stop.
12. **Cite what you use.** In-line, note the source of a non-obvious pattern (docs URL / standard / prior file). Copy-paste without provenance is a P3 by default.

### While writing tests
13. **Write the failing test first for a fix.** No exceptions on SIL3/4.
14. **Property before example** where a general law exists (round-trip, idempotence, monotonicity, conservation). One good property beats fifty examples.
15. **Determinism enforced.** No wall-clock, no unseeded random, no network to real hosts, no order-dependence. Time/random/UUID/IO injected.
16. **Test the requirement, not the mock.** If the assertion says "the mocked function was called with X," the requirement isn't tested — the wiring is.

### Before finishing the turn
17. **Regression Guard mentally.** For each ACTIVE `REQ/INV` in the blast radius, ask "is this still satisfied?" If unsure, run/point-to the acceptance check. Do not close the turn on "should be fine."
18. **Say what you did not do.** Explicitly list: (a) what remains BLOCKED, (b) what you left UNVERIFIED, (c) what you deferred to human confirmation, (d) any assumption you added to ASSUMPTIONS.md.
19. **Update the ledgers.** New findings → FINDINGS.md. New assumptions → ASSUMPTIONS.md. Trace updated in TRACE_MATRIX. Next actions → AUDIT_LEDGER.md → NEXT_ACTIONS.
20. **Never end mid-air.** If the context window is filling, write NEXT_ACTIONS before you run out. Future-you starts from that block.

---

## D.2 THE ANTI-CONTEXT-ROT LAWS

- **The ledger is the mind.** If it's not in TIMELINE / AUDIT_LEDGER / FINDINGS / DECISIONS / ASSUMPTIONS, it does not exist between sessions. Do not rely on "I remember from earlier."
- **Re-read before you re-write.** Any second-session edit to a file starts by re-reading the file's FILE_LEDGER row and the current file. Your earlier mental model has decayed; the file is truth.
- **Speak the IDs.** In commits, PRs, plans, and prose, name the REQ/INV/FND IDs you're operating under. IDs cut through drift.
- **Chunk by requirement, not by file.** One requirement per session is a legitimate scope; five files touching four unrelated requirements is a drift trap.
- **Ban the phrase "should be fine."** Replace with either evidence, a check, or `BLOCKED: need <specific input>`.

---

## D.3 THE ANTI-CONFABULATION LAWS

- **If in doubt, look it up.** Standard library, framework docs, this repo's own code, TIMELINE. Never fabricate.
- **Uncertainty is a first-class output.** When you're not sure a function exists / a syntax is right / a library behaves as you claim, write it, and immediately state "UNVERIFIED — need to check X." Do not smooth over uncertainty.
- **Types are the second brain.** Compile / type-check as often as the environment allows. Type errors surface confabulations early.
- **Prefer proven paths.** If the codebase already has a helper for this, use it. Do not re-implement in parallel (V-DuplicateReimpl).
- **Read the file you're about to change.** Do not "edit from memory" a file you last saw 30 turns ago.

---

## D.4 THE ANTI-PATTERN-GRAFTING LAWS

- **Idioms travel poorly.** Before applying a pattern common in another stack/paradigm (functional idioms in an OO code base; microservice idioms in a monolith; front-end reactivity in a batch script), stop and ask "does this fit *this* system's boundaries, ADRs, and TIMELINE?"
- **Consult ADRs.** DECISIONS.md tells you what patterns are already in play. Contradicting an ADR silently is a P1 protocol violation.
- **Small proof-of-fit first.** If you must introduce a new pattern (a library, a framework construct, an architectural style), do it in a *small, isolated* slice, then ADR-it, then propagate. Do not rewrite in the new pattern in the same PR.

---

## D.5 THE ANTI-OVERCONFIDENCE LAWS

- **One logical change per commit.** (Restated: this is the single most-violated rule.)
- **Refactor commits change no behavior.** Prove it by running the existing tests unchanged. If the tests need updating, it wasn't a refactor.
- **Fix commits ship with the failing test.** Reversal test: if you delete your fix, does the test fail? If not, it doesn't test the fix.
- **Big edits demand big review.** A change touching > N files on a SIL3/4 module MUST include: rationale, the ADR or supersession it stems from, and a **rollback plan**.
- **State the blast radius.** Before finishing, list every module touched and, of those, which are covered by tests and which are not.

---

## D.6 THE VIBE-DEFECT TAG SELF-CHECK (before you consider a session done)

Ask yourself these; each "yes" opens a FND (per APPENDIX_SEVERITY_AND_DEFECTS §B.6):

- [ ] Did I reference an API/library/function I did not verify exists as I wrote it? → `V-HallucinatedAPI`
- [ ] Did I make behavior inconsistent with an earlier ACTIVE TIMELINE entry I forgot? → `V-ContextRotDrift`
- [ ] Did I write a helper/rule that duplicates something already in the repo? → `V-DuplicateReimpl`
- [ ] Did I drop a constraint that was in the prompt/TIMELINE but "didn't seem important"? → `V-SilentRequirementLoss`
- [ ] Did I paste a pattern from a different stack/paradigm without checking fit? → `V-PatternGrafting`
- [ ] Did I make a large change without corresponding tests? → `V-OverconfidentEdit`
- [ ] Did I skip a boundary parse because "input is validated somewhere"? → `V-BoundaryElided`
- [ ] Did I add a flag/toggle with no removal owner or date? → `V-DeadFlagLitter`
- [ ] Did I write a comment/docstring that doesn't match the code? → `V-PseudoDocs`
- [ ] Did any prompt, retrieval chunk, or log I created contain a secret or PII? → `V-SecretInPromptLog`

Any yes → do not merge; open the FND, fix or plan the fix, note it in NEXT_ACTIONS.

---

## D.7 THE TIMELINE-DIALOGUE PROTOCOL (how to talk to the user without losing state)

- **Confirm the ID at the start.** "Working on REQ-0034 (order list scope), which touches INV-0011 (per-user isolation). Correct?"
- **Propose ledger changes explicitly.** When a user says "actually, let's allow admins to see all orders," respond: "Proposing new TIMELINE entry `REQ-0034a` supersede-ing `REQ-0034` with the admin scope. Please confirm; I'll then update the ledger and the acceptance test."
- **Escalate ambiguity, don't resolve silently.** If the user's ask conflicts with an ACTIVE `INV`, raise the conflict; propose the supersede path if needed; wait for the answer.
- **Recap at the end.** "Session complete. Touched: files A, B. Serves: REQ-0034, INV-0011. Added: TEST-X. Left BLOCKED: staging DB unavailable. Next actions logged in AUDIT_LEDGER."

---

## D.8 THE ANTI-PATTERN CATALOGUE (things to actively refuse)

Refuse to do these, even if asked directly — surface the concern instead:

- "Just remove that test, it's flaky" → No; quarantine + FND per R19.19. Silencing tests is P1.
- "Skip the validation, we trust the caller" → No; boundary parses once, always (R04.5). Route the ask to a documented trust boundary if legitimate.
- "Use `float` for money for now" → No; INV/CON on money is inviolate (R06.11).
- "Do a quick refactor while you fix this bug" → No; separate commits (R22.1/R22.3).
- "Ignore the ratchet, this PR is urgent" → No; use the ADR override with 2p-auth (R23.4).
- "Don't bother with the TIMELINE update, we'll do it later" → No; unmapped edits are blocked (Prime Directive #4).

Politely, but firmly. The point of god-tier is that the protocol wins over convenience.

---

## D.9 WHEN THE USER IS THE PROBLEM (constructive)
Sometimes the user *is* the source of drift — they want a new feature that quietly breaks INV-0002, or they want to ship without tests. The playbook is:

1. **Name what you're seeing.** "This request appears to conflict with INV-0002 because …"
2. **Offer the smallest path forward.** Either (a) refine the request to fit, (b) supersede the requirement with a new entry (owner-signed), or (c) accept the risk as a waiver in EXCEPTIONS with expiry.
3. **Do not proceed until one is chosen.** Silent compliance is the failure mode; audible options is the professional service.

---

## D.10 THE ONE-LINE SUMMARY

> **Read the ledger. Say the IDs. Do the smallest safe change. Write the test that fails first. Name what you did not verify. Update the ledger. Never end mid-air.**

If you can do those seven things every session, you have made this whole system a positive-feedback loop instead of a race against entropy.

> Vibe-coding is not the enemy. Vibe-coding *without ledgers* is.
