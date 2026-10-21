import "server-only";

const FALLBACK_TIME_ZONE = "UTC";

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Time zone used to format timestamps (e.g. "last saved"). Calendar values on
 * CVs (month/year) are stored without time and are never time-zone converted.
 * A fixed zone keeps server and client output identical, avoiding hydration
 * mismatches.
 */
export function getAppTimeZone(value: string | undefined = process.env.APP_TIME_ZONE): string {
  const timeZone = value?.trim();
  if (!timeZone) return FALLBACK_TIME_ZONE;

  if (!isValidTimeZone(timeZone)) {
    throw new Error(`APP_TIME_ZONE is not a valid IANA time zone identifier.`);
  }
  return timeZone;
}
