import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import { jsonResult, tool } from "../tool.ts";

const SKIP_DIR_NAMES = new Set(["node_modules", ".git", "dist", "coverage"]);
const TEXT_EXTENSIONS = new Set([".ts", ".js", ".mjs", ".cjs", ".json", ".md", ".txt", ".yml", ".yaml", ".toml", ".css", ".html"]);

export interface CodingKitOptions {
	rootDir: string;
	allowCommands?: RegExp[];
	maxFileBytes?: number;
}

function assertInsideRoot(rootDir: string, requested: string): string {
	const root = resolve(rootDir);
	const target = resolve(root, requested);
	const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
	if (target !== root && !target.startsWith(prefix)) {
		throw new Error(`Path ${requested} is outside the workspace`);
	}
	return target;
}

function listFiles(rootDir: string, current: string, out: string[]): void {
	for (const name of readdirSync(current)) {
		if (SKIP_DIR_NAMES.has(name)) continue;
		const full = join(current, name);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			listFiles(rootDir, full, out);
			continue;
		}
		out.push(relative(rootDir, full).split(sep).join("/"));
	}
}

function extensionOf(path: string): string {
	const index = path.lastIndexOf(".");
	return index === -1 ? "" : path.slice(index).toLowerCase();
}

export const DEFAULT_COMMAND_ALLOWLIST = [
	/^(git status|git diff|git log -1)$/,
	/^(npm test|npm run lint)$/,
	/^node --check( [\w./-]+)+$/,
	/^ls( -la)?$/,
];

function runAllowedCommand(cwd: string, command: string, allow: RegExp[], signal?: AbortSignal): Promise<{ stdout: string; stderr: string; code: number }> {
	if (!allow.some((pattern) => pattern.test(command))) {
		throw new Error(`Command is not on the allowlist: ${command}`);
	}
	return new Promise((resolvePromise, reject) => {
		const child = spawn(command, {
			cwd,
			shell: true,
			signal,
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
		child.on("error", reject);
		child.on("close", (code) => {
			resolvePromise({
				stdout: Buffer.concat(stdout).toString("utf8"),
				stderr: Buffer.concat(stderr).toString("utf8"),
				code: code ?? 1,
			});
		});
	});
}

export function createCodingTools(options: CodingKitOptions): AgentTool[] {
	const rootDir = resolve(options.rootDir);
	const allowCommands = options.allowCommands ?? DEFAULT_COMMAND_ALLOWLIST;
	const maxFileBytes = options.maxFileBytes ?? 200_000;

	return [
		tool({
			name: "list_files",
			label: "List files",
			description: "List text files in the internal-tool workspace.",
			parameters: Type.Object({
				path: Type.Optional(Type.String({ description: "Relative directory, default ." })),
			}),
			execute({ path }) {
				const start = assertInsideRoot(rootDir, path ?? ".");
				const files: string[] = [];
				const stat = statSync(start);
				if (stat.isFile()) {
					files.push(relative(rootDir, start).split(sep).join("/"));
				} else {
					listFiles(rootDir, start, files);
				}
				return jsonResult({ files });
			},
		}),
		tool({
			name: "read_file",
			label: "Read file",
			description: "Read a file from the workspace.",
			parameters: Type.Object({
				path: Type.String(),
			}),
			execute({ path }) {
				const full = assertInsideRoot(rootDir, path);
				const stat = statSync(full);
				if (stat.size > maxFileBytes) {
					throw new Error(`File ${path} is larger than ${maxFileBytes} bytes`);
				}
				const text = readFileSync(full, "utf8");
				return jsonResult({ path, text }, text);
			},
		}),
		tool({
			name: "search_code",
			label: "Search code",
			description: "Search workspace files for a string or regular expression.",
			parameters: Type.Object({
				query: Type.String(),
				regex: Type.Optional(Type.Boolean()),
			}),
			execute({ query, regex }) {
				const files: string[] = [];
				listFiles(rootDir, rootDir, files);
				const pattern = regex ? new RegExp(query, "i") : undefined;
				const terms = query
					.toLowerCase()
					.split(/[^a-z0-9]+/)
					.filter((token) => token.length > 2 && !["how", "does", "the", "for", "and", "what", "who", "why"].includes(token));
				const hits: { path: string; line: number; text: string }[] = [];
				for (const file of files) {
					if (!TEXT_EXTENSIONS.has(extensionOf(file))) continue;
					const content = readFileSync(join(rootDir, file), "utf8");
					const lines = content.split(/\r?\n/);
					lines.forEach((line, index) => {
						const lower = line.toLowerCase();
						const matched = pattern
							? pattern.test(line)
							: terms.length > 0
								? terms.some((term) => lower.includes(term))
								: lower.includes(query.toLowerCase());
						if (matched) {
							hits.push({ path: file, line: index + 1, text: line.trim() });
						}
					});
				}
				return jsonResult({ hits: hits.slice(0, 50) });
			},
		}),
		tool({
			name: "write_file",
			label: "Write file",
			description: "Write a text file inside the workspace. Mutating.",
			parameters: Type.Object({
				path: Type.String(),
				content: Type.String(),
			}),
			execute({ path, content }) {
				const full = assertInsideRoot(rootDir, path);
				mkdirSync(dirname(full), { recursive: true });
				writeFileSync(full, content, "utf8");
				return jsonResult({ path, bytes: Buffer.byteLength(content) });
			},
		}),
		tool({
			name: "run_command",
			label: "Run command",
			description: "Run an allowlisted command in the workspace. Mutating if the command writes.",
			parameters: Type.Object({
				command: Type.String(),
			}),
			async execute({ command }, { signal }) {
				const result = await runAllowedCommand(rootDir, command, allowCommands, signal);
				return jsonResult(result);
			},
		}),
	];
}
