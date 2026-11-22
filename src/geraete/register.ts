import { liesAufgaben, listenAufgaben, type Aufgabe } from './aufgaben'
import type { GeraetAngabe } from '../wkr/lage'
import { gruppenFuer } from './wkrGruppen'
import { istOeffentlich, type GeraeteTyp } from './transport/protokoll'
import type { BekanntesGeraet } from './koppelEntscheid'
import { liesKoppelStand, type KoppelStand } from './koppeln'
import { ENTZOGEN_HOECHSTENS, mitGruppe, type HostRaum } from './transport/ntfy/raum'

/**
 * Das Register gekoppelter Geräte (Etappe E7, Plan vom 16.11.2026 §3 „Gerätelokal“ und §5) – rein, über dem Raum des
 * Hosts. Es liegt IM Raum (`raum.geraete`, raum.ts GebundenesGeraet; `raum.entzogen`; `raum.koppeln`), also
 * gerätelokal in `alcatraz.geraete.raum` (geraete/ablage.ts): nie im AppState, nie in Sicherung, Vorlage oder Verlauf.
 * Ein Eintrag hält Schlüssel (`pk`, nie umgebunden: S1), letzte Nummer (Doppelte, K18), Gruppen, Name, Aufgaben und
 * wann es gekoppelt bzw. zuletzt gehört wurde. Bindung, Nummer und Entzug schreibt der Transport (transport.ts
 * begruesse/quittiere/entziehe), Name, Aufgaben und Koppel-Stand der Host (geraete/host.ts) über
 * `HostTransport.verwalte` – beides nur im Führungsfenster.
 *
 * Ein Ersatzrechner übernimmt das Register nicht (Entscheidung F4 vom 16.11.2026): neuer Raum, neu koppeln.
 */

/** Was die Geräteliste zeigt – ohne Schlüssel und Nummern. */
export interface RegisterEintrag {
  id: string
  name: string
  aufgaben: Aufgabe[]
  /** Wann gekoppelt bzw. zuletzt gehört (Uhr des Bedienrechners, ms; 0 = unbekannt). */
  seit: number
  zuletzt: number
  /** W1: aus dem letzten Lebenszeichen (fehlt, solange keines kam). */
  wartend?: number
  akku?: number
  /** Art (W3-25, 21.11.2026): handy/pad/rechner – vom Gerät beim Koppeln, am Bedienrechner änderbar; fehlt = unbekannt. */
  typ?: GeraeteTyp
  /** Auf dem Gerät geänderte WKR-Namen je Liste (W3-13, WN2) – fehlt, solange keiner geändert ist. */
  wkrNamen?: Record<string, string>
}

export interface EntzogenEintrag {
  id: string
  name: string
  um: number
  /** Öffentlicher Schlüssel (raum.ts EntzogenesGeraet.pk); nur im Raum, nicht in der Geräteliste. */
  pk?: string
}

/** Die gekoppelten Geräte, nach Name. */
export function geraeteListe(raum: HostRaum): RegisterEintrag[] {
  return Object.entries(raum.geraete)
    .map(([id, g]): RegisterEintrag => ({
      id, name: g.name ?? '', aufgaben: liesAufgaben(g.aufgaben), seit: g.seit ?? 0, zuletzt: g.zuletzt ?? 0,
      ...(g.wartend !== undefined ? { wartend: g.wartend } : {}),
      ...(g.akku !== undefined ? { akku: g.akku } : {}),
      ...(g.typ !== undefined ? { typ: g.typ } : {}),
      ...(g.wkrNamen && Object.keys(g.wkrNamen).length > 0 ? { wkrNamen: { ...g.wkrNamen } } : {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

/**
 * W2.2 (21.11.2026): Was die Lage der WKR-Erfassung (wkr/lage.ts) über die Geräte braucht – einfache Daten aus der
 * Geräteliste, nur Geräte mit Listen. Name, zuletzt, wartend, Akku bleiben gerätelokal; die Lage rechnet nur damit.
 */
export function geraetAngaben(geraete: readonly RegisterEintrag[]): GeraetAngabe[] {
  return geraete
    .map((g): GeraetAngabe => ({
      id: g.id,
      name: g.name,
      listen: listenAufgaben(g.aufgaben).map((l) => ({ liste: l.liste, ...(l.teil !== undefined ? { teil: l.teil } : {}) })),
      zuletzt: g.zuletzt,
      ...(g.wartend !== undefined ? { wartend: g.wartend } : {}),
      ...(g.akku !== undefined ? { akku: g.akku } : {}),
    }))
    .filter((g) => g.listen.length > 0)
}

/** Die zuletzt entzogenen Geräte, neueste zuerst. */
export function entzogeneListe(raum: HostRaum): EntzogenEintrag[] {
  return (raum.entzogen ?? []).map(({ id, name, um }) => ({ id, name, um })).sort((a, b) => b.um - a.um)
}

/** Für koppelEntscheid.ts: was der Host über jedes gebundene Gerät weiß. */
export function bekannteGeraete(raum: HostRaum): Record<string, BekanntesGeraet> {
  const aus: Record<string, BekanntesGeraet> = {}
  for (const [id, g] of Object.entries(raum.geraete)) aus[id] = { pk: g.pk, name: g.name ?? '', aufgaben: liesAufgaben(g.aufgaben) }
  return aus
}

/** Die Aufgaben eines Geräts laut Register; ohne Eintrag (nie gekoppelt, entzogen) keine. */
export function aufgabenVon(raum: HostRaum, id: string): Aufgabe[] {
  return liesAufgaben(raum.geraete[id]?.aufgaben)
}

/** Was sich an den Gruppen eines Geräts geändert hat (W1): `neu` = Schlüssel schicken, `weg` = Gruppe neu verschlüsseln. */
export interface GruppenWechsel {
  neu: string[]
  weg: string[]
}

/**
 * Die nicht öffentlichen Gruppen eines Geräts nach seinen Aufgaben (W1, wkrGruppen.ts gruppenFuer: je Liste eine) –
 * fehlende Gruppen werden im selben Schreiben angelegt. `ko` steht nie in `gruppen` (öffentlich, nie neu verschlüsselt).
 */
export function gruppenNachAufgaben(raum: HostRaum, aufgaben: readonly Aufgabe[]): string[] {
  const gruppen = gruppenFuer(aufgaben).filter((g) => !istOeffentlich(g))
  for (const g of gruppen) mitGruppe(raum, g)
  return gruppen.filter((g) => raum.gruppen[g])
}

/**
 * Rechte ändern (wirkt sofort: der Host schickt `aufgaben` an das Gerät). Ab W1 folgen die Gruppen den Aufgaben
 * (Liste dazu → Gruppe, Liste weg → Gruppe weg); was sich geändert hat, steht im Ergebnis – den Schlüssel schicken
 * bzw. neu verschlüsseln tut der Host (transport.ts schickeSchluessel/rotiere). `null` ohne Eintrag.
 */
export function setzeAufgaben(raum: HostRaum, id: string, aufgaben: Aufgabe[]): GruppenWechsel | null {
  const g = raum.geraete[id]
  if (!g) return null
  g.aufgaben = liesAufgaben(aufgaben)
  const vorher = g.gruppen
  const nachher = gruppenNachAufgaben(raum, g.aufgaben as Aufgabe[])
  // Andere (nicht aus Aufgaben stammende) Gruppen eines Geräts gibt es bisher nicht; was nicht mehr passt, fällt weg.
  g.gruppen = nachher
  return { neu: nachher.filter((x) => !vorher.includes(x)), weg: vorher.filter((x) => !nachher.includes(x)) }
}

/** Umbenennen (Geräteliste). `false` ohne Eintrag. */
export function benenne(raum: HostRaum, id: string, name: string): boolean {
  const g = raum.geraete[id]
  if (!g || !name) return false
  g.name = name.slice(0, 60)
  return true
}

/**
 * Art des Geräts setzen (W3-25, GF7). `nurWennFehlt`: aus der Anmeldung – nur beim ersten Koppeln, damit eine Wahl des
 * Bedieners eine spätere Anmeldung (nach jedem Neuladen) überdauert. `false` ohne Eintrag oder unverändert.
 */
export function setzeTyp(raum: HostRaum, id: string, typ: GeraeteTyp, nurWennFehlt = false): boolean {
  const g = raum.geraete[id]
  if (!g || g.typ === typ || (nurWennFehlt && g.typ !== undefined)) return false
  g.typ = typ
  return true
}

/** Zuletzt gehört – bei jeder bearbeiteten Nachricht des Geräts. */
export function beruehre(raum: HostRaum, id: string, jetzt: number): void {
  const g = raum.geraete[id]
  if (g) g.zuletzt = jetzt
}

/**
 * W1: Lebenszeichen – zuletzt gehört, dazu wartende Zeilen und Akku (fehlt der Akku, gilt der alte nicht mehr).
 * Seit 21.11.2026 (W3-13, WN2) die auf dem Gerät geänderten WKR-Namen: Trägt das Lebenszeichen `namen`, ersetzen sie
 * die bisherigen (leer = keine mehr); fehlt das Feld (älteres Gerät), bleiben sie. Nur Namen eigener Listen.
 */
export function vermerkeLebenszeichen(raum: HostRaum, id: string, jetzt: number, angaben: { wartend: number; akku?: number; namen?: Record<string, string> }): void {
  const g = raum.geraete[id]
  if (!g) return
  g.zuletzt = jetzt
  g.wartend = angaben.wartend
  if (angaben.akku !== undefined) g.akku = angaben.akku
  else delete g.akku
  if (angaben.namen !== undefined) {
    const eigene = new Set(listenAufgaben(liesAufgaben(g.aufgaben)).map((a) => a.liste))
    const namen = Object.fromEntries(Object.entries(angaben.namen).filter(([liste]) => eigene.has(liste)))
    if (Object.keys(namen).length > 0) g.wkrNamen = namen
    else delete g.wkrNamen
  }
}

/** W1: Hat das Gerät die Gruppe (dann bekommt es seine Quittungen gesammelt über deren Sicht)? */
export function hatGruppe(raum: HostRaum, id: string, gruppe: string): boolean {
  return !!raum.geraete[id]?.gruppen.includes(gruppe)
}

/**
 * Den Entzug für die Geräteliste vermerken (der Entzug selbst: transport.ts entziehe – aus dem Register, `entzogen`
 * an das Gerät, neue Schlüssel nicht öffentlicher Gruppen). Name vor dem Entzug lesen, er steht danach nicht mehr da.
 */
export function vermerkeEntzug(raum: HostRaum, eintrag: EntzogenEintrag): void {
  const liste = (raum.entzogen ?? []).filter((e) => e.id !== eintrag.id)
  liste.push(eintrag)
  raum.entzogen = liste.slice(-ENTZOGEN_HOECHSTENS)
}

/** Koppel-Stand des Raums (geraete/koppeln.ts). */
export function koppelStandVon(raum: HostRaum): KoppelStand {
  return liesKoppelStand(raum.koppeln)
}

export function setzeKoppelStand(raum: HostRaum, stand: KoppelStand): void {
  raum.koppeln = stand.code || stand.qr ? JSON.parse(JSON.stringify(stand)) : undefined
  if (raum.koppeln === undefined) delete raum.koppeln
}

/**
 * Druck nach Modus (Nutzer 21.11.2026, WKR_ANNAHMEN Z3): Welche Teile einer Liste die gekoppelten Geräte abdecken –
 * ein Gerät ohne Teil deckt alle. Leer = kein Gerät hat die Liste. Für wkr/druck.ts `TeilAbdeckung` (Listen → WKR-Bögen).
 */
export function abgedeckteTeile(geraete: readonly RegisterEintrag[], liste: string): Set<'ab' | 'an'> {
  const teile = new Set<'ab' | 'an'>()
  for (const g of geraete) {
    for (const a of listenAufgaben(g.aufgaben)) {
      if (a.liste !== liste) continue
      if (a.teil === undefined) {
        teile.add('ab')
        teile.add('an')
      } else teile.add(a.teil)
    }
  }
  return teile
}
