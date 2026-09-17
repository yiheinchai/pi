import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
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
		const root = join(fileURLToPath(new URL("..", import.meta.url)), ".tmp-agents");
		mkdirSync(root, { recursive: true });
		const id = `tmp-finance-${process.pid}`;
		const dir = scaffoldAgent({ agentsDir: root, id, template: "blank" });
		try {
			assert.match(readFileSync(join(dir, "agent.ts"), "utf8"), new RegExp(`id: "${id}"`));
			const definition = await loadAgent(root, id);
			const runtime = createRuntime(definition);
			const result = await runtime.prompt("ping please");
			assert.equal(result.toolCalls.some((call) => call.name === "ping"), true);
			assert.match(result.text.toLowerCase(), /pong/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
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
