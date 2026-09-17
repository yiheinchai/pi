import type { Agent, AgentEvent, AgentMessage, AgentTool, StreamFn } from "@earendil-works/pi-agent-core";
import type { AfterToolCallContext, AfterToolCallResult, BeforeToolCallContext, BeforeToolCallResult } from "@earendil-works/pi-agent-core";
import type { Model } from "@earendil-works/pi-ai";

export type ChannelName = "cli" | "http";

export interface Policy {
	name: string;
	beforeToolCall?: (
		context: BeforeToolCallContext,
		signal?: AbortSignal,
	) => Promise<BeforeToolCallResult | undefined> | BeforeToolCallResult | undefined;
	afterToolCall?: (
		context: AfterToolCallContext,
		signal?: AbortSignal,
	) => Promise<AfterToolCallResult | undefined> | AfterToolCallResult | undefined;
}

export interface AgentDefinition {
	id: string;
	title: string;
	description: string;
	system: string;
	tools: AgentTool[];
	policies: Policy[];
	channels: ChannelName[];
	mutatingTools: string[];
	model?: {
		provider: string;
		id: string;
	};
}

export interface AgentDefinitionInput {
	id: string;
	title: string;
	description: string;
	system: string;
	tools: AgentTool[];
	policies?: Policy[];
	channels?: ChannelName[];
	mutatingTools?: string[];
	model?: {
		provider: string;
		id: string;
	};
}

export interface AuditEntry {
	at: string;
	agentId: string;
	toolName: string;
	toolCallId: string;
	args: unknown;
	blocked: boolean;
	reason?: string;
	isError?: boolean;
	resultPreview?: string;
}

export interface ToolCallRecord {
	name: string;
	args: unknown;
	result?: string;
	blocked: boolean;
	isError: boolean;
}

export interface TurnResult {
	text: string;
	events: AgentEvent[];
	messages: AgentMessage[];
	toolCalls: ToolCallRecord[];
}

export interface ConfirmToolRequest {
	toolName: string;
	args: unknown;
	toolCallId: string;
}

export interface RuntimeOptions {
	streamFn?: StreamFn;
	model?: Model<string>;
	mode?: "mock" | "live";
	confirmTool?: (request: ConfirmToolRequest) => Promise<boolean> | boolean;
	getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
	auditSink?: (entry: AuditEntry) => void;
}

export interface EnterpriseRuntime {
	definition: AgentDefinition;
	agent: Agent;
	auditLog: AuditEntry[];
	prompt: (text: string) => Promise<TurnResult>;
	reset: () => void;
}

export type { Agent, AgentEvent, AgentMessage, AgentTool, Model, StreamFn };
