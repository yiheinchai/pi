import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Type } from "typebox";
import { defaultAgentsDir } from "../src/cli.ts";
import { defineAgent } from "../src/define-agent.ts";
import { createScriptedStreamFn } from "../src/mock-stream.ts";
import { policy } from "../src/policy.ts";
import { loadAgent, loadAgents } from "../src/registry.ts";
import { createRuntime } from "../src/runtime.ts";
import { scaffoldAgent } from "../src/scaffold.ts";
import { tool } from "../src/tool.ts";

describe("defineAgent", () => {
	it("rejects duplicate tools and bad ids", () => {
		const ping = tool({
			name: "ping",
			label: "Ping",
			description: "ping",
			parameters: Type.Object({}),
			execute() {
				return "pong";
			},
		});
		assert.throws(
			() =>
				defineAgent({
					id: "Nope",
					title: "x",
					description: "x",
					system: "x",
					tools: [ping],
				}),
			/id must match/,
		);
		assert.throws(
			() =>
				defineAgent({
					id: "ok",
					title: "x",
					description: "x",
					system: "x",
					tools: [ping, ping],
				}),
			/duplicate tool/,
		);
	});
});

describe("registry", () => {
	it("loads the four shipped enterprise agents", async () => {
		const agents = await loadAgents(defaultAgentsDir());
		assert.deepEqual(agents.map((agent) => agent.id).sort(), ["internal-tools", "knowledge", "sales", "support"]);
	});
});

describe("scaffold", () => {
	it("writes a runnable blank agent", async () => {
		const root = mkdtempSync(join(tmpdir(), "enterprise-pi-"));
		const dir = scaffoldAgent({ agentsDir: root, id: "finance-bot", template: "blank" });
		assert.match(readFileSync(join(dir, "agent.ts"), "utf8"), /id: "finance-bot"/);
		const definition = await loadAgent(root, "finance-bot");
		const runtime = createRuntime(definition);
		const result = await runtime.prompt("ping please");
		assert.equal(result.toolCalls.some((call) => call.name === "ping"), true);
		assert.match(result.text.toLowerCase(), /pong/);
	});
});

describe("scripted stream", () => {
	it("runs a custom tool through Pi Agent", async () => {
		const echo = tool({
			name: "echo",
			label: "Echo",
			description: "echo",
			parameters: Type.Object({ text: Type.String() }),
			execute({ text }) {
				return text;
			},
		});
		const definition = defineAgent({
			id: "echo-agent",
			title: "Echo",
			description: "Echo",
			system: "Use echo.",
			tools: [echo],
			policies: [policy.allowTools(["echo"])],
		});
		const runtime = createRuntime(definition, {
			streamFn: createScriptedStreamFn([
				{ toolCalls: [{ name: "echo", arguments: { text: "nimbus" } }] },
				{ text: "done" },
			]),
		});
		const result = await runtime.prompt("say it");
		assert.match(result.toolCalls[0]?.result ?? "", /nimbus/);
		assert.match(result.text, /done/);
	});
});
