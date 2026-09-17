import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { defaultAgentsDir } from "../src/cli.ts";
import { defineAgent } from "../src/define-agent.ts";
import { createCodingTools } from "../src/kits/coding.ts";
import { createScriptedStreamFn } from "../src/mock-stream.ts";
import { policy } from "../src/policy.ts";
import { loadAgent } from "../src/registry.ts";
import { createRuntime } from "../src/runtime.ts";

describe("internal-tools coding agent", () => {
	it("finds expense approval routing in the workspace", async () => {
		const definition = await loadAgent(defaultAgentsDir(), "internal-tools");
		const runtime = createRuntime(definition);
		const result = await runtime.prompt("How does approval routing work for a $5000 expense?");
		assert.equal(
			result.toolCalls.some((call) => ["search_code", "read_file", "list_files"].includes(call.name)),
			true,
		);
		assert.match(result.text, /finance|2_000|approver/i);
	});

	it("refuses path traversal", async () => {
		const root = mkdtempSync(join(tmpdir(), "coding-kit-"));
		const tools = createCodingTools({ rootDir: root });
		const list = tools[0];
		if (!list) throw new Error("expected list_files");
		await assert.rejects(list.execute("1", { path: "../../etc/passwd" }), /outside the workspace/);
	});

	it("writes only inside a provided workspace when scripted", async () => {
		const root = mkdtempSync(join(tmpdir(), "coding-write-"));
		const definition = defineAgent({
			id: "scratch-coder",
			title: "Scratch",
			description: "Scratch",
			system: "Write files.",
			tools: createCodingTools({ rootDir: root }),
			mutatingTools: ["write_file", "run_command"],
			policies: [policy.allowTools(["list_files", "read_file", "search_code", "write_file", "run_command"])],
		});
		const runtime = createRuntime(definition, {
			streamFn: createScriptedStreamFn([
				{
					toolCalls: [
						{
							name: "write_file",
							arguments: { path: "NOTES.md", content: "routed to finance over 2000" },
						},
					],
				},
				{ text: "wrote notes" },
			]),
		});
		const result = await runtime.prompt("write a note");
		assert.equal(result.toolCalls[0]?.name, "write_file");
		assert.match(readFileSync(join(root, "NOTES.md"), "utf8"), /finance/);
	});
});
