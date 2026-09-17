import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineAgent, kits, policy } from "../../src/index.ts";

const dataPath = join(dirname(fileURLToPath(import.meta.url)), "data", "crm.json");

export default defineAgent({
	id: "sales",
	title: "Nimbus Sales",
	description: "Looks up accounts, pipeline, and logs sales activity.",
	system: `You are a Nimbus sales assistant for account executives.
Use lookup_account and list_pipeline. Do not invent ARR or owners.
When creating opportunities, confirm the account id from lookup_account.`,
	tools: kits.sales.tools({ dataPath }),
	mutatingTools: ["create_opportunity", "log_activity"],
	policies: [
		policy.allowTools(["lookup_account", "list_pipeline", "create_opportunity", "log_activity"]),
		policy.redactPii(),
		policy.maxToolCalls(8),
	],
});
