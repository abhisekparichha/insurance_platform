export type ProductCategory = "health_base" | "health_topup" | "life_term" | "motor_pvt_car" | "motor_two_wheeler";

// Health base plan weights — informed by Ditto (room_rent #1 at 14% of total,
// disease_sublimits #2 at 10%, recharge #3 at 8%) and Beshak coverage research.
// topup_friendliness is excluded: base plans do not participate in top-up mechanics.
export const HEALTH_BASE_WEIGHTS: Record<string, number> = {
  room_rent: 0.22,
  disease_sublimits: 0.14,
  copay: 0.12,
  waiting_periods: 0.10,
  recharge: 0.10,
  pre_post: 0.08,
  ncb: 0.07,
  daycare: 0.06,
  ayush: 0.05,
  domiciliary: 0.04,
  sublimits: 0.02
} as const;

// Health top-up / super top-up weights — aggregate vs per-claim deductible structure
// is the central value bet (Beshak: #1 for top-up). Room rent rules matter because
// they determine proportionate exposure when the top-up activates.
export const HEALTH_TOPUP_WEIGHTS: Record<string, number> = {
  topup_friendliness: 0.28,
  room_rent: 0.18,
  copay: 0.12,
  waiting_periods: 0.10,
  recharge: 0.08,
  pre_post: 0.07,
  ncb: 0.06,
  daycare: 0.05,
  ayush: 0.03,
  domiciliary: 0.02,
  sublimits: 0.01
} as const;

// Term life weights — insurer reliability dominates (Ditto: CSR + ASR + solvency +
// complaints gives a 360° view). Riders and plan flexibility are the key product
// differentiators. Beshak: ASR outranks CSR because an insurer can settle 99% of
// small claims while rejecting high-value ones.
export const LIFE_TERM_WEIGHTS: Record<string, number> = {
  claim_settlement_ratio: 0.20,
  amount_settlement_ratio: 0.18,
  solvency_ratio: 0.15,
  riders_quality: 0.15,
  complaint_volume: 0.12,
  plan_flexibility: 0.12,
  premium_competitiveness: 0.08
} as const;

// Motor private car weights. Zero depreciation is the #1 differentiator because
// it eliminates depreciation deductions on all replaced parts, turning a 40-60%
// shortfall claim into a full-value settlement. IDV adequacy determines total-loss
// and theft payouts. Engine protection is critical in flood-prone regions.
export const MOTOR_PVT_CAR_WEIGHTS: Record<string, number> = {
  zero_depreciation: 0.22,
  idv_adequacy: 0.20,
  engine_protection: 0.15,
  consumables_cover: 0.12,
  insurer_reliability: 0.08,
  ncb_protection: 0.08,
  return_to_invoice: 0.08,
  roadside_assistance: 0.07
} as const;

// Motor 2-wheeler weights. ZD weight is higher than car (parts are expensive
// relative to low IDV). Personal accident cover for rider + pillion is a strong
// differentiator. RSA has outsized utility for solo riders.
export const MOTOR_TWO_WHEELER_WEIGHTS: Record<string, number> = {
  zero_depreciation: 0.25,
  idv_adequacy: 0.20,
  personal_accident: 0.18,
  ncb_protection: 0.12,
  roadside_assistance: 0.10,
  consumables_cover: 0.08,
  insurer_reliability: 0.07
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
