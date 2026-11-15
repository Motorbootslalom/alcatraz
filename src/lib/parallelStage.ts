import type { AppState, ClassId, Eingaben, ParallelPlaene, ParallelRunde, Starter } from '../types'
import { boatTypeOf } from '../domain/classes'
import { cmpStartNr } from '../planung/parallel'
import { klassenPaare, klassenTeilnehmer, mitKlasse, ohneKlasse, paareNachNummer, rundenDerKlasse, VORLAUF, type RundenPaar } from '../planung/parallelRunden'
import { vergleicheNr } from './eingaben'
import { FINALE_UM_1, klassenDerRunde, PARALLEL_ANNAHMEN, rundenErgebnis, type RundenErgebnis, type RundenKonfig, type RundenStand } from './parallelErgebnis'
import { attemptSchluessel } from './parallelSchluessel'

// Der Weg einer Klasse durch die Runden des Parallelslaloms bis zum Ergebnis der Stage – rein,
// ohne DOM. Die Wertung der einzelnen Runde steht in lib/parallelErgebnis.ts; hier steht, was
// daraus folgt: welche Runde als Nächstes festgeschrieben werden kann und wer darin gegen wen
// fährt, ob ein festgeschriebener Plan noch zum Ergebnis davor passt, und die Plätze der Stage.
//
// Regel 960, Pkt. 4.4:
//   „The four drivers having the highest score in each class shall participate in the
//    semi-finals and finals. Pair setting for the semi-finals is according to the personal
//    number of the drivers. Each semi-final participant shall again have two attempts. The
//    drivers shall change boats and courses for the second attempt. The semi-final results are
//    determined as mentioned above and the pair setting for the finals is as follows:
//    - Drivers with 1st and 2nd highest scores in the semi-finals compete for the 1st and 2nd place;
//    - Drivers with 3rd and 4th highest scores in the semi-finals compete for the 3rd and 4th place.“
// Pkt. 5.2.6: „If there is still a dead-heat situation and a decision is required in order to
//    set up the semi-finals or finals, the drivers having the same time must re-run both
//    attempts. After running again only the time of the re-run will be taken into account.“
//
// Annahmen (Organisation bzw. Empfehlung des Bauplans, nicht Regel 960 – die Schwellen stehen
// in lib/parallelErgebnis.ts `PARALLEL_ANNAHMEN`):
//   • Frage 3: Bei 3 Gewerteten im Vorlauf wird ein Halbfinale mit Dummy gefahren; der Dritte
//     des Halbfinales hat Platz 3 ohne ein Finale um Platz 3 und 4. Bei 2 Gewerteten wird direkt
//     das Finale gefahren. Bei 1 Gewertetem gilt Platz 1 aus dem Vorlauf.
//   • Die „personal number“ ist die Startnummer; die kleinere Nummer beginnt auf Racecourse A –
//     auch in den Finals und in einer Wiederholung (paarweise nach Nummer, ein Einzelner gegen
//     einen Dummy).
//   • Das Finale um Platz 3 und 4 wird vor dem um Platz 1 und 2 gefahren.
//   • Halbfinale, Finals und Wiederholungen werden je Klasse festgeschrieben, sobald die Runde
//     davor entschieden ist – von Hand, nie von selbst: Ändert ein Protest später das Ergebnis
//     davor, bleibt der festgeschriebene Plan, wie er auf dem Papier steht, und gilt als
//     „veraltet“ (Warnung). Gelöst wird nur die jeweils letzte Runde der Klasse (oder eine, die
//     nicht mehr gebraucht wird); dabei gehen die Werte der Klasse in dieser Runde verloren.
//   • Das Ergebnis der Stage gibt es erst, wenn die Klasse alle ihre Runden gefahren ist – und
//     nicht, solange eine ihrer Runden „veraltet“ ist: Erst lösen und neu festschreiben.

export type StageKonfig = RundenKonfig
export type StageStand = RundenStand & Partial<Pick<AppState, 'class4Small'>>

/** Eine Runde, die für die Klasse festgeschrieben werden kann: wer gegen wen fährt. */
export interface RundenSchritt {
  runde: ParallelRunde
  paare: RundenPaar[]
}

/** Eine Runde auf dem Weg der Klasse. */
export interface KlassenRunde {
  runde: ParallelRunde
  /** Das Ergebnis; `null`, solange zur Klasse in der Runde nichts erfasst ist. */
  ergebnis: RundenErgebnis | null
  /** `leer`: noch nichts erfasst; `laeuft`: erfasst, aber nicht jeder ist gefahren; `fertig`: vollständig. */
  zustand: 'leer' | 'laeuft' | 'fertig'
  /**
   * Der festgeschriebene Plan passt nicht (mehr) zum Ergebnis der Runde davor: andere Teilnehmer
   * oder Paare – oder die Runde wird gar nicht mehr gebraucht. Er bleibt, wie er gedruckt ist.
   */
  veraltet: boolean
}

/** Wo eine Klasse im Parallelslalom steht. */
export interface KlassenStand {
  klasse: ClassId
  /** Der Vorlauf und die für die Klasse festgeschriebenen Runden danach, in der Folge des Wettkampfs. */
  runden: KlassenRunde[]
  /** Die Runde, die jetzt festgeschrieben werden kann; fehlt, solange eine läuft oder alles gefahren ist. */
  naechste?: RundenSchritt
  /**
   * Alle Runden der Klasse sind gefahren, und jeder festgeschriebene Plan passt zum Ergebnis
   * davor: Das Ergebnis der Stage steht fest.
   */
  fertig: boolean
  /**
   * Die erste Runde, deren festgeschriebener Plan nicht (mehr) zum Ergebnis davor passt. Solange
   * es eine gibt, hat die Klasse kein Ergebnis der Stage: Es käme sonst aus einem Finale, in das
   * ein Fahrer nicht mehr gehört, neben dem Platz eines anderen aus dem Vorlauf (zwei auf Platz 4).
   */
  veraltet?: ParallelRunde
  /** Die Runden, die sich für die Klasse lösen lassen: die letzte festgeschriebene – und jede veraltete, auf der keine spätere steht. */
  loesbar: ParallelRunde[]
}

const zustandVon = (e: RundenErgebnis | null): KlassenRunde['zustand'] => (e === null ? 'leer' : e.vollstaendig ? 'fertig' : 'laeuft')

/** Zwei Paarungen sind dieselben, wenn dieselben Starter gegeneinander fahren – um dieselben Plätze. */
function gleichePaare(a: readonly RundenPaar[], b: readonly RundenPaar[]): boolean {
  const text = (p: RundenPaar) => `${[p.a, p.b ?? ''].sort().join('|')}|${p.finale ?? ''}`
  const menge = new Set(a.map(text))
  return a.length === b.length && b.every((p) => menge.has(text(p)))
}

/**
 * Wo die Klasse steht; `null`, wenn sie nicht im festgeschriebenen Plan des Vorlaufs vorkommt
 * (kein Parallelslalom, Verzahnung offen, Klasse ohne Starter).
 */
export function klassenStand(stand: StageStand, konfig: StageKonfig, klasse: ClassId): KlassenStand | null {
  const plaene = stand.parallelPlaene ?? {}
  if (!klassenDerRunde({ starters: stand.starters, parallelPlaene: plaene }, VORLAUF).includes(klasse)) return null
  const starterVon = new Map(stand.starters.map((p) => [p.id, p]))
  const starter = (ids: readonly string[]) => ids.flatMap((id) => starterVon.get(id) ?? [])
  const runden: KlassenRunde[] = []
  const eintrag = (runde: ParallelRunde, ergebnis: RundenErgebnis | null, veraltet = false) => runden.push({ runde, ergebnis, zustand: zustandVon(ergebnis), veraltet })
  const ergebnisVon = (runde: ParallelRunde) => rundenErgebnis(stand, konfig, klasse, runde)
  let naechste: RundenSchritt | undefined
  let fertig = false

  /** Eine Runde mit ihren Wiederholungen; liefert ihr Ergebnis, sobald sie entschieden ist. */
  const stufe = (runde: 'pre' | 'semi', veraltet = false): RundenErgebnis | null => {
    const e = ergebnisVon(runde)
    eintrag(runde, e, veraltet)
    for (const r of e?.wiederholt ?? []) eintrag(r, ergebnisVon(r))
    if (e && e.rerun.length > 0 && e.rerunRunde) {
      if (e.rerunFest) {
        const teilnehmer = klassenTeilnehmer(plaene[e.rerunRunde], klasse)
        eintrag(e.rerunRunde, ergebnisVon(e.rerunRunde), teilnehmer.length !== e.rerun.length || !e.rerun.every((id) => teilnehmer.includes(id)))
      } else {
        naechste = { runde: e.rerunRunde, paare: paareNachNummer(starter(e.rerun)) }
      }
      return null
    }
    return e?.entschieden ? e : null
  }
  /** Das Paar eines Finales: die kleinere Startnummer beginnt auf Racecourse A. */
  const finalPaar = (ids: readonly string[], finale: 1 | 3): RundenPaar => {
    const [a, b] = [...starter(ids)].sort(cmpStartNr)
    return { a: a.id, b: b?.id ?? null, finale }
  }

  const weg = () => {
    const pre = stufe('pre')
    if (!pre) return
    const weiter = pre.folge
    if (weiter.length < PARALLEL_ANNAHMEN.finaleAb) {
      fertig = true
      return
    }
    let finals: RundenPaar[]
    if (weiter.length >= PARALLEL_ANNAHMEN.halbfinaleAb) {
      const soll = paareNachNummer(starter(weiter))
      if (klassenTeilnehmer(plaene.semi, klasse).length === 0) {
        naechste = { runde: 'semi', paare: soll }
        return
      }
      const semi = stufe('semi', !gleichePaare(klassenPaare(plaene.semi, klasse), soll))
      if (!semi) return
      const f = semi.folge
      // Erst das Finale um Platz 3 und 4, dann das um Platz 1 und 2 (Organisation).
      finals = [...(f.length >= 2 * FINALE_UM_1 ? [finalPaar(f.slice(FINALE_UM_1, 2 * FINALE_UM_1), 3)] : []), finalPaar(f.slice(0, FINALE_UM_1), 1)]
    } else {
      finals = [finalPaar(weiter, 1)]
    }
    if (klassenTeilnehmer(plaene.final, klasse).length === 0) {
      naechste = { runde: 'final', paare: finals }
      return
    }
    const final = ergebnisVon('final')
    eintrag('final', final, !gleichePaare(klassenPaare(plaene.final, klasse), finals))
    fertig = final?.vollstaendig === true
  }
  weg()

  // Festgeschriebene Runden, die der Weg nicht (mehr) braucht: etwa eine Wiederholung, deren
  // Gleichstand ein Protest aufgehoben hat. Sie bleiben sichtbar und lassen sich lösen.
  const fest = rundenDerKlasse(plaene, klasse)
  const ungenutzt = fest.filter((r) => !runden.some((x) => x.runde === r))
  for (const r of ungenutzt) eintrag(r, ergebnisVon(r), true)
  const letzte = fest.at(-1)
  const veraltet = runden.find((r) => r.veraltet)?.runde
  return { klasse, runden, naechste, fertig: fertig && veraltet === undefined, veraltet, loesbar: [...new Set([...(letzte ? [letzte] : []), ...ungenutzt])] }
}

/** Der Stand aller Klassen des Vorlaufs, in der Reihenfolge seines Plans. */
export function klassenStaende(stand: StageStand, konfig: StageKonfig): KlassenStand[] {
  return klassenDerRunde({ starters: stand.starters, parallelPlaene: stand.parallelPlaene ?? {} }, VORLAUF).flatMap((k) => klassenStand(stand, konfig, k) ?? [])
}

/**
 * Die nächste Runde einer Klasse festschreiben: Ihre Paare kommen in den Plan der Runde. Wirkt
 * nur, wenn genau diese Runde für die Klasse ansteht – eine veraltete Anfrage (zweites Gerät,
 * doppelter Klick) ändert nichts.
 */
export function schreibeRundeFest(stand: StageStand, konfig: StageKonfig, klasse: ClassId, runde: ParallelRunde): ParallelPlaene | null {
  const schritt = klassenStand(stand, konfig, klasse)?.naechste
  if (!schritt || schritt.runde !== runde || schritt.paare.length === 0) return null
  return mitKlasse(stand.parallelPlaene ?? {}, runde, klasse, schritt.paare, boatTypeOf(klasse, stand.class4Small === true))
}

/** Die Zeilen (Starter-IDs) einer Runde, zu denen Werte erfasst sind. */
export function rundenWerte(eingaben: Eingaben, runde: ParallelRunde, ids: readonly string[]): string[] {
  return ids.filter((id) => [1, 2].some((attempt) => Object.keys(eingaben[attemptSchluessel(runde, attempt)]?.[id] ?? {}).length > 0))
}

/**
 * Wie viele Werte beim Löschen einer Runde für diese Starter verloren gingen: jedes nicht leere
 * Feld beider Attempts, auch der Haken „erfasst“ – und bei wie vielen Startern. Die Rückfrage
 * nennt beides (Entscheidung des Nutzers vom 15.11.2026).
 */
export function rundenWerteZahl(eingaben: Eingaben, runde: ParallelRunde, ids: readonly string[]): { werte: number; starter: number } {
  let werte = 0
  for (const id of ids) {
    for (const attempt of [1, 2]) werte += Object.values(eingaben[attemptSchluessel(runde, attempt)]?.[id] ?? {}).filter((w) => String(w).trim() !== '').length
  }
  return { werte, starter: rundenWerte(eingaben, runde, ids).length }
}

/**
 * Eine Runde für eine Klasse lösen: Ihre Starts gehen aus dem Plan der Runde – und mit ihnen
 * die Werte, die für ihre Starter in dieser Runde erfasst sind (sie hätten keine Zeile mehr
 * und kämen beim nächsten Festschreiben ungefragt zurück). `null`: Die Runde lässt sich für die
 * Klasse nicht lösen (nicht festgeschrieben, oder es steht eine spätere darauf).
 */
export function loeseRunde(stand: StageStand, konfig: StageKonfig, klasse: ClassId, runde: ParallelRunde): { parallelPlaene: ParallelPlaene; eingaben: Eingaben } | null {
  if (runde === VORLAUF || !klassenStand(stand, konfig, klasse)?.loesbar.includes(runde)) return null
  const plaene = stand.parallelPlaene ?? {}
  const ids = new Set(klassenTeilnehmer(plaene[runde], klasse))
  let eingaben = stand.eingaben
  for (const attempt of [1, 2]) {
    const schluessel = attemptSchluessel(runde, attempt)
    const zeilen = eingaben[schluessel]
    if (!zeilen || !Object.keys(zeilen).some((id) => ids.has(id))) continue
    const bleibt = Object.fromEntries(Object.entries(zeilen).filter(([id]) => !ids.has(id)))
    const { [schluessel]: _alt, ...rest } = eingaben
    eingaben = Object.keys(bleibt).length === 0 ? rest : { ...rest, [schluessel]: bleibt }
  }
  return { parallelPlaene: ohneKlasse(plaene, runde, klasse), eingaben }
}

// ---- Das Ergebnis der Stage -----------------------------------------------------------------

/** Eine Zeile des Ergebnisses der Stage „Parallel slalom“. */
export interface StageZeile {
  starter: Starter
  platz: number
  /** UIM points des Platzes (Regel 960, Pkt. 5.1); 0 für im Vorlauf Disqualifizierte. */
  punkte: number
  disq: boolean
  /** Die Runde, die den Platz bestimmt hat. */
  runde: ParallelRunde
  /** Die Summe beider Attempts in dieser Runde (Hundertstel); `null` = disqualifiziert. */
  gesamt: number | null
}

export interface StageErgebnis {
  klasse: ClassId
  /** Nach Platz; bei gleichem Platz Gewertete vor Disqualifizierten, dann nach Startnummer. */
  nachPlatz: StageZeile[]
}

/**
 * Das Ergebnis der Stage „Parallel slalom“ einer Klasse; `null`, solange nicht alle ihre Runden
 * gefahren sind oder der Plan einer Runde nicht mehr zum Ergebnis davor passt (`veraltet`).
 *
 * Regel 960, Pkt. 4.4: „the driver is awarded UIM points for his/her ranking“; Pkt. 5.1 (Tabelle
 * 400 … 1). Die Plätze 1 bis 4 kommen aus den Finals (Pkt. 4.4: „compete for the 1st and 2nd
 * place“, „compete for the 3rd and 4th place“), ab Platz 5 gilt der Platz des Vorlaufs. Ein
 * geteilter Platz gibt beiden die vollen Punkte, der nächste entfällt (Pkt. 5.2.6 „dead-heat
 * result“; wie auf der Gesamtliste des Manövrierens).
 *
 * Disqualifikation (Pkt. 5.2.2): im Vorlauf „disqualified from the whole stage“ – letzter Platz,
 * 0 Punkte (Pkt. 5.1: „Drivers must complete the relevant stage … in order to be classified“).
 * In Halbfinale und Finale „ranked last in the relevant heat“ – der hintere Platz, mit dessen
 * Punkten (Annahme, Frage 5b; `PARALLEL_ANNAHMEN.disqImHeatBehaeltPunkte`). Im Re-run zum
 * Vorlauf: der hintere Platz der Gruppe mit dessen Punkten, als „Disq.“ ohne Zeit (Entscheidung
 * des Nutzers vom 15.11.2026, `PARALLEL_ANNAHMEN.disqInWiederholungDesVorlaufs`).
 *
 * Weniger als vier Gewertete (Annahme, Frage 3): Der Dritte eines Halbfinales mit Dummy hat
 * Platz 3; bei einem Gewerteten gilt der Vorlauf allein.
 */
export function stageErgebnis(stand: StageStand, konfig: StageKonfig, klasse: ClassId, punkte: readonly number[]): StageErgebnis | null {
  const ks = klassenStand(stand, konfig, klasse)
  if (!ks?.fertig) return null
  const von = (runde: ParallelRunde) => ks.runden.find((r) => r.runde === runde)?.ergebnis ?? null
  const pre = von(VORLAUF)
  if (!pre) return null
  const punkteVon = (platz: number) => (Number.isInteger(platz) && platz >= 1 ? (punkte[platz - 1] ?? 0) : 0)
  const imHeat = (platz: number, disq: boolean) => (disq && !PARALLEL_ANNAHMEN.disqImHeatBehaeltPunkte ? 0 : punkteVon(platz))
  const zeilen = new Map<string, StageZeile>()
  for (const z of pre.gesamt.nachPlatz) {
    const m = pre.massgeblich.get(z.starter.id)
    // Im Re-run disqualifiziert: hinterer Platz der Gruppe mit dessen Punkten (PARALLEL_ANNAHMEN,
    // Entscheidung des Nutzers vom 15.11.2026) – aber ohne Zeit: Nach dem Re-run zählt nur dessen
    // Zeit (Pkt. 5.2.6 „only the time of the re-run will be taken into account“).
    const imRerun = !z.disq && m !== undefined && m.runde !== VORLAUF && m.gesamt === null
    zeilen.set(z.starter.id, { starter: z.starter, platz: z.platz, punkte: z.disq ? 0 : punkteVon(z.platz), disq: z.disq || imRerun, runde: m?.runde ?? VORLAUF, gesamt: z.disq || imRerun ? null : (m?.gesamt ?? z.gesamt) })
  }
  const semi = von('semi')
  const final = von('final')
  // Der Dritte eines Halbfinales mit Dummy fährt kein Finale: Platz 3.
  if (final && semi && semi.folge.length > FINALE_UM_1 && semi.folge.length < 2 * FINALE_UM_1) {
    const z = semi.gesamt.nachPlatz.find((x) => x.starter.id === semi.folge[FINALE_UM_1])
    const m = z && semi.massgeblich.get(z.starter.id)
    if (z) zeilen.set(z.starter.id, { starter: z.starter, platz: FINALE_UM_1 + 1, punkte: imHeat(FINALE_UM_1 + 1, z.disq), disq: z.disq, runde: m?.runde ?? 'semi', gesamt: z.disq ? null : (m?.gesamt ?? z.gesamt) })
  }
  for (const z of final?.gesamt.nachPlatz ?? []) zeilen.set(z.starter.id, { starter: z.starter, platz: z.platz, punkte: imHeat(z.platz, z.disq), disq: z.disq, runde: 'final', gesamt: z.disq ? null : z.gesamt })
  return {
    klasse,
    nachPlatz: [...zeilen.values()].sort((a, b) => a.platz - b.platz || Number(a.disq) - Number(b.disq) || vergleicheNr(a.starter.startNr, b.starter.startNr)),
  }
}

/** Das Ergebnis der Stage als Blatt: ein Dokument mit eigener Seitenzählung, neben den Listen der Runden (lib/parallelErgebnis.ts `RundenBlatt`). */
export interface StageBlatt {
  key: string
  art: 'stage'
  stage: StageErgebnis
}

/** Die Ergebnisse der Stage aller Klassen, die fertig sind – in der Reihenfolge von `klassen`. */
export function stageBlaetter(stand: StageStand, konfig: StageKonfig, klassen: readonly ClassId[], punkte: readonly number[]): StageBlatt[] {
  return klassen.flatMap((klasse): StageBlatt[] => {
    const stage = stageErgebnis(stand, konfig, klasse, punkte)
    return stage ? [{ key: `parallel:stage/${klasse}`, art: 'stage', stage }] : []
  })
}

/** Woran die Stage einer Klasse hängt, die nicht fertig ist. */
export interface OffeneRunde {
  runde: ParallelRunde
  /** Die Runde kann jetzt festgeschrieben werden. */
  festschreiben: boolean
  /** Der Plan der Runde passt nicht mehr zum Ergebnis davor: lösen und neu festschreiben. */
  veraltet: boolean
}

/** Die Runde, an der die Stage der Klasse hängt – eine veraltete zuerst: Sie ist als Erstes zu lösen. */
export function offeneRunde(ks: KlassenStand): OffeneRunde {
  if (ks.veraltet !== undefined) return { runde: ks.veraltet, festschreiben: false, veraltet: true }
  return { runde: ks.naechste?.runde ?? ks.runden.filter((r) => r.zustand !== 'fertig').at(-1)?.runde ?? VORLAUF, festschreiben: ks.naechste !== undefined, veraltet: false }
}

/** Die Klassen des Vorlaufs, deren Stage noch nicht fertig ist – mit der Runde, an der es hängt. */
export function offeneKlassen(stand: StageStand, konfig: StageKonfig): ({ klasse: ClassId } & OffeneRunde)[] {
  return klassenStaende(stand, konfig)
    .filter((ks) => !ks.fertig)
    .map((ks) => ({ klasse: ks.klasse, ...offeneRunde(ks) }))
}

/** Eine offene Runde in Worten, für die Hinweise der Listen: bei einer veralteten mit dem Grund. */
export function offeneRundeText(o: OffeneRunde, name: (runde: ParallelRunde) => string, veraltetText: string): string {
  return o.veraltet ? `${name(o.runde)} – ${veraltetText}` : name(o.runde)
}
