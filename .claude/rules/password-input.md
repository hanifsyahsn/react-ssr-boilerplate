---
paths:
  - "src/pages/**"
  - "src/components/**"
  - "src/**/*.css"
---
# Show / hide password button (AD-24)

**Status:** implemented. `src/components/password-input/` (`index.tsx`, `styles.css`, `PasswordInput.test.tsx`), the CSS rule in `src/styles/global.css`, used by the demo login `src/pages/login/LoginPage.tsx` (its test checks re-masking after a failed login). Ported from server app M (Tailwind there, plain CSS here). Derived repos port from either.

Binding for every repo with password fields (sign in, register, reset, change password). Why: browsers differ (only Edge shows an eye, and it disappears on blur until the field is cleared). NIST SP 800-63B recommends offering to show the password, because typos cause failed sign-ins and push people to shorter passwords, more often on phones and under strict password rules. The field stays masked by default, so only the user can reveal it.

## Behaviour
1. Masked by default. One eye button inside the field: `type="button"` (never submits), a **fixed** `aria-label` "Show password" plus `aria-pressed` for the state; the tooltip (`title`) may say Show / Hide. Why fixed: WAI-ARIA APG (Button pattern) says a toggle's label must not change with its state; a switching name plus `aria-pressed` reads "Hide password, toggle button, pressed", which contradicts itself.
2. The toggle never moves the focus. When the field has focus, a click or tap keeps the focus and the caret (selection) in the field, so typing goes on. When it doesn't (another field, nothing, or keyboard focus on the button itself), the focus stays where it was. Why: pulling focus into the field on a tap opened the phone keyboard and scrolled the page.
   How: `onMouseDown={e => e.preventDefault()}` on the button; in the click handler save the caret only when `document.activeElement` is the input, `flushSync` the type change, then restore focus + caret. Don't tell mouse from keyboard by `event.detail`: screen readers in browse mode send clicks with detail = 1.
3. The field is masked again on every submit of the form, including one the page's own validation stops (no visible password after a failed sign-in). That includes a submit the **browser's** validation blocks (`required`, `type="email"`): it fires no `submit` event, so listening to `submit` alone isn't enough.
   How: capture-phase `submit` and `click` listeners on `document` that look up the field's form at event time (so a changed `form` attribute is followed); `submit` masks when its target is that form, `click` when the target is a submit button (`type` `submit` / `image`) whose `.form` is that form. That click comes before validation, Enter in a field clicks the default submit button, and it also catches a button outside the `<form>` (`form="id"`). Don't use `invalid`: it also fires on every `checkValidity()` / `reportValidity()`, so a page that validates live would mask the password while the user types.
4. Global CSS hides the browser's own reveal: `input::-ms-reveal, input[type="password"]::-ms-clear { display: none }`, so Edge shows only our eye.
5. One shared `PasswordInput` for every password field, never a per-page copy. It takes every input prop: `id` falls back to `useId()` (not `name`, which duplicates ids when two forms use `name="password"`), so give it an `id` and point the `<label htmlFor>` at that id, never at `name`. `ref` reaches the input (form libraries, focus after an error), and a React 19 callback ref's cleanup is kept. Setting the `disabled` prop masks it, because the eye is disabled with it. An ancestor `<fieldset disabled>` doesn't (no event to react to), so pages disable the fields themselves.
6. `autocomplete` stays `current-password` / `new-password`, so password managers keep working.

## Required behaviour tests (RTL + user-event)
- the password is hidden at first
- clicking Show reveals it, and clicking Hide hides it again
- the toggle doesn't submit the form
- focus stays in the field after the toggle
- clicking the eye while the field doesn't have focus leaves the focus where it was
- submitting the form masks the field again
- a submit the browser's validation blocks (an empty required field) masks it again too
- a validity check that isn't a submit (`checkValidity()`) leaves a revealed password revealed (wrap it in `act()`, or the test can't fail)
- the button's name stays the same and `aria-pressed` follows the state

## Real-browser check (required, jsdom can't prove it)
jsdom keeps the selection when the type changes and doesn't move focus on mousedown like a browser, so these tests pass even if the caret restore or the `preventDefault` breaks. Check in a real browser (headless Edge via `puppeteer-core` is enough):
- a click keeps focus + caret in a focused field, and typing continues at the caret
- at 390px with touch, a tap on the eye while another field (or nothing) has focus doesn't pull the focus in
- revealed + email empty: clicking the submit button and pressing Enter in the field both mask it (submit blocked), `form.checkValidity()` alone doesn't
- only one eye in Edge. `getComputedStyle(el, "::-ms-reveal")` returns "" in Edge, so it proves nothing. Instead, check that the `::-ms-reveal` rule is in `document.styleSheets`, and compare a screenshot of a plain typed password field (Edge's eye shows) with ours (only our eye).
