# Store knowledge as scoped rules (save context / usage)

Everything in `CLAUDE.md` and in rules without `paths` is loaded into **every** session, whether it is needed or not. To keep usage low:

- `CLAUDE.md` holds only what every task needs: a 2-3 line overview, commands, env vars, the "Always" rules, and the rules index. Keep it under ~60 lines.
- Any other knowledge (architecture of an area, conventions, gotchas, plans, reminders) goes into its own file in `.claude/rules/<topic>.md`, **one topic per file**, with `paths:` frontmatter so it loads only when matching files are read or edited:

  ```markdown
  ---
  paths:
    - "src/server/**"
  ---
  # Topic title
  ...
  ```

- Omit `paths` only when the rule truly applies to every task (like this file).
- When you learn or add something worth remembering, put it in the matching rule file (or create a new one) and add a line to the rules index in `CLAUDE.md`. Do not grow `CLAUDE.md`.
- Write rules tightly: facts, decisions and their reasons. No restating what the code already says plainly; point to the file instead.
- When code changes make a rule wrong, fix or delete the rule in the same change. Stale rules cost context and mislead.
