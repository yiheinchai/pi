import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { AgentDefinition } from "./types.ts";

function isAgentModule(value: unknown): value is { default: AgentDefinition } | AgentDefinition {
	return typeof value === "object" && value !== null;
}

function asDefinition(value: unknown, source: string): AgentDefinition {
	if (!isAgentModule(value)) {
		throw new Error(`Agent module ${source} did not export a definition`);
	}
	const candidate = "default" in value && value.default ? value.default : value;
	if (
		typeof candidate === "object" &&
		candidate !== null &&
		"id" in candidate &&
		"tools" in candidate &&
		"system" in candidate
	) {
		return candidate as AgentDefinition;
	}
	throw new Error(`Agent module ${source} must default-export defineAgent({...})`);
}

export function agentDirs(agentsDir: string): string[] {
	return readdirSync(agentsDir)
		.map((name) => join(agentsDir, name))
		.filter((path) => {
			try {
				return statSync(path).isDirectory() && statSync(join(path, "agent.ts")).isFile();
			} catch {
				return false;
			}
		})
		.sort();
}

export async function loadAgentFile(file: string): Promise<AgentDefinition> {
	const mod = await import(pathToFileURL(file).href);
	return asDefinition(mod, file);
}

export async function loadAgent(agentsDir: string, id: string): Promise<AgentDefinition> {
	const file = join(agentsDir, id, "agent.ts");
	const definition = await loadAgentFile(file);
	if (definition.id !== id) {
		throw new Error(`Agent directory ${id} exported id ${definition.id}`);
	}
	return definition;
}

export async function loadAgents(agentsDir: string): Promise<AgentDefinition[]> {
	const loaded: AgentDefinition[] = [];
	for (const dir of agentDirs(agentsDir)) {
		const definition = await loadAgentFile(join(dir, "agent.ts"));
		loaded.push(definition);
	}
	return loaded;
}

export function summarizeAgents(definitions: AgentDefinition[]): { id: string; title: string; description: string }[] {
	return definitions.map((definition) => ({
		id: definition.id,
		title: definition.title,
		description: definition.description,
	}));
}
