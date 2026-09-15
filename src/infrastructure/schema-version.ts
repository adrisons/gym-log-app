/**
 * Re-exports `CURRENT_SCHEMA_VERSION`/`decideSchemaAction` from
 * `src/application/schema-migration.ts`, which now owns them (spec 006
 * research.md §3 — `application/data-transfer/` needs both too, and
 * `application` may not import `infrastructure`). Both real adapters keep
 * importing from `'./schema-version'` unchanged; this file only re-points
 * where the values actually live.
 */
export {
  CURRENT_SCHEMA_VERSION,
  decideSchemaAction,
  type SchemaAction,
} from '../application/schema-migration';
