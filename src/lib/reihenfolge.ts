import type { OriginMode, Starter } from '../types'
import type { MessageKey } from '../i18n'
import { sizeRank, SIZES } from '../domain/sizes'
import { GESCHLECHTER } from '../domain/geschlecht'
import { originLabelKey, originOf } from './origin'
import { zufallAus } from './beispielwerte'

/**
 * Reihenfolge der Starter einer Klasse im Reiter „Starter“ (Entscheidung des Nutzers vom
 * 15.11.2026): nach einer Spalte in drei Stufen (21.11.2026, naechsteSortierung) – oder zufällig. Die vorhandenen Startnummern der Klasse werden
 * danach nur neu verteilt (domain/startnumbers.ts redistributeNumbers; Action ORDER_STARTERS bzw.
 * SHUFFLE_STARTERS). Rein: Der Reducer ruft das hier, der Zufall kommt als `saat`.
 */

/** Die Spalten, nach denen sich sortieren lässt – in der Reihenfolge der Tabelle. */
export const SORTIER_SPALTEN = ['nachname', 'vorname', 'herkunft', 'groesse', 'geschlecht', 'geburtsdatum'] as const
export type SortierSpalte = (typeof SORTIER_SPALTEN)[number]

export const istSortierSpalte = (x: unknown): x is SortierSpalte => (SORTIER_SPALTEN as readonly unknown[]).includes(x)

/** Eine Sortierung: Spalte und Richtung. */
export interface Sortierung {
  spalte: SortierSpalte
  absteigend: boolean
}

/**
 * Die Spalten, die der Reiter zeigt: Herkunft nur, wenn die Veranstaltung eine hat; Geschlecht
 * nur, wenn die Spalte zu sehen ist (components/ClassSection.vue `mitGeschlecht`).
 */
export function sortierSpalten(originMode: OriginMode, mitGeschlecht: boolean): SortierSpalte[] {
  return SORTIER_SPALTEN.filter((s) => (s !== 'herkunft' || originMode !== 'none') && (s !== 'geschlecht' || mitGeschlecht))
}

/** Der Spaltenkopf – derselbe Text wie in der Tabelle; die Herkunft heißt wie unter „Veranstaltung“ gewählt. */
export function spaltenText(spalte: SortierSpalte, originMode: OriginMode): MessageKey {
  switch (spalte) {
    case 'nachname':
      return 'common.lastName'
    case 'vorname':
      return 'common.firstName'
    case 'herkunft':
      return originLabelKey(originMode)
    case 'groesse':
      return 'common.size'
    case 'geschlecht':
      return 'starters.sex'
    case 'geburtsdatum':
      return 'common.birthdate'
  }
}

// Texte nach deutscher Ordnung (Umlaute bei ihrem Grundbuchstaben, groß und klein gleich, Zahlen
// als Zahlen) – fest, nicht nach der Sprache der Oberfläche: Der Reducer muss in jedem Fenster
// dieselbe Reihenfolge ergeben.
const TEXT = new Intl.Collator('de', { numeric: true, sensitivity: 'base' })

/** Der Wert, nach dem sortiert wird; `undefined` = keine Angabe. */
function wertVon(p: Starter, spalte: SortierSpalte, originMode: OriginMode): string | number | undefined {
  const text = (s: string | undefined) => s?.replace(/\s+/g, ' ').trim() || undefined
  switch (spalte) {
    case 'nachname':
      return text(p.nachname)
    case 'vorname':
      return text(p.vorname)
    case 'herkunft':
      return text(originOf(p, originMode))
    case 'groesse': {
      // Klein → groß wie bisher „Nach Größe“; eine unbekannte Größe zählt wie keine.
      const rang = sizeRank(p.groesse)
      return rang >= SIZES.length ? undefined : rang
    }
    case 'geschlecht': {
      const i = p.geschlecht === undefined ? -1 : GESCHLECHTER.indexOf(p.geschlecht)
      return i < 0 ? undefined : i
    }
    case 'geburtsdatum':
      // ISO-Datum (yyyy-mm-dd): als Text verglichen chronologisch – aufsteigend die Ältesten zuerst.
      return text(p.geburtsdatum)
  }
}

/**
 * Die Starter nach einer Spalte geordnet. Stabil: Bei gleichem Wert bleibt die Reihenfolge, in
 * der sie hereinkommen (die der Startnummern) – erst nach Vorname, dann nach Name sortiert ergibt
 * Name und Vorname. Ohne Angabe stehen in beiden Richtungen hinten (Festlegung bei der
 * Umsetzung): Eine fehlende Größe soll nicht beim Umdrehen nach vorn springen.
 */
export function ordneNach(list: readonly Starter[], sortierung: Sortierung, originMode: OriginMode): Starter[] {
  const richtung = sortierung.absteigend ? -1 : 1
  const werte = new Map(list.map((p) => [p.id, wertVon(p, sortierung.spalte, originMode)]))
  return [...list].sort((a, b) => {
    const wa = werte.get(a.id)
    const wb = werte.get(b.id)
    if (wa === undefined || wb === undefined) return wa === wb ? 0 : wa === undefined ? 1 : -1
    const v = typeof wa === 'number' && typeof wb === 'number' ? wa - wb : TEXT.compare(String(wa), String(wb))
    return v * richtung
  })
}

/**
 * Die drei Stufen eines Spaltenkopfs (Wunsch des Nutzers vom 21.11.2026, ersetzt „erst aufsteigend,
 * dann umdrehen“ vom 15.11.2026): erster Klick aufsteigend A→Z (Pfeil ↑), zweiter absteigend Z→A (↓),
 * dritter hebt die Markierung auf (`null`) – die Reihenfolge bleibt dann, wie sie gerade ist (keine Action).
 * Eine andere Spalte beginnt immer bei Stufe 1 (A→Z). Bestätigt 21.11.2026 (Fragenseite S-01, „hier war ich
 * ungenau“): Gebaut war zuerst Z→A – der Nutzer meinte A→Z zuerst, weil das der gewohnte erste Blick ist.
 * „Aufsteigend“ = A→Z bzw. kleinster Wert zuerst (Größe XS vor XL, Geburtsdatum die Ältesten zuerst); ohne
 * Angabe steht in beiden Richtungen hinten (ordneNach).
 */
export function naechsteSortierung(jetzt: Sortierung | null, spalte: SortierSpalte): Sortierung | null {
  if (jetzt?.spalte !== spalte) return { spalte, absteigend: false }
  return jetzt.absteigend ? null : { spalte, absteigend: true }
}

/**
 * Die gewählte Stufe als Bedienauswahl (lib/merken.ts, nie im AppState) – mit der Folge der Starter-IDs je
 * Klasse, wie sie nach dem Sortieren stand. Die Markierung gilt nur, solange die Klasse noch so steht
 * (gleicheFolge) – bestätigt 21.11.2026 (Fragenseite P-19). Warum nicht istGeordnet (21.11.2026, Befund 16): Mit Startnummern-Bereichen (DM,
 * Westengrößen) sortiert der Reducer nur innerhalb jeder Größengruppe – die Klasse steht danach nie
 * „ganz“ nach der Spalte, die Markierung verschwand sofort und der zweite Klick sortierte erneut
 * in der ersten Richtung statt umzuschalten.
 */
export interface SortierWahl extends Sortierung {
  folge: Record<string, string[]>
}

export function istSortierWahl(x: unknown): x is SortierWahl {
  if (typeof x !== 'object' || x === null) return false
  const w = x as Partial<SortierWahl>
  return (
    istSortierSpalte(w.spalte) &&
    typeof w.absteigend === 'boolean' &&
    typeof w.folge === 'object' &&
    w.folge !== null &&
    Object.values(w.folge).every((f) => Array.isArray(f) && f.every((id) => typeof id === 'string'))
  )
}

/** Steht die Klasse noch in der beim Sortieren gemerkten Folge? */
export function gleicheFolge(folge: readonly string[] | undefined, list: readonly Starter[]): boolean {
  return folge !== undefined && folge.length === list.length && list.every((p, i) => p.id === folge[i])
}

/** Pfeil im Spaltenkopf: ↑ aufsteigend (A→Z, Klick 1), ↓ absteigend (Z→A, Klick 2), ↕ nicht gewählt. */
export const sortierPfeil = (s: Sortierung | null, spalte: SortierSpalte): string => (s?.spalte === spalte ? (s.absteigend ? '↓' : '↑') : '↕')

/** Stehen die Starter schon so, wie die Sortierung sie stellte? Dann zeigt der Spaltenkopf die Richtung. */
export function istGeordnet(list: readonly Starter[], sortierung: Sortierung, originMode: OriginMode): boolean {
  return ordneNach(list, sortierung, originMode).every((p, i) => p.id === list[i].id)
}

/** Zufällig gemischt (Fisher-Yates) – aus der Saat der Action, damit der Reducer rein bleibt. */
export function mische<T>(list: readonly T[], saat: number): T[] {
  const zufall = zufallAus(saat)
  const neu = [...list]
  for (let i = neu.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1))
    const tausch = neu[i]
    neu[i] = neu[j]
    neu[j] = tausch
  }
  return neu
}
