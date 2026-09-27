import { describe, it, expect } from "vitest";
import { getLabsPilotUrl, buildLabsRequestUrl, LABS_REQUEST_OPTIONS } from "@/lib/labsPilot";

describe("labs pilot config", () => {
  it("returns null when unset or invalid", () => {
    expect(getLabsPilotUrl(undefined)).toBeNull();
    expect(getLabsPilotUrl("  ")).toBeNull();
    expect(getLabsPilotUrl("not a url")).toBeNull();
    expect(getLabsPilotUrl("http://example.com")).toBeNull();
  });
  it("accepts https and tags the request kind without health data", () => {
    const base = getLabsPilotUrl("https://labs.example.com/start")!;
    const url = new URL(buildLabsRequestUrl(base, "combined"));
    expect(url.searchParams.get("request")).toBe("combined");
    expect([...url.searchParams.keys()].sort()).toEqual(["request", "source"]);
  });
  it("never names fulfilment vendors to patients", () => {
    const text = JSON.stringify(LABS_REQUEST_OPTIONS).toLowerCase();
    expect(text).not.toMatch(/quest|fullscript/);
  });
});
