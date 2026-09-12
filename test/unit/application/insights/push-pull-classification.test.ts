import { describe, expect, it } from 'vitest';
import { classifyMovementPattern } from '@/application/insights/push-pull-classification';

describe('classifyMovementPattern', () => {
  it('classifies push keywords, including as a word inside a longer pattern', () => {
    expect(classifyMovementPattern('Press')).toBe('push');
    expect(classifyMovementPattern('close-grip bench press')).toBe('push');
  });

  it('classifies pull keywords', () => {
    expect(classifyMovementPattern('Row')).toBe('pull');
    expect(classifyMovementPattern('horizontal pull')).toBe('pull');
  });

  it('does not match a substring that is not a whole word', () => {
    expect(classifyMovementPattern('compression')).toBe('unclassified');
  });

  it('is case/accent-insensitive', () => {
    expect(classifyMovementPattern('PRESS')).toBe('push');
    expect(classifyMovementPattern('préss')).toBe('push'); // diacritic-stripped to "press"
  });

  it('returns unclassified for an absent or unrecognized pattern', () => {
    expect(classifyMovementPattern(undefined)).toBe('unclassified');
    expect(classifyMovementPattern('squat')).toBe('unclassified');
    expect(classifyMovementPattern('hinge')).toBe('unclassified');
  });
});
