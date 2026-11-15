---
paths:
  - "src/pages/**"
  - "src/components/**"
  - "src/**/*.css"
---
# Show / hide password button (AD-24)

**Status:** not implemented in the boilerplate yet. The reference is being built in server app M (see `architecture-decisions.md`); port it to the demo login (`src/pages/login/LoginPage.tsx`) once it lands there, don't design a separate version.

Binding for every repo with password fields (sign in, register, reset, change password). Why: browsers differ (only Edge shows an eye, and it disappears on blur until the field is cleared). NIST SP 800-63B recommends offering to show the password, because typos cause failed sign-ins and push people to shorter passwords, more often on phones and under strict password rules. The field stays masked by default, so only the user can reveal it.

## Behaviour
1. Masked by default. One eye button inside the field: `type="button"` (never submits), `aria-label` "Show password" / "Hide password" plus `aria-pressed`.
2. Clicking it keeps the focus and the caret position in the field.
3. The field is masked again when the form is submitted (no visible password after a failed sign-in).
4. Global CSS hides the browser's own reveal: `input::-ms-reveal { display: none }` and `::-ms-clear` on password inputs, so Edge shows only our eye.
5. One shared `PasswordInput` for every password field, never a per-page copy.
6. `autocomplete` stays `current-password` / `new-password`, so password managers keep working.

## Required behaviour tests (RTL + user-event)
- the password is hidden at first
- clicking Show reveals it, and clicking Hide hides it again
- the toggle doesn't submit the form
- focus stays in the field after the toggle
- submitting the form masks the field again
- the button's accessible name and `aria-pressed` follow the state

Plus a real-browser check in Edge: only one eye shows.
