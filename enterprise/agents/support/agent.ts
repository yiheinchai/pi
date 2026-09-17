import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineAgent, kits, policy } from "#platform";

const here = dirname(fileURLToPath(import.meta.url));

export default defineAgent({
	id: "support",
	title: "Nimbus Support",
	description: "Customer support over tickets and a help center. One enterprise app among many.",
	system: `You are a Nimbus customer-support agent.
Look up tickets with lookup_ticket and search_kb before answering.
Do not invent ticket status. Redact secrets if they appear in tool output.`,
	tools: kits.support.tools({
		dataPath: join(here, "data", "tickets.json"),
		kbDir: join(here, "kb"),
	}),
	mutatingTools: ["create_ticket", "update_ticket"],
	policies: [
		policy.allowTools(["lookup_ticket", "search_kb", "create_ticket", "update_ticket"]),
		policy.redactPii(),
		policy.maxToolCalls(8),
	],
});
