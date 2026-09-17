import type { AgentTool, AgentToolResult, AgentToolUpdateCallback } from "@earendil-works/pi-agent-core";
import type { Static, TSchema } from "typebox";

export interface ToolExecuteContext<TDetails> {
	toolCallId: string;
	signal?: AbortSignal;
	onUpdate?: AgentToolUpdateCallback<TDetails>;
}

export interface ToolDefinition<TParams extends TSchema, TDetails> {
	name: string;
	label: string;
	description: string;
	parameters: TParams;
	execute: (
		params: Static<TParams>,
		context: ToolExecuteContext<TDetails>,
	) => AgentToolResult<TDetails> | string | Promise<AgentToolResult<TDetails> | string>;
}

function asResult<TDetails>(value: AgentToolResult<TDetails> | string): AgentToolResult<TDetails> {
	if (typeof value === "string") {
		return { content: [{ type: "text", text: value }], details: {} as TDetails };
	}
	return value;
}

/** Define a Pi `AgentTool` with less boilerplate. `execute` may return a string. */
export function tool<TParams extends TSchema, TDetails = unknown>(
	definition: ToolDefinition<TParams, TDetails>,
): AgentTool<TParams, TDetails> {
	return {
		name: definition.name,
		label: definition.label,
		description: definition.description,
		parameters: definition.parameters,
		execute: async (toolCallId, params, signal, onUpdate) => {
			return asResult(
				await definition.execute(params, {
					toolCallId,
					signal,
					onUpdate,
				}),
			);
		},
	};
}

export function jsonResult<TDetails>(value: TDetails, text?: string): AgentToolResult<TDetails> {
	return {
		content: [{ type: "text", text: text ?? JSON.stringify(value, null, 2) }],
		details: value,
	};
}
