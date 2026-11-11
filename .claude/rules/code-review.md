---
paths:
  - ".claude/rules/**"
  - "CLAUDE.md"
  - ".agent/**"
  - "docs/review/**"
---
# Read-only code review and the "safe for production" gate (AD-23)

Binding for every repo (see `architecture-decisions.md`, AD-23). Reference implementations: server app M (FE) and backend M (Go), both `.agent/rules/code-review.md` + `docs/review/` (labels in the local `derived-repos.md`).

## Flow

- **Reviewer, in this order:**
  1. Antigravity (agy) with **Opus 5.5**; when agy's Opus quota is out, agy with **Gemini 4 Argon high**. Preferred: an external reviewer keeps the review fully separate from the context that fixes the code.
  2. **No agy quota at all:** Claude Code's **`/code-review`**, run by the owner in a **fresh session** (not the one that wrote or fixes the code), at `high` for risky areas and `medium` otherwise (never `max`/`ultra` unless the owner asks), never with `--fix` (review only). Same rules: only a/b/c count (other findings become Backlog lines), each needs a scenario + exact code line, and the round is recorded in `REVIEW.md` with `Reviewer: Claude Code /code-review <level>`, then verified, fixed and moved to `history/` the same way. The `.agent/` permission tips below don't apply to it.
- **The reviewer only reviews.** The only file it may write is `docs/review/REVIEW.md`. **Claude Code** verifies every finding against the code, fills `Claude verdict`, fixes, then moves the round to `docs/review/history/`.
- **One round per scope.** Round 2 only if round 1 had a/b/c findings, and it checks only those fixes. If `REVIEW.md` is not empty when a round starts, the previous one isn't processed: stop.
- **Model per round**, written at the top of `PROMPT.md`: **high** for risky areas (auth/session, the domain's main actions, permission logic, migrations); **medium** for small changes and round 2.
- **Verify the reviewer.** Its accuracy is not a given: in a derived backend, Argon cited 5 rule files that don't exist and made one wrong finding, while a real bug slipped through and surfaced only when Claude verified. Claude checks every quote, path and claim, and still looks at the scope itself.

## Files (all gitignored, local only)

| File | What |
|---|---|
| `.agent/rules/code-review.md` | reviewer rules (template below) |
| `docs/review/PROMPT.md` | one round's task: scope, model, backend contract version/commit |
| `docs/review/REVIEW.md` | inbox for the reviewer's output |
| `docs/review/review-backlog.md` | findings declined or parked, so they aren't reported again |
| `docs/review/history/` | processed rounds |
| `docs/review/be-API.md` | copy of the backend's `docs/API.md` (repos whose contract lives in another folder) |

## Only three categories

Each finding needs a concrete scenario and the **exact quoted code line(s)**; a quote that doesn't match the file is declined unread.

- **a. Bug in normal use.** FE: wrong screen, an action offered that the backend refuses (or hidden from someone allowed), stale state, crash, hydration mismatch, layout broken by long text, not working at phone width.
- **b. Security hole:** XSS, open redirect, cookie/token flaws, secrets in the bundle, the `/api` proxy forwarding what it shouldn't.
- **c. Contract break:** code differs from the backend contract (the backend's `docs/API.md`). **c also binds Claude's own fixes:** an a/b fix must not silently change or assume the contract. If the contract really must change, ask first, and change it in the backend first.
  - Static sites: c means the contract with their data source (CMS/API) if there is one, else n/a.
- Everything else (refactor, naming, style, small performance, comments) is one line in the Backlog and doesn't block a release.

## "Safe for production" for one change

1. The review (agy, or `/code-review` when agy has no quota) leaves **no open a/b/c finding**: each is fixed and checked in round 2, or declined with a clear reason and rule.
2. `lint`, `typecheck`, tests and build pass, and every agreed behaviour has a test that asserts the outcome (AD-03).
3. The changed flow was checked in a **real browser** (every repo). Server apps: against the dev backend. Headless Chrome via `puppeteer-core` is enough.

## Reviewer rules template (`.agent/rules/code-review.md`, for agy)

Copy server app M's file and adapt; it must contain at least:

- **Hard limits:** write only `docs/review/REVIEW.md`. No writing commands (git add/commit/checkout/reset/stash, `npm install`, build/dev). Read-only ones are fine (`git status`, `git diff`, `git log`, `npm test`, `npm run typecheck`). Never open, read or quote `.env`, `*.env`, `*.pem`, `*.key`.
- **Commands one at a time, short, never chained with `;` or `&&`.** agy's "always allow" matches the command prefix, so chained or long commands ask for permission every time. A saved grant holds the whole command, so use agy's own read/search tools for files, not `Get-Content`/`Select-String`.
- **Backend contract in another folder:** before every round Claude copies the backend's `API.md` to `docs/review/be-API.md` and writes the backend version + commit in `PROMPT.md`. The reviewer reads the copy. Files outside the workspace always prompt, and **never pick "always allow non-workspace access"**: it also opens the backend's `.env`.
- **Read first:** `CLAUDE.md`, the rule files for the scope (list the files that exist, by exact name, "no others"), `review-backlog.md`, the contract. Gitignored files are opened by exact path. Don't read `docs/review/history/`.
- **Do not flag:** decisions in `CLAUDE.md`/rules, **the repo's open items in `boilerplate-alignment.md`**, gitignored local files, generated files.
- **Tests:** an agreed behaviour without an outcome-asserting test is a backlog line (category a if it hides a real bug); no missing-test reports outside the scope.
- **Output shape** in `REVIEW.md`: header with `Reviewer:` (tool / model / effort actually used), `Read:` (files actually opened), `Ran:` (commands + result); findings `R1..` with Category, File:line, verbatim Code, Scenario, Why, Suggested fix, empty `Claude verdict`; `Backlog` lines `B1..`; Summary counts.
