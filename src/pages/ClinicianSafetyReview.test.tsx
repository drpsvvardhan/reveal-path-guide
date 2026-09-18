import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClinicianSafetyReview from "./ClinicianSafetyReview";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "reviewer" } }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));

const row = { session_id: "session-1", patient_user_id: "patient-1", patient_name: "Synthetic Patient", safety: "handoff_required", safety_answer: "Yes" };
const detail = {
  session: { ...row, revision: 3, state_hash: "sha256:held", answered_count: 1, safety_history: [{ witness_id: "witness-1", prompt: "Are you in immediate danger?", answer: "Yes", submitted_at: "2026-09-18T12:00:00Z", supersedes: null }] },
  reviews: [],
};
const httpError = (status: number, error: string, message: string) => ({ data: null, error: { message: "Edge Function returned a non-2xx status code", context: { status, json: async () => ({ error, message }) } } });
const renderPage = () => render(<MemoryRouter><ClinicianSafetyReview /></MemoryRouter>);
async function fillReview() {
  fireEvent.click(await screen.findByRole("button", { name: "Open" }));
  fireEvent.change(await screen.findByLabelText("What you assessed and how you contacted them"), { target: { value: "Synthetic contact and assessment documented." } });
  fireEvent.change(screen.getByLabelText("Your rationale for this decision"), { target: { value: "Synthetic assessment supports this documented decision." } });
  fireEvent.change(screen.getByLabelText("Follow-up and what the patient should do"), { target: { value: "Synthetic follow-up instructions." } });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", { randomUUID });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Clinician safety review", () => {
  it("shows the actual forbidden explanation from FunctionsHttpError", async () => {
    mocks.invoke.mockResolvedValue(httpError(403, "not_authorized", "Your patient authorization has expired."));
    renderPage();
    expect(await screen.findByText("Your patient authorization has expired.")).toBeInTheDocument();
    expect(screen.getByText("You are not authorized to review anyone yet")).toBeInTheDocument();
    expect(screen.queryByText("Nothing is waiting for you")).not.toBeInTheDocument();
  });

  it("reuses the request ID for identical network retries and changes it for changed content", async () => {
    const submitted: Record<string, unknown>[] = [];
    mocks.invoke.mockImplementation(async (_name, { body }) => {
      if (body.action === "queue") return { data: { sessions: [row] }, error: null };
      if (body.action === "detail") return { data: detail, error: null };
      submitted.push(body);
      if (submitted.length < 3) return { data: null, error: new Error("Network unavailable") };
      return { data: { note: "Review recorded." }, error: null };
    });
    renderPage();
    await fillReview();
    const submit = () => fireEvent.click(screen.getByRole("button", { name: "Keep the intake paused" }));
    submit();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
    submit();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(2));
    expect(submitted[0].request_id).toBe(submitted[1].request_id);
    fireEvent.change(screen.getByLabelText("Your rationale for this decision"), { target: { value: "An updated synthetic assessment supports keeping this intake paused." } });
    submit();
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Review recorded."));
    expect(submitted[2].request_id).not.toBe(submitted[1].request_id);
    expect(submitted[0]).toMatchObject({ expected_revision: 3, expected_hash: "sha256:held", source_witness_id: "witness-1" });
  });

  it("clears a stale form and reloads after a real HTTP 409 response", async () => {
    mocks.invoke.mockImplementation(async (_name, { body }) => {
      if (body.action === "queue") return { data: { sessions: [row] }, error: null };
      if (body.action === "detail") return { data: detail, error: null };
      return httpError(409, "stale_state", "This intake changed. Reload the current state.");
    });
    renderPage();
    await fillReview();
    fireEvent.click(screen.getByRole("button", { name: "Keep the intake paused" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("This intake changed. Reload the current state."));
    expect(await screen.findByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Your rationale for this decision")).not.toBeInTheDocument();
  });
});
