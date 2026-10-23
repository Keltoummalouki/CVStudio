"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { DEFAULT_HEADER } from "@/features/cv-builder/defaults";
import { DEFINITION_SCHEMA_VERSION, type CvDefinition } from "@/features/cv-builder/definition";
import { createBlankDesign } from "@/features/cv-design/design";
import { fail, issuesFromZod, mapDatabaseError, ok, type ActionResult } from "@/lib/actions/result";
import { getOwnerContext } from "@/lib/auth/session";
import { asJsonObject } from "@/lib/supabase/json";
import {
  TEMPLATE_NAME_MAX,
  createDesignTemplateSchema,
  saveTemplateDesignSchema,
  templateNameSchema,
} from "../schemas";

const idSchema = z.uuid();
const DESIGN_RENDERER = "canvas-v1";

/**
 * A design places career content, it does not choose it: a CV made from one
 * starts with all career data. The stored composition stays empty.
 */
const EMPTY_DEFINITION: CvDefinition = {
  schemaVersion: DEFINITION_SCHEMA_VERSION,
  header: DEFAULT_HEADER,
  sections: [],
};

/** "Create a template": a blank A4 page, opened next in the designer. */
export async function createDesignTemplate(input: unknown): Promise<ActionResult<{ id: string }>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsed = createDesignTemplateSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", issuesFromZod(parsed.error));

  const { data, error } = await context.supabase
    .from("cv_templates")
    .insert({
      owner_id: context.owner.id,
      name: parsed.data.name,
      locale: parsed.data.locale,
      schema_version: EMPTY_DEFINITION.schemaVersion,
      definition: asJsonObject(EMPTY_DEFINITION),
      visual_template_key: DESIGN_RENDERER,
      design: asJsonObject(createBlankDesign()),
    })
    .select("id")
    .single();
  if (error) return fail(mapDatabaseError(error));
  return ok({ id: data.id });
}

/**
 * Autosave target of the designer. Like a CV, the write only applies to the
 * revision the editor started from; a mismatch returns "stale".
 */
export async function saveTemplateDesign(
  input: unknown,
): Promise<ActionResult<{ revision: number; updatedAt: string }>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsed = saveTemplateDesignSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", issuesFromZod(parsed.error));
  const { id, expectedRevision, name, locale, design } = parsed.data;
  const { supabase, owner } = context;

  const { data, error } = await supabase
    .from("cv_templates")
    .update({ name, locale, design: asJsonObject(design) })
    .eq("owner_id", owner.id)
    .eq("id", id)
    .eq("visual_template_key", DESIGN_RENDERER)
    .eq("revision", expectedRevision)
    .is("deleted_at", null)
    .select("revision, updated_at")
    .maybeSingle();
  if (error) return fail(mapDatabaseError(error));

  if (!data) {
    const current = await supabase
      .from("cv_templates")
      .select("id")
      .eq("owner_id", owner.id)
      .eq("id", id)
      .eq("visual_template_key", DESIGN_RENDERER)
      .is("deleted_at", null)
      .maybeSingle();
    if (current.error) return fail("unavailable");
    return fail(current.data ? "stale" : "not_found");
  }
  return ok({ revision: data.revision, updatedAt: data.updated_at });
}

/** Latest saved revision, so the owner can keep their edits after a conflict. */
export async function getTemplateRevision(
  id: unknown,
): Promise<ActionResult<{ revision: number }>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("invalid_input");

  const { data, error } = await context.supabase
    .from("cv_templates")
    .select("revision")
    .eq("owner_id", context.owner.id)
    .eq("id", parsedId.data)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return fail("unavailable");
  if (!data) return fail("not_found");
  return ok({ revision: data.revision });
}

/** Independent copy: later edits to either template never affect the other. */
export async function duplicateTemplate(
  id: unknown,
  name: unknown,
): Promise<ActionResult<{ id: string }>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsedId = idSchema.safeParse(id);
  // The localized "Copy of …" name may exceed the limit; shorten instead of failing.
  const parsedName = templateNameSchema.safeParse(
    typeof name === "string" ? name.slice(0, TEMPLATE_NAME_MAX) : name,
  );
  if (!parsedId.success || !parsedName.success) return fail("invalid_input");
  const { supabase, owner } = context;

  const source = await supabase
    .from("cv_templates")
    .select("description, locale, schema_version, definition, visual_template_key, design")
    .eq("owner_id", owner.id)
    .eq("id", parsedId.data)
    .is("deleted_at", null)
    .maybeSingle();
  if (source.error) return fail("unavailable");
  if (!source.data) return fail("not_found");

  const { data, error } = await supabase
    .from("cv_templates")
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
    .from("cv_templates")
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
 * Moves a template out of every list. The row is kept so the owner can undo;
 * CVs made from it are separate documents and never change.
 */
export async function deleteTemplate(id: unknown): Promise<ActionResult> {
  return setDeleted(id, true);
}

export async function restoreTemplate(id: unknown): Promise<ActionResult> {
  return setDeleted(id, false);
}
