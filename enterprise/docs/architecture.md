# Architecture

Enterprise Pi is a platform on top of Pi, not a second agent loop.

## Process

1. `defineAgent` validates id, tools, and mutating-tool names.
2. `createRuntime` constructs Pi `Agent` with:
   - `initialState.systemPrompt` and `initialState.tools`
   - `streamFn` (mock heuristic or live `streamSimple`)
   - composed `beforeToolCall` / `afterToolCall` from `policies`
3. `runtime.prompt(text)` calls `agent.prompt`, waits for idle, and returns text + tool records + the audit log.

No custom planner, no reimplemented tool loop.

## Isolation

```
pi/                          # git fork of earendil-works/pi
  packages/                  # upstream, do not edit
  enterprise/                # this platform (own npm project)
    src/                     # SDK, CLI, HTTP
    agents/                  # one folder per agent
    test/
```

Root `package.json` workspaces stay `packages/*`. Adding `enterprise` there would create lockfile merge conflicts.

## Kits

Kits are ordinary `AgentTool` factories. They are examples of how to wrap company systems (markdown corpus, JSON CRM, ticket store, workspace FS). Swap the bodies for real HTTP APIs without changing `defineAgent`.

## Channels

- CLI: `src/cli.ts`
- HTTP: `src/channels/http.ts` plus a generic console in `public/index.html`

Sessions are in-memory runtimes keyed by `sessionId`. Replace with Pi session backends when you need durability.

## Mock stream

`createHeuristicStreamFn` inspects the transcript, emits a matching `toolCall`, then on the next turn quotes tool output. That is enough to prove tools, policy, and agents in CI without provider keys. It is not a production model.
