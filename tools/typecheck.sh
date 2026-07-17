#!/usr/bin/env bash
# ============================================================
# TypeQuest — static type check (no build step)
#
# Runs the TypeScript compiler in check-only mode over jsconfig.json.
# checkJs is off globally; the four core modules opt in with a top-of-file
# `// @ts-check` comment and are annotated with JSDoc + js/types.d.ts.
# This catches calls to nonexistent methods (e.g. SFX.correct()), misspelled
# fields, and wrong argument counts — without any transpile or bundler.
#
# Note: `npx typescript@5 …` cannot resolve a bin named `typescript`; the
# package's binary is `tsc`, so we invoke it via `npx -p typescript@5 tsc`.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
exec npx -y -p typescript@5 tsc --noEmit -p jsconfig.json
