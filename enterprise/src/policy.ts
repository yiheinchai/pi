import type { AfterToolCallResult, BeforeToolCallResult } from "@earendil-works/pi-agent-core";
import type { ConfirmToolRequest, Policy } from "./types.ts";

function textFromContent(content: { type: string; text?: string }[]): string {
	return content
		.filter((block) => block.type === "text" && typeof block.text === "string")
		.map((block) => block.text ?? "")
		.join("\n");
}

export const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
export const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
export const PHONE_RE = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;

export function redactPiiText(text: string): string {
	return text
		.replace(EMAIL_RE, "[redacted-email]")
		.replace(SSN_RE, "[redacted-ssn]")
		.replace(PHONE_RE, "[redacted-phone]");
}

export const policy = {
	allowTools(names: readonly string[]): Policy {
		const allowed = new Set(names);
		return {
			name: "allow-tools",
			beforeToolCall(context) {
				if (allowed.has(context.toolCall.name)) {
					return undefined;
				}
				return {
					block: true,
					reason: `Policy allow-tools blocked ${context.toolCall.name}`,
				} satisfies BeforeToolCallResult;
			},
		};
	},

	denyTools(names: readonly string[]): Policy {
		const denied = new Set(names);
		return {
			name: "deny-tools",
			beforeToolCall(context) {
				if (!denied.has(context.toolCall.name)) {
					return undefined;
				}
				return {
					block: true,
					reason: `Policy deny-tools blocked ${context.toolCall.name}`,
				} satisfies BeforeToolCallResult;
			},
		};
	},

	maxToolCalls(max: number): Policy {
		let count = 0;
		return {
			name: "max-tool-calls",
			beforeToolCall() {
				count += 1;
				if (count <= max) {
					return undefined;
				}
				return {
					block: true,
					reason: `Policy max-tool-calls exceeded limit of ${max}`,
					terminate: true,
				} satisfies BeforeToolCallResult;
			},
		};
	},

	redactPii(): Policy {
		return {
			name: "redact-pii",
			afterToolCall(context) {
				const original = textFromContent(context.result.content);
				const redacted = redactPiiText(original);
				if (redacted === original) {
					return undefined;
				}
				return {
					content: [{ type: "text", text: redacted }],
					details: { ...((context.result.details as object) ?? {}), redacted: true },
				} satisfies AfterToolCallResult;
			},
		};
	},

	readonly(mutatingTools: readonly string[]): Policy {
		const mutating = new Set(mutatingTools);
		return {
			name: "readonly",
			beforeToolCall(context) {
				if (!mutating.has(context.toolCall.name)) {
					return undefined;
				}
				return {
					block: true,
					reason: `Policy readonly blocked mutating tool ${context.toolCall.name}`,
				} satisfies BeforeToolCallResult;
			},
		};
	},

	requireConfirmation(
		mutatingTools: readonly string[],
		confirm: (request: ConfirmToolRequest) => Promise<boolean> | boolean,
	): Policy {
		const mutating = new Set(mutatingTools);
		return {
			name: "require-confirmation",
			async beforeToolCall(context) {
				if (!mutating.has(context.toolCall.name)) {
					return undefined;
				}
				const ok = await confirm({
					toolName: context.toolCall.name,
					args: context.args,
					toolCallId: context.toolCall.id,
				});
				if (ok) {
					return undefined;
				}
				return {
					block: true,
					reason: `Policy require-confirmation blocked ${context.toolCall.name}`,
				} satisfies BeforeToolCallResult;
			},
		};
	},
};
