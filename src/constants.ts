export const SCORING_WEIGHTS: Record<string, number> = {
  room_rent: 0.25,
  pre_post: 0.12,
  daycare: 0.04,
  ayush: 0.04,
  domiciliary: 0.02,
  ncb: 0.07,
  recharge: 0.10,
  copay: 0.04,
  cataract: 0.04,
  waiting_periods: 0.04,
  topup_friendliness: 0.24
} as const;

export const GRADE_THRESHOLDS: { grade: "A+" | "A" | "B" | "C" | "D"; minScore: number }[] = [
  { grade: "A+", minScore: 90 },
  { grade: "A", minScore: 80 },
  { grade: "B", minScore: 70 },
  { grade: "C", minScore: 60 },
  { grade: "D", minScore: 0 }
];

export const ROOM_RENT_PERCENT_BASELINE = 1;
export const ROOM_RENT_PERCENT_INCREMENT = 5;
export const ROOM_RENT_PERCENT_MAX = 70;

export interface ScoreBand {
  rating: "Bad" | "OK" | "Good";
  minScore: number;
}

export const DEFAULT_SCORE_BANDS: ScoreBand[] = [
  { rating: "Bad", minScore: 0 },
  { rating: "OK", minScore: 60 },
  { rating: "Good", minScore: 80 }
];

export const VERSION = "1.0.0";
