import type { AppState, CellKind, ClassId, PunktId, Sprache, StartRef, WkrPunkt, WkrStatus } from '../types'
import { configFor, type Konfig } from '../config/konfig'
import { codeKlassenOf } from '../config/catalog'
import type { BogenTexte } from '../config/sprache'
import type { Column } from '../types'
import { bereicheZumStand, laeufeVonPunkt, lage, rundeVonPunkt } from '../betrieb/folge'
import { defFuerKlasse } from '../lib/bogen'
import { erfasstKennung, listenFelder, teilHaken, werteVon } from '../lib/eingaben'
import { bietetEnglisch, wkrSpracheFuer } from '../lib/listensprache'
import { RACECOURSE_PARCOURS } from '../lib/parallelSchluessel'
import { geraetVonZeile } from '../state/reducer/wkr'
import { abgeschlossenePunkte, abschlussVon, OHNE_PUNKT, TEILE } from './abschluss'
import { WKR_ANNAHMEN } from './annahmen'
import { bojenHalt } from './bojen'
import { bestandOhneLauf, istParcoursListe, istTischListe, listenKennung, teileVon, teilVonZelle, type Liste } from './liste'
import { ampelImStand, laufLage } from './ampel'
import { danach, schlange, type SchlangenStart } from './schlange'

// Die Sicht einer Liste (Plan docs/plan-wkr-w1.md §3.1, 21.11.2026): das EINE, was die WKR-Geräte einer Liste vom
// Stand zu sehen bekommen – über die verschlüsselte Gruppe der Liste (geraete/wkrGruppen.ts). Gebaut wie
// betrieb/sicht.ts `sichtZuschauer`: jedes Objekt Feld für Feld neu, nie eine Referenz aus dem Stand durchgereicht –
// ein neues Feld im Stand landet so nie still auf der Leitung (Schlüssel-Test in sicht.test.ts).
//
// Datenschutz (F6, F11, F17): nie Name, Herkunft, Geburtsdatum, Gewicht, Geschlecht; keine Werte (auch nicht der
// eigenen Liste – das Gerät kennt, was es geschickt hat), keine Summen, keine Wertung. Einzige Ausnahme: bei einer
// Rückfrage des Geräts der Wert genau dieser Zelle (`steht`, F11). Die Sicht ist EIN Inhalt der Listen-Gruppe: Jedes
// Gerät derselben Liste (am Steg auch das des anderen Teils) kann sie ganz lesen, also auch `steht`, Ablehnungen und
// Hinweise der anderen – nie ein Gerät einer anderen Liste (WKR_ANNAHMEN.rueckfrageInListe, Prüfbefund 21.11.2026).
// Rein und zeitunabhängig: gleicher Stand und gleiches `extra` ⇒ gleiche Sicht (der Host vergleicht nach Inhalt).

/**
 * Fassung der Sicht der Liste: zählt hoch, wenn sich ihre Form ändert (Geräte zeigen nur dieselbe Fassung).
 * 3 seit W3 (21.11.2026): `andere` (zweite Sprache der Maske, F13); bei zweisprachiger Liste stehen die Masken
 * (`klassen`) deutsch, die englischen in `andere` (G9).
 * 4 seit W4.1 (21.11.2026): `MaskenFeld.boje` und `AndereFeld.boje` (Bojen-Maske, P15) – ein Gerät mit altem Programm
 * zeigte eine Bojen-Liste sonst als „Maske folgt“ bzw. ohne Halte.
 * 5 seit W4.3 (21.11.2026): „Nicht vorbeigekommen“ (GeraeteZeile.n, Ablehnung `nv-nicht-erlaubt`). Die Form der Sicht
 * bleibt; die Fassung zählt trotzdem hoch, damit ein Gerät mit altem Programm „aktualisieren“ zeigt, statt einen
 * solchen Start ohne Meldung zu verlieren, und kein alter Bedienrechner eine Zeile mit `n` als „fehlerfrei“ übernimmt
 * (er schickte Fassung 4 – das neue Gerät liest sie nicht; P16).
 * 6 seit der Parcours-Ampel (Nutzer 21.11.2026, P-03, R6-10): `ampel` (nur Parcours-Listen: Ampel des gezeigten
 * Starts, AM9) und `laeuft` (der laufende Punkt läuft noch – Rückfrage vor „Liste abschließen“).
 * 7 seit dem Gerät-Feinschliff (Nutzer 21.11.2026, W3-07, W4-13): Katalog-Einträge mit `aus` (Code gilt laut Regelwerk
 * in dieser Klasse nicht – ausgegraut, aber drückbar, GF2) und `bild` je Klasse (Parcours-Zeichnung unter den Knöpfen,
 * GF9) – ein altes Gerät zeigte sonst nichts davon.
 * 8 seit den WKR-Namen aus der Veranstaltung (Nutzer 21.11.2026, W3-13, WKR_ANNAHMEN WN1): `wkrName` = Name aus der
 * WKR-Einteilung für GENAU diese Liste – ein altes Gerät fragte sonst weiter nur beim Abschluss.
 * 9 seit den Listen ohne Lauf (W5.3, 22.11.2026, KN3): an der Liste am Tisch `bestand` (Startnummer, Klasse,
 * erledigt – nie Namen) und `offen` {n, m} statt einer Schlange, Punkt `ohne` – ein altes Gerät zeigte sonst „nichts
 * zu tun“ und schickte Kennungen, die es nicht kennt.
 * 10 seit mehreren Disq. je Bojenzelle (R7-14, 22.11.2026, WKR_ANNAHMEN BZ8): Die Form der Sicht bleibt gleich, aber
 * Zellen heißen jetzt „5, J, D“ – ein altes Gerät läse davon nur den ersten Buchstaben und schickte „5J“, das wertGilt
 * ablehnt. Die neue Fassung lässt es über F7 neu laden.
 */
export const LISTEN_SICHT_FASSUNG = 10

/**
 * Hinweise des Bedienrechners an die Geräte einer Liste (Rückkanal, nur Codes und Startnummer): prüfen, Papier
 * übernimmt, Verbindung unterbrochen, wieder digital. Hier statt in geraete/, damit die Sicht nichts von dort braucht.
 */
export const WKR_HINWEISE = ['pruefen', 'papier', 'unterbrochen', 'weiter-digital'] as const
export type WkrHinweis = (typeof WKR_HINWEISE)[number]

/** Ein Start, wie ihn das Gerät sieht: nur, was am Steg ohnehin auf der Tafel steht, ohne Namen (F6). */
export interface ListenStart {
  /** Kennung des Starts (`refKey`) – so schickt das Gerät seine Zeile (`s`). */
  key: string
  startNr: string
  klasse: ClassId
  /** Lauf bzw. Runde und Attempt in der Sprache der Liste („1. Lauf“, „Semi-finals · Attempt 2“). */
  titel: string
  /** Lauf-Schlüssel der Werte. */
  lauf: string
  /** Im Parallelslalom die Seite der Liste. */
  seite?: 'A' | 'B'
  /** Boot der Klasse (AppState.boote), wenn eingetragen. */
  boot?: string
  /**
   * Nur bei geteilten Listen (Steg): welcher Teil vom Gerät nichts mehr braucht – erfasst, oder für diesen Teil auf
   * Papier (Pause, Abschluss mit „Rest auf Papier“) bzw. sein Punkt abgeschlossen. Seit dem Steg-Zeitversatz (Nutzer
   * 21.11.2026, WKR_ANNAHMEN.stegAnlegenNachlaufend) auch: braucht NOCH nichts – das Anlegen eines Starts im Boot, vorab
   * oder in „danach“.
   */
  teile?: { ab: boolean; an: boolean }
  /** Die Klasse hat diese Liste nicht: grau „entfällt“. */
  entfaellt?: 'klasse'
  /** Noch nicht gezeigt, aber schon zu erfassen (Vorsteg). */
  vorab?: true
  /**
   * Punkt (Lauf bzw. Runde) des Starts – seit Fassung 6 (21.11.2026, W3-40): Abgeschlossen wird nur noch über das Band,
   * oft wenn der nächste Lauf schon begann; die Prüfansicht muss die offenen Starts DES abzuschließenden Punkts kennen
   * (sonst fehlte „Rest auf Papier“ und der Bedienrechner lehnte mit `offen` ab).
   */
  punkt?: WkrPunkt
}

/**
 * Ein Starter einer Liste ohne Lauf (W5.3, KN3): nur, was der WKR am Tisch ohnehin sieht – Startnummer und Klasse –,
 * und ob die Liste ihn schon hat (Haken). Nie ein Name (F6).
 */
export interface ListenBestand {
  /** Kennung des Starts ohne Lauf (`["o", starterId]`) – so schickt das Gerät seine Zeile (`s`). */
  key: string
  startNr: string
  klasse: ClassId
  erledigt: boolean
}

/** Ein Feld der Maske, aufgelöst für eine Klasse und in der Sprache der Liste. */
export interface MaskenFeld {
  kennung: string
  kind: CellKind
  label: string
  /** Teil der Liste (Steg: Ablegen/Anlegen); fehlt bei gemeinsamen Spalten und ungeteilten Listen. */
  teil?: 'ab' | 'an'
  /**
   * Fehlerkatalog (nur `code`). `aus`: Der Code gilt laut Regelwerk in dieser Klasse nicht (YAML `abKlasse`/`klassen`,
   * config/catalog.ts codeKlassenOf) – die Maske graut ihn aus, drückbar bleibt er (Nutzer 21.11.2026, W3-07, GF2).
   */
  katalog?: { code: string; punkte: number; text: string; aus?: true }[]
  /** Disq.-Buchstaben, die hier gelten (`buoy`, `code`, `disq`); X nur, wo das Gerät es darf (F5). */
  disq?: { code: string; text: string }[]
  /** Nur Bojen auf dem Fahrweg (W4, P15): wo die Boje liegt und wie ihr Kopf auf dem Bogen heißt. */
  boje?: MaskenBojeAngabe
}

/**
 * Die Bojen-Angabe eines Felds (W4.1, Plan docs/plan-wkr-w4.md §4.2, 21.11.2026): nur Fahrweg-Angaben aus wkr/bojen.ts
 * und Bogentexte – das Gerät kennt den Aufbau nicht, und der Kopf der Unterspalte (Beschriftungsschema R/L, I/A,
 * Land/See, Pfeile) steht nur am Host.
 */
export interface MaskenBojeAngabe {
  halt: string
  weg: 'hin' | 'rueck'
  folge: number
  /** Kopf der Spalte („Tor 1“, „Sp. 2“, „Boje 3“) in der Sprache der Maske. */
  titel: string
  /** Kopf der Unterspalte wie auf dem Bogen („H L“; Start/Ziel nur „L“); '' ohne Unterspalte. */
  unter: string
  /** Knopfspalte aus Sicht des WKR (P7): Reihenfolge der Seiten auf dem Bogen; `null` = volle Breite. */
  spalte: 0 | 1 | null
  zaehler?: true
  durchfahrt?: 2
}

/** Was der Host je Gerät der Liste dazugibt (aus seinem Register und dem Gesprächsstand, nie aus dem AppState). */
export interface ListenSichtExtra {
  geraete: Record<string, {
    /** Bis zu welcher Nachricht des Geräts alles angekommen ist (`letzteNr` im Register) – die gesammelte Quittung. */
    bis: number
    abgelehnt?: readonly { z: number | string; grund: string }[]
    hinweise?: readonly { id: number; code: WkrHinweis; startNr?: string }[]
  }>
}

export interface ListenGeraet {
  bis: number
  /** Offene Rückfragen der Zeilen dieses Geräts: `steht` = was dort steht (F11, nur diese Zelle). */
  rueckfragen: { z: string; feld: string; lauf: string; steht: string }[]
  abgelehnt: { z: string; grund: string }[]
  hinweise: { id: number; code: WkrHinweis; startNr?: string }[]
  /** Starts, deren geprüfte Fassung beim Abschluss des laufenden Punkts nicht zum Stand passte. */
  abweichend?: string[]
}

/** Ein Feld der Maske in der anderen Sprache: nur Texte – Art, Teil und Punkte stehen einmal in `klassen`. */
export interface AndereFeld {
  kennung: string
  label: string
  katalog?: { code: string; text: string }[]
  disq?: { code: string; text: string }[]
  /** Nur die Bogentexte der Boje in der anderen Sprache (W4.1). */
  boje?: { titel: string; unter: string }
}

/**
 * Die Maske in der anderen Sprache (F13, W3): nur, wenn das Regelwerk beide Sprachen hat (UIM; DM kennt kein
 * Englisch). Nur Texte, keine Werte, keine Namen.
 */
export interface ListenAndere {
  sprache: 'de' | 'en'
  titel: string
  bereich: string
  klassen: Partial<Record<ClassId, { titel: string; felder: AndereFeld[] | null }>>
}

/**
 * Parcours-Zeichnung der Klasse auf dieser Liste (Nutzer 21.11.2026, W4-13, GF9): dieselbe Angabe wie das Bild des
 * Bogens (lib/bogen.ts BogenBild – Datei aus `kurse.bilder` der Klasse, Dimmen/Ausblenden der Position, Drehung). Nur
 * eine Kennung, nie das Bild: Das Gerät hat die Zeichnungen gebündelt (src/assets/parcours) und lädt nichts.
 */
export interface MaskenBild {
  datei: string
  dim: string[]
  aus: string[]
  drehung: number
}

export interface ListenSicht {
  lv: typeof LISTEN_SICHT_FASSUNG
  liste: string
  /** Name der Liste und des Bereichs in der Sprache der Liste (F13). */
  titel: string
  bereich: string
  /** Sprache der Liste, wie ihr Bogen (lib/listensprache.ts wkrSpracheFuer), auch zweisprachig. */
  sprache: Sprache
  modus: 'digital' | 'papier' | 'beides'
  status: 'aktiv' | 'pausiert' | 'abgemeldet'
  /** Laufender Punkt; an einer Liste ohne Lauf (W5.3) immer `ohne` („Knoten“ – die ganze Liste). */
  punkt: { id: WkrPunkt; titel: string } | null
  /** Punkte, die für die ganze Liste abgeschlossen sind (am Steg: ganz oder beide Teile); am Tisch `ohne`. */
  abgeschlossen: WkrPunkt[]
  /** Nur geteilte Listen (Steg, F16): Status und abgeschlossene Punkte je Teil (der Abschluss der ganzen Liste zählt mit). */
  teile?: Record<'ab' | 'an', { status: WkrStatus; abgeschlossen: WkrPunkt[] }>
  schlange: ListenStart[]
  danach: ListenStart[]
  /** Je Klasse die Maske; `null` = die Klasse hat diese Liste nicht (entfällt). */
  klassen: Partial<Record<ClassId, { titel: string; felder: MaskenFeld[] | null; bild?: MaskenBild }>>
  /** Dieselben Masken in der anderen Sprache (F13), nur unter einem Regelwerk mit [de, en]. */
  andere?: ListenAndere
  geraete: Record<string, ListenGeraet>
  /**
   * Name des Wettkampfrichters dieser Liste aus der WKR-Einteilung der Veranstaltung (Nutzer 21.11.2026, W3-13, WN1) –
   * nur der eigenen Liste, nur in ihrer verschlüsselten Gruppe (Teil-Geräte am Steg: derselbe Name, die Einteilung kennt
   * keine Teile). Fehlt ohne Eintrag (dann fragt das Gerät beim Abschluss, WN3). Nie in ko/kz oder der Freigabe-Sicht.
   */
  wkrName?: string
  /**
   * Nur Parcours-Listen (AM1, AM9): die Parcours-Ampel des gezeigten Starts – grün „Start frei“, rot „im Parcours“, frei
   * „alle fertig“. Fehlt ohne Ampel (Steg, Vorsteg, nichts gezeigt, keine Parcours-Liste digital).
   */
  ampel?: { key: string; ampel: 'gruen' | 'rot' | 'frei' }
  /**
   * Der laufende Punkt läuft noch (R6-10): Startnummern unterwegs (im Boot bzw. Ampel grün/rot) und Zahl der noch
   * freien Starts. Fehlt, wenn er durch ist oder keiner läuft.
   */
  laeuft?: { punkt: PunktId; unterwegs: string[]; offen: number }
  /**
   * Nur Listen ohne Lauf (am Tisch, W5.3, KN3): alle Starter, die die Liste abnimmt, in der Folge des Stands – statt
   * einer Schlange (`schlange`/`danach` bleiben leer); der WKR tippt die Nummer ein.
   */
  bestand?: ListenBestand[]
  /** Nur Listen ohne Lauf: noch offen / alle des Bestands („offen 14 / 38“). */
  offen?: { n: number; m: number }
}

export type MaskenJeKlasse = ListenSicht['klassen']

/**
 * Reihenfolge der Seiten (seiteA/seiteB), wie sie auf dem Bogen dieser Liste nebeneinander stehen (P7): aus der ersten
 * Spalte mit zwei verschiedenen Bojen. Die Kurzform ordnet die Unterspalten schon nach `blick` (von vorne die obere
 * links) – so stehen die Knöpfe, wie der WKR das Tor sieht. Ohne eine solche Spalte (nur Einzelbojen): `null`.
 */
function seitenFolge(columns: readonly Column[]): ('seiteA' | 'seiteB')[] | null {
  for (const col of columns) {
    if (col.kind !== 'buoy') continue
    const seiten = (col.felder ?? []).map((f) => bojenHalt(f)?.seite ?? null)
    if (seiten.length === 2 && seiten[0] && seiten[1] && seiten[0] !== seiten[1]) return [seiten[0], seiten[1]]
  }
  return null
}

/** Kopf der Spalte und der Unterspalte eines Felds (Feld.zelle `key` bzw. `key#i`) auf dem Bogen der Klasse. */
function bojenTexte(columns: readonly Column[], zelle: string): { titel: string; unter: string } {
  const [key, idx] = zelle.split('#')
  const col = columns.find((c) => c.key === key)
  if (!col) return { titel: '', unter: '' }
  return { titel: col.label, unter: idx !== undefined ? (col.sub?.[Number(idx)] ?? '') : '' }
}

/**
 * Die Masken je Klasse einer Liste, in der Sprache von `sprachKonfig` – geteilt von {@link sichtListe} und der Übung
 * (wkr/uebung.ts), damit beide dieselbe Maske bauen. `konfig` ist die des Stands (welche Klasse die Liste hat);
 * `null` = die Klasse hat diese Liste nicht (entfällt) oder die Liste ist unbekannt. X „nicht gestartet“ nur, wo F5 es
 * erlaubt (`xErlaubt`: die Liste darf es; am Steg nur im Teil Ablegen und in gemeinsamen Spalten).
 */
export function maskenJeKlasse(konfig: Konfig, sprachKonfig: Konfig, typeId: string, klassenIds: Iterable<ClassId>, xErlaubt: boolean, aufbauId?: string): MaskenJeKlasse {
  const texte = sprachKonfig.getBogenTexte()
  const bekannt = konfig.getPositions().some((p) => p.typeId === typeId)
  const teile = teileVon(typeId)
  const codeKlassen = codeKlassenOf(konfig.getRegelwerk().id ?? '')
  const klassen: MaskenJeKlasse = {}
  for (const k of [...new Set(klassenIds)].sort()) {
    if (!bekannt || !konfig.positionAllowsClass(typeId, k)) {
      klassen[k] = { titel: texte.klasse(k), felder: null }
      continue
    }
    const def = defFuerKlasse(sprachKonfig.getSheetDef(typeId), k)
    const disqTabelle = def.disqTable ?? []
    // Seiten aus der ganzen Liste, nicht nur der Klasse: dieselbe Boje steht in jeder Klasse in derselben Spalte.
    const seiten = seitenFolge(sprachKonfig.getSheetDef(typeId).columns)
    const felder = listenFelder(sprachKonfig, typeId, k).map((f): MaskenFeld => {
      const out: MaskenFeld = { kennung: f.kennung, kind: f.kind, label: f.label }
      const teil = teilVonZelle(typeId, f.zelle)
      if (teil === 'ab' || teil === 'an') out.teil = teil
      if (f.kind === 'code' && f.katalog)
        out.katalog = f.katalog.map((e) => {
          const gilt = codeKlassen[e.code]
          return { code: e.code, punkte: e.punkte, text: e.text, ...(gilt && !gilt.includes(k) ? { aus: true as const } : {}) }
        })
      if (f.kind === 'buoy' || f.kind === 'code' || f.kind === 'disq') {
        // X „nicht gestartet“ nur am Steg (Ablegen bzw. gemeinsame Spalte) und am Vorsteg (F5) – sonst lehnt der
        // Bedienrechner die Zeile ohnehin ab; die Maske bietet es gar nicht erst an.
        const xHier = xErlaubt && (!teile || teil === WKR_ANNAHMEN.xTeil || teil === 'gemeinsam')
        out.disq = disqTabelle.filter((d) => d.code !== 'X' || xHier).map((d) => ({ code: d.code, text: d.text }))
      }
      const halt = f.kind === 'buoy' ? bojenHalt(f.kennung) : null
      if (halt) {
        const i = halt.seite && seiten ? seiten.indexOf(halt.seite) : -1
        const boje: MaskenBojeAngabe = { halt: halt.halt, weg: halt.weg, folge: halt.folge, ...bojenTexte(def.columns, f.zelle), spalte: i === 0 || i === 1 ? i : null }
        if (halt.zaehler) boje.zaehler = true
        if (halt.durchfahrt) boje.durchfahrt = halt.durchfahrt
        out.boje = boje
      }
      return out
    })
    // Parcours-Zeichnung (W4-13, GF9): nur wo der Bogen eine hat, nur mit Aufbau (sonst wüsste niemand, welche).
    const bild = aufbauId !== undefined && def.bildErzeugen ? { datei: konfig.bildDatei(aufbauId, k), dim: [...def.bildErzeugen.dim], aus: [...def.bildErzeugen.aus], drehung: def.bildDrehung ?? 0 } : null
    klassen[k] = { titel: texte.klasse(k), felder, ...(bild ? { bild } : {}) }
  }
  return klassen
}

/** Nur die Texte der Masken – für `andere` (Feld für Feld neu, wie die ganze Sicht). */
export function maskenTexte(klassen: MaskenJeKlasse): ListenAndere['klassen'] {
  const out: ListenAndere['klassen'] = {}
  for (const [k, v] of Object.entries(klassen) as [ClassId, NonNullable<MaskenJeKlasse[ClassId]>][]) {
    out[k] = {
      titel: v.titel,
      felder:
        v.felder?.map((f) => {
          const a: AndereFeld = { kennung: f.kennung, label: f.label }
          if (f.katalog) a.katalog = f.katalog.map((e) => ({ code: e.code, text: e.text }))
          if (f.disq) a.disq = f.disq.map((d) => ({ code: d.code, text: d.text }))
          if (f.boje) a.boje = { titel: f.boje.titel, unter: f.boje.unter }
          return a
        }) ?? null,
    }
  }
  return out
}

/**
 * Sprache der Maske (G9): eine Sprache je Knopf – bei zweisprachiger Liste Deutsch, die andere ist dann Englisch.
 * `andere` nur, wenn das Regelwerk Englisch anbietet.
 */
export function maskenSprachen(regelwerk: string, sprache: Sprache): { maske: 'de' | 'en'; andere: 'de' | 'en' | null } {
  const maske = sprache === 'en' ? 'en' : 'de'
  return { maske, andere: bietetEnglisch(regelwerk) ? (maske === 'de' ? 'en' : 'de') : null }
}

/** Der Titel eines Punkts in der Sprache der Liste (wie betrieb/sicht.ts sichtPunkt). */
function punktTitel(stand: AppState, punkt: PunktId, texte: BogenTexte): string {
  const runde = rundeVonPunkt(punkt)
  if (runde !== undefined) return texte.runde(runde)
  return laeufeVonPunkt(stand, punkt).map((n) => texte.lauf(n)).join(' / ')
}

function startTitel(ref: StartRef, texte: BogenTexte): string {
  return ref.art === 'p' ? `${texte.runde(ref.runde)} · ${texte.attempt} ${ref.attempt}` : texte.lauf(ref.lauf)
}

/**
 * Name des Wettkampfrichters einer Liste laut WKR-Einteilung (AppState.einteilung, Parcours × Liste; Parallelslalom
 * unter der Kennung des Racecourse, lib/parallelSchluessel.ts RACECOURSE_PARCOURS) – ohne Leerraum am Rand, '' ohne
 * Eintrag. Für die Sicht (WN1) und den Vergleich am Bedienrechner (GeraeteListe.vue, Nutzer 21.11.2026 W3-13).
 */
export function einteilungsName(stand: Pick<AppState, 'einteilung'>, liste: Liste): string {
  const nameIn = (parcoursId: string): string => {
    const eintrag = Object.hasOwn(stand.einteilung, parcoursId) ? stand.einteilung[parcoursId] : undefined
    const name = eintrag && Object.hasOwn(eintrag, liste.typeId) ? eintrag[liste.typeId] : ''
    return typeof name === 'string' ? name.trim() : ''
  }
  const eigen = nameIn(einteilungsParcours(liste))
  if (eigen !== '' || !istTischListe(liste)) return eigen
  // Am Tisch (W5.3, 22.11.2026, Auslegung beim Bau): Die Einteilung führt Knoten je Parcours – der erste eingetragene
  // Name gilt für die eine Liste am Tisch (ein „In Veranstaltung übernehmen“ schreibt unter `tisch`, das gilt zuerst).
  for (const parcoursId of Object.keys(stand.einteilung).sort()) {
    const name = nameIn(parcoursId)
    if (name !== '') return name
  }
  return ''
}

/** Die Kennung, unter der die Einteilung den Namen einer Liste führt (SET_WKR_NAME `parcoursId`). */
export function einteilungsParcours(liste: Liste): string {
  return liste.racecourse !== null ? RACECOURSE_PARCOURS[liste.racecourse] : liste.bereich
}

/**
 * Die Sicht einer Liste. `konfig` ist die des Stands (Aufbau, Klassen); Texte, Spaltenköpfe und Kataloge kommen in
 * der Sprache der Liste (eigene Konfiguration, configFor merkt sie sich). `extra`: je Gerät der Liste, was nur der
 * Host weiß – nur diese Geräte stehen in `geraete`, und nur ihre Rückfragen.
 */
export function sichtListe(stand: AppState, konfig: Konfig, liste: Liste, extra: ListenSichtExtra): ListenSicht {
  const kennung = listenKennung(liste)
  const parcoursId = liste.racecourse !== null ? RACECOURSE_PARCOURS[liste.racecourse] : liste.bereich
  const sprache = wkrSpracheFuer(stand, parcoursId, liste.typeId)
  const sprachKonfig = configFor({ regelwerk: stand.regelwerk, sprache, beschriftung: stand.beschriftung, eigeneAufbauten: stand.eigeneAufbauten })
  const texte = sprachKonfig.getBogenTexte()
  const bekannt = konfig.getPositions().some((p) => p.typeId === liste.typeId)
  const teile = teileVon(liste.typeId)

  const info = bereicheZumStand(stand).find((b) => b.id === liste.bereich)
  // Am Tisch (W5.3): kein Bereich des Betriebs – „Am Tisch“ in der Sprache der Liste.
  const tisch = istTischListe(liste)
  const bereich = tisch ? texte.tisch : liste.racecourse !== null ? texte.racecourse(liste.racecourse) : info ? texte.parcoursName(info.name) : liste.bereich
  const eintrag = Object.hasOwn(stand.wkr.listen, kennung) ? stand.wkr.listen[kennung] : undefined
  const l = lage(stand, liste.bereich)

  const starterNachId = new Map(stand.starters.map((s) => [s.id, s]))
  const start = (s: SchlangenStart): ListenStart => {
    const out: ListenStart = { key: s.key, startNr: starterNachId.get(s.starter)?.startNr ?? '', klasse: s.klasse, titel: startTitel(s.ref, texte), lauf: s.lauf, punkt: s.punkt }
    if (liste.racecourse !== null) out.seite = liste.racecourse
    const boot = stand.boote[s.klasse]?.trim()
    if (boot) out.boot = boot
    if (teile && s.teileOffen) out.teile = { ab: !s.teileOffen.ab, an: !s.teileOffen.an }
    else if (teile) {
      const w = werteVon(stand.eingaben, s.lauf, s.starter)
      const ganz = !!w[erfasstKennung(liste.typeId)]
      // Hier nur „danach“ (noch nicht gezeigt): Das Anlegen braucht davon noch nichts (nachlaufend, T2/T4) – auch ein
      // Gerät ohne Verbindung schätzt es nicht in die Schlange des Anlegens.
      const anSpaeter = WKR_ANNAHMEN.stegAnlegenNachlaufend && WKR_ANNAHMEN.stegAnlegenNieGeschaetzt
      out.teile = { ab: ganz || !!w[teilHaken(liste.typeId, 'ab')], an: ganz || !!w[teilHaken(liste.typeId, 'an')] || anSpaeter }
    }
    if (s.entfaellt) out.entfaellt = s.entfaellt
    if (s.vorab) out.vorab = true
    return out
  }
  const ganzeSchlange = bekannt ? schlange(stand, liste) : []
  const inSchlange = ganzeSchlange.slice(0, WKR_ANNAHMEN.schlange)
  const spaeter = bekannt ? danach(stand, liste) : []

  // Masken je Klasse: alle Klassen des Bereichs (die Folge) und der gezeigten Starts – auch ohne Netz muss das Gerät
  // die nächsten Klassen kennen.
  // Liste ohne Lauf (W5.3, KN3): der Bestand statt einer Schlange – erledigt = Haken (wie die Schlange, nicht „eigene
  // Werte“ wie lage.ts: das Gerät soll auch nach einer Eingabe am Bedienrechner noch schicken können).
  const bestand = tisch && bekannt
    ? bestandOhneLauf(stand, konfig, liste).map(({ key, start: b }): ListenBestand => {
        const w = werteVon(stand.eingaben, b.lauf, b.starter.id)
        return { key, startNr: b.starter.startNr, klasse: b.starter.klasse, erledigt: !!w[erfasstKennung(liste.typeId)] }
      })
    : []
  const klassenIds = [...l.folge.map((e) => e.klasse), ...inSchlange.map((s) => s.klasse), ...spaeter.map((s) => s.klasse), ...bestand.map((b) => b.klasse)]
  const xErlaubt = WKR_ANNAHMEN.xListen.includes(liste.typeId)
  const sprachen = maskenSprachen(stand.regelwerk, sprache)
  const konfigIn = (sp: Sprache) => (sp === sprache ? sprachKonfig : configFor({ regelwerk: stand.regelwerk, sprache: sp, beschriftung: stand.beschriftung, eigeneAufbauten: stand.eigeneAufbauten }))
  const klassen = maskenJeKlasse(konfig, konfigIn(sprachen.maske), liste.typeId, klassenIds, xErlaubt, stand.aufbau)

  const abgeschlossen = abgeschlossenePunkte(stand.wkr, kennung, undefined, !!teile)
  const punkt = tisch ? null : l.laufend
  // Abweichend aus allen Abschlüssen des laufenden Punkts (ganze Liste und Teile), ohne Doppelte.
  const abweichend =
    punkt !== null
      ? [...new Set([undefined, ...(teile ? TEILE : [])].flatMap((t) => abschlussVon(stand.wkr, kennung, punkt, t)?.abweichend ?? []))]
      : undefined

  const geraete: Record<string, ListenGeraet> = {}
  for (const id of Object.keys(extra.geraete).sort()) {
    const e = extra.geraete[id]
    const g: ListenGeraet = {
      bis: e.bis,
      rueckfragen: stand.wkr.rueckfragen
        .filter((r) => r.liste === kennung && geraetVonZeile(r.zeile) === id)
        .map((r) => ({ z: r.zeile.slice(id.length + 1), feld: r.feld, lauf: r.lauf, steht: r.steht })),
      abgelehnt: (e.abgelehnt ?? []).map((a) => ({ z: String(a.z), grund: a.grund })),
      hinweise: (e.hinweise ?? []).filter((h) => (WKR_HINWEISE as readonly string[]).includes(h.code)).map((h) => ({ id: h.id, code: h.code, ...(h.startNr !== undefined ? { startNr: h.startNr } : {}) })),
    }
    if (abweichend && abweichend.length > 0) g.abweichend = [...abweichend]
    geraete[id] = g
  }

  const sicht: ListenSicht = {
    lv: LISTEN_SICHT_FASSUNG,
    liste: kennung,
    titel: bekannt ? sprachKonfig.getSheetDef(liste.typeId).title : liste.typeId,
    bereich,
    sprache,
    modus: eintrag?.modus ?? 'papier',
    status: eintrag?.status ?? 'aktiv',
    punkt: tisch ? { id: OHNE_PUNKT, titel: texte.alleStarter } : punkt !== null ? { id: punkt, titel: punktTitel(stand, punkt, texte) } : null,
    abgeschlossen,
    schlange: inSchlange.map(start),
    danach: spaeter.map(start),
    klassen,
    geraete,
  }
  // WKR-Name aus der Einteilung (W3-13, WN1): nur dieser Liste, als Text neu (nie das Objekt der Einteilung).
  const name = einteilungsName(stand, liste)
  if (name !== '') sicht.wkrName = name
  if (tisch) {
    // Jedes Objekt neu (Feld für Feld, wie die ganze Sicht) – nie ein Name, nie ein Wert.
    sicht.bestand = bestand.map((b) => ({ key: b.key, startNr: b.startNr, klasse: b.klasse, erledigt: b.erledigt }))
    sicht.offen = { n: bestand.filter((b) => !b.erledigt).length, m: bestand.length }
  }
  // Parcours-Ampel (P-03, AM9) und „Lauf läuft noch“ (R6-10) – jedes Objekt neu, nur Kennung, Zustand, Startnummern.
  const aktuell = l.aktuell?.key ?? null
  if (bekannt && aktuell !== null && istParcoursListe(konfig, liste.typeId)) {
    const a = ampelImStand(stand, konfig, liste.bereich)
    if (a !== 'aus') sicht.ampel = { key: aktuell, ampel: a }
  }
  // Ein gezeigter Start, den diese Liste (bzw. ein Teil am Steg) noch nicht erledigt hat, ist unterwegs – auch der
  // letzte des Laufs auf dem Weg zum Anlegen (Prüfbefund 21.11.2026, R6-10).
  const lauf = tisch ? null : laufLage(stand, konfig, liste.bereich, (key) => ganzeSchlange.some((x) => x.key === key))
  if (lauf) sicht.laeuft = { punkt: lauf.punkt, unterwegs: [...lauf.unterwegs], offen: lauf.offen }
  if (sprachen.andere !== null) {
    const andereKonfig = konfigIn(sprachen.andere)
    const at = andereKonfig.getBogenTexte()
    sicht.andere = {
      sprache: sprachen.andere,
      titel: bekannt ? andereKonfig.getSheetDef(liste.typeId).title : liste.typeId,
      bereich: tisch ? at.tisch : liste.racecourse !== null ? at.racecourse(liste.racecourse) : info ? at.parcoursName(info.name) : liste.bereich,
      klassen: maskenTexte(maskenJeKlasse(konfig, andereKonfig, liste.typeId, klassenIds, xErlaubt)),
    }
  }
  if (teile) {
    // Status je Teil: Ist die ganze Liste pausiert/abgemeldet, gilt das für jeden Teil (Befund 21.11.2026: Ein Gerät für
    // den ganzen Steg meldete sich ab, die Sicht sagte je Teil weiter „aktiv“ – die Maske zeigte den nächsten Start).
    const teil = (t: 'ab' | 'an') => ({
      status: eintrag && eintrag.status !== 'aktiv' ? eintrag.status : (eintrag?.teile?.[t]?.status ?? 'aktiv'),
      abgeschlossen: abgeschlossenePunkte(stand.wkr, kennung, t, true),
    })
    sicht.teile = { ab: teil('ab'), an: teil('an') }
  }
  return sicht
}
