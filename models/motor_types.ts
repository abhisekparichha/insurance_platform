import type { Provenance } from "./health_types";

export type MotorVehicleType = "pvt_car" | "two_wheeler";

// IDV adequacy captures whether the declared value reflects actual market value.
// A ratio < 0.9 means the vehicle is underinsured; > 1.0 means overinsured.
export interface MotorIDV {
  declaredValue: number;
  estimatedMarketValue: number | null; // null if unknown; adequacy score uses ratio
  currency: string;
}

// Each add-on is a boolean flag. Absence = not available in the base plan
// (either not offered or must be purchased separately at extra cost).
export interface MotorAddOns {
  zeroDepreciation: boolean;
  engineProtection: boolean;        // hydrostatic lock, oil leakage to engine
  consumablesCover: boolean;        // oils, nuts, bolts during repair
  returnToInvoice: boolean;         // gap cover: invoice value vs IDV on total loss
  ncbProtection: boolean;           // preserves no-claim bonus after one claim
  roadsideAssistance: boolean;
  keyReplacement: boolean;
  tyreProtection: boolean;
}

// Two-wheeler only: personal accident cover quality for rider + pillion.
export interface PersonalAccidentCover {
  riderCoverAmount: number;         // mandatory PA cover for owner-driver (₹)
  pillionCoverAvailable: boolean;
  pillionCoverAmount: number | null;
}

// Insurer reliability metrics for motor (separate from life/health CSR).
export interface MotorInsurerMetrics {
  motorCsr: number;            // Motor-specific claim settlement ratio (0–100)
  complaintsPerTenK: number;   // Complaints per 10,000 motor claims
  networkGarages: number;      // Cashless garage network size
}

export interface MotorProduct {
  product: {
    insurer: string;
    planName: string;
    vehicleType: MotorVehicleType;
    uin: string | null;
  };
  idv: MotorIDV;
  addOns: MotorAddOns;
  personalAccident: PersonalAccidentCover | null; // required for two_wheeler; optional for car
  insurer: MotorInsurerMetrics;
  annualPremium: number | null;
  provenance: Provenance;
}
