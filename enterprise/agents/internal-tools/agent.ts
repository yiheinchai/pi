import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineAgent, kits, policy } from "#platform";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "workspace");

export default defineAgent({
	id: "internal-tools",
	title: "Internal Tools Coding Agent",
	description: "Reads and edits custom internal tools. This is a coding agent, not a chatbot wrapper.",
	system: `You are a Nimbus internal-tools coding agent.
Inspect the workspace with list_files, search_code, and read_file before answering.
When changing code, stay inside the workspace. Run allowlisted commands only.`,
	tools: kits.coding.tools({ rootDir }),
	mutatingTools: ["write_file", "run_command"],
	policies: [
		policy.allowTools(["list_files", "read_file", "search_code", "write_file", "run_command"]),
		policy.maxToolCalls(12),
	],
});
