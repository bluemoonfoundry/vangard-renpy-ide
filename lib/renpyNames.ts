/**
 * Ren'Py reserves single-underscore names for internal engine use.
 * Those names are valid jump/call targets even when they do not appear
 * in the project's own parsed label set.
 */
export function isReservedRenpyName(name: string): boolean {
  return /^_[A-Za-z0-9_]+$/.test(name);
}
