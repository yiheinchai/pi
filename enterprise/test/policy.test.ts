import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Type } from "typebox";
import { defineAgent } from "../src/define-agent.ts";
import { createScriptedStreamFn } from "../src/mock-stream.ts";
import { policy, redactPiiText } from "../src/policy.ts";
import { createRuntime } from "../src/runtime.ts";
import { tool } from "../src/tool.ts";

describe("policy", () => {
	it("redacts emails and ssns", () => {
		assert.equal(redactPiiText("write security@nimbus.example and 123-45-6789"), "write [redacted-email] and [redacted-ssn]");
	});

	it("blocks tools outside the allowlist via beforeToolCall", async () => {
		const secret = tool({
			name: "leak",
			label: "Leak",
			description: "not allowed",
			parameters: Type.Object({}),
			execute() {
				return "secret";
			},
		});
		const ok = tool({
			name: "ok",
			label: "Ok",
			description: "allowed",
			parameters: Type.Object({}),
			execute() {
				return "fine";
			},
		});
		const definition = defineAgent({
			id: "guarded",
			title: "Guarded",
			description: "Guarded",
			system: "Use tools.",
			tools: [secret, ok],
			policies: [policy.allowTools(["ok"])],
		});
		const blocked = createRuntime(definition, {
			streamFn: createScriptedStreamFn([{ toolCalls: [{ name: "leak", arguments: {} }] }, { text: "stopped" }]),
		});
		const blockedResult = await blocked.prompt("leak");
		assert.equal(blockedResult.toolCalls[0]?.blocked || blockedResult.toolCalls[0]?.isError, true);
		assert.equal(
			blocked.auditLog.some((entry) => entry.blocked && entry.toolName === "leak"),
			true,
		);

		const allowed = createRuntime(definition, {
			streamFn: createScriptedStreamFn([{ toolCalls: [{ name: "ok", arguments: {} }] }, { text: "ok" }]),
		});
		const allowedResult = await allowed.prompt("ok");
		assert.match(allowedResult.toolCalls[0]?.result ?? "", /fine/);
	});

	it("redacts PII in tool results", async () => {
		const lookup = tool({
			name: "lookup",
			label: "Lookup",
			description: "lookup",
			parameters: Type.Object({}),
			execute() {
				return "Contact j.doe@acme.example or 415-555-0100";
			},
		});
		const definition = defineAgent({
			id: "pii",
			title: "PII",
			description: "PII",
			system: "Use lookup.",
			tools: [lookup],
			policies: [policy.redactPii()],
		});
		const runtime = createRuntime(definition, {
			streamFn: createScriptedStreamFn([{ toolCalls: [{ name: "lookup", arguments: {} }] }, { text: "redacted" }]),
		});
		const result = await runtime.prompt("lookup contact");
		assert.match(result.toolCalls[0]?.result ?? "", /\[redacted-email\]/);
		assert.equal((result.toolCalls[0]?.result ?? "").includes("j.doe@acme.example"), false);
	});
});
