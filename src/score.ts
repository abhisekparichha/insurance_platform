import type { HealthProduct } from "../models/health_types";
import { DEFAULT_SCORE_BANDS, GRADE_THRESHOLDS, ROOM_RENT_PERCENT_BASELINE, ROOM_RENT_PERCENT_INCREMENT, ROOM_RENT_PERCENT_MAX, SCORING_WEIGHTS, VERSION } from "./constants";

export type ParameterKey =
  | "room_rent"
  | "pre_post"
  | "daycare"
  | "ayush"
  | "domiciliary"
  | "ncb"
  | "recharge"
  | "copay"
  | "cataract"
  | "waiting_periods"
  | "topup_friendliness";

export interface ScoreDetail {
  parameter: ParameterKey;
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

const PARAMETER_LIST: ParameterKey[] = [
  "room_rent",
  "pre_post",
  "daycare",
  "ayush",
  "domiciliary",
  "ncb",
  "recharge",
  "copay",
  "cataract",
  "waiting_periods",
  "topup_friendliness"
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
      baseScore = room.limitValue ? clamp(40 + room.limitValue / (product.sumInsured.baseSI || 1) * 40, 30, 80) : 40;
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
  return {
    parameter: "room_rent",
    score,
    rating: rate(score),
    rationale: rationale.trim()
  };
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

  return {
    parameter: "pre_post",
    score,
    rating: rate(score),
    rationale: rationale.trim()
  };
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
  return {
    parameter: "daycare",
    score,
    rating: rate(score),
    rationale
  };
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

  return {
    parameter: "ayush",
    score,
    rating: rate(score),
    rationale
  };
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
  return {
    parameter: "domiciliary",
    score,
    rating: rate(score),
    rationale
  };
}

function scoreNCB(product: HealthProduct): ScoreDetail {
  const ncb = product.bonuses.ncb;
  const accrual = ncb.accrualPerYearPercent ?? 0;
  const cap = ncb.maxCapPercent ?? 0;
  let score = 0;
  let rationale = "";

  if (accrual >= 50 && cap >= 100) {
    score = clamp(90 + Math.min((cap - 100) / 50 * 5, 10), 90, 100);
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

  return {
    parameter: "ncb",
    score,
    rating: rate(score),
    rationale: rationale.trim()
  };
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
  return {
    parameter: "recharge",
    score,
    rating: rate(score),
    rationale
  };
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
  return {
    parameter: "copay",
    score,
    rating: rate(score),
    rationale: rationale.trim()
  };
}

function scoreCataract(product: HealthProduct): ScoreDetail {
  const cataract = product.sublimits.cataract;
  let score = 0;
  let rationale = "";
  if (cataract.type === "not_applicable") {
    score = 100;
    rationale = "No cataract sublimit.";
  } else if (cataract.type === "percent_of_SI") {
    const percent = cataract.value ?? 0;
    if (percent >= 25) {
      score = 80;
    } else if (percent >= 20) {
      score = 70;
    } else if (percent >= 10) {
      score = 50;
    } else {
      score = 30;
    }
    rationale = `Cataract limit at ${percent}% of sum insured${cataract.perEye ? " per eye" : ""}.`;
  } else if (cataract.type === "rupee_cap") {
    const cap = cataract.value ?? 0;
    const ratio = cap / (product.sumInsured.baseSI || 1);
    if (ratio >= 0.2) {
      score = 70;
    } else if (ratio >= 0.1) {
      score = 50;
    } else {
      score = 20;
    }
    rationale = `Cataract rupee cap at ${cap}${cataract.perEye ? " per eye" : ""}.`;
  }

  return {
    parameter: "cataract",
    score,
    rating: rate(score),
    rationale
  };
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

  if (wait.initialDays > 30) {
    score -= 10;
  }
  if (wait.pedMonths > 48) {
    score -= 10;
  }

  if (wait.reductionOptions.specificAilments || wait.reductionOptions.ped) {
    score = clamp(score + 10, 0, 100);
    rationale += " Reduction options available.";
  }

  score = clamp(score, 0, 100);

  return {
    parameter: "waiting_periods",
    score,
    rating: rate(score),
    rationale: rationale.trim()
  };
}

function scoreTopUp(product: HealthProduct): ScoreDetail {
  const isTopUp = product.product.isTopUp || product.deductible.applies;
  const topUp = product.topUpSpecifics;
  const room = product.roomRent;

  if (!isTopUp) {
    return {
      parameter: "topup_friendliness",
      score: 60,
      rating: "OK",
      rationale: "Base plan usable as primary cover; neutral top-up friendliness."
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
  if (coverageSet.has("AYUSH")) {
    score += 3;
  }

  if (room.limitType === "no_cap" || room.limitType === "single_private_room") {
    score += 5;
    rationale += " Base room rules support layering.";
  }

  score = clamp(score, 0, 100);
  return {
    parameter: "topup_friendliness",
    score,
    rating: rate(score),
    rationale: rationale.trim()
  };
}

const scorers: Record<ParameterKey, (product: HealthProduct) => ScoreDetail> = {
  room_rent: scoreRoomRent,
  pre_post: scorePrePost,
  daycare: scoreDaycare,
  ayush: scoreAyush,
  domiciliary: scoreDomiciliary,
  ncb: scoreNCB,
  recharge: scoreRecharge,
  copay: scoreCopay,
  cataract: scoreCataract,
  waiting_periods: scoreWaiting,
  topup_friendliness: scoreTopUp
};

function deriveGrade(weighted: number): "D" | "C" | "B" | "A" | "A+" {
  for (const threshold of GRADE_THRESHOLDS) {
    if (weighted >= threshold.minScore) {
      return threshold.grade;
    }
  }
  return "D";
}

function aggregateNotes(product: HealthProduct): string | null {
  const components: string[] = [];
  if (product.notes) {
    components.push(product.notes);
  }
  if (product.bonuses.recharge.type === "na") {
    components.push("No recharge/reset benefit.");
  }
  if (product.copayAndZones.mandatory !== "none") {
    components.push(`Mandatory copay of ${product.copayAndZones.mandatoryPercent ?? 0}% based on ${product.copayAndZones.mandatory}.`);
  }
  if (components.length === 0) {
    return null;
  }
  return Array.from(new Set(components)).join(" | ");
}

export function scoreProduct(product: HealthProduct): Evaluation {
  const scores: ScoreDetail[] = PARAMETER_LIST.map((parameter) => scorers[parameter](product));

  const weightedScore = scores.reduce((acc, detail) => {
    const weight = SCORING_WEIGHTS[detail.parameter] ?? 0;
    return acc + detail.score * weight;
  }, 0);

  const grade = deriveGrade(weightedScore);
  const notes = aggregateNotes(product);

  return {
    productRef: {
      insurer: product.product.insurer,
      planName: product.product.planName,
      variant: product.product.variant
    },
    scores,
    overall: {
      weightedScore: Math.round(weightedScore * 100) / 100,
      grade,
      notes
    },
    version: VERSION
  };
}
