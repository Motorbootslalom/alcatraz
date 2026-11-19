/**
 * Adresse eines ntfy-Servers für den Gerätebetrieb (Einstellung `geraeteServer`, Etappe E6, 16.11.2026).
 *
 * Rein und ohne tweetnacl: Reducer und migrate() prüfen damit die Einstellung, ohne etwas aus geraete/ zu laden
 * (dort darf nichts in den Reducer, Wurzel-CLAUDE.md „Feste Regeln“). geraete/themen.ts reicht sie weiter.
 *
 * `https://ntfy.example.org/` → `https://ntfy.example.org`; `null`, wenn es keine http(s)-Adresse ist. Ohne Schema
 * gilt https – so tippt man den Server ein. Pfad bleibt (ein ntfy hinter einem Unterpfad), Anfrage, Anker und
 * Zugangsdaten in der Adresse nicht: Zugangsdaten gehörten in keine Einstellung, die mit Vorlage und Sicherung reist.
 */
export function normalisiereServer(roh: string): string | null {
  const getrimmt = roh.trim().replace(/\/+$/, '')
  if (!getrimmt) return null
  try {
    const url = new URL(getrimmt.includes('://') ? getrimmt : `https://${getrimmt}`)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.search || url.hash || url.username || url.password) return null
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

/**
 * Die Einstellung, wie sie gespeichert wird: '' = Vorgabe des Programms (geraete/themen.ts NTFY_VORGABE), sonst die
 * geprüfte Adresse; `null`, wenn die Eingabe keine Adresse ist (dann bleibt die bisherige).
 */
export function serverEinstellung(roh: unknown): string | null {
  if (typeof roh !== 'string') return null
  if (roh.trim() === '') return ''
  return normalisiereServer(roh)
}
