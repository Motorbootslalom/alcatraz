import type { AppState, CellKind, ClassId, PunktId, Sprache, StartRef, WkrStatus } from '../types'
import { configFor, type Konfig } from '../config/konfig'
import type { BogenTexte } from '../config/sprache'
import { bereicheZumStand, laeufeVonPunkt, lage, rundeVonPunkt } from '../betrieb/folge'
import { defFuerKlasse } from '../lib/bogen'
import { erfasstKennung, listenFelder, teilHaken, werteVon } from '../lib/eingaben'
import { wkrSpracheFuer } from '../lib/listensprache'
import { RACECOURSE_PARCOURS } from '../lib/parallelSchluessel'
import { geraetVonZeile } from '../state/reducer/wkr'
import { abgeschlossenePunkte, abschlussVon, TEILE } from './abschluss'
import { WKR_ANNAHMEN } from './annahmen'
import { listenKennung, teileVon, teilVonZelle, type Liste } from './liste'
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

/** Fassung der Sicht der Liste: zählt hoch, wenn sich ihre Form ändert (Geräte zeigen nur dieselbe Fassung). */
export const LISTEN_SICHT_FASSUNG = 2

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
   * Papier (Pause, Abschluss mit „Rest auf Papier“) bzw. sein Punkt abgeschlossen.
   */
  teile?: { ab: boolean; an: boolean }
  /** Die Klasse hat diese Liste nicht: grau „entfällt“. */
  entfaellt?: 'klasse'
  /** Noch nicht gezeigt, aber schon zu erfassen (Vorsteg). */
  vorab?: true
}

/** Ein Feld der Maske, aufgelöst für eine Klasse und in der Sprache der Liste. */
export interface MaskenFeld {
  kennung: string
  kind: CellKind
  label: string
  /** Teil der Liste (Steg: Ablegen/Anlegen); fehlt bei gemeinsamen Spalten und ungeteilten Listen. */
  teil?: 'ab' | 'an'
  /** Fehlerkatalog (nur `code`). */
  katalog?: { code: string; punkte: number; text: string }[]
  /** Disq.-Buchstaben, die hier gelten (`buoy`, `code`, `disq`); X nur, wo das Gerät es darf (F5). */
  disq?: { code: string; text: string }[]
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
  punkt: { id: PunktId; titel: string } | null
  /** Punkte, die für die ganze Liste abgeschlossen sind (am Steg: ganz oder beide Teile). */
  abgeschlossen: PunktId[]
  /** Nur geteilte Listen (Steg, F16): Status und abgeschlossene Punkte je Teil (der Abschluss der ganzen Liste zählt mit). */
  teile?: Record<'ab' | 'an', { status: WkrStatus; abgeschlossen: PunktId[] }>
  schlange: ListenStart[]
  danach: ListenStart[]
  /** Je Klasse die Maske; `null` = die Klasse hat diese Liste nicht (entfällt). */
  klassen: Partial<Record<ClassId, { titel: string; felder: MaskenFeld[] | null }>>
  geraete: Record<string, ListenGeraet>
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
  const bereich = liste.racecourse !== null ? texte.racecourse(liste.racecourse) : info ? texte.parcoursName(info.name) : liste.bereich
  const eintrag = Object.hasOwn(stand.wkr.listen, kennung) ? stand.wkr.listen[kennung] : undefined
  const l = lage(stand, liste.bereich)

  const starterNachId = new Map(stand.starters.map((s) => [s.id, s]))
  const start = (s: SchlangenStart): ListenStart => {
    const out: ListenStart = { key: s.key, startNr: starterNachId.get(s.starter)?.startNr ?? '', klasse: s.klasse, titel: startTitel(s.ref, texte), lauf: s.lauf }
    if (liste.racecourse !== null) out.seite = liste.racecourse
    const boot = stand.boote[s.klasse]?.trim()
    if (boot) out.boot = boot
    if (teile && s.teileOffen) out.teile = { ab: !s.teileOffen.ab, an: !s.teileOffen.an }
    else if (teile) {
      const w = werteVon(stand.eingaben, s.lauf, s.starter)
      const ganz = !!w[erfasstKennung(liste.typeId)]
      out.teile = { ab: ganz || !!w[teilHaken(liste.typeId, 'ab')], an: ganz || !!w[teilHaken(liste.typeId, 'an')] }
    }
    if (s.entfaellt) out.entfaellt = s.entfaellt
    if (s.vorab) out.vorab = true
    return out
  }
  const inSchlange = bekannt ? schlange(stand, liste).slice(0, WKR_ANNAHMEN.schlange) : []
  const spaeter = bekannt ? danach(stand, liste) : []

  // Masken je Klasse: alle Klassen des Bereichs (die Folge) und der gezeigten Starts – auch ohne Netz muss das Gerät
  // die nächsten Klassen kennen.
  const klassenIds = new Set<ClassId>([...l.folge.map((e) => e.klasse), ...inSchlange.map((s) => s.klasse), ...spaeter.map((s) => s.klasse)])
  const xErlaubt = WKR_ANNAHMEN.xListen.includes(liste.typeId)
  const klassen: ListenSicht['klassen'] = {}
  for (const k of [...klassenIds].sort()) {
    if (!bekannt || !konfig.positionAllowsClass(liste.typeId, k)) {
      klassen[k] = { titel: texte.klasse(k), felder: null }
      continue
    }
    const disqTabelle = defFuerKlasse(sprachKonfig.getSheetDef(liste.typeId), k).disqTable ?? []
    const felder = listenFelder(sprachKonfig, liste.typeId, k).map((f): MaskenFeld => {
      const out: MaskenFeld = { kennung: f.kennung, kind: f.kind, label: f.label }
      const teil = teilVonZelle(liste.typeId, f.zelle)
      if (teil === 'ab' || teil === 'an') out.teil = teil
      if (f.kind === 'code' && f.katalog) out.katalog = f.katalog.map((e) => ({ code: e.code, punkte: e.punkte, text: e.text }))
      if (f.kind === 'buoy' || f.kind === 'code' || f.kind === 'disq') {
        // X „nicht gestartet“ nur am Steg (Ablegen bzw. gemeinsame Spalte) und am Vorsteg (F5) – sonst lehnt der
        // Bedienrechner die Zeile ohnehin ab; die Maske bietet es gar nicht erst an.
        const xHier = xErlaubt && (!teile || teil === WKR_ANNAHMEN.xTeil || teil === 'gemeinsam')
        out.disq = disqTabelle.filter((d) => d.code !== 'X' || xHier).map((d) => ({ code: d.code, text: d.text }))
      }
      return out
    })
    klassen[k] = { titel: texte.klasse(k), felder }
  }

  const abgeschlossen = abgeschlossenePunkte(stand.wkr, kennung, undefined, !!teile)
  const punkt = l.laufend
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
    punkt: punkt !== null ? { id: punkt, titel: punktTitel(stand, punkt, texte) } : null,
    abgeschlossen,
    schlange: inSchlange.map(start),
    danach: spaeter.map(start),
    klassen,
    geraete,
  }
  if (teile) {
    const teil = (t: 'ab' | 'an') => ({ status: eintrag?.teile?.[t]?.status ?? 'aktiv', abgeschlossen: abgeschlossenePunkte(stand.wkr, kennung, t, true) })
    sicht.teile = { ab: teil('ab'), an: teil('an') }
  }
  return sicht
}
