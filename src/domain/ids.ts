/**
 * Kurze, kollisionsarme IDs. Bewusst nicht `crypto.randomUUID()`, weil das auf
 * `file://` fehlen kann und die IDs hier nur lokal eindeutig sein müssen.
 */
export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
