---
name: Orval date-typed columns produce JS Date, not string
description: Type mismatch between Orval/Zod-generated request types and Drizzle `date`-mode DB columns; requires manual conversion.
---

When a Drizzle column is declared as SQL `date` (string, `YYYY-MM-DD`), but the OpenAPI schema field type is `format: date`, Orval's Zod codegen generates `zod.coerce.date()` for it — producing a JS `Date` object at runtime, not the string Drizzle expects for a `date`-mode column.

**Why:** Orval's default codegen mapping for `format: date` targets `Date`, with no awareness of the DB driver's storage mode for that column.

**How to apply:** For any route handler that inserts/updates a `date`-mode Drizzle column from a Zod-validated request body, add an explicit conversion (e.g. `date.toISOString().slice(0, 10)` or an equivalent `toDateString`-style helper) before passing the value to Drizzle. Don't assume the generated type already matches the column's storage type — check any column typed as SQL `date` (not `timestamp`) for this mismatch.
