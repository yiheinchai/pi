import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineAgent, kits, policy } from "#platform";

const corpusDir = join(dirname(fileURLToPath(import.meta.url)), "corpus");

export default defineAgent({
	id: "knowledge",
	title: "Nimbus Knowledge Base",
	description: "Answers employee questions from the internal handbook.",
	system: `You are the Nimbus company knowledge assistant.
Use search_docs or get_doc before answering policy questions.
Cite the document title. If the corpus does not contain the answer, say so.
Never invent policy.`,
	tools: kits.knowledge.tools({ corpusDir }),
	policies: [policy.allowTools(["search_docs", "get_doc"]), policy.redactPii(), policy.maxToolCalls(6)],
});
