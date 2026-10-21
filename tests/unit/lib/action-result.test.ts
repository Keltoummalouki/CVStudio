import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fail, issuesFromZod, mapDatabaseError, ok } from "@/lib/actions/result";
import { DataAccessError } from "@/lib/data/errors";
import { requireUuid } from "@/lib/data/params";
import { asJson, asJsonObject } from "@/lib/supabase/json";

describe("action results", () => {
  it("wraps data and failures, omitting empty field issues", () => {
    expect(ok({ id: "1" })).toEqual({ ok: true, data: { id: "1" } });
    expect(fail("stale")).toEqual({ ok: false, error: "stale" });
    expect(fail("invalid_input", [{ path: "name", message: "required" }])).toEqual({
      ok: false,
      error: "invalid_input",
      fieldIssues: [{ path: "name", message: "required" }],
    });
  });

  it("turns Zod issues into dotted paths with message keys", () => {
    const schema = z.object({
      links: z.array(z.object({ url: z.string().min(1, { error: "required" }) })),
    });
    const result = schema.safeParse({ links: [{ url: "" }] });
    expect(result.success).toBe(false);
    expect(issuesFromZod(result.error!)).toEqual([{ path: "links.0.url", message: "required" }]);
  });
});

describe("mapDatabaseError", () => {
  it("never exposes database messages, only the outcomes forms explain", () => {
    expect(mapDatabaseError(null)).toBe("unavailable");
    expect(mapDatabaseError({ code: "42501", message: "permission denied for table x" })).toBe(
      "unauthorized",
    );
    expect(mapDatabaseError({ message: "stale_record" })).toBe("stale");
    expect(mapDatabaseError({ message: "record_not_found" })).toBe("not_found");
    expect(mapDatabaseError({ code: "08006", message: "connection failure" })).toBe("unavailable");
  });

  it("treats constraint and type violations as invalid input", () => {
    for (const code of ["23514", "23502", "23503", "22P02", "22001", "22003", "22007", "22008"]) {
      expect(mapDatabaseError({ code })).toBe("invalid_input");
    }
    expect(mapDatabaseError({ message: "too_many_items" })).toBe("invalid_input");
    expect(mapDatabaseError({ message: "invalid_payload" })).toBe("invalid_input");
  });
});

describe("data helpers", () => {
  it("keeps database details out of DataAccessError messages", () => {
    const cause = new Error("relation cv_documents: row 42 secret");
    const error = new DataAccessError("read CV", { cause });
    expect(error.name).toBe("DataAccessError");
    expect(error.message).toBe("Data access failed: read CV");
    expect(error.cause).toBe(cause);
  });

  it("answers 404 for route ids that are not UUIDs", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(requireUuid(id)).toBe(id);
    expect(() => requireUuid("../../etc/passwd")).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("sends JSON exactly as Postgres receives it", () => {
    expect(asJson({ a: 1, skipped: undefined, nested: { b: [1, undefined] } })).toEqual({
      a: 1,
      nested: { b: [1, null] },
    });
    expect(asJsonObject({})).toEqual({});
  });
});
