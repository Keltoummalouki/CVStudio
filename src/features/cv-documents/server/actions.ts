"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createDefaultDefinition } from "@/features/cv-builder/defaults";
import { definitionSchema, type CvDefinition } from "@/features/cv-builder/definition";
import { loadMasterData } from "@/features/cv-builder/server/load-master-data";
import { fail, issuesFromZod, mapDatabaseError, ok, type ActionResult } from "@/lib/actions/result";
import { getOwnerContext } from "@/lib/auth/session";
import { asJsonObject } from "@/lib/supabase/json";
import { cvNameSchema, createCvSchema, saveCvSchema } from "../schemas";

const idSchema = z.uuid();

/**
 * Creates a CV from all active career data in the reference section order, or
 * from a copy of a template's setup. The copy is independent: editing or
 * deleting the template later never changes this CV.
 */
export async function createCv(input: unknown): Promise<ActionResult<{ id: string }>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsed = createCvSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", issuesFromZod(parsed.error));
  const { supabase, owner } = context;

  let definition: CvDefinition;
  let provenance: { created_from_template_id: string; created_from_template_name: string } | null =
    null;
  if (parsed.data.templateId) {
    const template = await supabase
      .from("cv_templates")
      .select("id, name, definition")
      .eq("owner_id", owner.id)
      .eq("id", parsed.data.templateId)
      .is("deleted_at", null)
      .maybeSingle();
    if (template.error) return fail("unavailable");
    if (!template.data) return fail("not_found");
    const copied = definitionSchema.safeParse(template.data.definition);
    if (!copied.success) return fail("invalid_input");
    definition = copied.data;
    provenance = {
      created_from_template_id: template.data.id,
      created_from_template_name: template.data.name,
    };
  } else {
    try {
      definition = createDefaultDefinition(await loadMasterData(context));
    } catch {
      return fail("unavailable");
    }
  }

  const { data, error } = await supabase
    .from("cv_documents")
    .insert({
      owner_id: owner.id,
      name: parsed.data.name,
      locale: parsed.data.locale,
      schema_version: definition.schemaVersion,
      definition: asJsonObject(definition),
      ...provenance,
    })
    .select("id")
    .single();
  if (error) return fail(mapDatabaseError(error));

  refresh();
  return ok({ id: data.id });
}

/**
 * Autosave target of the builder. The write only applies to the revision the
 * editor started from, so a second tab can never be overwritten silently:
 * a mismatch returns "stale" and the builder lets the owner choose.
 */
export async function saveCv(
  input: unknown,
): Promise<ActionResult<{ revision: number; updatedAt: string }>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsed = saveCvSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", issuesFromZod(parsed.error));
  const { id, expectedRevision, name, locale, definition } = parsed.data;
  const { supabase, owner } = context;

  const { data, error } = await supabase
    .from("cv_documents")
    .update({
      name,
      locale,
      schema_version: definition.schemaVersion,
      definition: asJsonObject(definition),
    })
    .eq("owner_id", owner.id)
    .eq("id", id)
    .eq("revision", expectedRevision)
    .is("deleted_at", null)
    .select("revision, updated_at")
    .maybeSingle();
  if (error) return fail(mapDatabaseError(error));

  if (!data) {
    const current = await supabase
      .from("cv_documents")
      .select("id")
      .eq("owner_id", owner.id)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (current.error) return fail("unavailable");
    return fail(current.data ? "stale" : "not_found");
  }
  return ok({ revision: data.revision, updatedAt: data.updated_at });
}

/** Latest saved revision, so the owner can keep their edits after a conflict. */
export async function getCvRevision(id: unknown): Promise<ActionResult<{ revision: number }>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("invalid_input");

  const { data, error } = await context.supabase
    .from("cv_documents")
    .select("revision")
    .eq("owner_id", context.owner.id)
    .eq("id", parsedId.data)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return fail("unavailable");
  if (!data) return fail("not_found");
  return ok({ revision: data.revision });
}

/** Independent copy: later edits to either CV never affect the other. */
export async function duplicateCv(
  id: unknown,
  name: unknown,
): Promise<ActionResult<{ id: string }>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsedId = idSchema.safeParse(id);
  // The localized "Copy of …" name may exceed the limit; shorten instead of failing.
  const parsedName = cvNameSchema.safeParse(typeof name === "string" ? name.slice(0, 120) : name);
  if (!parsedId.success || !parsedName.success) return fail("invalid_input");
  const { supabase, owner } = context;

  const source = await supabase
    .from("cv_documents")
    .select(
      "locale, schema_version, definition, created_from_template_id, created_from_template_name",
    )
    .eq("owner_id", owner.id)
    .eq("id", parsedId.data)
    .is("deleted_at", null)
    .maybeSingle();
  if (source.error) return fail("unavailable");
  if (!source.data) return fail("not_found");

  const { data, error } = await supabase
    .from("cv_documents")
    .insert({ ...source.data, owner_id: owner.id, name: parsedName.data })
    .select("id")
    .single();
  if (error) return fail(mapDatabaseError(error));

  refresh();
  return ok({ id: data.id });
}

async function setDeleted(id: unknown, deleted: boolean): Promise<ActionResult> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("invalid_input");

  const query = context.supabase
    .from("cv_documents")
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq("owner_id", context.owner.id)
    .eq("id", parsedId.data);
  const { data, error } = await (
    deleted ? query.is("deleted_at", null) : query.not("deleted_at", "is", null)
  )
    .select("id")
    .maybeSingle();
  if (error) return fail(mapDatabaseError(error));
  if (!data) return fail("not_found");

  refresh();
  return ok(undefined);
}

/**
 * Moves a CV out of every list. The row is kept so the owner can undo; it
 * never affects career data or templates.
 */
export async function deleteCv(id: unknown): Promise<ActionResult> {
  return setDeleted(id, true);
}

export async function restoreCv(id: unknown): Promise<ActionResult> {
  return setDeleted(id, false);
}
