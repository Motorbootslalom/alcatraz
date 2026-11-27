import type { AppState, BereichBetrieb, PaarSeite } from '../types'
import type { Konfig } from '../config/konfig'
import { abbruecheVon, betriebVon, laeufeVonPunkt, laufPunkt } from '../betrieb/folge'
import { WKR_ANNAHMEN } from './annahmen'

// Wiederholung nach Ausfall auf den WKR-Geräten (Nutzer 26.11.2026, R11-11; BETRIEB_ANNAHMEN WH6/WH7). Rein.
//
// Der Betrieb benennt einen Start nach dem, was ihn ausmacht (Starter + Lauf, betrieb/folge.ts refKey) – die
// Wiederholung ist also derselbe Start. Ein Gerät aber merkt sich je Kennung, was es geschickt hat: Es hielte die
// Wiederholung für erledigt und schickte ihre Werte mit `vorher` des abgebrochenen Versuchs (der Bedienrechner sähe
// lauter Konflikte). Deshalb bekommen die Geräte – und nur sie, in der Sicht ihrer Liste (wkr/sicht.ts) – je Versuch eine
// eigene Kennung: der erste wie bisher die des Betriebs, nach n Abbrüchen `["w", n, <Kennung>]`. Was zurückkommt
// (Zeile `s`, Prüfsummen des Abschlusses), liest liesVersuch wieder auf die Kennung des Betriebs zurück; ein veralteter
// Versuch ist daran erkennbar, dass seine Zahl nicht mehr die jetzige ist.
//
// Parallelslalom (Nutzer 27.11.2026, R13-02): Die Kennung ist die des Paares, die Listen aber stehen je Racecourse. Wiederholt
// nur ein Boot (GezeigterStart.nur), zählen für die Listen des anderen Racecourse nur die Abbrüche, die ihr Boot trafen –
// dort bleibt die Kennung, die Zeile gilt weiter, nichts kommt doppelt (BETRIEB_ANNAHMEN WHP4).

/** Die Kennung, unter der die Geräte den n-ten Versuch eines Starts bekommen (n = Zahl der Abbrüche davor). */
export function versuchsKennung(key: string, n: number): string {
  return n > 0 ? JSON.stringify(['w', n, key]) : key
}

/**
 * Kennung des Betriebs und Zahl der Abbrüche zu einer Geräte-Kennung; eine gewöhnliche Kennung ist Versuch 0. `null`
 * nur bei einer kaputten Wiederholungs-Kennung (oder keinem Text).
 */
export function liesVersuch(kennung: unknown): { key: string; n: number } | null {
  if (typeof kennung !== 'string') return null
  if (!kennung.startsWith('["w"')) return { key: kennung, n: 0 }
  try {
    const t: unknown = JSON.parse(kennung)
    if (Array.isArray(t) && t.length === 3 && t[0] === 'w' && Number.isInteger(t[1]) && (t[1] as number) >= 1 && typeof t[2] === 'string' && t[2] !== '' && !t[2].startsWith('["w"')) {
      return { key: t[2], n: t[1] as number }
    }
  } catch {
    // unlesbar
  }
  return null
}

/** Die Seite eines Paares, deren Boot eine Liste erfasst: Racecourse A → `a`, B → `b`; im Manövrieren keine. */
export function listenSeite(liste: { racecourse: 'A' | 'B' | null }): PaarSeite | undefined {
  return liste.racecourse === 'A' ? 'a' : liste.racecourse === 'B' ? 'b' : undefined
}

/** Die Kennung, unter der die Geräte diesen Start jetzt bekommen (`b` = Betrieb seines Bereichs; `seite` = die der Liste, {@link listenSeite}). */
export function geraeteKennung(b: Pick<BereichBetrieb, 'gezeigt'>, key: string, seite?: PaarSeite): string {
  return versuchsKennung(key, abbruecheVon(b, key, seite))
}

/** Gehört die Geräte-Kennung zu einem abgebrochenen Versuch (oder ist sie kaputt)? Gewöhnliche Kennungen ohne Abbruch: nein. */
export function versuchVeraltet(b: Pick<BereichBetrieb, 'gezeigt'>, kennung: unknown, seite?: PaarSeite): boolean {
  const v = liesVersuch(kennung)
  return v === null || v.n !== abbruecheVon(b, v.key, seite)
}

/**
 * Gilt eine Liste für alle Versuche eines Starters – der Vorsteg mit „Versuche direkt nacheinander“ (dieselbe Bedingung
 * wie wkr/liste.ts startAufListe `weitere`)? Ihre Zeile bleibt bei der Wiederholung EINES Versuchs stehen
 * (BETRIEB_ANNAHMEN.wiederholungVorstegBleibt).
 */
export function giltFuerAlleVersuche(stand: AppState, konfig: Pick<Konfig, 'getPositions' | 'getSheetDef'>, typeId: string): boolean {
  if (!konfig.getPositions().some((p) => p.typeId === typeId)) return false
  return konfig.getSheetDef(typeId).einmalJeStarter === true && laeufeVonPunkt(stand, laufPunkt(1)).length > 1 && WKR_ANNAHMEN.vorstegAlleVersuche
}

/**
 * Ist die Geräte-Kennung auf DIESER Liste veraltet? Wie {@link versuchVeraltet} – nur gilt auf einer Liste, deren Zeile
 * für alle Versuche gilt (Vorsteg mit „Versuche nacheinander“, WH6), jede lesbare Kennung: Ihre Zeile blieb beim Ausfall
 * stehen, das Gerät darf sie weiter korrigieren, und eine verspätete gilt (Prüfbefund 27.11.2026 – vorher lehnte die
 * Prüfung auch hier `versuch-abgebrochen` ab).
 */
export function versuchVeraltetAuf(stand: AppState, konfig: Pick<Konfig, 'getPositions' | 'getSheetDef'>, liste: { bereich: string; typeId: string; racecourse?: 'A' | 'B' | null }, kennung: unknown): boolean {
  if (!versuchVeraltet(betriebVon(stand, liste.bereich), kennung, listenSeite({ racecourse: liste.racecourse ?? null }))) return false
  return liesVersuch(kennung) === null || !giltFuerAlleVersuche(stand, konfig, liste.typeId)
}
