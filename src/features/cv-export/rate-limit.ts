/**
 * Small in-memory limiter for PDF generation: a headless browser is the most
 * expensive thing this app runs. Per owner, one export at a time and a cap per
 * minute. It is per server instance (serverless instances do not share it),
 * which is enough to stop accidental loops and casual abuse on a single-owner app.
 */
export type ExportLimiter = {
  /** Returns a release function, or null when the owner must wait. */
  acquire: (ownerId: string, now?: number) => (() => void) | null;
};

export function createExportLimiter({
  perMinute = 10,
  windowMs = 60_000,
}: { perMinute?: number; windowMs?: number } = {}): ExportLimiter {
  const recent = new Map<string, number[]>();
  const running = new Set<string>();

  return {
    acquire(ownerId, now = Date.now()) {
      if (running.has(ownerId)) return null;
      const timestamps = (recent.get(ownerId) ?? []).filter((time) => now - time < windowMs);
      if (timestamps.length >= perMinute) {
        recent.set(ownerId, timestamps);
        return null;
      }
      timestamps.push(now);
      recent.set(ownerId, timestamps);
      running.add(ownerId);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        running.delete(ownerId);
      };
    },
  };
}
