/** Client-side helpers for computing and displaying insurance product ratings */

export type RatingDimension = {
  id: string;
  label: string;
  weight: number;
  score: number; // 0–5
  note?: string;
};

/**
 * Compute a weighted composite score from individual dimensions.
 * Returns a value between 0 and 5, rounded to 1 decimal place.
 */
export function computeCompositeScore(dimensions: RatingDimension[]): number {
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0);
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

/** Human label for a 0–5 score */
export function getRatingLabel(score: number): string {
  if (score >= 4.5) return 'Excellent';
  if (score >= 4.0) return 'Very Good';
  if (score >= 3.5) return 'Good';
  if (score >= 3.0) return 'Average';
  if (score >= 2.0) return 'Below Average';
  return 'Poor';
}

/** Tailwind text-color class for a 0–5 score */
export function getRatingTextClass(score: number): string {
  if (score >= 4.5) return 'text-emerald-600';
  if (score >= 4.0) return 'text-green-600';
  if (score >= 3.5) return 'text-amber-600';
  if (score >= 3.0) return 'text-orange-500';
  return 'text-red-600';
}

/** Tailwind bg-color class for progress meters */
export function getRatingBarClass(score: number): string {
  if (score >= 4.5) return 'bg-emerald-500';
  if (score >= 4.0) return 'bg-green-500';
  if (score >= 3.5) return 'bg-amber-500';
  if (score >= 3.0) return 'bg-orange-500';
  return 'bg-red-500';
}

/**
 * The 6 standard rating dimensions used across health/life/motor products.
 * Actual scores are overlaid per-product.
 */
export const STANDARD_DIMENSIONS: Omit<RatingDimension, 'score' | 'note'>[] = [
  { id: 'coverage', label: 'Coverage Breadth', weight: 0.25 },
  { id: 'claims', label: 'Claims & TAT', weight: 0.25 },
  { id: 'exclusions', label: 'Exclusions Clarity', weight: 0.15 },
  { id: 'copay', label: 'Co-pay & Room Rent', weight: 0.15 },
  { id: 'wellness', label: 'Wellness & OPD', weight: 0.10 },
  { id: 'transparency', label: 'Policy Transparency', weight: 0.10 },
];

/** Format a score as "X.X / 5" */
export function formatScore(score: number): string {
  return `${score.toFixed(1)} / 5`;
}

/** Percentage (0–100) from a 0–5 score */
export function scoreToPct(score: number): number {
  return Math.round((score / 5) * 100);
}
