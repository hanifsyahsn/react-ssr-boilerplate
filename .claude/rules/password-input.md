---
paths:
  - "src/pages/**"
  - "src/components/**"
  - "src/**/*.css"
---
# Show / hide password button (AD-24)

**Status:** not implemented in the boilerplate yet. The reference is in server app M (see `architecture-decisions.md`); port it to the demo login (`src/pages/login/LoginPage.tsx`) once it lands there, don't design a separate version.

Binding for every repo with password fields (sign in, register, reset, change password). Why: browsers differ (only Edge shows an eye, and it disappears on blur until the field is cleared). NIST SP 800-63B recommends offering to show the password, because typos cause failed sign-ins and push people to shorter passwords, more often on phones and under strict password rules. The field stays masked by default, so only the user can reveal it.

## Behaviour
1. Masked by default. One eye button inside the field: `type="button"` (never submits), a **fixed** `aria-label` "Show password" plus `aria-pressed` for the state; the tooltip (`title`) may say Show / Hide. Why fixed: WAI-ARIA APG (Button pattern) says a toggle's label must not change with its state; a switching name plus `aria-pressed` reads "Hide password, toggle button, pressed", which contradicts itself.
2. The toggle never moves the focus. When the field has focus, a click or tap keeps the focus and the caret (selection) in the field, so typing goes on. When it doesn't (another field, nothing, or keyboard focus on the button itself), the focus stays where it was. Why: pulling focus into the field on a tap opened the phone keyboard and scrolled the page.
   How: `onMouseDown={e => e.preventDefault()}` on the button, and save / restore the caret only when `document.activeElement` is the input. Don't tell mouse from keyboard by `event.detail`: screen readers in browse mode send clicks with detail = 1.
3. The field is masked again on every submit of the form, including one the page's own validation stops (no visible password after a failed sign-in).
4. Global CSS hides the browser's own reveal, scoped to password inputs: `input::-ms-reveal { display: none }` and `::-ms-clear`, so Edge shows only our eye.
5. One shared `PasswordInput` for every password field, never a per-page copy.
6. `autocomplete` stays `current-password` / `new-password`, so password managers keep working.

## Required behaviour tests (RTL + user-event)
- the password is hidden at first
- clicking Show reveals it, and clicking Hide hides it again
- the toggle doesn't submit the form
- focus stays in the field after the toggle
- clicking the eye while the field doesn't have focus leaves the focus where it was
- submitting the form masks the field again
- the button's name stays the same and `aria-pressed` follows the state

Plus a real-browser check in Edge: only one eye shows.
