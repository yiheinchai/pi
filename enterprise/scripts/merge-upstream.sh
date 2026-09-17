#!/usr/bin/env bash
set -euo pipefail
# Merge earendil-works/pi into this fork without involving the enterprise platform.
# Run from the repository root (the Pi checkout), not from enterprise/.

if [[ ! -d packages/agent ]]; then
	echo "Run this from the Pi repository root." >&2
	exit 1
fi

if ! git remote get-url upstream >/dev/null 2>&1; then
	git remote add upstream https://github.com/earendil-works/pi.git
fi

git fetch upstream
git merge upstream/main

echo
echo "If you stayed inside enterprise/, conflicts should be rare."
echo "Do not resolve conflicts by rewriting packages/ unless you are contributing that change to Pi."
