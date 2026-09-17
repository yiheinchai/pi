# Adding an agent

The platform is intentionally small. An agent is one `defineAgent` module plus whatever data those tools need.

## 1. Scaffold

From `enterprise/`:

```bash
npx tsx src/cli.ts new my-agent --template knowledge
```

Templates: `blank`, `knowledge`, `sales`, `support`, `internal-tools`.

This writes `agents/my-agent/agent.ts`. The CLI loads every `agents/*/agent.ts` file.

## 2. Minimum file

```ts
import { defineAgent, tool, policy } from "#platform";
import { Type } from "typebox";

export default defineAgent({
  id: "my-agent",
  title: "My agent",
  description: "One sentence for the catalog and HTTP console.",
  system: "Who you are, when to call tools, and when to refuse.",
  tools: [
    tool({
      name: "hello",
      label: "Hello",
      description: "Return a greeting.",
      parameters: Type.Object({ name: Type.String() }),
      execute({ name }) {
        return `hello ${name}`;
      },
    }),
  ],
  policies: [policy.allowTools(["hello"])],
});
```

`tool()` is a thin wrapper around Pi `AgentTool`. You can also pass a raw `AgentTool`.

## 3. Reuse a kit instead of starting from zero

| Kit | Tools | Data |
| --- | --- | --- |
| `kits.knowledge` | `search_docs`, `get_doc` | directory of `.md` files |
| `kits.sales` | `lookup_account`, `list_pipeline`, `create_opportunity`, `log_activity` | JSON CRM |
| `kits.support` | `lookup_ticket`, `search_kb`, `create_ticket`, `update_ticket` | tickets JSON + markdown KB |
| `kits.coding` | `list_files`, `read_file`, `search_code`, `write_file`, `run_command` | a workspace directory |

Mark mutating tools on the definition (`mutatingTools`) so `policy.readonly` or `policy.requireConfirmation` can target them.

## 4. Policy

Policies run on Pi's `beforeToolCall` / `afterToolCall` hooks:

- `policy.allowTools(names)` / `policy.denyTools(names)`
- `policy.maxToolCalls(n)`
- `policy.redactPii()`
- `policy.readonly(mutatingNames)`
- `policy.requireConfirmation(mutatingNames, confirm)`

Every successful or blocked call is appended to `runtime.auditLog`.

## 5. Run it

```bash
npx tsx src/cli.ts run my-agent -- "hello"
npx tsx src/cli.ts serve
```

The HTTP console is generic: it lists every agent. There is no product-specific storefront.

## 6. Live models

Default is the mock `streamFn` (no API keys, still executes tools through Pi). For a real model:

```bash
export ENTERPRISE_PI_MODE=live
export ENTERPRISE_PI_PROVIDER=openai
export ENTERPRISE_PI_MODEL=gpt-4o-mini
export OPENAI_API_KEY=...
```

The live path uses `@earendil-works/pi-ai/compat` `streamSimple`.
