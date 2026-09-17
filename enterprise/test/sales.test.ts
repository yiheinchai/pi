import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultAgentsDir } from "../src/cli.ts";
import { loadAgent } from "../src/registry.ts";
import { createRuntime } from "../src/runtime.ts";

describe("sales agent", () => {
	it("looks up Acme ARR from the CRM kit", async () => {
		const definition = await loadAgent(defaultAgentsDir(), "sales");
		const runtime = createRuntime(definition);
		const result = await runtime.prompt("What is Acme Manufacturing ARR?");
		assert.equal(result.toolCalls.some((call) => call.name === "lookup_account"), true);
		assert.equal(result.toolCalls.some((call) => call.result?.includes("240000")), true);
		assert.match(result.text, /240000/);
	});
});
