import { OEFFENTLICH } from './transport/protokoll'
import { freigabeBereiche, listenAufgaben, type Aufgabe } from './aufgaben'

// Gruppen der WKR-Listen (W1, Plan docs/plan-wkr-w1.md §5, 21.11.2026): Je Liste eine eigene verschlüsselte Gruppe,
// über die der Host die Sicht der Liste (wkr/sicht.ts) und damit die gesammelten Quittungen schickt. Nur die Geräte
// dieser Liste haben ihren Schlüssel; entzogen → neuer Schlüssel (wie beim Entzug der Start-Freigabe).
//
// Der Name der Gruppe ist aus der Listen-Kennung abgeleitet, damit Host, Register und Gerät ihn ohne Absprache
// gleich bilden: 'l' + 8 Hexziffern (FNV-1a, 32 Bit) – passt zu transport/protokoll.ts istGruppe (Kleinbuchstabe
// vorn, höchstens 16 Zeichen) und kann nie `ko`/`kz` sein. Das Thema auf dem Server leitet sich ohnehin über das
// Geheimnis des Raums ab (themen.ts gruppenThema); der Name verrät nichts über die Liste.

/** FNV-1a über die UTF-16-Einheiten, 32 Bit – stabil in jedem Browser. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** Die Gruppe einer Liste (Listen-Kennung, wkr/liste.ts): `l` + 8 Hexziffern. */
export function gruppeDerListe(liste: string): string {
  return 'l' + fnv1a(liste).toString(16).padStart(8, '0')
}

/**
 * W2.4 (Plan docs/plan-wkr-w2.md §5, 21.11.2026): Die Freigabe-Gruppe eines Bereichs – `f` + 8 Hexziffern (FNV-1a über
 * `["f", bereich]`). Sie trägt die Freigabe-Sicht (wkr/freigabe.ts: Rückstand der WKR-Listen ohne Werte und Namen) und
 * gehört nur Geräten mit der Aufgabe „Start-Freigabe“ für diesen Bereich – nie den Lese-Links (ko/kz, F17).
 */
export function gruppeDerFreigabe(bereich: string): string {
  return 'f' + fnv1a(JSON.stringify(['f', bereich])).toString(16).padStart(8, '0')
}

/**
 * Die Gruppen, die ein Gerät mit diesen Aufgaben lesen darf: die öffentliche Sicht, je Liste deren Gruppe und (W2.4)
 * je Bereich der Start-Freigabe dessen Freigabe-Gruppe.
 */
export function gruppenFuer(aufgaben: readonly Aufgabe[]): string[] {
  return [
    OEFFENTLICH,
    ...new Set([...listenAufgaben(aufgaben).map((a) => gruppeDerListe(a.liste)), ...freigabeBereiche(aufgaben).map(gruppeDerFreigabe)]),
  ]
}
