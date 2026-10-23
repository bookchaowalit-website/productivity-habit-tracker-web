import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("renders the patchbay, the starter lanes and the local-only notice", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("Keep the circuit alive.");
    expect(html).toContain("Move for 20 min");
    expect(html).toContain("no account · no sync");
    expect(html).toContain("Data stays on this device.");
  });

  it("renders no date cells on the server, so the static build cannot disagree with the visitor's today", () => {
    const html = renderToString(<Home />);
    expect(html).not.toContain(">NOW<");
    expect(html).not.toMatch(/Mark Move for 20 min on \d{4}-/);
  });
});
