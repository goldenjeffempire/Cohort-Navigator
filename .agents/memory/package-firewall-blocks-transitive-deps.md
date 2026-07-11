---
name: Package firewall can block transitive dependencies mid-install
description: A direct pnpm add can still fail if a transitive dependency's registry download is blocked by the workspace's package firewall.
---

Installing `@xenova/transformers` (for local ONNX embedding models) failed
with `ERR_PNPM_FETCH_403` on a transitive dependency (`protobufjs`) via
`http://package-firewall.replit.local` — not the top-level package itself.
The install partially wrote `pnpm-lock.yaml` before failing.

**Why:** the workspace's package firewall allow-lists registries/packages;
a heavy package can pull in transitive deps that aren't allow-listed even
when the top-level package resolves fine.

**How to apply:** if a `pnpm add` fails partway with a firewall 403 on some
unrelated sub-dependency, don't retry — `git checkout` the touched
`package.json`/`pnpm-lock.yaml` to fully revert, then use a dependency-free
alternative (e.g. a hand-rolled feature-hashing / hashing-trick embedding
instead of a neural encoder package) if one exists for the use case.
