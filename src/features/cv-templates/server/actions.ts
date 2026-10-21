"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { definitionSchema } from "@/features/cv-builder/definition";
import { fail, issuesFromZod, mapDatabaseError, ok, type ActionResult } from "@/lib/actions/result";
import { getOwnerContext } from "@/lib/auth/session";
import { asJsonObject } from "@/lib/supabase/json";
import {
  TEMPLATE_NAME_MAX,
  saveCvAsTemplateSchema,
  saveTemplateSchema,
  templateNameSchema,
} from "../schemas";
import { readTemplateChoices, type TemplateChoice } from "./queries";

const idSchema = z.uuid();

/** For the "Replace a template" choice, loaded when the dialog opens. */
export async function getTemplateChoices(): Promise<ActionResult<TemplateChoice[]>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  try {
    return ok(await readTemplateChoices(context));
  } catch {
    return fail("unavailable");
  }
}

/**
 * Copies a CV's saved setup (sections, order, selection, wording, language)
 * into a new template, or over an existing one. Either way it is a copy: the
 * CV and the template stay independent, and CVs made from a replaced template
 * keep their own setup.
 *
 * No refresh(): the builder that calls this must keep its undo history; the
 * templates list is read fresh on the next visit.
 */
export async function saveCvAsTemplate(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsed = saveCvAsTemplateSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", issuesFromZod(parsed.error));
  const { supabase, owner } = context;

  const source = await supabase
    .from("cv_documents")
    .select("locale, definition")
    .eq("owner_id", owner.id)
    .eq("id", parsed.data.cvId)
    .is("deleted_at", null)
    .maybeSingle();
  if (source.error) return fail("unavailable");
  if (!source.data) return fail("not_found");
  const definition = definitionSchema.safeParse(source.data.definition);
  if (!definition.success) return fail("invalid_input");
  const setup = {
    locale: source.data.locale,
    schema_version: definition.data.schemaVersion,
    definition: asJsonObject(definition.data),
  };

  if (parsed.data.mode === "new") {
    const { data, error } = await supabase
      .from("cv_templates")
      .insert({
        ...setup,
        owner_id: owner.id,
        name: parsed.data.name,
        description: parsed.data.description,
      })
      .select("id, name")
      .single();
    if (error) return fail(mapDatabaseError(error));
    return ok(data);
  }

  const { data, error } = await supabase
    .from("cv_templates")
    .update(setup)
    .eq("owner_id", owner.id)
    .eq("id", parsed.data.templateId)
    .is("deleted_at", null)
    .select("id, name")
    .maybeSingle();
  if (error) return fail(mapDatabaseError(error));
  if (!data) return fail("not_found");
  return ok(data);
}

/**
 * Autosave target of the template editor. Like a CV, the write only applies
 * to the revision the editor started from; a mismatch returns "stale".
 */
export async function saveTemplate(
  input: unknown,
): Promise<ActionResult<{ revision: number; updatedAt: string }>> {
  const context = await getOwnerContext();
  if (!context) return fail("unauthorized");
  const parsed = saveTemplateSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_input", issuesFromZod(parsed.error));
  const { id, expectedRevision, name, description, locale, definition } = parsed.data;
  const { supabase, owner } = context;

  const { data, error } = await supabase
    .from("cv_templates")
    .update({
      name,
      description,
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
      .from("cv_templates")
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
    .select("description, locale, schema_version, definition")
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
