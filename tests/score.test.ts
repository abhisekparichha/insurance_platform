import { describe, expect, it } from "vitest";
import baseExample from "../src/examples/base_single_private.json" assert { type: "json" };
import topUpExample from "../src/examples/topup_aggregate.json" assert { type: "json" };
import { validateHealthProduct, type HealthProduct } from "../models/health_types";
import { scoreProduct } from "../src/score";

function expectValid(product: unknown): asserts product is HealthProduct {
  const result = validateHealthProduct(product);
  if (!result.valid) {
    throw new Error(`Validation failed: ${(result.errors ?? []).join(", ")}`);
  }
}

describe("scoreProduct", () => {
  it("scores the base plan with strong benefits", () => {
    expectValid(baseExample);
    const evaluation = scoreProduct(baseExample);

    expect(evaluation.productRef.planName).toBe("Acme Shield Health");
    const roomRent = evaluation.scores.find((item) => item.parameter === "room_rent");
    expect(roomRent?.rating).toBe("Good");

    const topUp = evaluation.scores.find((item) => item.parameter === "topup_friendliness");
    expect(topUp?.rating).toBe("OK");

    expect(evaluation.overall.weightedScore).toBeGreaterThan(85);
    expect(evaluation.overall.grade).toBe("A");
  });

  it("scores the aggregate deductible plan with top-up emphasis", () => {
    expectValid(topUpExample);
    const evaluation = scoreProduct(topUpExample);

    const topUpScore = evaluation.scores.find((item) => item.parameter === "topup_friendliness");
    expect(topUpScore?.rating).toBe("Good");
    expect(topUpScore?.score ?? 0).toBeGreaterThan(80);

    const copayScore = evaluation.scores.find((item) => item.parameter === "copay");
    expect(copayScore?.rating).toBe("OK");

    expect(evaluation.overall.weightedScore).toBeGreaterThan(75);
    expect(["A", "B"]).toContain(evaluation.overall.grade);
  });
});
