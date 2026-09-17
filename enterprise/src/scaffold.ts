import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type TemplateName = "blank" | "knowledge" | "sales" | "support" | "internal-tools";

const TEMPLATES: Record<TemplateName, string> = {
	blank: `import { defineAgent, tool } from "#platform";
import { Type } from "typebox";

export default defineAgent({
	id: "{{id}}",
	title: "{{title}}",
	description: "Describe what this agent does.",
	system: "You are an enterprise agent. Use tools. If you cannot find an answer, say so.",
	tools: [
		tool({
			name: "ping",
			label: "Ping",
			description: "Health check tool.",
			parameters: Type.Object({}),
			execute() {
				return "pong";
			},
		}),
	],
});
`,
	knowledge: `import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineAgent, kits, policy } from "#platform";

const corpusDir = join(dirname(fileURLToPath(import.meta.url)), "corpus");

export default defineAgent({
	id: "{{id}}",
	title: "{{title}}",
	description: "Answers questions from a markdown corpus.",
	system: "You are a knowledge assistant. Call search_docs or get_doc before answering. Cite document titles.",
	tools: kits.knowledge.tools({ corpusDir }),
	policies: [policy.allowTools(["search_docs", "get_doc"]), policy.redactPii()],
});
`,
	sales: `import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineAgent, kits, policy } from "#platform";

const dataPath = join(dirname(fileURLToPath(import.meta.url)), "data", "crm.json");

export default defineAgent({
	id: "{{id}}",
	title: "{{title}}",
	description: "Sales CRM assistant.",
	system: "You are a sales assistant. Use CRM tools. Do not invent accounts.",
	tools: kits.sales.tools({ dataPath }),
	mutatingTools: ["create_opportunity", "log_activity"],
	policies: [
		policy.allowTools(["lookup_account", "list_pipeline", "create_opportunity", "log_activity"]),
		policy.redactPii(),
	],
});
`,
	support: `import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineAgent, kits, policy } from "#platform";

const here = dirname(fileURLToPath(import.meta.url));

export default defineAgent({
	id: "{{id}}",
	title: "{{title}}",
	description: "Customer support assistant.",
	system: "You are a support agent. Look up tickets and search the help center before answering.",
	tools: kits.support.tools({ dataPath: join(here, "data", "tickets.json"), kbDir: join(here, "kb") }),
	mutatingTools: ["create_ticket", "update_ticket"],
	policies: [
		policy.allowTools(["lookup_ticket", "search_kb", "create_ticket", "update_ticket"]),
		policy.redactPii(),
	],
});
`,
	"internal-tools": `import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineAgent, kits, policy } from "#platform";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "workspace");

export default defineAgent({
	id: "{{id}}",
	title: "{{title}}",
	description: "Coding agent over an internal tool workspace.",
	system: "You are an internal-tools coding agent. Read the workspace before answering or editing.",
	tools: kits.coding.tools({ rootDir }),
	mutatingTools: ["write_file", "run_command"],
	policies: [
		policy.allowTools(["list_files", "read_file", "search_code", "write_file", "run_command"]),
		policy.maxToolCalls(12),
	],
});
`,
};

function titleFromId(id: string): string {
	return id
		.split("-")
		.map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
		.join(" ");
}

export function scaffoldAgent(options: { agentsDir: string; id: string; template: TemplateName }): string {
	const dir = join(options.agentsDir, options.id);
	mkdirSync(dir, { recursive: true });
	const source = TEMPLATES[options.template].replaceAll("{{id}}", options.id).replaceAll("{{title}}", titleFromId(options.id));
	writeFileSync(join(dir, "agent.ts"), source, "utf8");

	if (options.template === "knowledge") {
		mkdirSync(join(dir, "corpus"), { recursive: true });
		writeFileSync(
			join(dir, "corpus", "intro.md"),
			"# Introduction\n\nReplace this file with your handbook.\n",
			"utf8",
		);
	}
	if (options.template === "sales") {
		mkdirSync(join(dir, "data"), { recursive: true });
		writeFileSync(
			join(dir, "data", "crm.json"),
			`${JSON.stringify({ accounts: [], opportunities: [], activities: [] }, null, 2)}\n`,
			"utf8",
		);
	}
	if (options.template === "support") {
		mkdirSync(join(dir, "data"), { recursive: true });
		mkdirSync(join(dir, "kb"), { recursive: true });
		writeFileSync(
			join(dir, "data", "tickets.json"),
			`${JSON.stringify({ tickets: [] }, null, 2)}\n`,
			"utf8",
		);
		writeFileSync(join(dir, "kb", "help.md"), "# Help\n\nReplace this article.\n", "utf8");
	}
	if (options.template === "internal-tools") {
		const workspace = join(dir, "workspace");
		mkdirSync(join(workspace, "src"), { recursive: true });
		writeFileSync(join(workspace, "README.md"), "# Internal tool\n\nDescribe the tool here.\n", "utf8");
		writeFileSync(join(workspace, "src", "app.ts"), "export const name = \"internal-tool\";\n", "utf8");
	}

	return dir;
}

export function templatesRoot(): string {
	return join(dirname(fileURLToPath(import.meta.url)), "../templates");
}
