import type { Context, Message } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import type { StreamFn } from "@earendil-works/pi-agent-core";

function messageText(message: Message): string {
	if (message.role === "user") {
		if (typeof message.content === "string") {
			return message.content;
		}
		return message.content
			.filter((block) => block.type === "text")
			.map((block) => block.text)
			.join("\n");
	}
	if (message.role === "assistant") {
		return message.content
			.filter((block) => block.type === "text")
			.map((block) => block.text)
			.join("\n");
	}
	return message.content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join("\n");
}

function lastUserText(messages: Message[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message?.role === "user") {
			return messageText(message);
		}
	}
	return "";
}

function toolResultsSinceLastUser(messages: Message[]): { name: string; text: string }[] {
	const results: { name: string; text: string }[] = [];
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (!message) continue;
		if (message.role === "user") {
			break;
		}
		if (message.role === "toolResult") {
			results.unshift({ name: message.toolName, text: messageText(message) });
		}
	}
	return results;
}

function declaredTools(context: Context): { name: string }[] {
	return (context.tools ?? []).map((item) => ({ name: item.name }));
}

const SEARCH_TOOLS = [
	"search_docs",
	"search_kb",
	"search_code",
	"lookup_account",
	"lookup_ticket",
	"list_pipeline",
	"list_files",
	"get_doc",
	"read_file",
] as const;

function extractTicketId(text: string): string | undefined {
	const match = text.match(/\bTCK-\d+\b/i);
	return match?.[0]?.toUpperCase();
}

function extractAccountHint(text: string): string {
	const named = text.match(/\b(acme|blue harbor|nimbus|globex|initech)\b/i);
	if (named?.[1]) {
		return named[1];
	}
	return text;
}

function extractPathHint(text: string): string | undefined {
	const match = text.match(/\b([\w./-]+\.(?:ts|js|md|json))\b/);
	return match?.[1];
}

function pickToolCall(userText: string, tools: { name: string }[]): { name: string; args: Record<string, unknown> } | undefined {
	const available = new Set(tools.map((tool) => tool.name));
	const lower = userText.toLowerCase();

	if ((lower.includes("create") || lower.includes("open") || lower.includes("file a")) && lower.includes("ticket") && available.has("create_ticket")) {
		return {
			name: "create_ticket",
			args: {
				title: userText.slice(0, 80),
				body: userText,
				priority: "normal",
			},
		};
	}

	if ((lower.includes("create") || lower.includes("add")) && lower.includes("opportunit") && available.has("create_opportunity")) {
		return {
			name: "create_opportunity",
			args: {
				accountId: "acme",
				name: "New opportunity",
				amount: 10000,
				stage: "qualify",
			},
		};
	}

	if (available.has("lookup_ticket") && extractTicketId(userText)) {
		return { name: "lookup_ticket", args: { ticketId: extractTicketId(userText) } };
	}

	if (available.has("lookup_account") && /\b(account|arr|customer|acme|harbor|renewal)\b/i.test(userText)) {
		return { name: "lookup_account", args: { query: extractAccountHint(userText) } };
	}

	if (available.has("list_pipeline") && /\b(pipeline|forecast|deals?)\b/i.test(userText)) {
		return { name: "list_pipeline", args: {} };
	}

	if (available.has("ping")) {
		return { name: "ping", args: {} };
	}

	if (available.has("read_file")) {
		const path = extractPathHint(userText);
		if (path) {
			return { name: "read_file", args: { path } };
		}
	}

	if (tools.length === 1 && tools[0]) {
		const name = tools[0].name;
		if (name === "echo") {
			return { name, args: { text: userText } };
		}
		return { name, args: {} };
	}

	for (const name of SEARCH_TOOLS) {
		if (!available.has(name)) continue;
		if (name === "search_docs" || name === "search_kb" || name === "search_code") {
			return { name, args: { query: userText } };
		}
		if (name === "list_files") {
			return { name, args: { path: "." } };
		}
		if (name === "get_doc") {
			return { name, args: { id: "pto" } };
		}
		if (name === "lookup_account") {
			return { name, args: { query: extractAccountHint(userText) } };
		}
		if (name === "lookup_ticket") {
			return { name, args: { ticketId: extractTicketId(userText) ?? "TCK-1042" } };
		}
		if (name === "list_pipeline") {
			return { name, args: {} };
		}
		if (name === "read_file") {
			return { name, args: { path: "src/routing.ts" } };
		}
	}

	return undefined;
}

function synthesizeAnswer(userText: string, results: { name: string; text: string }[]): string {
	if (results.length === 0) {
		return `I do not have a tool result for that yet. You asked: ${userText}`;
	}
	const body = results.map((result) => `${result.name}:\n${result.text}`).join("\n\n");
	return `Here is what the registered tools returned for "${userText}":\n\n${body}`;
}

function pushDone(message: ReturnType<typeof fauxAssistantMessage>) {
	const stream = createAssistantMessageEventStream();
	queueMicrotask(() => {
		stream.push({ type: "done", reason: message.stopReason === "toolUse" ? "toolUse" : "stop", message });
	});
	return stream;
}

/**
 * Deterministic streamFn for local/CI runs with no provider keys.
 * First turn calls a matching enterprise tool; the follow-up turn quotes tool output.
 */
export function createHeuristicStreamFn(): StreamFn {
	return (_model, context: Context) => {
		const userText = lastUserText(context.messages);
		const results = toolResultsSinceLastUser(context.messages);
		const tools = declaredTools(context);

		if (results.length === 0) {
			const call = pickToolCall(userText, tools);
			if (call) {
				return pushDone(fauxAssistantMessage(fauxToolCall(call.name, call.args), { stopReason: "toolUse" }));
			}
		}

		return pushDone(fauxAssistantMessage(synthesizeAnswer(userText, results), { stopReason: "stop" }));
	};
}

export interface ScriptedTurn {
	text?: string;
	toolCalls?: { name: string; arguments: Record<string, unknown> }[];
}

export function createScriptedStreamFn(turns: ScriptedTurn[]): StreamFn {
	let index = 0;
	return () => {
		const turn = turns[Math.min(index, turns.length - 1)] ?? { text: "" };
		index += 1;
		if (turn.toolCalls && turn.toolCalls.length > 0) {
			return pushDone(
				fauxAssistantMessage(
					turn.toolCalls.map((call) => fauxToolCall(call.name, call.arguments)),
					{ stopReason: "toolUse" },
				),
			);
		}
		return pushDone(fauxAssistantMessage(turn.text ?? "", { stopReason: "stop" }));
	};
}
