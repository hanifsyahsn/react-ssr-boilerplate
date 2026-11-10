import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./Home";

describe("Home page", () => {
    it("shows the Home heading", () => {
        render(<Home />);
        expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    });
});
