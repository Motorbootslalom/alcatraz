import type { AppState, ClassId, OriginMode, Sprache, Starter } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { SCHEMA_VERSION } from '../types'
import { emptyState, laufzettelLayoutWert, leerzeilenZahl, normalisiereAnzeige, normalisiereBetrieb, normalisiereWkr, streichlaeufeWert, teilenAbZahl, zeilenJeSeiteZahl } from './reducer'
import { aufbauOf, beschriftungOf, hasParallel, PARALLEL, regelwerkOf } from '../config/catalog'
import { normalisiereZusatzListen } from '../lib/listen'
import { ID_MUSTER } from '../config/eigene'
import type { RawAufbau } from '../config/schema'
import { normalisiereEinteilung, normalisiereSprachen } from '../lib/einteilung'
import { normalisiereBesetzung } from '../lib/besetzung'
import { normalisiereEingaben, nurStarter } from '../lib/eingaben'
import { istKennung } from '../lib/qr'
import { configFor } from '../config/konfig'
import { isSprache } from '../config/sprache'
import { bietetEnglisch, regelwerkSprache } from '../lib/listensprache'
import { pokalWert } from '../config/pokal'
import { normalisiereAbgemeldet, normalisiereAbgemeldetBis } from '../lib/abmeldung'
import { istOriginStyle } from '../lib/origin'
import type { ErgebnisHerkunft } from '../types'
import { mitVorlaufPlan, normalisierePlaene } from '../planung/parallelRunden'
import { normalisiereNichtWerten } from '../lib/disziplinen'
import { istGeschlecht } from '../domain/geschlecht'
import { logoHoeheZahl, logoWert } from '../lib/logo'
import { serverEinstellung } from '../lib/serverAdresse'
import { normalisiereFehlende, normalisiereStartNrBereiche } from './reducer/startnummern'
import { normalisiereGedruckt } from './reducer/parallel'

/** Herkunft auf den Wertungslisten: „aus“ oder eine Darstellung der Listen; alles andere ist unbekannt. */
const ergebnisHerkunft = (wert: unknown): ErgebnisHerkunft | undefined => (wert === 'aus' || istOriginStyle(wert) ? wert : undefined)

/**
 * Einen gelesenen Stand (localStorage, Sicherungsdatei) auf die aktuelle Fassung
 * bringen. Unbekanntes oder Kaputtes ergibt `null` – dann beginnt die
 * Anwendung leer, statt mit halben Daten zu rechnen.
 *
 * Neue Fassungen bekommen hier einen Schritt `if (version < n) { … }`; die
 * Schritte laufen der Reihe nach, sodass auch alte Sicherungen lesbar bleiben.
 *
 * `oberflaeche`: die Sprache der Oberfläche dieses Geräts, soweit der Aufrufer sie kennt
 * (persistenz/). Sie gehört nicht zum Stand; gebraucht wird sie nur für alte Stände, deren
 * Bögen „wie die Oberfläche“ gedruckt wurden (`alteWkrSprachen`).
 */
export function migrate(raw: unknown, optionen: { oberflaeche?: string } = {}): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  // VOR allen Normalisierern: normalisierePlaene wirft das alte Feld `finale` weg (21.11.2026).
  const loaded = teileAlteFinals(raw as Record<string, unknown>) as Partial<AppState>
  if (!Array.isArray(loaded.starters)) return null
  if (typeof loaded.schemaVersion === 'number' && loaded.schemaVersion > SCHEMA_VERSION) return null

  const base = emptyState()
  // Eine Kennung gilt einmal, der erste Eintrag gewinnt: Zwei gleiche wären in der Liste
  // nicht zu unterscheiden (Bearbeiten träfe den ersten, Löschen beide).
  const gesehen = new Set<string>()
  const eigeneAufbauten = (Array.isArray(loaded.eigeneAufbauten) ? loaded.eigeneAufbauten.filter(isAufbau) : []).filter(
    (a) => !gesehen.has(a.id) && !!gesehen.add(a.id),
  )
  const parcoursList = Array.isArray(loaded.parcoursList) ? loaded.parcoursList : base.parcoursList
  const parcoursIds = parcoursList.map((p) => p?.id).filter((id): id is string => typeof id === 'string')
  const starters = loaded.starters.map(normalizeStarter)
  const abgemeldet = normalisiereAbgemeldet(loaded.abgemeldet, new Set(starters.map((p) => p.id)))
  // Bis zur Sprache je Liste gab es eine Wahl für alle Listen (`listenSprache`). Das Feld
  // entfällt; was daraus für die Bögen wird, steht unten bei `wkrSprachen`.
  // Ebenso `pokalStand` (eigene Zeitpunkte der Mannschaftswertung): Ihr Zeitpunkt ist jetzt der
  // jüngste der Gesamtlisten (lib/listenStand.ts `wertungZeit`).
  // `gespeichert` ist die Speichermarke (persistenz/storage.ts): Sie gehört zum Speichern, nicht zum Stand.
  // `parallelInternational` (nationaler Parallelslalom bis Klasse 7) war ohne Wirkung: Den
  // Parallelslalom gibt es nur nach Regel 960, also bis Klasse 5. Alte Sicherungen tragen das Feld noch.
  const {
    listenSprache: alteSprache,
    pokalStand: _pokalStand,
    gespeichert: _gespeichert,
    parallelInternational: _parallelInternational,
    ...uebernommen
  } = loaded as Partial<AppState> & { listenSprache?: unknown; pokalStand?: unknown; gespeichert?: unknown; parallelInternational?: unknown }
  const regelwerk = regelwerkOf(loaded.regelwerk ?? '').id
  const stand: AppState = {
    ...base,
    ...uebernommen,
    schemaVersion: SCHEMA_VERSION,
    starters,
    // Fehlen in Ständen vor der Erfassung. Werte von Startern, die es nicht (mehr) gibt, entfallen.
    eingaben: nurStarter(normalisiereEingaben(loaded.eingaben), new Set(starters.map((p) => p.id))),
    // Fehlt in Ständen vor dem Abmelden; IDs ohne Starter entfallen.
    abgemeldet,
    abgemeldetBis: normalisiereAbgemeldetBis(loaded.abgemeldetBis, abgemeldet),
    streichlaeufe: streichlaeufeWert(loaded.streichlaeufe),
    laufCount: Math.max(1, Math.min(9, Math.round(Number(loaded.laufCount)) || base.laufCount)),
    // Fehlt in Ständen vor diesem Schalter: Dann gilt die Vorgabe des Regelwerks (aus – unter
    // Regel 960 eine Option, die nicht vorgewählt ist).
    versucheNacheinander: typeof loaded.versucheNacheinander === 'boolean' ? loaded.versucheNacheinander : regelwerkOf(regelwerk).versucheNacheinander === true,
    parcoursList,
    boats: { ...base.boats, ...loaded.boats },
    // Kennungen, die es nicht (mehr) gibt, fallen auf die Vorgabe zurück.
    regelwerk: regelwerkOf(loaded.regelwerk ?? '').id,
    eigeneAufbauten,
    // Auch ein eigener, den die Fachprüfung ablehnt, ist nicht wählbar (config/catalog.ts).
    aufbau: aufbauOf(loaded.aufbau ?? '', eigeneAufbauten).id,
    sollgewicht: ownWeights(loaded.sollgewicht, regelwerkOf(loaded.regelwerk ?? '').gewichte),
    verzahnungLocked: loaded.verzahnungLocked === true,
    showBirthdate: loaded.showBirthdate !== false,
    // Stände vor den Flaggen kennen nur „kurz“ und „lang“ – beide gelten weiter; Unbekanntes wird die Vorgabe.
    listOrigin: istOriginStyle(loaded.listOrigin) ? loaded.listOrigin : 'lang',
    originShort: { ...loaded.originShort },
    // Fehlt in Ständen vor der WKR-Einteilung; Unbrauchbares entfällt – auch Namen zu
    // Parcours, die es nicht (mehr) gibt.
    einteilung: normalisiereEinteilung(loaded.einteilung, parcoursIds),
    // Fehlen in Ständen vor dem Block „Besetzung“; Unbrauchbares entfällt.
    boote: normalisiereBesetzung(loaded.boote),
    coPiloten: normalisiereBesetzung(loaded.coPiloten),
    // Fehlen in Ständen vor den Wettkampfrichter-Listen.
    wkrLeerzeilen: leerzeilenZahl(loaded.wkrLeerzeilen) ?? base.wkrLeerzeilen,
    wkrLeerzeilenKlasse: eigeneLeerzeilen(loaded.wkrLeerzeilenKlasse, leerzeilenZahl(loaded.wkrLeerzeilen) ?? base.wkrLeerzeilen),
    // Fehlt in Ständen vor den geteilten Leerzeilen: Dann gilt die Vorgabe (drei je Seite).
    wkrLeerzeilenSeite: leerzeilenZahl(loaded.wkrLeerzeilenSeite) ?? base.wkrLeerzeilenSeite,
    wkrRueckseite: loaded.wkrRueckseite === true,
    // Vorgabe an: Wirkt ohnehin nur bei der Clubmeisterschaft, und dort ist Papier sparen das Übliche.
    wkrClubGemeinsam: loaded.wkrClubGemeinsam !== false,
    ergebnisListen: {
      aushang: {
        namen: (['voll', 'kurz', 'ohne'] as const).find((n) => n === loaded.ergebnisListen?.aushang?.namen) ?? base.ergebnisListen.aushang.namen,
        herkunft: ergebnisHerkunft(loaded.ergebnisListen?.aushang?.herkunft) ?? base.ergebnisListen.aushang.herkunft,
      },
      intern: { herkunft: ergebnisHerkunft(loaded.ergebnisListen?.intern?.herkunft) ?? base.ergebnisListen.intern.herkunft },
    },
    // Fehlt in Ständen vor den QR-Codes; der Store vergibt dann eine.
    kennung: istKennung(loaded.kennung) ? loaded.kennung : '',
    // Fehlt in Ständen vor dem Zeitpunkt auf den Wertungslisten: Dann ist er unbekannt, und
    // die Listen zeigen keinen (lib/listenStand.ts) – bis zu ihrer nächsten Änderung.
    listenStand: listenStandVon(loaded.listenStand),
    // Fehlt in Ständen vor dieser Angabe; ohne Starter gibt es kein Beispiel-Starterfeld.
    beispielStarter: loaded.beispielStarter === true && starters.length > 0,
    // Fehlen in Ständen vor diesen Listenoptionen: automatische Aufteilung, R/L, Sprache der Oberfläche.
    wkrZeilenJeSeite: zeilenJeSeiteZahl(loaded.wkrZeilenJeSeite),
    wkrTeilenAb: teilenAbZahl(loaded.wkrTeilenAb),
    beschriftung: beschriftungOf(loaded.beschriftung),
    // Je Parcours und Liste (Entscheidung des Nutzers vom 15.11.2026). Die frühere Wahl je Liste
    // gilt für jeden Parcours und beide Racecourses; Sprachen zu Parcours, die es nicht (mehr)
    // gibt, entfallen wie deren Namen (lib/einteilung.ts `normalisiereSprachen`).
    wkrSprachen: normalisiereSprachen(
      loaded.wkrSprachen === undefined ? alteWkrSprachen(alteSprache, regelwerk, eigeneAufbauten, optionen.oberflaeche) : loaded.wkrSprachen,
      parcoursIds,
    ),
    // Fehlen in Ständen vor diesen Optionen: getrennte Listen, die Vorgabe des Regelwerks
    // (damit die Knoten-Liste), Laufzettel mit einer Zeile je Seite.
    tor5MitParcours: loaded.tor5MitParcours === true,
    zusatzListen: normalisiereZusatzListen(loaded.zusatzListen),
    laufzettelLayout: laufzettelLayoutWert(loaded.laufzettelLayout),
    // Fehlt in Ständen vor der Pokalauswertung: Dann gilt die Vorgabe des Regelwerks, alle Starter zählen.
    pokal: pokalWert(loaded.pokal),
    startNrMode: loaded.startNrMode === 'klassisch' ? 'klassisch' : 'klasse',
    // `enabled` stammt aus dem Prototyp (Nummern als Zusatz); hier gibt es nur eine Art je Veranstaltung.
    runningNumbers: { ...base.runningNumbers, ...loaded.runningNumbers, enabled: false },
    // Fehlt in Ständen vor der Paarung nach Klassen: Dann gilt die Vorgabe der Regel (Regel 960,
    // Pkt. 4.4 „Two drivers from the same class“) – die frühere Paarung nur nach Bootstyp gibt es nicht mehr.
    parallelStreng: loaded.parallelStreng !== false,
    parallelPlaene: normalisierePlaene(loaded.parallelPlaene),
    // Fehlt in Ständen vor dem Druckvermerk (20.11.2026): keine Runde gilt als gedruckt.
    parallelGedruckt: normalisiereGedruckt(loaded.parallelGedruckt, normalisierePlaene(loaded.parallelPlaene)),
    // Fehlen in Ständen vor diesen Angaben: jede gefahrene Disziplin zählt, Dolphin-Nummern mit E.
    nichtWerten: normalisiereNichtWerten(loaded.nichtWerten),
    dolphinPraefix: loaded.dolphinPraefix === 'D' ? 'D' : 'E',
    // Fehlen in Ständen vor den Startnummern-Bereichen (19.11.2026): die Vorgabe des Regelwerks, keine fehlenden.
    startNrBereiche: normalisiereStartNrBereiche(loaded.startNrBereiche),
    fehlendeStartNr: normalisiereFehlende(loaded.fehlendeStartNr),
    // Vorgabe an (Entscheidung des Nutzers vom 15.11.2026); nur ein ausdrückliches „aus“ bleibt aus.
    parallelZebra: loaded.parallelZebra !== false,
    // Fehlen in Ständen vor den Logos (16.11.2026): keine, Vorgabehöhe. Fremde Adressen, Zu-Großes und Maße ≤ 0 entfallen.
    logos: { links: logoWert(loaded.logos?.links), rechts: logoWert(loaded.logos?.rechts) },
    logoHoeheMm: logoHoeheZahl(loaded.logoHoeheMm),
    // Fehlen in Ständen vor dem Betrieb (16.11.2026): nichts begonnen, Vorgaben der Anzeigetafel. Bereiche,
    // die es nicht (mehr) gibt, entfallen – im Betrieb wie in der Auswahl der Anzeigetafel.
    betrieb: normalisiereBetrieb(loaded.betrieb, [...parcoursIds, PARALLEL]),
    anzeige: normalisiereAnzeige(loaded.anzeige, [...parcoursIds, PARALLEL]),
    // Fehlt in Ständen vor dem Gerätebetrieb (E6, 16.11.2026); Unbrauchbares heißt: die Vorgabe des Programms.
    geraeteServer: serverEinstellung(loaded.geraeteServer) ?? '',
    // Fehlt in Ständen vor der digitalen WKR-Erfassung (W1, 21.11.2026): keine Liste digital, nichts offen.
    // Unbrauchbares entfällt einzeln; Rückfragen und Vorschläge zu Startern, die es nicht (mehr) gibt, ebenso.
    wkr: normalisiereWkr(loaded.wkr, new Set(starters.map((p) => p.id))),
  }
  // Ein Stand mit festgeschriebener Verzahnung aus der Zeit vor den festen Plänen bekommt seinen
  // Plan des Vorlaufs jetzt – einmal, danach wird er nicht mehr neu gerechnet. Ohne Sperre bleibt
  // der Stand, wie er ist: Ein Plan, der bei freigegebener Verzahnung noch da ist, entfällt nur
  // über „Werte löschen“ (state/reducer.ts), nicht beim Neuladen.
  return stand.verzahnungLocked ? mitVorlaufPlan(stand, hasParallel(regelwerk)) : stand
}

// ---- Kleines Finale und Finale getrennt (21.11.2026) -------------------------------------------

const istObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

/**
 * Stände bis 21.11.2026 hatten EINE Runde `final` mit beiden Finals (Starts mit `finale: 1` bzw.
 * `finale: 3`). Seit dem Auftrag des Nutzers vom 21.11.2026 („Kleines und großes Finale ist
 * getrennt, wie Vorlauf und Halbfinale“) sind es zwei Runden, `small` und `final`. Abwärts-
 * kompatibilität ist nicht nötig – aber ein alter Stand darf nicht abstürzen und soll, wo es
 * sauber geht, nichts verlieren. Rein, wirft nie; ein neuer Stand (kein Start mit `finale`)
 * bleibt dieselbe Referenz, zweimal angewandt ändert nichts. Gilt für jeden Weg über migrate():
 * localStorage, Sicherung, Vorlage, Verlauf (VerlaufPanel → migrate → LOAD_STATE).
 *
 * „Sauber“: Der Plan `final` hat ein Array `starts`, einen Plan `small` gibt es noch nicht, jeder
 * Start trägt `finale` 1 oder 3 und eine Klasse, je Klasse höchstens ein Paar je Finale und kein
 * Starter in beiden. Dann AUFTEILEN: `small` bekommt die Starts mit `finale: 3`, `final` die mit
 * `finale: 1`, je in der alten Reihenfolge (die gedruckte Folge bleibt, nichts wird neu verzahnt;
 * Blöcke je Plan dicht neu gezählt). Die Werte des Kleinen Finales ziehen von `parallel:final/n`
 * nach `parallel:small/n` (Zeile = Starter-ID, also eindeutig; Disq, Bemerkung und „erfasst“
 * ziehen mit der Zeile). Ein Druckvermerk gilt für beide; war `runde:final` im Betrieb begonnen,
 * ist es `runde:small` (es lief zuerst) – `runde:final` bleibt nur, wenn ein Start des Finales schon
 * gezeigt oder ohne Anzeige erledigt ist. Kennungen von Starts des Kleinen Finales im Betrieb
 * werden umgeschrieben; eine händische Reihenfolge, die solche enthält, entfällt (einfacher, nur
 * die Umstellung geht verloren). Zeitpunkte der Listen `parallel:final/…` entfallen – sie werden
 * neu gerechnet, ihr Zeitpunkt ist dann unbekannt.
 *
 * Sonst VERWERFEN: der Plan `final`, seine Werte, sein Druckvermerk, sein Punkt und seine
 * Kennungen im Betrieb, die Zeitpunkte seiner Listen. klassenStand bietet danach aus dem
 * Halbfinale beide Finals neu an – Werte gehen so nur bei kaputten Daten verloren.
 *
 * Hingenommen: Alte gedruckte QR-Codes `…FINAL…` von Bögen des Kleinen Finales treffen danach den
 * Bogen des Finales (keine Abwärtskompatibilität nötig).
 */
export function teileAlteFinals(roh: Record<string, unknown>): Record<string, unknown> {
  try {
    return teile(roh)
  } catch {
    // Darf nie werfen (unbekannte Formen): Dann bleibt der Stand, normalisierePlaene nimmt das alte Feld weg.
    return roh
  }
}

function teile(roh: Record<string, unknown>): Record<string, unknown> {
  const plaene = roh.parallelPlaene
  if (!istObj(plaene) || !istObj(plaene.final)) return roh
  const starts: unknown = plaene.final.starts
  // Nur ein alter Stand trägt `finale` – ohne bleibt alles, wie es ist (neuer Stand, zweites Anwenden).
  const alt = Array.isArray(starts) && starts.some((x) => istObj(x) && 'finale' in x)
  const kaputt = !Array.isArray(starts)
  if (!alt && !kaputt) return roh
  const liste = (Array.isArray(starts) ? starts : []) as Record<string, unknown>[]

  const sauber =
    !kaputt &&
    plaene.small === undefined &&
    liste.every((x) => istObj(x) && (x.finale === 1 || x.finale === 3) && typeof x.klasse === 'string') &&
    (() => {
      const paare = new Map<string, number>()
      for (const x of liste) if (x.attempt === 1) paare.set(`${String(x.klasse)}|${String(x.finale)}`, (paare.get(`${String(x.klasse)}|${String(x.finale)}`) ?? 0) + 1)
      if ([...paare.values()].some((n) => n > 1)) return false
      const ids = (f: 1 | 3) => new Set(liste.filter((x) => x.finale === f).flatMap((x) => [x.a, x.b]).filter((id): id is string => typeof id === 'string'))
      const eins = ids(1)
      return ![...ids(3)].some((id) => eins.has(id))
    })()

  const ohneFinale = (xs: Record<string, unknown>[]) => {
    const bloecke = new Map<unknown, number>()
    return xs.map(({ finale: _f, ...rest }) => {
      if (!bloecke.has(rest.block)) bloecke.set(rest.block, bloecke.size)
      return { ...rest, block: bloecke.get(rest.block) }
    })
  }

  if (sauber) {
    const klein = liste.filter((x) => x.finale === 3)
    const gross = liste.filter((x) => x.finale === 1)
    const kleinIds = new Set(klein.flatMap((x) => [x.a, x.b]).filter((id): id is string => typeof id === 'string'))
    const { final: _alt, ...rest } = plaene
    const neuePlaene: Record<string, unknown> = {
      ...rest,
      ...(klein.length > 0 ? { small: { runde: 'small', starts: ohneFinale(klein) } } : {}),
      ...(gross.length > 0 ? { final: { runde: 'final', starts: ohneFinale(gross) } } : {}),
    }
    if (klein.length === 0) return { ...roh, parallelPlaene: neuePlaene }
    // Werte des Kleinen Finales ziehen um.
    let eingaben = roh.eingaben
    if (istObj(eingaben)) {
      const neu: Record<string, unknown> = { ...eingaben }
      for (const attempt of [1, 2]) {
        const von = `parallel:final/${attempt}`
        const nach = `parallel:small/${attempt}`
        const zeilen = neu[von]
        if (!istObj(zeilen)) continue
        const bleibt = Object.fromEntries(Object.entries(zeilen).filter(([id]) => !kleinIds.has(id)))
        const zieht = Object.fromEntries(Object.entries(zeilen).filter(([id]) => kleinIds.has(id)))
        if (Object.keys(zieht).length === 0) continue
        neu[nach] = { ...(istObj(neu[nach]) ? neu[nach] : {}), ...zieht }
        if (Object.keys(bleibt).length === 0) delete neu[von]
        else neu[von] = bleibt
      }
      eingaben = neu
    }
    const gedruckt = istObj(roh.parallelGedruckt) && roh.parallelGedruckt.final !== undefined ? { ...roh.parallelGedruckt, small: roh.parallelGedruckt.final } : roh.parallelGedruckt
    // Begonnen hieß im alten Modell meist nur: Das Kleine Finale lief (es kam zuerst). Das neue Finale
    // gilt nur dann als begonnen, wenn schon einer seiner Starts gezeigt (oder ohne Anzeige erledigt)
    // ist – sonst bände rundeGebunden es, und die Start-Freigabe gäbe es ohne „Finale beginnen“ frei
    // (Befund der Prüfung, 21.11.2026).
    const istFinalStart = (key: unknown) => {
      const ref = kennung(key)
      return ref !== null && !kleinIds.has(ref.a as string) && !kleinIds.has(ref.b as string)
    }
    const begonneneFinals = (b: Record<string, unknown>): unknown[] => {
      const alt = (b.begonnen as unknown[]).filter((p) => p !== 'runde:final' && p !== 'runde:small')
      const finaleLief = (Array.isArray(b.gezeigt) && b.gezeigt.some((g) => istObj(g) && istFinalStart(g.ref))) || (Array.isArray(b.ohneAnzeige) && b.ohneAnzeige.some(istFinalStart))
      return [...alt, 'runde:small', ...(finaleLief ? ['runde:final'] : [])]
    }
    // Die Kennung eines Starts des Kleinen Finales: `['p','final',…]` → `['p','small',…]`.
    const umschreiben = (key: unknown): unknown => {
      const ref = kennung(key)
      return ref && (kleinIds.has(ref.a as string) || kleinIds.has(ref.b as string)) ? JSON.stringify(['p', 'small', ref.attempt, ref.a, ref.b]) : key
    }
    return {
      ...roh,
      parallelPlaene: neuePlaene,
      eingaben,
      parallelGedruckt: gedruckt,
      betrieb: mitParallelBetrieb(roh.betrieb, (b) => ({
        ...b,
        begonnen: Array.isArray(b.begonnen) && b.begonnen.includes('runde:final') ? begonneneFinals(b) : b.begonnen,
        gezeigt: Array.isArray(b.gezeigt) ? b.gezeigt.map((g) => (istObj(g) ? { ...g, ref: umschreiben(g.ref) } : g)) : b.gezeigt,
        ohneAnzeige: Array.isArray(b.ohneAnzeige) ? b.ohneAnzeige.map(umschreiben) : b.ohneAnzeige,
        zurueckgestellt: Array.isArray(b.zurueckgestellt) ? b.zurueckgestellt.map(umschreiben) : b.zurueckgestellt,
        reihenfolge: Array.isArray(b.reihenfolge) && b.reihenfolge.some((k) => umschreiben(k) !== k) ? null : b.reihenfolge,
      })),
      listenStand: ohneFinalListen(roh.listenStand),
    }
  }

  // Verwerfen: alles, was an der Runde `final` hängt.
  const { final: _weg, ...plaeneRest } = plaene
  const eingaben = istObj(roh.eingaben) ? Object.fromEntries(Object.entries(roh.eingaben).filter(([k]) => !k.startsWith('parallel:final/'))) : roh.eingaben
  const gedruckt = istObj(roh.parallelGedruckt) ? Object.fromEntries(Object.entries(roh.parallelGedruckt).filter(([r]) => r !== 'final')) : roh.parallelGedruckt
  const zuFinal = (key: unknown) => kennung(key) !== null
  return {
    ...roh,
    parallelPlaene: plaeneRest,
    eingaben,
    parallelGedruckt: gedruckt,
    betrieb: mitParallelBetrieb(roh.betrieb, (b) => ({
      ...b,
      begonnen: Array.isArray(b.begonnen) ? b.begonnen.filter((p) => p !== 'runde:final') : b.begonnen,
      gezeigt: Array.isArray(b.gezeigt) ? b.gezeigt.filter((g) => !(istObj(g) && zuFinal(g.ref))) : b.gezeigt,
      ohneAnzeige: Array.isArray(b.ohneAnzeige) ? b.ohneAnzeige.filter((k) => !zuFinal(k)) : b.ohneAnzeige,
      zurueckgestellt: Array.isArray(b.zurueckgestellt) ? b.zurueckgestellt.filter((k) => !zuFinal(k)) : b.zurueckgestellt,
      reihenfolge: Array.isArray(b.reihenfolge) && b.reihenfolge.some(zuFinal) ? null : b.reihenfolge,
    })),
    listenStand: ohneFinalListen(roh.listenStand),
  }
}

/** Eine Kennung eines Starts der alten Runde `final` (`['p','final',attempt,a,b]`); sonst `null`. */
function kennung(key: unknown): { attempt: unknown; a: unknown; b: unknown } | null {
  if (typeof key !== 'string') return null
  try {
    const t: unknown = JSON.parse(key)
    return Array.isArray(t) && t.length === 5 && t[0] === 'p' && t[1] === 'final' ? { attempt: t[2], a: t[3], b: t[4] } : null
  } catch {
    return null
  }
}

/** Den Betrieb des Bereichs `parallel` ändern, wenn es ihn gibt (normalisiereBetrieb prüft danach die Form). */
function mitParallelBetrieb(betrieb: unknown, f: (b: Record<string, unknown>) => Record<string, unknown>): unknown {
  if (!istObj(betrieb) || !istObj(betrieb.bereiche) || !istObj(betrieb.bereiche[PARALLEL])) return betrieb
  return { ...betrieb, bereiche: { ...betrieb.bereiche, [PARALLEL]: f(betrieb.bereiche[PARALLEL]) } }
}

/** Zeitpunkte der Listen der alten Runde `final` entfallen: neu gerechnet, Zeitpunkt unbekannt. */
function ohneFinalListen(listenStand: unknown): unknown {
  return istObj(listenStand) ? Object.fromEntries(Object.entries(listenStand).filter(([k]) => !k.startsWith('parallel:final/'))) : listenStand
}

/**
 * Stände aus der Zeit der einen „Sprache der Listen“ (wie die Oberfläche, deutsch, englisch,
 * zweisprachig): Die übrigen Listen folgen jetzt dem Regelwerk – dafür braucht es nichts. Für
 * die Wettkampfrichter-Bögen galt eine feste Wahl bisher für alle Listen; sie bleibt, je Liste
 * eingetragen (`normalisiereSprachen` verteilt sie auf jeden Parcours), damit schon gedruckte
 * und noch zu druckende Bögen dieselbe Sprache haben. „Wie die Oberfläche“ (die frühere Vorgabe, auch wenn das Feld ganz fehlt) gibt es nicht mehr:
 * Kennt der Aufrufer die Sprache der Oberfläche, wird SIE je Liste eingetragen – wer unter UIM
 * deutsch bedient hat, druckte deutsche Bögen und soll nach dem Update nicht stillschweigend
 * englische bekommen. Ist sie unbekannt, gilt die Sprache des Regelwerks. Unter einem
 * Regelwerk ohne Englisch wirkte die Wahl nie – sie wird nicht übernommen.
 */
function alteWkrSprachen(alt: unknown, regelwerk: string, eigeneAufbauten: readonly RawAufbau[], oberflaeche?: string): Record<string, Sprache> {
  if (!bietetEnglisch(regelwerk)) return {}
  const wieOberflaeche = alt === 'ui' || alt === undefined
  const sprache = isSprache(alt) ? alt : wieOberflaeche && isSprache(oberflaeche) ? oberflaeche : undefined
  // Was der Vorgabe des Regelwerks entspricht, wird nicht eingetragen und folgt ihm weiter.
  if (!sprache || (wieOberflaeche && sprache === regelwerkSprache(regelwerk))) return {}
  return Object.fromEntries(configFor({ regelwerk, eigeneAufbauten }).getPositions().map((p) => [p.typeId, sprache]))
}

/**
 * Hat der Eintrag die Gestalt eines eigenen Aufbaus? Geprüft wird hier nur die Form, damit
 * eine Sicherung nichts verliert: Was die Fachprüfung ablehnt, bleibt gespeichert, gilt aber
 * nicht (`eigeneAuswahl` in config/konfig.ts) – die Einstellungen nennen es mit dem Grund.
 */
function isAufbau(value: unknown): value is RawAufbau {
  if (!value || typeof value !== 'object') return false
  const a = value as Partial<RawAufbau>
  return (
    typeof a.id === 'string' &&
    ID_MUSTER.test(a.id) &&
    typeof a.name === 'string' &&
    Array.isArray(a.positionen) &&
    a.positionen.every((p) => typeof p === 'string' || (!!p && typeof p === 'object' && typeof p.id === 'string'))
  )
}

/** Nur Einträge mit Prüfsumme; ein unbrauchbarer Zeitpunkt entfällt (die Liste zeigt dann keinen). */
function listenStandVon(loaded: unknown): AppState['listenStand'] {
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) return {}
  const stand: AppState['listenStand'] = {}
  for (const [schluessel, eintrag] of Object.entries(loaded as Record<string, unknown>)) {
    const e = eintrag as { inhalt?: unknown; zeit?: unknown } | null
    if (!e || typeof e.inhalt !== 'number' || !Number.isFinite(e.inhalt)) continue
    stand[schluessel] = typeof e.zeit === 'number' && Number.isFinite(e.zeit) && e.zeit > 0 ? { inhalt: e.inhalt, zeit: e.zeit } : { inhalt: e.inhalt }
  }
  return stand
}

/** Nur behalten, was vom Regelwerk abweicht – der Rest folgt dem Regelwerk, auch wenn es wechselt. */
function ownWeights(
  loaded: AppState['sollgewicht'] | undefined,
  preset: AppState['sollgewicht'],
): AppState['sollgewicht'] {
  const own: AppState['sollgewicht'] = {}
  for (const [klasse, kg] of Object.entries(loaded ?? {}) as [keyof AppState['sollgewicht'], number][]) {
    if (typeof kg === 'number' && kg > 0 && kg !== preset[klasse]) own[klasse] = kg
  }
  return own
}

/** Nur die Klassen, deren Zahl brauchbar ist und von der allgemeinen abweicht. */
function eigeneLeerzeilen(loaded: unknown, allgemein: number): AppState['wkrLeerzeilenKlasse'] {
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) return {}
  const eigene: AppState['wkrLeerzeilenKlasse'] = {}
  for (const [klasse, n] of Object.entries(loaded)) {
    const anzahl = leerzeilenZahl(n)
    if (CLASS_IDS.includes(klasse as ClassId) && anzahl !== undefined && anzahl !== allgemein) eigene[klasse as ClassId] = anzahl
  }
  return eigene
}

function normalizeStarter(s: Starter): Starter {
  return {
    id: String(s.id),
    startNr: s.startNr ?? '',
    vorname: s.vorname ?? '',
    nachname: s.nachname ?? '',
    verein: s.verein ?? '',
    bundesland: s.bundesland ?? '',
    ...(typeof s.land === 'string' && s.land.trim() ? { land: s.land } : {}),
    geburtsdatum: s.geburtsdatum ?? '',
    klasse: s.klasse,
    groesse: s.groesse ?? '',
    ...(typeof s.gewicht === 'number' && s.gewicht > 0 ? { gewicht: s.gewicht } : {}),
    // Freiwillig; alles außer M, F, D und nA heißt „nicht erfasst“.
    ...(istGeschlecht(s.geschlecht) ? { geschlecht: s.geschlecht } : {}),
    // Nur die Abwahl steht im Stand; alles andere heißt „zählt für die Pokalauswertung“.
    ...(s.pokal === false ? { pokal: false as const } : {}),
  }
}

/**
 * Stand des Verzahnungs-Prototyps (`verzahnung-prototyp:v1`) übernehmen. Der
 * Prototyp nannte die Starter `participants`; alles Übrige passt.
 */
export function fromVerzahnungPrototyp(raw: unknown, optionen: { oberflaeche?: string } = {}): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const old = raw as Record<string, unknown>
  if (!Array.isArray(old.participants)) return null
  const { participants, initialized: _initialized, originMode, ...rest } = old
  const origin: OriginMode = originMode === 'bundesland' ? 'bundesland' : 'verein'
  return migrate({ ...rest, originMode: origin, starters: participants }, optionen)
}
