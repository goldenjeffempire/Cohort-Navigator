---
name: Admin bootstrap via first JIT-provisioned user
description: Pattern for bootstrapping the first admin in a Clerk + local-users-table RBAC setup without a manual seeding step.
---

When RBAC is implemented as a local `users.role` column (not Clerk metadata) and users are JIT-provisioned into the local table on their first authenticated request, bootstrap the very first admin by making the JIT-provisioning logic check `count(*)` on the users table: if it's 0, the new user becomes `admin`; otherwise they default to `student` unless Clerk `publicMetadata.role` says `mentor`/`admin`, or an existing admin promotes them via a role-update endpoint.

**Why:** There's no seed-time admin account possible, because real Clerk sign-ins are the only way local user rows get created — seeding a fake user row would desync from Clerk's actual user IDs. This gives every fresh deployment a working admin without manual DB surgery, as long as the first real sign-in is treated specially.

**How to apply:** Whenever this pattern is present, seed scripts must NEVER pre-insert rows into the users table (or any table with a user-count-dependent bootstrap check) — doing so breaks the "first user becomes admin" guarantee. Seed only catalog/content data that doesn't require a real user FK.
