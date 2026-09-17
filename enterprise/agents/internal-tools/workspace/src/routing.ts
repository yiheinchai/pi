/**
 * Approval routing for Nimbus expense reports.
 * Thresholds are also documented in the company handbook expenses article.
 */
export type Approver = "manager" | "finance" | "vp";

export function approverForAmount(amountUsd: number): Approver {
	if (amountUsd > 10_000) {
		return "vp";
	}
	if (amountUsd > 2_000) {
		return "finance";
	}
	return "manager";
}

export function needsReceipt(amountUsd: number): boolean {
	return amountUsd >= 25;
}
