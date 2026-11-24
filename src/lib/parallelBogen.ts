import type { AppState, BoatType, ClassId, ParallelPlanFest, ParallelRunde, SheetDef, Starter } from '../types'
import { boatTypeOf, CLASS_IDS } from '../domain/classes'
import { buildParallelPlan, parallelActiveClasses, startEntfaellt } from '../planung/parallel'
import { loeseAuf, schreibeFest, vergleicheRunden, VORLAUF } from '../planung/parallelRunden'
import type { BogenBild, BogenKonfig, BogenZeile } from './bogen'
import { gruppenKapazitaet, gruppenSeiten } from './paging'
import { PARALLEL_DATEI } from './parcoursVertrag'
import { RACECOURSE_PARCOURS, RACECOURSES, rundenDisziplin, type Racecourse } from './parallelSchluessel'
import { QR_MUSTER, rundenBogenCode, rundenZettelCode, type QrRundenZiel } from './qr'
import type { WkrBogen } from './wkrListen'

// Die Wettkampfrichter-Listen des Parallelslaloms – rein, ohne DOM. Je Runde sechs Listen: je
// Racecourse A und B die Listen des Aufbaus (Zeit, Steg, Fahrweg – config/aufbauten/parallel.yaml).
//
// Anders als die Listen des Manövrierens (lib/wkrListen.ts) gehört eine Liste nicht zu einer
// Klasse und einem Lauf, sondern zu einer Runde und einem Racecourse: Die Zeilen sind die
// Starts des FESTGESCHRIEBENEN Plans (planung/parallelRunden.ts, Zustand `parallelPlaene`) in
// seiner Reihenfolge, über alle Klassen. Zeile n ist auf A und B und auf allen sechs Listen
// derselbe Start – wer auf A die Zeit nimmt und wer auf B den Fahrweg beobachtet, steht in
// derselben Zeile.
//
// Seiten: Jede Liste teilt für sich, mit so wenigen Seiten wie möglich (Entscheidung des Nutzers
// vom 15.11.2026) – die Zeit-Liste hat keine Legende und fasst mehr Starts als Steg und Fahrweg.
// Die Starts werden auf diese Seiten gleichmäßig verteilt, statt das letzte Blatt fast leer zu
// lassen (Entscheidung vom 15.11.2026 abends, lib/paging.ts `gruppenSeiten`). Seite n trägt
// deshalb NICHT auf allen Listen dieselben Starts; wer zusammengehört, sagt die Spalte „Start“.
// Ein Block der Startreihenfolge wird nie getrennt. „Zeilen je Seite“ und „Teilen ab“ der
// Veranstaltung gelten als Obergrenze (lib/paging.ts `gruppenKapazitaet`).
//
// Regel 960 schreibt diese Listen nicht vor. Sie verlangt, was sie tragen: Pkt. 4.4 „Two drivers
// from the same class shall start at the same time, each running on a separate racecourse. Each
// driver shall have two attempts - the drivers shall change boats and courses for the second
// attempt.“ – also je Start zwei Racecourses und je Starter zwei Attempts.
//
// Entscheidungen des Nutzers vom 15.11.2026:
// - Das Wort „Dummy“ bleibt. Ein Dummy steht als schraffierte Zeile ohne Eingabe da (nur die
//   Zellen „Start“ und „Dummy“ sind grau), ebenso ein entfallener Start (beide Starter eines
//   Paares entfernt): Die Positionen der übrigen Starts bleiben. Jede zweite Zeile ist grau –
//   eine Option der Veranstaltung (`parallelZebra`), nach Entscheidung des Nutzers vom
//   15.11.2026 mit der Vorgabe AN; die Schraffur des Dummys hebt sich davon deutlich ab.
//
// Annahmen (Organisation, nicht Regel 960):
// - Die Zeile gehört zum Starter (seiner ID) und zu seinem Attempt; der Racecourse folgt aus
//   dem Plan und steht nicht in den Werten (lib/parallelSchluessel.ts).
// - Es gibt keine Leerzeilen: Jede Zeile ist ein fester Start. Wer nachgemeldet wird, kommt
//   über einen neuen Plan hinein (Verzahnung freigeben und neu festschreiben).
// - Je Racecourse sitzen eigene race officials an Zeit, Steg (pontoon) und Fahrweg; ihre Namen
//   stehen in der WKR-Einteilung unter der Kennung des Racecourse.
// - Ohne festgeschriebenen Plan gibt es keine Liste: Ein Plan, der dem Starterfeld noch folgt,
//   stünde nach der nächsten Nachmeldung anders da als auf dem gedruckten Papier.
//
// Zeichnung auf dem Bogen (Nutzer 23.11.2026, R9-05 bis R9-07: „Wir brauchen bei dem Bild in der App und auf den
// WKR-Listen nur einen von beiden … Daher kommt auf den Listen und auf dem Gerät nur einer der zwei Parcours und ohne
// Steg.“): die eine Bahn des Parcours-Repositorys (src/assets/parcours/Parallel.svg, dieselbe wie in der Maske „Bild“
// des Geräts) – siehe PARALLEL_BOGEN_BILD. Beim Bau ausgelegt 23.11.2026, bestätigt 24.11.2026 (R10-04 bis R10-07):
// - Nur der Fahrweg-Bogen (Liste mit Bojen-Spalten) trägt sie, wie im Manövrieren nur die Listen mit Bojen, MüB oder
//   Parcours ein Bild haben (config/kurzform.ts `hatBild`); Zeit und Steg bleiben ohne.
// - Racecourse A und B zeigen dieselbe Bahn, nichts gedimmt (wie auf dem Gerät, WKR_ANNAHMEN BD9); welcher Racecourse
//   gemeint ist, steht im Kopf.
// - Vorn steht sie rechts neben der Legende (den Disqualifikationen), höchstens so hoch wie diese, in einem 100 mm
//   breiten Rahmen (styles/bogen.css `.bogen--bild-streifen`). Einsprachig ist das Platz, der dort ohnehin frei ist:
//   Die Zeilen je Blatt, die Seitenzahl jeder Liste und damit die Kästchen der Laufzettel bleiben, wie sie ohne
//   Zeichnung waren (im Browser gemessen 23.11.2026: Fuß 40,2 mm mit und ohne Zeichnung, deutsch und englisch, 31
//   Zeilen je Blatt; die Zeichnung 94 × 22 mm, Bojen 1,7 mm, Ziffern rund 4,5 pt – knapp, aber lesbar). Unter der
//   Legende kostete sie in voller Breite (mit Rahmen gut 50 mm hoch) rund acht Zeilen je Blatt.
// - Zweisprachig ist die Legende 144 mm breit. Neben ihr blieben bis zum Prüfbefund vom 23.11.2026 nur 45 × 11 mm
//   (Bojen 0,8 mm, Ziffern unter 1 mm – nicht lesbar). Seitdem behält die Zeichnung ihre 100 mm und die Legende bricht
//   auf rund 91 mm um (35 statt 24,5 mm hoch): 98 × 23 mm wie einsprachig, dafür 2 Zeilen weniger je Blatt (24 statt
//   26). Gemessen wird je Bogen, Seitenzahlen und Laufzettel folgen dem. Bestätigt 24.11.2026 (R10-07) – verworfen:
//   zweisprachig ohne Zeichnung vorn (dann nur mit „Beschreibung auf der Rückseite“) oder unter der Legende in 100 mm
//   Breite (geschätzt rund 4 Zeilen weniger je Blatt).
// - Mit „Beschreibung auf der Rückseite“ steht sie dort unter der Legende, wie die Bilder der Klassen-Bögen.

/**
 * Die Zeichnung des Fahrweg-Bogens (23.11.2026, Auslegung oben): die eine Bahn ohne Steg für A und B, ungedimmt, nicht
 * gedreht, als flacher Streifen neben der Legende (lib/bogen.ts BogenBild.streifen). Namensnennung wie bei den
 * Klassen-Zeichnungen (dasselbe Repository, derselbe Commit: lib/parcoursNachweis.ts).
 */
export const PARALLEL_BOGEN_BILD: Readonly<BogenBild> = Object.freeze({
  datei: PARALLEL_DATEI,
  vorgabe: Object.freeze({ dim: [] as string[], aus: [] as string[] }),
  drehung: 0,
  streifen: true,
})

/**
 * Trägt eine Liste des Parallelslaloms die Zeichnung? Die mit Bojen-Spalten – die den Fahrweg beobachtet (Auslegung
 * oben, 23.11.2026). Dieselbe Liste hat auf dem Gerät die Maske „Bild“ (wkr/bild.ts bildTreffer).
 */
export function parallelListeMitBild(def: Pick<SheetDef, 'columns'>): boolean {
  return def.columns.some((c) => c.kind === 'buoy')
}

/** Was die Ableitung von der Konfiguration braucht (config/konfig.ts `Konfig`). */
export interface ParallelKonfig extends Pick<BogenKonfig, 'getSheetDef' | 'positionAllowsClass'> {
  getAufbauten(): ReadonlyArray<{ id: string; disziplin: string; ohneSpalten?: Readonly<Record<string, readonly string[]>> }>
  aufbauOrder(id: string, kombiAktiv: boolean): string[]
  rohRegelwerk?: { disziplinen?: readonly string[] }
}

export type ParallelStand = Pick<AppState, 'eventName' | 'eventJahr' | 'starters' | 'parallelPlaene' | 'einteilung'> & Partial<Pick<AppState, 'kennung' | 'regelwerk' | 'wkrZeilenJeSeite' | 'wkrTeilenAb' | 'parallelZebra'>>

/** Kennung der Disziplin (config/catalog.ts `PARALLEL`). */
const DISZIPLIN = 'parallel'

/**
 * Der Aufbau des Parallelslaloms: der erste Aufbau der Disziplin (bisher gibt es einen,
 * config/aufbauten/parallel.yaml). `undefined`, wenn das Regelwerk keinen Parallelslalom kennt
 * (DM) oder kein Aufbau dafür da ist.
 */
export function parallelAufbauId(konfig: Pick<ParallelKonfig, 'getAufbauten' | 'rohRegelwerk'>): string | undefined {
  if (konfig.rohRegelwerk && !(konfig.rohRegelwerk.disziplinen ?? []).includes(DISZIPLIN)) return undefined
  return konfig.getAufbauten().find((a) => a.disziplin === DISZIPLIN)?.id
}

/**
 * Die Listen des Parallelslaloms in ihrer Reihenfolge: die des Aufbaus. Zusätzliche Listen
 * (Vorsteg, Knoten) gibt es hier nicht – Regel 960 nennt für den Parallelslalom weder das eine
 * noch das andere (Pkt. 4.4, 5.2.2), und die Wahl der Veranstaltung gilt dem Manövrieren.
 */
export function parallelListen(konfig: Pick<ParallelKonfig, 'getAufbauten' | 'aufbauOrder' | 'rohRegelwerk'>): string[] {
  const aufbau = parallelAufbauId(konfig)
  return aufbau === undefined ? [] : konfig.aufbauOrder(aufbau, false)
}

/** Die Runden, deren Plan festgeschrieben ist – in der Folge, in der sie gefahren werden (Wiederholungen hinter ihrer Runde). */
export function festeRunden(plaene: AppState['parallelPlaene']): ParallelRunde[] {
  return (Object.keys(plaene) as ParallelRunde[]).sort(vergleicheRunden)
}

/**
 * Die Zeilen einer Liste: je Start des Plans eine, in dessen Reihenfolge. Auf der Zeile steht,
 * wer in diesem Start auf dem Racecourse fährt, mit Startnummer, Klasse und Attempt. Fährt
 * dort ein Dummy, oder gibt es den Starter nicht mehr, ist die Zeile ohne Eingabe; gibt es
 * beide Starter des Starts nicht mehr, entfällt er – die Zeile bleibt trotzdem stehen.
 */
export function rundenZeilen(fest: ParallelPlanFest, starters: AppState['starters'], racecourse: Racecourse): BogenZeile[] {
  return loeseAuf(fest, starters).plan.heats.map((h): BogenZeile => {
    const slot = racecourse === 'A' ? h.a : h.b
    const kopf = { start: h.pos, attempt: h.run, gruppe: h.block }
    if (startEntfaellt(h)) return { ...kopf, nr: '', entfaellt: true }
    if (slot.kind === 'dummy') return { ...kopf, nr: '', dummy: true }
    return { ...kopf, nr: slot.p.startNr, id: slot.p.id, klasse: slot.p.klasse }
  })
}

/** Die Länge der Blöcke eines Plans in seiner Reihenfolge – daran entscheidet sich die Seitenteilung. */
export function blockLaengen(fest: ParallelPlanFest): number[] {
  const laengen: number[] = []
  fest.starts.forEach((s, i) => {
    if (i > 0 && fest.starts[i - 1].block === s.block) laengen[laengen.length - 1]++
    else laengen.push(1)
  })
  return laengen
}

/**
 * So viele Druckseiten hat eine Liste einer Runde, auf deren Blatt gemessen `kapazitaet`
 * Tabellenzeilen passen (0 = unbekannt) – gerechnet wie auf dem Bogen selbst (lib/bogen.ts):
 * so wenige wie möglich, ausgeglichen, nur an Blockenden geteilt, „Zeilen je Seite“ und „Teilen
 * ab“ als Obergrenze. Jede Liste hat ihre eigene Zahl; der Laufzettel fragt sie je Liste.
 */
export function rundenSeitenzahl(fest: ParallelPlanFest, kapazitaet: number, grenze: { zeilenJeSeite?: number; teilenAb?: number } = {}): number {
  return gruppenSeiten(blockLaengen(fest), gruppenKapazitaet(fest.starts.length, kapazitaet, grenze.zeilenJeSeite ?? 0, grenze.teilenAb ?? 0)).length
}

/** Die Kennung eines Bogens: Runde, Racecourse, Liste – eindeutig und stabil. */
export function rundenBogenId(runde: ParallelRunde, racecourse: Racecourse, typeId: string): string {
  return ['parallel', runde, racecourse, typeId].join('|')
}

export interface ParallelBoegen {
  /** Der Aufbau des Parallelslaloms; fehlt, wenn keiner gefahren wird. */
  aufbau?: string
  /** Die Listen des Aufbaus. */
  listen: string[]
  /** Die Runden mit festgeschriebenem Plan – nur für sie gibt es Bögen. */
  runden: ParallelRunde[]
  /**
   * Die Bögen in Druckfolge (lib/wkrListen.ts WKR_DRUCKFOLGE, Nutzer 21.11.2026): erst Racecourse A, dann B; darin je
   * Liste (Position, Reihenfolge des Aufbaus) die Runden in der Folge, in der sie gefahren werden – der Stapel liegt je
   * Racecourse und Position zusammen und wird nur getrennt.
   */
  boegen: WkrBogen[]
}

/**
 * Alle Bögen des Parallelslaloms zum Stand. Ohne festgeschriebenen Plan (oder ohne
 * Parallelslalom im Regelwerk) keine. `titelVon` wie in lib/wkrListen.ts: der Name der Liste
 * in der Sprache ihres Bogens – je Racecourse (dessen Kennung in der Einteilung) und Liste.
 */
export function parallelBoegen(
  stand: ParallelStand,
  konfig: ParallelKonfig,
  titelVon: (typeId: string, parcoursId: string) => string = (typeId) => konfig.getSheetDef(typeId).title,
): ParallelBoegen {
  const aufbau = parallelAufbauId(konfig)
  if (aufbau === undefined) return { listen: [], runden: [], boegen: [] }
  const listen = parallelListen(konfig)
  const runden = festeRunden(stand.parallelPlaene)
  const eventName = [stand.eventName, stand.eventJahr].filter(Boolean).join(' ')
  const kontext = { kennung: stand.kennung ?? '', regelwerk: stand.regelwerk ?? '', aufbau }
  // Spalten, die die Listen dieses Aufbaus nicht haben (config/aufbauten/parallel.yaml `ohneSpalten`).
  const ohneSpalten = konfig.getAufbauten().find((a) => a.id === aufbau)?.ohneSpalten ?? {}
  // Die Listen mit der Zeichnung der Bahn (Fahrweg, 23.11.2026) – je Liste einmal, in jeder Runde und auf A und B gleich.
  const mitBild = new Set(listen.filter((typeId) => parallelListeMitBild(konfig.getSheetDef(typeId))))
  const boegen: WkrBogen[] = []
  for (const racecourse of RACECOURSES) {
    // Je Runde einmal: die Zeilen und Klassen auf diesem Racecourse.
    const jeRunde = runden.map((runde) => {
      const zeilen = rundenZeilen(stand.parallelPlaene[runde]!, stand.starters, racecourse)
      return { runde, zeilen, imPlan: new Set(zeilen.flatMap((z) => (z.klasse === undefined ? [] : [z.klasse]))) }
    })
    for (const typeId of listen) {
      for (const { runde, zeilen, imPlan } of jeRunde) {
        // Die Klassen des Plans in ihrer festen Folge: Sie bestimmen die Spalten (in jeder Klasse dieselben, config/validate.ts).
        const klassen = CLASS_IDS.filter((k) => imPlan.has(k) && konfig.positionAllowsClass(typeId, k)) as ClassId[]
        boegen.push({
          id: rundenBogenId(runde, racecourse, typeId),
          parcoursId: RACECOURSE_PARCOURS[racecourse],
          parcoursName: racecourse,
          klassen,
          lauf: 1,
          typeId,
          titel: titelVon(typeId, RACECOURSE_PARCOURS[racecourse]),
          runde: { runde, racecourse },
          auftrag: {
            typeId,
            klassen,
            lauf: 1,
            zeilen,
            eventName,
            aufbauId: aufbau,
            wkr: stand.einteilung[RACECOURSE_PARCOURS[racecourse]]?.[typeId]?.trim() ?? '',
            runde: { runde, racecourse },
            disziplin: rundenDisziplin(runde),
            ...(ohneSpalten[typeId]?.length ? { ohneSpalten: ohneSpalten[typeId] } : {}),
            ...(mitBild.has(typeId) ? { bild: PARALLEL_BOGEN_BILD } : {}),
            qr: rundenBogenCode(kontext, { runde, racecourse, typeId }),
          },
          optionen: { leerzeilen: 0, zeilenJeSeite: stand.wkrZeilenJeSeite ?? 0, teilenAb: stand.wkrTeilenAb ?? 0, ...(stand.parallelZebra !== false ? { zebra: true } : {}) },
        })
      }
    }
  }
  return { aufbau, listen, runden, boegen }
}

/** Was die Beispielansicht der Listen (components/WkrVorschau.vue) für eine Muster-Runde wählt. */
export interface MusterRundeWahl {
  /** So viele Zeilen (Starts) – aufgerundet auf ganze Paare, denn jedes Paar fährt zwei Attempts. */
  anzahl: number
  /** Buchstabe vor den Muster-Startnummern („M1“, „M2“ …), wie auf den übrigen Beispielbögen. */
  praefix: string
  /** Die gewählte Klasse: Sie fährt in ihrem Bootstyp; der andere bekommt eine Klasse dazu. */
  klasse: ClassId
}

/**
 * Muster-Starter für eine Runde mit etwa `anzahl` Starts: je Bootstyp eine Klasse – die
 * gewählte und eine des anderen Bootstyps –, damit die Blöcke wie auf den gedruckten Listen
 * entstehen: ein kleines und ein großes Paar im 4er-Block, die übrigen Paare des kleinen Boots
 * im 2er-Block. In der Klasse des kleinen Boots ist die Zahl ungerade: Ihr letzter fährt gegen
 * einen Dummy – je Racecourse eine Dummy-Zeile zur Anschauung.
 */
export function musterStarter(wahl: MusterRundeWahl, class4Small: boolean): Starter[] {
  const paare = Math.max(0, Math.ceil(Math.floor(wahl.anzahl) / 2))
  const gross = Math.floor(paare / 2)
  const anzahl: Record<BoatType, number> = { klein: paare - gross > 0 ? 2 * (paare - gross) - 1 : 0, gross: 2 * gross }
  const aktiv = parallelActiveClasses()
  const boot = (k: ClassId) => boatTypeOf(k, class4Small)
  // Die gewählte Klasse fährt in ihrem Boot; im anderen die nächstgelegene: die höchste kleine, die kleinste große.
  const klasse = (b: BoatType): ClassId | undefined =>
    aktiv.includes(wahl.klasse) && boot(wahl.klasse) === b ? wahl.klasse : b === 'klein' ? aktiv.filter((k) => boot(k) === b).at(-1) : aktiv.find((k) => boot(k) === b)
  let nr = 0
  return (['klein', 'gross'] as const).flatMap((b) => {
    const k = klasse(b)
    if (k === undefined) return []
    return Array.from({ length: anzahl[b] }, (): Starter => {
      nr++
      return { id: `muster-${nr}`, startNr: `${wahl.praefix}${nr}`, vorname: '', nachname: '', verein: '', bundesland: '', geburtsdatum: '', groesse: '', klasse: k }
    })
  })
}

/**
 * Die Listen einer Muster-Runde des Parallelslaloms für die Beispielansicht: der Vorlauf mit
 * Muster-Startern ({@link musterStarter}), je Racecourse A und B Zeit, Steg und Fahrweg. Gebaut
 * mit denselben Bausteinen wie die echten Listen, nicht nachgebaut (Entscheidung des Nutzers vom
 * 15.11.2026): Paarung und Blöcke aus planung/parallel.ts `buildParallelPlan`, festgeschrieben
 * wie ein echter Plan (`schreibeFest`), die Bögen aus {@link parallelBoegen} – mit Namen aus der
 * WKR-Einteilung der Racecourses. Statt der Kennung der Veranstaltung trägt der QR-Code „MUSTER“
 * (lib/qr.ts `QR_MUSTER`): Er trifft nie einen echten Bogen, die Erfassung erkennt ihn als Beispiel.
 */
export function musterRundenBoegen(
  stand: Omit<ParallelStand, 'starters' | 'parallelPlaene' | 'kennung'> & Partial<Pick<AppState, 'class4Small' | 'parallelStreng'>>,
  konfig: ParallelKonfig,
  wahl: MusterRundeWahl,
  titelVon?: (typeId: string, parcoursId: string) => string,
): ParallelBoegen {
  const starters = musterStarter(wahl, stand.class4Small === true)
  // Gepaart wie in der Veranstaltung eingestellt (Klasse 4 im kleinen Boot, strenge Klassentrennung).
  const fest = schreibeFest(buildParallelPlan(starters, { class4Small: stand.class4Small === true, streng: stand.parallelStreng !== false }), VORLAUF)
  return parallelBoegen({ ...stand, kennung: QR_MUSTER, starters, parallelPlaene: { [VORLAUF]: fest } }, konfig, titelVon)
}

/** Was gedruckt wird; ein fehlender Wert heißt „alle“. */
export interface ParallelAuswahl {
  runde?: ParallelRunde
  racecourse?: Racecourse
  liste?: string
}

export function waehleRundenBoegen(boegen: readonly WkrBogen[], auswahl: ParallelAuswahl): WkrBogen[] {
  return boegen.filter(
    (b) =>
      (auswahl.runde === undefined || b.runde?.runde === auswahl.runde) &&
      (auswahl.racecourse === undefined || b.runde?.racecourse === auswahl.racecourse) &&
      (auswahl.liste === undefined || b.typeId === auswahl.liste),
  )
}

/**
 * Wonach die Kapazität eines Blatts gemessen wird: Racecourse und Liste. Wie viele Zeilen auf
 * ein Blatt passen, hängt an Kopf, Legende und Format der Liste und an der Sprache ihres Bogens
 * – die gilt je Racecourse (zweisprachig bricht anders um; Entscheidung des Nutzers vom
 * 15.11.2026) –, nicht an der Runde.
 */
export function messKennungRunde(b: { racecourse: Racecourse; typeId: string }): string {
  return `${b.racecourse}|${b.typeId}`
}

/** Je Racecourse und Liste ein Bogen zum Messen der Kapazität (der der ersten Runde), siehe {@link messKennungRunde}. */
export function messBoegenRunde(boegen: readonly WkrBogen[]): WkrBogen[] {
  const je = new Map<string, WkrBogen>()
  for (const b of boegen) {
    if (!b.runde) continue
    const kennung = messKennungRunde({ racecourse: b.runde.racecourse, typeId: b.typeId })
    if (!je.has(kennung)) je.set(kennung, b)
  }
  return [...je.values()]
}

/**
 * Ein Laufzettel des Parallelslaloms: die Listen einer Runde auf einem Racecourse. Er dient
 * dazu, die richtigen Blätter einzusammeln und zusammenzuhalten: ein Kästchen je gedrucktem Blatt.
 */
export interface RundenZettel {
  id: string
  runde: ParallelRunde
  /** Der Racecourse, dessen Blätter er sammelt. */
  racecourse: Racecourse
  /** Inhalt des QR-Codes: Er öffnet in der Erfassung nur die Listen dieses Racecourse. */
  qr: string
  /** Je Liste eine Zeile mit den Kästchen ihrer Druckseiten (ein Bogen: der dieses Racecourse). */
  listen: { typeId: string; boegen: { bogenId: string; racecourse: Racecourse; seiten: number }[] }[]
  /**
   * Die Schritte der Auswertung (Ergebnisse sortiert, geprüft, unterschrieben, ausgehängt, an die
   * Mannschaftsleiter geschickt) stehen nur auf diesem Zettel – dem von Racecourse A: Die Runde
   * wird einmal ausgewertet, nicht je Racecourse.
   */
  schritte: boolean
}

/**
 * Die Laufzettel des Parallelslaloms: je Runde (statt je Klasse und Lauf) IMMER zwei – einer je
 * Racecourse (Entscheidung des Nutzers vom 15.11.2026, abends): Zettel A mit den Kästchen der
 * drei Listen von A, Zettel B mit denen von B, je gedrucktem Blatt eines, jeder mit eigenem
 * QR-Code. `seitenVon` nennt die Seitenzahl einer Liste der Runde auf einem Racecourse
 * ({@link rundenSeitenzahl}) – jede Liste teilt für sich, und A und B einer Liste können sich
 * unterscheiden, wenn ihre Bögen verschiedene Sprachen haben. Die Schritte der Auswertung
 * stehen nur auf Zettel A.
 */
export function rundenZettel(
  stand: Pick<ParallelStand, 'kennung' | 'regelwerk'>,
  parallel: ParallelBoegen,
  seitenVon: (runde: ParallelRunde, typeId: string, racecourse: Racecourse) => number,
): RundenZettel[] {
  const { aufbau } = parallel
  if (aufbau === undefined) return []
  return parallel.runden.flatMap((runde) => {
    const derRunde = parallel.boegen.filter((b) => b.runde?.runde === runde)
    return RACECOURSES.map(
      (racecourse): RundenZettel => ({
        id: `parallel|${runde}|${racecourse}`,
        runde,
        racecourse,
        qr: rundenZettelCode({ kennung: stand.kennung ?? '', regelwerk: stand.regelwerk ?? '', aufbau }, { runde, racecourse }),
        listen: parallel.listen.map((typeId) => ({
          typeId,
          boegen: derRunde
            .filter((b) => b.typeId === typeId && b.runde!.racecourse === racecourse)
            .map((b) => ({ bogenId: b.id, racecourse, seiten: Math.max(1, Math.floor(seitenVon(runde, typeId, racecourse)) || 1) })),
        })),
        schritte: racecourse === RACECOURSES[0],
      }),
    )
  })
}

/**
 * Der Bogen zu einem gelesenen Code (lib/qr.ts, Format ALC2). Ein Laufzettel-Code trifft die
 * erste Liste der Runde auf seinem Racecourse; `null`: Dafür gibt es (noch) keinen Bogen.
 */
export function scanRundenBogen(ziel: QrRundenZiel, boegen: readonly WkrBogen[]): WkrBogen | null {
  const amRacecourse = boegen.filter((b) => b.runde?.runde === ziel.runde && b.runde.racecourse === ziel.racecourse)
  if (ziel.typeId === undefined) return amRacecourse[0] ?? null
  return amRacecourse.find((b) => b.typeId === ziel.typeId) ?? null
}
