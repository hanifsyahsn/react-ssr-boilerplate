import { useCallback, useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { flushSync } from "react-dom";
import "./styles.css";

type PasswordInputProps = Omit<ComponentProps<"input">, "type">;

// Input types where Enter submits the form implicitly (HTML spec: the fields that block implicit submission)
const IMPLICIT_SUBMIT_TYPES = new Set([
    "text",
    "search",
    "url",
    "tel",
    "email",
    "password",
    "date",
    "month",
    "week",
    "time",
    "datetime-local",
    "number",
]);

const blocksImplicitSubmit = (el: Element): el is HTMLInputElement =>
    el instanceof HTMLInputElement && IMPLICIT_SUBMIT_TYPES.has(el.type);

const isSubmitButton = (el: Element | null | undefined): el is HTMLButtonElement | HTMLInputElement =>
    (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) && (el.type === "submit" || el.type === "image");

/**
 * A password field with its own show / hide button (AD-24, `.claude/rules/password-input.md`), the same in every
 * browser; Edge's built-in reveal eye is hidden in `global.css`. Masked by default. The button is a toggle: its name
 * stays "Show password" and `aria-pressed` carries the state (WAI-ARIA: a toggle's label doesn't change with its
 * state); the tooltip says what a click does. The toggle never moves the focus: with the field focused, a click keeps
 * the focus and caret there; otherwise the focus stays where it was. Every submit the user starts (a submit button, Enter in a field) or that goes
 * through masks it again, and so does disabling the field (its eye is disabled too, so it couldn't be hidden otherwise).
 * Limit: page code calling `form.requestSubmit()` on a form the browser's validation blocks fires no event, so the
 * field stays as it is; call `submitButton.click()` instead (same validation, and it masks).
 *
 * `id` falls back to a `useId()` (SSR-safe, unique), so the label and the eye's `aria-controls` always point at this
 * field. `ref` reaches the underlying input (form libraries, focus after an error).
 */
export function PasswordInput({ className, id, name, disabled, ref, ...rest }: PasswordInputProps) {
    const [visible, setVisible] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const autoId = useId();
    const inputId = id ?? autoId;

    // Disabling masks it: the disabled eye can't be pressed, so a revealed password would otherwise stay readable
    if (disabled && visible) setVisible(false);

    // The caller's ref and ours both get the input. Keyed on [ref] like a plain <input>: our own renders (the toggle,
    // its flushSync) keep the same ref, so it stays attached; a parent that re-renders with an inline arrow re-attaches
    // it (cleanup, then attach), exactly as React does for <input ref={(el) => ...}>, which form libraries expect.
    // Pinning the first ref instead would silently ignore a page that swaps to a different ref. Returning a cleanup (React 19) means React never calls this with
    // null; the cleanup runs the caller's own cleanup if its callback ref returned one, else calls it with null.
    const setInput = useCallback(
        (node: HTMLInputElement) => {
            inputRef.current = node;
            if (typeof ref === "function") {
                const cleanup = ref(node);
                return () => {
                    inputRef.current = null;
                    if (typeof cleanup === "function") cleanup();
                    else ref(null);
                };
            }
            if (ref) ref.current = node;
            return () => {
                inputRef.current = null;
                if (ref) ref.current = null;
            };
        },
        [ref]
    );

    // Mask again on every submit, including one the page's own validation stops. A submit blocked by the browser's own
    // validation (`required`, `type="email"`...) fires no `submit`, so the click on one of this form's submit buttons
    // masks it too: that click comes before validation, Enter in a field clicks the default submit button, and the
    // button may sit outside the <form> through `form="id"`. Not `invalid`: it also fires on every checkValidity()
    // call, which would mask the password while the user is still typing on a page that validates live.
    // Enter in a text field also masks it when it does an implicit submit no click announces (the browser's validation
    // can block it): only in a form with no submit button and exactly one field that blocks implicit submission (HTML
    // spec). With a submit button, Enter clicks the default one (masked by the click) or, if it's disabled, submits
    // nothing; with two or more such fields and no button, Enter submits nothing either. Bubble phase, after the page's
    // own handlers, so an Enter the page takes over (preventDefault, e.g. to move to the next field) doesn't count, and
    // neither does an IME commit (`isComposing`, or `keyCode` 229: Safari sends it after `compositionend`).
    // Limit: a handler that stops the Enter's propagation hides it from us. Checking `defaultPrevented` from a capture
    // listener after dispatch would need a timer: a queued microtask runs right after that listener, before the page's.
    // Both listen on the document and look up the field's form at event time, so a changed `form` attribute or a move
    // into another form is followed without re-binding.
    useEffect(() => {
        const ownForm = () => inputRef.current?.form ?? null;
        const hideOnSubmit = (event: Event) => {
            if (event.target === ownForm()) setVisible(false);
        };
        const hideOnSubmitClick = (event: MouseEvent) => {
            const control = (event.target as Element | null)?.closest?.("button, input");
            if (isSubmitButton(control) && control.form !== null && control.form === ownForm()) setVisible(false);
        };
        const hideOnEnter = (event: KeyboardEvent) => {
            if (event.key !== "Enter" || event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
            const field = event.target;
            const form = ownForm();
            if (!(field instanceof Element) || !blocksImplicitSubmit(field) || form === null || field.form !== form) {
                return;
            }
            const controls = Array.from(form.elements);
            if (controls.some(isSubmitButton)) return;
            if (controls.filter(blocksImplicitSubmit).length === 1) setVisible(false);
        };
        document.addEventListener("submit", hideOnSubmit, true);
        document.addEventListener("click", hideOnSubmitClick, true);
        document.addEventListener("keydown", hideOnEnter);
        return () => {
            document.removeEventListener("submit", hideOnSubmit, true);
            document.removeEventListener("click", hideOnSubmitClick, true);
            document.removeEventListener("keydown", hideOnEnter);
        };
    }, []);

    const toggle = () => {
        const input = inputRef.current as HTMLInputElement;
        // Only a field that has the focus gets it back with its caret: tapping the eye of an unfocused field must not
        // pull the focus in (on a phone that opens the keyboard and scrolls). Don't use event.detail to tell mouse from
        // keyboard: screen readers in browse mode send clicks with detail = 1.
        const caret = document.activeElement === input ? { start: input.selectionStart, end: input.selectionEnd } : null;
        // Render the new type now, so the caret can be put back right after (switching the type can drop it)
        flushSync(() => setVisible((v) => !v));
        if (caret) {
            input.focus();
            input.setSelectionRange(caret.start, caret.end);
        }
    };

    return (
        <div className="password-input">
            <input
                ref={setInput}
                type={visible ? "text" : "password"}
                id={inputId}
                name={name}
                disabled={disabled}
                className={className ? `password-input-field ${className}` : "password-input-field"}
                {...rest}
            />
            <button
                type="button"
                className="password-input-toggle"
                aria-label="Show password"
                aria-pressed={visible}
                aria-controls={inputId}
                title={visible ? "Hide password" : "Show password"}
                disabled={disabled}
                // A mouse or tap press doesn't take the focus from the field
                onMouseDown={(event) => event.preventDefault()}
                onClick={toggle}
            >
                {visible ? (
                    // Eye with a slash: the password shows, a click hides it
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                            d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                        />
                    </svg>
                ) : (
                    // Open eye: the password is hidden, a click shows it
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                            d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                        />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                )}
            </button>
        </div>
    );
}
