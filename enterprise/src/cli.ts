import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startHttpServer } from "./channels/http.ts";
import { resolveMode } from "./model.ts";
import { loadAgent, loadAgents, summarizeAgents } from "./registry.ts";
import { createRuntime } from "./runtime.ts";
import { scaffoldAgent, type TemplateName } from "./scaffold.ts";
import type { AgentDefinition, RuntimeOptions, TurnResult } from "./types.ts";

export function defaultAgentsDir(): string {
	return join(dirname(fileURLToPath(import.meta.url)), "../agents");
}

function usage(): string {
	return `enterprise-pi <command>

Commands:
  list                         List agents in ./agents
  run <id> [--] <prompt>       Run one turn (mock stream unless live credentials exist)
  serve [--port 8787]          Generic web console for every registered agent
  new <id> [--template name]   Scaffold a new agent (blank|knowledge|sales|support|internal-tools)
  merge-help                   Print how to merge earendil-works/pi into this fork

The platform lives in enterprise/ and does not modify packages/. Upstream merges stay in packages/.
`;
}

function argValue(args: string[], name: string): string | undefined {
	const index = args.indexOf(name);
	if (index === -1) return undefined;
	return args[index + 1];
}

function formatTurn(definition: AgentDefinition, prompt: string, result: TurnResult): string {
	const tools = result.toolCalls
		.map((call) => {
			const status = call.blocked ? "blocked" : call.isError ? "error" : "ok";
			const resultText = call.result ? `\n    ${call.result.split("\n").join("\n    ")}` : "";
			return `  tool ${call.name} [${status}] ${JSON.stringify(call.args)}${resultText}`;
		})
		.join("\n");
	return [`agent: ${definition.id} (${definition.title})`, `user: ${prompt}`, tools, `assistant:\n${result.text}`]
		.filter((section) => section.length > 0)
		.join("\n");
}

async function runtimeOptionsFromEnv(): Promise<RuntimeOptions> {
	const mode = resolveMode();
	if (mode !== "live") {
		return {};
	}
	const live = await import("./live-stream.ts");
	return {
		streamFn: live.createLiveStreamFn(),
		model: live.resolveLiveModel(),
		getApiKey: live.defaultGetApiKey,
		mode: "live",
	};
}

async function cmdList(agentsDir: string): Promise<void> {
	const agents = summarizeAgents(await loadAgents(agentsDir));
	if (agents.length === 0) {
		console.log("No agents found. Run: enterprise-pi new my-agent --template knowledge");
		return;
	}
	for (const agent of agents) {
		console.log(`${agent.id.padEnd(18)} ${agent.title} — ${agent.description}`);
	}
}

async function cmdRun(agentsDir: string, args: string[]): Promise<void> {
	const id = args[0];
	if (!id) {
		throw new Error("run requires an agent id");
	}
	const dash = args.indexOf("--");
	const promptParts = dash === -1 ? args.slice(1) : args.slice(dash + 1);
	const prompt = promptParts.join(" ").trim();
	if (!prompt) {
		throw new Error("run requires a prompt");
	}
	const definition = await loadAgent(agentsDir, id);
	const runtime = createRuntime(definition, await runtimeOptionsFromEnv());
	const result = await runtime.prompt(prompt);
	console.log(formatTurn(definition, prompt, result));
}

async function cmdServe(agentsDir: string, args: string[]): Promise<void> {
	const port = Number(argValue(args, "--port") ?? process.env.PORT ?? 8787);
	const host = argValue(args, "--host") ?? "127.0.0.1";
	const server = await startHttpServer({ agentsDir, port, host });
	const address = server.address();
	if (address && typeof address === "object") {
		console.log(`Enterprise Pi console: http://${address.address}:${address.port}`);
		console.log("Agents are loaded from", agentsDir);
	}
}

function cmdNew(agentsDir: string, args: string[]): void {
	const id = args[0];
	if (!id) {
		throw new Error("new requires an agent id");
	}
	const template = (argValue(args, "--template") ?? "blank") as TemplateName;
	const allowed: TemplateName[] = ["blank", "knowledge", "sales", "support", "internal-tools"];
	if (!allowed.includes(template)) {
		throw new Error(`Unknown template ${template}`);
	}
	const dir = scaffoldAgent({ agentsDir, id, template });
	console.log(`Created ${dir}`);
	console.log(`Edit ${join(dir, "agent.ts")} then: enterprise-pi run ${id} -- "your question"`);
}

function cmdMergeHelp(): void {
	console.log(`This directory is a git fork of earendil-works/pi.

  origin   = your fork (push enterprise/ here)
  upstream = https://github.com/earendil-works/pi.git

Merge upstream without touching the platform:

  git fetch upstream
  git merge upstream/main

Keep changes inside enterprise/. Do not edit packages/, package.json, or other
upstream files unless you intend to contribute them back to Pi.

See enterprise/docs/merging-upstream.md
`);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
	const agentsDir = argValue(argv, "--agents") ?? defaultAgentsDir();
	const filtered = argv.filter((arg, index, all) => {
		if (arg === "--agents") return false;
		if (all[index - 1] === "--agents") return false;
		return true;
	});
	const command = filtered[0];
	const rest = filtered.slice(1);

	if (!command || command === "help" || command === "--help") {
		console.log(usage());
		return;
	}
	if (command === "list") {
		await cmdList(agentsDir);
		return;
	}
	if (command === "run") {
		await cmdRun(agentsDir, rest);
		return;
	}
	if (command === "serve") {
		await cmdServe(agentsDir, rest);
		return;
	}
	if (command === "new") {
		cmdNew(agentsDir, rest);
		return;
	}
	if (command === "merge-help") {
		cmdMergeHelp();
		return;
	}
	throw new Error(`Unknown command ${command}\n${usage()}`);
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
