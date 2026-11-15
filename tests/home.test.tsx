import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("renders the App shell, the starter habits and the local-only note", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("Today");
    expect(html).toContain("Move for 20 min");
    expect(html).toContain("New habit");
    expect(html).toContain("Saved in this browser only");
  });

  it("renders nothing that depends on today on the server, so the static build cannot disagree with the visitor", () => {
    const html = renderToString(<Home />);
    expect(html).not.toContain("done today");
    expect(html).not.toContain("day streak");
    expect(html).not.toContain("No streak yet");
    expect(html).toContain("3 habits");
    expect(html).toMatch(/aria-label="Done today: Move for 20 min" disabled=""|disabled="" aria-label="Done today: Move for 20 min"/);
  });
});
