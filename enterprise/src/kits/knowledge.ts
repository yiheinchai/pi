import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import { jsonResult, tool } from "../tool.ts";

export interface KnowledgeDocument {
	id: string;
	title: string;
	path: string;
	text: string;
}

export function loadMarkdownCorpus(corpusDir: string): KnowledgeDocument[] {
	return readdirSync(corpusDir)
		.filter((name) => name.endsWith(".md"))
		.map((name) => {
			const path = join(corpusDir, name);
			const text = readFileSync(path, "utf8");
			const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? name.replace(/\.md$/, "");
			return {
				id: name.replace(/\.md$/, ""),
				title,
				path,
				text,
			};
		});
}

function tokenize(value: string): string[] {
	return value
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length > 1);
}

export function searchDocuments(documents: KnowledgeDocument[], query: string, limit = 5): KnowledgeDocument[] {
	const terms = tokenize(query);
	const scored = documents
		.map((document) => {
			const haystack = tokenize(`${document.title} ${document.text}`);
			let score = 0;
			for (const term of terms) {
				score += haystack.filter((token) => token === term).length;
				if (document.title.toLowerCase().includes(term)) {
					score += 3;
				}
			}
			return { document, score };
		})
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
	return scored.map((item) => item.document);
}

export function createKnowledgeTools(options: { corpusDir: string }): AgentTool[] {
	const documents = loadMarkdownCorpus(options.corpusDir);
	const byId = new Map(documents.map((document) => [document.id, document]));

	return [
		tool({
			name: "search_docs",
			label: "Search docs",
			description: "Search the company knowledge base. Prefer this before answering policy or handbook questions.",
			parameters: Type.Object({
				query: Type.String({ description: "Natural-language query" }),
				limit: Type.Optional(Type.Number({ description: "Maximum hits to return" })),
			}),
			execute({ query, limit }) {
				const hits = searchDocuments(documents, query, limit ?? 5).map((document) => ({
					id: document.id,
					title: document.title,
					excerpt: document.text.slice(0, 500),
				}));
				return jsonResult({ hits }, JSON.stringify({ hits }, null, 2));
			},
		}),
		tool({
			name: "get_doc",
			label: "Get doc",
			description: "Read a knowledge-base document by id (filename without .md).",
			parameters: Type.Object({
				id: Type.String({ description: "Document id, e.g. pto" }),
			}),
			execute({ id }) {
				const document = byId.get(id);
				if (!document) {
					const known = [...byId.keys()].join(", ");
					throw new Error(`Unknown document ${id}. Known ids: ${known}`);
				}
				return jsonResult(document, `# ${document.title}\n\n${document.text}`);
			},
		}),
	];
}
