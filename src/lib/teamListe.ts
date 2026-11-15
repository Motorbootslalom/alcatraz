import type { AppState, Starter } from '../types'
import { ausgleichKg } from '../domain/gewicht'
import { sollgewichtOf } from '../config/catalog'
import { besetzungText, zeigtCoPilot } from './besetzung'
import { ALLE, gewaehlteHerkuenfte, herkuenfte, nachStartnummer } from './starterlisten'

// Die Liste der Fahrer je Team nach Regel 960, Pkt. 3.7 – rein, ohne DOM
// (components/TeamListen.vue zeichnet sie). Wortlaut:
//   „After the registration procedure is finished, a list of drivers for each team shall be
//    posted. The list must contain: - Race number; - Name and surname; - Sex; - Date of birth
//    (day/month/year); - Verified weight and ballast required; - Class. For classes Dolphin,
//    1 - 3 also the name of the co-driver must be indicated“
//
// Je Team (Herkunft, wie in der Mannschaftswertung) ein Dokument, nach Startnummer. Eine
// INTERNE Liste (Entscheidung des Nutzers vom 15.11.2026): Sie trägt Geburtsdatum, Geschlecht
// und Gewicht Minderjähriger und steht deshalb in keiner Datei, die verschickt wird. Das
// Geburtsdatum folgt der Listen-Option der Veranstaltung (`showBirthdate`) und lässt sich dort
// abschalten. Das Geschlecht ist ein freiwilliges Starterfeld – wo es fehlt, bleibt die Zelle leer.

export type TeamStand = Pick<AppState, 'starters' | 'originMode' | 'startNrMode' | 'regelwerk' | 'sollgewicht' | 'coPiloten'>

export interface TeamZeile {
  starter: Starter
  /** Ballast in ganzen kg; `null` = gewogen, keiner nötig; `undefined` = noch nicht gewogen (wie lib/ausgleich.ts). */
  ausgleich: number | null | undefined
  /** Der Co-Driver der Klasse; `undefined` = die Klasse fährt ohne (Pkt. 3.7: nur Dolphin, 1 – 3), leer = noch nicht eingetragen. */
  coDriver: string | undefined
}

export interface TeamListe {
  schluessel: string
  /** Name des Teams im Kopf. */
  name: string
  zeilen: TeamZeile[]
  /** So viele Fahrer des Teams sind noch nicht gewogen. */
  ungewogen: number
}

/** Je Team eine Liste, nach Startnummer; `wahl` ist {@link ALLE} oder der Schlüssel eines Teams. Ohne Herkunft keine. */
export function teamListen(stand: TeamStand, wahl: string = ALLE): TeamListe[] {
  return gewaehlteHerkuenfte(herkuenfte(stand.starters, stand.originMode), wahl).map((h) => {
    const zeilen = nachStartnummer(h.starter, stand.startNrMode).map(
      (p): TeamZeile => ({
        starter: p,
        ausgleich: ausgleichKg(p.gewicht, sollgewichtOf(stand.regelwerk, stand.sollgewicht, p.klasse)),
        coDriver: zeigtCoPilot(stand, p.klasse) ? besetzungText(stand.coPiloten, p.klasse) : undefined,
      }),
    )
    return { schluessel: h.schluessel, name: h.name, zeilen, ungewogen: zeilen.filter((z) => z.ausgleich === undefined).length }
  })
}
