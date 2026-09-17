import type { AgentDefinition, AgentDefinitionInput } from "./types.ts";

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export function defineAgent(input: AgentDefinitionInput): AgentDefinition {
	if (!input.id || !ID_PATTERN.test(input.id)) {
		throw new Error(`Agent id must match ${ID_PATTERN}: got ${JSON.stringify(input.id)}`);
	}
	if (!input.title.trim()) {
		throw new Error(`Agent ${input.id} needs a title`);
	}
	if (!input.description.trim()) {
		throw new Error(`Agent ${input.id} needs a description`);
	}
	if (!input.system.trim()) {
		throw new Error(`Agent ${input.id} needs a system prompt`);
	}
	if (!Array.isArray(input.tools)) {
		throw new Error(`Agent ${input.id} needs a tools array`);
	}
	const names = new Set<string>();
	for (const tool of input.tools) {
		if (names.has(tool.name)) {
			throw new Error(`Agent ${input.id} declares duplicate tool ${tool.name}`);
		}
		names.add(tool.name);
	}
	for (const name of input.mutatingTools ?? []) {
		if (!names.has(name)) {
			throw new Error(`Agent ${input.id} lists mutating tool ${name} that is not in tools`);
		}
	}

	return {
		id: input.id,
		title: input.title,
		description: input.description,
		system: input.system,
		tools: input.tools,
		policies: input.policies ?? [],
		channels: input.channels ?? ["cli", "http"],
		mutatingTools: input.mutatingTools ?? [],
		model: input.model,
	};
}
