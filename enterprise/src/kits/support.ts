import { readFileSync } from "node:fs";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import { jsonResult, tool } from "../tool.ts";
import { loadMarkdownCorpus, searchDocuments } from "./knowledge.ts";

export interface Ticket {
	id: string;
	title: string;
	status: "open" | "waiting" | "in_progress" | "resolved";
	requester: string;
	priority: "low" | "normal" | "high";
	body: string;
}

export interface SupportData {
	tickets: Ticket[];
}

export function loadSupportData(path: string): SupportData {
	return JSON.parse(readFileSync(path, "utf8")) as SupportData;
}

export function createSupportTools(options: { dataPath: string; kbDir: string }): AgentTool[] {
	const store: SupportData = structuredClone(loadSupportData(options.dataPath));
	const docs = loadMarkdownCorpus(options.kbDir);
	let ticketSeq = store.tickets.length + 1;

	return [
		tool({
			name: "lookup_ticket",
			label: "Lookup ticket",
			description: "Fetch a support ticket by id (for example TCK-1042).",
			parameters: Type.Object({
				ticketId: Type.String({ description: "Ticket id" }),
			}),
			execute({ ticketId }) {
				const ticket = store.tickets.find((item) => item.id.toLowerCase() === ticketId.toLowerCase());
				if (!ticket) {
					throw new Error(`Unknown ticket ${ticketId}`);
				}
				return jsonResult(ticket);
			},
		}),
		tool({
			name: "search_kb",
			label: "Search knowledge base",
			description: "Search customer-facing help articles.",
			parameters: Type.Object({
				query: Type.String(),
			}),
			execute({ query }) {
				const hits = searchDocuments(docs, query, 5).map((document) => ({
					id: document.id,
					title: document.title,
					excerpt: document.text.slice(0, 500),
				}));
				return jsonResult({ hits });
			},
		}),
		tool({
			name: "create_ticket",
			label: "Create ticket",
			description: "Open a new support ticket.",
			parameters: Type.Object({
				title: Type.String(),
				body: Type.String(),
				priority: Type.Optional(Type.String()),
				requester: Type.Optional(Type.String()),
			}),
			execute({ title, body, priority, requester }) {
				const ticket: Ticket = {
					id: `TCK-${2000 + ticketSeq++}`,
					title,
					status: "open",
					requester: requester ?? "unknown",
					priority: priority === "high" || priority === "low" ? priority : "normal",
					body,
				};
				store.tickets.push(ticket);
				return jsonResult(ticket);
			},
		}),
		tool({
			name: "update_ticket",
			label: "Update ticket",
			description: "Update ticket status or add a note.",
			parameters: Type.Object({
				ticketId: Type.String(),
				status: Type.Optional(Type.String()),
				note: Type.Optional(Type.String()),
			}),
			execute({ ticketId, status, note }) {
				const ticket = store.tickets.find((item) => item.id.toLowerCase() === ticketId.toLowerCase());
				if (!ticket) {
					throw new Error(`Unknown ticket ${ticketId}`);
				}
				if (status === "open" || status === "waiting" || status === "in_progress" || status === "resolved") {
					ticket.status = status;
				}
				if (note) {
					ticket.body = `${ticket.body}\n\nNote: ${note}`;
				}
				return jsonResult(ticket);
			},
		}),
	];
}
