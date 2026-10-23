import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/mcp/route";

function rpc(body: unknown) {
  return POST(new Request("http://localhost/api/mcp", { method: "POST", body: JSON.stringify(body) }));
}
const call = (id: number, name: string, args?: unknown) => rpc({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }).then((r) => r.json());

describe("MCP route", () => {
  it("echoes the JSON-RPC request id and lists the real tools", async () => {
    const body = await (await rpc({ jsonrpc: "2.0", id: 7, method: "tools/list" })).json();
    expect(body.id).toBe(7);
    expect(body.result.tools.map((t: { name: string }) => t.name)).toEqual(["get_starter_lanes", "streak"]);
  });

  it("get_starter_lanes returns the three starter lanes", async () => {
    const { result } = await call(1, "get_starter_lanes");
    expect(result.lanes.map((l: { id: string }) => l.id)).toEqual(["move", "read", "focus"]);
  });

  it("streak applies the page's rule (an open today does not break it)", async () => {
    const { result } = await call(2, "streak", { checked: ["2026-10-21", "2026-10-22"], today: "2026-10-23" });
    expect(result.streak).toBe(2);
  });

  it("streak rejects bad dates", async () => {
    const bad = await call(3, "streak", { checked: ["yesterday"], today: "2026-10-23" });
    expect(bad.error.code).toBe(-32602);
    expect(bad.id).toBe(3);
    expect((await call(4, "streak", { checked: [], today: "today" })).error.code).toBe(-32602);
  });

  it("rejects an unknown tool, an unknown method and malformed JSON", async () => {
    const unknown = await call(5, "get_my_habits");
    expect(unknown.result).toBeUndefined();
    expect(unknown.error.code).toBe(-32602);
    expect((await (await rpc({ jsonrpc: "2.0", id: 6, method: "nope" })).json()).error.code).toBe(-32601);
    const res = await POST(new Request("http://localhost/api/mcp", { method: "POST", body: "{" }));
    expect((await res.json()).error.code).toBe(-32700);
  });
});
