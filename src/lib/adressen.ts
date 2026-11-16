/**
 * Die Wörter der Adresse (`#/listen/wkr`, `#/lists/race-officials`) je Sprache – an EINER Stelle.
 *
 * Aufbau: `#/ansicht/reiter/wahl?ziel`. `wahl` ist eine Auswahl innerhalb des Reiters, die ein
 * Querverweis mitgibt – ein Wert aus den Daten (z. B. ein Verein), deshalb nicht übersetzt,
 * sondern nur kodiert; `*` heißt „alle“ (Verwiegung → Listen → Gewichtslisten).
 *
 * Die internen Namen im Code bleiben deutsch (`ViewName`, die Listenarten, die Sprungziele).
 * Geschrieben wird die Adresse in der Sprache der Oberfläche, gelesen wird jede Sprache: Ein
 * weitergegebener deutscher Verweis geht auch bei englischer Oberfläche auf.
 *
 * Eine weitere Sprache ist eine weitere Tabelle in `ADRESSEN` (der Typ `AdressTabelle` und
 * `Record<Locale, …>` erzwingen sie, sobald die Sprache in i18n/index.ts steht). Ergibt sie
 * mehrdeutige Wörter, gilt für das betroffene Ziel das englische Wort (`wortraum`).
 *
 * Dieses Modul ist rein: keine Adresse des Fensters, keine Sprache der Oberfläche – das macht
 * lib/router.ts.
 */

/** Die Ansichten in der Reihenfolge der Navigation. */
export const VIEWS = ['veranstaltung', 'starter', 'verwiegung', 'verzahnung', 'listen', 'betrieb', 'erfassung', 'einstellungen'] as const
export type ViewName = (typeof VIEWS)[number]

/** Die Reiter je Ansicht, die in der Adresse stehen (zweites Segment). */
export interface ReiterNamen {
  listen: 'starter' | 'gewicht' | 'vorsteg' | 'wkr' | 'laufzettel' | 'codes' | 'ergebnis' | 'pokal' | 'druckdatei'
  verzahnung: 'manoever' | 'parallel'
  /** Betrieb am Wettkampftag (Plan vom 16.11.2026): E1 nur die Start-Freigabe; `startliste` (E3) und `geraete` (E6) folgen. */
  betrieb: 'start'
}
export type ReiterView = keyof ReiterNamen

/**
 * Sprungziele innerhalb einer Ansicht (`#/einstellungen?wertung`): Abschnitte der
 * Einstellungen und, unter „Veranstaltung“, der Block „Besetzung“ (`besetzung`; `wkr` meint
 * darin die WKR-Einteilung) und der Block mit „Alle erfassten Werte löschen“ (`werte`). Für den Betrieb:
 * `anzeigetafel` und `betrieb` („Startfolge im Betrieb“, geschrieben `startfolge` bzw. `start-order`).
 */
export type Sprungziel = 'wkr' | 'besetzung' | 'wertung' | 'ergebnislisten' | 'pokal' | 'dateien' | 'werte' | 'offline' | 'anzeigetafel' | 'betrieb'

/**
 * Fenster mit eigener Wurzel, ohne Kopf, Reiter und Fuß (src/main.ts wählt sie vor dem Store):
 * die Anzeigetafel `#/anzeige[/<bereich>]` (src/AnzeigeApp.vue, Plan vom 16.11.2026). Der Bereich
 * ist eine Kennung aus den Daten (Parcours) – kodiert, nicht übersetzt, wie `wahl`.
 */
export const VOLLBILDER = ['anzeige'] as const
export type VollbildArt = (typeof VOLLBILDER)[number]
export interface Vollbild {
  art: VollbildArt
  /** Nur dieser Bereich (`#/anzeige/<parcours-id>`); ohne = die gemeinsame Anzeigetafel. */
  bereich?: string
}

export interface AdressTabelle {
  ansichten: Record<ViewName, string>
  reiter: { [V in ReiterView]: Record<ReiterNamen[V], string> }
  ziele: Record<Sprungziel, string>
  vollbild: Record<VollbildArt, string>
}

/** Die Sprache, deren Wort gilt, wenn das eigene mehrdeutig ist (Vorgabe des Nutzers). */
export const ADRESS_FALLBACK = 'en'

// Die Wörter folgen den Namen der Reiter in der jeweiligen Oberfläche (i18n/de.ts, en.ts):
// klein, ohne Umlaute und Leerzeichen – eine Adresse soll sich abtippen und vorlesen lassen.
// Die englischen folgen dem UIM Circuit Rulebook, Regel 960 („drivers“, Pkt. 3.7 „list of
// drivers“, „race officials“, „pontoon“, Pkt. 5.2 „results“); die deutschen dem DM-Reglement
// (C7 „Wertungsliste“). Wörter, die früher hier standen, lesen sich weiter ({@link ALTE_ADRESSEN}).
export const ADRESSEN = {
  de: {
    ansichten: {
      veranstaltung: 'veranstaltung',
      starter: 'starter',
      verwiegung: 'verwiegung',
      verzahnung: 'verzahnung',
      listen: 'listen',
      betrieb: 'betrieb',
      erfassung: 'erfassung',
      einstellungen: 'einstellungen',
    },
    reiter: {
      listen: {
        starter: 'starterlisten',
        gewicht: 'gewicht',
        vorsteg: 'vorsteg',
        wkr: 'wkr',
        laufzettel: 'laufzettel',
        codes: 'codes',
        ergebnis: 'wertungslisten',
        pokal: 'mannschaftswertung',
        druckdatei: 'druckdatei',
      },
      verzahnung: { manoever: 'manoever', parallel: 'parallel' },
      betrieb: { start: 'start' },
    },
    ziele: { wkr: 'wkr', besetzung: 'besetzung', wertung: 'wertung', ergebnislisten: 'wertungslisten', pokal: 'mannschaftswertung', dateien: 'dateien', werte: 'werte', offline: 'offline', anzeigetafel: 'anzeigetafel', betrieb: 'startfolge' },
    vollbild: { anzeige: 'anzeige' },
  },
  en: {
    ansichten: {
      veranstaltung: 'event',
      starter: 'drivers',
      verwiegung: 'weighing',
      verzahnung: 'interleaving',
      listen: 'lists',
      // Vorläufig (Plan vom 16.11.2026): Das Rulebook hat kein Wort für den Ablauf am Steg.
      betrieb: 'operation',
      erfassung: 'entry',
      einstellungen: 'settings',
    },
    reiter: {
      listen: {
        starter: 'lists-of-drivers',
        gewicht: 'weights',
        vorsteg: 'pontoon-entry',
        wkr: 'race-officials',
        laufzettel: 'checklists',
        codes: 'codes',
        ergebnis: 'results',
        pokal: 'team-competition',
        // „Results booklet“: das Heft mit allen Ergebnissen, das nach der Veranstaltung verschickt wird.
        druckdatei: 'results-booklet',
      },
      verzahnung: { manoever: 'manoeuvring', parallel: 'parallel' },
      betrieb: { start: 'start' },
    },
    ziele: { wkr: 'race-officials', besetzung: 'assignments', wertung: 'scoring', ergebnislisten: 'results', pokal: 'team-competition', dateien: 'files', werte: 'values', offline: 'offline', anzeigetafel: 'display-board', betrieb: 'start-order' },
    // „Display board“ vorläufig (Plan vom 16.11.2026, §7 Nr. 19) – gegen das Rulebook zu prüfen.
    vollbild: { anzeige: 'display' },
  },
} as const satisfies Record<string, AdressTabelle>

/**
 * Wörter, die früher in der Adresse standen und weiter gelesen werden (Lesezeichen,
 * weitergegebene Verweise) – geschrieben werden sie nie mehr:
 * - Die Mannschaftswertung hieß „Pokalauswertung“ (`pokal` ist zugleich der interne Name und
 *   geht ohnehin auf; englisch `team-ranking`).
 * - Die Starterlisten waren zwei Reiter („verzahnt“ und „nach Klasse“); heute ist es einer mit
 *   der Auswahl „Art“. Der alte Verweis führt zum Reiter und nennt die Art (`art`), die die
 *   Ansicht dann wählt (views/ListsView.vue).
 * - Die WKR-Einteilung stand unter „Einstellungen“ (`#/einstellungen?wkr`); heute steht sie im
 *   Block „Besetzung“ der Ansicht „Veranstaltung“. Der alte Verweis führt dorthin (`umzug`:
 *   Ansicht → Sprungziel → die Ansicht, in der das Ziel heute liegt).
 * - Die Wertungslisten hießen „Ergebnislisten“ (`ergebnis` und `ergebnislisten` sind zugleich
 *   die internen Namen und gehen ohnehin auf; englisch `result-lists`).
 * - Die englischen Wörter folgten nicht dem Rulebook: `competitors` (heute `drivers`),
 *   `competitor-lists` (`lists-of-drivers`), `pre-jetty` (`pontoon-entry`), `judges`
 *   (`race-officials`).
 * Ein Wort, das heute etwas anderes meint, gilt in seiner heutigen Bedeutung.
 */
export interface AlteAdressen {
  /** Frühere Wörter für Ansichten (erstes Segment). */
  ansichten?: Readonly<Record<string, ViewName>>
  reiter: Partial<Record<ReiterView, Readonly<Record<string, { reiter: string; art?: string }>>>>
  ziele: Readonly<Record<string, string>>
  umzug?: Partial<Record<ViewName, Readonly<Partial<Record<string, ViewName>>>>>
}
export const ALTE_ADRESSEN: AlteAdressen = {
  ansichten: { competitors: 'starter' },
  reiter: {
    listen: {
      'competitor-lists': { reiter: 'starter' },
      'pre-jetty': { reiter: 'vorsteg' },
      judges: { reiter: 'wkr' },
      verzahnt: { reiter: 'starter', art: 'verzahnt' },
      interleaved: { reiter: 'starter', art: 'verzahnt' },
      'nach-klasse': { reiter: 'starter', art: 'klasse' },
      'by-class': { reiter: 'starter', art: 'klasse' },
      byclass: { reiter: 'starter', art: 'klasse' },
      'team-ranking': { reiter: 'pokal' },
    },
  },
  ziele: { 'team-ranking': 'pokal', 'result-lists': 'ergebnislisten', judges: 'wkr' },
  umzug: { einstellungen: { wkr: 'veranstaltung' } },
}

/** Internes Ziel → Wort in der Adresse. */
export type Woerter = Readonly<Record<string, string>>

export interface Wortraum {
  /** Je Sprache: das Wort, das für ein Ziel GESCHRIEBEN wird (nach dem Fallback). */
  schreibe: Record<string, Record<string, string>>
  /** Wort (klein geschrieben) → Ziel: was GELESEN wird, gleich in welcher Sprache. */
  lies: Record<string, string>
  /** Wörter, die mehr als ein Ziel meinen – je Sprache und Ziel, für das der Fallback EINGESPRUNGEN ist. */
  ersetzt: { sprache: string; ziel: string; wort: string }[]
  /**
   * Was auch der Fallback nicht löst: zwei Ziele mit demselben Wort in der Fallback-Sprache,
   * oder ein mehrdeutiges Wort, für dessen Ziel der Fallback kein Wort hat.
   */
  fehler: string[]
}

const klein = (wort: string) => wort.trim().toLowerCase()

/**
 * Macht aus den Tabellen aller Sprachen für EINEN Namensraum (die Ansichten; die Reiter einer
 * Ansicht; die Sprungziele) das, was geschrieben und gelesen wird.
 *
 * Regel (Vorgabe des Nutzers: „bei uneindeutigen Namen den englischen Fallback“):
 * - Ein Wort ist mehrdeutig, wenn es – in derselben oder in verschiedenen Sprachen – für
 *   VERSCHIEDENE Ziele steht. Dasselbe Wort für dasselbe Ziel in mehreren Sprachen
 *   („codes“) ist eindeutig.
 * - Für ein Ziel, dessen Wort in einer Sprache mehrdeutig ist, schreibt diese Sprache das Wort
 *   des Fallbacks. Fehlt einer Sprache ein Wort, gilt ebenfalls das des Fallbacks.
 * - Hat auch der Fallback für dieses Ziel kein Wort, schreibt die Sprache den internen Namen
 *   (wie für jedes Ziel ohne Wort) und die Kollision steht in `fehler` – stillschweigend
 *   stehen bleibt ein mehrdeutiges Wort nie.
 * - Gelesen wird jedes geschriebene Wort. Ein mehrdeutiges Wort meint beim Lesen das Ziel des
 *   Fallbacks, wenn es dort vorkommt; sonst liest es niemand mehr als Übersetzung.
 * - Zuletzt gelten die internen Namen, soweit kein Wort sie belegt – alte Verweise gehen
 *   weiter. Das gilt auch für ein mehrdeutiges Wort, das zugleich ein interner Name ist.
 * - Ein leeres Wort zählt wie ein fehlendes.
 */
export function wortraum(tabellen: Readonly<Record<string, Woerter>>, fallback: string = ADRESS_FALLBACK): Wortraum {
  // Ein leeres Wort ergäbe `#/` – es zählt wie ein fehlendes.
  const ohneLeere = (t: Woerter): Woerter => Object.fromEntries(Object.entries(t).filter(([, wort]) => klein(wort) !== ''))
  const alle: Record<string, Woerter> = Object.fromEntries(Object.entries(tabellen).map(([sprache, t]) => [sprache, ohneLeere(t)]))
  const basis: Woerter = alle[fallback] ?? {}
  const ziele = [...new Set(Object.values(tabellen).flatMap((t) => Object.keys(t)))]

  // Welche Ziele meint ein Wort über alle Sprachen?
  const meint = new Map<string, Set<string>>()
  for (const tabelle of Object.values(alle)) {
    for (const [ziel, wort] of Object.entries(tabelle)) {
      const w = klein(wort)
      if (!meint.has(w)) meint.set(w, new Set())
      meint.get(w)!.add(ziel)
    }
  }
  const mehrdeutig = (wort: string) => (meint.get(klein(wort))?.size ?? 0) > 1

  const lies: Record<string, string> = {}
  const fehler: string[] = []
  // Zuerst der Fallback: Seine Wörter gewinnen beim Lesen.
  for (const [ziel, wort] of Object.entries(basis)) {
    const w = klein(wort)
    if (lies[w] !== undefined && lies[w] !== ziel) fehler.push(`„${w}“ steht in „${fallback}“ für „${lies[w]}“ und „${ziel}“`)
    else lies[w] = ziel
  }

  const schreibe: Wortraum['schreibe'] = {}
  const ersetzt: Wortraum['ersetzt'] = []
  for (const [sprache, tabelle] of Object.entries(alle)) {
    schreibe[sprache] = {}
    for (const ziel of ziele) {
      const eigen = tabelle[ziel]
      let wort = eigen
      if (sprache !== fallback && (eigen === undefined || mehrdeutig(eigen))) {
        wort = basis[ziel]
        if (eigen !== undefined) {
          if (wort !== undefined) ersetzt.push({ sprache, ziel, wort: klein(eigen) })
          // Kein englisches Wort zum Ausweichen: Das mehrdeutige bleibt NICHT stehen (eine
          // Sprache läse sonst die Adresse der anderen falsch); geschrieben wird der interne Name.
          else fehler.push(`„${klein(eigen)}“ ist in „${sprache}“ für „${ziel}“ mehrdeutig, und „${fallback}“ hat dafür kein Wort`)
        }
      }
      if (wort === undefined) continue
      const w = klein(wort)
      schreibe[sprache][ziel] = w
      if (lies[w] === undefined) lies[w] = ziel
    }
  }
  for (const ziel of ziele) if (lies[klein(ziel)] === undefined) lies[klein(ziel)] = ziel
  return { schreibe, lies, ersetzt, fehler }
}

export interface Adressbuch {
  ansichten: Wortraum
  reiter: Record<string, Wortraum>
  ziele: Wortraum
  vollbild: Wortraum
}

/** Die Worträume aller drei Stellen der Adresse aus den Tabellen der Sprachen. */
export function adressbuch(tabellen: Readonly<Record<string, AdressTabelle>>, fallback: string = ADRESS_FALLBACK): Adressbuch {
  const je = (waehle: (t: AdressTabelle) => Woerter) => wortraum(Object.fromEntries(Object.entries(tabellen).map(([sprache, t]) => [sprache, waehle(t)])), fallback)
  const reiterViews = [...new Set(Object.values(tabellen).flatMap((t) => Object.keys(t.reiter)))] as ReiterView[]
  return {
    ansichten: je((t) => t.ansichten),
    reiter: Object.fromEntries(reiterViews.map((v) => [v, je((t) => t.reiter[v])])),
    ziele: je((t) => t.ziele),
    vollbild: je((t) => t.vollbild),
  }
}

/** Eine Adresse in ihren Teilen. `view` fehlt, wenn die Adresse keine bekannte Ansicht nennt. */
export interface Ort {
  view?: ViewName
  /** Interner Name des Reiters; ein unbekanntes Wort bleibt, wie es dasteht. */
  reiter: string
  /** Interner Name des Sprungziels; ein unbekanntes Wort bleibt, wie es dasteht. */
  ziel: string
  /** Nur bei einem alten Verweis ({@link ALTE_ADRESSEN}): die Auswahl innerhalb des Reiters, die er meinte. */
  art?: string
  /** Drittes Segment: eine Auswahl innerhalb des Reiters, wie ein Querverweis sie mitgibt (nicht übersetzt). */
  wahl?: string
}

function entschluesselt(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/** Liest `#/ansicht/reiter?ziel` – in jeder Sprache des Adressbuchs. */
export function liesAdresse(buch: Adressbuch, hash: string, alte: AlteAdressen = ALTE_ADRESSEN): Ort {
  const [pfad, frage = ''] = hash.replace(/^#\/?/, '').split('?')
  const [a = '', r = '', w = ''] = pfad.split('/').map(entschluesselt)
  const view = (buch.ansichten.lies[klein(a)] ?? alte.ansichten?.[klein(a)]) as ViewName | undefined
  const raum = view ? buch.reiter[view] : undefined
  // Ein heutiges Wort gewinnt; erst danach gelten die früheren.
  const frueher = view && r !== '' && raum?.lies[klein(r)] === undefined ? alte.reiter[view as ReiterView]?.[klein(r)] : undefined
  const z = klein(entschluesselt(frage))
  const ziel = frage === '' ? '' : (buch.ziele.lies[z] ?? alte.ziele[z] ?? frage)
  return {
    // Ein Ziel, das in eine andere Ansicht umgezogen ist, führt dorthin.
    view: (view && alte.umzug?.[view]?.[ziel]) ?? view,
    reiter: r === '' ? '' : (raum?.lies[klein(r)] ?? frueher?.reiter ?? r),
    ziel,
    ...(frueher?.art ? { art: frueher.art } : {}),
    // Eine Auswahl gibt es nur unter einem Reiter.
    ...(w !== '' && r !== '' ? { wahl: w } : {}),
  }
}

/** Schreibt die Adresse in einer Sprache; eine unbekannte Sprache schreibt wie der Fallback. */
export function schreibeAdresse(
  buch: Adressbuch,
  sprache: string,
  view: ViewName,
  teile: { reiter?: string; ziel?: string; wahl?: string } = {},
  fallback: string = ADRESS_FALLBACK,
): string {
  const wort = (raum: Wortraum | undefined, ziel: string) => raum?.schreibe[sprache]?.[ziel] ?? raum?.schreibe[fallback]?.[ziel] ?? ziel
  const reiter = teile.reiter ? `/${wort(buch.reiter[view], teile.reiter)}` : ''
  // Ein Wert aus den Daten: kodiert, damit „/“, „?“ oder „#“ in einem Vereinsnamen die Adresse nicht zerlegen.
  const wahl = teile.reiter && teile.wahl ? `/${encodeURIComponent(teile.wahl)}` : ''
  const ziel = teile.ziel ? `?${wort(buch.ziele, teile.ziel)}` : ''
  return `#/${wort(buch.ansichten, view)}${reiter}${wahl}${ziel}`
}

/**
 * Liest ein Fenster mit eigener Wurzel (`#/anzeige`, `#/display/<bereich>`) – in jeder Sprache;
 * `null` für jede gewöhnliche Adresse. Rein: src/main.ts fragt das, bevor ein Store entsteht.
 */
export function liesVollbild(buch: Adressbuch, hash: string): Vollbild | null {
  const [pfad = ''] = hash.replace(/^#\/?/, '').split('?')
  const [a = '', b = ''] = pfad.split('/').map(entschluesselt)
  const art = buch.vollbild.lies[klein(a)] as VollbildArt | undefined
  if (!art) return null
  return b !== '' ? { art, bereich: b } : { art }
}

/** Schreibt die Adresse eines solchen Fensters in einer Sprache; der Bereich bleibt, wie er ist (kodiert). */
export function schreibeVollbild(buch: Adressbuch, sprache: string, v: Vollbild, fallback: string = ADRESS_FALLBACK): string {
  const wort = buch.vollbild.schreibe[sprache]?.[v.art] ?? buch.vollbild.schreibe[fallback]?.[v.art] ?? v.art
  return `#/${wort}${v.bereich ? `/${encodeURIComponent(v.bereich)}` : ''}`
}
