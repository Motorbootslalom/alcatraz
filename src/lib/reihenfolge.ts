import type { OriginMode, Starter } from '../types'
import type { MessageKey } from '../i18n'
import { sizeRank, SIZES } from '../domain/sizes'
import { GESCHLECHTER } from '../domain/geschlecht'
import { originLabelKey, originOf } from './origin'
import { zufallAus } from './beispielwerte'

/**
 * Reihenfolge der Starter einer Klasse im Reiter „Starter“ (Entscheidung des Nutzers vom
 * 15.11.2026): nach einer Spalte – ein Klick sortiert aufsteigend, ein zweiter auf dieselbe
 * Spalte dreht die Richtung um – oder zufällig. Die vorhandenen Startnummern der Klasse werden
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
