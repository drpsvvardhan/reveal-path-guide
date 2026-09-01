// ============================================================================
// files.ts — the single frontend entry point for file storage access.
// ----------------------------------------------------------------------------
// Upload, download, signed URL, delete and list all go through this module so
// the storage backend (private Blob Storage behind the API) can be swapped in
// one file instead of a grep across contexts and pages.
// ============================================================================
import { supabase } from "@/integrations/supabase/client";

export const LAB_UPLOADS_BUCKET = "lab-uploads";

export interface UploadOptions {
  contentType?: string;
  upsert?: boolean;
}

/** Upload a patient file at `path`. */
export async function uploadLabFile(
  path: string,
  body: Blob | File | ArrayBuffer,
  opts: UploadOptions = {},
) {
  return supabase.storage.from(LAB_UPLOADS_BUCKET).upload(path, body, {
    contentType: opts.contentType,
    upsert: opts.upsert ?? false,
  });
}

/** Delete one or more patient files. */
export async function removeLabFiles(paths: string[]) {
  return supabase.storage.from(LAB_UPLOADS_BUCKET).remove(paths);
}

/** Short-lived read URL for a private patient file. */
export async function createLabFileSignedUrl(path: string, expiresInSeconds = 300) {
  return supabase.storage
    .from(LAB_UPLOADS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
}

/** Download a private patient file as a Blob. */
export async function downloadLabFile(path: string) {
  return supabase.storage.from(LAB_UPLOADS_BUCKET).download(path);
}

/** List files under a prefix (typically the owning user's folder). */
export async function listLabFiles(prefix: string) {
  return supabase.storage.from(LAB_UPLOADS_BUCKET).list(prefix);
}
