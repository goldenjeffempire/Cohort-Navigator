---
name: lib/db composite TS project staleness
description: Why a dependent package's typecheck can't see newly added lib/db schema exports until a root build runs.
---

`lib/db` (and similar shared libs in the pnpm monorepo) use TypeScript composite project references with pre-built `.d.ts` output, not a manual build script tied into each dev loop. After adding new schema files/exports to `lib/db`, a dependent package's typecheck (e.g. `@workspace/api-server`) can still see the OLD declaration output and fail to resolve the new exports.

**Why:** Composite project references cache declaration output; it's only regenerated when TypeScript's build orchestration (`tsc --build`) actually reruns for that project, not automatically on every dependent typecheck.

**How to apply:** After adding/renaming exports in `lib/db` (or another composite-referenced lib), run the root `pnpm run typecheck:libs` (root `tsc --build`) once before typechecking or trusting errors in a dependent package. If a dependent package reports "module has no exported member X" right after a lib change, suspect staleness before assuming a real bug.
