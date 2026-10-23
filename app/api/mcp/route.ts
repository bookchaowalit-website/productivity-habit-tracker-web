import { NextResponse } from "next/server";
import { SEED_HABITS, currentStreak } from "@/lib/habits";

// Stateless JSON-RPC MCP endpoint. Habit checks live only in each visitor's browser, so the server knows the starter
// lanes and the streak rule, nothing else: no tool can read or change anyone's habits.

type RpcRequest = { id?: number | string | null; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const TOOLS = [
  { name: "get_starter_lanes", description: "The three starter habit lanes a new visitor sees", inputSchema: { type: "object", properties: {} } },
  {
    name: "streak",
    description: "Apply the page's streak rule to a list of checked days (YYYY-MM-DD) as of a given day",
    inputSchema: {
      type: "object",
      properties: { checked: { type: "array", items: { type: "string" } }, today: { type: "string" } },
      required: ["checked", "today"],
    },
  },
];

class RpcError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

function callTool(name: string | undefined, args: Record<string, unknown> = {}) {
  switch (name) {
    case "get_starter_lanes":
      return { lanes: SEED_HABITS.map(({ id, name: label }) => ({ id, name: label })) };
    case "streak": {
      const { checked, today } = args;
      if (typeof today !== "string" || !DAY.test(today)) throw new RpcError(-32602, "today must be YYYY-MM-DD");
      if (!Array.isArray(checked) || !checked.every((day) => typeof day === "string" && DAY.test(day))) {
        throw new RpcError(-32602, "checked must be a list of YYYY-MM-DD days");
      }
      const checks = Object.fromEntries((checked as string[]).map((day) => [day, true]));
      return { today, streak: currentStreak(checks, today) };
    }
    default:
      throw new RpcError(-32602, `Unknown tool: ${String(name)}`);
  }
}

export async function POST(request: Request) {
  let id: RpcRequest["id"] = null;
  try {
    const body = (await request.json()) as RpcRequest;
    id = body.id ?? null;
    let result: unknown;
    switch (body.method) {
      case "initialize":
        result = { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "Habit Patchbay", version: "1.0.0" } };
        break;
      case "tools/list":
        result = { tools: TOOLS };
        break;
      case "tools/call":
        result = callTool(body.params?.name, body.params?.arguments);
        break;
      default:
        throw new RpcError(-32601, `Unknown method: ${String(body.method)}`);
    }
    return NextResponse.json({ jsonrpc: "2.0", id, result });
  } catch (error) {
    const code = error instanceof RpcError ? error.code : -32700;
    const message = error instanceof RpcError ? error.message : "Parse error";
    return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: 400 });
  }
}
