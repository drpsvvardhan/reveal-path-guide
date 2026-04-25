// ============================================================================
// _shared/uploadGuards.ts
// Identity match + content dedup checks for any file-upload edge function.
// Used by process-lab-pdf and process-fibroscan.
// ============================================================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type IdentityCheckResult = {
  status: "match" | "mismatch" | "unknown";
  score: number | null;
  accountName: string | null;
  extractedName: string | null;
  reason?: string;
};

export type DedupCheckResult = {
  isDuplicate: boolean;
  existingUploadId?: string;
  uploadedAt?: string;
};

// ----------------------------------------------------------------------------
// SHA-256 of raw bytes
// ----------------------------------------------------------------------------
export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ----------------------------------------------------------------------------
// Name normalization (mirrors fn_normalize_name in SQL)
// ----------------------------------------------------------------------------
export function normalizeName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ----------------------------------------------------------------------------
// Name match score (mirrors fn_name_match_score in SQL)
// Returns 0..1. Consumers should treat:
//   >= 0.85 -> match
//   < 0.60  -> mismatch
//   else    -> unknown (human review)
// ----------------------------------------------------------------------------
export function nameMatchScore(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;

  const ta = na.split(" ").filter(Boolean);
  const tb = nb.split(" ").filter(Boolean);
  if (ta.length === 0 || tb.length === 0) return 0;

  const setA = new Set(ta);
  const setB = new Set(tb);
  const intersect = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...ta, ...tb]).size;

  const lastA = ta[ta.length - 1];
  const lastB = tb[tb.length - 1];
  const firstA = ta[0];
  const firstB = tb[0];

  if (lastA === lastB && firstA.charAt(0) === firstB.charAt(0)) {
    return Math.max(0.85, intersect / union);
  }

  return union === 0 ? 0 : Math.round((intersect / union) * 1000) / 1000;
}

// ----------------------------------------------------------------------------
// verifyPatientIdentity
//   Called after PDF patient-name extraction but BEFORE writing observations.
//   Returns match | mismatch | unknown.
//
//   MISMATCH is a hard rejection. The caller must:
//     1. Update the upload row: status='rejected_identity', rejection_reason=...
//     2. Insert audit row in upload_rejection_audit
//     3. NOT write any observations
//     4. Return 422 to the client with a friendly explanation
// ----------------------------------------------------------------------------
export async function verifyPatientIdentity(
  sb: SupabaseClient,
  userId: string,
  extractedName: string | null,
): Promise<IdentityCheckResult> {
  if (!extractedName || extractedName.trim().length < 2) {
    // No name could be extracted — fall to unknown rather than failing closed.
    // Policy decision: unknown becomes 'pending' in the DB, admin review required.
    return {
      status: "unknown",
      score: null,
      accountName: null,
      extractedName: extractedName,
      reason: "no_name_extracted",
    };
  }

  const { data: profile, error } = await sb
    .from("profiles")
    .select("first_name, display_name, preferred_name, name_aliases")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) {
    return {
      status: "unknown",
      score: null,
      accountName: null,
      extractedName,
      reason: "profile_not_found",
    };
  }

  // Build candidate names to match against
  const candidates: string[] = [];
  if (profile.display_name) candidates.push(profile.display_name);
  if (profile.first_name) candidates.push(profile.first_name);
  if (profile.preferred_name) candidates.push(profile.preferred_name);
  if (profile.name_aliases && Array.isArray(profile.name_aliases)) {
    candidates.push(...profile.name_aliases);
  }

  if (candidates.length === 0) {
    return {
      status: "unknown",
      score: null,
      accountName: null,
      extractedName,
      reason: "no_account_name_on_file",
    };
  }

  // Take the best score across all candidates
  let bestScore = 0;
  let bestCandidate = candidates[0];
  for (const c of candidates) {
    const s = nameMatchScore(c, extractedName);
    if (s > bestScore) {
      bestScore = s;
      bestCandidate = c;
    }
  }

  let status: IdentityCheckResult["status"];
  if (bestScore >= 0.85) status = "match";
  else if (bestScore < 0.6) status = "mismatch";
  else status = "unknown";

  return {
    status,
    score: bestScore,
    accountName: bestCandidate,
    extractedName,
  };
}

// ----------------------------------------------------------------------------
// checkContentDuplicate
//   Has this user already uploaded a file with this SHA-256?
// ----------------------------------------------------------------------------
export async function checkContentDuplicate(
  sb: SupabaseClient,
  userId: string,
  contentSha256: string,
): Promise<DedupCheckResult> {
  const { data, error } = await sb
    .from("patient_lab_uploads")
    .select("id, created_at, status")
    .eq("user_id", userId)
    .eq("content_sha256", contentSha256)
    .not("status", "in", "(rejected_identity,rejected_duplicate,failed)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return { isDuplicate: false };
  return {
    isDuplicate: true,
    existingUploadId: data.id,
    uploadedAt: data.created_at,
  };
}

// ----------------------------------------------------------------------------
// recordRejection
//   Helper to atomically (a) mark upload as rejected (b) write audit row.
// ----------------------------------------------------------------------------
export async function recordRejection(
  sb: SupabaseClient,
  params: {
    userId: string;
    uploadId: string | null;
    fileName: string | null;
    category: "identity_mismatch" | "duplicate_content" | "corrupt_file" | "unsupported_type" | "extraction_failed";
    detail: string;
    accountHolderName?: string | null;
    extractedPatientName?: string | null;
    nameMatchScore?: number | null;
    contentSha256?: string | null;
  },
): Promise<void> {
  if (params.uploadId) {
    const newStatus =
      params.category === "identity_mismatch" ? "rejected_identity" :
      params.category === "duplicate_content" ? "rejected_duplicate" :
      "failed";

    await sb.from("patient_lab_uploads").update({
      status: newStatus,
      rejection_reason: params.detail,
      rejected_at: new Date().toISOString(),
      name_match_score: params.nameMatchScore,
      name_match_status: params.category === "identity_mismatch" ? "mismatch" : undefined,
      extracted_patient_name: params.extractedPatientName,
      content_sha256: params.contentSha256,
    }).eq("id", params.uploadId);
  }

  await sb.from("upload_rejection_audit").insert({
    user_id: params.userId,
    upload_id: params.uploadId,
    file_name: params.fileName,
    rejection_category: params.category,
    rejection_detail: params.detail,
    account_holder_name: params.accountHolderName,
    extracted_patient_name: params.extractedPatientName,
    name_match_score: params.nameMatchScore,
    content_sha256: params.contentSha256,
  });
}
