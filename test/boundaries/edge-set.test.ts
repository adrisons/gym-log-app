import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { allowedImports, forbiddenEdges } from '../../eslint.boundaries.js';

/**
 * Spec 000 FR-009 / SC-003: docs/architecture.md's forbidden-edge table and
 * the enforced eslint-plugin-boundaries config must describe the same rule.
 * eslint.boundaries.js is the single source of truth; eslint.config.js
 * builds the enforcement from it. This test parses the "Allowed to import"
 * column out of docs/architecture.md's table and asserts it matches
 * `allowedImports` exactly — zero discrepancy.
 */

const ARCHITECTURE_DOC = resolve(__dirname, '../../docs/architecture.md');

/**
 * Backtick-quoted names in an "Allowed to import" cell, e.g.
 * "`application`, `application-ports`" → ['application', 'application-ports'].
 * A cell of "(nothing internal)" or "all layers" is handled by the caller.
 */
function parseAllowedCell(cell: string): string[] {
  const names = [...cell.matchAll(/`([a-z-]+)`/g)].map((m) => m[1] as string);
  return names;
}

function parseArchitectureDocTable(markdown: string): Record<string, string[]> {
  const lines = markdown.split('\n');
  const tableStart = lines.findIndex((l) => l.startsWith('| From |'));
  if (tableStart === -1) {
    throw new Error('Forbidden-edge table not found in docs/architecture.md');
  }
  const result: Record<string, string[]> = {};
  // Skip the header and the separator row.
  for (let i = tableStart + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.startsWith('|')) break;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    const fromCell = cells[0];
    const allowedCell = cells[1];
    if (!fromCell || allowedCell === undefined) continue;
    const fromMatch = fromCell.match(/`([a-z-]+)`/);
    if (!fromMatch) continue;
    const from = fromMatch[1] as string;

    if (allowedCell.includes('all layers')) {
      // composition-root: allowed to import everything else.
      result[from] = Object.keys(allowedImports).filter((t) => t !== from);
    } else if (allowedCell.includes('nothing internal')) {
      result[from] = [];
    } else {
      result[from] = parseAllowedCell(allowedCell);
    }
  }
  return result;
}

describe('docs/architecture.md matches eslint.boundaries.js', () => {
  const docTable = parseArchitectureDocTable(
    readFileSync(ARCHITECTURE_DOC, 'utf-8'),
  );

  it('documents every element type that eslint.boundaries.js defines', () => {
    expect(Object.keys(docTable).sort()).toEqual(
      Object.keys(allowedImports).sort(),
    );
  });

  it.each(Object.keys(allowedImports))(
    'has the same allow-list for "%s"',
    (type) => {
      const fromConfig = [...(allowedImports[type] ?? [])].sort();
      const fromDoc = [...(docTable[type] ?? [])].sort();
      expect(fromDoc).toEqual(fromConfig);
    },
  );

  it('produces a non-empty forbidden-edge set (the rule is not vacuous)', () => {
    expect(forbiddenEdges().length).toBeGreaterThan(0);
  });
});
