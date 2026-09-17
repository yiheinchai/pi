# Merging upstream Pi

This repository is a GitHub fork of [`earendil-works/pi`](https://github.com/earendil-works/pi).

```
origin    https://github.com/<you>/pi.git
upstream  https://github.com/earendil-works/pi.git
```

## Rule

Put enterprise work in `enterprise/` only.

Do not edit `packages/`, root `package.json`, lockfiles, or other upstream files unless you are contributing that change back to Pi. Those paths are the merge conflict surface.

`enterprise/` is **not** an npm workspace of the Pi monorepo. It has its own `package.json` and depends on published `@earendil-works/pi-agent-core` and `@earendil-works/pi-ai`.

## Merge

From the repository root:

```bash
./enterprise/scripts/merge-upstream.sh
```

or:

```bash
git fetch upstream
git merge upstream/main
```

If a conflict appears in `enterprise/`, it is yours. If a conflict appears in `packages/`, you (or a previous patch) edited upstream code — revert that approach.

## Versioning Pi

When you want a newer runtime without waiting for a merge:

```bash
cd enterprise
npm install @earendil-works/pi-agent-core@latest @earendil-works/pi-ai@latest --ignore-scripts
```

Keep the git fork current anyway so you can read and, if needed, vendor patches from `packages/agent`.

## Node engines

Upstream Pi currently requires Node `>=22.19`. This environment may be slightly older. The enterprise project sets `engine-strict=false` and runs against the published packages. Prefer Node 22.19+ in production.
