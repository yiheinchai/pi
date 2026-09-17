import { approverForAmount } from "./routing.ts";

export interface ExpenseReport {
	id: string;
	employee: string;
	amountUsd: number;
}

export function routeReport(report: ExpenseReport): { reportId: string; approver: string } {
	return {
		reportId: report.id,
		approver: approverForAmount(report.amountUsd),
	};
}
