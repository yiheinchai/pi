import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startHttpServer } from "../src/channels/http.ts";
import { defaultAgentsDir } from "../src/cli.ts";

async function readSseDone(url: string, body: unknown): Promise<Record<string, unknown>> {
	const response = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	assert.equal(response.ok, true);
	const raw = await response.text();
	const blocks = raw.split("\n\n").filter(Boolean);
	const done = blocks.find((block) => block.startsWith("event: done"));
	assert.ok(done);
	const dataLine = done.split("\n").find((line) => line.startsWith("data: "));
	return JSON.parse(dataLine?.slice(6) ?? "{}") as Record<string, unknown>;
}

describe("http console", () => {
	it("lists agents and runs the knowledge agent", async () => {
		const server = await startHttpServer({ agentsDir: defaultAgentsDir(), port: 0, host: "127.0.0.1" });
		const address = server.address();
		if (!address || typeof address === "string") {
			throw new Error("expected tcp address");
		}
		const base = `http://127.0.0.1:${address.port}`;
		try {
			const health = await fetch(`${base}/api/health`).then((response) => response.json());
			assert.deepEqual(health, { ok: true });
			const catalog = (await fetch(`${base}/api/agents`).then((response) => response.json())) as {
				agents: { id: string }[];
			};
			assert.equal(catalog.agents.some((agent) => agent.id === "knowledge"), true);
			assert.equal(catalog.agents.some((agent) => agent.id === "sales"), true);
			const page = await fetch(`${base}/`).then((response) => response.text());
			assert.match(page, /Enterprise Pi/);
			const done = await readSseDone(`${base}/api/agents/knowledge/turns`, {
				message: "What is the PTO policy?",
			});
			assert.match(String(done.text), /20 days/);
		} finally {
			await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
		}
	});
});
