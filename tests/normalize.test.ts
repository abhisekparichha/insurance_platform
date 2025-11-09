import { describe, expect, it } from "vitest";
import { normalize, type RawExtract } from "../src/normalize";
import { validateHealthProduct } from "../models/health_types";

describe("normalize", () => {
  it("normalizes raw extract into schema-compliant health product", () => {
    const raw: RawExtract = {
      product: {
        insurer: "Test Insurer",
        planName: "Test Health Plan",
        variant: "Gold",
        uin: "TESTUIN2025",
        policyType: "Floater",
        isTopUp: false,
        geography: "IN"
      },
      sumInsured: {
        baseSI: "750000",
        currency: "INR",
        bands: ["500000", "1000000"],
        unlimitedOneClaim: false
      },
      deductible: {
        applies: false,
        type: null,
        amount: null,
        aggregateApplies: null
      },
      roomRent: {
        text: "Room rent capped at 1% of SI, single private room upgrade optional",
        icuText: "ICU limit 2% of SI",
        addonInfo: "Proportionate deduction waiver available",
        upgradeOption: true
      },
      hospitalization: {
        inpatientCovered: true,
        daycare: "All procedures covered",
        preHospDays: "60",
        postHospDays: "120",
        domiciliary: {
          covered: true,
          minDays: "2",
          negativeListPresent: false,
          notes: null
        },
        ayushText: "AYUSH up to SI"
      },
      bonuses: {
        ncbText: "50% increase every claim-free year up to 150%, no impact after claims",
        rechargeText: "Unlimited recharge even for same illness"
      },
      waitingPeriods: {
        initialDays: "30",
        specificAilmentsMonths: "24",
        pedMonths: "36",
        reductionSpecific: true,
        reductionPed: true
      },
      copay: {
        mandatoryType: "none",
        mandatoryPercent: null,
        optionalAvailable: false
      },
      sublimits: {
        cataractText: "Cataract limit not applicable"
      },
      valueAdds: {
        annualHealthCheckup: true,
        eConsult: true,
        wellnessBenefits: true,
        others: ["Second opinion"]
      },
      topUpSpecifics: {
        howDeductibleApplies: null,
        coverageList: [],
        roomRule: null,
        recharge: "na",
        ncb: "na"
      },
      transport: {
        roadAmbulanceLimit: "15000",
        airAmbulance: "optional",
        airAmbulanceLimit: "300000"
      },
      provenance: {
        sourceType: "policy_pdf",
        sourceName: "Test Plan Brochure",
        sourceDate: "2025-01-15",
        extractionConfidence: 0.7
      },
      notes: ["Manual extraction of cataract clause"]
    };

    const product = normalize(raw);
    const validation = validateHealthProduct(product);

    expect(validation.valid).toBe(true);
    expect(product.roomRent.limitType).toBe("percent_of_SI");
    expect(product.roomRent.limitValue).toBe(1);
    expect(product.roomRent.proportionateDeduction).toBe("waived_with_addon");
    expect(product.hospitalization.ayush.limitType).toBe("up_to_SI");
    expect(product.sumInsured.availableBands).toContain(750000);
    expect(product.notes).toContain("Manual extraction");
  });
});
