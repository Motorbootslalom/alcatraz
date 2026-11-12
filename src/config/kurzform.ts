import type {
  Aufgabe,
  Blick,
  RawErgebnisSpalte,
  RawKurzform,
  RawPosition,
  RawPositionen,
  RawQuelle,
  RawSpalte,
  RawUeberwachung,
} from './schema'
import { zeitSpalten } from './zeitnahme.ts'

// Die Kurzform einer Position (KONZEPT-POSITIONEN.md §4): Statt jede Spalte von Hand zu
// nennen, beschreibt eine Position, welche Bojen und Aufgaben sie beobachtet und von wo
// aus. Spalten, Reihenfolge, Unter-Spalten, Trennlinien, Abblendung im Bild, Drehung,
// Disqualifikationen und Kataloge folgen aus dem Fahrweg, der hier genau einmal steht.
// Jedes Feld der ausführlichen Form darf zusätzlich stehen und gewinnt dann.
// Läuft ohne Bundler: im Build (scripts/sync-config.ts), in der Prüfung und im Browser.

type Seite = 'oben' | 'unten'

export const BLICKE: readonly Blick[] = ['hinten', 'vorne', 'rechts', 'links']
export const AUFGABEN: readonly Aufgabe[] = ['zeit', 'tor5', 'mueb', 'parcours']

/** Die Seite einer Boje ist physisch: seiteA ist die untere Boje im Bild, seiteB die obere. */
const SEITE: Record<Seite, 'seiteA' | 'seiteB'> = { unten: 'seiteA', oben: 'seiteB' }
/** Welche Boje der Tore 1 bis 4 im Bild die innere ist. */
const INNEN: Record<string, Seite> = { Tor1: 'oben', Tor2: 'unten', Tor3: 'oben', Tor4: 'unten' }
/** Das Bild so gedreht, wie die Person den Kurs sieht. */
const DREHUNG: Record<Blick, number> = { hinten: 90, vorne: -90, rechts: 0, links: 180 }

const OHNE_4 = ['E', '1', '2', '3', '5', '6', '7']
const AB_4 = ['4', '5', '6', '7']
const AB_5 = ['5', '6', '7']
const NUR_7 = ['7']

/** Ein Halt auf dem Fahrweg: ein Tor in einer Richtung, eine Speedboje oder eine Fehler-Aufgabe. */
export interface Halt {
  key?: string
  label?: string
  /** Spalte der Ergebnisliste, wie in der DM-Liste („1 H“, „S1“ …). */
  kurz: string
  /** Name in der Prüfung auf Lücken (`ueberwachung`). */
  name: string
  richtung?: 'hin' | 'rueck'
  tor?: string
  speedboje?: string
  katalog?: 'tor5' | 'mueb'
  klassen?: string[]
}

/** Der Kurs in der Reihenfolge der Fahrt (KONZEPT-POSITIONEN.md §4.3). */
export const FAHRWEG: readonly Halt[] = [
  { key: 'start', label: 'Start', richtung: 'hin', tor: 'StartZiel', kurz: 'Start', name: 'Start' },
  { key: 't1a', label: 'Tor 1', richtung: 'hin', tor: 'Tor1', kurz: '1 H', name: 'Tor 1' },
  { key: 't2a', label: 'Tor 2', richtung: 'hin', tor: 'Tor2', kurz: '2 H', name: 'Tor 2' },
  { key: 't3a', label: 'Tor 3', richtung: 'hin', tor: 'Tor3', kurz: '3 H', name: 'Tor 3' },
  { key: 't4a', label: 'Tor 4', richtung: 'hin', tor: 'Tor4', kurz: '4 H', name: 'Tor 4' },
  { key: 't5', label: 'Tor 5', richtung: 'hin', tor: 'Tor5', kurz: '5', name: 'Tor 5' },
  // In der Ergebnisliste „E“ unter Tor 5, wie in der DM-Liste.
  { katalog: 'tor5', kurz: 'E', name: 'Fehler Tor 5' },
  { key: 't5', label: 'Tor 5', richtung: 'rueck', tor: 'Tor5', kurz: '5', name: 'Tor 5' },
  { key: 't4b', label: 'Tor 4', richtung: 'rueck', tor: 'Tor4', kurz: '4 R', name: 'Tor 4' },
  { key: 't3b', label: 'Tor 3', richtung: 'rueck', tor: 'Tor3', kurz: '3 R', name: 'Tor 3' },
  { key: 't2b', label: 'Tor 2', richtung: 'rueck', tor: 'Tor2', kurz: '2 R', name: 'Tor 2' },
  // Klasse 4 fährt auf der Rückfahrt nicht durch Tor 1.
  { key: 't1b', label: 'Tor 1', richtung: 'rueck', tor: 'Tor1', klassen: OHNE_4, kurz: '1 R', name: 'Tor 1' },
  { katalog: 'mueb', klassen: AB_4, kurz: 'MüB', name: 'Mann-über-Bord' },
  // Die Speedrunde, bei Klasse 7 um beide Speedbojen und ein drittes Mal durch Tor 1.
  // „Sp. 1“ wie auf der Papierliste Alcatraz 2, auch weil die Spalten oft schmal sind.
  { key: 'speed1', label: 'Sp. 1', speedboje: 'Speedboje_oben', klassen: AB_5, kurz: 'S1', name: 'Speed 1' },
  { key: 'speed2', label: 'Sp. 2', speedboje: 'Speedboje_unten', klassen: NUR_7, kurz: 'S2', name: 'Speed 2' },
  { key: 't1c', label: 'Tor 1', richtung: 'rueck', tor: 'Tor1', klassen: NUR_7, kurz: '1 R', name: 'Tor 1 (Speedrunde)' },
  { key: 'ziel', label: 'Ziel', richtung: 'rueck', tor: 'StartZiel', kurz: 'Ziel', name: 'Ziel' },
]

/** Vor dem Start und nach dem Ziel: Ablegen und Anlegen am Steg. */
const STEG = {
  ab: { kurz: 'Steg AB', name: 'Ablegen', katalog: 'stegAblegen' },
  an: { kurz: 'Steg AN', name: 'Anlegen', katalog: 'stegAnlegen' },
}

/**
 * Die Spalten der Ergebnisliste in der Reihenfolge der Fahrt (`ergebnisspalten: fahrweg`).
 * Tore mit je einer Unter-Spalte für die linke, dann die rechte Boje wie in der DM-Liste,
 * Start und Ziel mit beiden Bojen in einer Zelle, Tor 5 mit „E“ zwischen Hin und Rück.
 */
export function ergebnisspaltenAusFahrweg(): RawErgebnisSpalte[] {
  const out: RawErgebnisSpalte[] = [{ label: STEG.ab.kurz, felder: [`katalog:${STEG.ab.katalog}`] }]
  let tor5: RawErgebnisSpalte | undefined
  for (const h of FAHRWEG) {
    const bojen = (reihenfolge: string[]) => reihenfolge.map((s) => `${h.key}|${h.richtung} ${s}`)
    if (h.katalog === 'tor5' && tor5) tor5.unter!.push({ label: h.kurz, feld: `katalog:${h.katalog}` })
    else if (h.katalog) out.push({ label: h.kurz, felder: [`katalog:${h.katalog}`] })
    else if (h.speedboje) out.push({ label: h.kurz, felder: [h.key!] })
    else if (h.tor === 'StartZiel') out.push({ label: h.kurz, felder: bojen(['seiteA', 'seiteB']) })
    else if (h.tor === 'Tor5' && tor5) tor5.unter!.push(...bojen(['seiteB', 'seiteA']))
    else if (h.tor === 'Tor5') out.push((tor5 = { label: h.kurz, unter: bojen(['seiteB', 'seiteA']) }))
    else out.push({ label: h.kurz, unter: bojen(['seiteB', 'seiteA']) })
  }
  out.push({ label: STEG.an.kurz, felder: [`katalog:${STEG.an.katalog}`] })
  return out
}

/**
 * Was jeder Aufbau auf einer Liste abdecken muss (`ueberwachung: fahrweg`): jeder Halt des
 * Fahrwegs mit seinen Klassen, Tor 5 mit Hin und Rück in einem Eintrag, dazu der Steg.
 */
export function ueberwachungAusFahrweg(): RawUeberwachung[] {
  const out: RawUeberwachung[] = [{ name: STEG.ab.name, katalog: STEG.ab.katalog }]
  let tor5: RawUeberwachung | undefined
  for (const h of FAHRWEG) {
    const klassen = h.klassen ? { klassen: [...h.klassen] } : {}
    const sub = [`${h.richtung} seiteA`, `${h.richtung} seiteB`]
    if (h.katalog) out.push({ name: h.name, katalog: h.katalog, ...klassen })
    else if (h.speedboje) out.push({ name: h.name, key: h.key, ...klassen })
    else if (h.tor === 'Tor5' && tor5) tor5.sub!.push(...sub)
    else if (h.tor === 'Tor5') out.push((tor5 = { name: h.name, key: h.key, sub }))
    else out.push({ name: h.name, key: h.key, sub, ...klassen })
  }
  out.push({ name: STEG.an.name, katalog: STEG.an.katalog })
  return out
}

const TORE_1_4 = ['Tor1', 'Tor2', 'Tor3', 'Tor4']
const TORE = ['StartZiel', ...TORE_1_4, 'Tor5']
const SPEEDBOJEN = ['Speedboje_oben', 'Speedboje_unten']

/** Die Einzelboje eines Tores auf einer Seite des Bildes, z. B. Tor1_innen oder Tor5_unten. */
function bojeId(tor: string, seite: Seite): string {
  const innen = INNEN[tor]
  return innen ? `${tor}_${seite === innen ? 'innen' : 'aussen'}` : `${tor}_${seite}`
}

/** Alle Bojen-IDs, die eine Kurzform nennen darf: ganze Tore, Einzelbojen und Speedbojen. */
export const BOJEN_IDS: readonly string[] = [
  ...TORE.flatMap((t) => [t, bojeId(t, 'unten'), bojeId(t, 'oben')]),
  ...SPEEDBOJEN,
]

/** Ganze Tore in ihre Einzelbojen zerlegt; unbekannte IDs fallen weg. */
function einzelbojen(ids: readonly string[]): Set<string> {
  const out = new Set<string>()
  for (const id of ids) {
    if (TORE.includes(id)) for (const s of ['unten', 'oben'] as const) out.add(bojeId(id, s))
    else if (BOJEN_IDS.includes(id)) out.add(id)
  }
  return out
}

/**
 * Was im Bild abgeblendet wird: alles, was die Position nicht beobachtet. Ein Tor ganz,
 * wenn keine seiner Bojen beobachtet wird, sonst die einzelne Boje, so wie der Generator
 * es braucht (scripts/generate-parcours.ts).
 */
function abblendung(gesehen: Set<string>, aufgaben: readonly Aufgabe[]): string[] {
  const out: string[] = []
  for (const tor of TORE) {
    const fehlend = (['unten', 'oben'] as const).map((s) => bojeId(tor, s)).filter((b) => !gesehen.has(b))
    out.push(...(fehlend.length === 2 ? [tor] : fehlend))
  }
  out.push(...SPEEDBOJEN.filter((b) => !gesehen.has(b)))
  if (!aufgaben.includes('mueb')) out.push('Schikane')
  return out
}

/** Die Zeitspalten einer Liste ohne Angabe der Geräte: drei Stoppuhren wie bisher. */
const ZEIT_STANDARD: RawSpalte[] = [1, 2, 3].map((n) => ({ key: `zeit${n}`, label: `Zeit ${n}`, typ: 'zeit' }))

/** Wo eine Spalte im Fahrweg steht, für die doppelten Linien zwischen Hin- und Rückfahrt. */
type Phase = 'hin' | 'rueck' | 'wende'

interface Stueck {
  spalten: RawSpalte[]
  phase?: Phase
  /** Nur Tor 5: Richtung und Zahl der beobachteten Bojen. */
  tor5?: 'hin' | 'rueck'
  katalog?: 'tor5' | 'mueb'
}

/**
 * Fehlercode und Punkte einer Aufgabe. Allein auf der Liste heißen sie „Fehler“ und „Fehlerpunkte“.
 * Neben Bojen oder anderen Fehlern trägt die Spalte die Aufgabe im Namen, „Fehler Tor 5“ und
 * „Fehler MüB“ wie beim Steg „Fehler AB“. Nicht „Einfahrt“ oder „Rückwärtstor“: Die Klassen E und 1
 * fahren vorwärts durch Tor 5.
 */
function fehlerSpalten(aufgabe: 'tor5' | 'mueb', mehrere: boolean, mitBojen: boolean, klassen?: string[]): RawSpalte[] {
  const allein = !mehrere && !mitBojen
  const key = mehrere ? aufgabe : 'fehler'
  const punkte = mehrere ? `${aufgabe}fp` : 'fp'
  const nurKlassen = klassen ? { klassen } : {}
  return [
    {
      key,
      label: allein ? 'Fehler' : aufgabe === 'tor5' ? 'Fehler Tor 5' : 'Fehler MüB',
      typ: 'code',
      punkteSpalte: punkte,
      breite: 1,
      ...(mehrere ? { katalog: aufgabe } : {}),
      ...nurKlassen,
    },
    { key: punkte, label: allein ? 'Fehlerpunkte' : 'F-Pkt.', typ: 'summe', einzeln: true, ...nurKlassen },
  ]
}

/**
 * Tor 5: Mit nur einer Boje und ohne Fehlerspalte stehen Hin- und Rückfahrt in einer Spalte,
 * doppelt getrennt. Sonst bekommt jede Richtung ihre Spalte, die Fehler an Tor 5 stehen
 * dazwischen und zählen noch zur Hinfahrt.
 */
function tor5Ordnen(stuecke: Stueck[], vorne: boolean): Stueck[] {
  const hin = stuecke.find((s) => s.tor5 === 'hin')
  const rueck = stuecke.find((s) => s.tor5 === 'rueck')
  if (!hin || !rueck) return stuecke
  const [erst, dann] = vorne ? [rueck, hin] : [hin, rueck]
  const einfahrt = stuecke.find((s) => s.katalog === 'tor5')
  const spalte = (s: Stueck) => s.spalten[0]
  const ohneTor5 = stuecke.filter((s) => s !== hin && s !== rueck && s !== einfahrt)
  const vor = stuecke.indexOf(hin)
  const davor = ohneTor5.filter((s) => stuecke.indexOf(s) < vor)
  const danach = ohneTor5.filter((s) => stuecke.indexOf(s) > vor)
  const einzeln = (spalte(hin).sub?.length ?? 0) === 1 && (spalte(rueck).sub?.length ?? 0) === 1

  if (einzeln && !einfahrt) {
    const zusammen: RawSpalte = {
      ...spalte(erst),
      sub: [...(spalte(erst).sub ?? []), ...(spalte(dann).sub ?? [])],
      subTrenner: 'doppelt',
    }
    return [...davor, { spalten: [zusammen], phase: 'wende' }, ...danach]
  }
  const geteilt = (s: Stueck, phase: Phase): Stueck => ({
    ...s,
    phase,
    spalten: [{ ...spalte(s), key: s.tor5 === 'hin' ? 't5a' : 't5b' }],
  })
  return [...davor, geteilt(erst, 'hin'), ...(einfahrt ? [einfahrt] : []), geteilt(dann, 'rueck'), ...danach]
}

/** Die ausführliche Form einer Position in Kurzform. */
export function kurzformPosition(k: RawKurzform): RawPosition {
  const { blick, bojen = [], aufgaben = [], spalten: _ohne, ...felder } = k
  const gesehen = einzelbojen(bojen)
  const mitBojen = gesehen.size > 0
  const parcours = aufgaben.includes('parcours')
  const kataloge = (['tor5', 'mueb'] as const).filter((a) => aufgaben.includes(a))
  const mehrere = kataloge.length > 1
  // Von vorne liegt die obere Boje links, sonst die untere.
  const seiten: Seite[] = blick === 'vorne' ? ['oben', 'unten'] : ['unten', 'oben']

  // Der Fahrweg, gefiltert auf das, was die Position beobachtet.
  let stuecke: Stueck[] = []
  for (const h of FAHRWEG) {
    if (h.katalog) {
      if (kataloge.includes(h.katalog) && !parcours)
        stuecke.push({
          spalten: fehlerSpalten(h.katalog, mehrere, mitBojen, h.klassen),
          phase: h.katalog === 'tor5' ? 'hin' : 'rueck',
          katalog: h.katalog,
        })
      continue
    }
    const klassen = h.klassen ? { klassen: h.klassen } : {}
    if (h.speedboje) {
      if (gesehen.has(h.speedboje)) stuecke.push({ spalten: [{ key: h.key, label: h.label, typ: 'boje', ...klassen }], phase: 'rueck' })
      continue
    }
    const tor = h.tor!
    const beobachtet = seiten.filter((s) => gesehen.has(bojeId(tor, s)))
    if (beobachtet.length === 0) continue
    const innen = INNEN[tor] ? { innen: SEITE[INNEN[tor]] } : {}
    const spalte: RawSpalte = {
      key: h.key,
      label: h.label,
      typ: 'boje',
      sub: beobachtet.map((s) => `${h.richtung} ${SEITE[s]}`),
      ...innen,
      ...klassen,
    }
    stuecke.push({ spalten: [spalte], phase: h.richtung, ...(tor === 'Tor5' ? { tor5: h.richtung } : {}) })
  }
  stuecke = tor5Ordnen(stuecke, blick === 'vorne')
  // Bei der Parcoursüberwachung stehen die Bojen vorn, die Fehler dahinter.
  if (parcours) for (const a of kataloge) stuecke.push({ spalten: fehlerSpalten(a, mehrere, mitBojen) })

  // Doppelt, wo die Hinfahrt endet und die Rückfahrt beginnt. Die Fehler an Tor 5 zählen noch zur Hinfahrt.
  for (let i = 1; i < stuecke.length; i++) {
    const [vor, akt] = [stuecke[i - 1].phase, stuecke[i].phase]
    if (!vor || !akt || vor === 'wende' || akt === 'wende' || vor === akt) continue
    stuecke[i].spalten[0] = { ...stuecke[i].spalten[0], trenner: 'doppelt' }
  }
  const fahrweg = stuecke.flatMap((s) => s.spalten)

  // Eine Liste nur für bestimmte Klassen, z. B. Mann-über-Bord ab Klasse 4.
  const beschraenkt = fahrweg.filter((s) => s.typ !== 'summe')
  const nurKlassen =
    !aufgaben.includes('zeit') && !parcours && beschraenkt.length > 0 && beschraenkt.every((s) => s.klassen)
      ? [...new Set(beschraenkt.flatMap((s) => (s.klassen ?? []).map(String)))]
      : undefined
  const spaltenFahrweg = nurKlassen
    ? fahrweg.map(({ klassen, ...s }) => (klassen && klassen.length === nurKlassen.length ? s : { ...s, klassen }))
    : fahrweg

  const hatPunkte = fahrweg.length > 0
  const disq = aufgaben.includes('mueb') ? 'mueb' : mitBojen || kataloge.length > 0 || parcours ? 'parcours' : undefined
  const bemerkung = parcours || (!mitBojen && kataloge.length > 0)
  const zusatz: RawSpalte[] = hatPunkte
    ? [
        ...(disq ? [{ key: 'disq', label: 'Disq.', typ: 'disq' as const }] : []),
        { key: 'sum', label: 'Σ', typ: 'summe' },
        ...(bemerkung ? [{ key: 'bemerkung', label: 'Bemerkung', typ: 'text' as const, breite: 3 }] : []),
      ]
    : [
        ...(bemerkung ? [{ key: 'bemerkung', label: 'Bemerkung', typ: 'text' as const, breite: 4 }] : []),
        ...(disq ? [{ key: 'disq', label: 'Disq.', typ: 'disq' as const }] : []),
      ]
  const zeit = aufgaben.includes('zeit') ? (k.zeiten ? zeitSpalten(k.zeiten) : ZEIT_STANDARD) : []

  const hatBild = mitBojen || aufgaben.includes('mueb') || parcours
  const drehung = hatBild && blick ? DREHUNG[blick] : 0
  const gepunktet = fahrweg.some((s) => (s.sub?.length ?? 0) > 1 && !s.subTrenner)
  const hinweis = parcours ? 'parcours' : mitBojen ? 'blickrichtung' : undefined
  // `hinweis: keiner` lässt den Hinweis weg, z. B. wenn die Liste sonst nicht auf eine Seite passt.
  const ohneHinweis = felder.hinweis === 'keiner'
  if (ohneHinweis) delete felder.hinweis

  return {
    // Ohne vorgebautes Bild (`bildImBrowser`) braucht es keinen Ordner.
    ...(hatBild ? { ...(k.bildImBrowser ? {} : { bild: k.id }), bildGenerator: true } : {}),
    ...(hatBild && !parcours ? { abblenden: abblendung(gesehen, aufgaben) } : {}),
    ...(drehung ? { bildDrehung: drehung } : {}),
    ...(blick === 'hinten' && mitBojen ? { pfeileSpiegeln: true } : {}),
    ...(nurKlassen ? { klassen: nurKlassen } : {}),
    ...(hatPunkte ? { summeSpalte: 'sum' } : {}),
    ...(disq ? { disq } : {}),
    ...(kataloge.length === 1 ? { katalog: kataloge[0] } : {}),
    ...(hinweis && !ohneHinweis ? { hinweis } : {}),
    ...(gepunktet ? { subTrenner: 'gepunktet' as const } : {}),
    ...felder,
    spalten: [...zeit, ...spaltenFahrweg, ...zusatz],
  }
}

/** Eine Position ohne `spalten` ist in Kurzform beschrieben. */
export function istKurzform(p: RawPosition | RawKurzform): p is RawKurzform {
  return !!p && typeof p === 'object' && !Array.isArray(p.spalten)
}

/** Ein Eintrag im Aufbau, der eine Position direkt in Kurzform beschreibt (nicht nur abwandelt). */
export function istInlineKurzform(eintrag: unknown): eintrag is RawKurzform {
  return !!eintrag && typeof eintrag === 'object' && !Array.isArray(eintrag) && ('bojen' in eintrag || 'aufgaben' in eintrag)
}

/**
 * Positionen, die direkt im Aufbau stehen (KONZEPT-POSITIONEN.md §4.1), kommen unter
 * `positionen`; der Aufbau nennt dann nur ihre ID. Gibt es die ID schon, bleibt die erste.
 */
export function hochziehen(quelle: RawQuelle | RawPositionen): RawQuelle {
  const positionen: RawQuelle['positionen'] = [...(quelle.positionen ?? [])]
  const ids = new Set(positionen.map((p) => p?.id))
  const aufbauten = quelle.aufbauten?.map((a) => ({
    ...a,
    positionen: (a?.positionen ?? []).map((e) => {
      if (!istInlineKurzform(e)) return e
      if (!ids.has(e.id)) {
        positionen.push(e)
        ids.add(e.id)
      }
      return e.id
    }),
  }))
  return { ...quelle, positionen, ...(aufbauten ? { aufbauten } : {}) }
}

/**
 * Die Positionen in ausführlicher Form; was schon ausführlich ist, bleibt, wie es ist. Dazu
 * kommen Ergebnisspalten und Überwachung aus dem Fahrweg, wo die Dateien `fahrweg` nennen.
 */
export function aufloesen(quelle: RawQuelle | RawPositionen): RawPositionen {
  const q = hochziehen(quelle)
  return {
    ...q,
    positionen: q.positionen.map((p) => (istKurzform(p) ? kurzformPosition(p) : p)),
    ...(q.ueberwachung === 'fahrweg' ? { ueberwachung: ueberwachungAusFahrweg() } : {}),
    ...(q.disziplinen
      ? {
          disziplinen: q.disziplinen.map((d) =>
            d.ergebnisspalten === 'fahrweg' ? { ...d, ergebnisspalten: ergebnisspaltenAusFahrweg() } : d,
          ),
        }
      : {}),
  } as RawPositionen
}
