"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { fail, issuesFromZod, mapDatabaseError, ok, type ActionResult } from "@/lib/actions/result";
import { getOwnerContext, type OwnerContext } from "@/lib/auth/session";
import { asJson } from "@/lib/supabase/json";
import {
  toCertificationPayload,
  toCustomSectionPayload,
  toEducationPayload,
  toExperiencePayload,
  toProfilePayload,
  toProjectPayload,
  toSkillGroupsPayload,
  toSoftSkillsPayload,
  toSpokenLanguagesPayload,
} from "../payloads";
import { MAX_PHOTO_BYTES } from "../constants";
import {
  getCertificationEditor,
  getCustomSectionEditor,
  getEducationEditor,
  getExperienceEditor,
  getProfileEditor,
  getProjectEditor,
  getSkillGroupsEditor,
  getSoftSkillsEditor,
  getSpokenLanguagesEditor,
} from "./queries";
import { RECORD_KINDS, RECORD_TABLES } from "../record-kinds";
import {
  certificationSchema,
  customSectionSchema,
  educationSchema,
  experienceSchema,
  profileSchema,
  projectSchema,
  skillGroupsSchema,
  softSkillsSchema,
  spokenLanguagesSchema,
} from "../schemas";

type SavedRecord = { id: string; updatedAt: string };

type SaveFunction =
  | "save_profile"
  | "save_experience"
  | "save_project"
  | "save_education"
  | "save_certification"
  | "save_custom_section"
  | "save_soft_skills"
  | "save_spoken_languages"
  | "save_skill_groups";

/**
 * Validates, writes atomically through one save function, then returns the
 * values re-read from the database. Forms reset to exactly what was stored
 * (new child ids included), so a second save can never duplicate rows.
 */
async function runSave<TValues, TResult>(
  input: unknown,
  schema: z.ZodType<TValues>,
  fn: SaveFunction,
  toPayload: (values: TValues) => unknown,
  reload: (saved: SavedRecord) => Promise<TResult>,
): Promise<ActionResult<TResult>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");

  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", issuesFromZod(parsed.error));

  const { data, error } = await context.supabase.rpc(fn, {
    payload: asJson(toPayload(parsed.data)),
  });
  if (error) return fail(mapDatabaseError(error));

  refresh();
  return ok(await reload(data as SavedRecord));
}

export async function saveProfile(input: unknown) {
  return runSave(
    input,
    profileSchema,
    "save_profile",
    toProfilePayload,
    async () => (await getProfileEditor()).values,
  );
}

export async function saveExperience(input: unknown) {
  return runSave(input, experienceSchema, "save_experience", toExperiencePayload, ({ id }) =>
    getExperienceEditor(id),
  );
}

export async function saveProject(input: unknown) {
  return runSave(input, projectSchema, "save_project", toProjectPayload, ({ id }) =>
    getProjectEditor(id),
  );
}

export async function saveEducation(input: unknown) {
  return runSave(input, educationSchema, "save_education", toEducationPayload, ({ id }) =>
    getEducationEditor(id),
  );
}

export async function saveCertification(input: unknown) {
  return runSave(
    input,
    certificationSchema,
    "save_certification",
    toCertificationPayload,
    ({ id }) => getCertificationEditor(id),
  );
}

export async function saveCustomSection(input: unknown) {
  return runSave(
    input,
    customSectionSchema,
    "save_custom_section",
    toCustomSectionPayload,
    ({ id }) => getCustomSectionEditor(id),
  );
}

export async function saveSoftSkills(input: unknown) {
  return runSave(input, softSkillsSchema, "save_soft_skills", toSoftSkillsPayload, () =>
    getSoftSkillsEditor(),
  );
}

export async function saveSpokenLanguages(input: unknown) {
  return runSave(
    input,
    spokenLanguagesSchema,
    "save_spoken_languages",
    toSpokenLanguagesPayload,
    () => getSpokenLanguagesEditor(),
  );
}

export async function saveSkillGroups(input: unknown) {
  return runSave(input, skillGroupsSchema, "save_skill_groups", toSkillGroupsPayload, () =>
    getSkillGroupsEditor(),
  );
}

// ---------------------------------------------------------------------------
// Ordering, archiving, deletion
// ---------------------------------------------------------------------------

const recordKindSchema = z.enum(RECORD_KINDS);

export async function reorderRecords(kind: unknown, ids: unknown): Promise<ActionResult> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");

  const parsed = z
    .object({ kind: recordKindSchema, ids: z.array(z.uuid()).max(500) })
    .safeParse({ kind, ids });
  if (!parsed.success) return fail("invalid_input");

  const { error } = await context.supabase.rpc("reorder_records", {
    target: RECORD_TABLES[parsed.data.kind],
    ids: parsed.data.ids,
  });
  if (error) return fail(mapDatabaseError(error));

  refresh();
  return ok(undefined);
}

export async function setRecordArchived(
  kind: unknown,
  id: unknown,
  archived: unknown,
): Promise<ActionResult> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");

  const parsed = z
    .object({ kind: recordKindSchema, id: z.uuid(), archived: z.boolean() })
    .safeParse({ kind, id, archived });
  if (!parsed.success) return fail("invalid_input");

  const { data, error } = await context.supabase
    .from(RECORD_TABLES[parsed.data.kind])
    .update({ deleted_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("owner_id", context.owner.id)
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return fail(mapDatabaseError(error));
  if (!data?.length) return fail("not_found");

  refresh();
  return ok(undefined);
}

/** Permanent deletion is only possible for records that were archived first. */
export async function deleteArchivedRecord(kind: unknown, id: unknown): Promise<ActionResult> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");

  const parsed = z.object({ kind: recordKindSchema, id: z.uuid() }).safeParse({ kind, id });
  if (!parsed.success) return fail("invalid_input");

  const { data, error } = await context.supabase
    .from(RECORD_TABLES[parsed.data.kind])
    .delete()
    .eq("owner_id", context.owner.id)
    .eq("id", parsed.data.id)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) return fail(mapDatabaseError(error));
  if (!data?.length) return fail("not_found");

  refresh();
  return ok(undefined);
}

export type RecordReferences = { documents: number; templates: number };

export async function getRecordReferences(id: unknown): Promise<ActionResult<RecordReferences>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");

  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return fail("invalid_input");

  const { data, error } = await context.supabase.rpc("count_record_references", {
    record_id: parsed.data,
  });
  if (error) return fail(mapDatabaseError(error));
  return ok(data as RecordReferences);
}

// ---------------------------------------------------------------------------
// Profile photo (private storage)
// ---------------------------------------------------------------------------

const PHOTO_BUCKET = "cvstudio-assets";

/** Identifies the image by its bytes, never by the browser-declared type. */
function sniffImage(bytes: Uint8Array): { type: string; extension: string } | null {
  const starts = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  if (starts(0xff, 0xd8, 0xff)) return { type: "image/jpeg", extension: "jpg" };
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { type: "image/png", extension: "png" };
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    return { type: "image/webp", extension: "webp" };
  return null;
}

async function currentPhotoPath({ supabase, owner }: OwnerContext): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("photo_path")
    .eq("owner_id", owner.id)
    .maybeSingle();
  return data?.photo_path ?? null;
}

export type PhotoUploadError = "too_large" | "unsupported_type";

export async function uploadProfilePhoto(
  formData: FormData,
): Promise<ActionResult<{ url: string }> | { ok: false; error: PhotoUploadError }> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return fail("invalid_input");
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "too_large" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = sniffImage(bytes);
  if (!image) return { ok: false, error: "unsupported_type" };

  const path = `${context.owner.id}/portraits/${randomUUID()}.${image.extension}`;
  const upload = await context.supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: image.type, upsert: false });
  if (upload.error) return fail("unavailable");

  const previous = await currentPhotoPath(context);
  const update = await context.supabase
    .from("profiles")
    .update({ photo_path: path })
    .eq("owner_id", context.owner.id);
  if (update.error) {
    await context.supabase.storage.from(PHOTO_BUCKET).remove([path]);
    return fail("unavailable");
  }
  if (previous) await context.supabase.storage.from(PHOTO_BUCKET).remove([previous]);

  const signed = await context.supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60);
  refresh();
  return ok({ url: signed.data?.signedUrl ?? "" });
}

export async function removeProfilePhoto(): Promise<ActionResult> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");

  const previous = await currentPhotoPath(context);
  const update = await context.supabase
    .from("profiles")
    .update({ photo_path: null })
    .eq("owner_id", context.owner.id);
  if (update.error) return fail("unavailable");
  if (previous) await context.supabase.storage.from(PHOTO_BUCKET).remove([previous]);

  refresh();
  return ok(undefined);
}
