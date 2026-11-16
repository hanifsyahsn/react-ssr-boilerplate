import { createRef, useState, type RefObject } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PasswordInput } from "./index";

// A password field in a form, the way the login page uses it
function Form({ onSubmit = () => {}, disabled = false }: { onSubmit?: () => void; disabled?: boolean }) {
    const [value, setValue] = useState("");
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
            }}
        >
            <label htmlFor="password">Password</label>
            <PasswordInput
                id="password"
                autoComplete="current-password"
                maxLength={72}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={disabled}
            />
            <button type="submit">Log in</button>
        </form>
    );
}

// A field linked to one of two forms by its form attribute, which a test changes
function TwoFormsPage({ formId }: { formId: string }) {
    return (
        <>
            <form id="first" onSubmit={(event) => event.preventDefault()}>
                <button type="submit">Submit first</button>
            </form>
            <form id="second" onSubmit={(event) => event.preventDefault()}>
                <button type="submit">Submit second</button>
            </form>
            <label htmlFor="password">Password</label>
            <PasswordInput id="password" form={formId} />
        </>
    );
}

// A field in a form whose ref a test swaps
function RefForm({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
    return (
        <form onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="password">Password</label>
            <PasswordInput id="password" ref={inputRef} />
            <button type="submit">Log in</button>
        </form>
    );
}

// A field a test disables and enables again
function DisablePage({ disabled }: { disabled: boolean }) {
    return (
        <>
            <label htmlFor="password">Password</label>
            <PasswordInput id="password" disabled={disabled} />
        </>
    );
}

const field = () => screen.getByLabelText("Password") as HTMLInputElement;
const toggle = () => screen.getByRole("button", { name: "Show password" });

// AD-24, `.claude/rules/password-input.md`. jsdom can't prove the caret restore or the mousedown preventDefault the
// way a browser does: those need the real-browser check listed in the rule.
// A controlled PasswordInput and a controlled plain <input>, both with inline callback refs, re-rendered on each key
function InlineRefPage({ ours, plain }: { ours: (node: HTMLInputElement | null) => void; plain: (node: HTMLInputElement | null) => void }) {
    const [password, setPassword] = useState("");
    const [text, setText] = useState("");
    return (
        <>
            <label htmlFor="password">Password</label>
            <PasswordInput id="password" value={password} onChange={(event) => setPassword(event.target.value)} ref={(node) => ours(node)} />
            <label htmlFor="plain">Plain</label>
            <input id="plain" value={text} onChange={(event) => setText(event.target.value)} ref={(node) => plain(node)} />
        </>
    );
}

describe("password field show / hide (AD-24)", () => {
    it("hides the password at first", () => {
        render(<Form />);
        expect(field()).toHaveAttribute("type", "password");
        expect(toggle()).toHaveAttribute("aria-pressed", "false");
        expect(toggle()).toHaveAttribute("title", "Show password");
    });

    it("clicking Show reveals the password, and clicking again hides it", async () => {
        const user = userEvent.setup();
        render(<Form />);
        await user.type(field(), "correct horse");

        await user.click(toggle());
        expect(field()).toHaveAttribute("type", "text");
        expect(field()).toHaveValue("correct horse");
        expect(toggle()).toHaveAttribute("aria-pressed", "true");
        expect(toggle()).toHaveAttribute("title", "Hide password");

        await user.click(toggle());
        expect(field()).toHaveAttribute("type", "password");
        expect(toggle()).toHaveAttribute("aria-pressed", "false");
        expect(toggle()).toHaveAttribute("title", "Show password");
    });

    it("the button's name stays the same and aria-pressed follows the state", async () => {
        const user = userEvent.setup();
        render(<Form />);
        await user.click(toggle());
        expect(screen.getByRole("button", { name: "Show password", pressed: true })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Hide password" })).not.toBeInTheDocument();
    });

    it("the toggle doesn't submit the form", async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(<Form onSubmit={onSubmit} />);
        await user.click(toggle());
        await user.click(toggle());
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("focus and caret stay in the field after the toggle, so typing goes on", async () => {
        const user = userEvent.setup();
        render(<Form />);
        await user.type(field(), "abcdef");
        field().setSelectionRange(2, 4);

        await user.click(toggle());
        expect(field()).toHaveFocus();
        expect(field().selectionStart).toBe(2);
        expect(field().selectionEnd).toBe(4);

        await user.keyboard("X");
        expect(field()).toHaveValue("abXef");
    });

    it("clicking the eye while the field doesn't have focus leaves the focus where it was", async () => {
        const user = userEvent.setup();
        render(
            <>
                <Form />
                <label htmlFor="other">Other</label>
                <input id="other" />
            </>
        );
        await user.type(field(), "secret pass");
        await user.click(screen.getByLabelText("Other"));

        await user.click(toggle());
        expect(field()).toHaveAttribute("type", "text");
        expect(screen.getByLabelText("Other")).toHaveFocus();

        (document.activeElement as HTMLElement).blur();
        await user.click(toggle());
        expect(field()).toHaveAttribute("type", "password");
        expect(field()).not.toHaveFocus();
    });

    it("from the keyboard, Enter or Space on the eye toggles it and the focus stays on the eye", async () => {
        const user = userEvent.setup();
        render(<Form />);
        await user.type(field(), "secret pass");
        await user.tab();
        expect(toggle()).toHaveFocus();

        await user.keyboard("{Enter}");
        expect(field()).toHaveAttribute("type", "text");
        expect(toggle()).toHaveFocus();

        await user.keyboard(" ");
        expect(field()).toHaveAttribute("type", "password");
        expect(toggle()).toHaveFocus();
    });

    it("submitting the form masks the field again", async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(<Form onSubmit={onSubmit} />);
        await user.type(field(), "secret pass");
        await user.click(toggle());

        await user.click(screen.getByRole("button", { name: "Log in" }));
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(field()).toHaveAttribute("type", "password");
        expect(toggle()).toHaveAttribute("aria-pressed", "false");
    });

    it("a submit the browser's own validation blocks (an empty required field) masks it again too", async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    onSubmit();
                }}
            >
                <label htmlFor="email">Email</label>
                <input id="email" required />
                <label htmlFor="password">Password</label>
                <PasswordInput id="password" />
                <button type="submit">Log in</button>
            </form>
        );
        await user.type(field(), "secret pass");
        await user.click(toggle());
        expect(field()).toHaveAttribute("type", "text");

        await user.click(screen.getByRole("button", { name: "Log in" }));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(field()).toHaveAttribute("type", "password");
        expect(toggle()).toHaveAttribute("aria-pressed", "false");
    });

    it("a validity check that isn't a submit (checkValidity on an empty required field) leaves a revealed password revealed", async () => {
        const user = userEvent.setup();
        render(
            <form>
                <label htmlFor="email">Email</label>
                <input id="email" required />
                <label htmlFor="password">Password</label>
                <PasswordInput id="password" />
                <button type="submit">Log in</button>
            </form>
        );
        await user.type(field(), "secret pass");
        await user.click(toggle());

        // act() flushes any state update the checks cause, so a wrong mask would show before the assertion
        act(() => {
            expect(field().form?.checkValidity()).toBe(false);
            (screen.getByLabelText("Email") as HTMLInputElement).reportValidity();
        });
        expect(field()).toHaveAttribute("type", "text");
    });

    it("a submit button outside the <form> (form attribute) masks it when clicked, and other buttons don't", async () => {
        const user = userEvent.setup();
        render(
            <>
                <form id="login" onSubmit={(event) => event.preventDefault()}>
                    <label htmlFor="password">Password</label>
                    <PasswordInput id="password" />
                </form>
                <button type="button">Help</button>
                <form id="other" onSubmit={(event) => event.preventDefault()}>
                    <button type="submit">Search</button>
                </form>
                <button type="submit" form="login">
                    Log in
                </button>
            </>
        );
        await user.type(field(), "secret pass");
        await user.click(toggle());

        await user.click(screen.getByRole("button", { name: "Help" }));
        await user.click(screen.getByRole("button", { name: "Search" }));
        expect(field()).toHaveAttribute("type", "text");

        await user.click(screen.getByRole("button", { name: "Log in" }));
        expect(field()).toHaveAttribute("type", "password");
    });

    it("submitting with Enter in the field masks it again too", async () => {
        const user = userEvent.setup();
        render(<Form />);
        await user.type(field(), "secret pass");
        await user.click(toggle());
        await user.type(field(), "{Enter}");
        expect(field()).toHaveAttribute("type", "password");
    });

    // user-event's Enter submits a form without a submit button directly, skipping validation, so these press the key
    // with fireEvent: a blocked implicit submit is a keydown and nothing else.
    it("Enter in the only field of a form with no submit button masks it, even when the browser's validation blocks that submit", async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(
            <form onSubmit={onSubmit}>
                <label htmlFor="password">Password</label>
                <PasswordInput id="password" required />
            </form>
        );
        await user.click(toggle());
        fireEvent.keyDown(field(), { key: "Enter" });
        expect(field()).toHaveAttribute("type", "password");
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("an Enter the page takes over, an IME commit (Chrome or Safari), a non-text control or another form's field leaves it revealed", async () => {
        const user = userEvent.setup();
        render(
            <>
                <form onSubmit={(event) => event.preventDefault()}>
                    <label htmlFor="remember">Remember me</label>
                    <input id="remember" type="checkbox" />
                    <label htmlFor="password">Password</label>
                    <PasswordInput id="password" onKeyDown={(event) => event.key === "Enter" && event.shiftKey && event.preventDefault()} />
                </form>
                <form>
                    <label htmlFor="search">Search</label>
                    <input id="search" type="search" />
                </form>
            </>
        );
        await user.click(toggle());
        fireEvent.keyDown(field(), { key: "Enter", shiftKey: true });
        fireEvent.keyDown(field(), { key: "Enter", isComposing: true });
        fireEvent.keyDown(field(), { key: "Enter", keyCode: 229 });
        fireEvent.keyDown(screen.getByLabelText("Remember me"), { key: "Enter" });
        fireEvent.keyDown(screen.getByLabelText("Search"), { key: "Enter" });
        fireEvent.keyDown(field(), { key: "a" });
        expect(field()).toHaveAttribute("type", "text");

        // The same field and form: a plain Enter does mask it, so the cases above stayed revealed for their own reason
        fireEvent.keyDown(field(), { key: "Enter" });
        expect(field()).toHaveAttribute("type", "password");
    });

    it("an Enter that submits nothing leaves it revealed: a disabled submit button (a request running), or two text fields and no button", async () => {
        const user = userEvent.setup();
        const { unmount } = render(
            <form onSubmit={(event) => event.preventDefault()}>
                <label htmlFor="password">Password</label>
                <PasswordInput id="password" />
                <button type="submit" disabled>
                    Logging in...
                </button>
            </form>
        );
        await user.click(toggle());
        fireEvent.keyDown(field(), { key: "Enter" });
        expect(field()).toHaveAttribute("type", "text");
        unmount();

        render(
            <form onSubmit={(event) => event.preventDefault()}>
                <label htmlFor="email">Email</label>
                <input id="email" type="email" />
                <label htmlFor="password">Password</label>
                <PasswordInput id="password" />
            </form>
        );
        await user.click(toggle());
        fireEvent.keyDown(screen.getByLabelText("Email"), { key: "Enter" });
        fireEvent.keyDown(field(), { key: "Enter" });
        expect(field()).toHaveAttribute("type", "text");
    });

    it("limit: with a disabled image button as the only submit button, Enter masks it although nothing is submitted", async () => {
        const user = userEvent.setup();
        render(
            <form onSubmit={(event) => event.preventDefault()}>
                <label htmlFor="password">Password</label>
                <PasswordInput id="password" />
                <input type="image" alt="Log in" src="data:," disabled />
            </form>
        );
        await user.click(toggle());
        fireEvent.keyDown(field(), { key: "Enter" });
        expect(field()).toHaveAttribute("type", "password");
    });

    it("limit: an Enter with keyCode 229 (an Android keyboard mid-word) is skipped, so a blocked implicit submit leaves it revealed", async () => {
        const user = userEvent.setup();
        render(
            <form onSubmit={(event) => event.preventDefault()}>
                <label htmlFor="password">Password</label>
                <PasswordInput id="password" required />
            </form>
        );
        await user.click(toggle());
        fireEvent.keyDown(field(), { key: "Enter", keyCode: 229 });
        expect(field()).toHaveAttribute("type", "text");
    });

    it("limit: page code calling requestSubmit() on a form the browser's validation blocks leaves it revealed; clicking the submit button from code masks it", async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(
            <form onSubmit={onSubmit}>
                <label htmlFor="email">Email</label>
                <input id="email" type="email" required />
                <label htmlFor="password">Password</label>
                <PasswordInput id="password" />
                <button type="submit">Log in</button>
            </form>
        );
        const form = field().form as HTMLFormElement;
        await user.click(toggle());

        act(() => form.requestSubmit());
        expect(onSubmit).not.toHaveBeenCalled();
        expect(field()).toHaveAttribute("type", "text");

        act(() => screen.getByRole("button", { name: "Log in" }).click());
        expect(onSubmit).not.toHaveBeenCalled();
        expect(field()).toHaveAttribute("type", "password");
    });

    it("keeps what the page sets on the field: id for its label, autocomplete for password managers, max length", () => {
        render(<Form />);
        expect(field()).toHaveAttribute("id", "password");
        expect(field()).toHaveAttribute("autocomplete", "current-password");
        expect(field()).toHaveAttribute("maxlength", "72");
        expect(toggle()).toHaveAttribute("aria-controls", "password");
    });

    it("fields without an id each get a unique one, so two with the same name don't share an id and each eye points at its own field", () => {
        const { container } = render(
            <>
                <PasswordInput name="password" className="wide" />
                <PasswordInput name="password" />
            </>
        );
        const inputs = Array.from(container.querySelectorAll("input"));
        const eyes = screen.getAllByRole("button", { name: "Show password" });
        expect(inputs[0].id).not.toBe("");
        expect(inputs[0].id).not.toBe(inputs[1].id);
        expect(inputs[0]).toHaveAttribute("name", "password");
        expect(inputs[0]).toHaveClass("password-input-field", "wide");
        expect(eyes[0]).toHaveAttribute("aria-controls", inputs[0].id);
        expect(eyes[1]).toHaveAttribute("aria-controls", inputs[1].id);
    });

    it("the page's ref reaches the input, as an object ref or a callback ref", () => {
        const objectRef = createRef<HTMLInputElement>();
        const callbackRef = vi.fn();
        const { unmount } = render(
            <>
                <PasswordInput id="a" ref={objectRef} />
                <PasswordInput id="b" ref={callbackRef} />
            </>
        );
        expect(objectRef.current).toBe(document.getElementById("a"));
        expect(callbackRef).toHaveBeenLastCalledWith(document.getElementById("b"));

        unmount();
        expect(objectRef.current).toBeNull();
        expect(callbackRef).toHaveBeenLastCalledWith(null);
    });

    it("a callback ref that returns a cleanup (React 19) gets its cleanup on unmount and is never called with null", () => {
        const calls: (HTMLInputElement | null)[] = [];
        const cleanup = vi.fn();
        const ref = (node: HTMLInputElement | null) => {
            calls.push(node);
            return cleanup;
        };
        const { unmount } = render(<PasswordInput id="c" ref={ref} />);
        expect(calls).toEqual([document.getElementById("c")]);

        unmount();
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(calls).not.toContain(null);
    });

    it("an inline callback ref stays attached while the field types and toggles: called once with the input, never with null", async () => {
        const user = userEvent.setup();
        const register = vi.fn();
        const { unmount } = render(
            <>
                <label htmlFor="password">Password</label>
                <PasswordInput id="password" ref={(node) => register(node)} />
            </>
        );
        await user.type(field(), "abc");
        await user.click(toggle());
        await user.click(toggle());
        expect(register.mock.calls).toEqual([[field()]]);

        unmount();
        expect(register).toHaveBeenLastCalledWith(null);
        expect(register).toHaveBeenCalledTimes(2);
    });

    it("a parent that re-renders with a new inline callback ref re-attaches it, the same as a plain <input> does", async () => {
        const user = userEvent.setup();
        const ours = vi.fn();
        const plain = vi.fn();
        render(<InlineRefPage ours={ours} plain={plain} />);
        await user.type(field(), "ab");
        await user.type(screen.getByLabelText("Plain"), "ab");
        const shape = (spy: typeof ours) => spy.mock.calls.map(([node]) => (node === null ? "detach" : "attach"));
        expect(shape(ours)).toEqual(shape(plain));
        expect(field()).toHaveValue("ab");
    });

    it("when the page passes a different ref, the old one is cleared, the new one gets the input, and the field still works", async () => {
        const user = userEvent.setup();
        const first = createRef<HTMLInputElement>();
        const second = createRef<HTMLInputElement>();
        const { rerender } = render(<RefForm inputRef={first} />);
        rerender(<RefForm inputRef={second} />);

        expect(first.current).toBeNull();
        expect(second.current).toBe(field());

        await user.type(field(), "abcdef");
        field().setSelectionRange(2, 4);
        await user.click(toggle());
        expect(field()).toHaveFocus();
        await user.click(screen.getByRole("button", { name: "Log in" }));
        expect(field()).toHaveAttribute("type", "password");
    });

    it("follows a changed form attribute: the new form's submit masks it, the old form's doesn't", async () => {
        const user = userEvent.setup();
        const { rerender } = render(<TwoFormsPage formId="first" />);
        rerender(<TwoFormsPage formId="second" />);
        await user.click(toggle());

        await user.click(screen.getByRole("button", { name: "Submit first" }));
        expect(field()).toHaveAttribute("type", "text");

        await user.click(screen.getByRole("button", { name: "Submit second" }));
        expect(field()).toHaveAttribute("type", "password");
    });

    it("turns the eye off with a disabled field", () => {
        render(<Form disabled />);
        expect(field()).toBeDisabled();
        expect(toggle()).toBeDisabled();
    });

    it("disabling a revealed field masks it, and it stays masked when enabled again", async () => {
        const user = userEvent.setup();
        const { rerender } = render(<DisablePage disabled={false} />);
        await user.click(toggle());
        expect(field()).toHaveAttribute("type", "text");

        rerender(<DisablePage disabled />);
        expect(field()).toHaveAttribute("type", "password");
        expect(toggle()).toHaveAttribute("aria-pressed", "false");

        rerender(<DisablePage disabled={false} />);
        expect(field()).toHaveAttribute("type", "password");
    });

    it("works outside a form too", async () => {
        const user = userEvent.setup();
        render(
            <>
                <label htmlFor="pin">PIN</label>
                <PasswordInput id="pin" />
            </>
        );
        await user.click(toggle());
        expect(screen.getByLabelText("PIN")).toHaveAttribute("type", "text");
    });
});
