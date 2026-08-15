import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

// ---------- Mocks ----------

// Auth + ViewAs: stable user identity
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/context/ViewAsContext", () => ({
  useViewAs: () => ({ effectiveUserId: "user-1" }),
}));

// CIE assessment context: completed CIE
const completedAssessment = {
  id: "cie-1",
  version: 1,
  status: "complete" as const,
  total_questions_answered: 75,
  triggered_domains: [],
  created_at: "2026-06-17T10:00:00.000Z",
  full_completed_at: "2026-06-17T10:05:00.000Z",
};
// Mutable so individual tests can vary the assessment's timestamps.
const assessmentState = { current: { ...completedAssessment } };
vi.mock("@/context/CIEAssessmentContext", () => ({
  useCIEAssessment: () => ({
    currentAssessment: assessmentState.current,
    domainScores: {},
    gateScores: {},
    isLoading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/context/LabUploadsContext", () => ({
  useLabUploads: () => ({ observations: [] }),
}));

// Supabase client mock that drives the test scenarios via mutable state.
type RenderRow = {
  id: string;
  version: number;
  status: string;
  patient_portrait: any;
  clinician_summary: any;
  generated_at: string;
  created_at: string;
  voice_validation_status: string | null;
  voice_validation_warnings: any[] | null;
};

const state: {
  renders: RenderRow[];
  invokeCalls: { name: string; body: any }[];
} = { renders: [], invokeCalls: [] };

const buildRender = (
  id: string,
  patientText: string,
  generatedAt: string,
): RenderRow => ({
  id,
  version: 1,
  status: "active",
  patient_portrait: {
    what_you_already_know: patientText,
    working_harder_than_you_realize: patientText,
    where_to_start: patientText,
    the_one_action: "Walk 20 minutes after dinner.",
  },
  clinician_summary: {
    terrain_overview: "stub",
    axis_breakdown: [],
    perception_gaps: [],
    suggested_questions: [],
  },
  generated_at: generatedAt,
  created_at: generatedAt,
  voice_validation_status: "passed",
  voice_validation_warnings: null,
});

function makeQuery(table: string) {
  const filters: Record<string, any> = {};
  const q: any = {
    select: () => q,
    eq: (col: string, val: any) => {
      filters[col] = val;
      return q;
    },
    order: () => q,
    limit: () => q,
    maybeSingle: async () => {
      if (table === "terrain_renders") {
        const status = filters["status"];
        const row = state.renders.find((r) => r.status === status) || null;
        return { data: row, error: null };
      }
      return { data: null, error: null };
    },
  };
  return q;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeQuery(table),
    functions: {
      invoke: async (name: string, opts: any) => {
        state.invokeCalls.push({ name, body: opts?.body });
        if (name === "cie-score-assessment") {
          return { data: { success: true }, error: null };
        }
        if (name === "generate-terrain-render") {
          // Simulate the edge function: succeed and publish a fresh render
          // that does NOT contain the stale CIE-not-done copy.
          state.renders = [
            buildRender(
              "r-fresh",
              "Your metabolic terrain is softening; we can see real signal in your CIE responses.",
              new Date().toISOString(),
            ),
          ];
          return { data: { success: true, id: "r-fresh", version: 2 }, error: null };
        }
        return { data: null, error: null };
      },
    },
  },
}));

// Import after mocks
import { TerrainRenderProvider, useTerrainRender } from "@/context/TerrainRenderContext";

function Probe() {
  const { activeRender, isLoading } = useTerrainRender();
  if (isLoading) return <div data-testid="state">loading</div>;
  const p = activeRender?.patient_portrait;
  const text = p
    ? [p.what_you_already_know, p.working_harder_than_you_realize, p.where_to_start, p.the_one_action].join(" ")
    : "";
  return (
    <div data-testid="state">
      <span data-testid="portrait">{text}</span>
    </div>
  );
}

beforeEach(() => {
  state.renders = [];
  state.invokeCalls = [];
  assessmentState.current = { ...completedAssessment };
});

afterEach(() => {
  vi.clearAllMocks();
});

const FORBIDDEN = [
  /cie has not been completed/i,
  /complete your cie assessment/i,
  /cie not done/i,
];

function assertNoCieNotDoneCopy(text: string) {
  for (const pat of FORBIDDEN) {
    expect(text).not.toMatch(pat);
  }
}

describe("Terrain auto-regeneration after CIE completion (regression)", () => {
  it("regenerates and clears stale 'CIE has not been completed' copy", async () => {
    // Seed: stale active render with the bad placeholder, generated BEFORE
    // the CIE was completed.
    state.renders = [
      buildRender(
        "r-stale",
        "Your terrain rendering cannot be generated yet because your CIE has not been completed.",
        "2026-06-17T09:00:00.000Z",
      ),
    ];

    render(
      <TerrainRenderProvider>
        <Probe />
      </TerrainRenderProvider>,
    );

    // Wait for the auto-regen to fire and the fresh render to be loaded.
    await waitFor(
      () => {
        expect(state.invokeCalls.some((c) => c.name === "generate-terrain-render")).toBe(true);
        const text = screen.getByTestId("portrait").textContent || "";
        expect(text.length).toBeGreaterThan(0);
        assertNoCieNotDoneCopy(text);
      },
      { timeout: 3000 },
    );
  });

  it("regenerates when no render exists despite a completed CIE", async () => {
    state.renders = [];

    render(
      <TerrainRenderProvider>
        <Probe />
      </TerrainRenderProvider>,
    );

    await waitFor(
      () => {
        expect(state.invokeCalls.some((c) => c.name === "generate-terrain-render")).toBe(true);
        const text = screen.getByTestId("portrait").textContent || "";
        assertNoCieNotDoneCopy(text);
      },
      { timeout: 3000 },
    );
  });

  it("regenerates for a back-dated factory import: created_at newer than the render wins", async () => {
    // Live case (Aug 15): an imported factory CIE carries its real intake
    // date (months in the past) in full_completed_at but ENTERS the system
    // at created_at. An active render generated before the import must be
    // considered stale, or the imported CIE never renders.
    assessmentState.current = {
      ...completedAssessment,
      full_completed_at: "2026-03-14T00:00:00.000Z", // real intake, back-dated
      created_at: "2026-06-17T10:20:00.000Z", // import time — newest signal
    };
    state.renders = [
      buildRender(
        "r-pre-import",
        "Your CIE responses show consistent signal across metabolic and vascular domains.",
        "2026-06-17T10:10:00.000Z", // newer than intake date, older than import
      ),
    ];

    render(
      <TerrainRenderProvider>
        <Probe />
      </TerrainRenderProvider>,
    );

    await waitFor(
      () => {
        expect(state.invokeCalls.some((c) => c.name === "generate-terrain-render")).toBe(true);
      },
      { timeout: 3000 },
    );
  });

  it("does NOT regenerate when the active render is already fresh and has no placeholder", async () => {
    state.renders = [
      buildRender(
        "r-current",
        "Your CIE responses show consistent signal across metabolic and vascular domains.",
        "2026-06-17T10:10:00.000Z", // after CIE full_completed_at
      ),
    ];

    render(
      <TerrainRenderProvider>
        <Probe />
      </TerrainRenderProvider>,
    );

    await waitFor(() => {
      const text = screen.getByTestId("portrait").textContent || "";
      expect(text.length).toBeGreaterThan(0);
    });

    // Give the effect a tick to run; it should NOT trigger generate.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(state.invokeCalls.find((c) => c.name === "generate-terrain-render")).toBeUndefined();
    const text = screen.getByTestId("portrait").textContent || "";
    assertNoCieNotDoneCopy(text);
  });
});