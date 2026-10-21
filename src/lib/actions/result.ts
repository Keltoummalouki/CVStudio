import type { z } from "zod";

/** The few outcomes a form needs to explain; never raw database messages. */
export type ActionErrorCode =
  "invalid_input" | "stale" | "not_found" | "unauthorized" | "unavailable";

/** A validation message key (under `validation.*`) for a dotted field path. */
export type FieldIssue = { path: string; message: string };

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: ActionErrorCode; fieldIssues?: FieldIssue[] };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: ActionErrorCode, fieldIssues?: FieldIssue[]): ActionResult<never> {
  return fieldIssues ? { ok: false, error, fieldIssues } : { ok: false, error };
}

export function issuesFromZod(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

type RpcErrorLike = { code?: string; message?: string } | null;

/** Maps PostgREST/Postgres errors from the save functions to user-facing outcomes. */
export function mapDatabaseError(error: RpcErrorLike): ActionErrorCode {
  if (!error) return "unavailable";
  if (error.code === "42501") return "unauthorized";
  if (error.message === "stale_record") return "stale";
  if (error.message === "record_not_found") return "not_found";
  if (
    error.message === "too_many_items" ||
    error.message === "invalid_payload" ||
    // check, not-null, foreign-key and type violations
    ["23514", "23502", "23503", "22P02", "22001", "22003", "22007", "22008"].includes(
      error.code ?? "",
    )
  ) {
    return "invalid_input";
  }
  return "unavailable";
}
