import { describe, it, expect } from 'vitest';
import {
  computeCompositeScore,
  getRatingLabel,
  getRatingTextClass,
  scoreToPct,
  STANDARD_DIMENSIONS,
} from '../lib/scoring';
import type { RatingDimension } from '../lib/scoring';

describe('computeCompositeScore', () => {
  it('returns 0 for empty dimensions', () => {
    expect(computeCompositeScore([])).toBe(0);
  });

  it('returns 0 when all weights are 0', () => {
    const dims: RatingDimension[] = [{ id: 'a', label: 'A', weight: 0, score: 4 }];
    expect(computeCompositeScore(dims)).toBe(0);
  });

  it('computes correctly for single dimension', () => {
    const dims: RatingDimension[] = [{ id: 'a', label: 'A', weight: 1, score: 4.5 }];
    expect(computeCompositeScore(dims)).toBe(4.5);
  });

  it('computes weighted average correctly', () => {
    const dims: RatingDimension[] = [
      { id: 'a', label: 'A', weight: 0.5, score: 4.0 },
      { id: 'b', label: 'B', weight: 0.5, score: 5.0 },
    ];
    expect(computeCompositeScore(dims)).toBe(4.5);
  });

  it('handles unequal weights', () => {
    const dims: RatingDimension[] = [
      { id: 'a', label: 'A', weight: 0.75, score: 4.0 },
      { id: 'b', label: 'B', weight: 0.25, score: 5.0 },
    ];
    // (4.0 * 0.75 + 5.0 * 0.25) / 1.0 = 4.25
    expect(computeCompositeScore(dims)).toBe(4.3); // rounded to 1 dp
  });

  it('rounds to 1 decimal place', () => {
    const dims: RatingDimension[] = [
      { id: 'a', label: 'A', weight: 1, score: 4.333 },
    ];
    expect(computeCompositeScore(dims)).toBe(4.3);
  });
});

describe('getRatingLabel', () => {
  it('returns Excellent for 4.5+', () => {
    expect(getRatingLabel(4.5)).toBe('Excellent');
    expect(getRatingLabel(5.0)).toBe('Excellent');
  });

  it('returns Very Good for 4.0–4.4', () => {
    expect(getRatingLabel(4.0)).toBe('Very Good');
    expect(getRatingLabel(4.4)).toBe('Very Good');
  });

  it('returns Good for 3.5–3.9', () => {
    expect(getRatingLabel(3.5)).toBe('Good');
    expect(getRatingLabel(3.9)).toBe('Good');
  });

  it('returns Average for 3.0–3.4', () => {
    expect(getRatingLabel(3.0)).toBe('Average');
    expect(getRatingLabel(3.4)).toBe('Average');
  });

  it('returns Below Average for 2.0–2.9', () => {
    expect(getRatingLabel(2.0)).toBe('Below Average');
  });

  it('returns Poor for < 2.0', () => {
    expect(getRatingLabel(1.0)).toBe('Poor');
  });
});

describe('getRatingTextClass', () => {
  it('returns emerald for 4.5+', () => {
    expect(getRatingTextClass(4.5)).toContain('emerald');
  });

  it('returns red for low scores', () => {
    expect(getRatingTextClass(1.5)).toContain('red');
  });
});

describe('scoreToPct', () => {
  it('converts 5/5 to 100%', () => {
    expect(scoreToPct(5)).toBe(100);
  });

  it('converts 0/5 to 0%', () => {
    expect(scoreToPct(0)).toBe(0);
  });

  it('converts 2.5/5 to 50%', () => {
    expect(scoreToPct(2.5)).toBe(50);
  });
});

describe('STANDARD_DIMENSIONS', () => {
  it('has 6 dimensions', () => {
    expect(STANDARD_DIMENSIONS).toHaveLength(6);
  });

  it('weights sum to 1', () => {
    const total = STANDARD_DIMENSIONS.reduce((sum, d) => sum + d.weight, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('all dimensions have unique ids', () => {
    const ids = STANDARD_DIMENSIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
