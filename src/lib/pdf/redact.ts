/**
 * Makes error messages and stack traces safe for server logs: browser and
 * network errors can quote URLs with signed tokens, cookie values or record
 * ids. File paths and code locations stay readable.
 */

const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]*/g;
/** @supabase/ssr session cookie values. */
const SESSION_COOKIE_VALUE = /base64-[\w+/=-]+/g;
/** Signed storage URLs carry their token in the query string. */
const QUERY = /\?[^\s"'`<>)]*/g;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
/** Long opaque values (keys, hashes, tokens); path segments are shorter. */
const OPAQUE = /[A-Za-z0-9+=_-]{40,}/g;

const MAX_LENGTH = 4000;

export function redact(text: string): string {
  return text
    .replace(JWT, "[token]")
    .replace(SESSION_COOKIE_VALUE, "[cookie]")
    .replace(QUERY, "?[query]")
    .replace(UUID, ":id")
    .replace(OPAQUE, "[redacted]")
    .slice(0, MAX_LENGTH);
}
