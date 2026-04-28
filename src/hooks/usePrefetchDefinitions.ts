// src/hooks/usePrefetchDefinitions.ts
//
// One background batch per page mount. Silent failure. No UI loading
// state. See Phase B v2 prefetch lists in
// docs/UCDE_DEFINITION_CONTEXT_MAPPING_v1.md.

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDefinitionContext } from "@/hooks/useDefinitionContext";
import { prefetchDefineTerm } from "@/lib/defineTermClient";

export function usePrefetchDefinitions(terms: readonly string[]): void {
  const { user } = useAuth();
  const ctx = useDefinitionContext();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (!terms || terms.length === 0) return;
    fired.current = true;
    const patientId = user?.id ?? null;
    terms.forEach((term, i) => {
      setTimeout(() => {
        void prefetchDefineTerm(term, ctx, patientId);
      }, i * 80);
    });
    // Run once per mount; ctx changes naturally bypass stale cache via key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}