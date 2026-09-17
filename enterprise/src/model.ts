import type { Model } from "@earendil-works/pi-ai";

export const MOCK_MODEL: Model<"openai-responses"> = {
	id: "enterprise-mock",
	name: "Enterprise Mock",
	api: "openai-responses",
	provider: "openai",
	baseUrl: "",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128000,
	maxTokens: 4096,
};

export function envFlag(name: string): string | undefined {
	const value = process.env[name];
	if (!value || value.trim() === "") {
		return undefined;
	}
	return value.trim();
}

export function hasLiveCredentials(): boolean {
	return Boolean(
		envFlag("ANTHROPIC_API_KEY") ||
			envFlag("OPENAI_API_KEY") ||
			envFlag("GEMINI_API_KEY") ||
			envFlag("OPENROUTER_API_KEY") ||
			envFlag("ENTERPRISE_PI_API_KEY"),
	);
}

export function resolveMode(requested?: "mock" | "live"): "mock" | "live" {
	if (requested) {
		return requested;
	}
	const fromEnv = envFlag("ENTERPRISE_PI_MODE");
	if (fromEnv === "live" || fromEnv === "mock") {
		return fromEnv;
	}
	return hasLiveCredentials() ? "live" : "mock";
}
