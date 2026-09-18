import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClinicalWorkNav from "./ClinicalWorkNav";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), role: vi.fn(), user: { id: "signed-in-reviewer" } as { id: string } | null, eq: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  functions: { invoke: mocks.invoke },
  from: () => {
    const query = { select: () => query, eq: (key: string, value: string) => { mocks.eq(key, value); return query; }, maybeSingle: mocks.role };
    return query;
  },
} }));
function renderNav() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><ClinicalWorkNav /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); mocks.user = { id: "signed-in-reviewer" }; });
afterEach(cleanup);

describe("Clinical work navigation", () => {
  it("makes the queue discoverable for an assigned nonadmin using their signed-in identity", async () => {
    mocks.role.mockResolvedValue({ data: null, error: null });
    mocks.invoke.mockResolvedValue({ data: { authorized_patients: 1 }, error: null });
    renderNav();
    expect(await screen.findByRole("link", { name: "Paused intakes for review" })).toHaveAttribute("href", "/clinician/safety-review");
    expect(screen.queryByRole("link", { name: "Clinical review authority" })).not.toBeInTheDocument();
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "signed-in-reviewer");
    expect(mocks.invoke).toHaveBeenCalledWith("cie33-safety-review", { body: { action: "access" } });
  });
  it("does not infer review authorization from admin status", async () => {
    mocks.role.mockResolvedValue({ data: { role: "admin" }, error: null });
    mocks.invoke.mockResolvedValue({ data: { authorized_patients: 0 }, error: null });
    renderNav();
    expect(await screen.findByRole("link", { name: "Clinical review authority" })).toHaveAttribute("href", "/admin/clinician-authority");
    expect(screen.queryByRole("link", { name: "Paused intakes for review" })).not.toBeInTheDocument();
  });
  it("fails closed for unavailable authorization without hiding a verified admin's setup link", async () => {
    mocks.role.mockResolvedValue({ data: { role: "admin" }, error: null });
    mocks.invoke.mockResolvedValue({ data: null, error: new Error("Network unavailable") });
    renderNav();
    expect(await screen.findByRole("link", { name: "Clinical review authority" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Paused intakes for review" })).not.toBeInTheDocument();
  });
  it("makes no authorization request when signed out", async () => {
    mocks.user = null;
    renderNav();
    await waitFor(() => expect(mocks.invoke).not.toHaveBeenCalled());
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
