import type { HealthProduct } from "../models/health_types";
import type { TermProduct } from "../models/term_types";
import type { MotorProduct } from "../models/motor_types";
import {
  DEFAULT_SCORE_BANDS,
  GRADE_THRESHOLDS,
  HEALTH_BASE_WEIGHTS,
  HEALTH_TOPUP_WEIGHTS,
  LIFE_TERM_WEIGHTS,
  MOTOR_PVT_CAR_WEIGHTS,
  MOTOR_TWO_WHEELER_WEIGHTS,
  ROOM_RENT_PERCENT_BASELINE,
  ROOM_RENT_PERCENT_INCREMENT,
  ROOM_RENT_PERCENT_MAX,
  VERSION
} from "./constants";

// ── Health scoring ────────────────────────────────────────────────────────────

export type HealthParameterKey =
  | "room_rent"
  | "pre_post"
  | "daycare"
  | "ayush"
  | "domiciliary"
  | "ncb"
  | "recharge"
  | "copay"
  | "sublimits"
  | "disease_sublimits"
  | "waiting_periods"
  | "topup_friendliness";

export type TermParameterKey =
  | "claim_settlement_ratio"
  | "amount_settlement_ratio"
  | "solvency_ratio"
  | "complaint_volume"
  | "riders_quality"
  | "plan_flexibility"
  | "premium_competitiveness";

export interface ScoreDetail {
  parameter: HealthParameterKey | TermParameterKey;
  score: number;
  rating: "Bad" | "OK" | "Good";
  rationale: string;
}

export interface Evaluation {
  productRef: {
    insurer: string;
    planName: string;
    variant: string | null;
  };
  scores: ScoreDetail[];
  overall: {
    weightedScore: number;
    grade: "D" | "C" | "B" | "A" | "A+";
    notes: string | null;
  };
  version: string;
}

export type TermEvaluation = Evaluation;

// Base plan parameters — topup_friendliness excluded (base plans do not participate
// in top-up mechanics and a hardcoded neutral score would bias the aggregate).
const HEALTH_BASE_PARAMETERS: HealthParameterKey[] = [
  "room_rent",
  "disease_sublimits",
  "copay",
  "waiting_periods",
  "recharge",
  "pre_post",
  "ncb",
  "daycare",
  "ayush",
  "domiciliary",
  "sublimits"
];

// Top-up parameters — disease_sublimits excluded (sublimit burden is less relevant
// when the plan only activates above a deductible threshold).
const HEALTH_TOPUP_PARAMETERS: HealthParameterKey[] = [
  "topup_friendliness",
  "room_rent",
  "copay",
  "waiting_periods",
  "recharge",
  "pre_post",
  "ncb",
  "daycare",
  "ayush",
  "domiciliary",
  "sublimits"
];

const LIFE_TERM_PARAMETERS: TermParameterKey[] = [
  "claim_settlement_ratio",
  "amount_settlement_ratio",
  "solvency_ratio",
  "complaint_volume",
  "riders_quality",
  "plan_flexibility",
  "premium_competitiveness"
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rate(score: number): "Bad" | "OK" | "Good" {
  const sortedBands = [...DEFAULT_SCORE_BANDS].sort((a, b) => a.minScore - b.minScore);
  let current: "Bad" | "OK" | "Good" = "Bad";
  for (const band of sortedBands) {
    if (score >= band.minScore) {
      current = band.rating;
    }
  }
  return current;
}

function scoreRoomRent(product: HealthProduct): ScoreDetail {
  const room = product.roomRent;
  let baseScore = 0;
  let rationale = "";

  switch (room.limitType) {
    case "no_cap":
      baseScore = 100;
      rationale = "No cap on room rent.";
      break;
    case "single_private_room":
      baseScore = 75;
      rationale = "Single private room cap.";
      break;
    case "twin_sharing":
      baseScore = 60;
      rationale = "Twin sharing cap.";
      break;
    case "rupee_cap":
      baseScore = room.limitValue
        ? clamp(40 + (room.limitValue / (product.sumInsured.baseSI || 1)) * 40, 30, 80)
        : 40;
      rationale = `Rupee cap at ${room.limitValue ?? "unspecified"}.`;
      break;
    case "percent_of_SI":
      if ((room.limitValue ?? 0) <= ROOM_RENT_PERCENT_BASELINE) {
        baseScore = 30;
      } else {
        const extraPercent = (room.limitValue ?? 1) - ROOM_RENT_PERCENT_BASELINE;
        baseScore = clamp(50 + extraPercent * ROOM_RENT_PERCENT_INCREMENT, 30, ROOM_RENT_PERCENT_MAX);
      }
      rationale = `Room limit at ${room.limitValue ?? "?"}% of sum insured.`;
      break;
    default:
      baseScore = 40;
      rationale = "Room rent cap unspecified, conservative score applied.";
  }

  if (room.icuLimitType === "no_cap" || (room.icuLimitType === "percent_of_SI" && (room.icuLimitValue ?? 0) >= 2)) {
    baseScore += 5;
    rationale += " ICU coverage generous.";
  }

  if (room.proportionateDeduction === "waived_with_addon") {
    baseScore += 10;
    rationale += " Proportionate deduction waiver available.";
  } else if (room.proportionateDeduction === "not_applicable") {
    baseScore += 10;
    rationale += " Proportionate deduction not applicable.";
  }

  const score = clamp(baseScore, 0, 100);
  return { parameter: "room_rent", score, rating: rate(score), rationale: rationale.trim() };
}

function scorePrePost(product: HealthProduct): ScoreDetail {
  const pre = product.hospitalization.preHospDays;
  const post = product.hospitalization.postHospDays;
  let score = 50;
  let rationale = `Pre ${pre} days / Post ${post} days.`;

  if (pre >= 60 && post >= 180) {
    score = 100;
    rationale += " Extended pre/post cover.";
  } else if (pre >= 60 && post >= 90) {
    score = 80;
    rationale += " Strong pre/post cover.";
  } else if (pre >= 45 && post >= 90) {
    score = 70;
  } else if (pre >= 45 && post >= 60) {
    score = 60;
  } else if (pre >= 30 && post >= 60) {
    score = 40;
  } else {
    score = 30;
  }

  return { parameter: "pre_post", score, rating: rate(score), rationale: rationale.trim() };
}

function scoreDaycare(product: HealthProduct): ScoreDetail {
  const daycare = product.hospitalization.daycare;
  let score = 0;
  let rationale = "";
  switch (daycare) {
    case "all":
    case "all_listed":
      score = 100;
      rationale = "All daycare procedures covered.";
      break;
    case "limited_list":
      score = 60;
      rationale = "Limited daycare list.";
      break;
    case "not_covered":
      score = 0;
      rationale = "Daycare not covered.";
      break;
  }
  return { parameter: "daycare", score, rating: rate(score), rationale };
}

function scoreAyush(product: HealthProduct): ScoreDetail {
  const ayush = product.hospitalization.ayush;
  let score = 0;
  let rationale = "";
  if (!ayush.covered || ayush.limitType === "not_covered") {
    score = 0;
    rationale = "AYUSH not covered.";
  } else if (ayush.limitType === "up_to_SI") {
    score = 100;
    rationale = "AYUSH up to sum insured.";
  } else if (ayush.limitType === "percent") {
    const percent = ayush.limitValue ?? 0;
    score = percent >= 50 ? 80 : clamp((percent / 50) * 80, 0, 80);
    rationale = `AYUSH limit at ${percent}% of sum insured.`;
  } else if (ayush.limitType === "rupee_cap") {
    const ratio = (ayush.limitValue ?? 0) / (product.sumInsured.baseSI || 1);
    score = clamp(ratio * 80, 0, 80);
    rationale = `AYUSH rupee cap at ${ayush.limitValue}.`;
  }
  return { parameter: "ayush", score, rating: rate(score), rationale };
}

function scoreDomiciliary(product: HealthProduct): ScoreDetail {
  const dom = product.hospitalization.domiciliary;
  let score = 0;
  let rationale = "";
  if (!dom.covered) {
    score = 0;
    rationale = "Domiciliary not covered.";
  } else {
    const minDays = dom.minDays ?? 0;
    if (minDays <= 3 && !dom.negativeListPresent) {
      score = 95;
      rationale = "Domiciliary with low min days and no negative list.";
    } else if (dom.negativeListPresent) {
      score = 60;
      rationale = "Domiciliary covered with notable exclusions.";
    } else {
      score = 80;
      rationale = `Domiciliary covered with minimum ${minDays} days.`;
    }
  }
  return { parameter: "domiciliary", score, rating: rate(score), rationale };
}

function scoreNCB(product: HealthProduct): ScoreDetail {
  const ncb = product.bonuses.ncb;
  const accrual = ncb.accrualPerYearPercent ?? 0;
  const cap = ncb.maxCapPercent ?? 0;
  let score = 0;
  let rationale = "";

  if (accrual >= 50 && cap >= 100) {
    score = clamp(90 + Math.min(((cap - 100) / 50) * 5, 10), 90, 100);
    rationale = `NCB accrues ${accrual}% per year up to ${cap}%.`;
  } else if (accrual >= 20) {
    const factor = clamp((accrual - 20) / 30, 0, 1);
    score = 60 + factor * 20;
    rationale = `Moderate NCB accrual of ${accrual}%.`;
  } else if (accrual > 0) {
    score = 40;
    rationale = `Low NCB accrual of ${accrual}%.`;
  } else {
    score = 0;
    rationale = "No NCB accrual.";
  }

  if (ncb.claimImpact === "no_impact") {
    score = clamp(score + 5, 0, 100);
    rationale += " Bonus protected after claims.";
  } else if (ncb.claimImpact === "reduces") {
    score = clamp(score - 10, 0, 100);
    rationale += " NCB reduces post claim.";
  }

  return { parameter: "ncb", score, rating: rate(score), rationale: rationale.trim() };
}

function scoreRecharge(product: HealthProduct): ScoreDetail {
  const recharge = product.bonuses.recharge;
  let score = 0;
  let rationale = "";
  switch (recharge.type) {
    case "unlimited":
      score = recharge.sameIllnessAllowed ? 100 : 90;
      rationale = recharge.sameIllnessAllowed
        ? "Unlimited recharge covering same illness."
        : "Unlimited recharge without same illness support.";
      break;
    case "twice":
      score = recharge.sameIllnessAllowed ? 85 : 75;
      rationale = "Recharge twice per year.";
      break;
    case "once":
      score = recharge.sameIllnessAllowed ? 75 : 60;
      rationale = "Single recharge available.";
      break;
    default:
      score = 0;
      rationale = "No recharge benefit.";
  }
  return { parameter: "recharge", score, rating: rate(score), rationale };
}

function scoreCopay(product: HealthProduct): ScoreDetail {
  const copay = product.copayAndZones;
  let score = 100;
  let rationale = "";
  if (copay.mandatory === "none") {
    score = 100;
    rationale = "No mandatory copay.";
  } else {
    const percent = copay.mandatoryPercent ?? 0;
    if (percent <= 10) {
      score = 70;
      rationale = `Mandatory ${percent}% copay.`;
    } else {
      score = 40;
      rationale = `High mandatory copay at ${percent}%.`;
    }
    if (copay.mandatory === "network" && percent >= 20) {
      score = clamp(score - 20, 0, 100);
      rationale += " Additional penalty for network-based copay of 20% or more.";
    }
  }
  return { parameter: "copay", score, rating: rate(score), rationale: rationale.trim() };
}

// Renamed from scoreCataract. Scores the cataract sublimit and applies a small
// penalty when the plan carries a heavy load of disease-specific sublimits.
function scoreSublimits(product: HealthProduct): ScoreDetail {
  const cataract = product.sublimits.cataract;
  let score = 0;
  let rationale = "";

  if (cataract.type === "not_applicable") {
    score = 100;
    rationale = "No cataract sublimit.";
  } else if (cataract.type === "percent_of_SI") {
    const percent = cataract.value ?? 0;
    if (percent >= 25) score = 80;
    else if (percent >= 20) score = 70;
    else if (percent >= 10) score = 50;
    else score = 30;
    rationale = `Cataract limit at ${percent}% of sum insured${cataract.perEye ? " per eye" : ""}.`;
  } else if (cataract.type === "rupee_cap") {
    const cap = cataract.value ?? 0;
    const ratio = cap / (product.sumInsured.baseSI || 1);
    if (ratio >= 0.2) score = 70;
    else if (ratio >= 0.1) score = 50;
    else score = 20;
    rationale = `Cataract rupee cap at ${cap}${cataract.perEye ? " per eye" : ""}.`;
  }

  // Penalty for broadly sublimit-heavy policies (applies across base and top-up).
  if (product.sublimits.diseaseSpecific.length > 3) {
    score = clamp(score - 5, 0, 100);
    rationale += ` Policy carries ${product.sublimits.diseaseSpecific.length} disease-specific sublimits.`;
  }

  return { parameter: "sublimits", score, rating: rate(score), rationale: rationale.trim() };
}

// Scores the disease-specific sublimit burden. Ditto rates this as the 2nd most
// important coverage feature because even a large SI is undermined by tight per-
// disease caps on common procedures (joint replacement, cardiac care, etc.).
function scoreDiseaseSublimits(product: HealthProduct): ScoreDetail {
  const list = product.sublimits.diseaseSpecific;
  const si = product.sumInsured.baseSI || 1;

  if (list.length === 0) {
    return {
      parameter: "disease_sublimits",
      score: 100,
      rating: "Good",
      rationale: "No disease-specific sublimits."
    };
  }

  const minRatio = Math.min(
    ...list.map((item) => {
      const val = item.type === "percent" ? (item.value / 100) * si : item.value;
      return val / si;
    })
  );

  let score: number;
  let rationale: string;

  if (list.length <= 2 && minRatio >= 0.2) {
    score = 75;
    rationale = `${list.length} sublimit(s) with reasonable caps (≥20% of SI).`;
  } else if (list.length <= 5 && minRatio >= 0.1) {
    score = 50;
    rationale = `${list.length} disease-specific sublimits; moderate burden.`;
  } else {
    score = 20;
    rationale = `${list.length} sublimits with tight caps — significant hidden exposure.`;
  }

  return { parameter: "disease_sublimits", score, rating: rate(score), rationale };
}

function scoreWaiting(product: HealthProduct): ScoreDetail {
  const wait = product.waitingPeriods;
  let score = 0;
  let rationale = `Initial ${wait.initialDays} days, specific ${wait.specificAilmentsMonths} months, PED ${wait.pedMonths} months.`;

  if (wait.initialDays <= 30 && wait.specificAilmentsMonths <= 24 && wait.pedMonths <= 36) {
    score = 90;
  } else if (wait.initialDays <= 30 && wait.specificAilmentsMonths <= 36 && wait.pedMonths <= 48) {
    score = 70;
  } else {
    score = 50;
  }

  if (wait.initialDays > 30) score -= 10;
  if (wait.pedMonths > 48) score -= 10;

  if (wait.reductionOptions.specificAilments || wait.reductionOptions.ped) {
    score = clamp(score + 10, 0, 100);
    rationale += " Reduction options available.";
  }

  score = clamp(score, 0, 100);
  return { parameter: "waiting_periods", score, rating: rate(score), rationale: rationale.trim() };
}

function scoreTopUp(product: HealthProduct): ScoreDetail {
  const isTopUp = product.product.isTopUp || product.deductible.applies;
  const topUp = product.topUpSpecifics;
  const room = product.roomRent;

  if (!isTopUp) {
    // Should not be called for base plans; guard return.
    return {
      parameter: "topup_friendliness",
      score: 60,
      rating: "OK",
      rationale: "Base plan — top-up friendliness not applicable."
    };
  }

  let score = 0;
  let rationale = "";

  if (topUp.howDeductibleApplies === "aggregate_year") {
    score = 90;
    rationale = "Aggregate annual deductible.";
  } else if (topUp.howDeductibleApplies === "per_claim") {
    score = 70;
    rationale = "Per-claim deductible.";
  } else {
    score = 60;
    rationale = "Deductible structure unspecified.";
  }

  const coverageSet = new Set(topUp.coverageAboveDeductible);
  if (coverageSet.has("IPD") && coverageSet.has("pre_post") && coverageSet.has("daycare")) {
    score += 5;
    rationale += " Comprehensive coverage above deductible.";
  }
  if (coverageSet.has("AYUSH")) score += 3;

  if (room.limitType === "no_cap" || room.limitType === "single_private_room") {
    score += 5;
    rationale += " Base room rules support layering.";
  }

  score = clamp(score, 0, 100);
  return { parameter: "topup_friendliness", score, rating: rate(score), rationale: rationale.trim() };
}

const healthScorers: Record<HealthParameterKey, (product: HealthProduct) => ScoreDetail> = {
  room_rent: scoreRoomRent,
  pre_post: scorePrePost,
  daycare: scoreDaycare,
  ayush: scoreAyush,
  domiciliary: scoreDomiciliary,
  ncb: scoreNCB,
  recharge: scoreRecharge,
  copay: scoreCopay,
  sublimits: scoreSublimits,
  disease_sublimits: scoreDiseaseSublimits,
  waiting_periods: scoreWaiting,
  topup_friendliness: scoreTopUp
};

function deriveGrade(weighted: number): "D" | "C" | "B" | "A" | "A+" {
  for (const threshold of GRADE_THRESHOLDS) {
    if (weighted >= threshold.minScore) return threshold.grade;
  }
  return "D";
}

function aggregateHealthNotes(product: HealthProduct): string | null {
  const components: string[] = [];
  if (product.notes) components.push(product.notes);
  if (product.bonuses.recharge.type === "na") components.push("No recharge/reset benefit.");
  if (product.copayAndZones.mandatory !== "none") {
    components.push(
      `Mandatory copay of ${product.copayAndZones.mandatoryPercent ?? 0}% based on ${product.copayAndZones.mandatory}.`
    );
  }
  return components.length ? Array.from(new Set(components)).join(" | ") : null;
}

export function scoreProduct(product: HealthProduct): Evaluation {
  const isTopUp = product.product.isTopUp || product.deductible.applies;
  const parameters = isTopUp ? HEALTH_TOPUP_PARAMETERS : HEALTH_BASE_PARAMETERS;
  const weights = isTopUp ? HEALTH_TOPUP_WEIGHTS : HEALTH_BASE_WEIGHTS;

  const scores: ScoreDetail[] = parameters.map((parameter) => healthScorers[parameter](product));

  const weightedScore = scores.reduce((acc, detail) => {
    const weight = weights[detail.parameter] ?? 0;
    return acc + detail.score * weight;
  }, 0);

  return {
    productRef: {
      insurer: product.product.insurer,
      planName: product.product.planName,
      variant: product.product.variant
    },
    scores,
    overall: {
      weightedScore: Math.round(weightedScore * 100) / 100,
      grade: deriveGrade(weightedScore),
      notes: aggregateHealthNotes(product)
    },
    version: VERSION
  };
}

// ── Term life scoring ─────────────────────────────────────────────────────────

// Ditto benchmark: CSR >97% excellent, <95% red flag.
function scoreCSR(product: TermProduct): ScoreDetail {
  const csr = product.insurer.csr;
  let score: number;
  let rationale: string;

  if (csr >= 99) {
    score = 100;
    rationale = `CSR ${csr.toFixed(2)}% — exceptional.`;
  } else if (csr >= 97) {
    score = 85;
    rationale = `CSR ${csr.toFixed(2)}% — strong.`;
  } else if (csr >= 95) {
    score = 65;
    rationale = `CSR ${csr.toFixed(2)}% — acceptable but watch trend.`;
  } else {
    score = 30;
    rationale = `CSR ${csr.toFixed(2)}% — below safe threshold.`;
  }

  return { parameter: "claim_settlement_ratio", score, rating: rate(score), rationale };
}

// Beshak: ASR outranks CSR — an insurer can settle 99% of small claims while
// rejecting high-value ones. ASR >90% considered good.
function scoreASR(product: TermProduct): ScoreDetail {
  const asr = product.insurer.asr;
  let score: number;
  let rationale: string;

  if (asr >= 95) {
    score = 100;
    rationale = `ASR ${asr.toFixed(2)}% — high-value claims paid reliably.`;
  } else if (asr >= 90) {
    score = 80;
    rationale = `ASR ${asr.toFixed(2)}% — good.`;
  } else if (asr >= 80) {
    score = 55;
    rationale = `ASR ${asr.toFixed(2)}% — moderate; large claims may face scrutiny.`;
  } else {
    score = 20;
    rationale = `ASR ${asr.toFixed(2)}% — concerning; insurer settles by count but not by value.`;
  }

  return { parameter: "amount_settlement_ratio", score, rating: rate(score), rationale };
}

// IRDAI minimum 1.5x. Ditto treats anything below 1.6x as marginal.
function scoreSolvency(product: TermProduct): ScoreDetail {
  const ratio = product.insurer.solvencyRatio;
  let score: number;
  let rationale: string;

  if (ratio >= 2.5) {
    score = 100;
    rationale = `Solvency ratio ${ratio.toFixed(2)}x — very strong financial buffer.`;
  } else if (ratio >= 2.0) {
    score = 85;
    rationale = `Solvency ratio ${ratio.toFixed(2)}x — healthy.`;
  } else if (ratio >= 1.6) {
    score = 65;
    rationale = `Solvency ratio ${ratio.toFixed(2)}x — adequate.`;
  } else if (ratio >= 1.5) {
    score = 40;
    rationale = `Solvency ratio ${ratio.toFixed(2)}x — at IRDAI minimum, marginal buffer.`;
  } else {
    score = 0;
    rationale = `Solvency ratio ${ratio.toFixed(2)}x — below IRDAI minimum of 1.5x.`;
  }

  return { parameter: "solvency_ratio", score, rating: rate(score), rationale };
}

// Ditto benchmark: <50 complaints per 10,000 claims is a safe threshold.
function scoreComplaintVolume(product: TermProduct): ScoreDetail {
  const complaints = product.insurer.complaintsPerTenK;
  let score: number;
  let rationale: string;

  if (complaints <= 20) {
    score = 100;
    rationale = `${complaints} complaints per 10K claims — excellent service record.`;
  } else if (complaints <= 50) {
    score = 75;
    rationale = `${complaints} complaints per 10K claims — within safe range.`;
  } else if (complaints <= 100) {
    score = 50;
    rationale = `${complaints} complaints per 10K claims — elevated; suggests claims friction.`;
  } else {
    score = 20;
    rationale = `${complaints} complaints per 10K claims — high; significant service concerns.`;
  }

  return { parameter: "complaint_volume", score, rating: rate(score), rationale };
}

// Key riders: Critical Illness (64+ illnesses = strong per Ditto), ADB, WOP,
// Terminal Illness. Each rider adds meaningful protection at different life stages.
function scoreRiders(product: TermProduct): ScoreDetail {
  const riders = product.riders;
  let score = 0;
  const parts: string[] = [];

  // Critical illness is the most impactful rider.
  if (riders.criticalIllness.covered) {
    const count = riders.criticalIllness.illnessCount ?? 0;
    if (count >= 64) {
      score += 40;
      parts.push(`CI rider covers ${count} illnesses.`);
    } else if (count >= 36) {
      score += 28;
      parts.push(`CI rider covers ${count} illnesses.`);
    } else if (count > 0) {
      score += 15;
      parts.push(`CI rider covers ${count} illnesses.`);
    } else {
      score += 20;
      parts.push("CI rider available.");
    }
  }

  if (riders.terminalIllness) {
    score += 20;
    parts.push("Terminal illness benefit.");
  }
  if (riders.waiverOfPremium) {
    score += 20;
    parts.push("Waiver of premium on disability/CI.");
  }
  if (riders.accidentalDeath) {
    score += 20;
    parts.push("Accidental death benefit.");
  }

  score = clamp(score, 0, 100);
  return {
    parameter: "riders_quality",
    score,
    rating: rate(score),
    rationale: parts.join(" ") || "No riders available."
  };
}

// Limited pay and whole-life options add genuine long-term value; staggered payout
// and joint life cover serve specific needs (income replacement, couples).
function scorePlanFlexibility(product: TermProduct): ScoreDetail {
  const opts = product.planOptions;
  let score = 40; // baseline for a standard level-cover regular-pay plan
  const parts: string[] = [];

  if (opts.limitedPayAvailable) {
    score += 20;
    parts.push("Limited pay option.");
  }
  if (opts.wholeLifeAvailable) {
    score += 20;
    parts.push("Whole-life cover available.");
  }
  if (opts.staggeredPayoutAvailable) {
    score += 10;
    parts.push("Staggered payout for income replacement.");
  }
  if (opts.jointLifeAvailable) {
    score += 10;
    parts.push("Joint life option.");
  }

  score = clamp(score, 0, 100);
  return {
    parameter: "plan_flexibility",
    score,
    rating: rate(score),
    rationale: parts.length ? parts.join(" ") : "Standard plan options only."
  };
}

// Relative score: requires a market benchmark premium in the TermProduct.
// Without a benchmark, defaults to 50 (neutral).
function scorePremium(product: TermProduct): ScoreDetail {
  if (product.annualPremium == null || product.benchmarkPremium == null) {
    return {
      parameter: "premium_competitiveness",
      score: 50,
      rating: "OK",
      rationale: "Premium data unavailable; neutral score applied."
    };
  }

  const ratio = product.annualPremium / product.benchmarkPremium;
  let score: number;
  let rationale: string;

  if (ratio <= 0.85) {
    score = 100;
    rationale = `Premium ${Math.round((1 - ratio) * 100)}% below market benchmark.`;
  } else if (ratio <= 1.0) {
    score = 80;
    rationale = "Premium at or below market benchmark.";
  } else if (ratio <= 1.15) {
    score = 60;
    rationale = "Premium marginally above market benchmark.";
  } else {
    score = 30;
    rationale = `Premium ${Math.round((ratio - 1) * 100)}% above market benchmark.`;
  }

  return { parameter: "premium_competitiveness", score, rating: rate(score), rationale };
}

const termScorers: Record<TermParameterKey, (product: TermProduct) => ScoreDetail> = {
  claim_settlement_ratio: scoreCSR,
  amount_settlement_ratio: scoreASR,
  solvency_ratio: scoreSolvency,
  complaint_volume: scoreComplaintVolume,
  riders_quality: scoreRiders,
  plan_flexibility: scorePlanFlexibility,
  premium_competitiveness: scorePremium
};

export function scoreTermProduct(product: TermProduct): TermEvaluation {
  const scores: ScoreDetail[] = LIFE_TERM_PARAMETERS.map((parameter) => termScorers[parameter](product));

  const weightedScore = scores.reduce((acc, detail) => {
    const weight = LIFE_TERM_WEIGHTS[detail.parameter] ?? 0;
    return acc + detail.score * weight;
  }, 0);

  return {
    productRef: {
      insurer: product.product.insurer,
      planName: product.product.planName,
      variant: null
    },
    scores,
    overall: {
      weightedScore: Math.round(weightedScore * 100) / 100,
      grade: deriveGrade(weightedScore),
      notes: null
    },
    version: VERSION
  };
}

// ── Motor insurance scoring ───────────────────────────────────────────────────

export type MotorParameterKey =
  | "zero_depreciation"
  | "idv_adequacy"
  | "engine_protection"
  | "consumables_cover"
  | "insurer_reliability"
  | "ncb_protection"
  | "return_to_invoice"
  | "roadside_assistance"
  | "personal_accident";

export type MotorEvaluation = Evaluation;

const MOTOR_PVT_CAR_PARAMETERS: MotorParameterKey[] = [
  "zero_depreciation",
  "idv_adequacy",
  "engine_protection",
  "consumables_cover",
  "insurer_reliability",
  "ncb_protection",
  "return_to_invoice",
  "roadside_assistance"
];

// personal_accident replaces return_to_invoice for 2-wheelers: RTI is rarely
// relevant on low-value 2Ws, whereas PA for rider + pillion is a strong differentiator.
const MOTOR_TWO_WHEELER_PARAMETERS: MotorParameterKey[] = [
  "zero_depreciation",
  "idv_adequacy",
  "personal_accident",
  "ncb_protection",
  "roadside_assistance",
  "consumables_cover",
  "insurer_reliability"
];

// Zero depreciation eliminates depreciation deductions on all replaced parts,
// converting a 40–60% shortfall into a full-value claim.
function scoreZeroDepreciation(product: MotorProduct): ScoreDetail {
  const score = product.addOns.zeroDepreciation ? 100 : 0;
  const rationale = product.addOns.zeroDepreciation
    ? "Zero depreciation cover included — full part replacement value."
    : "No zero depreciation cover — depreciation deducted on replaced parts.";
  return { parameter: "zero_depreciation", score, rating: rate(score), rationale };
}

// IDV adequacy: ratio of declared value to estimated market value.
// IDV < market value means underinsurance on total loss or theft.
function scoreIDVAdequacy(product: MotorProduct): ScoreDetail {
  const { declaredValue, estimatedMarketValue } = product.idv;

  if (estimatedMarketValue == null) {
    return {
      parameter: "idv_adequacy",
      score: 50,
      rating: "OK",
      rationale: "Market value unknown; IDV adequacy cannot be assessed."
    };
  }

  const ratio = declaredValue / estimatedMarketValue;
  let score: number;
  let rationale: string;

  if (ratio >= 0.97) {
    score = 100;
    rationale = `IDV ₹${declaredValue.toLocaleString()} — fully adequate (${(ratio * 100).toFixed(0)}% of market value).`;
  } else if (ratio >= 0.90) {
    score = 75;
    rationale = `IDV at ${(ratio * 100).toFixed(0)}% of market value — slight underinsurance.`;
  } else if (ratio >= 0.80) {
    score = 45;
    rationale = `IDV at ${(ratio * 100).toFixed(0)}% of market value — meaningful underinsurance on total loss.`;
  } else {
    score = 15;
    rationale = `IDV at ${(ratio * 100).toFixed(0)}% of market value — significant underinsurance.`;
  }

  return { parameter: "idv_adequacy", score, rating: rate(score), rationale };
}

// Engine protection covers hydrostatic lock (flooding the engine) and oil leakage
// damage — repairs can cost ₹1–5L and are excluded from standard policies.
function scoreEngineProtection(product: MotorProduct): ScoreDetail {
  const score = product.addOns.engineProtection ? 100 : 0;
  const rationale = product.addOns.engineProtection
    ? "Engine protection included — hydrostatic lock and oil leakage covered."
    : "No engine protection — expensive engine repairs excluded from standard cover.";
  return { parameter: "engine_protection", score, rating: rate(score), rationale };
}

// Consumables (oils, nuts, bolts) add 5–10% to repair bills and are excluded by default.
function scoreConsumablesCover(product: MotorProduct): ScoreDetail {
  const score = product.addOns.consumablesCover ? 100 : 0;
  const rationale = product.addOns.consumablesCover
    ? "Consumables cover included — oils, nuts, and bolts covered during repairs."
    : "Consumables excluded — adds 5–10% out-of-pocket to repair costs.";
  return { parameter: "consumables_cover", score, rating: rate(score), rationale };
}

// Combined motor insurer reliability: CSR + complaint volume + garage network.
function scoreMotorInsurerReliability(product: MotorProduct): ScoreDetail {
  const { motorCsr, complaintsPerTenK, networkGarages } = product.insurer;
  let score = 0;
  const parts: string[] = [];

  // CSR component (50% of this sub-score)
  if (motorCsr >= 98) {
    score += 50;
    parts.push(`Motor CSR ${motorCsr.toFixed(1)}%.`);
  } else if (motorCsr >= 95) {
    score += 35;
    parts.push(`Motor CSR ${motorCsr.toFixed(1)}%.`);
  } else {
    score += 20;
    parts.push(`Motor CSR ${motorCsr.toFixed(1)}% — below average.`);
  }

  // Complaint volume (30% of sub-score)
  if (complaintsPerTenK <= 30) {
    score += 30;
    parts.push(`${complaintsPerTenK} complaints/10K claims.`);
  } else if (complaintsPerTenK <= 70) {
    score += 18;
  } else {
    score += 5;
    parts.push(`High complaint rate: ${complaintsPerTenK}/10K claims.`);
  }

  // Network garages (20% of sub-score)
  if (networkGarages >= 10000) {
    score += 20;
    parts.push(`${networkGarages.toLocaleString()} cashless garages.`);
  } else if (networkGarages >= 5000) {
    score += 13;
  } else {
    score += 5;
    parts.push(`Limited cashless network: ${networkGarages} garages.`);
  }

  score = clamp(score, 0, 100);
  return { parameter: "insurer_reliability", score, rating: rate(score), rationale: parts.join(" ").trim() };
}

// NCB protection preserves the 20–50% premium discount after one claim.
// Without it, a single claim resets 5 years of accumulated bonus.
function scoreNCBProtection(product: MotorProduct): ScoreDetail {
  const score = product.addOns.ncbProtection ? 100 : 0;
  const rationale = product.addOns.ncbProtection
    ? "NCB protection included — bonus preserved after one claim."
    : "No NCB protection — one claim resets accumulated no-claim bonus.";
  return { parameter: "ncb_protection", score, rating: rate(score), rationale };
}

// Return to Invoice bridges the gap between the depreciated IDV and the original
// purchase price — most valuable for vehicles under 3 years old.
function scoreReturnToInvoice(product: MotorProduct): ScoreDetail {
  const score = product.addOns.returnToInvoice ? 100 : 0;
  const rationale = product.addOns.returnToInvoice
    ? "Return to Invoice included — original purchase price paid on total loss."
    : "No RTI cover — total loss settled at depreciated IDV only.";
  return { parameter: "return_to_invoice", score, rating: rate(score), rationale };
}

// RSA (Roadside Assistance) covers towing, fuel delivery, battery jump-start, flat tyre.
function scoreRSA(product: MotorProduct): ScoreDetail {
  const score = product.addOns.roadsideAssistance ? 100 : 0;
  const rationale = product.addOns.roadsideAssistance
    ? "24/7 roadside assistance included."
    : "No roadside assistance — breakdown and towing costs out-of-pocket.";
  return { parameter: "roadside_assistance", score, rating: rate(score), rationale };
}

// Personal accident cover for 2-wheelers: rider is mandatory (IRDAI); pillion is
// optional but meaningful. Cover amount and pillion availability differentiate plans.
function scorePersonalAccident(product: MotorProduct): ScoreDetail {
  const pa = product.personalAccident;
  if (!pa) {
    return {
      parameter: "personal_accident",
      score: 30,
      rating: "Bad",
      rationale: "Personal accident cover data unavailable."
    };
  }

  let score = 0;
  const parts: string[] = [];

  // Rider cover amount: IRDAI minimum is ₹15L; higher is better
  if (pa.riderCoverAmount >= 1500000) {
    score += 60;
    parts.push(`Rider PA ₹${(pa.riderCoverAmount / 100000).toFixed(0)}L.`);
  } else if (pa.riderCoverAmount >= 1000000) {
    score += 45;
    parts.push(`Rider PA ₹${(pa.riderCoverAmount / 100000).toFixed(0)}L.`);
  } else {
    score += 25;
    parts.push(`Low rider PA: ₹${(pa.riderCoverAmount / 100000).toFixed(0)}L.`);
  }

  if (pa.pillionCoverAvailable) {
    const pillionAmt = pa.pillionCoverAmount ?? 0;
    score += pillionAmt >= 100000 ? 40 : 20;
    parts.push(`Pillion cover ₹${(pillionAmt / 100000).toFixed(0)}L.`);
  }

  score = clamp(score, 0, 100);
  return { parameter: "personal_accident", score, rating: rate(score), rationale: parts.join(" ").trim() };
}

const motorScorers: Record<MotorParameterKey, (product: MotorProduct) => ScoreDetail> = {
  zero_depreciation: scoreZeroDepreciation,
  idv_adequacy: scoreIDVAdequacy,
  engine_protection: scoreEngineProtection,
  consumables_cover: scoreConsumablesCover,
  insurer_reliability: scoreMotorInsurerReliability,
  ncb_protection: scoreNCBProtection,
  return_to_invoice: scoreReturnToInvoice,
  roadside_assistance: scoreRSA,
  personal_accident: scorePersonalAccident
};

export function scoreMotorProduct(product: MotorProduct): MotorEvaluation {
  const isTwoWheeler = product.product.vehicleType === "two_wheeler";
  const parameters = isTwoWheeler ? MOTOR_TWO_WHEELER_PARAMETERS : MOTOR_PVT_CAR_PARAMETERS;
  const weights = isTwoWheeler ? MOTOR_TWO_WHEELER_WEIGHTS : MOTOR_PVT_CAR_WEIGHTS;

  const scores: ScoreDetail[] = parameters.map((parameter) => motorScorers[parameter](product));

  const weightedScore = scores.reduce((acc, detail) => {
    const weight = weights[detail.parameter] ?? 0;
    return acc + detail.score * weight;
  }, 0);

  return {
    productRef: {
      insurer: product.product.insurer,
      planName: product.product.planName,
      variant: product.product.vehicleType === "pvt_car" ? "Private Car" : "Two Wheeler"
    },
    scores,
    overall: {
      weightedScore: Math.round(weightedScore * 100) / 100,
      grade: deriveGrade(weightedScore),
      notes: null
    },
    version: VERSION
  };
}
