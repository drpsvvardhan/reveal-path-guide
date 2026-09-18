import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { MemoryRouter } from "react-router-dom";
import ClinicianSafetyReview from "../../src/pages/ClinicianSafetyReview";

const fixture = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: fixture.invoke } },
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

if (!globalThis.crypto?.randomUUID)
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });

const session = {
  session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  patient_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  patient_name: "Synthetic Subject-01",
  revision: 4,
  state_hash: "sha256:abc",
  phase: "safety_hold",
  safety: "handoff_required",
  authorization_expires_at: "2026-10-01T00:00:00.000Z",
  safety_witness_id: "w-1",
  safety_prompt: "Are you in immediate danger?",
  safety_answer: "Yes",
  safety_answered_at: "2026-09-18T10:00:00.000Z",
  updated_at: "2026-09-18T10:00:00.000Z",
};
const detail = {
  session: {
    ...session,
    started_at: "2026-09-18T09:00:00.000Z",
    answered_count: 1,
    safety_history: [
      {
        witness_id: "w-1",
        prompt: "Are you in immediate danger?",
        answer: "Yes",
        submitted_at: "2026-09-18T10:00:00.000Z",
        supersedes: null,
      },
    ],
  },
  reviews: [],
};

function render_() {
  return render(
    <MemoryRouter>
      <ClinicianSafetyReview />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  fixture.invoke.mockReset();
});

describe("clinician review queue screen", () => {
  it("explains that authority is patient-specific when the clinician holds none", async () => {
    fixture.invoke.mockResolvedValue({
      data: {
        error: "not_authorized",
        message: "You do not hold an active review authorization for any patient.",
      },
      error: null,
    });
    render_();
    expect(
      await screen.findByText(/not authorized to review anyone yet/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/Being an administrator is not enough/i),
    ).toBeTruthy();
  });

  it("shows an empty state when nothing is paused", async () => {
    fixture.invoke.mockResolvedValue({
      data: { authorized_patients: 1, sessions: [] },
      error: null,
    });
    render_();
    expect(await screen.findByText(/Nothing is waiting for you/i)).toBeTruthy();
  });

  it("requires documentation before a disposition can be recorded", async () => {
    fixture.invoke.mockImplementation((_fn: string, opts: any) =>
      Promise.resolve({
        data:
          opts.body.action === "queue"
            ? { authorized_patients: 1, sessions: [session] }
            : detail,
        error: null,
      }),
    );
    render_();
    fireEvent.click(await screen.findByRole("button", { name: /open/i }));
    const permit = await screen.findByRole("button", {
      name: /Permit the patient to continue/i,
    });
    expect((permit as HTMLButtonElement).disabled).toBe(true);
    // The patient's own words and answer are shown verbatim.
    expect(screen.getByText(/Are you in immediate danger\?/)).toBeTruthy();
    expect(screen.getByText(/Answer: Yes/)).toBeTruthy();
    // The screen states plainly what permitting does and does not mean.
    expect(screen.getByText(/not a finding that there is no risk/i)).toBeTruthy();
  });

  it("submits a documented disposition bound to the loaded revision and hash", async () => {
    const calls: any[] = [];
    fixture.invoke.mockImplementation((_fn: string, opts: any) => {
      calls.push(opts.body);
      if (opts.body.action === "queue")
        return Promise.resolve({
          data: { authorized_patients: 1, sessions: [session] },
          error: null,
        });
      if (opts.body.action === "detail")
        return Promise.resolve({ data: detail, error: null });
      return Promise.resolve({
        data: { review: { replayed: false }, note: "Recorded." },
        error: null,
      });
    });
    render_();
    fireEvent.click(await screen.findByRole("button", { name: /open/i }));
    await screen.findByText(/Your assessment/i);
    const areas = screen.getAllByRole("textbox");
    fireEvent.change(areas[0], {
      target: { value: "Called the patient and completed a full risk assessment." },
    });
    fireEvent.change(areas[1], {
      target: { value: "No current intent or plan; support in place with family." },
    });
    fireEvent.change(areas[2], {
      target: { value: "Continue the questionnaire and call us if anything changes." },
    });
    const permit = screen.getByRole("button", {
      name: /Permit the patient to continue/i,
    });
    await waitFor(() => expect((permit as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(permit);
    await waitFor(() =>
      expect(calls.some((c) => c.action === "submit")).toBe(true),
    );
    const submitted = calls.find((c) => c.action === "submit");
    expect(submitted.disposition).toBe("permit_resumption");
    expect(submitted.expected_revision).toBe(4);
    expect(submitted.expected_hash).toBe("sha256:abc");
    expect(submitted.source_witness_id).toBe("w-1");
    expect(submitted.request_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("does not offer a disposition once the patient owes a fresh safety answer", async () => {
    const waiting = { ...session, safety: "recheck_required", phase: "active" };
    fixture.invoke.mockImplementation((_fn: string, opts: any) =>
      Promise.resolve({
        data:
          opts.body.action === "queue"
            ? { authorized_patients: 1, sessions: [waiting] }
            : { ...detail, session: { ...detail.session, safety: "recheck_required" } },
        error: null,
      }),
    );
    render_();
    expect(await screen.findByText(/Waiting on patient/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /open/i }));
    expect(
      await screen.findByText(/waiting for the patient to answer the/i),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Permit the patient to continue/i }),
    ).toBeNull();
  });
});
