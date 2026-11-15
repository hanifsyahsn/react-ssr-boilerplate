import { useState } from "react";
import { act, render, screen } from "@testing-library/react";
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

const field = () => screen.getByLabelText("Password") as HTMLInputElement;
const toggle = () => screen.getByRole("button", { name: "Show password" });

// AD-24, `.claude/rules/password-input.md`. jsdom can't prove the caret restore or the mousedown preventDefault the
// way a browser does: those need the real-browser check listed in the rule.
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

    it("keeps what the page sets on the field: id for its label, autocomplete for password managers, max length", () => {
        render(<Form />);
        expect(field()).toHaveAttribute("id", "password");
        expect(field()).toHaveAttribute("autocomplete", "current-password");
        expect(field()).toHaveAttribute("maxlength", "72");
        expect(toggle()).toHaveAttribute("aria-controls", "password");
    });

    it("a field given only a name uses it as its id, and keeps the page's own class", () => {
        render(
            <>
                <label htmlFor="secret">Secret</label>
                <PasswordInput name="secret" className="wide" />
            </>
        );
        expect(screen.getByLabelText("Secret")).toHaveAttribute("name", "secret");
        expect(screen.getByLabelText("Secret")).toHaveClass("password-input-field", "wide");
        expect(toggle()).toHaveAttribute("aria-controls", "secret");
    });

    it("turns the eye off with a disabled field", () => {
        render(<Form disabled />);
        expect(field()).toBeDisabled();
        expect(toggle()).toBeDisabled();
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
