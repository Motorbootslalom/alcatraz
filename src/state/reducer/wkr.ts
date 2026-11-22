// Digitale Erfassung durch die Wettkampfrichter (W1, Plan docs/plan-wkr-w1.md §4, 21.11.2026): Zeilen vom Gerät
// übernehmen, Rückfragen und Vorschläge entscheiden, Modus/Status und Abschluss je Liste; Normalisierer für migrate().
// W2 (Plan docs/plan-wkr-w2.md §4, 21.11.2026): „Papier ab Start …“ (WKR_PAPIER_AB, WkrPause.ab); Zeilen zu Starts,
// die schon aufs Papier gingen, werden Vorschlag (WKR_ANNAHMEN.papierStartVorschlag).
//
// Rein und deterministisch: Die Zeilen kommen geprüft und aufgelöst (wkr/zeile.ts `pruefeZeile` – das ruft der Host,
// nie der Reducer), IDs (`zeile.id`) und `zeit` mit der Action. Nichts aus geraete/. Unverändert = derselbe Stand.
// Werte gehen nur über `eingaben` (wie SET_EINGABEN); belegte Zellen werden nie still überschrieben (wkr/uebernahme.ts).

import type { AppState, Eingaben, KeineZeitGrund, WkrAbschluss, WkrPunkt, WkrListe, WkrModus, WkrPause, WkrRueckfrage, WkrStand, WkrStatus, WkrTeilStatus, WkrVorschlag, WkrZeile } from '../../types'
import { erfasstKennung, gueltigeZellen, istHaken, listenFelder, setzeWerte, werteVon, type EingabeZelle, type ListenTeil } from '../../lib/eingaben'
import { betriebVon, liesRef } from '../../betrieb/folge'
import { abschlussSchluessel, abschlussVon, istWkrPunkt, liesAbschlussSchluessel, OHNE_PUNKT, punktBegonnen, TEILE, wkrPunktVonRef, zeileAbgeschlossen } from '../../wkr/abschluss'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import { bestandOhneLauf, istTischListe, liesListe, liesStartKennung, startAufListe, teileVon, teilHaken, teilVonZelle } from '../../wkr/liste'
import { papierStarts, schlange } from '../../wkr/schlange'
import { vereinigt, wendeZeileAn, zeilenPruefsumme } from '../../wkr/uebernahme'
import { liesNvSchluessel, mitNichtVorbei, nvSchluessel } from '../../wkr/nichtVorbei'
import { keineZeitNur, liesKeineZeitFelder, mitKeineZeit, normalisiereKeineZeit } from '../../wkr/keineZeit'
import { konfigVon } from './gemeinsam'

export type WkrAenderung =
  /**
   * Zeilen eines Geräts für eine Liste übernehmen (`quelle`: Geräte-ID und Name – der Name nur für den Verlauf, F10;
   * in den Stand kommt er nie). Je Zeile: Punkt abgeschlossen, Liste auf Papier oder Start schon auf Papier (P der Liste
   * bzw. des Teils, W2 A6) → Vorschlag; Start nicht gezeigt →
   * Rückfrage `start` für jede Zelle; sonst Übernahmeregel (wkr/uebernahme.ts), Konflikte → Rückfrage; Haken nur ohne
   * Konflikt. Eine neuere Zeile desselben Geräts für dieselbe Zelle ersetzt dessen ältere Rückfrage.
   */
  | { type: 'WKR_ZEILEN'; liste: string; quelle: { geraet: string; name: string }; zeilen: WkrZeile[] }
  /** Rückfrage entscheiden: Gerätewert setzen bzw. Stand behalten. Ist es die letzte der Zeile, kommen ihre Haken. */
  | { type: 'WKR_RUECKFRAGE'; id: string; wahl: 'geraet' | 'behalten' }
  /** Vorschlag übernehmen (Zellen und Haken setzen, ohne Bedingung – der Bediener entscheidet) bzw. verwerfen. */
  | { type: 'WKR_VORSCHLAG'; id: string; wahl: 'uebernehmen' | 'verwerfen' }
  /**
   * Modus und/oder Status einer Liste. `pausiert`/`abgemeldet` öffnet eine Pause, deren P die jetzige Schlange ist;
   * `aktiv` schließt sie. Der erste Wechsel von Papier auf digital/beides setzt `seit`. `nurWennFehlt`: nur, wenn die
   * Liste noch keinen Eintrag hat (erstes Koppeln, WKR_ANNAHMEN.modusBeimKoppeln). `teil` (nur geteilte Listen, nur mit
   * `status`): Status und Pause nur dieses Teils – ein Teil-Gerät am Steg pausiert nie den anderen Teil
   * (WKR_ANNAHMEN.pauseJeTeil); ohne Eintrag der Liste ändert er nichts.
   */
  | { type: 'WKR_LISTE'; liste: string; modus?: WkrModus; status?: WkrStatus; nurWennFehlt?: boolean; teil?: ListenTeil }
  /**
   * „Liste abschließen“ für einen Punkt (F7, F8): Name des WKR, je Start die Prüfsumme der geprüften Zeile
   * (wkr/uebernahme.ts `zeilenPruefsumme`). Offene Starts nur mit `restPapier` (sie gehen aufs Papier), sonst ändert
   * sich nichts. `teil`: ein Gerät für einen Teil des Stegs schließt seinen Teil ab (Prüfsumme über dessen Spalten),
   * eigener Eintrag (wkr/abschluss.ts) – der andere Teil bleibt offen. Nur für einen Punkt, der im Bereich begonnen
   * hat (wkr/abschluss.ts `punktBegonnen`), sonst ändert sich nichts. `papier` = offene Starts (mit `restPapier`) und
   * die Starts des Punkts, die schon über eine Pause aufs Papier gingen und noch keinen Haken haben. Liste am Tisch
   * (ohne Lauf, W5.3, 22.11.2026, KN5): nur Punkt `ohne`, die ganze Liste; offen = Starter des Bestands ohne Haken.
   */
  | { type: 'WKR_ABSCHLUSS'; liste: string; punkt: WkrPunkt; name: string; pruefsummen: Record<string, string>; restPapier: boolean; teil?: ListenTeil }
  /** Abschluss zurücknehmen (für W2: Bediener), am Steg je Teil. */
  | { type: 'WKR_ABSCHLUSS_LOESEN'; liste: string; punkt: WkrPunkt; teil?: ListenTeil }
  /**
   * W2 „Papier ab Start …“ (Bediener, WKR_ANNAHMEN.papierAbMeldetAb): Die Liste (bzw. der Steg-Teil) wird ab dem Start
   * `ref` vom Bogen erfasst – Status `abgemeldet`, Pause ab der Zeit, zu der `ref` gezeigt wurde (sonst jetzt), mit
   * `ab: ref` und P = die Schlange ab `ref`. Ist schon eine Pause offen, bekommt sie `ab` und die Starts dazu. Ohne
   * Eintrag oder bei Papier: nichts. „Weiter digital“ bleibt WKR_LISTE {status: 'aktiv'}.
   */
  | { type: 'WKR_PAPIER_AB'; liste: string; ref: string; teil?: ListenTeil }
  /**
   * „So lassen“ auf dem Gerät (Nutzer 21.11.2026, W3-35, WKR_ANNAHMEN GF5): vermerkt an allen offenen Rückfragen der
   * Zeile `zeile` (`${geraetId}.${z}`, der Host setzt die Geräte-ID aus dem Register) dieser Liste die Zeit. Entscheidet
   * nichts – die Rückfrage bleibt offen. Schon vermerkt oder keine Rückfrage: unverändert (dieselbe Referenz).
   */
  | { type: 'WKR_SO_LASSEN'; liste: string; zeile: string }

/** Nichts digital, nichts offen. */
export function wkrLeer(): WkrStand {
  return { listen: {}, rueckfragen: [], vorschlaege: [], abschluss: {}, nichtVorbei: {}, keineZeit: {} }
}

const MODI: readonly WkrModus[] = ['digital', 'papier', 'beides']
const STATI: readonly WkrStatus[] = ['aktiv', 'pausiert', 'abgemeldet']

/** Die Geräte-ID einer Zeilen-Kennung (`${geraetId}.${z}`). */
export function geraetVonZeile(zeile: string): string {
  const i = zeile.lastIndexOf('.')
  return i < 0 ? zeile : zeile.slice(0, i)
}

const punktVon = wkrPunktVonRef

/**
 * „Papier ab“ auf Status und Pausen anwenden (ganze Liste bzw. Teil): neue Pause oder die offene ergänzt. `null`, wenn
 * sich nichts ändert.
 */
function papierAb<T extends { status: WkrStatus; pausen: WkrPause[] }>(alt: T, ref: string, von: number, papier: readonly string[]): T | null {
  const offen = alt.status !== 'aktiv' ? alt.pausen.findIndex((p) => p.bis === null) : -1
  if (offen < 0) return { ...alt, status: 'abgemeldet', pausen: [...alt.pausen, { von, bis: null, papier: [...papier], ab: ref }] }
  const p = alt.pausen[offen]
  const neuPapier = [...new Set([...p.papier, ...papier])]
  if (alt.status === 'abgemeldet' && p.ab === ref && neuPapier.length === p.papier.length) return null
  const pausen = alt.pausen.map((x, i) => (i === offen ? { ...x, papier: neuPapier, ab: ref } : x))
  return { ...alt, status: 'abgemeldet', pausen }
}

/** Zellen in Lauf und weitere Läufe, nur gültige (wie SET_EINGABEN). */
function zellenIn(stand: AppState, laeufe: readonly string[], starter: string, werte: readonly { feld: string; wert: string }[]): EingabeZelle[] {
  const zellen = laeufe.flatMap((lauf) => werte.map((w) => ({ lauf, starter, feld: w.feld, wert: w.wert })))
  return gueltigeZellen(zellen, new Set(stand.starters.map((s) => s.id)))
}

/**
 * Die Haken setzen (in Lauf und weiteren Läufen). Stehen danach beide Teilhaken einer Liste da, auch deren ganzen
 * Haken (WKR_ANNAHMEN.teile: Ablegen und Anlegen erfasst = Steg erfasst).
 */
function mitHaken(stand: AppState, eingaben: Eingaben, laeufe: readonly string[], starter: string, haken: readonly string[]): Eingaben {
  let out = setzeWerte(eingaben, zellenIn(stand, laeufe, starter, haken.map((feld) => ({ feld, wert: '1' }))))
  for (const typeId of Object.keys(WKR_ANNAHMEN.teile)) {
    const ganz = erfasstKennung(typeId)
    for (const lauf of laeufe) {
      const w = werteVon(out, lauf, starter)
      if (!w[ganz] && w[teilHaken(typeId, 'ab')] && w[teilHaken(typeId, 'an')]) out = setzeWerte(out, zellenIn(stand, [lauf], starter, [{ feld: ganz, wert: '1' }]))
    }
  }
  return out
}

/** Eine Rückfrage aufnehmen; gibt es sie (gleiche Kennung) schon, bleibt die erste – eine doppelte Zeile ändert nichts. */
function mitRueckfrage(liste: WkrRueckfrage[], rf: WkrRueckfrage): WkrRueckfrage[] {
  return liste.some((x) => x.id === rf.id) ? liste : [...liste, rf]
}

/** Ist die Liste am Steg geteilt (Schlüssel des Kennzeichens mit Teil)? */
function istGeteilt(liste: string): boolean {
  const l = liesListe(liste)
  return !!l && !!teileVon(l.typeId)
}

/**
 * Was eine geltende Zeile mit dem Kennzeichen „nicht vorbeigekommen“ macht (W4.3, R2/R3): mit Kennzeichen setzen,
 * ohne aufheben – am Steg je Teil, eine ganze Steg-Zeile hebt auch das des Anlegens auf. Unverändert = dasselbe Objekt.
 */
function nvWirkung(
  nv: WkrStand['nichtVorbei'],
  liste: string,
  geteilt: boolean,
  z: { lauf: string; starter: string; nichtVorbei?: true; teil?: ListenTeil },
): WkrStand['nichtVorbei'] {
  const teil = geteilt ? z.teil : undefined
  if (z.nichtVorbei) return mitNichtVorbei(nv, liste, nvSchluessel(z.lauf, z.starter, teil), true)
  let out = mitNichtVorbei(nv, liste, nvSchluessel(z.lauf, z.starter, teil), false)
  if (geteilt && teil === undefined) out = mitNichtVorbei(out, liste, nvSchluessel(z.lauf, z.starter, 'an'), false)
  return out
}

/**
 * „Keine Zeit“ einer geltenden Zeile (W5.4, ZT4): trägt sie `keineZeit`, ersetzt es das Kennzeichen des Starts (leer =
 * aufheben); ohne bleibt das stehende. Gleiche Stellen wie {@link nvWirkung}: direkt, Rückfrage für das Gerät, Vorschlag
 * übernommen. Unverändert = dasselbe Objekt.
 */
function kzWirkung(kz: WkrStand['keineZeit'], liste: string, z: { lauf: string; starter: string; keineZeit?: Record<string, KeineZeitGrund> }): WkrStand['keineZeit'] {
  return z.keineZeit ? mitKeineZeit(kz, liste, z.lauf, z.starter, z.keineZeit) : kz
}

export function wendeWkrAn(state: AppState, action: WkrAenderung & { zeit?: number }): AppState {
  const zeit = action.zeit ?? 0
  switch (action.type) {
    case 'WKR_ZEILEN': {
      const zielListe = liesListe(action.liste)
      if (!zielListe) return state
      const geteilt = !!teileVon(zielListe.typeId)
      const eintrag = state.wkr.listen[action.liste]
      const papier = !eintrag || eintrag.modus === 'papier'
      const starter = new Set(state.starters.map((s) => s.id))
      let eingaben = state.eingaben
      let rueckfragen = state.wkr.rueckfragen
      let vorschlaege = state.wkr.vorschlaege
      let nichtVorbei = state.wkr.nichtVorbei
      let keineZeit = state.wkr.keineZeit
      // P je Teil (A6): Starts, die schon aufs Papier gingen – einmal je Teil gerechnet. Eine ganze Zeile einer
      // geteilten Liste trifft es schon, wenn EIN Teil den Start auf Papier hat (wie zeileAbgeschlossen).
      const pJe = new Map<ListenTeil | undefined, Set<string>>()
      const pVon = (t: ListenTeil | undefined): Set<string> => {
        let m = pJe.get(t)
        if (!m) {
          const teile = t === undefined && geteilt ? [undefined, ...TEILE] : [t]
          pJe.set(t, (m = new Set(teile.flatMap((x) => papierStarts(state, zielListe, x)))))
        }
        return m
      }
      for (const zeile of action.zeilen) {
        if (zeile.liste !== action.liste) continue
        // Zellen ungültiger Starter oder kaputter Lauf-Schlüssel kommen nicht in den Stand (wie SET_EINGABEN).
        const laeufe = [zeile.lauf, ...zeile.weitere]
        if (gueltigeZellen(laeufe.map((lauf) => ({ lauf, starter: zeile.starter, feld: 'x', wert: '' })), starter).length !== laeufe.length) continue
        const punkt = punktVon(state, zeile.ref)
        if (punkt === null) continue
        // Am Steg je Teil (F16): Hat das Ablegen abgeschlossen, gehen Zeilen des Anlegens weiter direkt durch.
        // „Nicht vorbeigekommen“ (W4.3, R2/R3): Kennzeichen setzen bzw. („doch vorbei“) aufheben nur, wo die Zeile direkt
        // gilt; Rückfrage und Vorschlag tragen es mit und wirken erst mit der Entscheidung für das Gerät (Prüfbefund
        // 21.11.2026: ein verworfener Vorschlag ließ ⊘ sonst still verschwinden).
        const nv = {
          ...(zeile.nichtVorbei ? { nichtVorbei: true as const } : {}),
          ...(geteilt && zeile.teil ? { teil: zeile.teil } : {}),
          // „Keine Zeit“ (W5.4, ZT4) reist wie das Kennzeichen „nicht vorbeigekommen“ mit Rückfrage und Vorschlag.
          ...(zeile.keineZeit ? { keineZeit: zeile.keineZeit } : {}),
        }
        const wirke = () => {
          nichtVorbei = nvWirkung(nichtVorbei, action.liste, geteilt, { lauf: zeile.lauf, starter: zeile.starter, ...nv })
          keineZeit = kzWirkung(keineZeit, action.liste, { lauf: zeile.lauf, starter: zeile.starter, ...nv })
        }
        const abgeschlossen = zeileAbgeschlossen(state.wkr, action.liste, punkt, zeile.teil, geteilt)
        const aufPapier = papier || (WKR_ANNAHMEN.papierStartVorschlag && pVon(zeile.teil).has(zeile.ref))
        if (aufPapier || abgeschlossen) {
          if (vorschlaege.some((v) => v.id === zeile.id)) continue
          const v: WkrVorschlag = {
            id: zeile.id,
            liste: action.liste,
            ref: zeile.ref,
            lauf: zeile.lauf,
            weitere: zeile.weitere,
            starter: zeile.starter,
            zellen: zeile.zellen.map(({ feld, wert }) => ({ feld, wert })),
            haken: zeile.haken,
            grund: abgeschlossen ? 'abgeschlossen' : 'papier',
            ...nv,
            zeit,
          }
          vorschlaege = [...vorschlaege, v]
          continue
        }
        const geraet = geraetVonZeile(zeile.id)
        // Eine neuere Zeile desselben Geräts für dieselbe Zelle ersetzt dessen ältere Rückfrage.
        const felder = new Set([...zeile.zellen.map((z) => z.feld), ...zeile.haken])
        const ohneAlte = rueckfragen.filter((rf) => !(rf.zeile !== zeile.id && geraetVonZeile(rf.zeile) === geraet && rf.lauf === zeile.lauf && rf.starter === zeile.starter && felder.has(rf.feld)))
        if (ohneAlte.length !== rueckfragen.length) rueckfragen = ohneAlte
        const rueckfrage = (feld: string, wert: string, steht: string, grund: WkrRueckfrage['grund'], vereinige?: { vorher: string }): WkrRueckfrage => ({
          id: `${zeile.id}|${zeile.lauf}|${zeile.starter}|${feld}`,
          zeile: zeile.id,
          liste: action.liste,
          ref: zeile.ref,
          lauf: zeile.lauf,
          weitere: zeile.weitere,
          starter: zeile.starter,
          feld,
          wert,
          steht,
          grund,
          ...(vereinige ? { vereinige } : {}),
          haken: zeile.haken,
          ...nv,
          zeit,
        })
        if (!zeile.gezeigt && WKR_ANNAHMEN.nichtGezeigtRueckfrage) {
          // Nicht gezeigt (auch ohne Netz geschätzt): die ganze Zeile als Rückfrage, die Haken eingeschlossen.
          // Gemeinsame Zellen des Stegs (Disq., Bemerkung) behalten dabei die Vereinigung: Die Rückfrage merkt sich
          // `vorher`, entschieden wird gegen das dann Stehende (WKR_RUECKFRAGE) – nie fällt der Wert des anderen Teils weg.
          const werte = werteVon(eingaben, zeile.lauf, zeile.starter)
          for (const z of [...zeile.zellen, ...zeile.haken.map((feld) => ({ feld, wert: '1', vorher: '', vereinige: undefined }))]) {
            const steht = werte[z.feld] ?? ''
            const ziel = z.vereinige ? vereinigt(z.feld, steht, z.wert, z.vorher) : z.wert
            if (steht !== ziel) rueckfragen = mitRueckfrage(rueckfragen, rueckfrage(z.feld, z.wert, steht, 'start', z.vereinige ? { vorher: z.vorher } : undefined))
          }
          // Steht schon alles so (nichts zu fragen), gilt die Zeile wie direkt übernommen.
          if (!rueckfragen.some((rf) => rf.zeile === zeile.id)) wirke()
          continue
        }
        const r = wendeZeileAn(eingaben, zeile)
        eingaben = r.eingaben
        for (const k of r.konflikte) rueckfragen = mitRueckfrage(rueckfragen, rueckfrage(k.feld, k.wert, k.steht, k.grund))
        if (r.konflikte.length === 0 && !rueckfragen.some((rf) => rf.zeile === zeile.id)) {
          eingaben = mitHaken(state, eingaben, laeufe, zeile.starter, zeile.haken)
          // Kennzeichen nur, wo die Zeile direkt übernommen wird (WKR_ANNAHMEN.nichtVorbeiNurDirekt, R2): Der Haken ist
          // gesetzt (Schlange und Rückstand gehen weiter), die Matrix zeigt ⊘ statt ✓. Ohne Kennzeichen: aufheben (R3).
          wirke()
        }
      }
      if (eingaben === state.eingaben && rueckfragen === state.wkr.rueckfragen && vorschlaege === state.wkr.vorschlaege && nichtVorbei === state.wkr.nichtVorbei && keineZeit === state.wkr.keineZeit) return state
      return { ...state, eingaben, wkr: { ...state.wkr, rueckfragen, vorschlaege, nichtVorbei, keineZeit } }
    }

    case 'WKR_RUECKFRAGE': {
      const rf = state.wkr.rueckfragen.find((x) => x.id === action.id)
      if (!rf) return state
      const laeufe = [rf.lauf, ...rf.weitere]
      // Gemeinsame Zelle des Stegs: mit dem vereinigen, was JETZT steht (der andere Teil kann inzwischen geschrieben haben).
      const wert = rf.vereinige ? vereinigt(rf.feld, werteVon(state.eingaben, rf.lauf, rf.starter)[rf.feld] ?? '', rf.wert, rf.vereinige.vorher) : rf.wert
      let eingaben = action.wahl === 'geraet' ? setzeWerte(state.eingaben, zellenIn(state, laeufe, rf.starter, [{ feld: rf.feld, wert }])) : state.eingaben
      const rueckfragen = state.wkr.rueckfragen.filter((x) => x.id !== rf.id)
      if (!rueckfragen.some((x) => x.zeile === rf.zeile)) eingaben = mitHaken(state, eingaben, laeufe, rf.starter, rf.haken)
      // Für das Gerät entschieden: das Kennzeichen der Zeile gilt (setzen bzw. „doch vorbei“ aufheben, R2/R3).
      const nichtVorbei = action.wahl === 'geraet' ? nvWirkung(state.wkr.nichtVorbei, rf.liste, istGeteilt(rf.liste), rf) : state.wkr.nichtVorbei
      const keineZeit = action.wahl === 'geraet' ? kzWirkung(state.wkr.keineZeit, rf.liste, rf) : state.wkr.keineZeit
      return { ...state, eingaben, wkr: { ...state.wkr, rueckfragen, nichtVorbei, keineZeit } }
    }

    case 'WKR_SO_LASSEN': {
      if (action.zeit === undefined) return state
      const zeit = action.zeit
      let neu = false
      const rueckfragen = state.wkr.rueckfragen.map((rf) => {
        if (rf.zeile !== action.zeile || rf.liste !== action.liste || rf.soLassen !== undefined) return rf
        neu = true
        return { ...rf, soLassen: zeit }
      })
      return neu ? { ...state, wkr: { ...state.wkr, rueckfragen } } : state
    }

    case 'WKR_VORSCHLAG': {
      const v = state.wkr.vorschlaege.find((x) => x.id === action.id)
      if (!v) return state
      const laeufe = [v.lauf, ...v.weitere]
      const eingaben =
        action.wahl === 'uebernehmen' ? mitHaken(state, setzeWerte(state.eingaben, zellenIn(state, laeufe, v.starter, v.zellen)), laeufe, v.starter, v.haken) : state.eingaben
      // Übernommen: das Kennzeichen der Zeile gilt; verworfen: alles bleibt, wie es war – auch ein stehendes ⊘ (R3).
      const nichtVorbei = action.wahl === 'uebernehmen' ? nvWirkung(state.wkr.nichtVorbei, v.liste, istGeteilt(v.liste), v) : state.wkr.nichtVorbei
      const keineZeit = action.wahl === 'uebernehmen' ? kzWirkung(state.wkr.keineZeit, v.liste, v) : state.wkr.keineZeit
      return { ...state, eingaben, wkr: { ...state.wkr, vorschlaege: state.wkr.vorschlaege.filter((x) => x !== v), nichtVorbei, keineZeit } }
    }

    case 'WKR_LISTE': {
      const liste = liesListe(action.liste)
      if (!liste) return state
      if (action.modus !== undefined && !MODI.includes(action.modus)) return state
      if (action.status !== undefined && !STATI.includes(action.status)) return state
      const alt = state.wkr.listen[action.liste]
      if (alt && action.nurWennFehlt) return state
      if (action.teil !== undefined) {
        // Ein Teil des Stegs (F16 mit F1): nur Status und Pause dieses Teils; P = die jetzige Schlange des Teils.
        if (!teileVon(liste.typeId) || (action.teil !== 'ab' && action.teil !== 'an') || action.modus !== undefined || action.status === undefined || !alt) return state
        const teilAlt: WkrTeilStatus = alt.teile?.[action.teil] ?? { status: 'aktiv', pausen: [] }
        if (teilAlt.status === action.status) return state
        let teilNeu: WkrTeilStatus
        if (action.status === 'aktiv') teilNeu = { status: 'aktiv', pausen: teilAlt.pausen.map((p) => (p.bis === null ? { ...p, bis: zeit } : p)) }
        else if (teilAlt.status === 'aktiv') {
          // P mit dem Anlegen des Starts im Boot (Prüfbefund 21.11.2026): Er kommt während der Pause zurück, das Anlegen
          // steht dann auf dem Papier – sonst fiele es nach „Weiter“ wieder offen in die Schlange (WKR_ANNAHMEN T9).
          const papier = schlange(state, liste, action.teil, { nachlaufend: false }).filter((s) => !s.vorab && !s.entfaellt).map((s) => s.key)
          teilNeu = { status: action.status, pausen: [...teilAlt.pausen, { von: zeit, bis: null, papier }] }
        } else teilNeu = { ...teilAlt, status: action.status }
        const neuEintrag: WkrListe = { ...alt, teile: { ...alt.teile, [action.teil]: teilNeu } }
        return { ...state, wkr: { ...state.wkr, listen: { ...state.wkr.listen, [action.liste]: neuEintrag } } }
      }
      let neu: WkrListe = alt ?? { modus: 'papier', status: 'aktiv', seit: 0, pausen: [] }
      if (action.modus !== undefined && action.modus !== neu.modus) {
        // Von Papier auf digital (oder beides): Die Schlange beginnt jetzt (WKR_ANNAHMEN.ohneEintragPapier).
        neu = { ...neu, modus: action.modus, seit: neu.modus === 'papier' && action.modus !== 'papier' ? zeit : neu.seit }
      }
      if (action.status !== undefined && action.status !== neu.status) {
        if (action.status === 'aktiv') {
          neu = { ...neu, status: 'aktiv', pausen: neu.pausen.map((p) => (p.bis === null ? { ...p, bis: zeit } : p)) }
        } else if (neu.status === 'aktiv') {
          // P: was jetzt in der Schlange offen ist, geht aufs Papier (WKR_ANNAHMEN.pauseJeListe).
          // Mit dem Anlegen des Starts im Boot (Prüfbefund 21.11.2026, WKR_ANNAHMEN.stegAbschlussOhneImBoot).
          const papier = schlange(state, liste, undefined, { nachlaufend: false }).filter((s) => !s.vorab && !s.entfaellt).map((s) => s.key)
          neu = { ...neu, status: action.status, pausen: [...neu.pausen, { von: zeit, bis: null, papier }] }
        } else {
          neu = { ...neu, status: action.status }
        }
      }
      if (neu === alt) return state
      return { ...state, wkr: { ...state.wkr, listen: { ...state.wkr.listen, [action.liste]: neu } } }
    }

    case 'WKR_ABSCHLUSS': {
      const liste = liesListe(action.liste)
      const name = typeof action.name === 'string' ? action.name.trim() : ''
      if (!liste || !istWkrPunkt(action.punkt) || name === '' || name.length > WKR_ANNAHMEN.nameMax) return state
      if (action.teil !== undefined && (!teileVon(liste.typeId) || (action.teil !== 'ab' && action.teil !== 'an'))) return state
      const tisch = istTischListe(liste)
      // Am Tisch nur die ganze Liste (`ohne`); sonst nur Punkte des Betriebs, die begonnen haben.
      if (tisch !== (action.punkt === OHNE_PUNKT)) return state
      if (!tisch && (action.punkt === OHNE_PUNKT || !punktBegonnen(state, liste.bereich, action.punkt))) return state
      const konfig = konfigVon(state)
      const haken = [erfasstKennung(liste.typeId), ...(action.teil !== undefined ? [teilHaken(liste.typeId, action.teil)] : [])]
      // Das Anlegen des Starts im Boot zählt nicht als offen (WKR_ANNAHMEN.stegAbschlussOhneImBoot) – wie die Prüfansicht
      // des Geräts, die ihn nicht kennt. Am Tisch: die Starter des Bestands ohne Haken (wie die Sicht, KN3/KN5) – nur,
      // solange die Liste digital und aktiv ist (sonst sind sie ohnehin Papier, wie die leere Schlange).
      const eintrag = state.wkr.listen[action.liste]
      const offen = tisch
        ? eintrag && eintrag.modus !== 'papier' && eintrag.status === 'aktiv'
          ? bestandOhneLauf(state, konfig, liste)
              .filter(({ start }) => !haken.some((h) => !!werteVon(state.eingaben, start.lauf, start.starter.id)[h]))
              .map(({ key }) => key)
          : []
        : schlange(state, liste, action.teil)
            .filter((s) => !s.vorab && !s.entfaellt && s.punkt === action.punkt)
            .map((s) => s.key)
      if (offen.length > 0 && !action.restPapier) return state
      // Was schon über eine Pause aufs Papier ging (auch bei pausierter Liste, deren Schlange leer ist) und noch keinen
      // Haken hat, nennt der Abschluss mit – so sieht W2, welche Starts dieses Punkts vom Bogen kommen.
      const ausPause = papierStarts(state, liste, action.teil).filter((key) => {
        const ref = liesStartKennung(key, liesRef)
        const start = ref ? startAufListe(state, konfig, liste, ref) : null
        if (!start || start.punkt !== action.punkt) return false
        const w = werteVon(state.eingaben, start.lauf, start.starter.id)
        return !haken.some((h) => !!w[h])
      })
      const papier = [...new Set([...offen, ...ausPause])]
      const abweichend: string[] = []
      for (const [key, summe] of Object.entries(action.pruefsummen ?? {})) {
        const ref = liesStartKennung(key, liesRef)
        const start = ref ? startAufListe(state, konfig, liste, ref) : null
        if (!start || start.punkt !== action.punkt || typeof summe !== 'string' || !konfig.positionAllowsClass(liste.typeId, start.starter.klasse)) continue
        const felder = listenFelder(konfig, liste.typeId, start.starter.klasse)
          .filter((f) => action.teil === undefined || teilVonZelle(liste.typeId, f.zelle) === action.teil)
          .map((f) => f.kennung)
        if (zeilenPruefsumme(werteVon(state.eingaben, start.lauf, start.starter.id), felder) !== summe) abweichend.push(key)
      }
      const abschluss: WkrAbschluss = { name, zeit, abweichend, papier }
      const schluessel = abschlussSchluessel(action.punkt, action.teil)
      return {
        ...state,
        wkr: { ...state.wkr, abschluss: { ...state.wkr.abschluss, [action.liste]: { ...state.wkr.abschluss[action.liste], [schluessel]: abschluss } } },
      }
    }

    case 'WKR_PAPIER_AB': {
      const liste = liesListe(action.liste)
      const alt = state.wkr.listen[action.liste]
      if (!liste || !alt || alt.modus === 'papier' || liesRef(action.ref) === null) return state
      if (action.teil !== undefined && (!teileVon(liste.typeId) || (action.teil !== 'ab' && action.teil !== 'an'))) return state
      const gezeigt = betriebVon(state, liste.bereich).gezeigt.find((g) => g.ref === action.ref)
      const von = gezeigt?.zeit ?? zeit
      // P = die Schlange ab dem Start: er selbst und was danach gezeigt wurde (Vorsteg-Vorschau und „entfällt“ nicht),
      // samt dem Anlegen des Starts im Boot (Prüfbefund 21.11.2026, WKR_ANNAHMEN.stegAbschlussOhneImBoot).
      const papier = schlange(state, liste, action.teil, { nachlaufend: false })
        .filter((s) => !s.vorab && !s.entfaellt && (s.key === action.ref || (s.zeit !== undefined && s.zeit >= von)))
        .map((s) => s.key)
      if (action.teil !== undefined) {
        const teilAlt: WkrTeilStatus = alt.teile?.[action.teil] ?? { status: 'aktiv', pausen: [] }
        const teilNeu = papierAb(teilAlt, action.ref, von, papier)
        if (!teilNeu) return state
        return { ...state, wkr: { ...state.wkr, listen: { ...state.wkr.listen, [action.liste]: { ...alt, teile: { ...alt.teile, [action.teil]: teilNeu } } } } }
      }
      const neu = papierAb(alt, action.ref, von, papier)
      return neu ? { ...state, wkr: { ...state.wkr, listen: { ...state.wkr.listen, [action.liste]: neu } } } : state
    }

    case 'WKR_ABSCHLUSS_LOESEN': {
      if (!istWkrPunkt(action.punkt) || !abschlussVon(state.wkr, action.liste, action.punkt, action.teil)) return state
      const jeListe = state.wkr.abschluss[action.liste]
      const { [abschlussSchluessel(action.punkt, action.teil)]: _weg, ...rest } = jeListe
      const abschluss = { ...state.wkr.abschluss }
      if (Object.keys(rest).length > 0) abschluss[action.liste] = rest
      else delete abschluss[action.liste]
      return { ...state, wkr: { ...state.wkr, abschluss } }
    }
  }
}

// --- Aufräumen (Werte löschen, Starter entfernen) --------------------------------------------------

/**
 * Ohne die Rückfragen, Vorschläge und Abschlüsse gelöschter Läufe (`wegLauf` je Lauf-Schlüssel, `wegPunkt` je
 * Punkt). Modus und Status der Listen bleiben. Unverändert = dasselbe Objekt.
 */
export function wkrOhneLaeufe(wkr: WkrStand, wegLauf: (lauf: string) => boolean, wegPunkt: (punkt: WkrPunkt) => boolean): WkrStand {
  const rueckfragen = wkr.rueckfragen.filter((rf) => !wegLauf(rf.lauf))
  const vorschlaege = wkr.vorschlaege.filter((v) => !wegLauf(v.lauf))
  let abschlussGeaendert = false
  const abschluss: WkrStand['abschluss'] = {}
  for (const [liste, jePunkt] of Object.entries(wkr.abschluss)) {
    const bleibt = Object.entries(jePunkt).filter(([k]) => {
      const s = liesAbschlussSchluessel(k)
      return !s || !wegPunkt(s.punkt)
    })
    if (bleibt.length !== Object.keys(jePunkt).length) abschlussGeaendert = true
    if (bleibt.length > 0) abschluss[liste] = Object.fromEntries(bleibt)
  }
  const nichtVorbei = nvNur(wkr.nichtVorbei, (z) => !wegLauf(z.lauf))
  const keineZeit = keineZeitNur(wkr.keineZeit, (z) => !wegLauf(z.lauf))
  if (rueckfragen.length === wkr.rueckfragen.length && vorschlaege.length === wkr.vorschlaege.length && !abschlussGeaendert && nichtVorbei === wkr.nichtVorbei && keineZeit === wkr.keineZeit) return wkr
  return { ...wkr, rueckfragen, vorschlaege, abschluss: abschlussGeaendert ? abschluss : wkr.abschluss, nichtVorbei, keineZeit }
}

/** Nur die Kennzeichen „nicht vorbeigekommen“, deren Zelle `bleibt`; unverändert = dasselbe Objekt. */
function nvNur(nv: WkrStand['nichtVorbei'], bleibt: (z: { lauf: string; starter: string }) => boolean): WkrStand['nichtVorbei'] {
  let geaendert = false
  const out: WkrStand['nichtVorbei'] = {}
  for (const [liste, keys] of Object.entries(nv)) {
    const rest = keys.filter((k) => {
      const z = liesNvSchluessel(k)
      return !!z && bleibt(z)
    })
    if (rest.length !== keys.length) geaendert = true
    if (rest.length > 0) out[liste] = rest
  }
  return geaendert ? out : nv
}

/** Nur Rückfragen und Vorschläge der genannten Starter: Wer gelöscht ist, nimmt seine mit. Unverändert = dasselbe Objekt. */
export function wkrNurStarter(wkr: WkrStand, ids: ReadonlySet<string>): WkrStand {
  const rueckfragen = wkr.rueckfragen.filter((rf) => ids.has(rf.starter))
  const vorschlaege = wkr.vorschlaege.filter((v) => ids.has(v.starter))
  const nichtVorbei = nvNur(wkr.nichtVorbei, (z) => ids.has(z.starter))
  const keineZeit = keineZeitNur(wkr.keineZeit, (z) => ids.has(z.starter))
  if (rueckfragen.length === wkr.rueckfragen.length && vorschlaege.length === wkr.vorschlaege.length && nichtVorbei === wkr.nichtVorbei && keineZeit === wkr.keineZeit) return wkr
  return { ...wkr, rueckfragen, vorschlaege, nichtVorbei, keineZeit }
}

// --- Laden ---------------------------------------------------------------------------------------

const istObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const istText = (x: unknown): x is string => typeof x === 'string'
const zahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0
const texte = (x: unknown): string[] | null => (Array.isArray(x) && x.every(istText) ? [...x] : null)
const haken = (x: unknown): string[] | null => {
  const t = texte(x)
  return t && t.every(istHaken) ? t : null
}

function liesPause(raw: unknown): WkrPause | null {
  if (!istObj(raw) || !zahl(raw.von) || !(raw.bis === null || zahl(raw.bis))) return null
  const papier = texte(raw.papier)
  if (!papier) return null
  // `ab` („Papier ab Start …“) nur als lesbare Start-Kennung; sonst fällt nur `ab` weg, die Pause bleibt.
  return liesRef(raw.ab) !== null ? { von: raw.von, bis: raw.bis, papier, ab: raw.ab as string } : { von: raw.von, bis: raw.bis, papier }
}

const liesPausen = (raw: unknown[]): WkrPause[] => raw.map(liesPause).filter((p): p is WkrPause => p !== null)

function liesTeilStatus(raw: unknown): WkrTeilStatus | null {
  if (!istObj(raw) || !STATI.includes(raw.status as WkrStatus) || !Array.isArray(raw.pausen)) return null
  return { status: raw.status as WkrStatus, pausen: liesPausen(raw.pausen) }
}

/** Ein Listeneintrag; `teile` nur bei geteilten Listen (`geteilt`), Unbrauchbares je Teil entfällt. */
function liesListeneintrag(raw: unknown, geteilt: boolean): WkrListe | null {
  if (!istObj(raw) || !MODI.includes(raw.modus as WkrModus) || !STATI.includes(raw.status as WkrStatus) || !zahl(raw.seit) || !Array.isArray(raw.pausen)) return null
  const out: WkrListe = { modus: raw.modus as WkrModus, status: raw.status as WkrStatus, seit: raw.seit, pausen: liesPausen(raw.pausen) }
  if (geteilt && istObj(raw.teile)) {
    const teile: NonNullable<WkrListe['teile']> = {}
    for (const t of ['ab', 'an'] as const) {
      const gelesen = liesTeilStatus(raw.teile[t])
      if (gelesen) teile[t] = gelesen
    }
    if (Object.keys(teile).length > 0) out.teile = teile
  }
  return out
}

/** Gilt die Zelle (Lauf-Schlüssel, Starter) – derselbe Maßstab wie für Eingaben (lib/eingaben.ts `gueltigeZellen`)? */
const zelleGilt = (lauf: string, starter: string, ids: ReadonlySet<string>) => gueltigeZellen([{ lauf, starter, feld: 'x', wert: '' }], ids).length === 1

/** Kennzeichen und Steg-Teil einer Rückfrage bzw. eines Vorschlags (W4.3, Prüfbefund 21.11.2026): nur genau `true` bzw. ab/an. */
function nvTeil(raw: Record<string, unknown>): { nichtVorbei?: true; teil?: ListenTeil; keineZeit?: Record<string, KeineZeitGrund> } {
  // „Keine Zeit“ (W5.4, ZT4): nur bekannte Gründe; ein kaputtes Objekt fällt weg, die Rückfrage bleibt.
  const keineZeit = liesKeineZeitFelder(raw.keineZeit)
  return {
    ...(raw.nichtVorbei === true ? { nichtVorbei: true as const } : {}),
    ...(raw.teil === 'ab' || raw.teil === 'an' ? { teil: raw.teil } : {}),
    ...(keineZeit ? { keineZeit } : {}),
  }
}

function liesRueckfrage(raw: unknown, ids: ReadonlySet<string>): WkrRueckfrage | null {
  if (!istObj(raw)) return null
  const { id, zeile, liste, ref, lauf, starter, feld, wert, steht, grund, zeit } = raw
  if (![id, zeile, liste, ref, lauf, starter, feld, wert, steht].every(istText) || !zahl(zeit)) return null
  if (grund !== 'zelle' && grund !== 'start' && grund !== 'entfernt') return null
  const weitere = texte(raw.weitere)
  const h = haken(raw.haken)
  if (!weitere || !h || !liesListe(liste) || !zelleGilt(lauf as string, starter as string, ids) || !weitere.every((l) => zelleGilt(l, starter as string, ids))) return null
  const v = raw.vereinige
  const vereinige = grund === 'start' && istObj(v) && istText(v.vorher) ? { vereinige: { vorher: v.vorher } } : {}
  // „So lassen“ (W3-35, 21.11.2026): nur eine Zeit; alles andere fällt weg.
  const soLassen = zahl(raw.soLassen) ? { soLassen: raw.soLassen as number } : {}
  return { id, zeile, liste, ref, lauf, weitere, starter, feld, wert, steht, grund, ...vereinige, haken: h, ...nvTeil(raw), ...soLassen, zeit } as WkrRueckfrage
}

function liesVorschlag(raw: unknown, ids: ReadonlySet<string>): WkrVorschlag | null {
  if (!istObj(raw)) return null
  const { id, liste, ref, lauf, starter, grund, zeit } = raw
  if (![id, liste, ref, lauf, starter].every(istText) || !zahl(zeit) || (grund !== 'abgeschlossen' && grund !== 'papier')) return null
  const weitere = texte(raw.weitere)
  const h = haken(raw.haken)
  const zellen = Array.isArray(raw.zellen) && raw.zellen.every((z) => istObj(z) && istText(z.feld) && istText(z.wert)) ? (raw.zellen as { feld: string; wert: string }[]).map(({ feld, wert }) => ({ feld, wert })) : null
  if (!weitere || !h || !zellen || !liesListe(liste) || !zelleGilt(lauf as string, starter as string, ids) || !weitere.every((l) => zelleGilt(l, starter as string, ids))) return null
  return { id, liste, ref, lauf, weitere, starter, zellen, haken: h, grund, ...nvTeil(raw), zeit } as WkrVorschlag
}

function liesAbschluss(raw: unknown): WkrAbschluss | null {
  if (!istObj(raw) || !istText(raw.name) || !zahl(raw.zeit)) return null
  const abweichend = texte(raw.abweichend)
  const papier = texte(raw.papier)
  return abweichend && papier ? { name: raw.name, zeit: raw.zeit, abweichend, papier } : null
}

/**
 * Den gelesenen Stand der WKR-Erfassung prüfen (migrate): Unbrauchbares entfällt einzeln, kaputt als Ganzes ergibt
 * den leeren. Rückfragen und Vorschläge zu Startern, die es nicht (mehr) gibt, entfallen; je Kennung zählt die erste.
 */
export function normalisiereWkr(raw: unknown, starterIds: ReadonlySet<string>): WkrStand {
  if (!istObj(raw)) return wkrLeer()
  const listen = istObj(raw.listen)
    ? Object.fromEntries(
        Object.entries(raw.listen).flatMap(([k, v]): [string, WkrListe][] => {
          const gelesen = liesListe(k)
          const l = gelesen ? liesListeneintrag(v, !!teileVon(gelesen.typeId)) : null
          return l ? [[k, l]] : []
        }),
      )
    : {}
  const eindeutig = <T extends { id: string }>(xs: T[]): T[] => {
    const gesehen = new Set<string>()
    return xs.filter((x) => !gesehen.has(x.id) && !!gesehen.add(x.id))
  }
  const rueckfragen = Array.isArray(raw.rueckfragen) ? eindeutig(raw.rueckfragen.map((x) => liesRueckfrage(x, starterIds)).filter((x): x is WkrRueckfrage => x !== null)) : []
  const vorschlaege = Array.isArray(raw.vorschlaege) ? eindeutig(raw.vorschlaege.map((x) => liesVorschlag(x, starterIds)).filter((x): x is WkrVorschlag => x !== null)) : []
  const abschluss = istObj(raw.abschluss)
    ? Object.fromEntries(
        Object.entries(raw.abschluss).flatMap(([k, v]): [string, Record<string, WkrAbschluss>][] => {
          const liste = liesListe(k)
          if (!liste || !istObj(v)) return []
          const geteilt = !!teileVon(liste.typeId)
          const jePunkt = Object.entries(v).flatMap(([p, a]): [string, WkrAbschluss][] => {
            // Schlüssel: Punkt bzw. Punkt|Teil – ein Teil nur bei geteilten Listen.
            const s = liesAbschlussSchluessel(p)
            // `ohne` nur an der Liste am Tisch, Punkte des Betriebs nur an den anderen (W5.3, 22.11.2026, KN5).
            const passt = !!s && (s.teil === undefined || geteilt) && (s.punkt === OHNE_PUNKT) === istTischListe(liste)
            const gelesen = passt ? liesAbschluss(a) : null
            return gelesen ? [[p, gelesen]] : []
          })
          return jePunkt.length > 0 ? [[k, Object.fromEntries(jePunkt)]] : []
        }),
      )
    : {}
  // „Nicht vorbeigekommen“ (W4.3): je lesbarer Liste die lesbaren Schlüssel gültiger Zellen, ohne Doppelte; ein Teil
  // nur bei geteilten Listen und nur `an` (im Ablegen gibt es X, R1).
  const nichtVorbei = istObj(raw.nichtVorbei)
    ? Object.fromEntries(
        Object.entries(raw.nichtVorbei).flatMap(([k, v]): [string, string[]][] => {
          const liste = liesListe(k)
          // Einzeln: ein kaputter Eintrag nimmt die übrigen der Liste nicht mit.
          const keys = Array.isArray(v) ? v.filter(istText) : null
          if (!liste || !keys) return []
          const geteilt = !!teileVon(liste.typeId)
          const gut = [...new Set(keys)].filter((x) => {
            const z = liesNvSchluessel(x)
            return !!z && (z.teil === undefined ? !geteilt : geteilt && z.teil === 'an') && zelleGilt(z.lauf, z.starter, starterIds)
          })
          return gut.length > 0 ? [[k, gut]] : []
        }),
      )
    : {}
  // „Keine Zeit“ (W5.4, ZT4): je lesbarer Liste gültige Zellen mit bekannten Gründen (wkr/keineZeit.ts).
  const keineZeit = normalisiereKeineZeit(raw.keineZeit, (k) => !!liesListe(k), (lauf, starter) => zelleGilt(lauf, starter, starterIds))
  return { listen, rueckfragen, vorschlaege, abschluss, nichtVorbei, keineZeit }
}
