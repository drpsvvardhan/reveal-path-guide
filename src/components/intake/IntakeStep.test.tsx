import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IntakeStep from "./IntakeStep";
import type { IntakeState } from "@shared/cie33/engine";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), reload: vi.fn(), command: vi.fn(), state: null as IntakeState | null, readOnly: false }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/hooks/useCIE33", () => ({ useCIE33: () => ({ state: mocks.state, readOnly: mocks.readOnly, loading: false, busy: false, error: null, reload: mocks.reload, command: mocks.command }) }));
vi.mock("@/context/CIEAssessmentContext", () => ({ useCIEAssessment: () => ({ refresh: vi.fn() }) }));
vi.mock("@/context/OnboardingContext", () => ({ useOnboarding: () => ({ advanceToStep: vi.fn() }) }));
vi.mock("@/components/onboarding/OnboardingLayout", () => ({ default: ({ children, title }: { children: React.ReactNode; title: string }) => <main><h1>{title}</h1>{children}</main> }));
vi.mock("./CIE33Review", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readOnly = false;
  mocks.state = { id: "own-session", phase: "safety_hold", safety: "handoff_required", entries: [] } as unknown as IntakeState;
});
afterEach(cleanup);
describe("Patient review status", () => {
  it("renders only patient instructions, never private clinical notes, and lets the patient refresh", async () => {
    mocks.invoke.mockResolvedValue({ data: { notice: { disposition: "keep_hold", patient_instructions: "Contact the care team using your agreed contact route.", created_at: "2026-09-18T12:00:00Z", assessment_note: "PRIVATE ASSESSMENT", rationale: "PRIVATE RATIONALE" } }, error: null });
    render(<IntakeStep />);
    expect(await screen.findByText("Contact the care team using your agreed contact route.")).toBeInTheDocument();
    expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledWith("cie33-safety-review", { body: { action: "patient_notice", session_id: "own-session" } });
    fireEvent.click(screen.getByRole("button", { name: "Check review status" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
    expect(mocks.reload).toHaveBeenCalledTimes(1);
    expect(mocks.command).not.toHaveBeenCalled();
  });
  it("explains intake resumption while retaining a fresh patient safety question", async () => {
    mocks.state = { ...mocks.state!, phase: "active", safety: "recheck_required", current: { key: "safety", chapter: "Safety", instance: { id: "fresh-safety", promptRendered: "Are you in immediate danger?", referenceWindowRendered: "Right now", response: { kind: "boolean" }, missingnessOptions: [] } } } as unknown as IntakeState;
    mocks.invoke.mockResolvedValue({ data: { notice: null }, error: null });
    render(<IntakeStep />);
    expect(screen.getByText(/A clinician has permitted you to resume the questionnaire/)).toBeInTheDocument();
    expect(screen.getByText("Are you in immediate danger?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save and continue" })).toBeDisabled();
    expect(mocks.command).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(/Checking for instructions/)).not.toBeInTheDocument());
  });
  it("does not fetch another patient's review notice in view-as mode", () => {
    mocks.readOnly = true;
    render(<IntakeStep />);
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Review status" })).not.toBeInTheDocument();
  });
});
