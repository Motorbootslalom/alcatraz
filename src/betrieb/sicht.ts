import { tIn, type Locale } from '../i18n'
import type { AppState, ClassId, OeffentlicheSicht, ParallelRunde, PunktId, SichtBereich, SichtEinstieg, SichtHerkunft, SichtKlasse, SichtKlassenStand, SichtPaar, SichtPunkt, SichtStart, SichtStarter, Starter, ZuschauerBereich, ZuschauerSicht } from '../types'
import { regelwerkOf } from '../config/catalog'
import { bogenTexte, type BogenTexte } from '../config/sprache'
import { classColor } from '../domain/classes'
import { listenNachname } from '../lib/namen'
import { starterHerkunft } from '../lib/origin'
import { laenderKuerzelFuer, regelwerkSprache } from '../lib/listensprache'
import { bereicheZumStand, betriebVon, istParallel, laeufeVonPunkt, lage, punktVonLauf, rundenPunkt, rundeVonPunkt, spurenVon, type BereichLage, type FolgeEintrag, type GezeigtEintrag } from './folge'
import { ersterStart, klasseAllein, klassenNachNaechstemStart } from './schritte'
import { freieFolge, klasseNachStarter, klassenMessungen, messungenIn, startabstandImBetrieb, type Messung } from './prognose'

// Die öffentliche Sicht auf den Betrieb – die EINE Stelle, an der entschieden wird, was Anzeigetafel,
// Zuschauer und Start-Freigabe vom Stand zu sehen bekommen (Plan vom 16.11.2026, §1 und §3). Andere
// Geräte bekommen nie den Stand, nur dies; die Anzeigetafel am Bedienrechner liest dasselbe.
//
// Datenschutz (es geht um Minderjährige, Links werden weitergegeben): nie Geburtsdatum, Gewicht,
// Geschlecht, Ausgleichsgewicht, erfasste Werte oder Abmeldungen. Nur Starter, die in der Sicht
// vorkommen, und von ihnen Startnummer, Name nach der Einstellung, Klasse und Herkunft.
//
// Zeitunabhängig: Die Sicht ändert sich nur, wenn sich der Stand ändert – „seit m:ss“ und die Wartezeiten
// („ca. in“, „Zeit bis zum Vorsteg“) rechnet der Bildschirm aus `seit`, den Startabständen und seiner Uhr
// (betrieb/prognose.ts, Kritik K28). Texte stehen in der Sprache der Anzeigetafel (Bogentexte,
// config/sprache.ts); Bedienelemente übersetzt die Oberfläche selbst.
//
// Die Zuschauersicht (`sichtZuschauer`) ist eine Teilmenge davon, für die Zuschauerliste und später den
// Zuschauer-Link: ohne Bedienangaben (BETRIEB_ANNAHMEN.zuschauerSchmal).
//
// Parallelslalom (sv 4, E4): Ein Start ist ein Paar (`SichtStart.paar`, Racecourse A und B). Eine leere Seite
// (Dummy, gelöscht, X) steht als `null` darin – ohne Grund, und ihr Starter steht nicht dafür in `starter`. Die
// Kennung (`key`) trägt in der öffentlichen Sicht weiter die IDs laut Plan: „Nächster Start“ schickt sie als
// `vorher`, sie darf sich mit einem X nicht ändern (Kritik K8). Die Zuschauersicht bildet ihre Kennung nur aus dem,
// was sie zeigt – so verrät der öffentliche Link nicht, wer auf einer leeren Seite gestanden hätte
// (BETRIEB_ANNAHMEN.parallelLeereSeite, Prüfung E4).

export interface SichtOptionen {
  /**
   * Logos mitgeben (wenn `anzeige.logos` an ist und es welche gibt); Vorgabe ja – für die Anzeigetafel am
   * Bedienrechner. Für entfernte Anzeigen (E6) ruft der Host mit `!BETRIEB_ANNAHMEN.logosNurLokal` auf.
   */
  logos?: boolean
}

/** Die Sprache der Anzeigetafel: die Einstellung oder die der Listen (Regelwerk). */
export function anzeigeSprache(stand: Pick<AppState, 'anzeige' | 'regelwerk'>): Locale {
  return stand.anzeige.sprache === 'regelwerk' ? regelwerkSprache(stand.regelwerk) : stand.anzeige.sprache
}

/** Die Kopfzeile: die eigene oder Name und Jahr der Veranstaltung ('' ohne Namen). */
function kopfzeile(stand: AppState): string {
  if (stand.anzeige.kopfzeile !== null) return stand.anzeige.kopfzeile
  const name = stand.eventName.trim()
  return name ? `${name} ${stand.eventJahr}` : ''
}

/** Der Name, wie ihn die Anzeigetafel zeigt: Vorname und Nachname nach der Einstellung (wie der Aushang, voll, gekürzt, ohne). */
function anzeigeName(p: Starter, stand: AppState): string {
  const art = stand.anzeige.namen === 'aushang' ? stand.ergebnisListen.aushang.namen : stand.anzeige.namen
  if (art === 'ohne') return ''
  return [p.vorname.trim(), listenNachname(p, art).trim()].filter(Boolean).join(' ')
}

/** Die Herkunft nach der Einstellung (Darstellung wie die Listen, Kürzel nach dem Regelwerk); `null` bei „aus“, Clubmeisterschaft oder leerer Angabe. */
function anzeigeHerkunft(p: Starter, stand: AppState, sprache: Locale): SichtHerkunft | null {
  const stil = stand.anzeige.herkunft
  if (stil === 'aus' || stand.originMode === 'none') return null
  const h = starterHerkunft(p, stand.originMode, stil, stand.originShort, sprache, laenderKuerzelFuer(stand.regelwerk))
  if (!h.klartext) return null
  return { text: h.text, klartext: h.klartext, druck: h.druck, alt: h.alt, ...(h.flagge ? { flagge: h.flagge } : {}) }
}

/**
 * Die Klassen des Arbeitspunkts für die Start-Freigabe (B-9, B-10): fahrende in der Folge ihres nächsten
 * Starts, ausgesetzte dahinter (auch ohne offene Starts – sonst ließen sie sich nicht zurückholen).
 */
function klassenFolge(l: BereichLage, stand: AppState): SichtKlassenStand[] {
  // Im Parallelslalom gibt es kein Aussetzen und Vorziehen von Klassen (BETRIEB_ANNAHMEN.parallelOhneUmstellen).
  if (istParallel(l.bereich)) return []
  const fahrend = klassenNachNaechstemStart(l)
  const spuren = spurenVon(stand, l.bereich)
  const imPunkt = [...l.offen, ...l.bootFehlt].filter((e) => e.punkt === l.arbeitsPunkt)
  const zahl = (k: ClassId) => imPunkt.filter((e) => e.klasse === k).length
  // Ausgesetzte in der Folge ihres ersten ausstehenden Starts im Punkt, die übrigen in der Folge des Aussetzens.
  const ausgesetzt = [...new Set([...imPunkt.filter((e) => l.ausgesetzt.includes(e.klasse)).map((e) => e.klasse), ...l.ausgesetzt])]
  return [
    ...fahrend.map((klasse) => ({ klasse, offen: zahl(klasse), ausgesetzt: false, verschiebbar: !klasseAllein(klasse, fahrend, spuren) })),
    ...ausgesetzt.map((klasse) => ({ klasse, offen: zahl(klasse), ausgesetzt: true, verschiebbar: false })),
  ]
}

/**
 * „Einsteigen ab …“: je Punkt der erste noch nicht gezeigte, nicht entfallene Start, dazu je Klasse darin (in der
 * Folge ihres ersten Starts). Als Start der Sicht – so steht auch ein schon „ohne Anzeige“ erledigter mit Nummer da.
 */
function einstiege(l: BereichLage, start: (e: FolgeEintrag) => SichtStart): SichtEinstieg[] {
  return l.programm.flatMap((punkt) => {
    const erster = ersterStart(l, punkt)
    if (!erster) return []
    const klassen = [...new Set(l.folge.filter((e) => e.punkt === punkt && !e.entfaellt && !l.gezeigtKeys.has(e.key)).map((e) => e.klasse))]
    return [{ ...start(erster), klasse: null }, ...klassen.map((klasse) => ({ ...start(ersterStart(l, punkt, klasse)!), klasse }))]
  })
}

function sichtPunkt(stand: AppState, punkt: PunktId | null, texte: BogenTexte): SichtPunkt | null {
  if (punkt === null) return null
  // Eine Runde des Parallelslaloms heißt wie auf ihren Listen („Preliminary heat“, „Semi-finals“ …), ohne Läufe.
  const runde = rundeVonPunkt(punkt)
  if (runde !== undefined) return { id: punkt, titel: texte.runde(runde), laeufe: [] }
  const laeufe = laeufeVonPunkt(stand, punkt)
  return { id: punkt, titel: laeufe.map((n) => texte.lauf(n)).join(' / '), laeufe }
}

/**
 * Der Titel eines Starts des Parallelslaloms in der Sprache der Tafel: die Runde – in den Finals, um welche Plätze
 * („Final“, „Small final (3rd and 4th place)“) – und der Attempt.
 */
function paarTitel(runde: ParallelRunde, attempt: number, finale: 1 | 3 | undefined, texte: BogenTexte, sprache: Locale): string {
  const was = finale ? tIn(sprache, finale === 1 ? 'parallel.final.1' : 'parallel.final.3') : texte.runde(runde)
  return `${was} · ${tIn(sprache, 'anzeige.versuch', { n: attempt })}`
}

/**
 * Die öffentliche Sicht zum Stand. Rein und zeitunabhängig; gleicher Stand ⇒ gleiche Sicht (der
 * Bildschirm vergleicht nach Inhalt, damit eine Eingabe in einem anderen Fenster die Tafel nicht neu
 * zeichnet). Enthält alle Bereiche; `auswahl` nennt die der gemeinsamen Anzeigetafel.
 */
export function sichtOeffentlich(stand: AppState, optionen: SichtOptionen = {}): OeffentlicheSicht {
  const sprache = anzeigeSprache(stand)
  const texte = bogenTexte(sprache, regelwerkOf(stand.regelwerk).klassenNamen)
  const starterNachId = new Map(stand.starters.map((s) => [s.id, s]))
  const vorkommend = new Map<string, Starter>()

  const start = (e: FolgeEintrag): SichtStart => {
    if (e.paar) {
      // Nur die Seiten, auf denen jemand fährt – eine leere (Dummy, gelöscht, X) ist `null`, ohne Grund.
      const a = e.paar.aFaehrt ? e.paar.a : null
      const b = e.paar.bFaehrt ? e.paar.b : null
      for (const id of [a, b]) if (id !== null) vorkommend.set(id, starterNachId.get(id)!)
      const paar: SichtPaar = { attempt: e.paar.attempt, a, b, ...(e.paar.finale ? { finale: e.paar.finale } : {}) }
      return { key: e.key, starter: a ?? b ?? '', lauf: e.lauf, punkt: e.punkt, titel: paarTitel(e.paar.runde, e.paar.attempt, e.paar.finale, texte, sprache), paar }
    }
    vorkommend.set(e.starter, starterNachId.get(e.starter)!)
    return { key: e.key, starter: e.starter, lauf: e.lauf, punkt: e.punkt, titel: texte.lauf(e.lauf) }
  }
  // Ein gezeigter Start, der in der Folge nicht mehr vorkommt (anderes Programm, X danach), bleibt
  // „im Boot“. Auch wenn sein Starter gelöscht ist, trägt die Sicht ihn weiter – nur ohne Eintrag in
  // `starter`, die Bildschirme zeigen dann „bereit“ bzw. „noch kein Start“. Die Kennung muss bleiben:
  // „Nächster Start“ schickt sie als `vorher`, und der Reducer vergleicht mit der Lage (betrieb/folge.ts),
  // die den Start weiter im Boot führt. Ohne sie hinge die Start-Freigabe (Prüfung E1, 16.11.2026).
  const gezeigt = (g: GezeigtEintrag | null): SichtStart | null => {
    if (!g) return null
    if (g.eintrag) return start(g.eintrag)
    const ref = g.ref
    if (!ref) return null
    if (ref.art === 'p') {
      // Ein Paar, dessen Runde nicht mehr festgeschrieben ist (gelöscht): Es bleibt im Boot, mit den Startern, die es
      // noch gibt – ob sie damals gefahren sind, weiß nur die Folge, die es nicht mehr gibt.
      const a = ref.a !== null && starterNachId.has(ref.a) ? ref.a : null
      const b = ref.b !== null && starterNachId.has(ref.b) ? ref.b : null
      for (const id of [a, b]) if (id !== null) vorkommend.set(id, starterNachId.get(id)!)
      return { key: g.key, starter: a ?? b ?? '', lauf: ref.attempt, punkt: rundenPunkt(ref.runde), titel: paarTitel(ref.runde, ref.attempt, undefined, texte, sprache), paar: { attempt: ref.attempt, a, b } }
    }
    const p = starterNachId.get(ref.starter)
    if (p) vorkommend.set(ref.starter, p)
    return { key: g.key, starter: ref.starter, lauf: ref.lauf, punkt: punktVonLauf(stand, ref.lauf), titel: texte.lauf(ref.lauf) }
  }

  // Die Startabstände misst die Sicht gleich mit (aus der schon gerechneten Folge jedes Bereichs).
  const klasseVon = klasseNachStarter(stand)
  const gemessen: Messung[] = []
  const bereiche = bereicheZumStand(stand).map((b): SichtBereich => {
    const l = lage(stand, b.id)
    const betrieb = betriebVon(stand, b.id)
    gemessen.push(...messungenIn(b.id, betrieb.gezeigt, l.folge, betrieb.ohneAnzeige, klasseVon))
    const aktuell = gezeigt(l.aktuell)
    return {
      id: b.id,
      // Der Parallelslalom hat keinen Namen im Stand: in der Sprache der Tafel.
      name: b.art === 'parallel' ? tIn(sprache, 'anzeige.parallel') : texte.parcoursName(b.name),
      art: b.art,
      fest: l.fest,
      punkt: sichtPunkt(stand, l.laufend, texte),
      naechsterPunkt: sichtPunkt(stand, l.naechsterPunkt, texte),
      aktuell,
      vorig: gezeigt(l.vorig),
      seit: aktuell ? l.aktuell!.zeit : null,
      offen: l.frei.slice(0, stand.anzeige.amSteg + stand.anzeige.vorSteg + 1).map(start),
      offenZahl: l.frei.length,
      nachzuholen: l.nachzuholen.map(start),
      meldung: betrieb.meldung,
      begonnen: l.begonnen,
      waehlbar: l.offen.map(start),
      zurueckgestellt: l.zurueckgestellt.map(start),
      bootFehlt: l.bootFehlt.map(start),
      arbeitsPunkt: sichtPunkt(stand, l.arbeitsPunkt, texte),
      programm: l.programm.map((p) => sichtPunkt(stand, p, texte)!),
      klassenFolge: klassenFolge(l, stand),
      vorziehen: l.vorziehen,
      abweichend: l.abweichend,
      einstieg: einstiege(l, start),
    }
  })

  const starter: Record<string, SichtStarter> = {}
  const klassen: Partial<Record<ClassId, SichtKlasse>> = {}
  const klasse = (k: ClassId) => (klassen[k] ??= { name: texte.klasseName(k), titel: texte.klasse(k), farbe: classColor(k) })
  for (const [id, p] of vorkommend) {
    starter[id] = { startNr: p.startNr, name: anzeigeName(p, stand), klasse: p.klasse, herkunft: anzeigeHerkunft(p, stand, sprache) }
    klasse(p.klasse)
  }
  // Auch eine ausgesetzte Klasse ohne offenen Start braucht ihren Namen an der Start-Freigabe.
  for (const b of bereiche) for (const k of b.klassenFolge) klasse(k.klasse)
  // Je Klasse der Sicht der Startabstand, wie die Prognose ihn nimmt (gemessen oder Vorgabe), in ganzen Sekunden.
  const jeKlasse = klassenMessungen(gemessen)
  const abstaende: Partial<Record<ClassId, number>> = {}
  for (const k of Object.keys(klassen) as ClassId[]) abstaende[k] = startabstandImBetrieb(stand, k, jeKlasse)

  const mitLogos = (optionen.logos ?? true) && stand.anzeige.logos && (stand.logos.links !== null || stand.logos.rechts !== null)
  return {
    sv: 4,
    kopf: kopfzeile(stand),
    veranstaltung: stand.eventName.trim(),
    sprache,
    skala: stand.anzeige.skala,
    ...(mitLogos ? { logos: { links: stand.logos.links, rechts: stand.logos.rechts } } : {}),
    einst: { davor: stand.anzeige.davor, parcoursName: stand.anzeige.parcoursName, amSteg: stand.anzeige.amSteg, vorSteg: stand.anzeige.vorSteg },
    auswahl: bereicheZumStand(stand, { anzeige: true }).map((b) => b.id),
    klassen,
    abstaende,
    starter,
    bereiche,
  }
}

/** Die Herkunft für die Zuschauersicht, Feld für Feld (siehe {@link sichtZuschauer}). */
function zuschauerHerkunft(h: SichtHerkunft): SichtHerkunft {
  return { text: h.text, klartext: h.klartext, druck: h.druck, alt: h.alt, ...(h.flagge ? { flagge: { art: h.flagge.art, code: h.flagge.code, kuerzel: h.flagge.kuerzel } } : {}) }
}

/**
 * Die Zuschauersicht zur öffentlichen Sicht – die Zuschauerliste (`#/zuschauer`, später der Zuschauer-Link) liest
 * nur sie. Abgeleitet, nicht neu gerechnet: So kann sie nie mehr enthalten als die öffentliche. Je Bereich der
 * Start im Boot, die ganze offene Folge der begonnenen Punkte, deren „Boot fehlt“ und die Meldung; keine
 * Bedienangaben (zur Wahl über alle Läufe, zurückgestellt, nachzuholen, Einstiege, Klassen, Programm), keine
 * Logos, nicht der Name der Veranstaltung außerhalb der Kopfzeile. Starter, Klassen und Abstände nur für die
 * Starts, die hier vorkommen (BETRIEB_ANNAHMEN.zuschauerSchmal). Neue Felder → sicht.test.ts (Schlüssel).
 *
 * Jedes Objekt wird Feld für Feld neu gebaut, auch verschachtelt (Starter, Herkunft, Start, Punkt, Meldung,
 * Klasse) – nie als Referenz durchgereicht: Bekäme die öffentliche Sicht dort ein Feld nur für die Start-Freigabe,
 * landete es sonst still im öffentlichen Link (Prüfung E3, 16.11.2026). Was hier fehlt, sieht kein Zuschauer.
 */
export function sichtZuschauer(sicht: OeffentlicheSicht): ZuschauerSicht {
  const vorkommend = new Set<string>()
  const start = (s: SichtStart): SichtStart => {
    if (s.paar) {
      // Paar (Parallelslalom): beide Seiten, Feld für Feld; eine leere bleibt `null`. Die Kennung nur aus dem, was hier
      // steht – die der öffentlichen Sicht nennt auch den Starter einer leeren Seite (abgemeldet, gelöscht). Eindeutig
      // bleibt sie: Je Runde und Attempt fährt ein Starter in einem Paar, und Entfallene (beide leer) stehen nur als
      // Start im Boot da. So bleiben aktuell, frei und „Boot fehlt“ untereinander gleich benannt (Wartezeiten, v-for).
      const p = s.paar
      for (const id of [p.a, p.b]) if (id !== null) vorkommend.add(id)
      const paar: SichtPaar = { attempt: p.attempt, a: p.a, b: p.b, ...(p.finale ? { finale: p.finale } : {}) }
      return { key: JSON.stringify(['p', s.punkt, p.attempt, p.a, p.b]), starter: s.starter, lauf: s.lauf, punkt: s.punkt, titel: s.titel, paar }
    }
    vorkommend.add(s.starter)
    return { key: s.key, starter: s.starter, lauf: s.lauf, punkt: s.punkt, titel: s.titel }
  }
  const punkt = (p: SichtPunkt | null): SichtPunkt | null => p && { id: p.id, titel: p.titel, laeufe: [...p.laeufe] }
  const bereiche = sicht.bereiche.map((b): ZuschauerBereich => {
    const begonnen = new Set(b.begonnen)
    return {
      id: b.id,
      name: b.name,
      art: b.art,
      punkt: punkt(b.punkt),
      naechsterPunkt: punkt(b.naechsterPunkt),
      aktuell: b.aktuell && start(b.aktuell),
      seit: b.seit,
      frei: freieFolge(b).map(start),
      bootFehlt: b.bootFehlt.filter((s) => begonnen.has(s.punkt)).map(start),
      meldung: b.meldung && { text: b.meldung.text, art: b.meldung.art },
    }
  })
  const starter: Record<string, SichtStarter> = {}
  const klassen: ZuschauerSicht['klassen'] = {}
  const abstaende: ZuschauerSicht['abstaende'] = {}
  for (const id of vorkommend) {
    const p = sicht.starter[id]
    if (!p) continue
    starter[id] = { startNr: p.startNr, name: p.name, klasse: p.klasse, herkunft: p.herkunft && zuschauerHerkunft(p.herkunft) }
    const k = sicht.klassen[p.klasse]
    if (k) klassen[p.klasse] = { name: k.name, titel: k.titel, farbe: k.farbe }
    const a = sicht.abstaende[p.klasse]
    if (a !== undefined) abstaende[p.klasse] = a
  }
  return {
    sv: sicht.sv,
    kopf: sicht.kopf,
    sprache: sicht.sprache,
    einst: { parcoursName: sicht.einst.parcoursName, amSteg: sicht.einst.amSteg, vorSteg: sicht.einst.vorSteg },
    klassen,
    abstaende,
    starter,
    bereiche,
  }
}
