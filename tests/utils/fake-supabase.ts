import { vi } from "vitest";
import type { OwnerContext } from "@/lib/auth/session";
import type { SupabaseServerClient } from "@/lib/supabase/server";

/** One chained builder call, e.g. `{ method: "eq", args: ["owner_id", OWNER_ID] }`. */
export type QueryCall = { method: string; args: unknown[] };

/** A query as the code under test built it: its table, then every chained call in order. */
export type RecordedQuery = { table: string; calls: QueryCall[] };

export type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

type Answer = QueryResult | QueryResult[] | ((query: RecordedQuery) => QueryResult);

export type FakeSupabaseOptions = {
  /**
   * Results per table. An array answers successive queries on that table in
   * order (the last entry repeats); a function sees the recorded query.
   */
  tables?: Record<string, Answer>;
  /** Results per database function called through `rpc()`. */
  rpc?: Record<string, QueryResult>;
};

export const OWNER_ID = "5f0c2b1e-8d4a-4c3b-9e2f-1a0b9c8d7e6f";

/**
 * A stand-in Supabase client for server-layer unit tests. Every `from()` chain
 * is recorded so tests can assert the owner scoping each query applies, on top
 * of its outcome. Row Level Security itself is exercised against a real
 * database by `pnpm test:db`.
 */
export function createFakeSupabase({ tables = {}, rpc = {} }: FakeSupabaseOptions = {}) {
  const queries: RecordedQuery[] = [];
  const answered = new Map<string, number>();

  function answer(query: RecordedQuery): QueryResult {
    const configured = tables[query.table];
    if (!configured) return {};
    if (typeof configured === "function") return configured(query);
    if (!Array.isArray(configured)) return configured;
    const index = answered.get(query.table) ?? 0;
    answered.set(query.table, index + 1);
    return configured[Math.min(index, configured.length - 1)] ?? {};
  }

  function from(table: string) {
    const query: RecordedQuery = { table, calls: [] };
    queries.push(query);
    // Any builder method (select, eq, order, update, maybeSingle…) records itself
    // and returns the builder; awaiting it resolves the configured result.
    const builder: object = new Proxy(
      {},
      {
        get(_target, property) {
          if (typeof property === "symbol") return undefined;
          if (property === "then") {
            const result = { data: null, error: null, ...answer(query) };
            return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve(result).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            query.calls.push({ method: property, args });
            return builder;
          };
        },
      },
    );
    return builder;
  }

  const bucket = {
    upload: vi.fn(async (..._args: unknown[]): Promise<QueryResult> => ({ data: {}, error: null })),
    remove: vi.fn(async (..._args: unknown[]): Promise<QueryResult> => ({ data: [], error: null })),
    createSignedUrl: vi.fn(async (path: string, _expiresIn: number) => ({
      data: { signedUrl: `https://storage.test/signed/${path}` } as { signedUrl: string } | null,
      error: null as unknown,
    })),
  };

  const client = {
    from: vi.fn(from),
    rpc: vi.fn(async (fn: string, _args?: unknown) => ({ data: null, error: null, ...rpc[fn] })),
    storage: { from: vi.fn((_bucket: string) => bucket) },
    auth: {
      getClaims: vi.fn(async () => ({ data: null as unknown, error: null as unknown })),
      signInWithPassword: vi.fn(async (_credentials: unknown) => ({
        data: { user: null } as unknown,
        error: null as unknown,
      })),
      signOut: vi.fn(async (_options?: unknown) => ({ error: null })),
    },
  };

  return {
    client,
    supabase: client as unknown as SupabaseServerClient,
    bucket,
    queries,
    /** Queries on one table, in the order they were built. */
    queriesOn: (table: string) => queries.filter((query) => query.table === table),
  };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;

export function ownerContext(fake: FakeSupabase, id = OWNER_ID): OwnerContext {
  return { supabase: fake.supabase, owner: { id, email: "owner@example.test" } };
}

/** The arguments of every call to `method` in a recorded query. */
export function callsOf(query: RecordedQuery | undefined, method: string): unknown[][] {
  return (query?.calls ?? []).filter((call) => call.method === method).map((call) => call.args);
}

/** True when the query filters on `owner_id = ownerId`, the defence in depth behind RLS. */
export function isOwnerScoped(query: RecordedQuery | undefined, ownerId = OWNER_ID): boolean {
  return callsOf(query, "eq").some(([column, value]) => column === "owner_id" && value === ownerId);
}
