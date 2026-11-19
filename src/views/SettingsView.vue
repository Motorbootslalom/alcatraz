<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId } from 'vue'
import { useStore } from '../state/store'
import { WKR_LEERZEILEN_MAX, WKR_TEILEN_AB_MAX, WKR_ZEILEN_JE_SEITE_MAX } from '../state/reducer'
import { streichlaeufeVon } from '../lib/ergebnis'
import { CLASS_IDS, classColor } from '../domain/classes'
import { normalizeName } from '../domain/kuerzel'
import { downloadText, filename, makeFile, parseFile, type FileKind } from '../persistenz/backup'
import { loadLegacyVerzahnung } from '../persistenz/storage'
import { BESCHRIFTUNGEN, sollgewichtOf } from '../config/catalog'
import { bietetEnglisch, laenderKuerzelFuer, regelwerkSprache } from '../lib/listensprache'
import { useEvent } from '../lib/event'
import { pruefeKlassen } from '../import/klassenPruefung'
import { useKonfig } from '../lib/konfig'
import { zusatzListen } from '../lib/listen'
import { herkunftAnzeige, originLabelKey, originOf } from '../lib/origin'
import { hatFlaggen } from '../domain/flaggen'
import HerkunftWahl from '../components/HerkunftWahl.vue'
import HerkunftText from '../components/HerkunftText.vue'
import { POKAL_BESTE_MAX, POKAL_PLATZ_VARIANTEN, POKAL_PUNKTE_MAX, POKAL_VARIANTEN, pokalRegeln, pokalVorgabe, type PokalPlatzVariante } from '../config/pokal'
import { pokalStichText } from '../lib/pokalBlaetter'
import { verlustBeimErsetzen } from '../lib/eingabenVerlust'
import { formatDateTime, t, tn, locale } from '../i18n'
import { adresse, sprungziel } from '../lib/router'
import { starterfeldFest } from '../lib/eingaben'
import type { AnzeigeEinstellungen, AnzeigeNamen, AnzeigeSprache, ClassId, OriginStyle, ErgebnisFassung, ErgebnisNamen, LaufzettelLayout, ParallelAnordnung } from '../types'
import { bereicheZumStand } from '../betrieb/folge'
import { messungen, messwerteAlsVorgabe, startabstandZeilen, type StartabstandZeile } from '../betrieb/prognose'
import { BETRIEB_ANNAHMEN } from '../betrieb/annahmen'
import { ABSTAND_MAX, ABSTAND_MIN, PARALLEL_ANORDNUNGEN, SKALA_MAX, SKALA_MIN, STEG_MAX } from '../state/reducer/betrieb'
import EigeneAufbautenPanel from '../components/EigeneAufbautenPanel.vue'
import LogosPanel from '../components/LogosPanel.vue'
import StartNrBereichePanel from '../components/StartNrBereichePanel.vue'
import AppearancePanel from '../components/AppearancePanel.vue'
import SettingsNav from '../components/SettingsNav.vue'
import OfflinePanel from '../components/OfflinePanel.vue'
import FremdeBestandteile from '../components/FremdeBestandteile.vue'
import { vergissAuswahl } from '../lib/merken'
import EingabenHinweis from '../components/EingabenHinweis.vue'
import VerlaufPanel from '../components/VerlaufPanel.vue'
import RegelLaeufeHinweis from '../components/RegelLaeufeHinweis.vue'
import { serverEinstellung } from '../lib/serverAdresse'
import { NTFY_VORGABE } from '../geraete/themen'
import { hostServer, useGeraeteHost } from '../geraete/host'

/**
 * Alle Einstellungen an einem Ort: wie Listen aussehen, welche Kürzel gelten, und die
 * Dateien zum Aufheben und Weitergeben (Sicherung, Vorlage, Teilnehmerdaten). Was für den
 * einzelnen Wettkampf eingeteilt wird (WKR-Einteilung, Co-Piloten, Boote), steht unter
 * „Veranstaltung“ im Block „Besetzung“ – hier nur der Verweis.
 */
const { state, dispatch } = useStore()
const id = useId()
const { regelwerk, classLabel, parallel } = useEvent()
// Leerzeilen und Durchschnittsgewichte nur für die Klassen des Regelwerks.
const CLASSES = computed(() => regelwerk.value.klassen.map((id) => ({ id, color: classColor(id) })))
const ERGEBNIS_FASSUNGEN: ErgebnisFassung[] = ['aushang', 'intern']
const ERGEBNIS_NAMEN: ErgebnisNamen[] = ['voll', 'kurz', 'ohne']
const dateiFeld = ref<HTMLInputElement | null>(null)
const inhalt = ref<HTMLElement | null>(null)

// Die Wertungslisten verweisen mit `#/einstellungen?wertung` auf die Wertung: dann dorthin
// rollen, statt den Abschnitt in der langen Seite suchen zu lassen. (Die WKR-Einteilung steht
// nicht mehr hier; `#/einstellungen?wkr` führt zur Veranstaltung – lib/adressen.ts `umzug`.)
onMounted(async () => {
  // Das Sprungziel steht in der Sprache der Oberfläche in der Adresse (lib/router.ts).
  const ziel = ({ wertung: 'wertung', ergebnislisten: 'ergebnislisten', pokal: 'pokal', dateien: 'dateien', offline: 'offline', anzeigetafel: 'anzeigetafel', betrieb: 'betrieb', geraete: 'geraete' } as Record<string, string>)[sprungziel()]
  if (!ziel) return
  await nextTick()
  document.getElementById(ziel)?.scrollIntoView?.({ block: 'start' })
})

// --- Anzeigetafel ----------------------------------------------------------
// Was die Anzeigetafel zeigt (Plan vom 16.11.2026, §4); bedient wird sie im Reiter „Betrieb“. Jedes Feld geht
// über SET_ANZEIGE, der Reducer prüft es (state/reducer/betrieb.ts normalisiereAnzeige).
const ANZEIGE_NAMEN: AnzeigeNamen[] = ['aushang', 'voll', 'kurz', 'ohne']
const ANZEIGE_SPRACHEN: AnzeigeSprache[] = ['regelwerk', 'de', 'en']
const setzeAnzeige = (patch: Partial<AnzeigeEinstellungen>) => dispatch({ type: 'SET_ANZEIGE', patch })
const anzeigeBereiche = computed(() => bereicheZumStand(state.value))
const anzeigeGezeigt = computed(() => new Set(bereicheZumStand(state.value, { anzeige: true }).map((b) => b.id)))
const kopfVorgabe = computed(() => (state.value.eventName.trim() ? `${state.value.eventName.trim()} ${state.value.eventJahr}` : ''))
/**
 * Einen Bereich auf der gemeinsamen Tafel ein- oder ausblenden. Entspricht die Wahl der automatischen ([] – alle
 * Parcours, der Parallelslalom erst ab einer begonnenen Runde, betrieb/folge.ts bereicheZumStand), bleibt sie
 * automatisch – auch für künftige Parcours. Einer bleibt immer.
 */
function setzeAnzeigeBereich(id: string, an: boolean) {
  const alle = anzeigeBereiche.value.map((b) => b.id)
  const neu = alle.filter((x) => (x === id ? an : anzeigeGezeigt.value.has(x)))
  if (neu.length === 0) return
  const automatisch = bereicheZumStand({ ...state.value, anzeige: { ...state.value.anzeige, bereiche: [] } }, { anzeige: true }).map((b) => b.id)
  const gleich = neu.length === automatisch.length && neu.every((x) => automatisch.includes(x))
  setzeAnzeige({ bereiche: gleich ? [] : neu })
}
/** Der Name eines Bereichs in der Oberfläche: der Parcours wie im Stand, der Parallelslalom mit seinem Wort. */
const bereichName = (b: { name: string; art: string }) => (b.art === 'parallel' ? t('parallel.title') : b.name)
/** Leer = Name und Jahr der Veranstaltung (`null`); „keine Kopfzeile“ ist der Haken daneben (''). */
function setzeKopfzeile(e: Event) {
  const wert = (e.target as HTMLInputElement).value
  setzeAnzeige({ kopfzeile: wert.trim() === '' ? null : wert })
}
// In Prozent, gerundet: 0,7 · 100 ergäbe 70,00000000000001.
const SKALA_MIN_PROZENT = Math.round(SKALA_MIN * 100)
const SKALA_MAX_PROZENT = Math.round(SKALA_MAX * 100)
function setzeSkala(e: Event) {
  const feld = e.target as HTMLInputElement
  const n = parseFloat(feld.value)
  if (Number.isFinite(n)) setzeAnzeige({ skala: n / 100 })
  // Begrenzt oder unbrauchbar: Ändert sich der Stand nicht, zeichnet Vue das Feld nicht neu – also selbst
  // den geltenden Wert zurückschreiben (wie bei den Leerzeilen), sonst stünde 250 da und 130 gälte.
  feld.value = String(Math.round(state.value.anzeige.skala * 100))
}

// --- Startfolge im Betrieb: am Steg / vor Steg, Startabstände (E3) ------------
// Was die Startliste und die Zuschauerliste zum Schätzen der Wartezeiten brauchen (betrieb/prognose.ts). Der Stand
// hält nur eigene Startabstände; die Vorgabe (Regelwerk, sonst einstellungen.yaml) wird beim Lesen aufgelöst
// (config/catalog.ts startabstandOf, Kritik K24) – ein Wert gleich der Vorgabe ist deshalb kein eigener.
function setzeSteg(feld: 'amSteg' | 'vorSteg', e: Event) {
  const el = e.target as HTMLInputElement
  const n = parseFloat(el.value)
  if (Number.isFinite(n)) setzeAnzeige(feld === 'amSteg' ? { amSteg: n } : { vorSteg: n })
  // Begrenzt oder unbrauchbar: den geltenden Wert zurückschreiben (wie bei der Schriftgröße).
  el.value = String(state.value.anzeige[feld])
}
const MESS_AB = BETRIEB_ANNAHMEN.prognoseMessung.ab
const abstandZeilen = computed(() => startabstandZeilen(state.value))
const messZahl = computed(() => messungen(state.value).length)
/** Eigene Abstände in der Folge der Klassen: Derselbe Inhalt ergibt denselben Text (der Reducer vergleicht als JSON). */
function inKlassenFolge(a: Partial<Record<ClassId, number>>): Partial<Record<ClassId, number>> {
  return Object.fromEntries(CLASS_IDS.filter((k) => a[k] !== undefined).map((k) => [k, a[k]]))
}
/** Leer = wieder die Vorgabe; sonst gerundet und auf {@link ABSTAND_MIN}–{@link ABSTAND_MAX} begrenzt. */
function setzeAbstand(z: StartabstandZeile, e: Event) {
  const el = e.target as HTMLInputElement
  const roh = el.value.trim()
  const n = parseFloat(roh)
  const neu = { ...state.value.anzeige.abstaende }
  if (roh === '') delete neu[z.klasse]
  else if (Number.isFinite(n)) {
    const sekunden = Math.max(ABSTAND_MIN, Math.min(ABSTAND_MAX, Math.round(n)))
    if (sekunden === z.vorgabe) delete neu[z.klasse]
    else neu[z.klasse] = sekunden
  }
  setzeAnzeige({ abstaende: inKlassenFolge(neu) })
  el.value = String(state.value.anzeige.abstaende[z.klasse] ?? '')
}
/** „Messwerte als Vorgabe übernehmen“ (L-6, K22): Klassen mit genug Messungen bekommen ihr Mittel als eigenen Wert. */
const uebernommen = computed(() => inKlassenFolge(messwerteAlsVorgabe(state.value)))
const uebernehmenAendert = computed(() => JSON.stringify(uebernommen.value) !== JSON.stringify(inKlassenFolge(state.value.anzeige.abstaende)))
const hatEigeneAbstaende = computed(() => Object.keys(state.value.anzeige.abstaende).length > 0)
const sekunden = (n: number) => `${Math.round(n)} s`

// --- Geräte (E6): der ntfy-Server ---------------------------------------------
// Bedient wird der Gerätebetrieb unter Betrieb → Geräte; hier steht nur, über welchen Server er läuft (Entscheidung des
// Nutzers vom 11./16.11.2026: Vorgabe geraete/themen.ts NTFY_VORGABE, änderbar). Leer = Vorgabe; eine Eingabe, die
// keine Adresse ist, ändert nichts und wird gemeldet (lib/serverAdresse.ts serverEinstellung, dieselbe Prüfung wie
// im Reducer). Der Raum merkt sich seinen Server: Ein anderer gilt erst für einen neuen Raum (BETRIEB_ANNAHMEN.raumEnde).
const geraeteHost = useGeraeteHost()
const serverFehler = ref('')
function setzeServer(e: Event) {
  const el = e.target as HTMLInputElement
  const roh = el.value
  const wert = serverEinstellung(roh)
  if (wert === null) serverFehler.value = roh.trim()
  else {
    serverFehler.value = ''
    dispatch({ type: 'SET_GERAETE_SERVER', server: wert })
  }
  // Vereinheitlicht („ntfy.example.org/“ → „https://ntfy.example.org“) oder abgewiesen: den geltenden Wert zeigen –
  // ändert sich der Stand nicht, zeichnet Vue das Feld nicht neu.
  el.value = state.value.geraeteServer
}
/** Der offene Raum läuft über einen anderen Server als eingestellt: sagen, dass der neue erst für einen neuen Raum gilt. */
const raumServer = computed(() => {
  const r = geraeteHost?.raum.value
  return r && r.server !== hostServer(state.value) ? r.server : null
})

// --- Kürzel der Herkunft ---------------------------------------------------
/**
 * Zeilen der Kürzel-Tabelle: jede Herkunft, die bei den Startern vorkommt, und
 * jeder eigene Eintrag – auch wenn gerade kein Starter dazu gehört.
 */
/**
 * Das Kürzel, das ohne eigenen Eintrag auf den Listen steht – dasselbe, das `herkunftAnzeige` dort
 * zeigt, also auch nach der Norm des Regelwerks (UIM: IOC, Regel 209).
 */
const kuerzelVorgabe = (name: string) => {
  const kurz = herkunftAnzeige(name, state.value.originMode, 'kurz', {}, regelwerkSprache(state.value.regelwerk), false, laenderKuerzelFuer(state.value.regelwerk)).klartext
  return kurz !== name ? kurz : ''
}
const shortRows = computed(() => {
  const names = new Map<string, string>()
  const add = (name: string) => {
    const key = normalizeName(name)
    if (key && !names.has(key)) names.set(key, name.trim())
  }
  for (const p of state.value.starters) add(originOf(p, state.value.originMode))
  Object.keys(state.value.originShort).forEach(add)
  const own = new Map(Object.entries(state.value.originShort).map(([name, short]) => [normalizeName(name), { name, short }]))
  return [...names]
    .map(([key, name]) => ({
      name: own.get(key)?.name ?? name,
      own: own.get(key)?.short ?? '',
      preset: kuerzelVorgabe(name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

// --- Wettkampfrichter-Listen ------------------------------------------------
const eigeneLeerzeilen = computed(() => Object.keys(state.value.wkrLeerzeilenKlasse).length)

/** Ein leeres oder unbrauchbares Feld heißt: wieder die allgemeine Zahl (bzw. die Vorgabe). */
function setzeLeerzeilen(klasse: ClassId | undefined, e: Event) {
  const n = parseInt((e.target as HTMLInputElement).value, 10)
  dispatch({ type: 'SET_WKR_LEERZEILEN', klasse, anzahl: Number.isNaN(n) ? null : n })
}

/** Seitenaufteilung: Ein leeres oder unbrauchbares Feld heißt automatisch bzw. „immer teilen“. */
function setzeSeiten(feld: 'zeilenJeSeite' | 'teilenAb', e: Event) {
  const n = parseInt((e.target as HTMLInputElement).value, 10)
  dispatch({ type: 'SET_WKR_SEITEN', patch: { [feld]: Number.isNaN(n) ? null : n } })
  // Der Reducer rundet auf (1 bis 4 → 5); das Feld soll zeigen, was gilt.
  ;(e.target as HTMLInputElement).value = String(feld === 'zeilenJeSeite' ? state.value.wkrZeilenJeSeite : state.value.wkrTeilenAb)
}

// --- Listen der Veranstaltung: zusammengelegte Liste und zusätzliche Listen -------------
const konfig = useKonfig()
const aufbau = computed(() => konfig.value.getAufbau(state.value.aufbau))
/** „Tor 5 + Parcours“ gibt es nur in Aufbauten, die beide Listen haben. */
const kombiListe = computed(() => {
  const kombi = aufbau.value.kombi
  return kombi && konfig.value.getSheetDef(kombi.positionId).title
})
/**
 * Der Name wie in der WKR-Einteilung: der Titel der Liste (in der Listensprache) – der
 * ausführliche aus dem Menü nur, wenn sich mehrere den Titel teilen („Parcours“ mit und ohne Start/Ziel).
 */
const zusatz = computed(() => {
  const k = konfig.value
  const titel = [...aufbau.value.order, ...aufbau.value.zusatz].map((id) => k.getSheetDef(id).title)
  return zusatzListen(k, state.value).map((z) => {
    const def = k.getSheetDef(z.id)
    return { ...z, name: titel.filter((x) => x === def.title).length > 1 ? def.menuLabel : def.title }
  })
})
const LAUFZETTEL_LAYOUTS: LaufzettelLayout[] = ['seite', 'liste']

// --- Sprache der Listen ----------------------------------------------------
// Sie folgt dem Regelwerk (lib/listensprache.ts) und steht hier nur zur Auskunft. Wählen lässt
// sich die Sprache der Wettkampfrichter-Bögen je Liste – in der WKR-Einteilung, und nur, wo
// das Regelwerk Englisch anbietet (UIM).
const spracheWaehlbar = computed(() => bietetEnglisch(state.value.regelwerk))
const listenSprache = computed(() => regelwerkSprache(state.value.regelwerk))
// Gemeinsame Bögen der Clubmeisterschaft teilen sich die Leerzeilen je Seite (lib/bogen.ts).
const leerJeSeite = computed(() => state.value.eventKind === 'club' && state.value.wkrClubGemeinsam)
function setzeLeerzeilenSeite(e: Event) {
  const n = parseInt((e.target as HTMLInputElement).value, 10)
  dispatch({ type: 'SET_WKR_LEERZEILEN_SEITE', anzahl: Number.isNaN(n) ? null : n })
  ;(e.target as HTMLInputElement).value = String(state.value.wkrLeerzeilenSeite)
}

const newName = ref('')
const newShort = ref('')

function addShort() {
  if (!newName.value.trim() || !newShort.value.trim()) return
  dispatch({ type: 'SET_ORIGIN_SHORT', name: newName.value.trim(), short: newShort.value })
  newName.value = ''
  newShort.value = ''
}

// --- Wertung ---------------------------------------------------------------
/** Was sich wählen lässt: die Regel, und jede Zahl, bei der noch ein Lauf zählt. */
const streichWahl = computed(() => ['auto', ...Array.from({ length: Math.max(1, state.value.laufCount) }, (_, i) => String(i))])
const streichlaeufe = computed(() => streichlaeufeVon(state.value.laufCount, state.value.streichlaeufe, regelwerk.value.wertungslaeufe?.nachRegel))
// „Nach Regel“ in Worten: Nennt das Regelwerk für einzelne Laufzahlen eigene Streichläufe
// (DM C6: bei zwei Läufen einer), steht das dabei – sonst nur die allgemeine Regel.
const streichAutoText = computed(() => {
  const regel = Object.entries(regelwerk.value.wertungslaeufe?.nachRegel ?? {})
    .filter(([l, s]) => s !== (Number(l) >= 3 ? 1 : 0))
    .map(([l, s]) => t('scoring.drop.autoRule.item', { runs: l, drop: s }))
  return regel.length > 0 ? t('scoring.drop.autoRule', { rulebook: regelwerk.value.label, rule: regel.join(', ') }) : t('scoring.drop.auto')
})
const streichText = (wert: string) =>
  wert === 'auto' ? streichAutoText.value : wert === '0' ? t('scoring.drop.none') : tn('scoring.drop.n', Number(wert))
function setzeStreichlaeufe(e: Event) {
  const wert = (e.target as HTMLSelectElement).value
  dispatch({ type: 'SET_STREICHLAEUFE', streichlaeufe: wert === 'auto' ? 'auto' : Number(wert) })
}

// --- Pokalauswertung -------------------------------------------------------
// Was gilt (`pokalRegeln`) und was das Regelwerk vorgibt (`pokalVorgabe`); im Stand steht nur die Abweichung.
const pokal = computed(() => pokalRegeln(state.value))
const pokalVor = computed(() => pokalVorgabe(state.value.regelwerk))
const istPlatzVariante = (v: string): v is PokalPlatzVariante => (POKAL_PLATZ_VARIANTEN as readonly string[]).includes(v)
const eigenePunkte = (v: PokalPlatzVariante) => pokal.value.punkte[v].some((n, i) => n !== pokalVor.value.punkte[v][i])
/** Ein leeres oder unbrauchbares Feld zählt 0 Punkte; das Feld zeigt danach, was gilt. */
function setzePokalPunkte(v: PokalPlatzVariante, platz: number, e: Event) {
  const n = parseInt((e.target as HTMLInputElement).value, 10)
  dispatch({ type: 'SET_POKAL_PUNKTE', variante: v, punkte: pokal.value.punkte[v].map((alt, i) => (i === platz ? (Number.isNaN(n) ? 0 : n) : alt)) })
  ;(e.target as HTMLInputElement).value = String(pokal.value.punkte[v][platz])
}
/** Ein leeres oder unbrauchbares Feld heißt: wieder die Zahl des Regelwerks. */
function setzePokalUim(feld: 'beste' | 'mindestens', e: Event) {
  const n = parseInt((e.target as HTMLInputElement).value, 10)
  dispatch({ type: 'SET_POKAL_UIM', patch: { [feld]: Number.isNaN(n) ? null : n } })
  ;(e.target as HTMLInputElement).value = String(pokal.value[feld])
}
const eigeneUim = computed(() => pokal.value.beste !== pokalVor.value.beste || pokal.value.mindestens !== pokalVor.value.mindestens)

// --- Dateien ---------------------------------------------------------------
const FILE_KINDS: FileKind[] = ['sicherung', 'vorlage', 'starter']
const message = ref<{ ok: boolean; text: string } | null>(null)

function download(kind: FileKind) {
  const now = new Date()
  // Der Dateiname folgt der Sprache der Oberfläche (Sicherung / Backup).
  const name = filename(kind, t(`files.download.${kind}`), state.value, now)
  downloadText(name, JSON.stringify(makeFile(kind, state.value, now.toISOString()), null, 2))
}

/** Eine Datei einspielen. Welche Art es ist, steht in der Datei; gefragt wird vor jedem Überschreiben. */
async function upload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const result = parseFile(await file.text(), { oberflaeche: locale.value })
  if (!result.ok) {
    message.value = { ok: false, text: t('files.invalid') }
    return
  }
  // Sind schon Ergebnisse erfasst, ist die Starterliste fest (wie beim Einfügen aus Excel).
  if (result.kind === 'starter' && starterfeldFest(state.value)) {
    message.value = { ok: false, text: `${t('lock.text')} ${t('lock.fix')} ${t('lock.clear')} ${t('lock.or')} ${t('lock.reset')}.` }
    return
  }
  // Klasse gegen Geburtsjahr, wie beim Einfügen aus Excel: Eine Datei mit einem Starter in der
  // falschen Klasse (von Hand geändert, anderes Jahr der Veranstaltung) wird nicht übernommen.
  if (result.kind === 'starter') {
    const fehler = pruefeKlassen(result.starters, state.value.eventJahr, regelwerk.value.klassen).fehler
    if (fehler.length > 0) {
      const names = fehler.map((f) => `${[f.starter.vorname, f.starter.nachname].filter(Boolean).join(' ')}: ${classLabel(f.starter.klasse)}, ${f.jahr}`).join('; ')
      message.value = { ok: false, text: tn('files.classErrors', fehler.length, { names, year: state.value.eventJahr }) }
      return
    }
  }
  const time = result.savedAt ? formatDateTime(result.savedAt) : t('app.unknown')
  // Mit den Startern gingen ihre erfassten Werte: Die Rückfrage sagt, wie viele betroffen sind.
  const verlust = result.kind === 'starter' ? verlustBeimErsetzen(state.value, result.starters).text : ''
  if (!confirm(t(`files.confirm.${result.kind}`, { time }) + verlust)) return
  if (result.kind === 'sicherung') {
    dispatch({ type: 'LOAD_STATE', state: result.state }, { art: 'sicherung' })
    // Eine andere Veranstaltung: Die Auswahl der vorigen (Klasse, Herkunft …) gilt nicht mehr.
    vergissAuswahl()
  } else if (result.kind === 'vorlage') dispatch({ type: 'LOAD_STATE', state: result.apply(state.value) }, { art: 'vorlage' })
  else dispatch({ type: 'IMPORT_STARTERS', starters: result.starters, mode: 'replace', auswahlAusDatei: true })
  message.value = { ok: true, text: t(`files.done.${result.kind}`) }
}

function reset() {
  if (!confirm(t('backup.resetConfirm'))) return
  dispatch({ type: 'RESET_ALL' })
  vergissAuswahl()
}

// Stand aus dem Verzahnungs-Prototyp – nur anbieten, solange hier noch nichts liegt.
const legacy = computed(() => (state.value.starters.length === 0 ? loadLegacyVerzahnung() : null))

function takeLegacy() {
  if (legacy.value && confirm(t('backup.legacy.confirm'))) {
    dispatch({ type: 'LOAD_STATE', state: legacy.value }, { art: 'prototyp' })
    vergissAuswahl()
  }
}
</script>

<template>
  <!-- Links die Sprungleiste, rechts die Blöcke; schmal steht die Leiste als Zeile darüber. -->
  <div class="settings-layout">
  <SettingsNav :inhalt="inhalt" />
  <div ref="inhalt" class="settings-main">
  <AppearancePanel />
  <div class="panel">
    <h2>{{ t('listopt.title') }}</h2>
    <div class="row" style="align-items: center; gap: 20px">
      <label class="boat-check">
        <input
          type="checkbox"
          :checked="state.showBirthdate"
          @change="dispatch({ type: 'SET_LIST_OPTIONS', patch: { showBirthdate: ($event.target as HTMLInputElement).checked } })"
        />
        {{ t('listopt.birthdate') }}
      </label>
      <div v-if="state.originMode !== 'none'" class="field">
        <label :for="`${id}-list-origin`">{{ t('listopt.origin') }}</label>
        <HerkunftWahl :id="`${id}-list-origin`" data-feld="list-origin" :wert="state.listOrigin" @wahl="dispatch({ type: 'SET_LIST_OPTIONS', patch: { listOrigin: $event as OriginStyle } })" />
      </div>
    </div>
    <p class="note">{{ t('listopt.note') }}</p>
    <!-- Flaggen: für wen es sie gibt und was „nur Flagge“ auf Papier heißt. -->
    <p v-if="state.originMode !== 'none'" class="note" data-hinweis="flaggen">{{ t(hatFlaggen(state.originMode) ? 'origin.style.flagNote' : 'origin.style.noFlags') }}</p>

    <!-- Die Sprache der Listen ist keine Einstellung: Sie folgt dem Regelwerk. Hier steht, welche gilt. -->
    <p class="note" data-hinweis="listen-sprache" :data-sprache="listenSprache" style="margin-top: 12px">
      <strong>{{ t('listopt.language') }}:</strong>
      {{ t('listopt.language.rule', { rulebook: regelwerk.label, language: t(`listopt.language.${listenSprache}`) }) }}
      <template v-if="spracheWaehlbar">
        {{ t('listopt.language.sheets') }} <a :href="adresse('veranstaltung', { ziel: 'wkr' })">{{ t('nav.veranstaltung') }} → {{ t('wkr.title') }}</a
        >.
      </template>
      <template v-else>{{ t('listopt.language.sheetsFixed') }}</template>
    </p>

    <!-- Laufzettel: wie im Prototyp eine Zeile je Seite, oder dichter eine Zeile je Liste. -->
    <div class="row" style="align-items: flex-end; gap: 20px; margin-top: 12px">
      <div class="field" style="min-width: 240px">
        <label for="laufzettel-layout">{{ t('listopt.runsheet') }}</label>
        <select
          id="laufzettel-layout"
          class="input"
          data-feld="laufzettel-layout"
          :value="state.laufzettelLayout"
          @change="dispatch({ type: 'SET_LAUFZETTEL_LAYOUT', layout: ($event.target as HTMLSelectElement).value as LaufzettelLayout })"
        >
          <option v-for="l in LAUFZETTEL_LAYOUTS" :key="l" :value="l">{{ t(`listopt.runsheet.${l}`) }}</option>
        </select>
      </div>
      <p class="note" style="flex: 1; min-width: 220px; margin: 0">{{ t('listopt.runsheet.hint') }}</p>
    </div>

    <div id="ergebnislisten" class="subhead">{{ t('listopt.results.title') }}</div>
    <p class="hint">{{ t('listopt.results.hint') }}</p>
    <div v-for="f in ERGEBNIS_FASSUNGEN" :key="f" class="row" style="align-items: flex-end; margin-bottom: 10px" :data-fassung="f">
      <b style="width: 90px; padding-bottom: 8px">{{ t(`results.version.${f}`) }}</b>
      <div v-if="f === 'aushang'" class="field">
        <label>{{ t('listopt.results.names') }}</label>
        <div class="segmented">
          <button
            v-for="n in ERGEBNIS_NAMEN"
            :key="n"
            type="button"
            :data-namen="n"
            :class="state.ergebnisListen.aushang.namen === n ? 'active' : ''"
            :aria-pressed="state.ergebnisListen.aushang.namen === n"
            @click="dispatch({ type: 'SET_ERGEBNIS_LISTEN', fassung: 'aushang', patch: { namen: n } })"
          >
            {{ t(`listopt.results.names.${n}`) }}
          </button>
        </div>
      </div>
      <div v-if="state.originMode !== 'none'" class="field">
        <label :for="`${id}-erg-origin-${f}`">{{ t('event.origin') }}</label>
        <HerkunftWahl :id="`${id}-erg-origin-${f}`" data-feld="erg-origin" mit-aus :wert="state.ergebnisListen[f].herkunft" @wahl="dispatch({ type: 'SET_ERGEBNIS_LISTEN', fassung: f, patch: { herkunft: $event } })" />
      </div>
      <span v-if="f === 'intern'" class="note" style="margin: 0; padding-bottom: 8px">{{ t('listopt.results.internNames') }}</span>
    </div>

    <details v-if="state.originMode !== 'none'" class="sub-details">
      <summary>{{ t('short.title') }} ({{ shortRows.length }})</summary>
      <p class="hint">{{ t('short.hint') }}</p>
      <table class="starters short-table">
        <thead>
          <tr>
            <th>{{ t('short.name') }}</th>
            <th style="width: 150px">{{ t('short.short') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in shortRows" :key="row.name">
            <!-- Mit Flagge, wo die Herkunft als Bundesland oder Staat erkannt ist – ohne heißt: Sie steht auf den Listen als Text. -->
            <td><HerkunftText :anzeige="herkunftAnzeige(row.name, state.originMode, 'flagge-lang', {}, locale, true)" /></td>
            <td>
              <input
                class="cell-input"
                :value="row.own"
                :placeholder="row.preset"
                :aria-label="t('short.shortFor', { name: row.name })"
                @change="dispatch({ type: 'SET_ORIGIN_SHORT', name: row.name, short: ($event.target as HTMLInputElement).value })"
              />
            </td>
          </tr>
          <tr>
            <td>
              <input v-model="newName" class="cell-input" :placeholder="t('short.newName')" :aria-label="t('short.newName')" @keyup.enter="addShort" />
            </td>
            <td>
              <input v-model="newShort" class="cell-input" :aria-label="t('short.short')" @keyup.enter="addShort" @change="addShort" />
            </td>
          </tr>
        </tbody>
      </table>
    </details>
  </div>

  <!-- Logos auf allen gedruckten Listen: unter DM und UIM gleich (16.11.2026), daher ohne v-if. -->
  <LogosPanel />

  <!-- Der Rennleiter entscheidet, wie viele Läufe gestrichen werden (z. B. bei zwei Läufen einer oder keiner). -->
  <div id="wertung" class="panel">
    <h2>{{ t('scoring.title') }}</h2>
    <p class="hint">{{ t('scoring.hint', { runs: state.laufCount }) }}</p>
    <RegelLaeufeHinweis />
    <div class="row" style="align-items: flex-end; gap: 20px">
      <div class="field" style="min-width: 260px">
        <label for="streichlaeufe">{{ t('scoring.drop') }}</label>
        <select id="streichlaeufe" class="input" data-feld="streichlaeufe" :value="String(state.streichlaeufe)" @change="setzeStreichlaeufe">
          <option v-for="w in streichWahl" :key="w" :value="w">{{ streichText(w) }}</option>
          <!-- Eine Zahl, die zur jetzigen Zahl der Läufe nicht mehr passt, bleibt sichtbar. -->
          <option v-if="!streichWahl.includes(String(state.streichlaeufe))" :value="String(state.streichlaeufe)">{{ streichText(String(state.streichlaeufe)) }}</option>
        </select>
      </div>
      <p class="note" data-hinweis="streichlaeufe" role="status" style="flex: 1; min-width: 220px; margin: 0">
        {{ tn('scoring.now', state.laufCount - streichlaeufe, { runs: state.laufCount }) }}
      </p>
    </div>
    <p class="note">{{ t('scoring.note') }}</p>
    <!-- Nur unter einem Regelwerk, das den Schalter kennt (YAML `versucheNacheinander`, UIM 960 Pkt. 4.3.2). -->
    <template v-if="regelwerk.versucheNacheinander !== undefined">
      <label class="boat-check" style="margin-top: 12px">
        <input
          type="checkbox"
          data-feld="versuche-nacheinander"
          :checked="state.versucheNacheinander"
          @change="dispatch({ type: 'SET_VERSUCHE_NACHEINANDER', on: ($event.target as HTMLInputElement).checked })"
        />
        {{ t('scoring.consecutive') }}
      </label>
      <p class="note" data-hinweis="versuche-nacheinander">{{ t('scoring.consecutive.hint', { rulebook: regelwerk.label }) }}</p>
    </template>
    <EingabenHinweis />
  </div>

  <!-- Pokalauswertung (Mannschaftswertung je Herkunft): gehört zur Veranstaltung und in die Vorlage.
       Die Vorgaben kommen aus Regelwerk und einstellungen.yaml (config/pokal.ts). -->
  <div id="pokal" class="panel">
    <h2>{{ t('cup.title') }}</h2>
    <p class="hint">{{ t('cup.settings.hint', { origin: state.originMode === 'none' ? t('cup.settings.origin') : t(originLabelKey(state.originMode)) }) }}</p>
    <p v-if="state.originMode === 'none'" class="boat-banner warn" data-hinweis="pokal-ohne-herkunft" role="status">
      {{ t('cup.settings.noOrigin') }} <a :href="adresse('veranstaltung')">{{ t('nav.veranstaltung') }}</a
      >.
    </p>
    <div v-for="v in POKAL_VARIANTEN" :key="v" class="cup-variante" :data-variante="v">
      <label class="boat-check">
        <input
          type="checkbox"
          :data-feld="`pokal-variante|${v}`"
          :checked="pokal.an.includes(v)"
          @change="dispatch({ type: 'SET_POKAL_VARIANTE', variante: v, an: ($event.target as HTMLInputElement).checked })"
        />
        {{ t(`cup.variant.${v}`) }}
        <span v-if="pokalVor.an.includes(v)" class="note zusatz-vorgabe">{{ t('cup.preset', { rulebook: regelwerk.label }) }}</span>
      </label>
      <p class="note">{{ t(`cup.about.${v}`, { places: pokal.punkte.uim.length }) }}</p>
      <div v-if="istPlatzVariante(v)" class="row cup-punkte" style="align-items: flex-end">
        <label v-for="(n, i) in pokal.punkte[v]" :key="i" class="field cup-punkt-feld">
          <span>{{ i + 1 }}.</span>
          <input
            class="input"
            type="number"
            min="0"
            :max="POKAL_PUNKTE_MAX"
            :class="n !== pokalVor.punkte[v][i] ? 'own' : ''"
            :data-feld="`pokal-punkte|${v}|${i + 1}`"
            :value="n"
            :aria-label="t('cup.pointsFor', { variant: t(`cup.variant.${v}`), n: i + 1 })"
            @change="setzePokalPunkte(v, i, $event)"
          />
        </label>
        <button v-if="eigenePunkte(v)" class="btn sm" :data-action="`pokal-punkte-vorgabe|${v}`" @click="dispatch({ type: 'SET_POKAL_PUNKTE', variante: v, punkte: null })">
          {{ t('cup.pointsReset', { points: pokalVor.punkte[v].join(', ') }) }}
        </button>
      </div>
      <template v-else>
        <div class="row" style="align-items: flex-end; gap: 20px">
          <div class="field" style="width: 230px">
            <label for="pokal-beste">{{ t('cup.uim.best') }}</label>
            <input id="pokal-beste" class="input" type="number" min="1" :max="POKAL_BESTE_MAX" :class="pokal.beste !== pokalVor.beste ? 'own' : ''" data-feld="pokal-beste" :value="pokal.beste" @change="setzePokalUim('beste', $event)" />
          </div>
          <div class="field" style="width: 230px">
            <label for="pokal-mindestens">{{ t('cup.uim.min') }}</label>
            <input
              id="pokal-mindestens"
              class="input"
              type="number"
              min="1"
              :max="POKAL_BESTE_MAX"
              :class="pokal.mindestens !== pokalVor.mindestens ? 'own' : ''"
              data-feld="pokal-mindestens"
              :value="pokal.mindestens"
              @change="setzePokalUim('mindestens', $event)"
            />
          </div>
          <button v-if="eigeneUim" class="btn sm" data-action="pokal-uim-vorgabe" @click="dispatch({ type: 'SET_POKAL_UIM', patch: { beste: null, mindestens: null } })">
            {{ t('cup.uim.reset', { best: pokalVor.beste, min: pokalVor.mindestens }) }}
          </button>
        </div>
        <p class="note">{{ t('cup.uim.minHint') }}</p>
        <p class="note" data-hinweis="pokal-uim-tabelle">{{ t('cup.uim.table', { places: pokal.punkte.uim.length, points: pokal.punkte.uim.join(', ') }) }}</p>
      </template>
    </div>
    <label class="boat-check cup-variante">
      <input type="checkbox" data-feld="pokal-nur-auswahl" :checked="pokal.nurAuswahl" @change="dispatch({ type: 'SET_POKAL_NUR_AUSWAHL', an: ($event.target as HTMLInputElement).checked })" />
      {{ t('cup.onlySelected') }}
    </label>
    <p class="note">
      {{ t('cup.onlySelectedHint') }} <a :href="adresse('starter')">{{ t('nav.starter') }}</a
      >.
    </p>
    <p class="note" data-hinweis="pokal-stich">{{ t('cup.tieNote', { tie: pokal.stich ? `${pokalStichText(pokal.stich, t)} ${t('cup.tie.shared')}` : t('cup.tie.none') }) }}</p>
  </div>

  <!-- Wie die Wettkampfrichter-Listen gedruckt werden. Wer an welcher sitzt, steht bei der
       Veranstaltung (Block „Besetzung“). Vor den Durchschnittsgewichten, die aus dem Regelwerk
       kommen und selten geändert werden. -->
  <div class="panel" id="wkr-listen">
    <h2>{{ t('listopt.wkr.title') }}</h2>
    <p class="note" data-hinweis="besetzung">
      {{ t('crew.moved') }} <a :href="adresse('veranstaltung', { ziel: 'besetzung' })">{{ t('nav.veranstaltung') }} → {{ t('crew.title') }}</a
      >.
    </p>
    <!-- Papier sparen (Clubmeisterschaft): Auf gemeinsamen Bögen stehen die Leerzeilen einmal je Seite. -->
    <div v-if="leerJeSeite" class="row" style="align-items: flex-end; gap: 20px; margin-bottom: 12px">
      <div class="field" style="width: 170px">
        <label for="wkr-leerzeilen-seite">{{ t('listopt.wkr.blankPage') }}</label>
        <input
          id="wkr-leerzeilen-seite"
          class="input"
          type="number"
          min="0"
          :max="WKR_LEERZEILEN_MAX"
          data-feld="wkr-leerzeilen-seite"
          :value="state.wkrLeerzeilenSeite"
          @change="setzeLeerzeilenSeite"
        />
      </div>
      <p class="note" style="flex: 1; min-width: 220px; margin: 0">{{ t('listopt.wkr.blankPageHint') }}</p>
    </div>
    <div class="row" style="align-items: flex-end; gap: 20px">
      <div class="field" :style="{ width: leerJeSeite ? '320px' : '170px' }">
        <label for="wkr-leerzeilen">{{ leerJeSeite ? t('listopt.wkr.blankSingle') : t('listopt.wkr.blank') }}</label>
        <input
          id="wkr-leerzeilen"
          class="input"
          type="number"
          min="0"
          :max="WKR_LEERZEILEN_MAX"
          data-feld="wkr-leerzeilen"
          :value="state.wkrLeerzeilen"
          @change="setzeLeerzeilen(undefined, $event)"
        />
      </div>
      <p class="note" style="flex: 1; min-width: 220px; margin: 0">{{ t('listopt.wkr.blankHint') }}</p>
    </div>
    <details class="sub-details" :open="eigeneLeerzeilen > 0">
      <summary>{{ t('listopt.wkr.perClass') }} ({{ eigeneLeerzeilen }})</summary>
      <div class="setup-grid">
        <label v-for="c in CLASSES" :key="c.id" class="class-count">
          <span class="dot" :style="{ background: c.color }" />
          <span class="meta"><span class="name">{{ classLabel(c.id) }}</span></span>
          <input
            type="number"
            min="0"
            :max="WKR_LEERZEILEN_MAX"
            :class="state.wkrLeerzeilenKlasse[c.id] !== undefined ? 'own' : ''"
            :data-feld="`wkr-leerzeilen|${c.id}`"
            :value="state.wkrLeerzeilenKlasse[c.id] ?? state.wkrLeerzeilen"
            :aria-label="t('listopt.wkr.blankFor', { name: classLabel(c.id) })"
            @change="setzeLeerzeilen(c.id, $event)"
          />
        </label>
      </div>
      <div v-if="eigeneLeerzeilen > 0" class="row" style="justify-content: flex-end">
        <button class="btn sm" @click="dispatch({ type: 'SET_WKR_LEERZEILEN', anzahl: state.wkrLeerzeilen, alleKlassen: true })">
          {{ t('listopt.wkr.reset', { n: state.wkrLeerzeilen }) }}
        </button>
      </div>
    </details>
    <!-- Seitenaufteilung: automatisch nach Messung oder fest (wie im Prototyp „Zeilen / Seite“ und „Teilen ab“). -->
    <div class="row" style="align-items: flex-end; gap: 20px; margin-top: 12px">
      <div class="field" style="width: 230px">
        <label for="wkr-zeilen-je-seite">{{ t('listopt.wkr.rows') }}</label>
        <input
          id="wkr-zeilen-je-seite"
          class="input"
          type="number"
          min="0"
          :max="WKR_ZEILEN_JE_SEITE_MAX"
          data-feld="wkr-zeilen-je-seite"
          :value="state.wkrZeilenJeSeite"
          @change="setzeSeiten('zeilenJeSeite', $event)"
        />
      </div>
      <div class="field" style="width: 230px">
        <label for="wkr-teilen-ab">{{ t('listopt.wkr.splitFrom') }}</label>
        <input
          id="wkr-teilen-ab"
          class="input"
          type="number"
          min="0"
          :max="WKR_TEILEN_AB_MAX"
          data-feld="wkr-teilen-ab"
          :disabled="state.wkrZeilenJeSeite === 0"
          :value="state.wkrTeilenAb"
          @change="setzeSeiten('teilenAb', $event)"
        />
      </div>
    </div>
    <p class="note">{{ t('listopt.wkr.rowsHint') }}</p>
    <p v-if="state.eventKind === 'club'" class="note" data-hinweis="wkr-seiten-club">{{ t('listopt.wkr.rowsClub') }}</p>
    <!-- Nur unter einem Regelwerk mit Parallelslalom (UIM 960). -->
    <template v-if="parallel">
      <p class="note" data-hinweis="wkr-seiten-parallel">{{ t('listopt.wkr.rowsParallel') }}</p>
      <label class="boat-check" style="margin-top: 12px">
        <input
          type="checkbox"
          data-feld="parallel-zebra"
          :checked="state.parallelZebra"
          @change="dispatch({ type: 'SET_PARALLEL_ZEBRA', zebra: ($event.target as HTMLInputElement).checked })"
        />
        {{ t('listopt.wkr.parallelZebra') }}
      </label>
      <p class="note">{{ t('listopt.wkr.parallelZebraHint') }}</p>
    </template>

    <div class="row" style="align-items: flex-end; gap: 20px; margin-top: 12px">
      <div class="field" style="min-width: 240px">
        <label for="wkr-beschriftung">{{ t('listopt.wkr.sides') }}</label>
        <!-- Die Namen der Schemata stehen in der Konfiguration (einstellungen.yaml), wie die der Aufbauten. -->
        <select
          id="wkr-beschriftung"
          class="input"
          data-feld="wkr-beschriftung"
          :value="state.beschriftung"
          @change="dispatch({ type: 'SET_BESCHRIFTUNG', beschriftung: ($event.target as HTMLSelectElement).value })"
        >
          <option v-for="b in BESCHRIFTUNGEN" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </div>
      <p class="note" style="flex: 1; min-width: 220px; margin: 0">{{ t('listopt.wkr.sidesHint') }}</p>
    </div>

    <!-- Welche Listen die Veranstaltung über den Aufbau hinaus hat (lib/listen.ts). -->
    <template v-if="kombiListe">
      <label class="boat-check" style="margin-top: 12px">
        <input
          type="checkbox"
          data-feld="wkr-tor5-mit-parcours"
          :checked="state.tor5MitParcours"
          @change="dispatch({ type: 'SET_TOR5_MIT_PARCOURS', on: ($event.target as HTMLInputElement).checked })"
        />
        {{ t('listopt.wkr.combo') }}
      </label>
      <p class="note">{{ t('listopt.wkr.comboHint', { list: kombiListe }) }}</p>
    </template>
    <fieldset v-if="zusatz.length > 0" class="zusatz-listen" data-feld="wkr-zusatzlisten">
      <legend>{{ t('listopt.wkr.extra') }}</legend>
      <label v-for="z in zusatz" :key="z.id" class="boat-check">
        <input
          type="checkbox"
          :data-liste="z.id"
          :checked="z.an"
          @change="dispatch({ type: 'SET_ZUSATZ_LISTE', liste: z.id, an: ($event.target as HTMLInputElement).checked })"
        />
        {{ z.name }}
        <span v-if="z.vorgabe" class="note zusatz-vorgabe">{{ t('listopt.wkr.extraPreset', { rulebook: regelwerk.label }) }}</span>
      </label>
    </fieldset>
    <p v-if="zusatz.length > 0" class="note">{{ t('listopt.wkr.extraHint', { setup: aufbau.name }) }}</p>

    <label class="boat-check" style="margin-top: 12px">
      <input
        type="checkbox"
        data-feld="wkr-rueckseite"
        :checked="state.wkrRueckseite"
        @change="dispatch({ type: 'SET_WKR_RUECKSEITE', rueckseite: ($event.target as HTMLInputElement).checked })"
      />
      {{ t('listopt.wkr.back') }}
    </label>
    <p class="note">{{ t('listopt.wkr.backHint') }}</p>
    <!-- Nur bei der Clubmeisterschaft stehen mehrere Klassen auf einem Bogen. -->
    <template v-if="state.eventKind === 'club'">
      <label class="boat-check" style="margin-top: 12px">
        <input
          type="checkbox"
          data-feld="wkr-club-gemeinsam"
          :checked="state.wkrClubGemeinsam"
          @change="dispatch({ type: 'SET_WKR_CLUB_GEMEINSAM', gemeinsam: ($event.target as HTMLInputElement).checked })"
        />
        {{ t('listopt.wkr.clubJoint') }}
      </label>
      <p class="note">{{ t('listopt.wkr.clubJointHint') }}</p>
    </template>
  </div>


  <div class="panel">
    <h2>{{ t('weigh.standards') }}</h2>
    <p class="hint">{{ t('weigh.standardsHint', { rulebook: regelwerk.label }) }}</p>
    <div class="setup-grid">
      <label v-for="c in CLASSES" :key="c.id" class="class-count">
        <span class="dot" :style="{ background: c.color }" />
        <span class="meta"><span class="name">{{ classLabel(c.id) }}</span></span>
        <input
          type="number"
          min="0"
          max="200"
          :class="state.sollgewicht[c.id] !== undefined ? 'own' : ''"
          :value="sollgewichtOf(state.regelwerk, state.sollgewicht, c.id)"
          :aria-label="t('weigh.standardFor', { name: classLabel(c.id) })"
          :title="t('weigh.preset', { rulebook: regelwerk.label, kg: regelwerk.gewichte[c.id] ?? '–' })"
          @change="dispatch({ type: 'SET_SOLLGEWICHT', klasse: c.id, kg: parseFloat(($event.target as HTMLInputElement).value) || null })"
        />
      </label>
    </div>
    <div v-if="Object.keys(state.sollgewicht).length > 0" class="row" style="align-items: center">
      <span class="note" style="flex: 1; margin: 0">{{ t('weigh.ownNote', { rulebook: regelwerk.label }) }}</span>
      <button class="btn sm" @click="dispatch({ type: 'RESET_SOLLGEWICHT' })">{{ t('weigh.reset', { rulebook: regelwerk.label }) }}</button>
    </div>
  </div>

  <!-- Startnummern nach Westengröße (19.11.2026): Bereiche je Klasse und fehlende Westen. -->
  <StartNrBereichePanel />

  <!-- Anzeigetafel (Plan vom 16.11.2026): was sie zeigt. Bedient wird sie im Reiter „Betrieb“ (Start-Freigabe). -->
  <div id="anzeigetafel" class="panel">
    <h2>{{ t('listopt.anzeige.title') }}</h2>
    <p class="hint">
      {{ t('listopt.anzeige.hint') }}
      <a :href="adresse('betrieb')">{{ t('nav.betrieb') }} → {{ t('betrieb.title') }}</a>
    </p>
    <div class="row" style="align-items: flex-end; gap: 20px">
      <label class="boat-check">
        <input type="checkbox" data-feld="anzeige-kopfzeile-zeigen" :checked="state.anzeige.kopfzeile !== ''" @change="setzeAnzeige({ kopfzeile: ($event.target as HTMLInputElement).checked ? null : '' })" />
        {{ t('listopt.anzeige.kopfzeile.zeigen') }}
      </label>
      <div class="field" style="flex: 1; min-width: 240px">
        <label :for="`${id}-anzeige-kopfzeile`">{{ t('listopt.anzeige.kopfzeile') }}</label>
        <input
          :id="`${id}-anzeige-kopfzeile`"
          class="input"
          data-feld="anzeige-kopfzeile"
          :value="state.anzeige.kopfzeile ?? ''"
          :placeholder="kopfVorgabe"
          :disabled="state.anzeige.kopfzeile === ''"
          maxlength="120"
          @change="setzeKopfzeile"
        />
      </div>
    </div>
    <p class="note">{{ t('listopt.anzeige.kopfzeile.hint') }}</p>

    <fieldset v-if="anzeigeBereiche.length > 1" class="zusatz-listen" data-feld="anzeige-bereiche">
      <legend>{{ t('listopt.anzeige.bereiche') }}</legend>
      <label v-for="b in anzeigeBereiche" :key="b.id" class="boat-check">
        <input
          type="checkbox"
          :data-bereich="b.id"
          :checked="anzeigeGezeigt.has(b.id)"
          :disabled="anzeigeGezeigt.has(b.id) && anzeigeGezeigt.size === 1"
          @change="setzeAnzeigeBereich(b.id, ($event.target as HTMLInputElement).checked)"
        />
        {{ bereichName(b) }}
      </label>
      <p class="note">{{ t('listopt.anzeige.bereiche.hint') }}</p>
      <!-- Nur wo es den Parallelslalom gibt (UIM): Er kommt von selbst erst mit seiner ersten begonnenen Runde dazu. -->
      <p v-if="anzeigeBereiche.some((b) => b.art === 'parallel')" class="note" data-hinweis="anzeige-parallel">{{ t('listopt.anzeige.bereiche.parallel') }}</p>
    </fieldset>

    <div class="row" style="align-items: center; gap: 20px; margin-top: 12px">
      <label class="boat-check">
        <input type="checkbox" data-feld="anzeige-davor" :checked="state.anzeige.davor" @change="setzeAnzeige({ davor: ($event.target as HTMLInputElement).checked })" />
        {{ t('listopt.anzeige.davor') }}
      </label>
      <label class="boat-check">
        <input type="checkbox" data-feld="anzeige-parcours-name" :checked="state.anzeige.parcoursName" @change="setzeAnzeige({ parcoursName: ($event.target as HTMLInputElement).checked })" />
        {{ t('listopt.anzeige.parcoursName') }}
      </label>
    </div>

    <!-- Nur UIM (Parallelslalom; unter DM gibt es ihn nicht, auch nicht in Texten): Wo Racecourse A und B auf der Tafel
         liegen, hängt am Standort (Entscheidung des Nutzers vom 16.11.2026). Die Start-Freigabe bleibt bei A vor B. -->
    <template v-if="parallel">
      <div class="row" style="align-items: flex-end; gap: 20px; margin-top: 12px">
        <div class="field">
          <label :for="`${id}-anzeige-parallel-anordnung`">{{ t('listopt.anzeige.parallelAnordnung') }}</label>
          <select
            :id="`${id}-anzeige-parallel-anordnung`"
            class="input"
            data-feld="anzeige-parallel-anordnung"
            :value="state.anzeige.parallelAnordnung"
            @change="setzeAnzeige({ parallelAnordnung: ($event.target as HTMLSelectElement).value as ParallelAnordnung })"
          >
            <option v-for="a in PARALLEL_ANORDNUNGEN" :key="a" :value="a">{{ t(`listopt.anzeige.parallelAnordnung.${a}`) }}</option>
          </select>
        </div>
      </div>
      <p class="note" data-hinweis="anzeige-parallel-anordnung">{{ t('listopt.anzeige.parallelAnordnung.hint') }}</p>
    </template>

    <div class="row" style="align-items: flex-end; gap: 20px; margin-top: 12px">
      <div class="field">
        <label>{{ t('listopt.anzeige.namen') }}</label>
        <div class="segmented">
          <button
            v-for="n in ANZEIGE_NAMEN"
            :key="n"
            type="button"
            :data-feld="`anzeige-namen|${n}`"
            :class="state.anzeige.namen === n ? 'active' : ''"
            :aria-pressed="state.anzeige.namen === n"
            @click="setzeAnzeige({ namen: n })"
          >
            {{ n === 'aushang' ? t('listopt.anzeige.namen.aushang', { art: t(`listopt.results.names.${state.ergebnisListen.aushang.namen}`) }) : t(`listopt.results.names.${n}`) }}
          </button>
        </div>
      </div>
      <div v-if="state.originMode !== 'none'" class="field">
        <label :for="`${id}-anzeige-herkunft`">{{ t('event.origin') }}</label>
        <HerkunftWahl :id="`${id}-anzeige-herkunft`" data-feld="anzeige-herkunft" mit-aus :wert="state.anzeige.herkunft" @wahl="setzeAnzeige({ herkunft: $event })" />
      </div>
    </div>

    <div class="row" style="align-items: flex-end; gap: 20px; margin-top: 12px">
      <div class="field">
        <label :for="`${id}-anzeige-sprache`">{{ t('listopt.anzeige.sprache') }}</label>
        <select
          :id="`${id}-anzeige-sprache`"
          class="input"
          data-feld="anzeige-sprache"
          :value="state.anzeige.sprache"
          @change="setzeAnzeige({ sprache: ($event.target as HTMLSelectElement).value as AnzeigeSprache })"
        >
          <option v-for="s in ANZEIGE_SPRACHEN" :key="s" :value="s">
            {{ s === 'regelwerk' ? t('listopt.anzeige.sprache.regelwerk', { language: t(`listopt.language.${listenSprache}`) }) : t(`listopt.language.${s}`) }}
          </option>
        </select>
      </div>
      <div class="field" style="max-width: 160px">
        <label :for="`${id}-anzeige-skala`">{{ t('listopt.anzeige.skala') }}</label>
        <input
          :id="`${id}-anzeige-skala`"
          class="input"
          type="number"
          :min="SKALA_MIN_PROZENT"
          :max="SKALA_MAX_PROZENT"
          step="5"
          data-feld="anzeige-skala"
          :value="Math.round(state.anzeige.skala * 100)"
          @change="setzeSkala"
        />
      </div>
      <p class="note" style="flex: 1; min-width: 220px; margin: 0">{{ t('listopt.anzeige.skala.hint', { min: SKALA_MIN_PROZENT, max: SKALA_MAX_PROZENT }) }}</p>
    </div>

    <label class="boat-check" style="margin-top: 12px">
      <input type="checkbox" data-feld="anzeige-logos" :checked="state.anzeige.logos" @change="setzeAnzeige({ logos: ($event.target as HTMLInputElement).checked })" />
      {{ t('listopt.anzeige.logos') }}
    </label>
    <p class="note">{{ t('listopt.anzeige.logos.hint', { logos: t('listopt.logo.title') }) }}</p>
  </div>

  <!-- Startfolge im Betrieb (Plan vom 16.11.2026, E2): wie die Start-Freigabe umstellt – eine Einstellung, deshalb hier und
       nicht an der Start-Freigabe (BETRIEB_ANNAHMEN.wohin). E3: „Am Steg“/„Vor Steg“ und die Startabstände. -->
  <div id="betrieb" class="panel">
    <h2>{{ t('listopt.betrieb.title') }}</h2>
    <p class="hint">
      {{ t('listopt.betrieb.hint') }}
      <a :href="adresse('betrieb')">{{ t('nav.betrieb') }} → {{ t('betrieb.title') }}</a>
    </p>
    <label class="boat-check">
      <input
        type="checkbox"
        data-feld="betrieb-verzahnung-halten"
        :checked="state.anzeige.verzahnungHalten"
        @change="setzeAnzeige({ verzahnungHalten: ($event.target as HTMLInputElement).checked })"
      />
      {{ t('listopt.betrieb.verzahnungHalten') }}
    </label>
    <p class="note">{{ t('listopt.betrieb.verzahnungHalten.hint') }}</p>

    <h3>{{ t('listopt.betrieb.steg') }}</h3>
    <div class="row" style="align-items: flex-end; gap: 20px">
      <div class="field" style="max-width: 160px">
        <label :for="`${id}-betrieb-am-steg`">{{ t('listopt.betrieb.amSteg') }}</label>
        <input
          :id="`${id}-betrieb-am-steg`"
          class="input"
          type="number"
          min="0"
          :max="STEG_MAX"
          step="1"
          data-feld="betrieb-am-steg"
          :value="state.anzeige.amSteg"
          @change="setzeSteg('amSteg', $event)"
        />
      </div>
      <div class="field" style="max-width: 160px">
        <label :for="`${id}-betrieb-vor-steg`">{{ t('listopt.betrieb.vorSteg') }}</label>
        <input
          :id="`${id}-betrieb-vor-steg`"
          class="input"
          type="number"
          min="0"
          :max="STEG_MAX"
          step="1"
          data-feld="betrieb-vor-steg"
          :value="state.anzeige.vorSteg"
          @change="setzeSteg('vorSteg', $event)"
        />
      </div>
      <p class="note" style="flex: 1; min-width: 220px; margin: 0">{{ t('listopt.betrieb.steg.hint', { max: STEG_MAX }) }}</p>
    </div>

    <!-- Startabstände je Klasse (E3, Lastenheft der Tafel L-3 bis L-6): Vorgabe, eigener Wert, Messung, was gilt. -->
    <h3>{{ t('listopt.betrieb.abstaende') }}</h3>
    <p class="note">{{ t('listopt.betrieb.abstaende.hint', { min: ABSTAND_MIN, max: ABSTAND_MAX, ab: MESS_AB }) }}</p>
    <div style="overflow-x: auto">
      <table class="startabstaende" data-teil="startabstaende">
        <thead>
          <tr>
            <th>{{ t('listopt.betrieb.abstaende.klasse') }}</th>
            <th>{{ t('listopt.betrieb.abstaende.vorgabe') }}</th>
            <th>{{ t('listopt.betrieb.abstaende.eigen') }}</th>
            <th>{{ t('listopt.betrieb.abstaende.gemessen') }}</th>
            <th>{{ t('listopt.betrieb.abstaende.gilt') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="z in abstandZeilen" :key="z.klasse" :data-klasse="z.klasse">
            <td><span class="class-badge" :style="{ background: classColor(z.klasse) }">{{ classLabel(z.klasse) }}</span></td>
            <td class="zahl" data-teil="vorgabe">{{ sekunden(z.vorgabe) }}</td>
            <td>
              <input
                class="input"
                type="number"
                :min="ABSTAND_MIN"
                :max="ABSTAND_MAX"
                step="5"
                :class="z.eigen !== null ? 'own' : ''"
                :data-feld="`betrieb-abstand|${z.klasse}`"
                :value="z.eigen ?? ''"
                :placeholder="String(z.vorgabe)"
                :aria-label="`${t('listopt.betrieb.abstaende.eigen')} – ${classLabel(z.klasse)}`"
                @change="setzeAbstand(z, $event)"
              />
            </td>
            <td class="zahl" data-teil="gemessen">
              <template v-if="z.gemessen">
                {{ sekunden(z.gemessen.mittel) }}
                <span class="note">{{ tn('listopt.betrieb.abstaende.anzahl', z.gemessen.anzahl) }}, {{ t('listopt.betrieb.abstaende.zuletzt', { zeit: sekunden(z.gemessen.zuletzt) }) }}</span>
              </template>
              <template v-else>–</template>
            </td>
            <td class="zahl" data-teil="gilt" :data-quelle="z.quelle">
              <b>{{ sekunden(z.wirksam) }}</b> <span class="note">{{ t(`listopt.betrieb.abstaende.quelle.${z.quelle}`) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="row" style="align-items: center; gap: 12px; margin-top: 10px">
      <button type="button" class="btn" data-action="messwerte-uebernehmen" :disabled="!uebernehmenAendert" @click="setzeAnzeige({ abstaende: uebernommen })">
        {{ t('listopt.betrieb.abstaende.uebernehmen') }}
      </button>
      <button type="button" class="btn" data-action="abstaende-vorgabe" :disabled="!hatEigeneAbstaende" @click="setzeAnzeige({ abstaende: {} })">
        {{ t('listopt.betrieb.abstaende.alleVorgabe') }}
      </button>
      <span class="note" data-teil="messungen">{{ tn('listopt.betrieb.abstaende.messungen', messZahl) }}</span>
    </div>
    <p class="note">{{ t('listopt.betrieb.abstaende.uebernehmen.hint', { ab: MESS_AB }) }}</p>
  </div>

  <!-- Geräte (E6): über welchen Server Anzeigetafel und Zuschauerliste auf andere Geräte gehen. Eingeschaltet wird unter
       Betrieb → Geräte; hier nur die Einstellung und was über den Server geht (ehrlich: „kein Server“ gilt bis dahin). -->
  <div id="geraete" class="panel">
    <h2>{{ t('listopt.geraete.title') }}</h2>
    <p class="hint">
      {{ t('listopt.geraete.hint') }}
      <a :href="adresse('betrieb', { reiter: 'geraete' })">{{ t('nav.betrieb') }} → {{ t('betrieb.reiter.geraete') }}</a>.
    </p>
    <div class="row" style="align-items: flex-end; gap: 12px">
      <div class="field" style="flex: 1; min-width: 260px">
        <label :for="`${id}-geraete-server`">{{ t('listopt.geraete.server') }}</label>
        <input
          :id="`${id}-geraete-server`"
          class="input"
          :class="state.geraeteServer ? 'own' : ''"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          data-feld="geraete-server"
          :value="state.geraeteServer"
          :placeholder="NTFY_VORGABE"
          @change="setzeServer"
        />
      </div>
      <button type="button" class="btn" data-action="geraete-server-vorgabe" :disabled="!state.geraeteServer" @click="(serverFehler = ''), dispatch({ type: 'SET_GERAETE_SERVER', server: '' })">
        {{ t('listopt.geraete.server.zurueck') }}
      </button>
    </div>
    <p class="note">{{ t('listopt.geraete.server.vorgabe', { server: NTFY_VORGABE }) }}</p>
    <p v-if="serverFehler" class="boat-banner warn" role="alert" data-hinweis="geraete-server-ungueltig">{{ t('listopt.geraete.server.ungueltig', { eingabe: serverFehler }) }}</p>
    <p v-if="raumServer" class="boat-banner warn" role="status" data-hinweis="geraete-raum-server">{{ t('listopt.geraete.raumServer', { server: raumServer }) }}</p>
    <p class="note" data-hinweis="geraete-daten">{{ t('listopt.geraete.daten') }}</p>
  </div>

  <EigeneAufbautenPanel />

  <OfflinePanel />

  <div id="dateien" class="panel">
    <h2>{{ t('files.title') }}</h2>
    <p class="hint">{{ t('files.intro') }}</p>
    <ul class="file-list">
      <li v-for="k in FILE_KINDS" :key="k">
        <button class="btn" @click="download(k)">↓ {{ t(`files.download.${k}`) }}</button>
        <span class="note">{{ t(`files.about.${k}`) }}</span>
      </li>
    </ul>
    <div class="row" style="align-items: center; margin-top: 14px">
      <!-- Eine echte Schaltfläche: Ein Feld mit `hidden` ist mit der Tastatur nicht erreichbar. -->
      <button type="button" class="btn primary" data-action="upload-file" @click="dateiFeld?.click()">↑ {{ t('files.upload') }}</button>
      <input ref="dateiFeld" type="file" accept="application/json,.json" hidden @change="upload" />
      <span class="note" style="flex: 1; min-width: 220px">{{ t('files.uploadNote') }}</span>
      <button class="btn danger" @click="reset">{{ t('backup.reset') }}</button>
    </div>
    <p v-if="message" :class="['boat-banner', message.ok ? 'ok' : 'warn']" role="status">{{ message.text }}</p>
    <p v-if="legacy" class="boat-banner ok">
      {{ t('backup.legacy.text', { n: legacy.starters.length }) }}
      <button class="btn sm" @click="takeLegacy">{{ t('backup.legacy.button') }}</button>
    </p>

    <!-- Zweiter Speicher und Verlauf: gehört zu den Dateien, weil es dieselbe Frage beantwortet – wie komme ich an einen früheren Stand. -->
    <VerlaufPanel />
  </div>

  <FremdeBestandteile />
  </div>
  </div>
</template>
