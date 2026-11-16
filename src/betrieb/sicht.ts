import type { Locale } from '../i18n'
import type { AppState, ClassId, OeffentlicheSicht, PunktId, SichtBereich, SichtHerkunft, SichtKlasse, SichtPunkt, SichtStart, SichtStarter, Starter } from '../types'
import { regelwerkOf } from '../config/catalog'
import { bogenTexte, type BogenTexte } from '../config/sprache'
import { classColor } from '../domain/classes'
import { listenNachname } from '../lib/namen'
import { starterHerkunft } from '../lib/origin'
import { laenderKuerzelFuer, regelwerkSprache } from '../lib/listensprache'
import { bereicheZumStand, betriebVon, laeufeVonPunkt, lage, punktVonLauf, type FolgeEintrag, type GezeigtEintrag } from './folge'

// Die öffentliche Sicht auf den Betrieb – die EINE Stelle, an der entschieden wird, was Anzeigetafel,
// Zuschauer und Start-Freigabe vom Stand zu sehen bekommen (Plan vom 16.11.2026, §1 und §3). Andere
// Geräte bekommen nie den Stand, nur dies; die Anzeigetafel am Bedienrechner liest dasselbe.
//
// Datenschutz (es geht um Minderjährige, Links werden weitergegeben): nie Geburtsdatum, Gewicht,
// Geschlecht, Ausgleichsgewicht, erfasste Werte oder Abmeldungen. Nur Starter, die in der Sicht
// vorkommen, und von ihnen Startnummer, Name nach der Einstellung, Klasse und Herkunft.
//
// Zeitunabhängig: Die Sicht ändert sich nur, wenn sich der Stand ändert – „seit m:ss“ rechnet der
// Bildschirm aus `seit` und seiner Uhr. Texte stehen in der Sprache der Anzeigetafel (Bogentexte,
// config/sprache.ts); Bedienelemente übersetzt die Oberfläche selbst.

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

function sichtPunkt(stand: AppState, punkt: PunktId | null, texte: BogenTexte): SichtPunkt | null {
  if (punkt === null) return null
  const laeufe = laeufeVonPunkt(stand, punkt)
  return { id: punkt, titel: laeufe.map((n) => texte.lauf(n)).join(' / '), laeufe }
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
    // Parallelslalom (`p`) kommt mit E4 und bringt dort seine eigene Form des Starts in der Sicht.
    if (!ref || ref.art !== 'm') return null
    const p = starterNachId.get(ref.starter)
    if (p) vorkommend.set(ref.starter, p)
    return { key: g.key, starter: ref.starter, lauf: ref.lauf, punkt: punktVonLauf(stand, ref.lauf), titel: texte.lauf(ref.lauf) }
  }

  const bereiche = bereicheZumStand(stand).map((b): SichtBereich => {
    const l = lage(stand, b.id)
    const aktuell = gezeigt(l.aktuell)
    return {
      id: b.id,
      name: texte.parcoursName(b.name),
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
      meldung: betriebVon(stand, b.id).meldung,
    }
  })

  const starter: Record<string, SichtStarter> = {}
  const klassen: Partial<Record<ClassId, SichtKlasse>> = {}
  for (const [id, p] of vorkommend) {
    starter[id] = { startNr: p.startNr, name: anzeigeName(p, stand), klasse: p.klasse, herkunft: anzeigeHerkunft(p, stand, sprache) }
    klassen[p.klasse] ??= { name: texte.klasseName(p.klasse), titel: texte.klasse(p.klasse), farbe: classColor(p.klasse) }
  }

  const mitLogos = (optionen.logos ?? true) && stand.anzeige.logos && (stand.logos.links !== null || stand.logos.rechts !== null)
  return {
    sv: 1,
    kopf: kopfzeile(stand),
    sprache,
    skala: stand.anzeige.skala,
    ...(mitLogos ? { logos: { links: stand.logos.links, rechts: stand.logos.rechts } } : {}),
    einst: { davor: stand.anzeige.davor, parcoursName: stand.anzeige.parcoursName },
    auswahl: bereicheZumStand(stand, { anzeige: true }).map((b) => b.id),
    klassen,
    starter,
    bereiche,
  }
}
