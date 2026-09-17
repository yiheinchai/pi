# Enterprise Pi

A **git fork** of [earendil-works/pi](https://github.com/earendil-works/pi) plus an isolated platform in `enterprise/`.

Pi stays Pi: `packages/` is unmodified so `git merge upstream/main` stays easy. The enterprise layer is a separate npm project that wraps Pi's `Agent`, `AgentTool`, and `beforeToolCall` / `afterToolCall` hooks.

Customer support is one application. The same platform runs knowledge, sales, generic agents, and custom internal-tool coding agents.

## Why this shape

| Approach | Upstream merges | Effort to add an agent |
| --- | --- | --- |
| Rewrite the agent loop | Hard | High |
| Patch `packages/` | Conflicts | Medium |
| **`enterprise/` on published `@earendil-works/pi-agent-core`** | Almost never | `defineAgent` + tools |

## Quick start

```bash
cd enterprise
npm install --ignore-scripts
npx tsx src/cli.ts list
npx tsx src/cli.ts run knowledge -- "What is the PTO policy?"
npx tsx src/cli.ts run internal-tools -- "How does approval routing work for a \$5000 expense?"
npx tsx src/cli.ts serve --port 8787
```

Without provider keys the runtime uses a deterministic mock `streamFn` so CI and demos still execute real Pi tool calls.

With `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` and `ENTERPRISE_PI_MODE=live`:

```bash
ENTERPRISE_PI_MODE=live ENTERPRISE_PI_PROVIDER=openai ENTERPRISE_PI_MODEL=gpt-4o-mini \
  npx tsx src/cli.ts run knowledge -- "What is the PTO policy?"
```

## Add an agent

```bash
npx tsx src/cli.ts new finance --template knowledge
```

Or write one file:

```ts
import { defineAgent, kits, policy } from "../../src/index.ts";

export default defineAgent({
  id: "finance",
  title: "Finance",
  description: "Answers from the finance corpus.",
  system: "Use search_docs before answering. Cite titles.",
  tools: kits.knowledge.tools({ corpusDir: "./corpus" }),
  policies: [policy.allowTools(["search_docs", "get_doc"]), policy.redactPii()],
});
```

See [docs/adding-an-agent.md](docs/adding-an-agent.md).

## Included agents

| id | Kind | What it proves |
| --- | --- | --- |
| `knowledge` | Company handbook | Generic Q&A over markdown, not a storefront |
| `sales` | CRM | Account lookup and pipeline tools |
| `support` | Customer service | Tickets + help center — **one** enterprise app |
| `internal-tools` | Coding agent | Reads/edits a sample internal tool (`expense-approver`) |

## Architecture

```
enterprise-pi CLI / HTTP console
        │
        ▼
 defineAgent({ tools, policies, channels })
        │
        ▼
 Pi Agent  (pi-agent-core)
   streamFn → mock or pi-ai live provider
   AgentTool.execute → your kits
   beforeToolCall / afterToolCall → policy
```

Details: [docs/architecture.md](docs/architecture.md). Upstream: [docs/merging-upstream.md](docs/merging-upstream.md) and `scripts/merge-upstream.sh`.

## Tests

```bash
cd enterprise && npm test
```
