import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { webcrypto } from "node:crypto";
import {
  startIntake,
  applyCommand,
} from "../../supabase/functions/_shared/cie33/engine";
import type { IntakeState } from "../../supabase/functions/_shared/cie33/engine";
import IntakeStep from "../../src/components/intake/IntakeStep";

const fixture = vi.hoisted(() => ({
  invoke: vi.fn(),
  viewer: false,
  advance: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: fixture.invoke } },
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "11111111-1111-4111-8111-111111111111" },
    signOut: vi.fn(),
  }),
}));
vi.mock("@/context/ViewAsContext", () => ({
  useViewAs: () => ({
    effectiveUserId: fixture.viewer
      ? "22222222-2222-4222-8222-222222222222"
      : "11111111-1111-4111-8111-111111111111",
  }),
}));
vi.mock("@/context/CIEAssessmentContext", () => ({
  useCIEAssessment: () => ({ refresh: fixture.refresh }),
}));
vi.mock("@/context/OnboardingContext", () => ({
  useOnboarding: () => ({ advanceToStep: fixture.advance }),
}));
let state: IntakeState | null;
let loseNextAcknowledgment = false;
const receipts = new Set<string>();
const now = "2026-09-18T10:00:00.000Z";
beforeEach(() => {
  cleanup();
  vi.stubGlobal("crypto", webcrypto);
  state = null;
  loseNextAcknowledgment = false;
  receipts.clear();
  fixture.viewer = false;
  fixture.invoke.mockReset();
  fixture.advance.mockReset();
  fixture.invoke.mockImplementation(async (_name, { body }) => {
    if (body.action !== "read" && !receipts.has(body.request_id)) {
      state =
        body.action === "start"
          ? startIntake(body.user_id, body.sensitive_consent, now)
          : applyCommand(
              state!,
              {
                action: body.action,
                answer: body.answer,
                witnessId: body.witness_id,
              },
              body.request_id,
              now,
            );
      receipts.add(body.request_id);
      if (loseNextAcknowledgment) {
        loseNextAcknowledgment = false;
        return { data: null, error: new Error("Connection lost") };
      }
    }
    return { data: { state }, error: null };
  });
});
async function begin() {
  render(<IntakeStep />);
  await screen.findByRole("button", { name: "Begin CIE 3.3" });
  expect(screen.getByRole("button", { name: "Begin CIE 3.3" })).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/I am answering for myself/));
  fireEvent.click(screen.getByRole("button", { name: "Begin CIE 3.3" }));
  await screen.findByRole("button", { name: "No", exact: true });
}
describe("Patient CIE 3.3 screens", () => {
  it("requires consent and negative capability, then saves and resumes the next question", async () => {
    await begin();
    fireEvent.click(screen.getByRole("button", { name: "No", exact: true }));
    expect(
      screen.getByRole("button", { name: "Save and continue" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByLabelText(/I can answer from my own experience/),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    await screen.findByText(/Have you ever used cigarettes/);
    fireEvent.click(screen.getByRole("button", { name: "Save and pause" }));
    await screen.findByRole("button", { name: "Resume intake" });
    fireEvent.click(screen.getByRole("button", { name: "Resume intake" }));
    await screen.findByText(/Have you ever used cigarettes/);
    expect(state!.entries).toHaveLength(1);
    expect(state!.entries[0].witness.assertionPolarity).toBe("negative");
  });
  it("retries a lost save acknowledgment with the same request ID", async () => {
    await begin();
    fireEvent.change(screen.getByLabelText("Reason for not answering"), {
      target: { value: "unknown" },
    });
    loseNextAcknowledgment = true;
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    await screen.findByText(/Have you ever used cigarettes/);
    const submissions = fixture.invoke.mock.calls
      .map((c) => c[1].body)
      .filter((b) => b.action === "answer");
    expect(submissions).toHaveLength(2);
    expect(submissions[0].request_id).toBe(submissions[1].request_id);
    expect(state!.entries).toHaveLength(1);
    expect(state!.entries[0].witness.missingness.kind).toBe("unknown");
  });
  it("shows a safety handoff and removes ordinary questionnaire controls", async () => {
    await begin();
    fireEvent.click(screen.getByRole("button", { name: "Yes", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    await screen.findByText("Please seek support now");
    expect(
      screen.getByText(/has not contacted emergency services/),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Save and continue" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue to records" }),
    ).not.toBeInTheDocument();
  });
  it("keeps view-as inspection read-only", async () => {
    fixture.viewer = true;
    render(<IntakeStep />);
    await screen.findByRole("button", { name: "Begin CIE 3.3" });
    fireEvent.click(screen.getByLabelText(/I am answering for myself/));
    expect(
      screen.getByRole("button", { name: "Begin CIE 3.3" }),
    ).toBeDisabled();
    expect(
      fixture.invoke.mock.calls.every((c) => c[1].body.action === "read"),
    ).toBe(true);
  });
});
