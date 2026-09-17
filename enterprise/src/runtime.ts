import { Agent, type AfterToolCallResult, type AgentEvent, type BeforeToolCallResult } from "@earendil-works/pi-agent-core";
import { createHeuristicStreamFn } from "./mock-stream.ts";
import { MOCK_MODEL } from "./model.ts";
import type { AgentDefinition, AuditEntry, EnterpriseRuntime, RuntimeOptions, ToolCallRecord, TurnResult } from "./types.ts";

function previewText(value: unknown, limit = 500): string {
	const text = typeof value === "string" ? value : JSON.stringify(value);
	if (text.length <= limit) {
		return text;
	}
	return `${text.slice(0, limit)}…`;
}

function assistantText(events: AgentEvent[]): string {
	const chunks: string[] = [];
	for (const event of events) {
		if (event.type !== "message_end") continue;
		const message = event.message;
		if (message.role !== "assistant") continue;
		for (const block of message.content) {
			if (block.type === "text") {
				chunks.push(block.text);
			}
		}
	}
	return chunks.join("\n").trim();
}

function toolCallRecords(events: AgentEvent[]): ToolCallRecord[] {
	const records = new Map<string, ToolCallRecord>();
	for (const event of events) {
		if (event.type === "tool_execution_start") {
			records.set(event.toolCallId, {
				name: event.toolName,
				args: event.args,
				blocked: false,
				isError: false,
			});
		}
		if (event.type === "tool_execution_end") {
			const existing = records.get(event.toolCallId) ?? {
				name: event.toolName,
				args: {},
				blocked: false,
				isError: false,
			};
			const result = event.result as { content?: { type: string; text?: string }[] } | undefined;
			const text = result?.content?.filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n");
			existing.result = text;
			existing.isError = event.isError;
			if (event.isError && text && /blocked/i.test(text)) {
				existing.blocked = true;
			}
			records.set(event.toolCallId, existing);
		}
	}
	return [...records.values()];
}

export function createRuntime(definition: AgentDefinition, options: RuntimeOptions = {}): EnterpriseRuntime {
	const streamFn = options.streamFn ?? createHeuristicStreamFn();
	const model = options.model ?? MOCK_MODEL;
	const auditLog: AuditEntry[] = [];

	const agent = new Agent({
		streamFn,
		getApiKey: options.getApiKey,
		initialState: {
			systemPrompt: definition.system,
			tools: definition.tools,
			model,
		},
		async beforeToolCall(context, signal) {
			for (const item of definition.policies) {
				if (!item.beforeToolCall) continue;
				const result = await item.beforeToolCall(context, signal);
				if (result?.block) {
					const entry: AuditEntry = {
						at: new Date().toISOString(),
						agentId: definition.id,
						toolName: context.toolCall.name,
						toolCallId: context.toolCall.id,
						args: context.args,
						blocked: true,
						reason: result.reason,
					};
					auditLog.push(entry);
					options.auditSink?.(entry);
					return result satisfies BeforeToolCallResult;
				}
			}
			return undefined;
		},
		async afterToolCall(context, signal) {
			let merged: AfterToolCallResult | undefined;
			for (const item of definition.policies) {
				if (!item.afterToolCall) continue;
				const result = await item.afterToolCall(context, signal);
				if (!result) continue;
				merged = { ...merged, ...result };
			}
			const content = merged?.content ?? context.result.content;
			const text = content
				.filter((block) => block.type === "text")
				.map((block) => block.text)
				.join("\n");
			const entry: AuditEntry = {
				at: new Date().toISOString(),
				agentId: definition.id,
				toolName: context.toolCall.name,
				toolCallId: context.toolCall.id,
				args: context.args,
				blocked: false,
				isError: merged?.isError ?? context.isError,
				resultPreview: previewText(text),
			};
			auditLog.push(entry);
			options.auditSink?.(entry);
			return merged;
		},
	});

	return {
		definition,
		agent,
		auditLog,
		async prompt(text: string): Promise<TurnResult> {
			const events: AgentEvent[] = [];
			const unsubscribe = agent.subscribe((event) => {
				events.push(event);
			});
			try {
				await agent.prompt(text);
				await agent.waitForIdle();
			} finally {
				unsubscribe();
			}
			return {
				text: assistantText(events),
				events,
				messages: agent.state.messages,
				toolCalls: toolCallRecords(events),
			};
		},
		reset() {
			agent.reset();
		},
	};
}
