import { createCodingTools } from "./kits/coding.ts";
import { createKnowledgeTools } from "./kits/knowledge.ts";
import { createSalesTools } from "./kits/sales.ts";
import { createSupportTools } from "./kits/support.ts";

export const kits = {
	knowledge: { tools: createKnowledgeTools },
	sales: { tools: createSalesTools },
	support: { tools: createSupportTools },
	coding: { tools: createCodingTools },
};

export { createCodingTools, createKnowledgeTools, createSalesTools, createSupportTools };
