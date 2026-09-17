import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultAgentsDir } from "../src/cli.ts";
import { loadAgent } from "../src/registry.ts";
import { createRuntime } from "../src/runtime.ts";

describe("knowledge agent", () => {
	it("answers a handbook question through Pi tool calls", async () => {
		const definition = await loadAgent(defaultAgentsDir(), "knowledge");
		const runtime = createRuntime(definition);
		const result = await runtime.prompt("What is the PTO policy?");
		assert.equal(result.toolCalls.some((call) => call.name === "search_docs" || call.name === "get_doc"), true);
		assert.equal(result.toolCalls.some((call) => call.result?.includes("20 days")), true);
		assert.match(result.text, /20 days/);
		assert.ok(runtime.auditLog.length > 0);
	});
});
