import { notFound } from "next/navigation";
import { z } from "zod";

const uuid = z.uuid();

/** Route ids must be UUIDs; anything else is a 404, never a database error. */
export function requireUuid(value: string): string {
  const parsed = uuid.safeParse(value);
  if (!parsed.success) notFound();
  return parsed.data;
}
