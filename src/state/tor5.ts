import type { AppState } from '../types'
import { configFor, type Konfig } from '../config/konfig'
import { listeUmziehen } from '../lib/eingaben'
import { nameUmziehen } from '../lib/einteilung'

// „Tor 5 übernimmt die Parcoursüberwachung“: Je nach Aufbau und Option steht die Einfahrt in
// Tor 5 auf einer anderen Liste (Tor 5 oder Tor 5 + Parcours). Was an dieser Liste hängt –
// Disq., Bemerkung, Haken „erfasst“, der Name des Wettkampfrichters –, muss mitziehen, sobald
// sie wechselt. Das hängt an EINER Stelle und nicht an einzelnen Actions: Die Liste wechselt
// auf vielen Wegen (Option, Aufbau, ein geänderter eigener Aufbau, eine geladene Vorlage), und
// jeder vergessene Weg ließe gültige Eingaben als „verborgen“ zurück.

type Wahl = Pick<AppState, 'regelwerk' | 'eigeneAufbauten' | 'aufbau' | 'tor5MitParcours'>

const konfigVon = (stand: Wahl): Konfig => configFor({ regelwerk: stand.regelwerk, eigeneAufbauten: stand.eigeneAufbauten })

/** Was der Aufbau zusammenlegen kann; `undefined`, wenn er es nicht kann. */
const kombiVon = (konfig: Konfig, stand: Wahl) => konfig.getAufbau(stand.aufbau).kombi

/**
 * Der neue Stand, nachdem mitgezogen ist, was an der Liste für Tor 5 hing – wie
 * `listenUmziehen` im Prototyp mit dem festen Paar Tor 5 ↔ Tor 5 + Parcours. Ein belegtes Ziel
 * wird nicht überschrieben; die Parcoursliste selbst hat keine Entsprechung, ihre Einträge
 * bleiben für das Trennen stehen. Ändert sich nichts, kommt `next` selbst zurück.
 *
 * Ist weder vorher noch nachher zusammengelegt, bleibt alles, wo es ist (ein bloßer Wechsel
 * des Aufbaus zieht nichts um). Kann ein Aufbau nichts zusammenlegen, steht dort die einzelne
 * Liste Tor 5 – die, die der andere Aufbau beim Zusammenlegen ersetzt.
 */
export function mitTor5Umzug(alt: AppState, next: AppState): AppState {
  if (!alt.tor5MitParcours && !next.tor5MitParcours) return next
  if (alt.aufbau === next.aufbau && alt.tor5MitParcours === next.tor5MitParcours && alt.eigeneAufbauten === next.eigeneAufbauten && alt.regelwerk === next.regelwerk) return next
  const konfig = konfigVon(next)
  const kombiAlt = kombiVon(konfigVon(alt), alt)
  const kombiNeu = kombiVon(konfig, next)
  const einzeln = (kombi: typeof kombiAlt) => kombi?.ersetzt[0]
  const liste = (kombi: typeof kombiAlt, zusammen: boolean) => (kombi ? (zusammen ? kombi.positionId : einzeln(kombi)) : undefined)
  const von = liste(kombiAlt, alt.tor5MitParcours) ?? (next.tor5MitParcours ? einzeln(kombiNeu) : undefined)
  const nach = liste(kombiNeu, next.tor5MitParcours) ?? (alt.tor5MitParcours ? einzeln(kombiAlt) : undefined)
  if (!von || !nach || von === nach) return next
  const disziplin = konfig.getAufbau(next.aufbau).disziplin
  const klasseVon = new Map(next.starters.map((s) => [s.id, s.klasse as string]))
  const eingaben = listeUmziehen(next.eingaben, konfig, disziplin, (id) => klasseVon.get(id), von, nach)
  const einteilung = nameUmziehen(next.einteilung, von, nach)
  return eingaben === next.eingaben && einteilung === next.einteilung ? next : { ...next, eingaben, einteilung }
}
