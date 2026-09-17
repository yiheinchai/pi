import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultAgentsDir } from "../src/cli.ts";
import { loadAgent } from "../src/registry.ts";
import { createRuntime } from "../src/runtime.ts";

describe("support agent", () => {
	it("looks up a customer ticket", async () => {
		const definition = await loadAgent(defaultAgentsDir(), "support");
		const runtime = createRuntime(definition);
		const result = await runtime.prompt("What is the status of TCK-1042?");
		assert.equal(result.toolCalls.some((call) => call.name === "lookup_ticket"), true);
		assert.equal(result.toolCalls.some((call) => call.result?.includes("waiting")), true);
		assert.match(result.text, /waiting/);
	});
});
