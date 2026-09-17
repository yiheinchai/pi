import type { StreamFn } from "@earendil-works/pi-agent-core";
import type { Model } from "@earendil-works/pi-ai";
import { getModels, streamSimple } from "@earendil-works/pi-ai/compat";
import { envFlag } from "./model.ts";

export function resolveLiveModel(): Model<string> {
	const provider = envFlag("ENTERPRISE_PI_PROVIDER") ?? "openai";
	const id = envFlag("ENTERPRISE_PI_MODEL") ?? "gpt-4o-mini";
	const models = getModels(provider as never) as Model<string>[];
	const model = models.find((item) => item.id === id);
	if (!model) {
		throw new Error(`Unknown live model ${provider}/${id}. Set ENTERPRISE_PI_PROVIDER and ENTERPRISE_PI_MODEL.`);
	}
	return model;
}

export function createLiveStreamFn(): StreamFn {
	return (model, context, options) => {
		return streamSimple(model, context, options);
	};
}

export function defaultGetApiKey(provider: string): string | undefined {
	const explicit = envFlag("ENTERPRISE_PI_API_KEY");
	if (explicit) {
		return explicit;
	}
	const mapped: Record<string, string | undefined> = {
		anthropic: envFlag("ANTHROPIC_API_KEY"),
		openai: envFlag("OPENAI_API_KEY"),
		google: envFlag("GEMINI_API_KEY"),
		openrouter: envFlag("OPENROUTER_API_KEY"),
	};
	return mapped[provider];
}
