<script setup lang="ts">
import { computed, nextTick, ref, toRaw, watch } from 'vue'
import { useStore } from '../../state/store'
import { useKonfig } from '../../lib/konfig'
import { bogenSeiten, defFuerKlasse, type BogenBlattSpalte, type BogenModellZeile } from '../../lib/bogen'
import { codeEntries, normalizeCodeCell, parseCodeEntry } from '../../lib/codes'
import { allowedSet, sanitizeBuoy, sanitizeCodeInput, sanitizeDisq } from '../../lib/disq'
import { erfasstKennung, feldVon, felderJeKennung, laufSchluessel, listenFelder, werteVon, type EingabeZelle, type Feld } from '../../lib/eingaben'
import { nichtGestartet, ueberschreibtX, versucheAbweichend, zeileErfasst, zeileHatWerte, zeilenHinweise, zeilenSchluessel, zeilenSchluesselAlle, type Hinweis } from '../../lib/erfassung'
import { parallelListen } from '../../lib/parallelBogen'
import { gridNavKeyDown } from '../../lib/gridnav'
import { veranstaltungsListen } from '../../lib/listen'
import { scoreRow, summenText, formatDisqs } from '../../lib/scoring'
import type { WkrBogen } from '../../lib/wkrListen'
import { locale, t, tn } from '../../i18n'
import type { Column, TrennerDesign } from '../../types'
import { NICHT_GESTARTET } from '../../lib/abmeldung'
import { adresse } from '../../lib/router'
import { useUhr } from '../../lib/uhr'
import { useGeraeteHost } from '../../geraete/host'
import { geraetAngaben } from '../../geraete/register'
import { herkunftGilt, type HerkunftEintrag } from '../../geraete/wkrEingang'
import { zeilenMarken, type ZeilenMarke, type ZeilenMarken } from '../../wkr/lage'
import { liesListe, listenKennung as wkrListenKennung, listeVonBogen } from '../../wkr/liste'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import { uhrzeitText } from '../betrieb/texte'
import { wiederholteZellen } from '../../betrieb/folge'
import { giltFuerAlleVersuche } from '../../wkr/versuch'
import AppDialog from '../AppDialog.vue'
import BogenLegende from '../bogen/BogenLegende.vue'
import ZeitZelle from './ZeitZelle.vue'

/**
 * Ein Wettkampfrichter-Bogen zum Abtippen: dieselben Spalten und dieselbe Zeilenreihenfolge
 * wie auf dem Papier (das Modell kommt aus lib/bogen.ts), aber als Eingabetabelle für den
 * Bildschirm – ohne A4-Maße, damit sie auch am Telefon bedienbar bleibt (die Tabelle rollt
 * quer, die Startnummer bleibt stehen). Vorbild: SheetPage.vue im Fehlerpunkte-Prototyp.
 *
 * Jede Zelle schreibt sofort in den Stand: Lauf-Schlüssel, Starter-ID und Feld-Kennung
 * benennen sie (lib/eingaben.ts). Leerzeilen gibt es hier nicht – wer nachgemeldet ist, wird
 * unter „Starter“ angelegt und hat dann seine Zeile.
 *
 * Listen einer Runde des Parallelslaloms (lib/parallelBogen.ts): Jede Zeile ist ein Start und
 * hat ihren eigenen Lauf-Schlüssel (den Attempt, lib/parallelSchluessel.ts) – die Werte hängen
 * an Starter-ID und Attempt, nicht am Racecourse. Die Zeile eines Dummys oder eines
 * entfallenen Starts steht grau da und hat keine Felder: Enter und die Pfeiltasten
 * überspringen sie von selbst.
 *
 * „Versuche direkt nacheinander“ (lib/bogen.ts `BogenAuftrag.versuche`): Auch auf einem Bogen
 * des Manövrierens steht dann jeder Starter je Versuch einmal da, und jede Zeile schreibt unter
 * ihren Versuch (Lauf) – wie auf dem Papier. Nur am Vorsteg (`BogenAuftrag.einmal`) steht er
 * einmal da: Seine Zeile gilt für jeden Versuch und schreibt unter jeden (lib/erfassung.ts
 * `zeilenSchluesselAlle`). Nähme eine Eingabe dabei einem späteren Versuch ein X „Nicht
 * gestartet“, das die Zeile nicht zeigt, fragt die Tabelle vorher nach (`frage`).
 *
 * Digitale WKR-Erfassung (W2.3, Plan docs/plan-wkr-w2.md §6.2, 21.11.2026) – nur am Bedienrechner, also nur mit dem
 * Host dieses Fensters (ohne ihn: keine Zeichen, keine Rückfragen): ◆ an Zellen, deren Wert noch der vom Gerät ist
 * (Herkunft gerätelokal, F10; X vom Gerät dazu gerahmt, F5), „Papier ansehen“ an Zeile bzw. Zelle (F4, A5 – gerechnet
 * in wkr/lage.ts zeilenMarken, einmal je Bogen) und vor der ersten Änderung eines Gerätewerts die Nachfrage (§8
 * Vorrang 3, A7: gilt, solange die Zelle den Fokus hat). Werte gehen weiter nur über SET_EINGABEN.
 */
const props = defineProps<{ bogen: WkrBogen }>()

const { state, dispatch } = useStore()
const konfig = useKonfig({ oberflaeche: true })
const host = useGeraeteHost()
// Die Uhr nur für die Ampel der Geräte („offen, Gerät weg“, A5) und „heute?“ im Titel von ◆ – grob genügt (C4).
const jetzt = host ? useUhr(WKR_ANNAHMEN.erfassungUhrSek * 1000) : null

// Mehrere Klassen (Clubmeisterschaft): in Blöcken mit Überschrift oder gemischt in der Startfolge mit der Klasse in
// ihrer Spalte – wie der gedruckte Bogen (`klassenBloecke` kommt aus lib/wkrListen.ts, Einstellung 24.11.2026).
// Leerzeilen gibt es hier nicht, auch nicht die je Seite.
const seite = computed(
  () => bogenSeiten(konfig.value, props.bogen.auftrag, { klassenBloecke: props.bogen.optionen.klassenBloecke, leerzeilen: 0, leerzeilenJeKlasse: {} })[0],
)
const basisDef = computed(() => konfig.value.getSheetDef(props.bogen.typeId))
/** Der Lauf-Schlüssel des Bogens; auf Listen einer Runde gilt je Zeile ihr Attempt ({@link schluesselVon}). */
const schluessel = computed(() => zeilenSchluessel(konfig.value, state.value.aufbau, props.bogen.auftrag))
const schluesselVon = (row: BogenModellZeile) => (row.lauf === undefined ? schluessel.value : zeilenSchluessel(konfig.value, state.value.aufbau, props.bogen.auftrag, row.lauf))
/**
 * Die weiteren Lauf-Schlüssel, unter die jede Zeile schreibt: nur am Vorsteg mit „Versuche direkt
 * nacheinander“ (die Versuche 2 … n; gelesen wird unter dem ersten, {@link schluessel}). Sonst leer.
 */
// Erst als EIN Text: Jede Eingabe ersetzt den Stand; ein neues Array gälte sonst jedes Mal als
// Änderung und legte den Vorrat der Zeilen neu an (siehe `vorrat`).
const weitereKennung = computed(() => zeilenSchluesselAlle(konfig.value, state.value.aufbau, props.bogen.auftrag).slice(1).join('\n'))
const weitereSchluessel = computed(() => (weitereKennung.value ? weitereKennung.value.split('\n') : []))
const KEINE: readonly Readonly<Record<string, string>>[] = Object.freeze([])
/** Die Starter-ID einer Zeile: sonst ihr Schlüssel, auf Listen einer Runde eigens genannt. */
const starterVon = (row: BogenModellZeile) => row.starter ?? row.key
// Die Listen der Veranstaltung als EIN Wert: Jede Eingabe ersetzt den Stand, die Listen bleiben
// dabei dieselben – als neues Array gälte sonst bei jedem Tastendruck alles als geändert.
const listenKennung = computed(() => JSON.stringify(props.bogen.runde ? parallelListen(konfig.value) : veranstaltungsListen(konfig.value, state.value)))
const listen = computed<string[]>(() => JSON.parse(listenKennung.value))
/** Alle Felder einer Klasse (für die Hinweise einer Zeile) – einmal je Klasse, nicht je Zeile. */
const alleFelder = computed(() => {
  const k = konfig.value
  const l = listen.value
  const jeKlasse = new Map<string, ReturnType<typeof felderJeKennung>>()
  return (klasse: string) => {
    let felder = jeKlasse.get(klasse)
    if (!felder) jeKlasse.set(klasse, (felder = felderJeKennung(k, klasse, l)))
    return felder
  }
})
const hatSub = (col: Column) => !!col.sub && col.sub.length > 0
const leafKey = (leaf: BogenBlattSpalte) => (leaf.subIndex === undefined ? leaf.colKey : `${leaf.colKey}#${leaf.subIndex}`)
const sep = (links?: TrennerDesign, rechts?: TrennerDesign) => (links ? ` erf-sep-${links}` : '') + (rechts ? ` erf-sepr-${rechts}` : '')
// Mit „Versuche direkt nacheinander“ steht hinter Nr. und Klasse ebenfalls die Spalte Versuch (lib/bogen.ts).
const mitVersuch = computed(() => seite.value.startForm || seite.value.versuchForm)
const totalCols = computed(() => 2 + (seite.value.zeigtKlasse ? 1 : 0) + (seite.value.startForm ? 1 : 0) + (mitVersuch.value ? 1 : 0) + seite.value.leaves.length)

interface Zeile {
  row: BogenModellZeile
  klasse: string
  werte: Readonly<Record<string, string>>
  /** Am Vorsteg mit „Versuche direkt nacheinander“: die Werte der weiteren Versuche (sonst leer). */
  weitere: readonly Readonly<Record<string, string>>[]
  /** Je Blatt-Spalte das Feld; `undefined` bei Σ und bei Spalten, die die Klasse nicht hat. */
  felder: (Feld | undefined)[]
  summen: string[]
  disqTitel?: string
  /** Disq-Buchstaben aus Bojen- und Fehler-Zellen: stehen blass in der leeren Disq-Zelle. */
  autoDisq: string
  erfasst: boolean
  hatWerte: boolean
  hinweise: Hinweis[]
  /** Im Lauf dieser Liste steht das X „Nicht gestartet“: Die Zeile ist schraffiert. */
  x: boolean
}

/**
 * Die zuletzt gebildeten Zeilen, je Starter mit den Werten, aus denen sie entstanden. Jeder
 * Tastendruck ersetzt die Eingaben als Ganzes, lässt aber die Werte aller anderen Starter
 * unberührt (lib/eingaben.ts `setzeWerte`) – ihre Zeilen bleiben dieselben Objekte, und die
 * Vorlage überspringt sie (`v-memo`). Sonst rechnete und verglich jede Ziffer alle Zeilen
 * aller Listen neu, die untereinander stehen. Neu angelegt wird der Vorrat mit allem, was
 * außer den Werten in eine Zeile eingeht: Bogen, Lauf, Listen, Konfiguration (samt Sprache).
 */
const vorrat = computed(() => {
  void seite.value
  void schluessel.value
  void weitereSchluessel.value
  void listen.value
  void locale.value
  return new Map<string, Zeile>()
})

const zeilen = computed<Zeile[]>(() => {
  // Am Stand vorbei gelesen: Er wird mit jeder Action als Ganzes ersetzt (`state.value` genügt
  // als Abhängigkeit), und durch die reaktive Hülle kostete jedes Feld jeder Zeile ein Vielfaches.
  const eingaben = toRaw(state.value).eingaben
  return seite.value.rows.map((row): Zeile => {
    const klasse = row.klasse ?? props.bogen.klassen[0]
    // Ohne Starter (Zwischenüberschrift; Dummy oder entfallener Start einer Runde) gibt es keine Werte.
    if (row.zwischen !== undefined || row.dummy || row.entfaellt) {
      const bekannt = vorrat.value.get(row.key)
      if (bekannt) return bekannt
      const zeile: Zeile = { row, klasse, werte: {}, weitere: KEINE, felder: [], summen: [], autoDisq: '', erfasst: false, hatWerte: false, hinweise: [], x: false }
      vorrat.value.set(row.key, zeile)
      return zeile
    }
    const werte = werteVon(eingaben, schluesselVon(row), starterVon(row))
    const weitere = weitereSchluessel.value.length === 0 ? KEINE : weitereSchluessel.value.map((lauf) => werteVon(eingaben, lauf, starterVon(row)))
    const bekannt = vorrat.value.get(row.key)
    if (bekannt && bekannt.werte === werte && bekannt.weitere.length === weitere.length && bekannt.weitere.every((w, i) => w === weitere[i])) return bekannt
    const zeile = bildeZeile(row, klasse, werte, weitere)
    vorrat.value.set(row.key, zeile)
    return zeile
  })
})

function bildeZeile(row: BogenModellZeile, klasse: string, werte: Readonly<Record<string, string>>, weitere: readonly Readonly<Record<string, string>>[]): Zeile {
  const typeId = props.bogen.typeId
  const felder = seite.value.leaves.map((leaf, li) => (row.cells[li].gilt ? feldVon(konfig.value, typeId, klasse, leaf.colKey, leaf.subIndex) : undefined))
  const listenfelder = listenFelder(konfig.value, typeId, klasse)
  const jeZelle = new Map(listenfelder.map((f) => [f.zelle, f.kennung]))
  // scoreRow fragt Zellschlüssel „<Zeile>:<Zelle>“; die Zeile ist hier leer.
  const score = scoreRow(defFuerKlasse(basisDef.value, klasse), '', (key) => werte[jeZelle.get(key.slice(1)) ?? ''] ?? '')
  const hinweise = zeilenHinweise(listenfelder, werte, alleFelder.value(klasse), typeId)
  return {
    row,
    klasse,
    werte,
    weitere,
    felder,
    summen: seite.value.leaves.map((leaf, li) => (leaf.kind === 'sum' && row.cells[li].gilt ? summenText(score, leaf.colKey) : '')),
    disqTitel: score.disqs.length ? formatDisqs(score.disqs) : undefined,
    autoDisq: [...new Set(score.disqs.filter((d) => !basisDef.value.columns.some((c) => c.kind === 'disq' && c.label === d.where)).map((d) => d.code))].join(', '),
    erfasst: zeileErfasst(listenfelder, werte, typeId),
    hatWerte: zeileHatWerte(listenfelder, werte),
    // Gilt die Zeile für jeden Versuch, fällt auf, wenn ein späterer etwas anderes trägt (lib/erfassung.ts).
    hinweise: versucheAbweichend(listenfelder, werte, weitere, typeId) ? [...hinweise, { art: 'versucheAbweichend' }] : hinweise,
    // … und schraffiert ist sie erst, wenn er in KEINEM Versuch startet.
    x: [werte, ...weitere].every((w) => nichtGestartet(w, alleFelder.value(klasse))),
  }
}

/**
 * Eine Liste ohne Lauf (Knoten) gehört zu keinem Lauf, in dem ein X stehen könnte. Dort ist
 * schraffiert, wer in JEDEM Lauf das X hat – also gar nicht antritt. (Die Zeilen selbst hängen
 * hier an den Werten ohne Lauf; deshalb steht das neben ihnen und nicht in ihnen.)
 */
const nieGestartet = computed<ReadonlySet<string>>(() => {
  const out = new Set<string>()
  if (basisDef.value.showLauf !== false) return out
  const eingaben = toRaw(state.value).eingaben
  const disziplin = konfig.value.getAufbau(state.value.aufbau).disziplin
  const laeufe = Array.from({ length: Math.max(1, state.value.laufCount) }, (_, i) => laufSchluessel(disziplin, i + 1))
  for (const row of seite.value.rows) {
    if (row.zwischen !== undefined) continue
    const felder = alleFelder.value(row.klasse ?? props.bogen.klassen[0])
    if (laeufe.every((lauf) => nichtGestartet(werteVon(eingaben, lauf, row.key), felder))) out.add(row.key)
  }
  return out
})

/**
 * Wiederholung nach Ausfall (Nutzer 26.11.2026, R11-11): Zellen `${lauf}|${starter}`, deren Start nach einem Ausfall
 * wiederholt wird bzw. wurde – ↻ an der Nummer: Auf dem Papier ist die erste Zeile gestrichen, die Werte der Wiederholung
 * stehen in einer Leerzeile; abgetippt wird nur die Wiederholung. Auch ohne Gerätebetrieb (Papier).
 */
const wiederholt = computed<ReadonlySet<string>>(() => {
  // Die Vorsteg-Zeile mit „Versuche nacheinander“ gilt für alle Versuche und bleibt beim Ausfall stehen (WH6) – dort
  // ist keine Zeile gestrichen, also kein ↻ (Prüfbefund 27.11.2026).
  if (giltFuerAlleVersuche(toRaw(state.value), konfig.value, props.bogen.typeId)) return new Set()
  const disziplin = konfig.value.getAufbau(state.value.aufbau).disziplin
  return wiederholteZellen(toRaw(state.value), (lauf) => laufSchluessel(disziplin, lauf))
})
const istWiederholt = (row: BogenModellZeile) => wiederholt.value.size > 0 && wiederholt.value.has(`${schluesselVon(row)}|${starterVon(row)}`)

const ohneStarter = (row: BogenModellZeile) => row.zwischen !== undefined || !!row.dummy || !!row.entfaellt
const starterZeilen = computed(() => zeilen.value.filter((z) => !ohneStarter(z.row) && konfig.value.positionAllowsClass(props.bogen.typeId, z.klasse)))
const fortschritt = computed(() => ({ erfasst: starterZeilen.value.filter((z) => z.erfasst).length, gesamt: starterZeilen.value.length }))
/**
 * Die leeren Zeilen für „alle bestätigen“. Nicht dazu gehört eine Zeile, die für jeden Versuch
 * gilt, deren späterer Versuch aber etwas anderes trägt (Hinweis `versucheAbweichend`): Sie ist
 * nicht leer. Bestätigen gliche alle Versuche an den leeren ersten an und löschte dabei, was im
 * späteren steht – auch ein X „Nicht gestartet“. Das klärt nur eine Eingabe in der Zeile selbst.
 */
const offen = computed(() => starterZeilen.value.filter((z) => !z.erfasst && !z.hinweise.some((h) => h.art === 'versucheAbweichend')))
const mitHinweis = computed(() => starterZeilen.value.filter((z) => z.hinweise.length > 0))
const hatZeit = computed(() => seite.value.leaves.some((l) => l.kind === 'time'))
const hatDisq = computed(() => seite.value.leaves.some((l) => l.kind === 'disq'))

// --- Digitale WKR-Erfassung (W2.3): ◆, „Papier ansehen“, Rückfrage ---------------------------------------------

/** Die Liste des Bogens (Knoten: keine) – nur mit Host; ohne ihn zeigt die Tabelle nichts davon. */
const wkrListe = computed(() => (host ? listeVonBogen(props.bogen, konfig.value) : null))
const geraete = computed(() => geraetAngaben(host?.raum.value?.geraete ?? []))
/** Die Lauf-Schlüssel der Zeilen dieses Bogens (Runde: je Zeile ihr Attempt; Vorsteg: alle Versuche) – als EIN Text. */
const bogenLaeufe = computed(() => [...new Set([...seite.value.rows.filter((r) => !ohneStarter(r)).map(schluesselVon), ...weitereSchluessel.value])].join('\n'))
const KEINE_MARKEN: ReadonlyMap<string, ZeilenMarken> = new Map()
/** Marken je `${lauf}|${starter}`: einmal je Bogen gerechnet (Plan §8 Leistung), nur für Listen digital/beides. */
const marken = computed<ReadonlyMap<string, ZeilenMarken>>(() => {
  const liste = wkrListe.value
  if (!liste) return KEINE_MARKEN
  const stand = toRaw(state.value)
  const kennung = wkrListenKennung(liste)
  // Schon hier abbrechen: Papier-Listen (der Normalfall) sollen beim Tippen nichts kosten.
  if (!Object.hasOwn(stand.wkr.listen, kennung) || stand.wkr.listen[kennung].modus === 'papier') return KEINE_MARKEN
  return zeilenMarken(stand, konfig.value, liste, bogenLaeufe.value.split('\n'), geraete.value, jetzt?.value ?? 0)
})

/** Name einer Liste (Kennung) für den Titel von ◆, in Oberflächensprache. */
function listenTitel(kennung: string): string {
  const l = liesListe(kennung)
  if (!l || !konfig.value.getPositions().some((p) => p.typeId === l.typeId)) return ''
  const titel = konfig.value.getSheetDef(l.typeId).title
  return l.racecourse ? `${titel} ${l.racecourse}` : titel
}

interface WkrRaute {
  eintrag: HerkunftEintrag
  titel: string
  /** Das Gerät hat das X „Nicht gestartet“ gesetzt (F5): zusätzlich gerahmt. */
  x: boolean
}

interface WkrZeile {
  marke: ZeilenMarke | null
  zellen: Readonly<Record<string, ZeilenMarke>>
  /** Je Feld-Kennung ◆ – nur, solange dort noch der Wert des Geräts steht (herkunftGilt). */
  raute: Readonly<Record<string, WkrRaute>>
  /** Alles, was die Zeile davon zeigt, als Text – für v-memo (neue Objekte je Rechnung sollen nicht neu zeichnen). */
  memo: string
}
const KEIN_WKR: WkrZeile = Object.freeze({ marke: null, zellen: Object.freeze({}), raute: Object.freeze({}), memo: '' })

/** Je Zeile (row.key) Marke und ◆. Leer ohne Host, ohne Herkunft und ohne Marken – dann kostet es nichts. */
const wkrZeilen = computed<ReadonlyMap<string, WkrZeile>>(() => {
  const out = new Map<string, WkrZeile>()
  const herkunft = host?.herkunft.value
  const m = marken.value
  const mitHerkunft = !!herkunft && Object.keys(herkunft.zellen).length > 0
  if (!host || (m.size === 0 && !mitHerkunft)) return out
  const eingaben = toRaw(state.value).eingaben
  const uhr = jetzt?.value ?? Date.now()
  for (const z of zeilen.value) {
    if (ohneStarter(z.row)) continue
    const lauf = schluesselVon(z.row)
    const starter = starterVon(z.row)
    const mk = m.get(`${lauf}|${starter}`)
    const raute: Record<string, WkrRaute> = {}
    if (mitHerkunft) {
      for (const feld of z.felder) {
        if (!feld) continue
        const e = herkunftGilt(herkunft!, eingaben, lauf, starter, feld.kennung)
        if (!e) continue
        const x = feld.kind === 'disq' && [...e.w.toUpperCase()].includes(NICHT_GESTARTET)
        const titel = t('capture.wkr.raute', { liste: listenTitel(e.l), geraet: e.g, zeit: uhrzeitText(e.z, uhr) })
        raute[feld.kennung] = { eintrag: e, titel: x ? `${titel} – ${t('capture.wkr.xGeraet', { dns: t('results.dns') })}` : titel, x }
      }
    }
    const rauten = Object.entries(raute)
    if (!mk && rauten.length === 0) continue
    const zellen = mk?.zellen ?? {}
    const memo = [mk?.marke ?? '', ...Object.entries(zellen).map(([f, w]) => `${f}=${w}`), ...rauten.map(([f, r]) => `${f}◆${r.titel}`)].join('\n')
    out.set(z.row.key, { marke: mk?.marke ?? null, zellen, raute, memo })
  }
  return out
})
const wkrVon = (z: Zeile): WkrZeile => wkrZeilen.value.get(z.row.key) ?? KEIN_WKR
/** Zeilen mit „Papier ansehen“ (ganz oder an einer Zelle) und mit offener Rückfrage – für die Zeile unter dem Kopf. */
const papierZahl = computed(() => [...wkrZeilen.value.values()].filter((w) => w.marke === 'papier-ansehen' || Object.values(w.zellen).includes('papier-ansehen')).length)
const rueckfrageZahl = computed(() => [...wkrZeilen.value.values()].filter((w) => w.marke === 'rueckfrage').length)
const zumBetrieb = computed(() => adresse('betrieb', { reiter: 'wkr', ...(wkrListe.value ? { wahl: wkrListe.value.bereich } : {}) }))
const zellMarke = (z: Zeile, feld: Feld | undefined) => (feld ? wkrVon(z).zellen[feld.kennung] : undefined)
const raute = (z: Zeile, feld: Feld | undefined) => (feld ? wkrVon(z).raute[feld.kennung] : undefined)

/**
 * Zellen (row.key|Feld), deren Gerätewert ersetzt werden darf: die Antwort auf die Nachfrage (Vorrang 3) gilt, bis die
 * Zelle den Fokus verliert (A7) – sonst käme die Frage bei jeder Ziffer. Kein reaktiver Zustand, nur Gedächtnis.
 * Gemerkt wird dazu die Zeit des Herkunftseintrags (Prüfbefund 21.11.2026): Kommt in der Zwischenzeit ein neuer
 * Gerätewert in die Zelle (neues ◆), fragt die nächste Eingabe wieder – auch wenn die Zelle den Fokus nie verlor.
 */
const freigegeben = new Map<string, number>()
const freigabeSchluessel = (z: Zeile, kennung: string) => `${z.row.key}|${kennung}`
function zelleVerlassen(z: Zeile, feld: Feld | undefined) {
  if (feld) freigegeben.delete(freigabeSchluessel(z, feld.kennung))
}

// Was beim Verlassen einer Fehler-Zelle verworfen wurde – sonst verschwände ein Tippfehler unbemerkt.
const meldung = ref('')
watch(
  () => props.bogen.id,
  () => (meldung.value = ''),
)

/**
 * Eine Eingabe, die erst nach einer Rückfrage gilt: Sie gliche einen späteren Versuch an und
 * löschte dabei sein X „Nicht gestartet“ (lib/erfassung.ts `ueberschreibtX`; Entscheidung des
 * Nutzers vom 15.11.2026). `zurueck` stellt das Feld wieder auf den gespeicherten Wert, wenn
 * die Eingabe nicht gilt – das Feld zeigt sonst, was nicht gespeichert ist.
 */
/**
 * Zweite Art (W2.3, §8 Vorrang 3): Die Zelle trägt noch den Wert vom Gerät (◆) – ersetzen erst nach Rückfrage.
 * `ja` schreibt (bzw. prüft danach noch das X), `zurueck` wie oben; `feld` bekommt danach den Fokus zurück.
 */
type Frage =
  | { art: 'x'; nr: string; zellen: EingabeZelle[]; zurueck?: () => void }
  | { art: 'geraet'; nr: string; feld: string; geraet: string; zeit: string; wert: string; ja: () => void; zurueck?: () => void; fokus: HTMLInputElement | null; zeitFeld: boolean }
const frage = ref<Frage | null>(null)

function setze(zeile: Zeile, kennung: string, wert: string, zurueck?: () => void) {
  // Solange eine Frage offen ist, schreibt nichts: Das Verlassen des Feldes (der Dialog nimmt den Fokus) brächte
  // sonst dieselbe Eingabe ein zweites Mal – an der Frage vorbei.
  if (frage.value) return
  const r = wkrVon(zeile).raute[kennung]
  if (r && freigegeben.get(freigabeSchluessel(zeile, kennung)) !== r.eintrag.z) {
    const aktiv = document.activeElement
    const feld = zeile.felder.find((f) => f?.kennung === kennung)
    // Zeitfelder melden schon den ersten Tastendruck (ZeitZelle): Dieser Teilwert („1“ statt „1:23,45“) darf nie als
    // Ersatz gespeichert werden (Prüfbefund 21.11.2026). Bei „Ersetzen“ wird dort nur freigegeben; das Feld bekommt
    // den Fokus zurück, markiert den Gerätewert, und die ganze Zeit wird neu getippt.
    const zeitFeld = aktiv instanceof HTMLInputElement && aktiv.classList.contains('erf-feld--zeit')
    frage.value = {
      art: 'geraet',
      nr: zeile.row.nr,
      feld: feld?.label ?? '',
      geraet: r.eintrag.g,
      zeit: uhrzeitText(r.eintrag.z, jetzt?.value ?? Date.now()),
      wert: r.eintrag.w || t('capture.wkr.ersetzen.leer'),
      ja: () => {
        freigegeben.set(freigabeSchluessel(zeile, kennung), r.eintrag.z)
        if (!zeitFeld) setze(zeile, kennung, wert, zurueck)
      },
      zurueck,
      fokus: aktiv instanceof HTMLInputElement ? aktiv : null,
      zeitFeld,
    }
    return
  }
  const zellen = zellenVon(zeile, kennung, wert)
  if (zeile.weitere.length > 0) {
    const neu = { ...zeile.werte, [kennung]: wert }
    if (ueberschreibtX(listenFelder(konfig.value, props.bogen.typeId, zeile.klasse), zeile.werte, zeile.weitere, neu, alleFelder.value(zeile.klasse), props.bogen.typeId)) {
      frage.value = { art: 'x', nr: zeile.row.nr, zellen, zurueck }
      return
    }
  }
  dispatch({ type: 'SET_EINGABEN', zellen })
}

function xUeberschreiben() {
  const f = frage.value
  frage.value = null
  if (f?.art === 'x') dispatch({ type: 'SET_EINGABEN', zellen: f.zellen })
}

function xBehalten() {
  frage.value?.zurueck?.()
  frage.value = null
}

/** Den Gerätewert ersetzen (Vorrang 3); danach zurück ins Feld, Cursor ans Ende – dort wird weitergetippt. */
function geraetErsetzen() {
  const f = frage.value
  frage.value = null
  if (f?.art !== 'geraet') return
  f.ja()
  zurueckInsFeld(f.fokus, f.zeitFeld)
}

function geraetBehalten() {
  const f = frage.value
  frage.value = null
  f?.zurueck?.()
  // Ein Zeitfeld nicht: Es markierte beim Fokus seinen Inhalt, die nächste Ziffer überschriebe den behaltenen Wert.
  if (f?.art === 'geraet' && !f.zeitFeld) zurueckInsFeld(f.fokus, false)
}

/** Zurück ins Feld: Textfelder mit dem Cursor am Ende; ein Zeitfeld markiert beim Fokus selbst seinen Inhalt. */
function zurueckInsFeld(el: HTMLInputElement | null, zeitFeld: boolean) {
  if (!el) return
  void nextTick(() => {
    if (!el.isConnected) return
    el.focus()
    if (!zeitFeld) el.setSelectionRange(el.value.length, el.value.length)
  })
}

/**
 * Die Zellen einer Eingabe. Gilt die Zeile für jeden Versuch (Vorsteg mit „Versuche direkt
 * nacheinander“), steht danach in jedem Versuch dasselbe wie in der Zeile: alle Felder der Liste
 * und ihr Haken, mit der neuen Eingabe – so gleicht die nächste Eingabe auch einen abweichenden
 * späteren Versuch an.
 */
function zellenVon(zeile: Zeile, kennung: string, wert: string): EingabeZelle[] {
  const starter = starterVon(zeile.row)
  const lauf = schluesselVon(zeile.row)
  if (weitereSchluessel.value.length === 0) return [{ lauf, starter, feld: kennung, wert }]
  const kennungen = [...new Set([...listenFelder(konfig.value, props.bogen.typeId, zeile.klasse).map((f) => f.kennung), erfasstKennung(props.bogen.typeId), kennung])]
  const zeilenWerte = { ...zeile.werte, [kennung]: wert }
  return [lauf, ...weitereSchluessel.value].flatMap((l) => kennungen.map((feld): EingabeZelle => ({ lauf: l, starter, feld, wert: zeilenWerte[feld] ?? '' })))
}

const erlaubt = (zeile: Zeile) => allowedSet(defFuerKlasse(basisDef.value, zeile.klasse).disqTable)

function onInput(zeile: Zeile, feld: Feld, e: Event) {
  const input = e.target as HTMLInputElement
  const wert =
    feld.kind === 'buoy'
      ? sanitizeBuoy(input.value, erlaubt(zeile))
      : feld.kind === 'code'
        ? sanitizeCodeInput(input.value)
        : feld.kind === 'disq'
          ? sanitizeDisq(input.value, erlaubt(zeile))
          : feld.kind === 'points'
            ? input.value.replace(/\D/g, '')
            : input.value
  // Auch wenn sich der gespeicherte Wert nicht ändert, darf das Unerlaubte nicht stehen bleiben.
  if (input.value !== wert) input.value = wert
  setze(zeile, feld.kennung, wert, () => (input.value = zeile.werte[feld.kennung] ?? ''))
}

function onBlur(zeile: Zeile, feld: Feld, e: Event) {
  const input = e.target as HTMLInputElement
  if (feld.kind === 'text') {
    if (input.value !== input.value.trim()) setze(zeile, feld.kennung, input.value.trim(), () => (input.value = zeile.werte[feld.kennung] ?? ''))
    return
  }
  if (feld.kind !== 'code') return
  const roh = input.value
  const codes = new Set((feld.katalog ?? []).map((c) => c.code))
  const disqs = erlaubt(zeile)
  const sauber = normalizeCodeCell(roh, codes, disqs)
  // Verworfen: Zahlen, die auf dieser Liste kein Fehlercode sind, und fremde Buchstaben.
  const verworfen = codeEntries(roh).filter((eintrag) => {
    const code = parseCodeEntry(eintrag)
    return code ? !codes.has(code.code) : ![...eintrag.toUpperCase()].every((b) => disqs.has(b))
  })
  meldung.value = verworfen.length > 0 ? t('capture.dropped', { nr: zeile.row.nr, column: feld.label, entries: verworfen.join(', ') }) : ''
  if (sauber !== roh) {
    input.value = sauber
    setze(zeile, feld.kennung, sauber, () => (input.value = zeile.werte[feld.kennung] ?? ''))
  }
}

function hake(zeile: Zeile, e: Event) {
  const box = e.target as HTMLInputElement
  setze(zeile, erfasstKennung(props.bogen.typeId), box.checked ? '1' : '', () => (box.checked = zeile.erfasst))
}

/** Alle noch leeren Zeilen als abgetippt bestätigen: auf einer Tor-Liste sind das die fehlerfreien Fahrten. */
function alleBestaetigen() {
  const feld = erfasstKennung(props.bogen.typeId)
  dispatch({ type: 'SET_EINGABEN', zellen: offen.value.flatMap((z) => zellenVon(z, feld, '1')) })
}

const auffaellig = (zeile: Zeile, leaf: BogenBlattSpalte) => zeile.hinweise.some((h) => h.zelle === leafKey(leaf))
const hinweisText = (zeile: Zeile) => zeile.hinweise.map((h) => t(`capture.hint.${h.art}`, h.werte)).join(' ')
const label = (zeile: Zeile, feld: Feld) => `${zeile.row.nr} – ${feld.label}`
</script>

<template>
  <section class="erf-bogen" :data-bogen="bogen.id">
    <header class="erf-kopf">
      <h3 class="erf-titel">
        <span>{{ seite.titel }}</span>
        <span>{{ seite.klassenText }}</span>
        <span v-if="seite.laufText">{{ seite.laufText }}</span>
        <span v-if="seite.parcours">{{ seite.parcours }}</span>
        <span v-if="seite.wkr" class="erf-wkr">{{ seite.texte.wkr }} {{ seite.wkr }}</span>
      </h3>
      <div class="erf-stand" role="status">
        <progress class="erf-balken" :max="Math.max(1, fortschritt.gesamt)" :value="fortschritt.erfasst" />
        <span class="erf-stand-text" :data-fertig="fortschritt.erfasst === fortschritt.gesamt ? '' : undefined">
          {{ t('capture.progress', { done: fortschritt.erfasst, total: fortschritt.gesamt }) }}
        </span>
        <span v-if="mitHinweis.length > 0" class="erf-stand-warn">{{ tn('capture.flagged', mitHinweis.length) }}</span>
      </div>
      <!-- Digitale WKR-Erfassung (W2.3): wo der Papierbogen wichtig ist, und Rückfragen, die im Betrieb warten. -->
      <p v-if="papierZahl > 0 || rueckfrageZahl > 0" class="erf-wkr-stand" data-teil="wkr-erfassung">
        <span v-if="papierZahl > 0" class="erf-wkr-papier" data-wkr="papier-ansehen"><span aria-hidden="true">▭</span> {{ tn('capture.wkr.kopf', papierZahl) }}</span>
        <span v-if="rueckfrageZahl > 0" class="erf-wkr-rueckfragen" data-wkr="rueckfragen">
          {{ tn('capture.wkr.rueckfragen', rueckfrageZahl) }} <a :href="zumBetrieb" data-action="zu-betrieb-wkr">{{ t('nav.betrieb') }} → {{ t('betrieb.reiter.wkr') }}</a>
        </span>
      </p>
    </header>

    <div class="erf-rahmen">
      <table class="erf-tabelle">
        <thead>
          <tr>
            <th v-if="seite.startForm" class="erf-start" :rowspan="seite.twoRow ? 2 : 1" scope="col">{{ seite.texte.start }}</th>
            <th class="erf-nr" :rowspan="seite.twoRow ? 2 : 1" scope="col">{{ seite.texte.nr }}</th>
            <th v-if="seite.zeigtKlasse" :rowspan="seite.twoRow ? 2 : 1" scope="col">{{ seite.texte.klasseKurz }}</th>
            <th v-if="mitVersuch" :rowspan="seite.twoRow ? 2 : 1" scope="col">{{ seite.texte.attempt }}</th>
            <template v-for="col in seite.columns" :key="col.key">
              <th v-if="hatSub(col)" :class="`erf-gruppe${sep(col.trenner)}`" :colspan="col.sub!.length" scope="colgroup">{{ col.label }}</th>
              <th v-else :class="`erf-k-${col.kind}${sep(col.trenner)}`" :rowspan="seite.twoRow ? 2 : 1" scope="col">{{ col.label }}</th>
            </template>
            <th class="erf-haken" :rowspan="seite.twoRow ? 2 : 1" scope="col" :title="t('capture.doneTitle')">✓</th>
          </tr>
          <tr v-if="seite.twoRow">
            <template v-for="col in seite.columns" :key="col.key">
              <template v-if="hatSub(col)">
                <th
                  v-for="(s, i) in col.sub"
                  :key="`${col.key}-${i}`"
                  :class="`erf-sub${sep(i === 0 ? col.trenner : col.subTrenner, i < col.sub!.length - 1 ? col.subTrenner : undefined)}`"
                  scope="col"
                >
                  {{ s }}
                </th>
              </template>
            </template>
          </tr>
        </thead>
        <tbody>
          <!-- v-memo: Eine Zeile wird nur neu gesetzt, wenn sich ihre Werte geändert haben (siehe `vorrat`). -->
          <tr
            v-for="z in zeilen"
            :key="z.row.key"
            v-memo="[z, totalCols, nieGestartet.has(z.row.key), wkrVon(z).memo, istWiederholt(z.row)]"
            :class="
              z.row.zwischen !== undefined
                ? 'erf-zwischen'
                : {
                    'erf-grau': z.row.shaded,
                    'erf-zeile--erfasst': z.erfasst,
                    'erf-zeile--hinweis': z.hinweise.length > 0,
                    'erf-zeile--x': z.x || nieGestartet.has(z.row.key),
                    'erf-ohne': z.row.dummy || z.row.entfaellt,
                    'erf-blockende': z.row.blockEnde,
                  }
            "
            :data-klasse="z.row.zwischen !== undefined ? z.row.klasse : undefined"
            :data-zeile="z.row.zwischen !== undefined ? undefined : z.row.key"
            :data-starter="z.row.starter"
            :data-attempt="z.row.starter !== undefined ? z.row.lauf : undefined"
            :data-ohne="z.row.dummy ? 'dummy' : z.row.entfaellt ? 'entfaellt' : undefined"
            :data-nicht-gestartet="z.x || nieGestartet.has(z.row.key) ? '' : undefined"
            :data-wkr-marke="wkrVon(z).marke ?? undefined"
            :data-wiederholung="z.row.zwischen === undefined && istWiederholt(z.row) ? '' : undefined"
          >
            <th v-if="z.row.zwischen !== undefined" :colspan="totalCols" scope="rowgroup">{{ z.row.zwischen }}</th>
            <!-- Dummy oder entfallener Start: die Zeile des Papiers, ohne Felder – die Eingabe überspringt sie. -->
            <template v-else-if="z.row.dummy || z.row.entfaellt">
              <td class="erf-start">{{ z.row.start }}</td>
              <td class="erf-dummy" :colspan="totalCols - 1">{{ z.row.entfaellt ? seite.texte.entfaellt : seite.texte.dummy }}</td>
            </template>
            <template v-else>
              <td v-if="seite.startForm" class="erf-start">{{ z.row.start }}</td>
              <th class="erf-nr" scope="row">
                <span v-if="wkrVon(z).marke === 'papier-ansehen'" class="erf-papier-marke" data-marke="papier-ansehen" :title="t('capture.wkr.papier')"
                  >▭<span class="sr-only"> {{ t('capture.wkr.papier') }}</span></span
                >
                <span v-else-if="wkrVon(z).marke === 'rueckfrage'" class="erf-wkr-frage" data-marke="rueckfrage" :title="t('capture.wkr.rueckfrage')"
                  >!<span class="sr-only"> {{ t('capture.wkr.rueckfrage') }}</span></span
                >
                {{ z.row.nr }}
                <span v-if="istWiederholt(z.row)" class="erf-wiederholung-marke" data-marke="wiederholung" :title="t('capture.wiederholung')"
                  >↻<span class="sr-only"> {{ t('capture.wiederholung') }}</span></span
                >
                <span v-if="z.x || nieGestartet.has(z.row.key)" class="erf-x-marke" :title="t('results.dns')">✕<span class="sr-only"> {{ t('results.dns') }}</span></span>
                <span v-if="z.hinweise.length > 0" class="erf-marke" :title="hinweisText(z)" aria-hidden="true">!</span>
              </th>
              <td v-if="seite.zeigtKlasse" class="erf-klasse">{{ z.row.klasseText ?? '' }}</td>
              <td v-if="mitVersuch" class="erf-attempt">{{ z.row.lauf }}</td>
              <template v-for="(leaf, li) in seite.leaves" :key="leafKey(leaf)">
                <td v-if="leaf.kind === 'sum'" :class="`erf-z-sum${sep(leaf.trenner, leaf.trennerR)}${z.row.cells[li].gilt ? '' : ' erf-entfaellt'}`" :title="z.disqTitel" :data-spalte="leafKey(leaf)">
                  {{ z.summen[li] }}
                </td>
                <td v-else-if="!z.felder[li]" :class="`erf-entfaellt${sep(leaf.trenner, leaf.trennerR)}`" :data-spalte="leafKey(leaf)" />
                <td
                  v-else
                  :class="[
                    `erf-z-${leaf.kind}${sep(leaf.trenner, leaf.trennerR)}`,
                    {
                      'erf-zelle--papier': zellMarke(z, z.felder[li]) === 'papier-ansehen',
                      'erf-zelle--rueckfrage': zellMarke(z, z.felder[li]) === 'rueckfrage',
                      'erf-zelle--geraet': !!raute(z, z.felder[li]),
                      'erf-zelle--x-geraet': !!raute(z, z.felder[li])?.x,
                    },
                  ]"
                  :data-spalte="leafKey(leaf)"
                  :data-wkr-zelle="zellMarke(z, z.felder[li])"
                  :title="zellMarke(z, z.felder[li]) === 'papier-ansehen' ? t('capture.wkr.papierZelle') : zellMarke(z, z.felder[li]) === 'rueckfrage' ? t('capture.wkr.rueckfrage') : undefined"
                  @focusout="zelleVerlassen(z, z.felder[li])"
                >
                  <span v-if="raute(z, z.felder[li])" class="erf-raute" data-raute :title="raute(z, z.felder[li])!.titel"
                    >◆<span class="sr-only"> {{ raute(z, z.felder[li])!.titel }}</span></span
                  >
                  <ZeitZelle
                    v-if="leaf.kind === 'time'"
                    :value="z.werte[z.felder[li]!.kennung] ?? ''"
                    :label="label(z, z.felder[li]!)"
                    :auffaellig="auffaellig(z, leaf)"
                    @change="setze(z, z.felder[li]!.kennung, $event)"
                  />
                  <input
                    v-else
                    :class="['erf-feld', `erf-feld--${leaf.kind}`, { 'erf-feld--auffaellig': auffaellig(z, leaf), 'erf-feld--boje-lang': leaf.kind === 'buoy' && (z.werte[z.felder[li]!.kennung] ?? '').length > 4 }]"
                    autocomplete="off"
                    autocapitalize="characters"
                    spellcheck="false"
                    :inputmode="leaf.kind === 'points' ? 'numeric' : undefined"
                    :aria-label="label(z, z.felder[li]!)"
                    :aria-invalid="auffaellig(z, leaf) ? 'true' : undefined"
                    :placeholder="leaf.kind === 'disq' ? z.autoDisq : undefined"
                    :value="z.werte[z.felder[li]!.kennung] ?? ''"
                    @input="onInput(z, z.felder[li]!, $event)"
                    @blur="onBlur(z, z.felder[li]!, $event)"
                    @keydown="gridNavKeyDown"
                  />
                </td>
              </template>
              <td class="erf-haken">
                <!-- Mit Werten ist die Zeile ohnehin erfasst; der Haken ist für die leeren (fehlerfreien). -->
                <input
                  type="checkbox"
                  :checked="z.erfasst"
                  :disabled="z.hatWerte || !konfig.positionAllowsClass(bogen.typeId, z.klasse)"
                  :aria-label="t('capture.doneFor', { nr: z.row.nr })"
                  @change="hake(z, $event)"
                />
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="meldung" class="boat-banner warn" role="alert">{{ meldung }}</p>
    <ul v-if="mitHinweis.length > 0" class="erf-hinweise" role="status">
      <li v-for="z in mitHinweis" :key="z.row.key"><strong>{{ z.row.nr }}</strong> {{ hinweisText(z) }}</li>
    </ul>

    <div class="row erf-fuss">
      <button type="button" class="btn sm" data-action="alle-bestaetigen" :disabled="offen.length === 0" @click="alleBestaetigen">
        {{ tn('capture.confirmEmpty', offen.length) }}
      </button>
      <span class="note" style="flex: 1; min-width: 220px; margin: 0">
        {{ t('capture.keys') }}
        <template v-if="hatZeit"> {{ t('capture.timeFormat') }}</template>
        <template v-if="hatDisq"> {{ t('capture.notStarted') }}</template>
      </span>
    </div>

    <details class="sub-details erf-legende">
      <summary>{{ t('capture.legend') }}</summary>
      <BogenLegende :def="seite.def" />
    </details>

    <AppDialog v-if="frage?.art === 'geraet'" :titel="t('capture.wkr.ersetzen.heading')" data-dialog="geraet-ersetzen" @abbrechen="geraetBehalten">
      <p>{{ t('capture.wkr.ersetzen.text', { nr: frage.nr, feld: frage.feld, geraet: frage.geraet, zeit: frage.zeit, wert: frage.wert }) }}</p>
      <template #knoepfe>
        <button type="button" class="btn primary" data-action="geraet-behalten" autofocus @click="geraetBehalten">{{ t('capture.wkr.ersetzen.keep') }}</button>
        <button type="button" class="btn" data-action="geraet-ersetzen" @click="geraetErsetzen">{{ t('capture.wkr.ersetzen.confirm') }}</button>
      </template>
    </AppDialog>
    <AppDialog v-else-if="frage" :titel="t('capture.overwriteX.heading', { dns: t('results.dns') })" data-dialog="x-ueberschreiben" @abbrechen="xBehalten">
      <p>{{ t('capture.overwriteX.text', { nr: frage.nr, dns: t('results.dns') }) }}</p>
      <template #knoepfe>
        <button type="button" class="btn primary" data-action="x-behalten" autofocus @click="xBehalten">{{ t('capture.overwriteX.keep') }}</button>
        <button type="button" class="btn" data-action="x-ueberschreiben" @click="xUeberschreiben">{{ t('capture.overwriteX.confirm') }}</button>
      </template>
    </AppDialog>
  </section>
</template>
