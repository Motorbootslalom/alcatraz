import { FAHRWEG } from '../config/kurzform'

// Bojen auf dem Fahrweg für die Bojen-Maske der WKR-Geräte (W4.1, Plan docs/plan-wkr-w4.md §4.1, 21.11.2026) – rein,
// ohne Konfiguration: liest nur die Feld-Kennung (config/feld.ts) und den Fahrweg (config/kurzform.ts FAHRWEG bzw.
// PARALLEL_FAHRWEG hier). An EINER Stelle, damit Sicht (wkr/sicht.ts), Maske (wkr/maske.ts) und Tests dasselbe lesen.
// Eine Kennung, die weder auf dem Fahrweg noch im Parallel-Fahrweg liegt (Knoten, eigene ausführliche Aufbauten),
// ist keine Boje der Maske (P1) – die Liste bleibt dann Papier.

export type Weg = 'hin' | 'rueck'

/** Wo eine Boje auf dem Fahrweg liegt (P2, P3, P6). */
export interface BojenHalt {
  /** FAHRWEG- bzw. Parallel-Key: 't1a', 't5', 'speed1', 'start', 'b3a', 'b5' … (Tor 5 hin und rück: beide 't5'). */
  halt: string
  /** Seite des Umschalters Hinweg/Rückweg (Parallel: Start, Boje 1–4 hin und Boje 5 = hin; Rest rück). */
  weg: Weg
  /** Physische Boje aus der Kennung; Speedbojen und Parallel-Bojen 1–5 haben keine (`null`). */
  seite: 'seiteA' | 'seiteB' | null
  /** Platz in der Fahrt (Index im Fahrweg; Tor 5 hin und rück getrennt, Parallel: Folge der Spalten). */
  folge: number
  /** Nur die Torbojen von Tor 5 zählen Berührungen (F2); alle anderen sind Schalter. */
  zaehler: boolean
  /** Zweiter Halt desselben Tores in derselben Richtung (Tor 1 der Speedrunde, `t1c`, P3). */
  durchfahrt?: 2
}

/**
 * Der Fahrweg des Parallelslaloms – wie die Spalten von `parallelparcours` in config/aufbauten/parallel.yaml
 * (wkr/bojen.test.ts prüft die Folge gegen die Liste: fällt dort eine Spalte weg oder kommt eine dazu, schlägt er an).
 * Boje 5 ist die Wende und zählt noch zum Hinweg (P6).
 */
export const PARALLEL_FAHRWEG = ['start', 'b1a', 'b2a', 'b3a', 'b4a', 'b5', 'b4b', 'b3b', 'b2b', 'b1b', 'ziel'] as const
const PARALLEL_HIN = new Set<string>(['start', 'b1a', 'b2a', 'b3a', 'b4a', 'b5'])

/** Die zweite Durchfahrt eines Tores in derselben Richtung (heute nur Tor 1 der Speedrunde). */
const ZWEITE_DURCHFAHRT = new Set(['t1c'])

/** Zerlegt `key|richtung seite` bzw. `key|seite` bzw. `key`. */
function zerlege(kennung: string): { key: string; richtung: Weg | null; seite: 'seiteA' | 'seiteB' | null } | null {
  const [key, sub, ...rest] = kennung.split('|')
  if (!key || rest.length > 0) return null
  if (sub === undefined) return { key, richtung: null, seite: null }
  const teile = sub.split(' ')
  const seite = teile[teile.length - 1]
  if (seite !== 'seiteA' && seite !== 'seiteB') return null
  if (teile.length === 1) return { key, richtung: null, seite }
  if (teile.length === 2 && (teile[0] === 'hin' || teile[0] === 'rueck')) return { key, richtung: teile[0], seite }
  return null
}

/**
 * Der Halt einer Bojen-Kennung (`t1a|hin seiteB`, `speed2`, `t5|rueck seiteA`, `start|seiteB` im Parallelslalom);
 * `null` = keine Boje auf dem Fahrweg (Knoten, eigene Keys, Katalog-, Disq.- und Text-Felder).
 */
export function bojenHalt(kennung: string): BojenHalt | null {
  const z = zerlege(kennung)
  if (!z) return null
  // Manövrieren: Tore mit Richtung und Seite, Speedbojen ohne beides.
  const i = FAHRWEG.findIndex((h) => h.key === z.key && !h.katalog && (h.speedboje ? z.richtung === null && z.seite === null : h.richtung === z.richtung && z.seite !== null))
  if (i >= 0) {
    const h = FAHRWEG[i]
    const out: BojenHalt = { halt: h.key!, weg: h.richtung ?? 'rueck', seite: z.seite, folge: i, zaehler: h.tor === 'Tor5' }
    if (ZWEITE_DURCHFAHRT.has(h.key!)) out.durchfahrt = 2
    return out
  }
  // Parallelslalom: Start/Ziel mit Seite ohne Richtung, Bojen 1–5 ohne beides.
  const p = (PARALLEL_FAHRWEG as readonly string[]).indexOf(z.key)
  if (p < 0 || z.richtung !== null) return null
  const startZiel = z.key === 'start' || z.key === 'ziel'
  if (startZiel !== (z.seite !== null)) return null
  return { halt: z.key, weg: PARALLEL_HIN.has(z.key) ? 'hin' : 'rueck', seite: z.seite, folge: p, zaehler: false }
}

/**
 * Platz eines Katalog-Felds auf dem Fahrweg (P6): Einfahrt Tor 5 zwischen Tor 5 hin und rück (zählt zum Hinweg),
 * Mann-über-Bord nach Tor 1 R (Rückweg). Andere Felder → `null` (kein Platz im Fahrweg).
 */
export function katalogFolge(kennung: string): { folge: number; weg: Weg } | null {
  if (!kennung.startsWith('katalog:')) return null
  const katalog = kennung.slice('katalog:'.length)
  const i = FAHRWEG.findIndex((h) => h.katalog === katalog)
  if (i < 0) return null
  return { folge: i, weg: katalog === 'tor5' ? 'hin' : 'rueck' }
}
