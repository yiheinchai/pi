export default `import { defineAgent, tool } from "../../src/index.ts";
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
`;
