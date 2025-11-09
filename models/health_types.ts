import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import addErrors from "ajv-errors";
import healthSchema from "./health_schema.json" with { type: "json" };

export type PolicyType = "Individual" | "Floater";
export type RoomLimitType = "no_cap" | "single_private_room" | "twin_sharing" | "percent_of_SI" | "rupee_cap";
export type HospitalizationDaycare = "all" | "all_listed" | "limited_list" | "not_covered";
export type ProportionateDeduction = "applies" | "waived_with_addon" | "not_applicable";
export type RechargeType = "unlimited" | "once" | "twice" | "na";
export type CopayMandatory = "none" | "age" | "zone" | "network" | "disease_specific";
export type CataractLimitType = "percent_of_SI" | "rupee_cap" | "not_applicable";
export type TopUpHow = "aggregate_year" | "per_claim" | null;
export type TopUpCoverageItem = "IPD" | "daycare" | "AYUSH" | "pre_post";

export interface NullableStringFields {
  variant: string | null;
  uin: string | null;
}

export interface ProductInfo {
  insurer: string;
  planName: string;
  variant: string | null;
  uin: string | null;
  policyType: PolicyType;
  isTopUp: boolean;
  geography: string;
}

export interface SumInsured {
  baseSI: number;
  currency: string;
  availableBands: number[];
  unlimitedOneClaim: boolean;
}

export interface Deductible {
  applies: boolean;
  type: "per_year" | "per_claim" | null;
  amount: number | null;
  aggregateApplies: boolean | null;
}

export interface RoomRent {
  limitType: RoomLimitType;
  limitValue: number | null;
  icuLimitType: "no_cap" | "percent_of_SI" | "rupee_cap";
  icuLimitValue: number | null;
  proportionateDeduction: ProportionateDeduction;
  roomModifierOption: boolean;
}

export interface Domiciliary {
  covered: boolean;
  minDays: number | null;
  negativeListPresent: boolean;
  notes: string | null;
}

export interface AyushLimit {
  covered: boolean;
  limitType: "up_to_SI" | "percent" | "rupee_cap" | "not_covered";
  limitValue: number | null;
}

export interface Hospitalization {
  inpatient: "covered" | "not_covered";
  daycare: HospitalizationDaycare;
  preHospDays: number;
  postHospDays: number;
  domiciliary: Domiciliary;
  ayush: AyushLimit;
}

export interface TransportCover {
  roadAmbulanceLimit: number | null;
  airAmbulance: "covered" | "optional" | "not_covered";
  airAmbulanceLimit: number | null;
}

export interface OrganDonor {
  covered: boolean;
  notes: string | null;
}

export interface NoClaimBonus {
  accrualPerYearPercent: number | null;
  maxCapPercent: number | null;
  claimImpact: "reduces" | "no_impact" | null;
}

export interface Recharge {
  type: RechargeType;
  sameIllnessAllowed: boolean | null;
}

export interface Bonuses {
  ncb: NoClaimBonus;
  recharge: Recharge;
}

export interface WaitingReductionOptions {
  specificAilments: boolean;
  ped: boolean;
}

export interface WaitingPeriods {
  initialDays: number;
  specificAilmentsMonths: number;
  pedMonths: number;
  reductionOptions: WaitingReductionOptions;
}

export interface CopayAndZones {
  mandatory: CopayMandatory;
  mandatoryPercent: number | null;
  optionalCopayAvailable: boolean;
}

export interface CataractSublimit {
  type: CataractLimitType;
  value: number | null;
  perEye: boolean | null;
}

export interface DiseaseSpecificSublimit {
  name: string;
  type: "percent" | "rupee_cap";
  value: number;
}

export interface Sublimits {
  cataract: CataractSublimit;
  diseaseSpecific: DiseaseSpecificSublimit[];
}

export interface ValueAdds {
  annualHealthCheckup: boolean;
  eConsult: boolean;
  wellnessBenefits: boolean;
  others: string[];
}

export interface TopUpSpecifics {
  howDeductibleApplies: TopUpHow;
  coverageAboveDeductible: TopUpCoverageItem[];
  roomRuleOnTopUp: "same_as_base" | "plan_rule" | null;
  rechargeOnTopUp: "available" | "na";
  ncbOnTopUp: "available" | "na";
}

export interface Provenance {
  sourceType: "manual" | "policy_pdf" | "insurer_site" | "broker_portal";
  sourceName: string;
  sourceDate: string;
  extractionConfidence: number;
}

export interface HealthProduct {
  product: ProductInfo;
  sumInsured: SumInsured;
  deductible: Deductible;
  roomRent: RoomRent;
  hospitalization: Hospitalization;
  transport: TransportCover;
  organDonor: OrganDonor;
  bonuses: Bonuses;
  waitingPeriods: WaitingPeriods;
  copayAndZones: CopayAndZones;
  sublimits: Sublimits;
  valueAdds: ValueAdds;
  topUpSpecifics: TopUpSpecifics;
  provenance: Provenance;
  notes?: string | null;
}

const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
  allowUnionTypes: true
});
const applyFormats = addFormats as unknown as (ajvInstance: Ajv2020) => void;
const applyErrors = addErrors as unknown as (ajvInstance: Ajv2020) => void;
applyFormats(ajv);
applyErrors(ajv);

const validate = ajv.compile<HealthProduct>(healthSchema as unknown as Record<string, unknown>);

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors) {
    return [];
  }
  return errors.map((error) => {
    const instancePath = error.instancePath ? error.instancePath : "(root)";
    const message = error.message ?? "Invalid value";
    return `${instancePath}: ${message}`;
  });
}

export function validateHealthProduct(payload: unknown): ValidationResult {
  const valid = validate(payload);
  if (valid) {
    return { valid: true };
  }
  return {
    valid: false,
    errors: formatErrors(validate.errors)
  };
}

export default HealthProduct;
