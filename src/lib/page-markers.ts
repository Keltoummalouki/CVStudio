/**
 * Attributes the app sets on its own pages and the PDF engine reads back.
 * Kept in a plain module so server code and client components share them.
 */

/** Set on <html> by the print page (PrintReady) once fonts and images are loaded. */
export const PRINT_READY_ATTRIBUTE = "data-print-ready";

/** Set on the message of a route error boundary (RouteError). */
export const ROUTE_ERROR_ATTRIBUTE = "data-route-error";
