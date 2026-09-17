# Enterprise platform (this fork)

This repository is a git fork of [earendil-works/pi](https://github.com/earendil-works/pi).

The enterprise agent platform lives in [`enterprise/`](enterprise/README.md). It is an isolated npm project on top of Pi's `Agent` / `AgentTool` APIs so `git merge upstream/main` does not fight platform code.

Customer support is one of the sample agents. The same `defineAgent` SDK is used for knowledge, sales, and internal-tools coding agents.

```bash
cd enterprise
npm install --ignore-scripts
npx tsx src/cli.ts run knowledge -- "What is the PTO policy?"
```
