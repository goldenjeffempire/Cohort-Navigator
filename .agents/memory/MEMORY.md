# Memory Index

- [Admin bootstrap via first JIT-provisioned user](admin-bootstrap-jit.md) — first Clerk sign-in becomes admin; never seed users directly.
- [lib/db composite TS project staleness](lib-db-tsc-build-staleness.md) — new schema exports invisible to dependents until root `tsc --build` reruns.
- [Orval date-typed columns produce JS Date, not string](orval-date-column-mismatch.md) — manual conversion needed before Drizzle insert/update on `date`-mode columns.
