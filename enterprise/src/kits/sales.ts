import { readFileSync } from "node:fs";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import { jsonResult, tool } from "../tool.ts";

export interface Account {
	id: string;
	name: string;
	tier: "enterprise" | "mid-market" | "smb";
	owner: string;
	arr: number;
	region: string;
}

export interface Opportunity {
	id: string;
	accountId: string;
	name: string;
	amount: number;
	stage: string;
	closeDate: string;
}

export interface Activity {
	id: string;
	accountId: string;
	note: string;
	at: string;
}

export interface CrmData {
	accounts: Account[];
	opportunities: Opportunity[];
	activities: Activity[];
}

export function loadCrmData(path: string): CrmData {
	return JSON.parse(readFileSync(path, "utf8")) as CrmData;
}

function cloneCrm(data: CrmData): CrmData {
	return structuredClone(data);
}

export function createSalesTools(options: { data: CrmData } | { dataPath: string }): AgentTool[] {
	const store = cloneCrm("data" in options ? options.data : loadCrmData(options.dataPath));
	let opportunitySeq = store.opportunities.length + 1;
	let activitySeq = store.activities.length + 1;

	return [
		tool({
			name: "lookup_account",
			label: "Lookup account",
			description: "Find a customer account by name or id.",
			parameters: Type.Object({
				query: Type.String({ description: "Account name or id fragment" }),
			}),
			execute({ query }) {
				const needle = query.toLowerCase();
				const accounts = store.accounts.filter(
					(account) => account.id.toLowerCase().includes(needle) || account.name.toLowerCase().includes(needle),
				);
				const related = store.opportunities.filter((item) => accounts.some((account) => account.id === item.accountId));
				return jsonResult({ accounts, opportunities: related });
			},
		}),
		tool({
			name: "list_pipeline",
			label: "List pipeline",
			description: "List open sales opportunities and total pipeline amount.",
			parameters: Type.Object({}),
			execute() {
				const total = store.opportunities.reduce((sum, item) => sum + item.amount, 0);
				return jsonResult({ opportunities: store.opportunities, total });
			},
		}),
		tool({
			name: "create_opportunity",
			label: "Create opportunity",
			description: "Create a sales opportunity on an account.",
			parameters: Type.Object({
				accountId: Type.String(),
				name: Type.String(),
				amount: Type.Number(),
				stage: Type.Optional(Type.String()),
				closeDate: Type.Optional(Type.String()),
			}),
			execute({ accountId, name, amount, stage, closeDate }) {
				const account = store.accounts.find((item) => item.id === accountId);
				if (!account) {
					throw new Error(`Unknown account ${accountId}`);
				}
				const opportunity: Opportunity = {
					id: `opp-${opportunitySeq++}`,
					accountId,
					name,
					amount,
					stage: stage ?? "qualify",
					closeDate: closeDate ?? new Date().toISOString().slice(0, 10),
				};
				store.opportunities.push(opportunity);
				return jsonResult(opportunity);
			},
		}),
		tool({
			name: "log_activity",
			label: "Log activity",
			description: "Record a sales activity on an account.",
			parameters: Type.Object({
				accountId: Type.String(),
				note: Type.String(),
			}),
			execute({ accountId, note }) {
				const account = store.accounts.find((item) => item.id === accountId);
				if (!account) {
					throw new Error(`Unknown account ${accountId}`);
				}
				const activity: Activity = {
					id: `act-${activitySeq++}`,
					accountId,
					note,
					at: new Date().toISOString(),
				};
				store.activities.push(activity);
				return jsonResult(activity);
			},
		}),
	];
}
