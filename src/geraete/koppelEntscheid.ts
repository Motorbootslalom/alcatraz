import type { Aufgabe } from './aufgaben'
import { eindeutigerName } from './geraeteName'
import { pruefeKoppeln, type KoppelStand } from './koppeln'

/**
 * Die Entscheidung des Hosts über eine Anmeldung (`hallo`) – an genau einer Stelle, rein (Etappe E7; aus tafel
 * state/pairingDecision.ts, 16.11.2026, mit dem Fix für die Lücke S1 und Gründen als Codes).
 *
 * Zwei Wege führen hinein:
 * 1. Ein **gültiger Code** (Geräte-Code oder QR-Token, geraete/koppeln.ts) auf seinem Koppel-Thema. Die Rechte hat
 *    der Bedienrechner beim Ausgeben festgelegt; das Gerät kann daran nichts ändern.
 * 2. Ein **bekanntes Gerät**: ID UND Schlüssel stehen so im Register (`gebunden`, transport.ts). Es meldet sich nach
 *    Neuladen oder Funkloch selbst wieder an und behält Name und Rechte (Lastenheft P-7) – ohne neuen Code.
 *
 * Lücke S1 des Prototyps: Dort galt ein Gerät schon als bekannt, wenn es eine bekannte ID nannte, und eine neue
 * Anmeldung band dieselbe ID an einen anderen Schlüssel. Hier zählt nur ID UND Schlüssel; eine ID, die einem anderen
 * Schlüssel gehört, wird nie überschrieben – das neue Gerät bekommt eine neue ID (`neueId`), ohne gültigen Code gar
 * nichts. Die Ablehnung nennt nie, ob es die ID gibt.
 */

export type KoppelGrund = 'code-ungueltig' | 'code-abgelaufen' | 'id-belegt'

export type KoppelEntscheid =
  | {
      art: 'willkommen'
      id: string
      name: string
      aufgaben: Aufgabe[]
      /** Womit: `code` heißt, der Geräte-Code ist damit verbraucht; `null` = bekanntes Gerät ohne neuen Code. */
      weg: 'code' | 'qr' | null
    }
  | { art: 'abgelehnt'; grund: KoppelGrund }

/** Was der Host über ein gebundenes Gerät weiß (register.ts). */
export interface BekanntesGeraet {
  pk: string
  name: string
  aufgaben: Aufgabe[]
}

export interface Anmeldung {
  /** Vom Gerät genannte ID. */
  id: string
  /** Sein öffentlicher Schlüssel (aus der Nachricht, nicht behauptet: damit ist sie verschlüsselt). */
  pk: string
  /** ID und Schlüssel stehen so im Register (transport.ts Eingang.gebunden). */
  gebunden: boolean
  /** Vorgeschlagener Name. */
  name: string
  /** Eingetippter Code oder QR-Token ('' bei einer Wiederanmeldung). */
  code: string
  /** Thema, über das die Anmeldung kam. */
  thema: string
}

export interface KoppelAnfrage {
  koppeln: KoppelStand
  geraete: Record<string, BekanntesGeraet>
  anmeldung: Anmeldung
  jetzt: number
  /** Eine neue, freie Geräte-ID (Zufall entsteht außerhalb). */
  neueId: () => string
  /** Name für einen leeren Vorschlag (übersetzt, etwa „Gerät“). */
  ersatzName: string
}

export function entscheideAnmeldung(anfrage: KoppelAnfrage): KoppelEntscheid {
  const { koppeln, geraete, anmeldung, jetzt } = anfrage
  const bekannt = anmeldung.gebunden ? geraete[anmeldung.id] : undefined
  const passt = bekannt && bekannt.pk === anmeldung.pk ? bekannt : null
  const pruefung = anmeldung.code ? pruefeKoppeln(koppeln, anmeldung.code, anmeldung.thema, jetzt) : null

  if (passt) {
    // Ein bekanntes Gerät mit neuem gültigem Code bekommt die Rechte des Codes (der Bedienrechner hat sie so
    // ausgegeben); sonst bleibt alles. Der Name bleibt in beiden Fällen.
    if (pruefung?.ok) return { art: 'willkommen', id: anmeldung.id, name: passt.name, aufgaben: pruefung.aufgaben, weg: pruefung.weg }
    return { art: 'willkommen', id: anmeldung.id, name: passt.name, aufgaben: passt.aufgaben, weg: null }
  }

  if (!pruefung) return { art: 'abgelehnt', grund: 'code-ungueltig' }
  if (!pruefung.ok) return { art: 'abgelehnt', grund: pruefung.grund }

  // S1: Eine ID, die einem anderen Schlüssel gehört, bekommt dieses Gerät nicht – es bekommt eine neue.
  let id = anmeldung.id
  for (let versuch = 0; geraete[id] && geraete[id].pk !== anmeldung.pk; versuch++) {
    if (versuch >= 8) return { art: 'abgelehnt', grund: 'id-belegt' }
    id = anfrage.neueId()
  }
  // Den Namen eindeutig machen kann nur der Host; das Gerät zählt nicht gegen sich selbst.
  const vergeben = Object.entries(geraete).filter(([andere]) => andere !== id).map(([, g]) => g.name)
  const name = eindeutigerName(anmeldung.name || geraete[id]?.name || '', vergeben, anfrage.ersatzName)
  return { art: 'willkommen', id, name, aufgaben: pruefung.aufgaben, weg: pruefung.weg }
}
