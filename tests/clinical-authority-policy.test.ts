import { describe, it, expect } from "vitest";
import {
  validateInterpreterRole,
} from "@shared/clinicalAuthorityPolicy";
import {
  computeDosePolicyContext,
  validateDoseTokens,
  detectEmergencyIntent,
  extractDoseTokens,
} from "@shared/dosePolicy";

describe("clinical authority — interpreter role", () => {
  it("passes a clean biological interpretation", () => {
    const text = "Your ApoB at 102 mg/dL alongside an LDL-C of 148 mg/dL points to elevated particle burden. The pattern is worth bringing to your physician.";
    const result = validateInterpreterRole(text);
    expect(result.valid).toBe(true);
  });

  it("catches dosing directive: 'you should take vitamin D'", () => {
    const text = "Based on your levels, you should take vitamin D daily.";
    const result = validateInterpreterRole(text);
    expect(result.valid).toBe(false);
    expect(result.violations[0].kind).toBe("dosing_directive");
  });

  it("catches escalation directive", () => {
    const text = "I'd suggest you increase to a higher dose given your levels.";
    const result = validateInterpreterRole(text);
    expect(result.valid).toBe(false);
    expect(result.violations[0].kind).toBe("escalation_directive");
  });

  it("catches medication substitution", () => {
    const text = "You could switch from atorvastatin to rosuvastatin for better tolerance.";
    const result = validateInterpreterRole(text);
    expect(result.valid).toBe(false);
    expect(result.violations[0].kind).toBe("medication_substitution");
  });

  it("catches protocol directive", () => {
    const text = "Here's your protocol: morning B-complex, evening magnesium, weekly retest.";
    const result = validateInterpreterRole(text);
    expect(result.valid).toBe(false);
    expect(result.violations[0].kind).toBe("protocol_directive");
  });

  it("catches optimization claim", () => {
    const text = "Berberine is the right choice for you given your insulin patterns.";
    const result = validateInterpreterRole(text);
    expect(result.valid).toBe(false);
    expect(result.violations[0].kind).toBe("optimization_claim");
  });

  it("does not falsely fire on educational mechanism explanation", () => {
    const text = "Vitamin D plays a role in calcium absorption and immune regulation. Some people with low levels feel meaningful changes when they correct it; that's a question for your clinician.";
    const result = validateInterpreterRole(text);
    expect(result.valid).toBe(true);
  });
});

describe("dose policy — emergency intent", () => {
  it("detects 'overdose' as emergency intent", () => {
    expect(detectEmergencyIntent("did I overdose on melatonin?")).toBe(true);
  });

  it("detects 'too much' as emergency intent", () => {
    expect(detectEmergencyIntent("is 1g of melatonin too much?")).toBe(true);
  });

  it("detects 'accidentally took' as emergency intent", () => {
    expect(detectEmergencyIntent("I accidentally took two doses")).toBe(true);
  });

  it("detects 'child swallowed' as emergency intent", () => {
    expect(detectEmergencyIntent("my child swallowed some of my supplements")).toBe(true);
  });

  it("does not falsely flag 'how much should I take'", () => {
    expect(detectEmergencyIntent("how much vitamin D should I take?")).toBe(false);
  });
});

describe("dose policy — token extraction", () => {
  it("catches abbreviated units", () => {
    const tokens = extractDoseTokens("1g of melatonin and 5000 IU of vitamin D");
    expect(tokens).toContain("1g");
    expect(tokens).toContain("5000 iu");
  });

  it("catches spelled-out units", () => {
    const tokens = extractDoseTokens("you took 1 gram which is 1,000 milligrams");
    expect(tokens.some((t) => t.includes("gram"))).toBe(true);
    expect(tokens.some((t) => t.includes("milligram"))).toBe(true);
  });

  it("does not crash on unit-less numbers", () => {
    const tokens = extractDoseTokens("your ApoB is 102 and your LDL-C is 148");
    expect(tokens.length).toBeGreaterThanOrEqual(0);
  });
});

describe("dose policy — context computation", () => {
  it("emergency intent + dose token → emergency_routing with allowed user dose", () => {
    const ctx = computeDosePolicyContext("is 1g of melatonin too much?");
    expect(ctx.routingMode).toBe("emergency_routing");
    expect(ctx.userMentionedDose).toBe(true);
    expect(ctx.allowedDoseTokens).toContain("1g");
  });

  it("no emergency, no dose → no routing", () => {
    const ctx = computeDosePolicyContext("what's happening in my lipid cluster?");
    expect(ctx.routingMode).toBe("none");
    expect(ctx.userMentionedDose).toBe(false);
  });

  it("dose mentioned without emergency intent → no routing", () => {
    const ctx = computeDosePolicyContext("should I take 5000 IU vitamin D?");
    expect(ctx.routingMode).toBe("none");
    expect(ctx.userMentionedDose).toBe(true);
    expect(ctx.allowedDoseTokens.length).toBe(0);
  });
});

describe("dose policy — output validation", () => {
  it("model output with unauthorized dose tokens fails", () => {
    const ctx = computeDosePolicyContext("how much vitamin D should I take?");
    const result = validateDoseTokens("Try 5000 IU daily with food.", ctx);
    expect(result.valid).toBe(false);
    expect(result.unauthorizedTokens).toContain("5000 iu");
  });

  it("model output repeating user-stated emergency dose passes", () => {
    const ctx = computeDosePolicyContext("is 1g of melatonin too much?");
    const result = validateDoseTokens(
      "You mentioned 1g, which may be a safety concern. Contact Poison Control at 1-800-222-1222.",
      ctx,
    );
    expect(result.unauthorizedTokens).not.toContain("1g");
  });
});
