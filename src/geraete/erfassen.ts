import { computed, effectScope, ref, shallowRef, watch, type ComputedRef, type ShallowRef } from 'vue'
import type { ClassId, KeineZeitGrund, WkrPunkt } from '../types'
import { istKeineZeitGrund } from '../wkr/keineZeit'
import { WKR_ANNAHMEN } from '../wkr/annahmen'
import { BEMERKUNG_TRENNER, zeilenPruefsumme } from '../wkr/uebernahme'
import { disqCodes } from '../lib/scoring'
import { LISTEN_SICHT_FASSUNG, type ListenBestand, type ListenSicht, type ListenStart, type WkrHinweis } from '../wkr/sicht'
import type { ListenTeil } from '../wkr/liste'
import { geraetWkrAblage, liesKopplung, type Ablage, type RaumBezug } from './ablage'
import { listenAufgaben, type ListenAufgabe } from './aufgaben'
import type { GekoppeltesGeraet } from './gekoppelt'
import { gruppeDerListe } from './wkrGruppen'
import type { Empfang } from './transport/ntfy/transport'
import { istAblehnung, type Ablehnung, type GeraeteNachricht, type GeraeteTyp } from './transport/protokoll'

/**
 * Gerätekern der digitalen WKR-Erfassung (W1, Plan docs/plan-wkr-w1.md §5, 21.11.2026) – OHNE Oberfläche: Die Masken
 * (W3/W4) setzen auf diesen Kern, wie GeraetFreigabe.vue auf gekoppelt.ts. Ohne Store: Das Gerät kennt nur die Sicht
 * seiner Listen (wkr/sicht.ts, über die verschlüsselte Gruppe der Liste) und seinen Ausgang.
 *
 * - **Ausgang** gerätelokal (ablage.ts `alcatraz.geraet.wkr`, 36 h): wartende Zeilen und Nachrichten der Reihe nach,
 *   die letzten Zeilen mit ihren Werten (≤ WKR_ANNAHMEN.zuletzt, Unbestätigte bleiben immer), je Liste und Punkt die
 *   zuletzt gesendeten Werte jedes Starts (Korrektur: `vorher`; Abschluss: Prüfsummen), der Zeilenzähler `z`.
 *   `z` beginnt wie die Nummern des Transports bei der Uhrzeit (ms): Ein neuer Ausgang nach verlorenem Speicher
 *   erzeugt so nie die Kennung `${geraet}.${z}` einer älteren Zeile (Rückfragen hängen daran).
 * - **Bündeln** (§8): Eine Nachricht geht erst, wenn der Transport nichts Unbestätigtes hat und verbunden ist – dann
 *   alle wartenden Zeilen einer Liste (≤ WKR_ANNAHMEN.buendel) als EINE. Nach einem Funkloch also eine Nachricht.
 * - **Gesammelte Quittung**: `bis` dieses Geräts in der Sicht seiner Liste → `bestaetige(bis)`; die direkte Quittung
 *   gilt auch (Rückfall, wenn das Gerät die Gruppe nicht hat, oder abgelehnt).
 * - **Lebenszeichen** nach WKR_ANNAHMEN.lebenszeichenSek ohne eigene Nachricht, nur mit Liste und laufendem Punkt
 *   (Uhr aus der Umgebung).
 * - Die Maske sperrt nie (keine Wartepflicht): schicke/korrigiere legen nur in den Ausgang.
 * - Kein Starter-Name in irgendeiner Rückgabe (F6): Die Sicht trägt keinen, die Zeilen nur Kennung und Werte; der
 *   Name des Abschlusses geht nur in die Nachricht.
 * - **WKR-Name** (Nutzer 21.11.2026, W3-13, WKR_ANNAHMEN WN1–WN3): vorbelegt aus der Sicht der Liste (`wkrName`, aus
 *   der Einteilung), änderbar je Liste ({@link Erfassung.setzeWkrName}, im Ausgang – also gerätelokal je Raum, weg
 *   mit „Raum verlassen“); eine Änderung geht sofort und danach in jedem Lebenszeichen (`namen`) an den Host.
 * - W3.1 (21.11.2026, Plan docs/plan-wkr-w3.md §4.1): **Schlange je Steg-Teil** (WKR_ANNAHMEN.schlangeJeTeil, H3 –
 *   eigene Zeilen zählen nach Start UND Teil), Startnummer `sn` je eigener Zeile, **Entwürfe** im Ausgang (H4),
 *   `holeZurueck` (G8, nur solange die Zeile wartet), `pruefung` (Prüfansicht für „Liste abschließen“, F7). Die Maske
 *   liest nur {@link ErfassungsQuelle} – dieselbe Schnittstelle bietet die Übung ohne Netz (geraete/uebung.ts).
 */

/** Wie weit eine eigene Zeile ist. */
export type ZeilenStufe =
  /** Wartet im Ausgang (`gesendet: false`) oder ist unterwegs, noch ohne Quittung. */
  | { stufe: 'unterwegs'; gesendet: boolean }
  /** Am Bedienrechner übernommen; `nachRueckfrage`: nach einer Rückfrage, die der Bediener entschieden hat. */
  | { stufe: 'uebernommen'; nachRueckfrage?: true }
  /** Rückfrage am Bedienrechner: was dort jetzt steht (F11, nur diese Zellen). */
  | { stufe: 'rueckfrage'; zellen: { feld: string; lauf: string; steht: string }[] }
  /** Abgelehnt (Code, Texte `geraete.ablehnung.*`); `verworfen` = ntfy hat die Nachricht abgewiesen. */
  | { stufe: 'abgelehnt'; grund: Ablehnung | 'verworfen' }
  /** Nach dem Abschluss des Punkts oder auf Papier: Vorschlag, der Bediener entscheidet (F7). */
  | { stufe: 'vorschlag' }

/** Eine Zeile der Maske: Start (`ListenStart.key`), Werte je Feld-Kennung; `teil` am Steg ohne Teil-Kopplung. */
export interface MaskenZeile {
  s: string
  zellen: Readonly<Record<string, string>>
  teil?: ListenTeil
  /**
   * „Nicht vorbeigekommen“ (W4.3, P16): Die Zeile geht ohne Zellen und mit `n` – `zellen` wird nicht gelesen. Nicht
   * am Vorsteg und nicht im Steg-Ablegen (der Bedienrechner lehnt dort mit `nv-nicht-erlaubt` ab).
   */
  nv?: true
  /**
   * „Keine Zeit“ je Zeitfeld (W5.4, 22.11.2026, ZT4): geht als `kz` mit. Die Zeit-Maske gibt es immer mit (auch `{}`),
   * damit eine Zeile mit allen Zeiten ein älteres Kennzeichen des Starts aufhebt; fehlt es, bleibt das stehende.
   */
  kz?: Readonly<Record<string, KeineZeitGrund>>
}

/** Verbindung, wie die Maske sie zeigt: neutral beim Aufbau, rot erst nach Karenz oder Abriss. */
export type VerbindungsAnzeige = 'verbinde' | 'verbunden' | 'getrennt'

/** Ein Eintrag der Schlange: aus der Sicht; `geschaetzt` = ohne Verbindung aus „danach“ (vielleicht noch nicht gezeigt). */
export interface SchlangenEintrag extends ListenStart {
  geschaetzt?: true
}

/**
 * Ein Starter einer Liste ohne Lauf auf dem Gerät (W5.3, KN3/KN8): aus der Sicht (`bestand`); `erledigt` auch, sobald
 * DIESES Gerät eine (nicht abgelehnte) Zeile für ihn hat – sonst stünde er bis zur nächsten Sicht weiter offen. `z` =
 * die neueste eigene Zeile (für die Korrektur einer schon erledigten Nummer).
 */
export interface BestandEintrag extends ListenBestand {
  z?: number
}

/** Eine der letzten Zeilen (Korrektur über „Zuletzt“). Ohne Namen. */
export interface ZuletztZeile {
  z: number
  liste: string
  s: string
  /** Startnummer, wie sie beim Abschicken in der Sicht stand (W3: „Zuletzt“ zeigt sie auch, wenn der Start weg ist). */
  sn?: string
  /** Steg-Teil der Zeile (ohne: ganze Zeile). */
  teil?: ListenTeil
  punkt: WkrPunkt | null
  korrektur: boolean
  zellen: Record<string, string>
  stufe: ZeilenStufe
  /** „Nicht vorbeigekommen“ (W4.3): Zuletzt zeigt „⊘ nicht vorbeigekommen“ statt der Zellen. */
  nv?: true
  /** „Keine Zeit“ der Zeile (W5.4): Zuletzt zeigt „Zeit 2: keine Zeit“. */
  kz?: Record<string, KeineZeitGrund>
}

export type AbschlussStufe = 'unterwegs' | 'angenommen' | 'abgelehnt'

export interface EigenerAbschluss {
  id: number
  liste: string
  punkt: WkrPunkt
  stufe: AbschlussStufe
  /** Bei `abgelehnt`: `offen` (noch offene Starts ohne „Rest auf Papier“), `nicht-erlaubt`, `verworfen`. */
  grund?: Ablehnung | 'verworfen'
}

/**
 * Eine Liste, von der sich dieses Gerät abgemeldet hat (Nutzer 21.11.2026, WKR_ANNAHMEN.abmeldenWieEntfernen): Titel
 * und Bereich, wie die Sicht sie beim Abmelden nannte (die Sicht ist danach weg), und der eigene Teil am Steg.
 */
export interface AbgemeldeteListe {
  liste: string
  titel: string
  bereich: string
  teil?: ListenTeil
}

/** Ein Entwurf (W3, H4): Zellwerte eines Starts und Teils, noch nicht abgeschickt. */
export interface EntwurfEintrag {
  liste: string
  s: string
  teil?: ListenTeil
  sn?: string
  zellen: Record<string, string>
  /**
   * Fürs Übertragen aufs Papier nach dem Entzug (die Sicht der Liste ist dann weg): Titel und Bereich der Liste und die
   * Überschrift jedes Felds, wie die Sicht sie beim Ablegen nannte (Prüfbefund W3, 21.11.2026). Nie ein Name.
   */
  papier?: EntwurfPapier
}

export interface EntwurfPapier {
  titel: string
  bereich: string
  felder: Record<string, string>
}

/** Eine Zeile der Prüfansicht (F7): ein Start mit den zuletzt gesendeten eigenen Werten. */
export interface PruefZeile {
  s: string
  sn?: string
  klasse: string | null
  zellen: Record<string, string>
  /** Stufe der neuesten eigenen Zeile zu diesem Start, solange sie noch im Ausgang steht. */
  stufe: ZeilenStufe | null
  /** Enthält ein X „nicht gestartet“ (F5). */
  x: boolean
  /** Zuletzt als „nicht vorbeigekommen“ gemeldet (W4.3) – ohne Werte, kein X. */
  nv: boolean
}

/** Prüfansicht eines Punkts (F7, Plan §5.7): eigene Zeilen, offene Starts, X – nur aus Ausgang und Sicht. */
export interface Pruefung {
  zeilen: PruefZeile[]
  /** Offene Starts dieses Punkts in der Schlange (des Teils), ohne Vorsteg-Vorschau und „entfällt“. */
  offen: SchlangenEintrag[]
  /** Startnummern der Zeilen mit X. */
  x: string[]
  /** Startnummern der Zeilen „nicht vorbeigekommen“ (W4.3, WKR_ANNAHMEN.nichtVorbeiImAbschluss). */
  nichtVorbei: string[]
}

/** WKR-Name einer Liste auf dem Gerät (W3-13): wirksam, aus der Einteilung, auf dem Gerät geändert. */
export interface WkrNameLage {
  name: string
  einteilung: string
  eigen: boolean
}

export interface ErfassenUmgebung {
  /** Vorgabe localStorage – dieselbe wie die des Geräts. */
  ablage?: Ablage | null
  /** Uhr des Geräts (Tests: Fake-Uhr für das Lebenszeichen). */
  uhr?: () => number
  /** Wie oft geprüft wird, ob ein Lebenszeichen fällig ist (Vorgabe 5 s). */
  taktMs?: number
  /** Akku in Prozent, wenn der Browser ihn verrät. */
  akku?: () => number | undefined
}

/**
 * Was die Maske vom Kern liest und ruft (W3) – die echte Erfassung ({@link oeffneErfassung}) und die Übung ohne Netz
 * (geraete/uebung.ts oeffneUebung) bieten dieselbe Schnittstelle.
 */
export type ErfassungsQuelle = Omit<Erfassung, never>

export interface Erfassung {
  /** Übung ohne Netz (geraete/uebung.ts): nichts geht an einen Bedienrechner. */
  readonly uebung: boolean
  /**
   * Nur Übung (Nutzer 22.11.2026, R7-45, WKR_ANNAHMEN Y4): „Klasse vorziehen“ – der nächste gezeigte Start ist einer
   * dieser Klasse (ist gerade keiner gezeigt, sofort), am Tisch springt der Vorschlag auf ihren ersten offenen. Die
   * echte Erfassung hat es nicht: Die Folge bestimmt der Bedienrechner. `false` = Klasse nicht in der Liste.
   */
  zieheKlasseVor?(liste: string, klasse: ClassId): boolean
  /** Nur Übung am Tisch (Y4): die vorgezogene Klasse für den Vorschlag (wkr/tisch.ts naechsterOffener), bis zur nächsten Zeile. */
  readonly vorgezogen?: ShallowRef<ClassId | null>
  /**
   * Art des Geräts aus der Kopplung (GF7) – die Anordnung der Maske (wkr/anordnung.ts, W5.1, 22.11.2026, PD1) folgt
   * ihr vor der Fenstergröße. Fehlt (Übung): nur die Fenstergröße entscheidet.
   */
  readonly typ?: GeraeteTyp
  /** Verbunden mit dem Bedienrechner (Übung: immer). */
  readonly verbunden: ComputedRef<boolean>
  /**
   * Was die Maske über die Verbindung sagt (Feldtest 21.11.2026, Befund nach dem Neuladen, WKR_ANNAHMEN.verbindeKarenzSek):
   * `verbinde` – nach dem Öffnen noch nie verbunden und die Karenz läuft (neutral, keine Schätzung); `getrennt` – eine
   * bestehende Verbindung riss ab oder die Karenz ist um; `verbunden`. Übung: immer `verbunden`.
   */
  readonly verbindung: ComputedRef<VerbindungsAnzeige>
  /** Rechte entzogen: Entwürfe nur noch lesend (§5.6). */
  readonly entzogen: ComputedRef<boolean>
  /** Eigene Listen (Kennungen) mit Teil, wie die Aufgaben sie geben (F15: höchstens zwei). */
  readonly listen: ComputedRef<ListenAufgabe[]>
  /**
   * Listen, von denen sich das Gerät abgemeldet hat – ab dem Tipp, nicht erst ab der Quittung (Nutzer 21.11.2026,
   * WKR_ANNAHMEN.abmeldenWieEntfernen). Die Maske zeigt dann die Ruhe-Ansicht „abgemeldet“; ein Eintrag fällt erst, wenn
   * der Bedienrechner die Liste neu zuweist (nachdem er sie entfernt hatte). Übung: immer leer (T8).
   */
  readonly abgemeldet: ComputedRef<AbgemeldeteListe[]>
  /** Je eigener Liste die zuletzt empfangene Sicht (`null`: noch keine). */
  readonly sichten: Readonly<ShallowRef<Readonly<Record<string, ListenSicht | null>>>>
  /**
   * Je eigener Liste die Schlange: Sicht minus eigene Zeilen (außer abgelehnten); ohne Verbindung plus „danach“. Am
   * Steg je Teil (H3): Ein Teil-Gerät sieht die seines Teils; ein Gerät für den ganzen Steg jeden Start, solange EIN
   * Teil offen ist – die Schlange eines Teils gibt {@link schlangeTeil}.
   */
  readonly schlange: ComputedRef<Record<string, SchlangenEintrag[]>>
  /** Die Schlange eines Steg-Teils (Ablegen: Kopf; Anlegen: älteste ohne eigenes Anlegen und ohne `teile.an`). */
  schlangeTeil(liste: string, teil: ListenTeil): SchlangenEintrag[]
  /**
   * Je eigener Liste ohne Lauf (am Tisch, W5.3, KN3) der Bestand: alle Starter mit Startnummer, Klasse, erledigt (Sicht
   * oder eigene Zeile). Listen mit Lauf fehlen.
   */
  readonly bestand: ComputedRef<Record<string, BestandEintrag[]>>
  /** Stufe je eigener Zeile (`z`), über die letzten Zeilen und alles Unbestätigte. */
  readonly stufen: ComputedRef<Record<number, ZeilenStufe>>
  /** Die letzten Zeilen, neueste zuerst. */
  readonly zuletzt: ComputedRef<ZuletztZeile[]>
  /** Hinweise des Bedienrechners je Liste, ohne die schon als gesehen gemeldeten. */
  readonly hinweise: ComputedRef<Record<string, { id: number; code: WkrHinweis; startNr?: string }[]>>
  /** Eigene Abschlüsse (F7, F8), neueste zuerst. */
  readonly abschluesse: ComputedRef<EigenerAbschluss[]>
  /** Zeilen, die das Gerät noch nicht losgeworden ist (wartend oder ohne Quittung). */
  readonly wartend: ComputedRef<number>
  /**
   * Seit wann (Wanduhr, ms) die Verbindung fehlt bzw. Zeilen ohne Quittung warten; `null`: verbunden bzw. nichts
   * wartet. Im Kern statt in der Maske, damit ein Wechsel des Reiters (Freigabe ↔ Liste) die Zeit nicht neu beginnt
   * – sonst käme „Papierbogen ab Nr. …“ erst 5 min später (Prüfbefund W3, 21.11.2026).
   */
  readonly getrenntSeit: Readonly<ShallowRef<number | null>>
  readonly wartendSeit: Readonly<ShallowRef<number | null>>
  /** Eine Zeile in den Ausgang; liefert `z` oder `null` (keine eigene Liste, Teil passt nicht). */
  schicke(liste: string, zeile: MaskenZeile): number | null
  /**
   * Der eigene Stand des Starts dieser Zeile, wie das Gerät ihn zuletzt gesendet hat – am Steg für den Teil der Zeile
   * (Felder des Teils und die gemeinsamen, die DIESER Teil gesetzt hat). Grundlage einer Korrektur: Korrekturzeilen
   * tragen nur die geänderten Felder, ein Entwurf aus ihnen allein leerte die übrigen (Prüfbefund W3, 21.11.2026).
   */
  stand(z: number): Record<string, string> | null
  /** „Keine Zeit“ des Starts dieser Zeile, wie das Gerät es zuletzt gesendet hat (W5.4) – `{}` ohne. */
  keineZeit(z: number): Record<string, KeineZeitGrund>
  /**
   * Korrektur einer eigenen Zeile: `vorher` = zuletzt gesendeter Wert; nach dem Abschluss wird sie Vorschlag. `kz`
   * (W5.4): „keine Zeit“ der Korrektur – mitgeschickt, sobald es angegeben ist.
   */
  korrigiere(z: number, zellen: Readonly<Record<string, string>>, kz?: Readonly<Record<string, KeineZeitGrund>>): number | null
  /**
   * „So lassen“ an einer Rückfrage der eigenen Zeile `z` (Nutzer 21.11.2026, W3-35, WKR_ANNAHMEN GF5): meldet es dem
   * Bedienrechner (Action WKR_SO_LASSEN, nur die Zeilennummer) – entschieden wird dort. Übung: nichts.
   */
  soLassen(liste: string, z: number): number | null
  pausiere(liste: string): number | null
  meldeAb(liste: string): number | null
  weiter(liste: string): number | null
  /**
   * WKR-Name einer eigenen Liste (Nutzer 21.11.2026, W3-13, WN1): `name` = der auf dem Gerät geänderte, sonst der aus
   * der Einteilung (Sicht `wkrName`); `einteilung` = der aus der Sicht ('' ohne); `eigen` = auf dem Gerät geändert.
   * Reaktiv (Ausgang und Sicht). Übung: immer leer (G13 – kein Name aus der Übung).
   */
  wkrName(liste: string): WkrNameLage
  /**
   * Den WKR-Namen einer eigenen Liste auf diesem Gerät setzen (`Mehr → Name`, Abschluss ohne Einteilung). Gleich dem
   * der Einteilung oder leer = zurück zur Einteilung. Geht sofort im Lebenszeichen an den Host (WN2). `false`: keine
   * eigene Liste, zu lang, gestoppt, Übung.
   */
  setzeWkrName(liste: string, name: string): boolean
  /** „Liste abschließen“ (F7, F8): Prüfsummen über die eigenen Werte des Punkts; liefert die Kennung des Abschlusses. */
  schliesseAb(liste: string, punkt: WkrPunkt, name: string, restPapier: boolean): number | null
  /** Einen Hinweis als gelesen melden. */
  gesehen(hinweis: number): void
  /** Der Entwurf eines Starts (und Teils), `null`: keiner. Auch nach dem Entzug lesbar (auf Papier übertragen). */
  entwurf(liste: string, s: string, teil?: ListenTeil): Record<string, string> | null
  /** Entwurf ablegen (ersetzt den alten); leere Zellen allein = kein Entwurf. `false`: keine eigene Liste, gestoppt. */
  merkeEntwurf(liste: string, s: string, teil: ListenTeil | undefined, zellen: Readonly<Record<string, string>>): boolean
  verwirfEntwurf(liste: string, s: string, teil?: ListenTeil): void
  /** Alle Entwürfe (Leiste „Entw. n“), ältester zuerst. */
  readonly entwuerfe: ComputedRef<EntwurfEintrag[]>
  /**
   * „Rückgängig“ (G8): eine Zeile, die noch im Ausgang wartet, zurückholen – Werte als Entwurf zurück. `null`: schon
   * unterwegs, beantwortet oder eine neuere Zeile desselben Starts wartet (dann bietet die Oberfläche „Korrigieren“).
   */
  holeZurueck(z: number): MaskenZeile | null
  /** Prüfansicht für „Liste abschließen“ (F7): eigene Zeilen des Punkts (am Steg des Teils), offene Starts, X. */
  pruefung(liste: string, punkt: WkrPunkt, teil?: ListenTeil): Pruefung
  stop(): void
}

// ---------------------------------------------------------------------------
// Ausgang (gerätelokal)
// ---------------------------------------------------------------------------

type Grund = Ablehnung | 'verworfen'

/**
 * Ist der Punkt laut Sicht für diesen Teil abgeschlossen? Wie der Reducer (wkr/abschluss.ts): am Steg je Teil (F16);
 * eine ganze Zeile (`zeile`, ohne Teil) einer geteilten Liste schon, wenn EIN Teil abgeschlossen ist.
 */
function zuFuer(sicht: ListenSicht | null | undefined, punkt: WkrPunkt, teil: ListenTeil | undefined, zeile: boolean): boolean {
  if (!sicht) return false
  if (sicht.abgeschlossen.includes(punkt)) return true
  const teile = sicht.teile
  if (!teile) return false
  // Optional verkettet: Die Sicht kommt zwar vom Host, eine ältere Ablage könnte die Teile aber anders tragen.
  if (teil) return !!teile[teil]?.abgeschlossen?.includes(punkt)
  return zeile && (!!teile.ab?.abgeschlossen?.includes(punkt) || !!teile.an?.abgeschlossen?.includes(punkt))
}

interface AusZeile {
  z: number
  liste: string
  s: string
  /** Startnummer beim Abschicken (W3). */
  sn?: string
  t?: ListenTeil
  seite?: 'A' | 'B'
  k?: true
  klasse: string | null
  punkt: WkrPunkt | null
  c: [string, string, string][]
  /** „Nicht vorbeigekommen“ (W4.3): `c` ist leer. */
  n?: true
  /** „Keine Zeit“ (W5.4, ZT4): auf der Leitung GeraeteZeile.kz. */
  kz?: [string, KeineZeitGrund][]
  /** Nummer der Nachricht, in der sie ging (`null`: wartet). */
  nr: number | null
  /** Wird Vorschlag: Liste auf Papier bzw. Punkt (vom eigenen Abschluss) abgeschlossen. */
  vs?: 'papier' | 'abschluss'
  /** Hatte eine Rückfrage. */
  rf?: true
  ab?: Grund
  /** Bestätigt (bis ≥ nr oder direkte Quittung). */
  ok?: true
}

interface AusAbschluss {
  id: number
  liste: string
  punkt: WkrPunkt
  nr: number | null
  ok?: true
  ab?: Grund
}

type AusEintrag = { art: 'zeile'; z: number } | { art: 'nachricht'; id: number; liste?: string; nachricht: GeraeteNachricht }

interface Inhalt {
  naechsteZ: number
  aus: AusEintrag[]
  zeilen: AusZeile[]
  /**
   * Je Liste und Punkt ('' = ohne) je Start: Klasse, zuletzt gesendete Werte, seit W3 Startnummer und gesendete Teile
   * (`g` = ganze Zeile) für die Prüfansicht.
   */
  werte: Record<string, Record<string, Record<string, WerteEintrag>>>
  abschluesse: AusAbschluss[]
  sichten: Record<string, ListenSicht>
  gesehen: number[]
  /** Entwürfe (W3, H4) je Liste und `${s}|${teil}`. */
  entwuerfe: Record<string, Record<string, AbgelegterEntwurf>>
  /**
   * Abgemeldete Listen (Nutzer 21.11.2026): `weg` = der Bedienrechner hat die Liste inzwischen entfernt – kommt sie
   * danach wieder (neu zugewiesen), fällt der Eintrag. `id` = die Nachricht der Abmeldung im Ausgang, `nr` ihre Nummer
   * auf der Leitung: Eine Sicht der Liste mit `bis` ≥ `nr` kann nur mit dem NEUEN Schlüssel kommen (der Host rotiert
   * beim Abmelden im selben Schritt wie die Quittung) – also neu zugewiesen, auch wenn das Fehlen nie zu sehen war.
   */
  abgemeldet: Record<string, { titel: string; bereich: string; teil?: ListenTeil; weg?: true; id?: number; nr?: number }>
  /**
   * Auf dem Gerät geänderte WKR-Namen je Liste (W3-13, WN1) – nur Abweichungen von der Einteilung. `nameMelden`: eine
   * Änderung ist noch nicht im Lebenszeichen hinaus (WN2).
   */
  namen: Record<string, string>
  nameMelden?: true
}

interface AbgelegterEntwurf {
  sn?: string
  zellen: Record<string, string>
  papier?: EntwurfPapier
}

function istPapier(v: unknown): v is EntwurfPapier {
  return istObjekt(v) && istText(v.titel) && istText(v.bereich) && istObjekt(v.felder) && Object.values(v.felder).every(istText)
}

interface WerteEintrag {
  k: string | null
  /** Zuletzt gesendete Werte je Feld; gemeinsame Felder des Stegs vereinigt über beide Teile (wie am Bedienrechner). */
  w: Record<string, string>
  /**
   * Gemeinsame Felder des Stegs (Disq., Bemerkung) je Teil, wie DIESER Teil sie gesendet hat – `vorher` einer Zeile
   * eines Teils (Prüfbefund W3, 21.11.2026: Ein Gerät für den ganzen Steg schickte sonst beim leeren Anlegen als
   * `vorher` die Disq. des Ablegens mit, und der Bedienrechner löschte sie ohne Rückfrage).
   */
  wt?: Partial<Record<ListenTeil, Record<string, string>>>
  sn?: string
  t?: ('ab' | 'an' | 'g')[]
  /**
   * Zuletzt „nicht vorbeigekommen“ gemeldet (W4.3) – für welchen Teil (`g` = ganze Zeile). Eine spätere Zeile desselben
   * Teils ohne `n` (bzw. eine ganze Zeile) hebt es auf, wie am Bedienrechner (WKR_ANNAHMEN.nichtVorbeiAufheben).
   */
  n?: 'ab' | 'an' | 'g'
  /** „Keine Zeit“ (W5.4), wie zuletzt gesendet – Grundlage der Korrektur (ein Wert im Feld hebt es auf, wie am Host). */
  kz?: Record<string, KeineZeitGrund>
}

/** Ist `v` eine Liste „keine Zeit“ in der Form der Leitung (Feld + bekannter Grund)? */
const istKz = (v: unknown): v is [string, KeineZeitGrund][] =>
  Array.isArray(v) && v.every((k) => Array.isArray(k) && k.length === 2 && typeof k[0] === 'string' && istKeineZeitGrund(k[1]))
const gleicheKz = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>) =>
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((f) => a[f] === b[f])

/** Teile eines gemeinsamen Werts: Bemerkungen nach „; “, Disq. als Buchstaben. */
const teileDesWerts = (feld: string, wert: string) => (feld.startsWith('bemerkung@') ? wert.split(BEMERKUNG_TRENNER).filter((x) => x !== '') : disqCodes(wert))

/**
 * Ein gemeinsames Feld aus den Werten beider Teile – wie wkr/uebernahme.ts es am Bedienrechner vereinigt: was schon
 * stand und noch gilt, in seiner Folge, Neues hinten an.
 */
function vereinigeTeile(feld: string, bisher: string, wt: WerteEintrag['wt']): string {
  const alle = [...new Set((['ab', 'an'] as const).flatMap((t) => teileDesWerts(feld, wt?.[t]?.[feld] ?? '')))]
  const alt = teileDesWerts(feld, bisher).filter((x) => alle.includes(x))
  const out = [...new Set([...alt, ...alle])]
  return out.join(feld.startsWith('bemerkung@') ? BEMERKUNG_TRENNER : ', ')
}

/** Höchstens so viele Entwürfe je Liste – ein Gerät, das nie abschickt, füllt den Speicher nicht. */
const ENTWUERFE_MAX = 30

const entwurfSchluessel = (s: string, teil: ListenTeil | undefined) => `${s}|${teil ?? ''}`
const liesEntwurfSchluessel = (k: string): { s: string; teil?: ListenTeil } => {
  const i = k.lastIndexOf('|')
  const t = k.slice(i + 1)
  return t === 'ab' || t === 'an' ? { s: k.slice(0, i), teil: t } : { s: k.slice(0, i) }
}

/** Enthält ein Zellwert ein X „nicht gestartet“? (Großes X als eigener Eintrag; „2x6“ ist ein Faktor.) */
const hatX = (wert: string) => wert.split(/[\s,;/]+/).includes('X')

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const istText = (v: unknown): v is string => typeof v === 'string'
const istNr = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 1

function istAusZeile(v: unknown): v is AusZeile {
  if (!istObjekt(v) || !istNr(v.z) || !istText(v.liste) || !istText(v.s)) return false
  if (v.nr !== null && !istNr(v.nr)) return false
  if (v.punkt !== null && !istText(v.punkt)) return false
  if (v.klasse !== null && !istText(v.klasse)) return false
  if (v.n !== undefined && (v.n !== true || !Array.isArray(v.c) || v.c.length > 0)) return false
  if (v.kz !== undefined && !istKz(v.kz)) return false
  return Array.isArray(v.c) && v.c.every((c) => Array.isArray(c) && c.length === 3 && c.every(istText))
}

function istAusAbschluss(v: unknown): v is AusAbschluss {
  return istObjekt(v) && istNr(v.id) && istText(v.liste) && istText(v.punkt) && (v.nr === null || istNr(v.nr))
}

function istAusEintrag(v: unknown): v is AusEintrag {
  if (!istObjekt(v)) return false
  if (v.art === 'zeile') return istNr(v.z)
  return v.art === 'nachricht' && istNr(v.id) && istObjekt(v.nachricht) && istText(v.nachricht.art)
}

function istListenSicht(v: unknown, liste: string): v is ListenSicht {
  return istObjekt(v) && v.lv === LISTEN_SICHT_FASSUNG && v.liste === liste && Array.isArray(v.schlange) && Array.isArray(v.danach) &&
    istObjekt(v.geraete) && istObjekt(v.klassen) && Array.isArray(v.abgeschlossen)
}

function leer(uhr: () => number): Inhalt {
  return { naechsteZ: Math.max(1, Math.floor(uhr())), aus: [], zeilen: [], werte: {}, abschluesse: [], sichten: {}, gesehen: [], entwuerfe: {}, abgemeldet: {}, namen: {} }
}

/** Abgelegten Ausgang lesen – was nicht passt, fällt weg (Programmfehler, alte Fassung), nie das Ganze. */
function liesInhalt(roh: Record<string, unknown> | null, uhr: () => number): Inhalt {
  const out = leer(uhr)
  if (!roh) return out
  if (istNr(roh.naechsteZ)) out.naechsteZ = roh.naechsteZ
  if (Array.isArray(roh.zeilen)) out.zeilen = roh.zeilen.filter(istAusZeile)
  if (Array.isArray(roh.abschluesse)) out.abschluesse = roh.abschluesse.filter(istAusAbschluss)
  const zs = new Set(out.zeilen.map((z) => z.z))
  if (Array.isArray(roh.aus)) out.aus = roh.aus.filter(istAusEintrag).filter((a) => a.art !== 'zeile' || zs.has(a.z))
  if (istObjekt(roh.werte)) {
    for (const [liste, jePunkt] of Object.entries(roh.werte)) {
      if (!istObjekt(jePunkt)) continue
      for (const [punkt, jeStart] of Object.entries(jePunkt)) {
        if (!istObjekt(jeStart)) continue
        for (const [s, e] of Object.entries(jeStart)) {
          if (!istObjekt(e) || !istObjekt(e.w) || (e.k !== null && !istText(e.k))) continue
          const w: Record<string, string> = {}
          for (const [f, x] of Object.entries(e.w)) if (istText(x)) w[f] = x
          const eintrag: WerteEintrag = { k: e.k as string | null, w }
          if (istText(e.sn)) eintrag.sn = e.sn
          if (Array.isArray(e.t)) eintrag.t = e.t.filter((x): x is 'ab' | 'an' | 'g' => x === 'ab' || x === 'an' || x === 'g')
          if (e.n === 'ab' || e.n === 'an' || e.n === 'g') eintrag.n = e.n
          if (istObjekt(e.kz)) {
            const kz = Object.entries(e.kz).filter((x): x is [string, KeineZeitGrund] => istKeineZeitGrund(x[1]))
            if (kz.length > 0) eintrag.kz = Object.fromEntries(kz)
          }
          if (istObjekt(e.wt)) {
            for (const t of ['ab', 'an'] as const) {
              const jt = e.wt[t]
              if (!istObjekt(jt)) continue
              const werte: Record<string, string> = {}
              for (const [f, x] of Object.entries(jt)) if (istText(x)) werte[f] = x
              ;(eintrag.wt ??= {})[t] = werte
            }
          }
          ;((out.werte[liste] ??= {})[punkt] ??= {})[s] = eintrag
        }
      }
    }
  }
  if (istObjekt(roh.sichten)) for (const [liste, s] of Object.entries(roh.sichten)) if (istListenSicht(s, liste)) out.sichten[liste] = s
  if (Array.isArray(roh.gesehen)) out.gesehen = roh.gesehen.filter(istNr).slice(-50)
  if (istObjekt(roh.entwuerfe)) {
    for (const [liste, jeStart] of Object.entries(roh.entwuerfe)) {
      if (!istObjekt(jeStart)) continue
      for (const [k, e] of Object.entries(jeStart).slice(-ENTWUERFE_MAX)) {
        if (!istObjekt(e) || !istObjekt(e.zellen)) continue
        const zellen: Record<string, string> = {}
        for (const [f, x] of Object.entries(e.zellen)) if (istText(x)) zellen[f] = x
        ;(out.entwuerfe[liste] ??= {})[k] = { ...(istText(e.sn) ? { sn: e.sn } : {}), zellen, ...(istPapier(e.papier) ? { papier: e.papier } : {}) }
      }
    }
  }
  if (istObjekt(roh.abgemeldet)) {
    for (const [liste, a] of Object.entries(roh.abgemeldet)) {
      if (!istObjekt(a) || !istText(a.titel) || !istText(a.bereich)) continue
      out.abgemeldet[liste] = {
        titel: a.titel,
        bereich: a.bereich,
        ...(a.teil === 'ab' || a.teil === 'an' ? { teil: a.teil } : {}),
        ...(a.weg === true ? { weg: true as const } : {}),
        ...(Number.isSafeInteger(a.id) ? { id: a.id as number } : {}),
        ...(Number.isSafeInteger(a.nr) ? { nr: a.nr as number } : {}),
      }
    }
  }
  if (istObjekt(roh.namen)) {
    for (const [liste, n] of Object.entries(roh.namen)) {
      if (liste !== '__proto__' && istText(n) && n.trim() !== '' && n.length <= WKR_ANNAHMEN.nameMax) out.namen[liste] = n.trim()
    }
  }
  if (roh.nameMelden === true) out.nameMelden = true
  // Der Zähler steht immer über allem Abgelegten.
  for (const z of [...out.zeilen.map((x) => x.z), ...out.abschluesse.map((x) => x.id), ...out.aus.map((a) => (a.art === 'zeile' ? a.z : a.id))]) {
    if (z >= out.naechsteZ) out.naechsteZ = z + 1
  }
  return out
}

function vorgabeAblage(): Ablage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Kern
// ---------------------------------------------------------------------------

/**
 * Die WKR-Erfassung eines gekoppelten Geräts öffnen: liest den Ausgang, hört auf die Sicht seiner Listen und schickt,
 * was wartet. Das Gerät muss gestartet werden ({@link GekoppeltesGeraet.start}); `stop()` hier beendet nur die
 * Erfassung (Ausgang bleibt abgelegt).
 */
export function oeffneErfassung(geraet: GekoppeltesGeraet, umgebung: ErfassenUmgebung = {}): Erfassung {
  const ablage = umgebung.ablage === undefined ? vorgabeAblage() : umgebung.ablage
  const uhr = umgebung.uhr ?? Date.now
  const p = geraet.koppelPaket
  const bezug: RaumBezug = { u: p.u, r: p.r, s: p.s }
  const speicher = geraetWkrAblage(bezug, ablage, uhr)
  const kanal = geraet.kanal
  let inhalt = liesInhalt(speicher.lies(), uhr)
  /** Zählt bei jeder Änderung des Ausgangs hoch – die abgeleiteten Werte hängen daran. */
  const rev = ref(0)
  const sichten = shallowRef<Readonly<Record<string, ListenSicht | null>>>({})
  let gestoppt = false

  const speichere = () => {
    rev.value++
    // Raum verlassen oder entkoppelt (ablage.ts verlasseRaum): nichts mehr ablegen – sonst stünden die eben gelöschten
    // Werte wieder auf dem Gerät.
    const k = liesKopplung(ablage)
    if (gestoppt || !k || k.u !== bezug.u || k.r !== bezug.r || k.s !== bezug.s) return
    speicher.schreibe(inhalt)
  }

  const scope = effectScope(true)
  const listen = scope.run(() => computed(() => listenAufgaben(geraet.aufgaben.value)))!
  const aufgabeVon = (liste: string) => listen.value.find((a) => a.liste === liste)

  const setzeSichten = () => {
    const out: Record<string, ListenSicht | null> = {}
    for (const a of listen.value) out[a.liste] = inhalt.sichten[a.liste] ?? null
    sichten.value = out
  }

  const meinBlatt = (liste: string) => {
    const id = kanal.id()
    return id ? (inhalt.sichten[liste]?.geraete[id] ?? null) : null
  }

  function stufeVon(z: AusZeile): ZeilenStufe {
    if (z.ab) return { stufe: 'abgelehnt', grund: z.ab }
    if (z.nr === null) return { stufe: 'unterwegs', gesendet: false }
    if (!z.ok) return { stufe: 'unterwegs', gesendet: true }
    const blatt = meinBlatt(z.liste)
    const rf = blatt?.rueckfragen.filter((r) => r.z === String(z.z)) ?? []
    if (rf.length) return { stufe: 'rueckfrage', zellen: rf.map((r) => ({ feld: r.feld, lauf: r.lauf, steht: r.steht })) }
    const sicht = inhalt.sichten[z.liste]
    if (z.vs === 'papier' || (z.vs === 'abschluss' && z.punkt !== null && zuFuer(sicht, z.punkt, z.t, true))) return { stufe: 'vorschlag' }
    return z.rf ? { stufe: 'uebernommen', nachRueckfrage: true } : { stufe: 'uebernommen' }
  }

  // --- Ausgang pflegen ---------------------------------------------------------------------------

  /** Was die Sicht einer Liste über eigene Zeilen sagt, in den Ausgang übernehmen (überlebt die 20 der Sicht). */
  function vermerkeAusSicht(liste: string): boolean {
    const blatt = meinBlatt(liste)
    if (!blatt) return false
    let geaendert = false
    for (const z of inhalt.zeilen) {
      if (z.liste !== liste || z.nr === null) continue
      if (!z.ok && blatt.bis >= z.nr) {
        z.ok = true
        geaendert = true
      }
      if (!z.rf && blatt.rueckfragen.some((r) => r.z === String(z.z))) {
        z.rf = true
        geaendert = true
      }
      const ab = blatt.abgelehnt.find((a) => a.z === String(z.z))
      if (ab && !z.ab) {
        z.ab = istAblehnung(ab.grund) ? ab.grund : 'wert-ungueltig'
        geaendert = true
      }
    }
    for (const a of inhalt.abschluesse) {
      if (a.liste === liste && a.nr !== null && !a.ok && blatt.bis >= a.nr) {
        a.ok = true
        geaendert = true
      }
    }
    return geaendert
  }

  /** Nur die letzten Zeilen behalten – Unbestätigte und Wartende immer; Werte nur noch für Punkte, die vorkommen. */
  function raeumeAuf(): void {
    const behalten = new Set<number>()
    const fertig = inhalt.zeilen.filter((z) => z.ok || z.ab)
    for (const z of fertig.slice(-WKR_ANNAHMEN.zuletzt)) behalten.add(z.z)
    for (const z of inhalt.zeilen) if (!z.ok && !z.ab) behalten.add(z.z)
    inhalt.zeilen = inhalt.zeilen.filter((z) => behalten.has(z.z))
    inhalt.abschluesse = inhalt.abschluesse.slice(-10)
    for (const liste of Object.keys(inhalt.werte)) {
      const punkte = new Set<string>([
        inhalt.sichten[liste]?.punkt?.id ?? '',
        ...inhalt.zeilen.filter((z) => z.liste === liste).map((z) => z.punkt ?? ''),
        ...inhalt.abschluesse.filter((a) => a.liste === liste && !a.ok && !a.ab).map((a) => a.punkt),
      ])
      for (const punkt of Object.keys(inhalt.werte[liste])) if (!punkte.has(punkt)) delete inhalt.werte[liste][punkt]
      if (Object.keys(inhalt.werte[liste]).length === 0) delete inhalt.werte[liste]
    }
  }

  /**
   * Das Nächste senden – nur wenn der Transport nichts Unbestätigtes hat und verbunden ist. Zeilen bündeln: alle
   * wartenden Zeilen der Liste der ersten (≤ Bündel), bis zur nächsten anderen Nachricht (Reihenfolge Zeile →
   * Abschluss bleibt).
   */
  function pumpe(): void {
    if (gestoppt || inhalt.aus.length === 0) return
    if (geraet.lage.value !== 'gekoppelt' || geraet.status.value !== 'verbunden') return
    if (kanal.unbestaetigt().length > 0) return
    const erstes = inhalt.aus[0]
    if (erstes.art === 'nachricht') {
      const nr = kanal.schicke(erstes.nachricht)
      if (nr === null) return
      inhalt.aus.shift()
      const a = inhalt.abschluesse.find((x) => x.id === erstes.id)
      if (a) a.nr = nr
      for (const x of Object.values(inhalt.abgemeldet)) if (x.id === erstes.id) x.nr = nr
      speichere()
      return
    }
    const zeileVon = new Map(inhalt.zeilen.map((z) => [z.z, z]))
    const liste = zeileVon.get(erstes.z)?.liste
    const buendel: AusZeile[] = []
    for (const a of inhalt.aus) {
      if (a.art !== 'zeile') break
      const z = zeileVon.get(a.z)
      if (!z || z.liste !== liste) continue
      buendel.push(z)
      if (buendel.length >= WKR_ANNAHMEN.buendel) break
    }
    if (!liste || buendel.length === 0) {
      inhalt.aus.shift()
      speichere()
      return pumpe()
    }
    const zeilen = buendel.map((z) => ({
      z: z.z,
      s: z.s,
      ...(z.t ? { t: z.t } : {}),
      ...(z.k ? { k: true as const } : {}),
      ...(z.seite ? { seite: z.seite } : {}),
      c: z.c.map((c) => [...c]),
      ...(z.n ? { n: true as const } : {}),
      ...(z.kz ? { kz: z.kz.map((k) => [...k]) } : {}),
    }))
    const nr = kanal.schicke({ art: 'action', action: { type: 'WKR_ZEILEN', liste, zeilen } })
    if (nr === null) return
    const weg = new Set(buendel.map((z) => z.z))
    inhalt.aus = inhalt.aus.filter((a) => a.art !== 'zeile' || !weg.has(a.z))
    for (const z of buendel) z.nr = nr
    speichere()
  }

  function nimmSicht(gruppe: string, sicht: unknown): void {
    const a = listen.value.find((x) => gruppeDerListe(x.liste) === gruppe)
    if (!a || !istListenSicht(sicht, a.liste)) return
    inhalt.sichten[a.liste] = sicht
    vermerkeAusSicht(a.liste)
    // Hat der Bedienrechner den Namen des Geräts in die Veranstaltung übernommen (W3-13), ist die Änderung erledigt:
    // Spätere Änderungen der Einteilung kommen dann wieder auf dem Gerät an. Der Host erfährt es im Lebenszeichen.
    if (inhalt.namen[a.liste] !== undefined && inhalt.namen[a.liste] === sicht.wkrName) {
      delete inhalt.namen[a.liste]
      inhalt.nameMelden = true
    }
    // Neu zugewiesen nach dem Abmelden (Prüfbefund 21.11.2026): Die Sicht hat die Abmeldung schon verarbeitet (`bis`)
    // und ist trotzdem lesbar – das geht nur mit dem neuen Schlüssel. Hängt nicht daran, dass das Gerät die Liste
    // erst fehlen sah (Gerät schlief oder lud neu, Entzug und Zuweisung im selben Takt).
    const ab = inhalt.abgemeldet[a.liste]
    const bisJetzt = meinBlatt(a.liste)?.bis
    if (ab?.nr !== undefined && bisJetzt !== undefined && bisJetzt >= ab.nr) delete inhalt.abgemeldet[a.liste]
    // Gesehene Hinweise, die der Host schon entfernt hat, vergessen.
    const offen = new Set(Object.values(inhalt.sichten).flatMap((s) => Object.values(s.geraete).flatMap((g) => g.hinweise.map((h) => h.id))))
    inhalt.gesehen = inhalt.gesehen.filter((id) => offen.has(id))
    raeumeAuf()
    speichere()
    setzeSichten()
    const bis = meinBlatt(a.liste)?.bis
    if (bis !== undefined) kanal.bestaetige(bis)
    pumpe()
  }

  function nimmQuittung(nr: number, ergebnis: string, grund: Ablehnung | undefined): void {
    let geaendert = false
    for (const z of inhalt.zeilen) {
      if (z.nr !== nr) continue
      if (ergebnis === 'abgelehnt') z.ab ??= grund ?? 'nicht-erlaubt'
      else z.ok = true
      geaendert = true
    }
    for (const a of inhalt.abschluesse) {
      if (a.nr !== nr) continue
      if (ergebnis === 'abgelehnt') a.ab ??= grund ?? 'nicht-erlaubt'
      else a.ok = true
      geaendert = true
    }
    if (geaendert) speichere()
  }

  function verwirf(nr: number): void {
    for (const z of inhalt.zeilen) if (z.nr === nr && !z.ok) z.ab ??= 'verworfen'
    for (const a of inhalt.abschluesse) if (a.nr === nr && !a.ok) a.ab ??= 'verworfen'
    speichere()
  }

  const ab = kanal.empfange((e: Empfang) => {
    if (gestoppt) return
    if (e.art === 'sicht' && e.gruppe.startsWith('l')) return nimmSicht(e.gruppe, e.sicht)
    if (e.art === 'verworfen') verwirf(e.nr)
    if (e.art === 'direkt' && e.nachricht.art === 'quittung') nimmQuittung(e.nachricht.auf, e.nachricht.ergebnis, e.nachricht.grund)
    // Die Antwort hat die Schlange des Transports geleert (er nimmt sie vor dem Ausliefern heraus): weiter.
    if (e.art === 'direkt' || e.art === 'verworfen') pumpe()
  })

  /**
   * Abgemeldete Listen nachführen (Nutzer 21.11.2026): Nimmt der Bedienrechner die Liste weg, ist der Eintrag `weg`;
   * kommt sie danach wieder (neu zugewiesen), ist das Gerät wieder dabei. Solange die Liste nie weg war (Host noch
   * nicht erreicht, älterer Bedienrechner), bleibt die Ruhe-Ansicht.
   */
  function pflegeAbgemeldet(da: ReadonlySet<string>): void {
    let geaendert = false
    for (const [liste, a] of Object.entries(inhalt.abgemeldet)) {
      if (!da.has(liste) && !a.weg) {
        a.weg = true
        geaendert = true
      } else if (da.has(liste) && a.weg) {
        delete inhalt.abgemeldet[liste]
        geaendert = true
      }
    }
    if (geaendert) speichere()
  }

  /** Listen weg (entzogen, Rechte geändert): ihre wartenden Zeilen gehen nie mehr; Unbestätigtes gilt als abgelehnt. */
  function ohneListen(behalten: ReadonlySet<string>): void {
    let geaendert = false
    for (const z of inhalt.zeilen) {
      if (behalten.has(z.liste) || z.ok || z.ab) continue
      // Schon unterwegs: Der Host beantwortet sie noch (direkt, wenn die Gruppe weg ist).
      if (z.nr !== null) continue
      z.ab = 'nicht-erlaubt'
      geaendert = true
    }
    const vorher = inhalt.aus.length
    inhalt.aus = inhalt.aus.filter((a) => {
      if (a.art === 'nachricht') return a.liste === undefined || behalten.has(a.liste)
      const z = inhalt.zeilen.find((x) => x.z === a.z)
      return !!z && behalten.has(z.liste)
    })
    for (const liste of Object.keys(inhalt.sichten)) {
      if (behalten.has(liste)) continue
      delete inhalt.sichten[liste]
      geaendert = true
    }
    if (geaendert || inhalt.aus.length !== vorher) speichere()
    setzeSichten()
  }

  scope.run(() => {
    watch(
      listen,
      (l) => {
        const da = new Set(l.map((a) => a.liste))
        pflegeAbgemeldet(da)
        ohneListen(da)
      },
      { immediate: true },
    )
    watch(geraet.status, (s) => {
      if (s === 'verbunden') pumpe()
    })
    watch(geraet.lage, (l) => {
      if (l === 'gekoppelt') pumpe()
      if (l === 'entzogen') ohneListen(new Set())
    })
  })

  // --- Lebenszeichen -------------------------------------------------------------------------------

  const wartendJetzt = () => inhalt.zeilen.filter((z) => !z.ok && !z.ab).length
  /** Geänderte Namen der eigenen Listen (WN2) – nur diese gehen hinaus. */
  const eigeneNamen = () => Object.fromEntries(Object.entries(inhalt.namen).filter(([liste]) => !!aufgabeVon(liste)))
  /**
   * Ein Lebenszeichen schicken, wenn fällig: nach Stille mit laufendem Punkt (W1) – oder sofort, wenn ein geänderter
   * WKR-Name noch nicht hinaus ist (WN2, auch ohne laufenden Punkt). Nur gekoppelt, verbunden, ohne Ausstehendes.
   */
  function lebenszeichen(): void {
    if (gestoppt || geraet.lage.value !== 'gekoppelt' || geraet.status.value !== 'verbunden') return
    if (kanal.unbestaetigt().length > 0 || inhalt.aus.length > 0) return
    if (!inhalt.nameMelden) {
      if (!listen.value.some((a) => inhalt.sichten[a.liste]?.punkt)) return
      if (uhr() - kanal.zuletztGesendet() < WKR_ANNAHMEN.lebenszeichenSek * 1000) return
    }
    const akku = umgebung.akku?.()
    const n: GeraeteNachricht = {
      art: 'lebenszeichen',
      wartend: wartendJetzt(),
      ...(akku !== undefined && Number.isInteger(akku) && akku >= 0 && akku <= 100 ? { akku } : {}),
      namen: eigeneNamen(),
    }
    if (kanal.schicke(n) !== null && inhalt.nameMelden) {
      delete inhalt.nameMelden
      speichere()
    }
  }
  const takt = setInterval(lebenszeichen, umgebung.taktMs ?? 5000)

  // --- Abgeleitet ----------------------------------------------------------------------------------

  const stufen = scope.run(() =>
    computed(() => {
      void rev.value
      void sichten.value
      const out: Record<number, ZeilenStufe> = {}
      for (const z of inhalt.zeilen) out[z.z] = stufeVon(z)
      return out
    }),
  )!

  // --- Verbindung, wie die Maske sie zeigt (Feldtest 21.11.2026: nach dem Neuladen sofort „Keine Verbindung“) ---
  const verbunden = scope.run(() => computed(() => geraet.status.value === 'verbunden'))!
  /** Schon einmal verbunden, seit diese Erfassung offen ist – ein Abriss danach ist sofort „getrennt“. */
  const warVerbunden = ref(verbunden.value)
  /** Die Karenz nach dem Öffnen ist um: Wer bis dahin keine Verbindung bekam, ist „getrennt“. */
  const karenzUm = ref(false)
  const karenz = setTimeout(() => (karenzUm.value = true), WKR_ANNAHMEN.verbindeKarenzSek * 1000)
  scope.run(() => watch(verbunden, (v) => v && (warVerbunden.value = true)))
  const verbindung = scope.run(() =>
    computed<VerbindungsAnzeige>(() => (verbunden.value ? 'verbunden' : warVerbunden.value || karenzUm.value ? 'getrennt' : 'verbinde')),
  )!

  /**
   * Die Schlangen einer Liste: `ganz` (ungeteilte Liste bzw. Gerät für den ganzen Steg: solange EIN Teil offen ist)
   * und je Teil (H3). Eigene Zeilen zählen nach Start UND Teil – eine ganze Zeile (ohne Teil) für beide Teile; vor W3
   * nahm ein Ablegen den Start auch aus dem Anlegen.
   */
  const schlangen = scope.run(() =>
    computed(() => {
      void rev.value
      // Geschätzt erst, wenn die Maske „getrennt“ sagt – beim Verbindungsaufbau nach dem Neuladen nicht (Befund 21.11.2026).
      const verbunden = verbindung.value !== 'getrennt'
      const out: Record<string, Record<'ganz' | ListenTeil, SchlangenEintrag[]>> = {}
      for (const a of listen.value) {
        const sicht = sichten.value[a.liste]
        // Abgemeldet (Nutzer 21.11.2026): nichts mehr zu tippen, auch wenn die Sicht noch kommt.
        if (!sicht || inhalt.abgemeldet[a.liste]) {
          out[a.liste] = { ganz: [], ab: [], an: [] }
          continue
        }
        const geteilt = !!sicht.teile
        const eigen = new Map<string, Set<'ab' | 'an' | 'g'>>()
        for (const z of inhalt.zeilen) {
          if (z.liste !== a.liste || stufeVon(z).stufe === 'abgelehnt') continue
          const t = eigen.get(z.s) ?? new Set()
          t.add(z.t ?? 'g')
          eigen.set(z.s, t)
        }
        const teilOffen = (s: ListenStart, teil: ListenTeil) => {
          const e = eigen.get(s.key)
          return !(e?.has('g') || e?.has(teil)) && !s.teile?.[teil]
        }
        // Ein Gerät für den ganzen Steg (WKR_ANNAHMEN.stegGanzAblegenZuerst, T3): Ein Start, dessen Ablegen noch offen in
        // der Schlange steht, wartet mit dem Anlegen – nie derselbe Starter in beiden Teilen.
        const ablegenOffen = new Set(geteilt && !a.teil && WKR_ANNAHMEN.stegGanzAblegenZuerst ? sicht.schlange.filter((s) => teilOffen(s, 'ab')).map((s) => s.key) : [])
        const passtFuer = (teil: 'ganz' | ListenTeil) => (s: ListenStart): boolean => {
          if (teil === 'an' && ablegenOffen.has(s.key)) return false
          if (teil !== 'ganz') return geteilt ? teilOffen(s, teil) : !eigen.has(s.key)
          if (!geteilt) return !eigen.has(s.key)
          if (a.teil) return teilOffen(s, a.teil)
          return teilOffen(s, 'ab') || teilOffen(s, 'an')
        }
        const baue = (teil: 'ganz' | ListenTeil) => {
          const passt = passtFuer(teil)
          const liste: SchlangenEintrag[] = sicht.schlange.filter(passt).map((s) => ({ ...s }))
          if (!verbunden) {
            const schon = new Set(sicht.schlange.map((s) => s.key))
            for (const s of sicht.danach) if (!schon.has(s.key) && passt(s)) liste.push({ ...s, geschaetzt: true })
          }
          return liste
        }
        out[a.liste] = { ganz: baue('ganz'), ab: geteilt ? baue('ab') : [], an: geteilt ? baue('an') : [] }
      }
      return out
    }),
  )!

  const schlange = scope.run(() =>
    computed(() => {
      const out: Record<string, SchlangenEintrag[]> = {}
      for (const [liste, je] of Object.entries(schlangen.value)) out[liste] = je.ganz
      return out
    }),
  )!

  /** Bestand je Liste ohne Lauf (W5.3): Sicht plus eigene, nicht abgelehnte Zeilen als erledigt. */
  const bestand = scope.run(() =>
    computed(() => {
      void rev.value
      const out: Record<string, BestandEintrag[]> = {}
      for (const a of listen.value) {
        const b = sichten.value[a.liste]?.bestand
        if (!b) continue
        const eigen = new Map<string, number>()
        for (const z of inhalt.zeilen) if (z.liste === a.liste && stufeVon(z).stufe !== 'abgelehnt') eigen.set(z.s, z.z)
        out[a.liste] = b.map((x) => {
          const z = eigen.get(x.key)
          return { ...x, erledigt: x.erledigt || z !== undefined, ...(z !== undefined ? { z } : {}) }
        })
      }
      return out
    }),
  )!

  const zuletzt = scope.run(() =>
    computed(() => {
      void rev.value
      void sichten.value
      return inhalt.zeilen
        .slice()
        .reverse()
        .map((z): ZuletztZeile => ({
          z: z.z,
          liste: z.liste,
          s: z.s,
          ...(z.sn !== undefined ? { sn: z.sn } : {}),
          ...(z.t ? { teil: z.t } : {}),
          punkt: z.punkt,
          korrektur: !!z.k,
          zellen: Object.fromEntries(z.c.map(([f, w]) => [f, w])),
          stufe: stufeVon(z),
          ...(z.n ? { nv: true as const } : {}),
          ...(z.kz && z.kz.length > 0 ? { kz: Object.fromEntries(z.kz) } : {}),
        }))
    }),
  )!

  const hinweise = scope.run(() =>
    computed(() => {
      void rev.value
      const out: Record<string, { id: number; code: WkrHinweis; startNr?: string }[]> = {}
      const gesehen = new Set(inhalt.gesehen)
      for (const a of listen.value) out[a.liste] = (meinBlattAus(sichten.value[a.liste])?.hinweise ?? []).filter((h) => !gesehen.has(h.id)).map((h) => ({ ...h }))
      return out
    }),
  )!
  function meinBlattAus(sicht: ListenSicht | null | undefined) {
    const id = kanal.id()
    return id && sicht ? (sicht.geraete[id] ?? null) : null
  }

  const abschluesse = scope.run(() =>
    computed(() => {
      void rev.value
      void sichten.value
      return inhalt.abschluesse
        .slice()
        .reverse()
        .map((a): EigenerAbschluss => {
          const basis = { id: a.id, liste: a.liste, punkt: a.punkt }
          if (a.ab) return { ...basis, stufe: 'abgelehnt', grund: a.ab }
          if (!a.ok) return { ...basis, stufe: 'unterwegs' }
          // Still quittiert und doch nicht abgeschlossen: Der Host hat ihn wegen offener Starts nicht angenommen.
          // Am Steg zählt nur der eigene Teil (F16): Der Abschluss des anderen Teils ist nicht meiner.
          return zuFuer(inhalt.sichten[a.liste], a.punkt, aufgabeVon(a.liste)?.teil, false) ? { ...basis, stufe: 'angenommen' } : { ...basis, stufe: 'abgelehnt', grund: 'offen' }
        })
    }),
  )!

  const wartend = scope.run(() =>
    computed(() => {
      void rev.value
      return wartendJetzt()
    }),
  )!

  // --- Eingaben der Maske --------------------------------------------------------------------------

  const neueId = () => inhalt.naechsteZ++

  /** Wird eine Zeile für diesen Punkt Vorschlag? (Papier; Punkt abgeschlossen oder eigener Abschluss unterwegs.) */
  function vorschlagWeil(liste: string, punkt: WkrPunkt | null, teil: ListenTeil | undefined): AusZeile['vs'] {
    const sicht = inhalt.sichten[liste]
    if (sicht?.modus === 'papier') return 'papier'
    if (punkt === null) return undefined
    if (zuFuer(sicht, punkt, teil, true)) return 'abschluss'
    return inhalt.abschluesse.some((a) => a.liste === liste && a.punkt === punkt && !a.ab) ? 'abschluss' : undefined
  }

  const werteVon = (liste: string, punkt: WkrPunkt | null, s: string) => inhalt.werte[liste]?.[punkt ?? '']?.[s]

  /**
   * Zu welchem Teil ein Feld gehört – an der Sicht (MaskenFeld.teil): `gemeinsam` (geteilte Liste, Feld ohne Teil),
   * der Teil, oder `null` (ungeteilte Liste, unbekannt).
   */
  function feldTeil(liste: string, klasse: string | null, f: string): ListenTeil | 'gemeinsam' | null {
    const sicht = inhalt.sichten[liste]
    if (!sicht?.teile) return null
    const klassen = klasse !== null ? [sicht.klassen[klasse as ClassId]] : Object.values(sicht.klassen)
    for (const k of klassen) {
      const feld = k?.felder?.find((x) => x.kennung === f)
      if (feld) return feld.teil ?? 'gemeinsam'
    }
    return null
  }

  /** Was das Gerät für dieses Feld zuletzt gesendet hat – am Steg für gemeinsame Felder nur aus Zeilen DIESES Teils. */
  function vorherVon(e: WerteEintrag | undefined, liste: string, t: ListenTeil | undefined, f: string): string {
    if (!e) return ''
    if (t && feldTeil(liste, e.k, f) === 'gemeinsam') return e.wt?.[t]?.[f] ?? ''
    return e.w[f] ?? ''
  }

  /** Der eigene Stand eines Starts (am Steg: des Teils – ohne Felder des anderen Teils, gemeinsame nur die eigenen). */
  function standVon(e: WerteEintrag, liste: string, t: ListenTeil | undefined): Record<string, string> {
    if (!t) return { ...e.w }
    const out: Record<string, string> = {}
    for (const [f, w] of Object.entries(e.w)) {
      const ft = feldTeil(liste, e.k, f)
      if (ft === null || ft === t) out[f] = w
    }
    for (const [f, w] of Object.entries(e.wt?.[t] ?? {})) if (w !== '') out[f] = w
    return out
  }

  /** Einen Wert ablegen; gemeinsame Felder einer Teil-Zeile je Teil und vereinigt in `w`. */
  function setzeWert(e: WerteEintrag, liste: string, t: ListenTeil | undefined, f: string, w: string): void {
    if (t && feldTeil(liste, e.k, f) === 'gemeinsam') {
      const jt = ((e.wt ??= {})[t] ??= {})
      if (w === '') delete jt[f]
      else jt[f] = w
      const v = vereinigeTeile(f, e.w[f] ?? '', e.wt)
      if (v === '') delete e.w[f]
      else e.w[f] = v
      return
    }
    if (w === '') delete e.w[f]
    else e.w[f] = w
  }

  function merkeWerte(z: AusZeile): void {
    const jeStart = ((inhalt.werte[z.liste] ??= {})[z.punkt ?? ''] ??= {})
    const e = (jeStart[z.s] ??= { k: z.klasse, w: {} })
    if (z.klasse !== null) e.k = z.klasse
    if (z.sn !== undefined) e.sn = z.sn
    const t = z.t ?? 'g'
    if (!e.t?.includes(t)) e.t = [...(e.t ?? []), t]
    for (const [f, w] of z.c) setzeWert(e, z.liste, z.t, f, w)
    // „Nicht vorbeigekommen“ (W4.3): merken bzw. von einer Zeile desselben Teils (oder einer ganzen) aufheben.
    if (z.n) e.n = t
    else if (e.n !== undefined && (t === 'g' || t === e.n)) delete e.n
    // „Keine Zeit“ (W5.4): eine Zeile mit `kz` ersetzt es, ein Wert im Feld hebt es auf – wie am Bedienrechner.
    if (z.kz) e.kz = Object.fromEntries(z.kz)
    if (e.kz) {
      for (const [f, w] of z.c) if (w !== '') delete e.kz[f]
      if (Object.keys(e.kz).length === 0) delete e.kz
    }
  }

  /** Entwürfe sind Zellwerte; ein Entwurf ohne einen einzigen Wert ist keiner. */
  const entwurfLeer = (zellen: Readonly<Record<string, string>>) => Object.values(zellen).every((w) => w === '')

  function stelleAn(z: AusZeile): number {
    inhalt.zeilen.push(z)
    merkeWerte(z)
    inhalt.aus.push({ art: 'zeile', z: z.z })
    raeumeAuf()
    speichere()
    pumpe()
    return z.z
  }

  function nachricht(liste: string | undefined, n: GeraeteNachricht, vorgabeId?: number): number {
    const id = vorgabeId ?? neueId()
    inhalt.aus.push({ art: 'nachricht', id, ...(liste !== undefined ? { liste } : {}), nachricht: n })
    return id
  }

  function status(liste: string, s: 'aktiv' | 'pausiert' | 'abgemeldet', vorgabeId?: number): number | null {
    if (gestoppt || !aufgabeVon(liste)) return null
    const id = nachricht(liste, { art: 'action', action: { type: 'WKR_STATUS', liste, status: s } }, vorgabeId)
    speichere()
    pumpe()
    return id
  }

  const entwuerfe = scope.run(() =>
    computed(() => {
      void rev.value
      const out: EntwurfEintrag[] = []
      for (const [liste, jeStart] of Object.entries(inhalt.entwuerfe)) {
        for (const [k, e] of Object.entries(jeStart)) {
          out.push({ liste, ...liesEntwurfSchluessel(k), ...(e.sn !== undefined ? { sn: e.sn } : {}), zellen: { ...e.zellen }, ...(e.papier ? { papier: { ...e.papier, felder: { ...e.papier.felder } } } : {}) })
        }
      }
      return out
    }),
  )!

  const entzogen = scope.run(() => computed(() => geraet.lage.value === 'entzogen'))!
  const abgemeldet = scope.run(() =>
    computed(() => {
      void rev.value
      return Object.entries(inhalt.abgemeldet).map(([liste, a]): AbgemeldeteListe => ({ liste, titel: a.titel, bereich: a.bereich, ...(a.teil ? { teil: a.teil } : {}) }))
    }),
  )!
  // Wanduhr wie in der Maske (jetzt = Date.now()), nicht `uhr` – die Maske vergleicht damit ihre Sekunde.
  const getrenntSeit = shallowRef<number | null>(verbunden.value ? null : Date.now())
  const wartendSeit = shallowRef<number | null>(wartend.value > 0 ? Date.now() : null)
  scope.run(() => {
    watch(verbunden, (v) => (getrenntSeit.value = v ? null : (getrenntSeit.value ?? Date.now())))
    watch(
      () => wartend.value > 0,
      (ja) => (wartendSeit.value = ja ? (wartendSeit.value ?? Date.now()) : null),
    )
  })

  /** Angaben fürs Papier zu einem Entwurf, aus der Sicht der Liste (Felder der Klasse des Starts, nur die belegten). */
  function papierVon(liste: string, s: string, zellen: Readonly<Record<string, string>>, klasse: string | null): EntwurfPapier | undefined {
    const sicht = inhalt.sichten[liste]
    if (!sicht) return undefined
    const k = [...sicht.schlange, ...sicht.danach].find((x) => x.key === s)?.klasse ?? klasse
    const felder: Record<string, string> = {}
    for (const f of (k ? sicht.klassen[k as ClassId]?.felder : null) ?? []) if (f.kennung in zellen) felder[f.kennung] = f.label.replace(/:\s*$/, '')
    return { titel: sicht.titel, bereich: sicht.bereich, felder }
  }

  /** Startnummer eines Starts aus der Sicht (Schlange, danach oder – am Tisch – Bestand). */
  const startNrVon = (liste: string, s: string) => {
    const sicht = inhalt.sichten[liste]
    return sicht ? [...sicht.schlange, ...sicht.danach, ...(sicht.bestand ?? [])].find((x) => x.key === s)?.startNr : undefined
  }

  return {
    uebung: false,
    typ: geraet.typ,
    verbunden,
    verbindung,
    entzogen,
    listen,
    abgemeldet,
    sichten,
    schlange,
    schlangeTeil: (liste, teil) => schlangen.value[liste]?.[teil] ?? [],
    bestand,
    stufen,
    zuletzt,
    hinweise,
    abschluesse,
    wartend,
    getrenntSeit,
    wartendSeit,
    schicke(liste, zeile) {
      const aufgabe = aufgabeVon(liste)
      if (gestoppt || !aufgabe || typeof zeile.s !== 'string' || zeile.s === '') return null
      // Abgemeldet: Ab jetzt gilt der Papierbogen (Nutzer 21.11.2026) – keine Zeilen mehr von hier.
      if (inhalt.abgemeldet[liste]) return null
      if (aufgabe.teil && zeile.teil && zeile.teil !== aufgabe.teil) return null
      const teil = aufgabe.teil ?? zeile.teil
      const sicht = inhalt.sichten[liste]
      // Am Tisch (W5.3) steht der Starter im Bestand, nicht in der Schlange.
      const start: { startNr: string; klasse: string; seite?: 'A' | 'B' } | undefined = sicht
        ? [...sicht.schlange, ...sicht.danach, ...(sicht.bestand ?? [])].find((x) => x.key === zeile.s)
        : undefined
      const punkt = sicht?.punkt?.id ?? null
      const eintrag = werteVon(liste, punkt, zeile.s)
      const vorher = (f: string) => vorherVon(eintrag, liste, teil, f)
      // „Nicht vorbeigekommen“ (W4.3): ohne Zellen – die Zeile sagt nur „hier kam keiner“, nichts wird eingetragen.
      const nv = zeile.nv === true
      const c: [string, string, string][] = nv
        ? []
        : Object.entries(zeile.zellen)
            .filter(([f, w]) => typeof w === 'string' && (w !== '' || vorher(f) !== ''))
            .map(([f, w]) => [f, w, vorher(f)])
      const vs = vorschlagWeil(liste, punkt, teil)
      // Abgeschickt: der Entwurf dieses Starts und Teils ist erledigt (H4).
      const ew = inhalt.entwuerfe[liste]
      if (ew) {
        delete ew[entwurfSchluessel(zeile.s, teil)]
        if (Object.keys(ew).length === 0) delete inhalt.entwuerfe[liste]
      }
      const sn = start?.startNr ?? werteVon(liste, punkt, zeile.s)?.sn
      return stelleAn({
        z: neueId(),
        liste,
        s: zeile.s,
        ...(sn !== undefined ? { sn } : {}),
        ...(teil ? { t: teil } : {}),
        ...(start?.seite ? { seite: start.seite } : {}),
        klasse: start?.klasse ?? werteVon(liste, punkt, zeile.s)?.k ?? null,
        punkt,
        c,
        ...(nv ? { n: true as const } : {}),
        ...(!nv && zeile.kz ? { kz: Object.entries(zeile.kz).filter((x): x is [string, KeineZeitGrund] => istKeineZeitGrund(x[1])) } : {}),
        nr: null,
        ...(vs ? { vs } : {}),
      })
    },
    keineZeit(z) {
      const alt = inhalt.zeilen.find((x) => x.z === z)
      const e = alt ? werteVon(alt.liste, alt.punkt, alt.s) : undefined
      return { ...(e?.kz ?? {}) }
    },
    stand(z) {
      const alt = inhalt.zeilen.find((x) => x.z === z)
      const e = alt ? werteVon(alt.liste, alt.punkt, alt.s) : undefined
      return alt && e ? standVon(e, alt.liste, alt.t) : null
    },
    korrigiere(z, zellen, kz) {
      const alt = inhalt.zeilen.find((x) => x.z === z)
      if (gestoppt || !alt || !aufgabeVon(alt.liste)) return null
      const eintrag = werteVon(alt.liste, alt.punkt, alt.s)
      const vorher = (f: string) => vorherVon(eintrag, alt.liste, alt.t, f)
      // „Keine Zeit“ (W5.4): mit `kz` geht die Korrektur auch ohne geänderte Zellen, wenn sich nur der Grund änderte.
      const kzNeu = kz ? Object.entries(kz).filter((x): x is [string, KeineZeitGrund] => istKeineZeitGrund(x[1])) : undefined
      const kzGeaendert = !!kz && !gleicheKz(kz, eintrag?.kz ?? {})
      if (alt.nr === null && !alt.ab) {
        // Noch im Ausgang: die wartende Zeile ändern statt einer zweiten (eine Nachricht weniger). Unveränderte Felder
        // außerhalb der Zeile bleiben draußen. Eine wartende „nicht vorbeigekommen“ wird so zur Zeile mit Werten.
        if (alt.n) {
          delete alt.n
          const e = werteVon(alt.liste, alt.punkt, alt.s)
          if (e?.n !== undefined && e.n === (alt.t ?? 'g')) delete e.n
        }
        for (const [f, w] of Object.entries(zellen)) {
          if (typeof w !== 'string') continue
          const i = alt.c.findIndex((c) => c[0] === f)
          if (i >= 0) alt.c[i] = [f, w, alt.c[i][2]]
          else if (w !== vorher(f)) alt.c.push([f, w, vorher(f)])
        }
        if (kzNeu) alt.kz = kzNeu
        merkeWerte(alt)
        speichere()
        return alt.z
      }
      const c: [string, string, string][] = Object.entries(zellen)
        .filter(([f, w]) => typeof w === 'string' && vorher(f) !== w)
        .map(([f, w]) => [f, w, vorher(f)])
      // „Doch vorbei“ nach „nicht vorbeigekommen“ (W4.3, R3/R6): auch ohne Werte (fehlerfrei) geht eine Zeile – sie hebt
      // das Kennzeichen am Bedienrechner auf.
      const warNv = eintrag?.n !== undefined && eintrag.n === (alt.t ?? 'g')
      if (c.length === 0 && !warNv && !kzGeaendert) return alt.z
      const vs = vorschlagWeil(alt.liste, alt.punkt, alt.t)
      return stelleAn({
        z: neueId(),
        liste: alt.liste,
        s: alt.s,
        ...(alt.sn !== undefined ? { sn: alt.sn } : {}),
        ...(alt.t ? { t: alt.t } : {}),
        ...(alt.seite ? { seite: alt.seite } : {}),
        k: true,
        klasse: alt.klasse,
        punkt: alt.punkt,
        c,
        ...(kzNeu ? { kz: kzNeu } : {}),
        nr: null,
        ...(vs ? { vs } : {}),
      })
    },
    soLassen(liste, z) {
      if (gestoppt || !aufgabeVon(liste) || !istNr(z)) return null
      const id = nachricht(liste, { art: 'action', action: { type: 'WKR_SO_LASSEN', liste, z } })
      speichere()
      pumpe()
      return id
    },
    pausiere: (liste) => status(liste, 'pausiert'),
    meldeAb(liste) {
      const sicht = inhalt.sichten[liste]
      const teil = aufgabeVon(liste)?.teil
      if (gestoppt || !aufgabeVon(liste)) return null
      // Sofort in Ruhe (nicht erst mit der Quittung): Der WKR legt das Gerät weg, der Papierbogen gilt ab jetzt. Der
      // Eintrag steht VOR dem Senden (status pumpt sofort), damit pumpe ihm die Nummer der Nachricht gibt.
      const eintrag: Inhalt['abgemeldet'][string] = { titel: sicht?.titel ?? '', bereich: sicht?.bereich ?? '', ...(teil ? { teil } : {}), id: neueId() }
      inhalt.abgemeldet[liste] = eintrag
      const id = status(liste, 'abgemeldet', eintrag.id)
      if (id === null) {
        delete inhalt.abgemeldet[liste]
        return null
      }
      speichere()
      return id
    },
    weiter: (liste) => status(liste, 'aktiv'),
    wkrName(liste) {
      void rev.value
      void sichten.value
      const einteilung = inhalt.sichten[liste]?.wkrName?.trim() ?? ''
      const eigen = inhalt.namen[liste]
      return eigen !== undefined ? { name: eigen, einteilung, eigen: true } : { name: einteilung, einteilung, eigen: false }
    },
    setzeWkrName(liste, name) {
      if (gestoppt || !aufgabeVon(liste) || typeof name !== 'string') return false
      const sauber = name.trim()
      if (sauber.length > WKR_ANNAHMEN.nameMax) return false
      const einteilung = inhalt.sichten[liste]?.wkrName?.trim() ?? ''
      const vorher = inhalt.namen[liste]
      // Leer oder wie die Einteilung = zurück zur Einteilung (keine Abweichung mehr, der Hinweis am Host fällt).
      if (sauber === '' || sauber === einteilung) delete inhalt.namen[liste]
      else inhalt.namen[liste] = sauber
      if (inhalt.namen[liste] === vorher) return true
      inhalt.nameMelden = true
      speichere()
      lebenszeichen()
      return true
    },
    schliesseAb(liste, punkt, name, restPapier) {
      const aufgabe = aufgabeVon(liste)
      const sauber = typeof name === 'string' ? name.trim() : ''
      if (gestoppt || !aufgabe || sauber === '' || sauber.length > WKR_ANNAHMEN.nameMax) return null
      const sicht = inhalt.sichten[liste]
      const pruefsummen: Record<string, string> = {}
      for (const [s, e] of Object.entries(inhalt.werte[liste]?.[punkt] ?? {})) {
        const felder = e.k !== null ? sicht?.klassen[e.k as keyof ListenSicht['klassen']]?.felder : null
        if (!felder) continue
        const kennungen = felder.filter((f) => !aufgabe.teil || f.teil === aufgabe.teil).map((f) => f.kennung)
        pruefsummen[s] = zeilenPruefsumme(e.w, kennungen)
      }
      const id = nachricht(liste, { art: 'action', action: { type: 'WKR_ABSCHLUSS', liste, punkt, name: sauber, pruefsummen, restPapier } })
      inhalt.abschluesse.push({ id, liste, punkt, nr: null })
      speichere()
      pumpe()
      return id
    },
    gesehen(hinweis) {
      if (gestoppt || !istNr(hinweis) || inhalt.gesehen.includes(hinweis)) return
      inhalt.gesehen.push(hinweis)
      nachricht(undefined, { art: 'gesehen', hinweis })
      speichere()
      pumpe()
    },
    entwurf(liste, s, teil) {
      const e = inhalt.entwuerfe[liste]?.[entwurfSchluessel(s, teil)]
      return e ? { ...e.zellen } : null
    },
    merkeEntwurf(liste, s, teil, zellen) {
      if (gestoppt || !aufgabeVon(liste) || typeof s !== 'string' || s === '') return false
      const k = entwurfSchluessel(s, teil)
      if (entwurfLeer(zellen)) {
        if (inhalt.entwuerfe[liste]?.[k]) {
          delete inhalt.entwuerfe[liste][k]
          if (Object.keys(inhalt.entwuerfe[liste]).length === 0) delete inhalt.entwuerfe[liste]
          speichere()
        }
        return true
      }
      const jeStart = (inhalt.entwuerfe[liste] ??= {})
      delete jeStart[k]
      const sn = startNrVon(liste, s)
      const sauber = Object.fromEntries(Object.entries(zellen).filter(([, w]) => typeof w === 'string'))
      const papier = papierVon(liste, s, sauber, werteVon(liste, inhalt.sichten[liste]?.punkt?.id ?? null, s)?.k ?? null)
      jeStart[k] = { ...(sn !== undefined ? { sn } : {}), zellen: sauber, ...(papier ? { papier } : {}) }
      // Älteste zuerst hinaus, wenn es zu viele werden.
      for (const alt of Object.keys(jeStart).slice(0, -ENTWUERFE_MAX)) delete jeStart[alt]
      speichere()
      return true
    },
    verwirfEntwurf(liste, s, teil) {
      const jeStart = inhalt.entwuerfe[liste]
      const k = entwurfSchluessel(s, teil)
      if (gestoppt || !jeStart?.[k]) return
      delete jeStart[k]
      if (Object.keys(jeStart).length === 0) delete inhalt.entwuerfe[liste]
      speichere()
    },
    entwuerfe,
    holeZurueck(z) {
      const alt = inhalt.zeilen.find((x) => x.z === z)
      if (gestoppt || !alt || alt.nr !== null || alt.ok || alt.ab) return null
      // Eine neuere Zeile desselben Starts und Teils wartet schon: Sie baut auf diesen Werten auf (`vorher`).
      if (inhalt.zeilen.some((x) => x.z > alt.z && x.liste === alt.liste && x.s === alt.s && x.t === alt.t)) return null
      inhalt.zeilen = inhalt.zeilen.filter((x) => x.z !== z)
      inhalt.aus = inhalt.aus.filter((a) => a.art !== 'zeile' || a.z !== z)
      // Die zuletzt gesendeten Werte gehen auf `vorher` zurück – die Zeile ging ja nie hinaus.
      const e = werteVon(alt.liste, alt.punkt, alt.s)
      if (e) {
        for (const [f, , vorher] of alt.c) setzeWert(e, alt.liste, alt.t, f, vorher)
        const andere = inhalt.zeilen.some((x) => x.liste === alt.liste && x.s === alt.s && x.punkt === alt.punkt && (x.t ?? 'g') === (alt.t ?? 'g'))
        if (!andere) e.t = (e.t ?? []).filter((t) => t !== (alt.t ?? 'g'))
        if (Object.keys(e.w).length === 0 && (e.t ?? []).length === 0) delete inhalt.werte[alt.liste]![alt.punkt ?? '']![alt.s]
      }
      const zellen = Object.fromEntries(alt.c.map(([f, w]) => [f, w]))
      if (!entwurfLeer(zellen)) {
        const papier = papierVon(alt.liste, alt.s, zellen, alt.klasse)
        ;(inhalt.entwuerfe[alt.liste] ??= {})[entwurfSchluessel(alt.s, alt.t)] = { ...(alt.sn !== undefined ? { sn: alt.sn } : {}), zellen, ...(papier ? { papier } : {}) }
      }
      speichere()
      return { s: alt.s, zellen, ...(alt.t ? { teil: alt.t } : {}) }
    },
    pruefung(liste, punkt, teil) {
      const zeilen: PruefZeile[] = []
      for (const [s, e] of Object.entries(inhalt.werte[liste]?.[punkt] ?? {})) {
        if (teil !== undefined && !(e.t ?? []).some((t) => t === teil || t === 'g')) continue
        const letzte = inhalt.zeilen.filter((z) => z.liste === liste && z.s === s && z.punkt === punkt).at(-1)
        // „Nicht vorbeigekommen“ zählt für diesen Teil (bzw. die ganze Zeile); am Steg trägt nur das Anlegen es.
        const nv = e.n !== undefined && (teil === undefined || e.n === teil || e.n === 'g')
        zeilen.push({ s, ...(e.sn !== undefined ? { sn: e.sn } : {}), klasse: e.k, zellen: standVon(e, liste, teil), stufe: letzte ? stufeVon(letzte) : null, x: Object.values(e.w).some(hatX), nv })
      }
      const sicht = inhalt.sichten[liste]
      const je = schlangen.value[liste]
      // Offen: die Starts der Schlange DIESES Punkts – seit W3-40 (21.11.2026) wird nur über das Band abgeschlossen, oft
      // erst, wenn der nächste Lauf begann; ohne `punkt` am Start (ältere Sicht, Übung) gilt der Punkt der Sicht.
      const quelle = !je ? [] : teil !== undefined && sicht?.teile ? je[teil] : je.ganz
      // Am Tisch (W5.3, KN5): offen = Starter des Bestands, die weder die Sicht noch eine eigene Zeile erledigt hat.
      const ohneLauf = bestand.value[liste]
      const offen = ohneLauf
        ? ohneLauf.filter((b) => !b.erledigt).map((b): SchlangenEintrag => ({ key: b.key, startNr: b.startNr, klasse: b.klasse, titel: '', lauf: '' }))
        : quelle.filter((s) => !s.vorab && !s.entfaellt && (s.punkt ?? sicht?.punkt?.id) === punkt).map((s) => ({ ...s }))
      return { zeilen, offen, x: zeilen.filter((z) => z.x).map((z) => z.sn ?? z.s), nichtVorbei: zeilen.filter((z) => z.nv).map((z) => z.sn ?? z.s) }
    },
    stop() {
      if (gestoppt) return
      gestoppt = true
      clearInterval(takt)
      clearTimeout(karenz)
      ab()
      scope.stop()
    },
  }
}
