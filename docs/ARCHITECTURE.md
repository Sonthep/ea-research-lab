# Architecture

`apps/web` is a Next.js App Router client with modular features, typed API contracts and reusable shadcn/ui components. `apps/api` separates routes, schemas, persistence models, importer service, XML parser and canonicalization helpers. PostgreSQL is the Compose database; SQLite is an explicit native development option. There is no runtime migration-on-import or silent table creation.

Import flow: bounded multipart file → safe SpreadsheetML parse → metadata validation → parameter canonicalization → full-hash reuse → run/results inserts → transaction commit. Any error rolls back the entire import. Same file bytes return HTTP 409 with the original run ID; concurrent uniqueness conflicts return 409 and may be retried.

Explorer flow: validated filter conditions and allowlisted sorting → SQL joins/indexed metrics → count + bounded page → typed frontend rows. Core metric filtering/sorting is server-side. Dynamic input columns display canonical values; text search includes parameter JSON. Pagination supports up to 200 results per request. Parameter-set history is capped at 50 with Explorer available for complete browsing. Runs, imports and candidates are paginated too.

Eight-character Set labels are presentation only: FK IDs and the full unique hash resolve identity. Candidate baseline results stay attached to their original run and deposit.

XML imports use iterparse and cleared row elements; normalized records are held for the transaction. The upload is capped at 100 MB by default and 200,000 rows. Parameter creation currently involves per-new-set insertion for portable identity retrieval, while results insert in 1,000-row batches. For very large concurrent workflows, add a durable import-job worker, bulk upserts, keyset pagination and PostgreSQL JSON indexes. Heavy analytics jobs are deferred to Phase 3.

Phase 1 is for a local single-user environment. Compose binds ports to localhost. Authentication and multi-user ownership must be added before exposing it to other users.
