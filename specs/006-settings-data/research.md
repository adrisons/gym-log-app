# Research: Settings, Export and Import

## 1. Closing the D9/ADR-0005 seed-catalogue gap

**Discovery**: `docs/decisions/ADR-0005-seed-exercise-catalogue.md` is
`Status: Accepted` and `docs/requirements.md` D9 is `Closed`, but no code
in `src/` seeds anything. `src/presentation/main.tsx`'s `mount()` wires a
storage adapter and configures it; nothing calls
`listExercises()`/`saveExercise()` at startup. A fresh install today has
an empty catalogue, contradicting D9's "no true empty state" guarantee.

**Decision**: Add `src/application/catalogue/seed-exercises.ts` exporting
`buildSeedCatalogue(): Exercise[]` (fresh `crypto.randomUUID()` ids per
call, per ADR-0005/`specs/001-log-a-session/research.md` §2's existing
per-install id-generation precedent) and wire it into `main.tsx`: after
`configure()`, check `storage.listExercises()`; if empty, seed via a
sequence of `saveExercise()` calls (first-run only — ADR-0005: "does not
re-seed on later launches" — the empty check itself is what encodes that).
This is a pre-existing, already-decided requirement (D9), not new scope;
it is done here because FR-016 (delete-everything) is the first place a
missing seed catalogue would be an observable, testable bug, and because
`resetToFreshInstall` (§2 below) needs the same seed-builder as its
argument.

**Seed list scope**: twelve common strength exercises covering the major
movement patterns (squat, hinge, horizontal/vertical push, horizontal/
vertical pull, lunge, core) — enough for FR-1's "most-used and recent
first" ordering and §5.5's aggregate-trend pattern grouping to have real
data from first launch, without trying to be exhaustive (ADR-0005: "will
not match every training style," mitigated by full editability).

**Alternatives considered**: leaving the gap for a separate, later fix —
rejected, since FR-016's acceptance scenario ("exercise catalogue is
restored to the seed set") is untestable without it and this spec's own
`/speckit-implement` would otherwise ship a failing acceptance scenario
against already-Accepted, in-scope behavior.

## 2. Atomic bulk write (FR-011) per adapter

**Decision**: Two new `StoragePort` methods, `importBulk` and
`resetToFreshInstall` (contracts/storage-port-additions.md), each
implemented per-adapter with the technique already best suited to that
adapter's real transaction primitives:

- **`InMemoryStorageAdapter`**: trivially atomic — synchronous `Map`
  mutations inside one `async` method body, no `await` between them, so
  nothing else can observe a partial state.
- **`IndexedDbStorageAdapter` (Dexie)**: `this.#db.transaction('rw', [sessions, exercises, draft, bandLabels, settings, meta], async () => {...})` —
  the exact pattern `mergeExercises`/`deleteExerciseCascade` already use
  for their own cross-table atomicity. Genuinely atomic at the browser's
  own guarantee; no new technique.
- **`FileSystemStorageAdapter`**: the File System Access API has no
  cross-file transaction or atomic directory rename. Each individual
  `createWritable()`/`write()`/`close()` is atomic *per file* (existing
  precedent), but nothing makes five files (session files, `exercises.json`,
  `draft.json`, `band-labels.json`, `settings.json`, `_meta.json`) commit
  together. **Write-ahead journal**: write the entire bulk payload as one
  new file, `_pending-bulk-write.json` (one atomic single-file write);
  then apply each target file write sequentially from that journal;
  delete the journal only once every target write has succeeded. On the
  next `#checkSchema()` (already run before every operation), if
  `_pending-bulk-write.json` is present, replay it — re-applying the same
  target-file writes is idempotent, so a launch that finds a stale journal
  (the app closed mid-import) finishes the interrupted write instead of
  leaving it half-applied. This is a standard WAL/journal pattern, chosen
  because it is achievable with primitives the File System Access API
  actually has (atomic single-file writes), unlike a true multi-file
  transaction, which it does not offer.

**Rationale**: satisfies FR-011's "either every one of them is applied, or
none of them is left half-applied" without inventing a synchronization
primitive the platform doesn't provide, and without weakening the
guarantee to "best effort."

**Alternatives considered**: (a) sequential per-file writes with no
journal, accepting a documented "may partially apply, user should retry"
caveat — rejected, contradicts FR-011's MUST and §6's recoverable-writes
invariant; (b) writing to a shadow directory and swapping via
`FileSystemDirectoryHandle.move()` — rejected, `move()` on a directory
handle is not broadly supported across this app's target browsers
(research: Safari/WebKit support lags); (c) IndexedDB as a durability
layer for the File System adapter's own journal — rejected, mixes two
storage mechanisms for one adapter, against `docs/stack.md`'s "one tool
per concern" (the existing `fileSystemHandle` Dexie table is a deliberate,
narrow exception already justified in spec 003, not a precedent for
storing arbitrary journal data there too).

## 3. Schema-migration extraction (FR-012)

**Decision**: extract the existing v1→v2 Exercise-template-defaults
backfill — today duplicated as `IndexedDbStorageAdapter`'s
`#migrateExerciseTemplateDefaults` and `FileSystemStorageAdapter`'s
`withTemplateDefaults` — into `src/application/schema-migration.ts`,
exporting `migrateExerciseCatalogue(exercises: Exercise[], storedVersion: number): Exercise[]`
and re-exporting `decideSchemaAction` (already in
`src/infrastructure/schema-version.ts`, which stays put — it is the
stored-version comparison, not the migration itself, and both adapters
already share it). Both adapters call the extracted function instead of
their own copy (constitution Definition of Done: "no dependency is added
that overlaps a concern already covered by an existing one" — same spirit
applies to duplicated logic). `application/data-transfer/apply-import.ts`
calls the identical function against an imported file's data, in memory,
before computing the preview (FR-012).

**Rationale**: `application` may be imported by `infrastructure`
(`docs/architecture.md`'s forbidden-edge table), so this is the only layer
both the two real adapters and the new in-memory import path can share
without a boundary violation — `infrastructure` cannot be imported by
`application`, ruling out leaving it where it is today.

## 4. Interchange format shape (FR-007/008/021/022/023)

**Decision**: one JSON object, `ExportFile`
(data-model.md), carrying `format: 'gym-log-export'`, `schemaVersion:
number` (the same `CURRENT_SCHEMA_VERSION` axis local storage already
uses — no separate interchange-only version), `exportedAt` (ISO 8601,
informational only, not used for any identity/merge decision), and one
array/record per record kind already in `StoragePort`
(`sessions`, `exerciseCatalogue`, `bandLabels?`, `settings?`,
`loggingDraft?`). Every `ExerciseEntry.exerciseId` reference is
accompanied by a denormalized `exerciseName` string purely for
readability (FR-008/FR-022) — the id remains the sole field FR-010's
identity matching uses on import, so a rename between export and import
never causes a false non-match. No field is renamed or reshaped from the
domain's own vocabulary (`Session`, `Block`, `ExerciseEntry`, `Set`,
`Load`, `Volume`, `Effort` field names carry through verbatim) — this is
what FR-021 (additive-compatible) and FR-022 (LLM-legible) both actually
require: a future optional field or catalogue `discipline` value is a
normal, already-supported JSON addition, not a format redesign, and an
LLM reading the file sees the same vocabulary a human reading
`docs/requirements.md` §3 does.

**Rationale**: reusing the local schema-version axis (rather than a
second interchange-format version) is what spec.md's own Context section
already commits to ("the interchange file carries its own copy of that
same schema version number") — this research entry just fixes the
concrete JSON shape that follows from it.

## 5. Tabular (CSV) export (FR-009)

**Decision**: one row per `Set`, columns: `sessionDate, sessionNotes,
blockName, blockType, exerciseName, movementPattern, setKind, volumeKind,
volumeValue, loadKind, loadValue, loadUnit, effort, completed`. RFC
4180-style quoting (wrap in `"..."`, double any embedded `"`) hand-rolled
in `tabular-export.ts` — no dependency (`docs/stack.md` "Not without an
ADR": a second library for a concern this simple doesn't clear that bar).
One-way only (spec.md Non-Goals/Assumptions already settle this — no
import path is built for it).

**Alternatives considered**: a full CSV library (e.g. `papaparse`) —
rejected as a dependency for what RFC 4180 quoting alone (no dialect
negotiation, no streaming, fixed column set) does not need.

## 6. AI-agent-readability verification (SC-008)

**Decision**: SC-008 ("a general-purpose AI assistant can correctly state
a spot-checked session's date, exercises, and load/reps from the raw JSON
alone") is verified manually once during implementation — paste a sample
export produced by a component/integration test fixture into a
general-purpose LLM chat and confirm the three facts — and the outcome is
recorded in quickstart.md. No automated LLM-in-the-loop test is added to
CI (would introduce a live external dependency, against invariant 1 and
the constitution's Escalation section on outbound network calls).

## 7. Settings defaults and `firstDayOfWeek` values (FR-001, FR-018)

**Decision**: `Settings` (data-model.md) defaults to `{ defaultUnit: 'kg',
quickIncrements: { durationSeconds: 5, distanceMetres: 5 }, theme:
'system', firstDayOfWeek: 'monday' }` — matching D4's existing kg default
and spec 005's own documented ISO/Monday provisional default exactly, so
shipping this feature changes no existing user-visible behavior until a
user actively changes a setting. `firstDayOfWeek` is a two-value union
(`'monday' | 'sunday'`) — the two conventions in real use among this
app's plausible users, and the only two spec.md's own acceptance scenario
(User Story 3, Scenario 4) exercises; a fuller 7-day picker is not
requested by any FR and would be speculative scope.

`quickIncrements` covers duration (seconds) and distance (metres) only —
FR-3 (`docs/requirements.md`) is explicit that weight has "no dedicated
quick-increment buttons," so a weight increment setting would configure a
control that does not exist.
