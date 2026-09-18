// Local visual fixture only. Aliased by its dedicated Vite config, never by the app.
export const useAuth = () => ({
  user: { id: "11111111-1111-4111-8111-111111111111" },
  signOut: () => {},
});
export const useViewAs = () => ({
  effectiveUserId: "11111111-1111-4111-8111-111111111111",
});
export const useCIEAssessment = () => ({ refresh: async () => {} });
export const useOnboarding = () => ({ advanceToStep: async () => {} });
export const supabase = {
  functions: {
    invoke: async (_name: string, { body }: { body: unknown }) => {
      const response = await fetch("/__cie33_fixture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return { data, error: response.ok ? null : new Error(data.message) };
    },
  },
};
