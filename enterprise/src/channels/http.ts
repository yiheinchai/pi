import { createReadStream } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntime } from "../runtime.ts";
import { loadAgent, loadAgents, summarizeAgents } from "../registry.ts";
import type { EnterpriseRuntime, TurnResult } from "../types.ts";

export interface HttpServerOptions {
	agentsDir: string;
	port?: number;
	host?: string;
}

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".svg": "image/svg+xml",
};

function sendJson(response: ServerResponse, status: number, body: unknown): void {
	const payload = JSON.stringify(body);
	response.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"content-length": Buffer.byteLength(payload),
	});
	response.end(payload);
}

function readBody(request: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		request.on("data", (chunk) => chunks.push(chunk as Buffer));
		request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		request.on("error", reject);
	});
}

function writeSse(response: ServerResponse, event: string, data: unknown): void {
	response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function startHttpServer(options: HttpServerOptions): Promise<Server> {
	const publicDir = join(dirname(fileURLToPath(import.meta.url)), "public");
	const sessions = new Map<string, EnterpriseRuntime>();
	const summaries = summarizeAgents(await loadAgents(options.agentsDir));

	const server = createServer(async (request, response) => {
		const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

		try {
			if (request.method === "GET" && url.pathname === "/api/health") {
				sendJson(response, 200, { ok: true });
				return;
			}

			if (request.method === "GET" && url.pathname === "/api/agents") {
				sendJson(response, 200, { agents: summaries });
				return;
			}

			const turnMatch = url.pathname.match(/^\/api\/agents\/([a-z0-9-]+)\/turns$/);
			if (request.method === "POST" && turnMatch) {
				const agentId = turnMatch[1];
				if (!agentId) {
					sendJson(response, 400, { error: "missing agent id" });
					return;
				}
				const payload = JSON.parse((await readBody(request)) || "{}") as { message?: string; sessionId?: string };
				if (!payload.message?.trim()) {
					sendJson(response, 400, { error: "message is required" });
					return;
				}
				const sessionId = payload.sessionId ?? `${agentId}:${crypto.randomUUID()}`;
				let runtime = sessions.get(sessionId);
				if (!runtime) {
					runtime = createRuntime(await loadAgent(options.agentsDir, agentId));
					sessions.set(sessionId, runtime);
				}

				response.writeHead(200, {
					"content-type": "text/event-stream; charset=utf-8",
					"cache-control": "no-cache",
					connection: "keep-alive",
				});
				writeSse(response, "session", { sessionId, agentId });

				const unsubscribe = runtime.agent.subscribe((event) => {
					if (event.type === "tool_execution_start") {
						writeSse(response, "tool_start", { name: event.toolName, args: event.args });
					}
					if (event.type === "tool_execution_end") {
						writeSse(response, "tool_end", { name: event.toolName, isError: event.isError });
					}
					if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
						writeSse(response, "text_delta", { text: event.assistantMessageEvent.delta });
					}
				});

				let result: TurnResult;
				try {
					result = await runtime.prompt(payload.message);
				} finally {
					unsubscribe();
				}
				writeSse(response, "done", {
					text: result.text,
					toolCalls: result.toolCalls,
					sessionId,
				});
				response.end();
				return;
			}

			if (request.method === "GET") {
				const relative = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
				if (relative.includes("..")) {
					response.writeHead(400).end();
					return;
				}
				const file = join(publicDir, relative);
				const stream = createReadStream(file);
				stream.on("open", () => {
					response.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
				});
				stream.on("error", () => {
					if (!response.headersSent) {
						response.writeHead(404).end("Not found");
					}
				});
				stream.pipe(response);
				return;
			}

			sendJson(response, 404, { error: "not found" });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!response.headersSent) {
				sendJson(response, 500, { error: message });
				return;
			}
			writeSse(response, "error", { error: message });
			response.end();
		}
	});

	const port = options.port ?? 8787;
	const host = options.host ?? "127.0.0.1";
	await new Promise<void>((resolve) => server.listen(port, host, resolve));
	return server;
}
