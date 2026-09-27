import { describe, it, expect } from "vitest";
import { DEFAULT_LABS_PILOT_URL, getLabsPilotUrl, buildLabsRequestUrl, LABS_REQUEST_OPTIONS } from "@/lib/labsPilot";

describe("labs pilot config", () => {
  it("falls back to the published pilot front door when unset", () => {
    expect(DEFAULT_LABS_PILOT_URL).toBe("https://patient-axis-insight.lovable.app/labs/pilot");
    expect(getLabsPilotUrl("")).toBe(DEFAULT_LABS_PILOT_URL);
    expect(getLabsPilotUrl("  ")).toBe(DEFAULT_LABS_PILOT_URL);
    expect(getLabsPilotUrl(undefined)).toBe(DEFAULT_LABS_PILOT_URL);
  });
  it("uses a valid https override and rejects invalid ones", () => {
    expect(getLabsPilotUrl("https://override.example.com/x")).toBe("https://override.example.com/x");
    expect(getLabsPilotUrl("not a url")).toBeNull();
    expect(getLabsPilotUrl("http://example.com")).toBeNull();
  });
  it("accepts https and tags the request kind without health data", () => {
    const base = getLabsPilotUrl("")!;
    const url = new URL(buildLabsRequestUrl(base, "combined"));
    expect(url.origin + url.pathname).toBe(DEFAULT_LABS_PILOT_URL);
    expect(url.searchParams.get("request")).toBe("combined");
    expect(url.searchParams.get("source")).toBe("reveal");
    expect([...url.searchParams.keys()].sort()).toEqual(["request", "source"]);
  });
  it("never names fulfilment vendors to patients", () => {
    const text = JSON.stringify(LABS_REQUEST_OPTIONS).toLowerCase();
    expect(text).not.toMatch(/quest|fullscript/);
  });
});
