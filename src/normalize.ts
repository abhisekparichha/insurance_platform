import type {
  HealthProduct,
  RoomRent,
  Hospitalization,
  Bonuses,
  WaitingPeriods,
  CopayAndZones,
  Sublimits,
  ValueAdds,
  TopUpSpecifics,
  TransportCover,
  OrganDonor,
  Deductible,
  SumInsured,
  ProductInfo
} from "../models/health_types";

export interface RawExtract {
  product: {
    insurer: string;
    planName: string;
    variant?: string | null;
    uin?: string | null;
    policyType?: string;
    isTopUp?: boolean;
    geography?: string;
  };
  sumInsured?: {
    baseSI?: number | string;
    currency?: string;
    bands?: Array<number | string>;
    unlimitedOneClaim?: boolean;
  };
  deductible?: {
    applies?: boolean;
    type?: string | null;
    amount?: number | string | null;
    aggregateApplies?: boolean | null;
  };
  roomRent?: {
    text?: string;
    icuText?: string;
    addonInfo?: string;
    upgradeOption?: boolean;
  };
  hospitalization?: {
    inpatientCovered?: boolean;
    daycare?: string;
    preHospDays?: number | string;
    postHospDays?: number | string;
    domiciliary?: {
      covered?: boolean;
      minDays?: number | string | null;
      negativeListPresent?: boolean;
      notes?: string | null;
    };
    ayushText?: string;
    ayushLimitValue?: number | string | null;
  };
  transport?: {
    roadAmbulanceLimit?: number | string | null;
    airAmbulance?: string;
    airAmbulanceLimit?: number | string | null;
  };
  organDonor?: {
    covered?: boolean;
    notes?: string | null;
  };
  bonuses?: {
    ncbText?: string;
    rechargeText?: string;
  };
  waitingPeriods?: {
    initialDays?: number | string;
    specificAilmentsMonths?: number | string;
    pedMonths?: number | string;
    reductionSpecific?: boolean;
    reductionPed?: boolean;
  };
  copay?: {
    mandatoryType?: string;
    mandatoryPercent?: number | string | null;
    optionalAvailable?: boolean;
  };
  sublimits?: {
    cataractText?: string;
    diseaseSpecific?: Array<{ name: string; type: string; value: number | string }>;
  };
  valueAdds?: {
    annualHealthCheckup?: boolean;
    eConsult?: boolean;
    wellnessBenefits?: boolean;
    others?: string[];
  };
  topUpSpecifics?: {
    howDeductibleApplies?: string | null;
    coverageList?: string[];
    roomRule?: string | null;
    recharge?: string | null;
    ncb?: string | null;
  };
  provenance: {
    sourceType: "manual" | "policy_pdf" | "insurer_site" | "broker_portal";
    sourceName: string;
    sourceDate: string;
    extractionConfidence?: number;
  };
  notes?: string[];
}

const DEFAULT_COUNTRY = "IN";

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const cleaned = String(value).replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value: string | number | null | undefined): number | null {
  const numeric = toNumber(value);
  return numeric !== null ? Math.round(numeric) : null;
}

function parseRoomRent(raw?: RawExtract["roomRent"]): RoomRent {
  let limitType: RoomRent["limitType"] = "percent_of_SI";
  let limitValue: number | null = null;
  let icuLimitType: RoomRent["icuLimitType"] = "percent_of_SI";
  let icuLimitValue: number | null = null;
  let proportionate: RoomRent["proportionateDeduction"] = "not_applicable";
  let roomModifierOption = false;

  const text = raw?.text?.toLowerCase() ?? "";
  const icuText = raw?.icuText?.toLowerCase() ?? "";
  const addonText = raw?.addonInfo?.toLowerCase() ?? "";

  if (text.includes("no room") && text.includes("cap")) {
    limitType = "no_cap";
    limitValue = null;
    proportionate = "not_applicable";
  } else if (text.includes("%")) {
    const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentMatch) {
      limitType = "percent_of_SI";
      limitValue = Number.parseFloat(percentMatch[1]);
      proportionate = "applies";
    }
  } else if (text.includes("single") && text.includes("private")) {
    limitType = "single_private_room";
    limitValue = null;
    proportionate = "applies";
  } else if (text.includes("twin")) {
    limitType = "twin_sharing";
    limitValue = null;
    proportionate = "applies";
  } else if (text.match(/rs|₹|lakh|lac|crore/i)) {
    const numeric = toNumber(text);
    if (numeric !== null) {
      limitType = "rupee_cap";
      limitValue = numeric;
      proportionate = "applies";
    }
  }

  if (icuText.includes("no cap")) {
    icuLimitType = "no_cap";
    icuLimitValue = null;
  } else if (icuText.includes("%")) {
    const percentMatch = icuText.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentMatch) {
      icuLimitType = "percent_of_SI";
      icuLimitValue = Number.parseFloat(percentMatch[1]);
    }
  } else {
    const numeric = toNumber(icuText);
    if (numeric !== null) {
      icuLimitType = "rupee_cap";
      icuLimitValue = numeric;
    }
  }

  if (addonText.includes("waiver")) {
    proportionate = "waived_with_addon";
  }

  if (raw?.upgradeOption === true) {
    roomModifierOption = true;
  } else if (text.includes("optional upgrade") || text.includes("upgrade optional")) {
    roomModifierOption = true;
  }

  if (limitType === "no_cap" && proportionate === "applies") {
    proportionate = "not_applicable";
  }

  return {
    limitType,
    limitValue,
    icuLimitType,
    icuLimitValue,
    proportionateDeduction: proportionate,
    roomModifierOption
  };
}

function parseAyush(raw?: RawExtract["hospitalization"]): Hospitalization["ayush"] {
  const text = raw?.ayushText?.toLowerCase() ?? "";
  const numeric = toNumber(raw?.ayushLimitValue ?? null);

  if (!text && numeric === null) {
    return {
      covered: false,
      limitType: "not_covered",
      limitValue: null
    };
  }

  if (text.includes("not covered")) {
    return {
      covered: false,
      limitType: "not_covered",
      limitValue: null
    };
  }

  if (text.includes("up to si") || text.includes("upto si") || text.includes("sum insured")) {
    return {
      covered: true,
      limitType: "up_to_SI",
      limitValue: null
    };
  }

  if (text.includes("%") || (numeric !== null && numeric <= 100 && text.includes("%"))) {
    const percent = numeric ?? toNumber(text);
    return {
      covered: true,
      limitType: "percent",
      limitValue: percent
    };
  }

  if (numeric !== null) {
    return {
      covered: true,
      limitType: "rupee_cap",
      limitValue: numeric
    };
  }

  return {
    covered: true,
    limitType: "up_to_SI",
    limitValue: null
  };
}

function parseRecharge(text?: string): Bonuses["recharge"] {
  const normalized = text?.toLowerCase() ?? "";
  if (!normalized) {
    return { type: "na", sameIllnessAllowed: null };
  }
  if (normalized.includes("unlimited")) {
    return { type: "unlimited", sameIllnessAllowed: normalized.includes("same illness") };
  }
  if (normalized.includes("twice")) {
    return { type: "twice", sameIllnessAllowed: normalized.includes("same illness") };
  }
  if (normalized.includes("once") || normalized.includes("one-time") || normalized.includes("one time")) {
    return { type: "once", sameIllnessAllowed: normalized.includes("same illness") };
  }
  return { type: "na", sameIllnessAllowed: null };
}

function parseNCB(text?: string): Bonuses["ncb"] {
  const normalized = text?.toLowerCase() ?? "";
  const accrualMatch = normalized.match(/(\d{1,3})\s*%/);
  const capMatch = normalized.match(/max(?:imum)?\s*(\d{1,3})\s*%/);

  const accrual = accrualMatch ? Number.parseFloat(accrualMatch[1]) : null;
  const cap = capMatch ? Number.parseFloat(capMatch[1]) : accrual !== null ? accrual * 2 : null;

  let impact: "reduces" | "no_impact" | null = null;
  if (normalized.includes("reduce")) {
    impact = "reduces";
  } else if (normalized.includes("no impact") || normalized.includes("protected")) {
    impact = "no_impact";
  }

  return {
    accrualPerYearPercent: accrual,
    maxCapPercent: cap,
    claimImpact: impact
  };
}

function parseWaitingPeriods(raw?: RawExtract["waitingPeriods"]): WaitingPeriods {
  const initial = toInteger(raw?.initialDays) ?? 30;
  const specific = toInteger(raw?.specificAilmentsMonths) ?? 24;
  const ped = toInteger(raw?.pedMonths) ?? 48;

  return {
    initialDays: initial,
    specificAilmentsMonths: specific,
    pedMonths: ped,
    reductionOptions: {
      specificAilments: raw?.reductionSpecific ?? false,
      ped: raw?.reductionPed ?? false
    }
  };
}

function parseCopay(raw?: RawExtract["copay"]): CopayAndZones {
  const mapping: Record<string, CopayAndZones["mandatory"]> = {
    none: "none",
    age: "age",
    zone: "zone",
    network: "network",
    disease: "disease_specific",
    disease_specific: "disease_specific"
  };
  const typeRaw = raw?.mandatoryType?.toLowerCase() ?? "none";
  const mandatory = mapping[typeRaw] ?? "none";
  const percent =
    mandatory === "none" ? null : toNumber(raw?.mandatoryPercent ?? null);

  return {
    mandatory,
    mandatoryPercent: percent,
    optionalCopayAvailable: raw?.optionalAvailable ?? false
  };
}

function parseCataract(text?: string): Sublimits["cataract"] {
  const normalized = text?.toLowerCase() ?? "";
  if (!normalized || normalized.includes("no sub-limit") || normalized.includes("not applicable")) {
    return {
      type: "not_applicable",
      value: null,
      perEye: null
    };
  }

  if (normalized.includes("%")) {
    const match = normalized.match(/(\d{1,3})\s*%/);
    const value = match ? Number.parseFloat(match[1]) : null;
    const perEye = normalized.includes("per eye");
    return {
      type: "percent_of_SI",
      value,
      perEye
    };
  }

  const numeric = toNumber(normalized);
  if (numeric !== null) {
    return {
      type: "rupee_cap",
      value: numeric,
      perEye: normalized.includes("per eye")
    };
  }

  return {
    type: "not_applicable",
    value: null,
    perEye: null
  };
}

function parseDiseaseSublimits(
  items?: Array<{ name: string; type: string; value: number | string }>
): Sublimits["diseaseSpecific"] {
  if (!items) {
    return [];
  }
  return items.map((item) => ({
    name: item.name,
    type: item.type === "percent" ? "percent" : "rupee_cap",
    value: toNumber(item.value) ?? 0
  }));
}

function parseValueAdds(raw?: RawExtract["valueAdds"]): ValueAdds {
  return {
    annualHealthCheckup: raw?.annualHealthCheckup ?? false,
    eConsult: raw?.eConsult ?? false,
    wellnessBenefits: raw?.wellnessBenefits ?? false,
    others: raw?.others ?? []
  };
}

function parseTopUp(isTopUp: boolean, raw?: RawExtract["topUpSpecifics"]): TopUpSpecifics {
  const coverage = raw?.coverageList ?? [];
  return {
    howDeductibleApplies: (isTopUp ? raw?.howDeductibleApplies : null) as TopUpSpecifics["howDeductibleApplies"],
    coverageAboveDeductible: coverage.filter((item) => ["IPD", "daycare", "AYUSH", "pre_post"].includes(item)) as TopUpSpecifics["coverageAboveDeductible"],
    roomRuleOnTopUp: (isTopUp ? raw?.roomRule ?? null : null) as TopUpSpecifics["roomRuleOnTopUp"],
    rechargeOnTopUp: raw?.recharge === "available" ? "available" : "na",
    ncbOnTopUp: raw?.ncb === "available" ? "available" : "na"
  };
}

function parseTransport(raw?: RawExtract["transport"]): TransportCover {
  return {
    roadAmbulanceLimit: toNumber(raw?.roadAmbulanceLimit ?? null),
    airAmbulance: raw?.airAmbulance === "covered" ? "covered" : raw?.airAmbulance === "optional" ? "optional" : "not_covered",
    airAmbulanceLimit: toNumber(raw?.airAmbulanceLimit ?? null)
  };
}

function parseOrganDonor(raw?: RawExtract["organDonor"]): OrganDonor {
  const notes = raw?.notes ?? null;
  if (!notes) {
    return {
      covered: raw?.covered ?? true,
      notes: null
    };
  }
  const lower = notes.toLowerCase();
  return {
    covered: raw?.covered ?? !lower.includes("not covered"),
    notes
  };
}

function parseDeductible(isTopUp: boolean, raw?: RawExtract["deductible"]): Deductible {
  const applies = raw?.applies ?? isTopUp;
  const type = applies ? (raw?.type === "per_claim" ? "per_claim" : "per_year") : null;
  const amount = applies ? toNumber(raw?.amount ?? null) : null;
  return {
    applies,
    type,
    amount,
    aggregateApplies: raw?.aggregateApplies ?? (type === "per_year" ? true : null)
  };
}

function parseSumInsured(raw?: RawExtract["sumInsured"]): SumInsured {
  const base = toNumber(raw?.baseSI ?? null) ?? 500000;
  const bands = (raw?.bands ?? [])
    .map((value) => toNumber(value) ?? undefined)
    .filter((value): value is number => value !== undefined);

  if (!bands.includes(base)) {
    bands.push(base);
  }

  bands.sort((a, b) => a - b);

  return {
    baseSI: base,
    currency: raw?.currency ?? "INR",
    availableBands: [...new Set(bands)],
    unlimitedOneClaim: raw?.unlimitedOneClaim ?? false
  };
}

function parseProductInfo(raw: RawExtract["product"]): ProductInfo {
  return {
    insurer: raw.insurer,
    planName: raw.planName,
    variant: raw.variant ?? null,
    uin: raw.uin ?? null,
    policyType: raw.policyType === "Floater" ? "Floater" : "Individual",
    isTopUp: raw.isTopUp ?? false,
    geography: raw.geography ?? DEFAULT_COUNTRY
  };
}

function buildNotes(rawNotes?: string[]): string | null {
  if (!rawNotes || rawNotes.length === 0) {
    return null;
  }
  const unique = Array.from(new Set(rawNotes.map((item) => item.trim()).filter(Boolean)));
  return unique.length ? unique.join(" | ") : null;
}

export function normalize(raw: RawExtract): HealthProduct {
  const isTopUp = raw.product.isTopUp ?? false;
  const product = parseProductInfo(raw.product);
  const sumInsured = parseSumInsured(raw.sumInsured);
  const deductible = parseDeductible(isTopUp, raw.deductible);
  const roomRent = parseRoomRent(raw.roomRent);

  const hospitalization: Hospitalization = {
    inpatient: raw.hospitalization?.inpatientCovered === false ? "not_covered" : "covered",
    daycare: ((): Hospitalization["daycare"] => {
      const daycareText = raw.hospitalization?.daycare?.toLowerCase() ?? "";
      if (daycareText.includes("all listed")) {
        return "all_listed";
      }
      if (daycareText.includes("all") && daycareText.includes("procedures")) {
        return "all";
      }
      if (daycareText.includes("not covered")) {
        return "not_covered";
      }
      if (daycareText.includes("limited") || daycareText.includes("list")) {
        return "limited_list";
      }
      return "all_listed";
    })(),
    preHospDays: toInteger(raw.hospitalization?.preHospDays ?? null) ?? 30,
    postHospDays: toInteger(raw.hospitalization?.postHospDays ?? null) ?? 60,
    domiciliary: {
      covered: raw.hospitalization?.domiciliary?.covered ?? false,
      minDays: toInteger(raw.hospitalization?.domiciliary?.minDays ?? null),
      negativeListPresent: raw.hospitalization?.domiciliary?.negativeListPresent ?? false,
      notes: raw.hospitalization?.domiciliary?.notes ?? null
    },
    ayush: parseAyush(raw.hospitalization)
  };

  const transport = parseTransport(raw.transport);
  const organDonor = parseOrganDonor(raw.organDonor);
  const bonuses: Bonuses = {
    ncb: parseNCB(raw.bonuses?.ncbText),
    recharge: parseRecharge(raw.bonuses?.rechargeText)
  };
  const waitingPeriods = parseWaitingPeriods(raw.waitingPeriods);
  const copay = parseCopay(raw.copay);
  const sublimits: Sublimits = {
    cataract: parseCataract(raw.sublimits?.cataractText),
    diseaseSpecific: parseDiseaseSublimits(raw.sublimits?.diseaseSpecific)
  };
  const valueAdds = parseValueAdds(raw.valueAdds);
  const topUp = parseTopUp(product.isTopUp, raw.topUpSpecifics);

  const notes = buildNotes(raw.notes);

  const provenance = {
    sourceType: raw.provenance.sourceType,
    sourceName: raw.provenance.sourceName,
    sourceDate: raw.provenance.sourceDate,
    extractionConfidence: raw.provenance.extractionConfidence ?? 0.5
  };

  return {
    product,
    sumInsured,
    deductible,
    roomRent,
    hospitalization,
    transport,
    organDonor,
    bonuses,
    waitingPeriods,
    copayAndZones: copay,
    sublimits,
    valueAdds,
    topUpSpecifics: topUp,
    provenance,
    notes
  };
}
