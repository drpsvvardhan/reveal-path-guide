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

export interface ClinicalInvokeFailure {
  ok: false;
  /** Patient-readable explanation, taken from the server's own response. */
  message: string;
  code?: string;
  status?: number;
  /** The full response body, so callers can show the server's decision detail. */
  body: Record<string, unknown> | null;
}

export type ClinicalInvokeResult<T> = { ok: true; data: T } | ClinicalInvokeFailure;

/**
 * Same error decoding as invokeClinical, but it hands the whole response back
 * instead of throwing, so a scoped hold can be explained with the server's own
 * reasons and next steps rather than a generic failure.
 */
export async function invokeClinicalResult<T>(
  name: string,
  body?: Record<string, unknown>,
): Promise<ClinicalInvokeResult<T>> {
  const { data, error } = await supabase.functions.invoke(name, body ? { body } : undefined);
  if (error || (data as { error?: string } | null)?.error) {
    let payload = (data ?? null) as Record<string, unknown> | null;
    const context = (error as { context?: any } | null)?.context;
    if (context && typeof context.json === "function") {
      try {
        payload = await (typeof context.clone === "function" ? context.clone() : context).json();
      } catch {
        // A transport failure may not include a JSON response.
      }
    }
    return {
      ok: false,
      message:
        (payload?.message as string) ||
        (payload?.error as string) ||
        error?.message ||
        "The request could not be completed. Please retry.",
      code: payload?.error as string | undefined,
      status: context?.status,
      body: payload,
    };
  }
  return { ok: true, data: data as T };
}
