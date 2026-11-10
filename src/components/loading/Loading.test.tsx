import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Loading, useLoading } from "./index";

function Toggle() {
    const ctx = useLoading();
    return (
        <>
            <button type="button" onClick={() => ctx?.setLoading(true)}>start</button>
            <button type="button" onClick={() => ctx?.setLoading(false)}>stop</button>
        </>
    );
}

let probed: unknown;
function Probe() {
    probed = useLoading();
    return null;
}

describe("Loading", () => {
    it("renders its children and no overlay by default", () => {
        render(
            <Loading>
                <p>page</p>
            </Loading>
        );
        expect(screen.getByText("page")).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("shows an accessible loading overlay while loading and hides it when done", async () => {
        const user = userEvent.setup();
        render(
            <Loading>
                <Toggle />
            </Loading>
        );

        await user.click(screen.getByText("start"));
        expect(screen.getByRole("status")).toHaveTextContent("Loading…");
        expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");

        await user.click(screen.getByText("stop"));
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("useLoading returns undefined outside a <Loading> provider, so callers can opt out safely", () => {
        probed = "unset";
        render(<Probe />);
        expect(probed).toBeUndefined();
    });
});
