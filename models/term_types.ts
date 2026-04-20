import type { Provenance } from "./health_types";

// Insurer-level reliability metrics sourced from IRDAI public disclosures.
// Source A uses CSR + ASR + solvency + complaints as a 360° insurer view.
export interface TermInsurerMetrics {
  csr: number;                           // Claim Settlement Ratio by count (0–100)
  asr: number;                           // Amount Settlement Ratio by value (0–100)
  solvencyRatio: number;                 // e.g. 1.87 — IRDAI minimum is 1.5x
  complaintsPerTenK: number;             // Complaints per 10,000 claims filed
  claimsWithin30DaysPercent: number | null; // % of claims settled within IRDAI's 30-day mandate
}

// Rider quality is a primary product differentiator for term plans.
// Source A: CI covering 64+ illnesses = strong; ADB, WOP, Terminal Illness
// add meaningful protection at different life stages.
export interface TermRiders {
  criticalIllness: {
    covered: boolean;
    illnessCount: number | null; // number of illnesses covered; null if covered but count unknown
  };
  accidentalDeath: boolean;
  waiverOfPremium: boolean;
  terminalIllness: boolean;
}

export interface TermPlanOptions {
  wholeLifeAvailable: boolean;
  limitedPayAvailable: boolean;
  staggeredPayoutAvailable: boolean; // income-replacement payout option
  jointLifeAvailable: boolean;
}

export interface TermProduct {
  product: {
    insurer: string;
    planName: string;
    variant: string | null;
    uin: string | null;
  };
  sumInsured: {
    baseSI: number;
    currency: string;
  };
  insurer: TermInsurerMetrics;
  riders: TermRiders;
  planOptions: TermPlanOptions;
  annualPremium: number | null;      // benchmark profile premium (₹, annual)
  benchmarkPremium: number | null;   // market median for same SI/term/profile
  // Source C: upfront underwriting at policy issuance = fewer post-claim non-disclosure
  // rejections. Plans that defer underwriting to claim time carry higher dispute risk.
  upfrontMedicalUnderwriting: boolean;
  provenance: Provenance;
}
