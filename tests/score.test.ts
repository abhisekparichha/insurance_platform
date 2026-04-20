import { describe, expect, it } from "vitest";
import baseExample from "../src/examples/base_single_private.json" assert { type: "json" };
import topUpExample from "../src/examples/topup_aggregate.json" assert { type: "json" };
import termExample from "../src/examples/term_example.json" assert { type: "json" };
import motorCarExample from "../src/examples/motor_pvt_car_example.json" assert { type: "json" };
import motorTwoWheelerExample from "../src/examples/motor_two_wheeler_example.json" assert { type: "json" };
import { validateHealthProduct, type HealthProduct } from "../models/health_types";
import { scoreProduct, scoreTermProduct, scoreMotorProduct } from "../src/score";
import type { TermProduct } from "../models/term_types";
import type { MotorProduct } from "../models/motor_types";

function expectValid(product: unknown): asserts product is HealthProduct {
  const result = validateHealthProduct(product);
  if (!result.valid) {
    throw new Error(`Validation failed: ${(result.errors ?? []).join(", ")}`);
  }
}

describe("scoreProduct — health base plan", () => {
  it("scores a strong base plan as A or A+", () => {
    expectValid(baseExample);
    const evaluation = scoreProduct(baseExample);

    expect(evaluation.productRef.planName).toBe("Acme Shield Health");

    // topup_friendliness must NOT appear — base plans exclude it
    const topUpParam = evaluation.scores.find((s) => s.parameter === "topup_friendliness");
    expect(topUpParam).toBeUndefined();

    // disease_sublimits MUST appear for base plans
    const dsParam = evaluation.scores.find((s) => s.parameter === "disease_sublimits");
    expect(dsParam).toBeDefined();
    expect(dsParam?.rating).toBe("Good"); // fixture has no disease sublimits

    // Room rent on single private room should score well
    const roomRent = evaluation.scores.find((s) => s.parameter === "room_rent");
    expect(roomRent?.rating).toBe("Good");

    // A plan with no copay, no sublimits, unlimited recharge, PED reduction should score high
    expect(evaluation.overall.weightedScore).toBeGreaterThan(80);
    expect(["A", "A+"]).toContain(evaluation.overall.grade);
  });
});

describe("scoreProduct — health top-up plan", () => {
  it("scores aggregate deductible top-up with topup_friendliness driving the result", () => {
    expectValid(topUpExample);
    const evaluation = scoreProduct(topUpExample);

    // topup_friendliness MUST appear for top-up plans
    const topUpScore = evaluation.scores.find((s) => s.parameter === "topup_friendliness");
    expect(topUpScore).toBeDefined();
    expect(topUpScore?.rating).toBe("Good");
    expect(topUpScore?.score ?? 0).toBeGreaterThan(80);

    // disease_sublimits must NOT appear for top-up plans
    const dsParam = evaluation.scores.find((s) => s.parameter === "disease_sublimits");
    expect(dsParam).toBeUndefined();

    const copayScore = evaluation.scores.find((s) => s.parameter === "copay");
    expect(copayScore?.rating).toBe("OK");

    expect(evaluation.overall.weightedScore).toBeGreaterThan(70);
    expect(["A", "B"]).toContain(evaluation.overall.grade);
  });
});

describe("scoreTermProduct", () => {
  it("scores a strong term plan as A or A+", () => {
    const product = termExample as unknown as TermProduct;
    const evaluation = scoreTermProduct(product);

    expect(evaluation.productRef.planName).toBe("Smart Term Plan Plus");

    const csr = evaluation.scores.find((s) => s.parameter === "claim_settlement_ratio");
    expect(csr?.rating).toBe("Good"); // 99.65% → score 100

    const asr = evaluation.scores.find((s) => s.parameter === "amount_settlement_ratio");
    expect(asr?.rating).toBe("Good"); // 95.20% → score 100

    const riders = evaluation.scores.find((s) => s.parameter === "riders_quality");
    expect(riders?.rating).toBe("Good"); // CI 64 illnesses + TI + WOP + ADB

    expect(evaluation.overall.weightedScore).toBeGreaterThan(80);
    expect(["A", "A+"]).toContain(evaluation.overall.grade);
  });
});

describe("scoreMotorProduct — private car", () => {
  it("scores a well-specced car policy as A or A+", () => {
    const product = motorCarExample as unknown as MotorProduct;
    const evaluation = scoreMotorProduct(product);

    expect(evaluation.productRef.insurer).toBe("HDFC ERGO General Insurance");
    expect(evaluation.productRef.variant).toBe("Private Car");

    // All key add-ons present → top scores
    const zd = evaluation.scores.find((s) => s.parameter === "zero_depreciation");
    expect(zd?.score).toBe(100);

    const ep = evaluation.scores.find((s) => s.parameter === "engine_protection");
    expect(ep?.score).toBe(100);

    // personal_accident must NOT appear for private car
    const pa = evaluation.scores.find((s) => s.parameter === "personal_accident");
    expect(pa).toBeUndefined();

    expect(evaluation.overall.weightedScore).toBeGreaterThan(85);
    expect(["A", "A+"]).toContain(evaluation.overall.grade);
  });
});

describe("scoreMotorProduct — two wheeler", () => {
  it("scores a two-wheeler policy and checks PA is present", () => {
    const product = motorTwoWheelerExample as unknown as MotorProduct;
    const evaluation = scoreMotorProduct(product);

    expect(evaluation.productRef.variant).toBe("Two Wheeler");

    // return_to_invoice must NOT appear for two-wheelers
    const rti = evaluation.scores.find((s) => s.parameter === "return_to_invoice");
    expect(rti).toBeUndefined();

    // personal_accident MUST appear for two-wheelers
    const pa = evaluation.scores.find((s) => s.parameter === "personal_accident");
    expect(pa).toBeDefined();
    expect(pa?.rating).toBe("Good"); // ₹15L rider + pillion ₹1L

    const zd = evaluation.scores.find((s) => s.parameter === "zero_depreciation");
    expect(zd?.score).toBe(100);

    expect(evaluation.overall.weightedScore).toBeGreaterThan(70);
  });
});
