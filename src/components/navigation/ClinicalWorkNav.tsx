import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { invokeClinical } from "@/lib/clinicalFunctions";

/** Uses the signed-in identity; view-as never confers clinical authority. */
export default function ClinicalWorkNav() {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const { data: access } = useQuery({
    queryKey: ["clinical-work-access", userId],
    enabled: !!userId && !loading,
    queryFn: async () => {
      const [role, review] = await Promise.allSettled([
        supabase.from("user_roles").select("role").eq("user_id", userId!).eq("role", "admin").maybeSingle(),
        invokeClinical<{ authorized_patients: number }>("cie33-safety-review", { action: "access" }),
      ]);
      return {
        isAdmin: role.status === "fulfilled" && !role.value.error && !!role.value.data,
        canReview: review.status === "fulfilled" && review.value.authorized_patients > 0,
      };
    },
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 60_000,
    retry: false,
  });
  if (!userId || loading || !access || (!access.isAdmin && !access.canReview)) return null;
  return (
    <nav aria-label="Clinical work" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-card px-4 py-2 text-sm sm:px-6">
      {access.canReview && <Link className="min-h-11 inline-flex items-center underline-offset-4 hover:underline" to="/clinician/safety-review">Paused intakes for review</Link>}
      {access.isAdmin && <Link className="min-h-11 inline-flex items-center underline-offset-4 hover:underline" to="/admin/clinician-authority">Clinical review authority</Link>}
    </nav>
  );
}
