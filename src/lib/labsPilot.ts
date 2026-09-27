/**
 * Vizzhy Labs pilot front door. Requests are handed off to the pilot URL;
 * Reveal never places, pays for or tracks an order itself.
 */
export type LabsRequestKind = "clinical" | "multiomics" | "combined";

export const LABS_REQUEST_OPTIONS: { kind: LabsRequestKind; title: string; description: string }[] = [
  { kind: "clinical", title: "Clinical labs", description: "Standard blood work such as lipids, metabolic markers and blood counts." },
  { kind: "multiomics", title: "Vizzhy Multiomics Draw", description: "A deeper molecular picture from a single draw, beyond routine labs." },
  { kind: "combined", title: "Combined Clinical + Multiomics", description: "Both together, from one collection where possible." },
];

export function getLabsPilotUrl(raw: string | undefined = import.meta.env.VITE_VIZZHY_LABS_PILOT_URL): string | null {
  if (!raw || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function buildLabsRequestUrl(base: string, kind: LabsRequestKind): string {
  const u = new URL(base);
  u.searchParams.set("request", kind);
  u.searchParams.set("source", "reveal");
  return u.toString();
}
