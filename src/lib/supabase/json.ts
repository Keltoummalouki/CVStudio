import type { Json } from "./database.types";

/** JSON round-trip: drops undefined keys so the payload is exactly what Postgres receives. */
export function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

/** `asJson` for objects, for columns declared `not null`. */
export function asJsonObject(value: object): NonNullable<Json> {
  return asJson(value) ?? {};
}
