import { inject, ref, toRaw, type InjectionKey, type Ref } from 'vue'
import type { AppState } from '../types'
import { emptyState, reducer, type Action } from './reducer'
import { liesGespeichert, schreibeText, serialisiere, standAus, STATE_KEY, VERLAUF_LEEREN_KEY } from '../persistenz/storage'
import { neueKennung } from '../lib/qr'
import { beschreibe, vergleiche, type Beschreibung, type Speichermarke } from '../lib/verlauf'
import { createZweit, type Zweit } from './zweit'

export interface Store {
  /** Zustand als Ref – jede Action ersetzt ihn als Ganzes. */
  state: Ref<AppState>
  /**
   * `was`: wie die Änderung im Verlauf heißt, wenn es die Action selbst nicht sagt – ein
   * geladener Stand kann aus einer Sicherung, einer Vorlage oder dem Verlauf stammen.
   */
  dispatch: (action: Action, was?: Beschreibung) => void
  /**
   * Setzt den Stand ohne Action auf einen früheren zurück. Nur für den Handscanner
   * (lib/scanner.ts): Die ersten Zeichen eines Scans landen als Eingabe im Stand, bevor der
   * Code erkannt ist – sie sollen keine Spur hinterlassen, auch keinen Zeitpunkt auf einer
   * Wertungsliste.
   */
  stelleHer: (stand: AppState) => void
  /** `false`, sobald ein Stand nicht gespeichert werden konnte. */
  saved: Ref<boolean>
  /** Zweiter Speicher (IndexedDB) und Verlauf – state/zweit.ts. */
  zweit: Zweit
  /** Hört nicht mehr auf andere Fenster und das Verlassen der Seite. Die Anwendung braucht das nie; Tests mit mehreren Stores schon. */
  beende: () => void
}

export const storeKey: InjectionKey<Store> = Symbol('store')

export interface StoreUmgebung {
  /** `indexedDB` für den zweiten Speicher; `null` schaltet ihn ab. Vorgabe: die des Browsers. */
  idb?: IDBFactory | null
}

/**
 * Zentraler Store: reiner Reducer, jede Änderung wird sofort gespeichert.
 *
 * Was der Reducer nicht darf, geschieht hier: Jede Action bekommt ihren Zeitpunkt (daraus
 * wird der Stand der Wertungslisten), und eine Veranstaltung ohne Kennung für die QR-Codes
 * bekommt eine gewürfelte – beides reist als Teil der Action, sodass dieselbe Action überall
 * zum selben Ergebnis führt.
 *
 * Gespeichert wird zweimal: sofort im localStorage (wie immer) und gleich danach im zweiten
 * Speicher, einer IndexedDB (state/zweit.ts). Jede Speicherung bekommt hier ihre Speichermarke
 * (Folge-Nummer und Uhrzeit) – der Reducer bleibt ohne Uhr und ohne Zähler. Beim Start gilt der
 * Speicher mit der neueren Marke.
 *
 * Mehrere Fenster desselben Browsers teilen sich den localStorage. Ändert ein
 * anderes Fenster den Stand, übernimmt dieses ihn (`storage`-Ereignis) – so
 * bleiben etwa Auswertung und Listenansicht auf zwei Bildschirmen gleich. Der zweite Speicher
 * ändert daran nichts: Im laufenden Betrieb wird aus ihm nie ein Stand übernommen, nur beim
 * Start – und dort nur, wenn er neuer ist als der localStorage in diesem Augenblick.
 */
export function createStore(umgebung: StoreUmgebung = {}): Store {
  const geladen = liesGespeichert()
  const state = ref<AppState>(geladen.state ?? emptyState())
  const saved = ref(true)
  let marke: Speichermarke = geladen.marke ?? { folge: 0, zeit: 0 }

  const zweit = createZweit({
    folge: marke.folge,
    fabrik: umgebung.idb === undefined ? (typeof indexedDB === 'undefined' ? null : indexedDB) : umgebung.idb,
    erster: () => {
      const { json, marke, state: stand } = liesGespeichert()
      return { json: stand ? json : null, marke, leer: !stand || stand.starters.length === 0 }
    },
    uebernimm: (json, m) => {
      const stand = standAus(json)
      if (!stand) return false
      state.value = stand
      marke = { folge: m.folge, zeit: m.zeit }
      // Derselbe Text mit derselben Marke: Beide Speicher sind danach gleich.
      saved.value = schreibeText(json)
      return true
    },
    stempel: (mindestens, was) => {
      marke = { ...marke, folge: Math.max(marke.folge, mindestens - 1) }
      sichere(toRaw(state.value), was)
    },
    jetzigerText: () => ({ json: serialisiere(toRaw(state.value), marke), marke }),
    leerenOffen: {
      lies: () => localStorage.getItem(VERLAUF_LEEREN_KEY) !== null,
      setze: (offen) => (offen ? localStorage.setItem(VERLAUF_LEEREN_KEY, '1') : localStorage.removeItem(VERLAUF_LEEREN_KEY)),
    },
  })

  /** Speichert den Stand in beiden Speichern; die Marke entsteht hier. */
  function sichere(stand: AppState, was: Beschreibung | null, leeren = false) {
    marke = { folge: marke.folge + 1, zeit: Date.now() }
    const json = serialisiere(stand, marke)
    saved.value = schreibeText(json)
    zweit.notiere(json, marke, was, leeren)
  }

  function dispatch(action: Action, was?: Beschreibung) {
    const zeit = action.zeit ?? Date.now()
    // Eine neue Veranstaltung ist eine andere: Sie bekommt gleich ihre eigene Kennung.
    const mitZeit: Action = action.type === 'RESET_ALL' ? { kennung: neueKennung(Math.random), ...action, zeit } : { ...action, zeit }
    // Der Reducer rechnet auf dem Stand selbst, nicht auf Vues Hülle darum: Sonst trüge der neue
    // Stand deren Hüllen in sich weiter, und das Speichern (JSON) liefe bei jedem Tastendruck
    // durch sie hindurch – gemessen 15 ms statt 1 ms bei 300 Startern.
    const vorher = toRaw(state.value)
    let next = reducer(vorher, mitZeit)
    // Geladener Stand aus der Zeit vor den QR-Codes.
    if (!next.kennung) next = reducer(next, { type: 'SET_KENNUNG', kennung: neueKennung(Math.random), zeit })
    if (next === vorher) return
    state.value = next
    // „Alles zurücksetzen“ löscht auch den Verlauf: Er enthält die Namen der Veranstaltung.
    sichere(next, was ?? beschreibe(mitZeit, next), action.type === 'RESET_ALL')
  }

  function stelleHer(stand: AppState) {
    if (stand === state.value) return
    state.value = stand
    sichere(toRaw(stand), null)
  }

  // Auch ohne erste Action: Die Bögen lassen sich sofort drucken und brauchen die Kennung.
  if (!state.value.kennung) dispatch({ type: 'SET_KENNUNG', kennung: neueKennung(Math.random) })

  const lauscher = new AbortController()
  if (typeof window !== 'undefined') {
    const signal = lauscher.signal
    window.addEventListener(
      'storage',
      (event) => {
        if (event.key !== STATE_KEY) return
        const fremd = liesGespeichert()
        state.value = fremd.state ?? emptyState()
        zweit.fremd(fremd.marke)
        const v = vergleiche(fremd.marke, marke)
        if (v > 0 && fremd.marke) marke = fremd.marke
        // Ein Stand mit älterer oder ohne Marke stammt von einem Fenster, das noch mit einer
        // früheren Fassung läuft (es schreibt die Marke nicht fort). Er gilt wie jeder Stand eines
        // anderen Fensters – bekommt aber gleich eine neue Marke, sonst hielte der nächste Start
        // den zweiten Speicher für neuer. Das schaukelt sich nicht auf: Die neue Marke ist für
        // alle Fenster die neueste.
        else if (v < 0 && fremd.state) sichere(toRaw(state.value), null)
      },
      { signal },
    )
    // Verborgen oder verlassen: Was noch wartet, sofort schreiben – danach kommt vielleicht
    // kein Augenblick mehr. (`pagehide` statt `unload`: Das gibt es auch auf Telefonen.)
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') zweit.sofort()
      },
      { signal },
    )
    window.addEventListener('pagehide', () => zweit.sofort(), { signal })
  }

  return { state, dispatch, stelleHer, saved, zweit, beende: () => lauscher.abort() }
}

export function useStore(): Store {
  const store = inject(storeKey, null)
  if (!store) throw new Error('useStore() needs a provided store')
  return store
}
