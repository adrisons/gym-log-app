/**
 * The one-way tabular (CSV) export (spec 006 FR-009, research.md §5): one
 * row per `Set`, for the user's own analysis outside the app. Hand-rolled
 * RFC 4180-style quoting — no dependency, the format is too simple to
 * justify one (`docs/stack.md` "Not without an ADR").
 */
import type { Session } from '@/domain/session';
import type { Exercise } from '@/domain/exercise';
import type { Load } from '@/domain/load';
import type { Volume } from '@/domain/volume';

const COLUMNS = [
  'sessionDate',
  'sessionNotes',
  'blockName',
  'blockType',
  'exerciseName',
  'movementPattern',
  'setKind',
  'volumeKind',
  'volumeValue',
  'loadKind',
  'loadValue',
  'loadUnit',
  'effort',
  'completed',
] as const;

function quoteCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function volumeValue(volume: Volume | undefined): string {
  if (!volume) return '';
  if (volume.kind === 'reps') return String(volume.count);
  if (volume.kind === 'duration') return String(volume.seconds);
  return String(volume.metres);
}

function loadValue(load: Load): string {
  if (load.kind === 'weight') return String(load.value);
  if (load.kind === 'band') return load.label;
  if (load.kind === 'bodyweight') {
    return load.addedOrAssistedKg !== undefined
      ? String(load.addedOrAssistedKg)
      : '';
  }
  if (load.kind === 'freeText') return load.text;
  return '';
}

function loadUnit(load: Load): string {
  return load.kind === 'weight' ? load.unit : '';
}

/** Builds the full CSV document, including its header row. */
export function buildTabularExport(
  sessions: Session[],
  exercises: Exercise[],
): string {
  const nameById = new Map(exercises.map((e) => [e.id, e.canonicalName]));
  const patternById = new Map(
    exercises.map((e) => [e.id, e.movementPattern ?? '']),
  );

  const rows: string[][] = [];
  for (const session of sessions) {
    const sessionDate = session.dateTime;
    for (const block of session.blocks) {
      for (const entry of block.exercises) {
        for (const set of entry.sets) {
          rows.push([
            sessionDate,
            session.notes,
            block.name ?? '',
            block.type,
            nameById.get(entry.exerciseId) ?? entry.exerciseId,
            patternById.get(entry.exerciseId) ?? '',
            set.setKind,
            set.volume?.kind ?? '',
            volumeValue(set.volume),
            set.load.kind,
            loadValue(set.load),
            loadUnit(set.load),
            set.effort !== undefined ? String(set.effort) : '',
            String(set.completed),
          ]);
        }
      }
    }
  }

  const lines = [COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(row.map(quoteCsvField).join(','));
  }
  return lines.join('\n');
}
