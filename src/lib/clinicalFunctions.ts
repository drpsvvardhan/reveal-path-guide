import { supabase } from "@/integrations/supabase/client";

export class ClinicalFunctionError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
    this.name = "ClinicalFunctionError";
  }
}

/** Supabase HTTP failures carry the function's response in error.context. */
export async function invokeClinical<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, body ? { body } : undefined);
  if (error || data?.error) {
    let payload = data as { message?: string; error?: string } | null;
    const context = error?.context;
    if (context && typeof context.json === "function") {
      try {
        payload = await (typeof context.clone === "function" ? context.clone() : context).json();
      } catch {
        // A transport failure may not include a JSON response.
      }
    }
    throw new ClinicalFunctionError(
      payload?.message || payload?.error || error?.message || "The request could not be completed. Please retry.",
      payload?.error,
      context?.status,
    );
  }
  return data as T;
}
