/**
 * Capabilities that ship in later milestones. Their entry points render as
 * visibly unavailable ("Soon") instead of linking to routes that do not exist.
 * Delete each flag, and its call sites' fallback, when the milestone lands.
 */
export const AVAILABILITY = {
  templates: false,
} as const;

export type Capability = keyof typeof AVAILABILITY;

export function isAvailable(capability: Capability): boolean {
  return AVAILABILITY[capability];
}
