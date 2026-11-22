import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { computed, nextTick, shallowRef } from 'vue'
import GeraetApp from './GeraetApp.vue'
import WkrGeraet from './components/wkr/WkrGeraet.vue'
import WkrUebung from './components/wkr/WkrUebung.vue'
import WkrAbschluss from './components/wkr/WkrAbschluss.vue'
import { starteGeraeteHost, type GeraeteHost } from './geraete/host'
import type { Ablage } from './geraete/ablage'
import type { Aufgabe } from './geraete/aufgaben'
import { oeffneUebung } from './geraete/uebung'
import type { ErfassungsQuelle } from './geraete/erfassen'
import { formatiereCode } from './geraete/koppeln'
import { koppelnAdresse } from './geraete/paket'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, ruhe, SERVER, type NachgebautesNtfy } from './geraete/transport/ntfy/testNtfy'
import type { NtfyZeiten } from './geraete/transport/ntfy/leitung'
import { reducer, type Action } from './state/reducer'
import { setLocale } from './i18n'
import { vergissAlles } from './lib/merken'
import { betriebStarter, uimParallelStand, wkrBetriebsStand } from './testHilfen'
import { lage } from './betrieb/folge'
import { sichtOeffentlich } from './betrieb/sicht'
import { werteVon } from './lib/eingaben'
import { listenKennung } from './wkr/liste'
import { WKR_ANNAHMEN } from './wkr/annahmen'
import { maskeFuer } from './wkr/maske'
import type { AppState } from './types'

/**
 * Handy-Maske „Knöpfe“ der WKR-Erfassung (W3.3, Plan docs/plan-wkr-w3.md §5/§7, 21.11.2026): Bedienrechner
 * (geraete/host.ts mit echtem Reducer) → nachgebauter ntfy (kein Netz) → src/GeraetApp.vue mit Koppel-Link und
 * eigenem Speicher wie ein Handy → GeraetFreigabe → components/wkr/WkrGeraet. Der Takt (Doppeltipp-Schutz) läuft mit
 * Fake-Uhr gegen die Übung (geraete/uebung.ts, ohne Netz). Starter erfunden (testHilfen: Vor<id>/Nach<id>,
 * Musterclub) – kein Name darf im DOM stehen (F6).
 */

const SCHNELL: Partial<NtfyZeiten> = { abstandMs: 0, wiederholenMs: [20], zuVieleMs: 30, neuVerbindenMs: [10], quittungMs: 150, einstiegAbstandMs: 0 }
const P1 = 'par_1'
const LAUF = 'manoevrieren/1'
const liste = (typeId: string) => listenKennung({ bereich: P1, typeId, racecourse: null })
const TOR5 = liste('tor5')
const STEG = liste('steg')
const VORSTEG = liste('vorsteg')
const MUEB = liste('mueb')
// Eine Liste, die auch nach W4 „Maske folgt“ zeigt (Zeitfelder → W5).
const ZEITLISTE = liste('zeit')
const NAMEN = /Vor[ekvf]\d|Nach[ekvf]\d|Musterclub/

let ntfy: NachgebautesNtfy
const hosts: GeraeteHost[] = []
const wrappers: VueWrapper[] = []
const quellen: ErfassungsQuelle[] = []

beforeEach(() => {
  vergissAlles()
  setLocale('de')
  ntfy = neuesNtfy()
  vi.stubGlobal('WebSocket', NachgebauterSocket)
  vi.stubGlobal('fetch', nachgebautesFetch)
})

afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount()
  for (const q of quellen.splice(0)) q.stop()
  for (const h of hosts.splice(0)) h.stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  location.hash = ''
  document.title = ''
  document.body.innerHTML = ''
})

function handy(): Ablage & { daten: Map<string, string> } {
  const daten = new Map<string, string>()
  return { daten, getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => void daten.set(k, String(v)), removeItem: (k) => void daten.delete(k) }
}

async function bedienrechner(start: AppState = wkrBetriebsStand(), bereich = P1) {
  const state = shallowRef<AppState>({ ...start, kennung: 'MUSTERW33', geraeteServer: SERVER })
  let uhr = 10_000
  const dispatch = (action: Action) => {
    uhr += 1000
    state.value = reducer(state.value, { ...action, zeit: action.zeit ?? uhr } as Action)
  }
  const { nachgebauterBrowser } = await import('./geraete/testBrowser')
  const f = nachgebauterBrowser().fenster()
  const h = starteGeraeteHost({ state, dispatch }, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, sammelnMs: 0, endeWartenMs: 2000, koppelTaktMs: 50 })
  hosts.push(h)
  h.oeffne()
  await bis(() => h.verbindung.value?.status === 'verbunden')
  /** „Nächster Start“ am Bedienrechner. */
  const zeige = () => {
    const b = sichtOeffentlich(state.value).bereiche.find((x) => x.id === bereich)!
    dispatch({ type: 'BETRIEB_ZEIGEN', bereich, ref: b.offen[0].key, vorher: b.aktuell?.key ?? null })
    const a = lage(state.value, bereich).aktuell!
    return { key: a.key, starter: a.eintrag!.starter, startNr: state.value.starters.find((s) => s.id === a.eintrag!.starter)!.startNr }
  }
  return { state, dispatch, h, zeige }
}

// Grenze wie bis() (10 s, Prüfung unter Last 21.11.2026): Vorher 3 s – auf zwei Kernen mit voller Suite lief z. B.
// GeraetWkr „Probe … einmal je Raum“ hinein. Ein grüner Test wartet nicht länger.
async function zeigt(bedingung: () => boolean, beschreibe?: () => string): Promise<void> {
  await bis(bedingung, undefined, beschreibe)
  await nextTick()
}

/**
 * Zustand eines Geräts für den Fehlertext von zeigt() (21.11.2026, CI rot auf master c6cb754): Ruhe-Ansicht,
 * Verbindung, welche Listen eine Sicht im Ausgang haben, Abos und letzte Nachrichten beim nachgebauten ntfy,
 * Verbindung des Bedienrechners und die Zeit seit dem Mount – damit ein Hänger unter Last zeigt, WO er hängt.
 */
const attr = (w: VueWrapper, wahl: string, name: string) => (w.find(wahl).exists() ? (w.find(wahl).attributes(name) ?? null) : null)

function geraeteZustand(w: VueWrapper, speicher: Ablage, h: GeraeteHost, seit: number): () => string {
  return () => {
    const aus = JSON.parse(speicher.getItem('alcatraz.geraet.wkr') ?? 'null') as { inhalt?: { sichten?: Record<string, unknown> } } | null
    const kopplung = JSON.parse(speicher.getItem('alcatraz.geraet.kopplung') ?? 'null') as { lage?: string; aufgaben?: unknown[] } | null
    const letzte = ntfy.gespeichert.slice(-5).map((g) => `${g.topic.slice(0, 6)}#${g.id}`)
    return JSON.stringify({
      ruhe: w.find('[data-teil="ruhe"]').exists() ? ruheArt(w) : null,
      maske: w.find('[data-teil="maske"]').exists(),
      probe: w.find('[data-teil="probe"]').exists(),
      verbindung: attr(w, '[data-teil="verbindung"]', 'data-lage'),
      lage: attr(w, '.geraet-freigabe', 'data-lage'),
      kopplung: kopplung ? { lage: kopplung.lage, aufgaben: kopplung.aufgaben?.length } : null,
      sichtenImAusgang: Object.keys(aus?.inhalt?.sichten ?? {}),
      abos: ntfy.abos.length,
      sockets: ntfy.sockets.size,
      letzte,
      host: h.verbindung.value?.status ?? null,
      msSeitMount: Date.now() - seit,
    })
  }
}

/**
 * Code ausgeben, Koppel-Link öffnen, Code tippen – bis die Maske (bzw. mit Freigabe die Start-Freigabe) dasteht.
 * Die Probe beim Einrichten (W3.4, G10) kommt mit der ersten Sicht einer Liste mit Maske; `probe: 'ueberspringen'`
 * (Vorgabe) tippt „Überspringen“, `'lassen'` lässt sie stehen.
 */
async function mitCode(h: GeraeteHost, aufgaben: Aufgabe[], speicher: Ablage = handy(), probe: 'ueberspringen' | 'lassen' = 'ueberspringen') {
  h.gibCode(aufgaben)
  await bis(() => !!h.raum.value?.koppeln.code && h.raum.value.koppeln.code.benutzt === null)
  const code = h.raum.value!.koppeln.code!.wert
  location.hash = koppelnAdresse(h.raum.value!.koppelLink)
  const w = mount(GeraetApp, { attachTo: document.body, props: { umgebung: { ablage: speicher, zeiten: SCHNELL, ablaufTaktMs: 20 } } })
  wrappers.push(w)
  await zeigt(() => w.find('input[data-feld="code"]').exists())
  await w.find('input[data-feld="code"]').setValue(formatiereCode(code))
  await w.find('input[data-feld="name"]').setValue('Handy Steg')
  await w.find('.geraet-koppel-form').trigger('submit')
  const nurFreigabe = aufgaben.some((a) => a.art === 'startfreigabe')
  await zeigt(() => (nurFreigabe ? w.find('.betrieb-karte').exists() : w.find('[data-teil="wkr-geraet"]').exists()))
  // Listen ohne Maske (Zeit, Knoten – W5) haben keine Probe; Bojen-Listen seit W4.2 schon.
  const mitMaske = aufgaben.some((a) => a.art === 'liste' && !/"(zeit|moewezeit|bstartziel|knoten)"/.test(a.liste))
  if (!nurFreigabe && mitMaske && probe === 'ueberspringen') {
    // Ohne Klasse mit Maske (alle Starter ohne die Liste) gibt es keine Probe – dann steht gleich die Maske da.
    await zeigt(() => w.find('[data-teil="probe"]').exists() || w.find('[data-teil="karte"]').exists() || (w.find('[data-teil="ruhe"]').exists() && ruheArt(w) !== 'warte'))
    if (w.find('[data-teil="probe"]').exists()) {
      await w.find('[data-action="probe-ueberspringen"]').trigger('click')
      await nextTick()
    }
  }
  return { w, speicher, id: () => h.raum.value!.geraete[0].id }
}

const startNr = (w: VueWrapper) => w.find('[data-teil="karte"] [data-teil="startnr"]').text()
const haupt = (w: VueWrapper) => w.find('[data-action="haupt"]')
const ruheArt = (w: VueWrapper) => w.find('[data-teil="ruhe"]').attributes('data-ruhe')
/**
 * Der Takt nach dem Abschicken ist vorbei (Overlay und Sperre weg) – die Maske nimmt wieder Tipps an. Statt einer festen
 * Pause von uebertragenMaxMs + sperreMs (Prüfung unter Last 21.11.2026: Eine Pause sagt nichts darüber, ob der Takt
 * schon vorbei ist; ein Tipp in die Sperre geht still verloren).
 */
const taktFrei = (w: VueWrapper) => !w.find('[data-teil="maske"]').exists() || w.find('[data-teil="maske"]').attributes('data-takt') === 'frei'
const werte = (s: AppState, starter: string) => werteVon(s.eingaben, LAUF, starter)
async function klick(w: VueWrapper, selektor: string): Promise<void> {
  await w.find(selektor).trigger('click')
  await nextTick()
}

/** Eine Liste am Handy, digital und mit einem gezeigten Start auf der Karte. */
async function listeMitStart(typeId: string, mehr: Aufgabe[] = []) {
  const r = await bedienrechner()
  const l = liste(typeId)
  const g = await mitCode(r.h, [{ art: 'liste', liste: l }, ...mehr])
  await bis(() => r.state.value.wkr.listen[l]?.modus === 'digital')
  const s = r.zeige()
  await zeigt(() => g.w.find('[data-teil="karte"]').exists() && startNr(g.w) === s.startNr)
  return { ...r, ...g, s, l }
}

describe('Handy-Maske Tor 5 (W3.3)', () => {
  it('Code tippen → „Abschicken · 20 Pkt.“ → Wert in der Erfassung am Bedienrechner; kein Name im DOM', async () => {
    const { w, state, s } = await listeMitStart('tor5')
    expect(w.find('[data-teil="wkr-kopf"] [data-teil="titel"]').text()).toContain('Tor 5')
    expect(haupt(w).text()).toBe('Fehlerfrei ✓')
    await klick(w, '[data-action="code"][data-code="1"]')
    expect(w.find('[data-action="code"][data-code="1"]').attributes('data-anzahl')).toBe('1')
    expect(haupt(w).text()).toContain('Abschicken · 20')
    await klick(w, '[data-action="haupt"]')
    expect(w.find('[data-teil="karte"] [data-teil="gesendet"]').exists()).toBe(true)
    await bis(() => werte(state.value, s.starter)['katalog:tor5'] === '1')
    expect(werte(state.value, s.starter)['erfasst@tor5']).toBeTruthy()
    await zeigt(() => w.find('[data-teil="leiste-zeile"]').attributes('data-stufe') === 'uebernommen')
    expect(w.find('[data-teil="leiste-zeile"]').text()).toBe(`${s.startNr} ✓`)
    expect(w.html()).not.toMatch(NAMEN)
  })

  it('Fehlerfrei → Haken am Bedienrechner, ohne Fehlerwert', async () => {
    const { w, state, s } = await listeMitStart('tor5')
    await klick(w, '[data-action="haupt"]')
    await bis(() => !!werte(state.value, s.starter)['erfasst@tor5'])
    expect(werte(state.value, s.starter)['katalog:tor5'] ?? '').toBe('')
  })

  it('Disq.: zweiter Tipp setzt, Fuß nennt ihn; „− letzte zurück“ nimmt den letzten Tipp', async () => {
    const { w, state, s } = await listeMitStart('tor5')
    await klick(w, '[data-action="code"][data-code="20"]')
    await klick(w, '[data-action="disq"]')
    const p = '[data-action="disq-code"][data-code="P"]'
    await klick(w, p)
    expect(w.find(p).attributes('data-stand')).toBe('vorgemerkt')
    await klick(w, p)
    expect(w.find(p).attributes('data-stand')).toBe('gesetzt')
    // X gibt es an Tor 5 nicht (F5).
    expect(w.find('[data-action="disq-code"][data-code="X"]').exists()).toBe(false)
    expect(haupt(w).text()).toContain('Abschicken · 5 Pkt. · Disq. P')
    await klick(w, '[data-action="zurueck"]')
    expect(haupt(w).text()).toBe('Abschicken · 5 Pkt.')
    await klick(w, '[data-action="haupt"]')
    await bis(() => werte(state.value, s.starter)['katalog:tor5'] === '20')
  })

  it('Ausweichen und Suche: zwei Nächste, Nr.-Feld, „außer der Reihe“; unbekannte Nummer wird nicht angeboten', async () => {
    const { w, zeige, s } = await listeMitStart('tor5')
    const s2 = zeige()
    const s3 = zeige()
    await zeigt(() => w.findAll('[data-action="ausweichen"]').length === 2)
    expect(w.findAll('[data-action="ausweichen"]').map((b) => b.text())).toEqual([s2.startNr, s3.startNr])
    await w.findAll('[data-action="ausweichen"]')[1].trigger('click')
    await nextTick()
    expect(startNr(w)).toBe(s3.startNr)
    expect(w.find('[data-teil="ausser"]').exists()).toBe(true)

    await klick(w, '[data-action="suche"]')
    for (const ch of '999') await klick(w, `[data-taste="${ch}"]`)
    await klick(w, '[data-action="suche-ok"]')
    expect(w.find('[data-teil="nicht-gefunden"]').text()).toContain('999')
    expect(startNr(w)).toBe(s3.startNr)
    for (let i = 0; i < 3; i++) await klick(w, '[data-taste="⌫"]')
    for (const ch of s.startNr) await klick(w, `[data-taste="${ch}"]`)
    await klick(w, '[data-action="suche-ok"]')
    expect(startNr(w)).toBe(s.startNr)
    expect(w.find('[data-teil="ziffernfeld"]').exists()).toBe(false)
    expect(w.find('[data-teil="ausser"]').exists()).toBe(false)
  })

  it('Entwurf bleibt beim Wechsel: „Entw. 1“, zurück am Start sind die Tipps wieder da', async () => {
    const { w, zeige, s } = await listeMitStart('tor5')
    const s2 = zeige()
    await zeigt(() => w.findAll('[data-action="ausweichen"]').length === 1)
    await klick(w, '[data-action="code"][data-code="2"]')
    await klick(w, `[data-action="ausweichen"]`)
    expect(startNr(w)).toBe(s2.startNr)
    expect(w.find('[data-action="code"][data-code="2"]').attributes('data-anzahl')).toBe('0')
    expect(w.find('[data-teil="entwuerfe"]').text()).toBe('Entw. 1')
    await klick(w, '[data-action="ausweichen"]')
    expect(startNr(w)).toBe(s.startNr)
    expect(w.find('[data-action="code"][data-code="2"]').attributes('data-anzahl')).toBe('1')
  })

  it('Start mit Entwurf zurückgestellt: einmal fragen „behalten / verwerfen“', async () => {
    const { w, dispatch, s } = await listeMitStart('tor5')
    await klick(w, '[data-action="code"][data-code="2"]')
    dispatch({ type: 'BETRIEB_ZURUECK', bereich: P1, ref: s.key })
    dispatch({ type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: s.key })
    await zeigt(() => w.find('[data-teil="verwaist"]').exists())
    expect(w.find('[data-teil="verwaist"]').text()).toContain(`Start ${s.startNr} steht nicht mehr in der Folge`)
    await klick(w, '[data-action="entwurf-behalten"]')
    expect(w.find('[data-teil="verwaist"]').exists()).toBe(false)
    expect(w.find('[data-teil="entwuerfe"]').text()).toBe('Entw. 1')
  })

  it('Zuletzt → Korrektur mit großer Rückfrage alt → neu; der Bedienrechner hat danach den neuen Wert', async () => {
    const { w, state, s } = await listeMitStart('tor5')
    await klick(w, '[data-action="code"][data-code="1"]')
    await klick(w, '[data-action="haupt"]')
    await bis(() => werte(state.value, s.starter)['katalog:tor5'] === '1')
    await zeigt(() => w.find('[data-action="zuletzt"]').exists())
    await klick(w, '[data-action="zuletzt"]')
    await klick(w, '[data-teil="zuletzt-liste"] [data-action="korrigieren"]')
    expect(w.find('[data-teil="korrektur"]').text()).toBe(`Korrektur Start ${s.startNr}`)
    expect(w.find('[data-action="code"][data-code="1"]').attributes('data-anzahl')).toBe('1')
    await klick(w, '[data-action="code"][data-code="20"]')
    expect(haupt(w).text()).toBe('Korrektur abschicken')
    await klick(w, '[data-action="haupt"]')
    const d = w.find('[data-dialog="wkr-korrektur"]')
    expect(d.find('[data-teil="alt"]').text()).toContain('1')
    expect(d.find('[data-teil="neu"]').text()).toContain('1, 20')
    await klick(w, '[data-action="korrektur-ja"]')
    await bis(() => werte(state.value, s.starter)['katalog:tor5'] === '1, 20')
    expect(w.find('[data-teil="korrektur"]').exists()).toBe(false)
  })

  it('Rückfrage-Band mit dem Wert, der am Bedienrechner steht; „So lassen“ legt es weg', async () => {
    const { w, state, dispatch, s } = await listeMitStart('tor5')
    dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: s.starter, feld: 'katalog:tor5', wert: '2' }] })
    await klick(w, '[data-action="code"][data-code="1"]')
    await klick(w, '[data-action="haupt"]')
    await zeigt(() => w.find('[data-teil="rueckfrage"]').exists())
    expect(w.find('[data-teil="rueckfrage"]').text()).toContain(`Start ${s.startNr} steht dort anders (2)`)
    expect(werte(state.value, s.starter)['katalog:tor5']).toBe('2')
    await klick(w, '[data-action="so-lassen"]')
    expect(w.find('[data-teil="rueckfrage"]').exists()).toBe(false)
    // W3-35 (21.11.2026, GF5): Der Bedienrechner erfährt es – die Rückfrage bleibt offen, mit Zeit vermerkt.
    await bis(() => state.value.wkr.rueckfragen.some((r) => r.soLassen !== undefined))
    expect(state.value.wkr.rueckfragen).toHaveLength(1)
    expect(werte(state.value, s.starter)['katalog:tor5']).toBe('2')
  })

  it('Hinweis des Bedienrechners groß im Kopf; „Gesehen“ nimmt ihn weg', async () => {
    const { w, h } = await listeMitStart('tor5')
    h.hinweis(TOR5, 'pruefen', '101')
    await zeigt(() => w.find('[data-teil="hinweis"]').exists())
    expect(w.find('[data-teil="hinweis"]').text()).toContain('Bediener bittet: Start 101 prüfen')
    await klick(w, '[data-teil="hinweis"] [data-action="gesehen"]')
    await zeigt(() => !w.find('[data-teil="hinweis"]').exists())
  })

  it('getrennt: Kopf rot und dauerhaft, Starts „geschätzt“, ab 300 s „Papierbogen ab Nr. x“', async () => {
    const { w, s } = await listeMitStart('tor5')
    // Alle Verbindungen zum Server reißen ab und kommen nicht wieder.
    vi.stubGlobal(
      'WebSocket',
      class extends NachgebauterSocket {
        constructor(url: string) {
          super(url)
          this.close()
        }
      },
    )
    for (const sock of [...ntfy.sockets]) sock.close()
    await zeigt(() => w.find('[data-teil="getrennt"]').exists())
    expect(w.find('[data-teil="verbindung"]').attributes('data-lage')).toBe('getrennt')
    expect(w.find('[data-teil="getrennt"]').text()).toContain('Keine Verbindung')
    await zeigt(() => w.findAll('[data-action="ausweichen"]').length > 0)
    await klick(w, '[data-action="ausweichen"]')
    expect(w.find('[data-teil="geschaetzt"]').text()).toBe('geschätzt (ohne Verbindung)')
    expect(w.find('[data-teil="papier-ab"]').exists()).toBe(false)
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(Date.now() + (WKR_ANNAHMEN.papierHinweisSek + 5) * 1000)
    await zeigt(() => w.find('[data-teil="papier-ab"]').exists())
    expect(w.find('[data-teil="papier-ab"]').text()).toBe(`Länger weg? Papierbogen ab Nr. ${s.startNr}`)
    expect(w.find('[data-teil="getrennt"]').text()).toContain('Keine Verbindung seit 5 min')
  })

  it('pausiert: Band „Papierbogen gilt“, „Weiter digital“ → wieder Maske; abmelden: Ruhe „abgemeldet“ ohne Weiter', async () => {
    const { w, state, zeige } = await listeMitStart('tor5')
    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="pausieren"]')
    await zeigt(() => w.find('[data-teil="ruhe"]').exists() && ruheArt(w) === 'pausiert')
    expect(state.value.wkr.listen[TOR5].status).toBe('pausiert')
    expect(w.find('[data-teil="pause-band"]').text()).toContain('Papierbogen gilt')
    await klick(w, '[data-action="weiter-digital"]')
    // Der Start aus der Pause ging aufs Papier (P, W2 A6): wieder digital, aber nichts in der Schlange.
    await zeigt(() => state.value.wkr.listen[TOR5].status === 'aktiv' && ruheArt(w) === 'leer')
    zeige()
    await zeigt(() => w.find('[data-teil="karte"]').exists())

    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="abmelden"]')
    await klick(w, '[data-action="abmelden-ja"]')
    // Abmelden wirkt wie Liste entfernen (Nutzer 21.11.2026) – eigene Ruhe-Ansicht, kein „Weiter digital“.
    await zeigt(() => w.find('[data-teil="ruhe"]').exists() && ruheArt(w) === 'abmeldung')
    await bis(() => state.value.wkr.listen[TOR5].status === 'abgemeldet')
    expect(w.find('[data-action="weiter-digital"]').exists()).toBe(false)
  })

  // Nutzer 21.11.2026: „Das muss so sein, als ob ich die Liste von dem Gerät entferne.“ (WKR_ANNAHMEN.abmeldenWieEntfernen)
  it('Abmelden: Ruhe „Von Tor 5 abgemeldet“ mit „Zuletzt“ und Entwurf, keine Starterkarte; Liste am Bedienrechner abgemeldet und vom Gerät genommen; neu zuweisen → Maske', async () => {
    const { w, h, state, s, zeige, id } = await listeMitStart('tor5')
    await klick(w, '[data-action="haupt"]')
    await bis(() => werte(state.value, s.starter)['erfasst@tor5'] === '1')
    await zeigt(() => taktFrei(w))
    const zweiter = zeige()
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === zweiter.startNr)
    await klick(w, '[data-action="code"][data-code="1"]')
    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="abmelden"]')
    await klick(w, '[data-action="abmelden-ja"]')
    await zeigt(() => w.find('[data-teil="ruhe"]').exists() && ruheArt(w) === 'abmeldung')
    const ruheText = () => w.find('[data-teil="ruhe"]').text()
    expect(w.find('[data-teil="abmeldung-band"]').text()).toContain('Tor 5')
    expect(w.find('[data-teil="abmeldung-band"]').text()).toContain('abgemeldet')
    expect(w.find('[data-teil="karte"]').exists()).toBe(false)
    expect(w.find('[data-action="weiter-digital"]').exists()).toBe(false)
    expect(w.find('[data-teil="zuletzt-lesend"]').text()).toContain(s.startNr)
    expect(w.find('[data-teil="entwuerfe-lesend"]').text()).toContain(zweiter.startNr)
    // Am Bedienrechner: abgemeldet (nicht offen), das Gerät hat die Liste nicht mehr – die Ansicht bleibt.
    await bis(() => state.value.wkr.listen[TOR5].status === 'abgemeldet' && (h.raum.value?.geraete[0].aufgaben.length ?? 1) === 0)
    await nextTick()
    expect(ruheArt(w)).toBe('abmeldung')
    expect(ruheText()).toContain('neu zuweisen')
    expect(w.text()).not.toMatch(NAMEN)
    // Neu zuweisen: wieder die Maske (der Bediener stellt die Liste mit „Weiter“ wieder auf aktiv).
    h.setzeAufgaben(id(), [{ art: 'liste', liste: TOR5 }])
    // Die Liste steht am Bedienrechner noch auf „abgemeldet“: Ruhe mit „Weiter digital“ wie vom Bediener.
    await zeigt(() => w.find('[data-teil="ruhe"]').exists() && ruheArt(w) === 'abgemeldet')
    expect(w.find('[data-action="weiter-digital"]').exists()).toBe(true)
  }, 20_000)

  it('Papier-Modus vom Bedienrechner: nichts zu tippen', async () => {
    const { w, dispatch } = await listeMitStart('tor5')
    dispatch({ type: 'WKR_LISTE', liste: TOR5, modus: 'papier' })
    await zeigt(() => w.find('[data-teil="ruhe"]').exists() && ruheArt(w) === 'papier')
    expect(w.find('[data-action="code"]').exists()).toBe(false)
    expect(w.find('[data-teil="ruhe"]').text()).toContain('auf Papier gestellt')
  })

  it('kein Boot unterwegs: nächster Start aus „danach“', async () => {
    const r = await bedienrechner()
    const { w } = await mitCode(r.h, [{ art: 'liste', liste: TOR5 }])
    await zeigt(() => w.find('[data-teil="ruhe"]').exists() && ruheArt(w) === 'leer')
    expect(w.find('[data-teil="ruhe"]').text()).toContain('Kein Boot unterwegs.')
    expect(w.find('[data-teil="naechster"]').text()).toMatch(/^Nächster Start: \S+ \(/)
    expect(w.html()).not.toMatch(NAMEN)
  })

  it('Rechte entzogen: Entwürfe nur lesend zum Übertragen aufs Papier', async () => {
    const { w, h, id, s } = await listeMitStart('tor5')
    await klick(w, '[data-action="code"][data-code="20"]')
    h.entziehe(id())
    await zeigt(() => w.find('[data-ruhe="entzogen"]').exists())
    expect(w.find('[data-teil="entwuerfe-lesend"]').text()).toContain(s.startNr)
    expect(w.find('[data-teil="entwuerfe-lesend"]').text()).toContain('20')
    // Prüfbefund W3: mit Liste und Feldüberschrift, nicht nur „Nr. Werte“.
    expect(w.find('[data-teil="entwurf-wo"]').text()).not.toBe('')
    expect(w.find('[data-teil="entwurf-werte"]').text()).toMatch(/^[^:]+: 20$/)
    expect(w.find('[data-action="code"]').exists()).toBe(false)
  })
})

describe('Handy-Maske: Steg, Vorsteg, entfällt, ohne Maske (W3.3)', () => {
  it('Steg ganz: zwei Reiter mit Wartezahl, wechselt nie von selbst; X nur im Ablegen, mit großer Rückfrage', async () => {
    const { w, state, s, zeige } = await listeMitStart('steg')
    const reiter = () => w.findAll('[data-action="steg-teil"]')
    expect(reiter().map((r) => r.attributes('data-steg'))).toEqual(['ab', 'an'])
    expect(w.find('[data-action="steg-teil"][data-steg="ab"]').attributes('aria-selected')).toBe('true')
    // W3-51 (GF3): beide Reiter immer da, je Teil ✓ (nichts offen) bzw. Zahl offener Starts.
    const stand = (t: string) => w.find(`[data-action="steg-teil"][data-steg="${t}"] [data-teil="steg-stand"]`)
    expect(Number(stand('ab').attributes('data-offen'))).toBeGreaterThan(0)
    expect(stand('an').text()).toBe('✓')
    expect(haupt(w).text()).toBe('Ablegen OK ✓')
    await klick(w, '[data-action="disq"]')
    const x = '[data-action="disq-code"][data-code="X"]'
    await klick(w, x)
    await klick(w, x)
    expect(w.find('[data-dialog="wkr-x"]').text()).toContain(`Start ${s.startNr}: nicht gestartet (X)?`)
    await klick(w, '[data-action="x-nein"]')
    expect(w.find(x).attributes('data-stand')).toBe('frei')

    // Anlegen nachlaufend (T2): erst, wenn der nächste Start gezeigt ist, kommt dieser zurück – und auf einem Gerät für
    // den ganzen Steg erst nach seinem Ablegen (T3).
    await klick(w, '[data-action="steg-teil"][data-steg="an"]')
    expect(w.find('[data-teil="karte"]').exists()).toBe(false)
    zeige()
    await ruhe(150)
    expect(w.find('[data-teil="karte"]').exists()).toBe(false)
    await klick(w, '[data-action="steg-teil"][data-steg="ab"]')
    await zeigt(() => startNr(w) === s.startNr)
    await klick(w, '[data-action="haupt"]')
    await bis(() => !!werte(state.value, s.starter)['erfasst.ab@steg'])
    await zeigt(() => taktFrei(w))
    await klick(w, '[data-action="steg-teil"][data-steg="an"]')
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === s.startNr)
    expect(haupt(w).text()).toBe('Anlegen OK ✓')
    await klick(w, '[data-action="disq"]')
    expect(w.find(x).exists()).toBe(false)
    await klick(w, '[data-action="disq"]')
    await klick(w, '[data-action="code"][data-code="9"]')
    expect(haupt(w).text()).toBe('Abschicken Anlegen · 10 Pkt.')
    await klick(w, '[data-action="haupt"]')
    await bis(() => werte(state.value, s.starter)['katalog:stegAnlegen'] === '9')
    // Nach dem Takt bleibt der Reiter „Anlegen“ – kein Sprung zum Ablegen.
    await zeigt(() => taktFrei(w))
    expect(w.find('[data-action="steg-teil"][data-steg="an"]').attributes('aria-selected')).toBe('true')
  }, 20_000)

  it('Steg-Teil-Gerät (nur Anlegen): nur der eigene Reiter', async () => {
    const r = await bedienrechner()
    const { w } = await mitCode(r.h, [{ art: 'liste', liste: STEG, teil: 'an' }])
    await bis(() => r.state.value.wkr.listen[STEG]?.modus === 'digital')
    const erster = r.zeige()
    // Im Boot: noch nichts anzulegen (T2); nach dem nächsten Start kommt der erste zurück.
    await ruhe(150)
    expect(w.find('[data-teil="karte"]').exists()).toBe(false)
    r.zeige()
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === erster.startNr)
    expect(w.findAll('[data-action="steg-teil"]').map((b) => b.attributes('data-steg'))).toEqual(['an'])
    expect(haupt(w).text()).toBe('Anlegen OK ✓')
  })

  // Nutzer 21.11.2026 (T1): Ablegen läuft der Tafel voraus.
  it('Steg ganz: Ablegen zeigt „Als Nächstes“ schon vor dem Zeigen (vorab), Anlegen ist leer', async () => {
    const r = await bedienrechner()
    const { w } = await mitCode(r.h, [{ art: 'liste', liste: STEG }])
    await bis(() => r.state.value.wkr.listen[STEG]?.modus === 'digital')
    const naechster = lage(r.state.value, P1).naechster!
    const nr = r.state.value.starters.find((p) => p.id === naechster.starter)!.startNr
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === nr)
    expect(w.find('[data-teil="vorab"]').text()).toBe('noch nicht gezeigt')
    expect(haupt(w).text()).toBe('Ablegen OK ✓')
    await klick(w, '[data-action="steg-teil"][data-steg="an"]')
    expect(w.find('[data-teil="karte"]').exists()).toBe(false)
  })

  it('Vorsteg: „In Ordnung ✓“ für einen noch nicht gezeigten Start (vorab), X fragt groß', async () => {
    const r = await bedienrechner()
    const { w } = await mitCode(r.h, [{ art: 'liste', liste: VORSTEG }])
    await bis(() => r.state.value.wkr.listen[VORSTEG]?.modus === 'digital')
    await zeigt(() => w.find('[data-teil="karte"]').exists())
    expect(w.find('[data-teil="vorab"]').text()).toBe('noch nicht gezeigt')
    expect(haupt(w).text()).toBe('In Ordnung ✓')
    expect(w.find('[data-teil="vorsteg"] [data-action="disq-code"][data-code="X"]').exists()).toBe(true)
    const nr = startNr(w)
    const starter = r.state.value.starters.find((x) => x.startNr === nr)!.id
    await klick(w, '[data-action="haupt"]')
    await bis(() => !!werte(r.state.value, starter)['erfasst@vorsteg'])
  })

  it('Klasse ohne die Liste: „Mann-über-Bord entfällt (…)“ statt Knöpfen', async () => {
    const r = await bedienrechner()
    const { w } = await mitCode(r.h, [{ art: 'liste', liste: MUEB }])
    await bis(() => r.state.value.wkr.listen[MUEB]?.modus === 'digital')
    r.zeige()
    await zeigt(() => w.find('[data-teil="ruhe"]').exists() && ruheArt(w) === 'entfaellt')
    expect(w.find('[data-teil="ruhe"]').text()).toMatch(/entfällt/)
    expect(w.find('[data-action="code"]').exists()).toBe(false)
  })

  it('Liste mit Zeitfeldern: „Maske folgt – Papier“ mit „Pausieren“ (G14; Bojen-Listen haben seit W4.2 ihre Maske)', async () => {
    const r = await bedienrechner()
    const GATE = ZEITLISTE
    const { w } = await mitCode(r.h, [{ art: 'liste', liste: GATE }])
    await zeigt(() => w.find('[data-teil="ruhe"]').exists() && ruheArt(w) === 'spaeter')
    expect(w.find('[data-teil="ruhe"]').text()).toContain('bitte auf dem Papierbogen erfassen')
    await bis(() => r.state.value.wkr.listen[GATE]?.modus === 'digital')
    await klick(w, '[data-ruhe="spaeter"] [data-action="pausieren"]')
    await bis(() => r.state.value.wkr.listen[GATE]?.status === 'pausiert')
  })

  it('Start-Freigabe UND Liste: Reiter unten „Freigabe“ / Listenname', async () => {
    const r = await bedienrechner()
    const { w } = await mitCode(r.h, [{ art: 'startfreigabe', bereiche: [P1] }, { art: 'liste', liste: TOR5 }])
    await zeigt(() => w.find('[data-teil="geraet-reiter"]').exists())
    const knoepfe = w.findAll('[data-teil="geraet-reiter"] [data-action="reiter"]')
    expect(knoepfe.map((k) => k.attributes('data-reiter'))).toEqual(['freigabe', TOR5])
    expect(w.find('.betrieb-karte').exists()).toBe(true)
    await knoepfe[1].trigger('click')
    await zeigt(() => w.find('[data-teil="wkr-geraet"]').exists())
    expect(w.find('.betrieb-karte').exists()).toBe(false)
    // Der Reitertitel kommt mit der Sicht der Liste.
    await zeigt(() => w.find(`[data-reiter='${TOR5}']`).text().includes('Tor 5'))
  })
})

/**
 * Übung mit sofortigem nächsten Start: Diese Tests prüfen die Maske (Wechsel, Sperre, Abschluss), nicht den Übungstakt
 * (2–6 s nach dem Abschicken, Nutzer 21.11.2026 – geprüft in geraete/uebung.test.ts).
 */
const SOFORT = [0, 0] as const

/** In der Übung (Quittung nach uebungQuittungMs < uebertragenMinMs): ab hier wechselt die Nummer (N1). */
const BIS_WECHSEL = WKR_ANNAHMEN.uebertragenMinMs + WKR_ANNAHMEN.uebernommenMs

describe('Doppeltipp-Schutz und Rückgängig (Fake-Uhr, Übung ohne Netz)', () => {
  function uebung(typeId = 'tor5') {
    const q = oeffneUebung({ regelwerk: 'dm-2026', typeId, taktMs: 3_600_000, folgeMs: SOFORT })
    quellen.push(q)
    const w = mount(WkrGeraet, { attachTo: document.body, props: { quelle: q, ablage: handy() } })
    wrappers.push(w)
    return { q, w }
  }

  it('N1 (Feldtest 21.11.2026): sofort Overlay „wird übertragen …“, mit der Quittung „✓ übernommen“, dann Wechsel mit Blitz und Vibration, 1 s ohne Eingabe', async () => {
    vi.useFakeTimers()
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, vibrate })
    const { q, w } = uebung()
    await nextTick()
    const erste = startNr(w)
    expect(w.find('[data-teil="uebung"]').text()).toBe('ÜBUNG')
    expect(w.find('[data-teil="uebertragen"]').exists()).toBe(false)
    await klick(w, '[data-action="haupt"]')
    expect(q.zuletzt.value).toHaveLength(1)
    expect(w.find('[data-teil="maske"]').attributes('data-takt')).toBe('gesendet')
    // Sofort, ohne auf irgendetwas zu warten: das Overlay über allem, ohne Knöpfe.
    const overlay = () => w.find('[data-teil="uebertragen"]')
    expect(overlay().find('[data-teil="uebertragen-nr"]').text()).toBe(`Start ${erste}`)
    expect(overlay().find('[data-teil="uebertragen-zeile"]').text()).toMatch(/wird übertragen|wartet auf Bestätigung/)
    expect(overlay().findAll('button')).toHaveLength(0)
    expect(w.find('[data-teil="mitte"]').attributes('inert')).toBeDefined()
    // Doppeltipp: wirkt nicht, die Nummer bleibt stehen.
    await klick(w, '[data-action="haupt"]')
    await klick(w, '[data-action="code"][data-code="1"]')
    expect(q.zuletzt.value).toHaveLength(1)
    expect(startNr(w)).toBe(erste)

    // Die Übung quittiert nach uebungQuittungMs – sichtbar ab uebertragenMinMs.
    await vi.advanceTimersByTimeAsync(WKR_ANNAHMEN.uebertragenMinMs)
    await nextTick()
    expect(w.find('[data-teil="maske"]').attributes('data-takt')).toBe('uebernommen')
    expect(overlay().attributes('data-phase')).toBe('beantwortet')
    expect(overlay().find('[data-teil="uebertragen-zeile"]').text()).toBe('✓ übernommen')
    expect(startNr(w)).toBe(erste)

    await vi.advanceTimersByTimeAsync(WKR_ANNAHMEN.uebernommenMs)
    await nextTick()
    expect(w.find('[data-teil="maske"]').attributes('data-takt')).toBe('sperre')
    expect(overlay().exists()).toBe(false)
    expect(w.find('[data-teil="blitz"]').exists()).toBe(true)
    expect(vibrate).toHaveBeenCalledWith(60)
    expect(startNr(w)).not.toBe(erste)
    await klick(w, '[data-action="code"][data-code="1"]')
    await klick(w, '[data-action="haupt"]')
    expect(q.zuletzt.value).toHaveLength(1)
    expect(w.find('[data-action="code"][data-code="1"]').attributes('data-anzahl')).toBe('0')

    await vi.advanceTimersByTimeAsync(WKR_ANNAHMEN.sperreMs)
    await nextTick()
    expect(w.find('[data-teil="maske"]').attributes('data-takt')).toBe('frei')
    expect(w.find('[data-teil="blitz"]').exists()).toBe(false)
    expect(w.find('[data-teil="bestaetigung-folgt"]').exists()).toBe(false)
    await klick(w, '[data-action="code"][data-code="1"]')
    await klick(w, '[data-action="haupt"]')
    expect(q.zuletzt.value).toHaveLength(2)
  })

  it('N2: ohne Quittung geht das Overlay nach uebertragenMaxMs trotzdem – „Bestätigung folgt“ über dem Kopf, bis die Antwort kommt', async () => {
    vi.useFakeTimers()
    const q = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'tor5', taktMs: 3_600_000, folgeMs: SOFORT })
    quellen.push(q)
    // Dieselbe Übung, deren Zeilen (vorerst) unbeantwortet bleiben – wie ein Bedienrechner, der nicht antwortet.
    const stumm = shallowRef(true)
    const zuletzt = computed(() => q.zuletzt.value.map((z) => (stumm.value ? { ...z, stufe: { stufe: 'unterwegs' as const, gesendet: true } } : z)))
    const w = mount(WkrGeraet, { attachTo: document.body, props: { quelle: { ...q, zuletzt }, ablage: handy() } })
    wrappers.push(w)
    await nextTick()
    const erste = startNr(w)
    await klick(w, '[data-action="haupt"]')
    await vi.advanceTimersByTimeAsync(WKR_ANNAHMEN.uebertragenMinMs + WKR_ANNAHMEN.uebernommenMs)
    await nextTick()
    expect(w.find('[data-teil="uebertragen-zeile"]').text()).toBe('⧗ gesendet – wartet auf Bestätigung …')
    expect(startNr(w)).toBe(erste)
    await vi.advanceTimersByTimeAsync(WKR_ANNAHMEN.uebertragenMaxMs - WKR_ANNAHMEN.uebertragenMinMs - WKR_ANNAHMEN.uebernommenMs)
    await nextTick()
    expect(w.find('[data-teil="uebertragen"]').exists()).toBe(false)
    expect(w.find('[data-teil="maske"]').attributes('data-takt')).toBe('sperre')
    expect(startNr(w)).not.toBe(erste)
    expect(w.find('[data-teil="bestaetigung-folgt"]').text()).toBe(`Start ${erste} gesendet – Bestätigung folgt`)
    stumm.value = false
    await nextTick()
    expect(w.find('[data-teil="bestaetigung-folgt"]').exists()).toBe(false)
  })

  it('Rückgängig: die wartende Zeile kommt zurück, Werte wieder im Entwurf', async () => {
    vi.useFakeTimers()
    const { q, w } = uebung()
    await nextTick()
    const erste = startNr(w)
    await klick(w, '[data-action="code"][data-code="20"]')
    await klick(w, '[data-action="haupt"]')
    expect(w.find('[data-teil="rueckgaengig-band"]').exists()).toBe(true)
    await klick(w, '[data-action="rueckgaengig"]')
    expect(q.zuletzt.value).toHaveLength(0)
    expect(startNr(w)).toBe(erste)
    expect(w.find('[data-teil="maske"]').attributes('data-takt')).toBe('frei')
    expect(w.find('[data-action="code"][data-code="20"]').attributes('data-anzahl')).toBe('1')
  })

  it('Prüfbefund W3: ein vorgemerkter Disq.-Buchstabe gilt nie für den nächsten Start; in der Sperre merkt ein Tipp nichts vor', async () => {
    vi.useFakeTimers()
    const { q, w } = uebung('vorsteg')
    await nextTick()
    // Am Vorsteg gibt es unter DM nur M und X – M (ohne die X-Rückfrage) zeigt den Schutz.
    const disqA = '[data-teil="vorsteg"] [data-action="disq-code"][data-code="M"]'
    await klick(w, disqA)
    expect(w.find(disqA).attributes('data-stand')).toBe('vorgemerkt')
    await klick(w, '[data-action="haupt"]')
    expect(Object.values(q.zuletzt.value[0].zellen).join('')).not.toContain('M')
    await vi.advanceTimersByTimeAsync(BIS_WECHSEL)
    await nextTick()
    // In der Sperre: kein Vormerken (ein Tropfen darf den nächsten Tipp nicht zum Ein-Tipp machen).
    await klick(w, disqA)
    expect(w.find(disqA).attributes('data-stand')).toBe('frei')
    await vi.advanceTimersByTimeAsync(WKR_ANNAHMEN.sperreMs)
    await nextTick()
    await klick(w, disqA)
    expect(w.find(disqA).attributes('data-stand')).toBe('vorgemerkt')
    await klick(w, disqA)
    expect(w.find(disqA).attributes('data-stand')).toBe('gesetzt')
  })

  it('Prüfbefund W3: „So lassen“ übersteht den Neuaufbau der Maske (Reiterwechsel), Wartend-seit kommt aus der Quelle', async () => {
    vi.useFakeTimers()
    const { q, w } = uebung()
    await nextTick()
    for (let i = 0; i < WKR_ANNAHMEN.uebungRueckfrageBei; i++) {
      await klick(w, '[data-action="haupt"]')
      await vi.advanceTimersByTimeAsync(WKR_ANNAHMEN.rueckgaengigMs)
      await nextTick()
    }
    expect(q.wartendSeit.value).toBeNull()
    await zeigt(() => w.find('[data-teil="rueckfrage"]').exists())
    await klick(w, '[data-action="so-lassen"]')
    expect(w.find('[data-teil="rueckfrage"]').exists()).toBe(false)
    w.unmount()
    const neu = mount(WkrGeraet, { attachTo: document.body, props: { quelle: q, ablage: handy() } })
    wrappers.push(neu)
    await nextTick()
    expect(neu.find('[data-teil="zuletzt"]').exists()).toBe(true)
    expect(neu.find('[data-teil="rueckfrage"]').exists()).toBe(false)
  })

  it('Linkshand spiegelt den Fuß; gewählte Sonne gilt', async () => {
    const speicher = handy()
    speicher.setItem('alcatraz.geraet.ansicht', JSON.stringify({ modus: 'sonne', modusGewaehlt: true, hand: 'links' }))
    const q = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'tor5', taktMs: 3_600_000, folgeMs: SOFORT })
    quellen.push(q)
    const w = mount(WkrGeraet, { props: { quelle: q, ablage: speicher } })
    wrappers.push(w)
    await nextTick()
    expect(w.find('[data-teil="wkr-geraet"]').attributes('data-modus')).toBe('sonne')
    expect(w.find('[data-teil="fuss"]').classes()).toContain('wkr-fuss--links')
  })
})

// ---------------------------------------------------------------------------
// W3.4: Liste abschließen, Ansicht, Sprache, Probe (Plan docs/plan-wkr-w3.md §5.7–§5.9)
// ---------------------------------------------------------------------------

const warte = (ms: number) => new Promise((erfuelle) => setTimeout(erfuelle, ms))
const ansichtIn = (speicher: Ablage) => JSON.parse(speicher.getItem('alcatraz.geraet.ansicht') ?? '{}')

/** Übung ohne Netz mit eigenem Speicher – für Fälle, die der Bedienrechner nicht leicht herstellt. */
function uebe(regelwerk: string, typeId: string, speicher: Ablage = handy(), taktMs = 3_600_000) {
  const q = oeffneUebung({ regelwerk, typeId, taktMs, folgeMs: SOFORT })
  quellen.push(q)
  const w = mount(WkrGeraet, { attachTo: document.body, props: { quelle: q, ablage: speicher } })
  wrappers.push(w)
  const l = q.listen.value[0].liste
  return { q, w, l, speicher }
}
/**
 * Abschluss nur noch über das Band (Nutzer 21.11.2026, W3-40, AM10 – „Mehr → Liste abschließen“ entfiel): Am
 * Bedienrechner beginnt Lauf 2, Lauf 1 ist damit für das Gerät vorbei und das Band steht da.
 */
async function oeffneAbschlussUeberBand(w: VueWrapper, dispatch: (a: Action) => void): Promise<void> {
  dispatch({ type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:2' })
  // Erst wenn die Sicht mit Lauf 2 da ist: Lauf 1 läuft dann nicht mehr (`data-laeuft` fehlt, keine Rückfrage R6-10).
  const band = () => w.find('[data-teil="abschluss-band"]')
  await zeigt(() => band().exists() && band().attributes('data-laeuft') === undefined)
  await klick(w, '[data-action="abschluss-band"]')
  expect(w.find('[data-teil="abschluss"]').exists()).toBe(true)
}

describe('Liste abschließen (W3.4, F7/F8)', () => {
  it('Prüfansicht mit offenem Start, „Rest auf Papier“ Pflicht, Name vorbelegt → angenommen am Bedienrechner; Name gemerkt', async () => {
    const speicher = handy()
    speicher.setItem('alcatraz.geraet.ansicht', JSON.stringify({ modus: 'sonne', hand: 'rechts', name: 'Muster WKR' }))
    const r = await bedienrechner()
    const { w } = await mitCode(r.h, [{ art: 'liste', liste: TOR5 }], speicher)
    await bis(() => r.state.value.wkr.listen[TOR5]?.modus === 'digital')
    const s1 = r.zeige()
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === s1.startNr)
    await klick(w, '[data-action="code"][data-code="1"]')
    await klick(w, '[data-action="haupt"]')
    await bis(() => werte(r.state.value, s1.starter)['katalog:tor5'] === '1')
    const s2 = r.zeige()
    await zeigt(() => startNr(w) === s2.startNr && w.find('[data-teil="maske"]').attributes('data-takt') === 'frei')

    await oeffneAbschlussUeberBand(w, r.dispatch)
    expect(w.find('[data-teil="summe"]').text()).toBe(`1 abgeschickt, 1 offen: ${s2.startNr}`)
    const zeile = w.find('[data-teil="pruef-zeile"]')
    expect(zeile.find('[data-teil="nr"]').text()).toBe(s1.startNr)
    expect(zeile.find('[data-teil="codes"]').text()).toContain('1')
    expect(zeile.find('[data-teil="punkte"]').text()).toBe('20 Pkt.')
    await zeigt(() => w.find('[data-teil="pruef-zeile"] [data-teil="stufe"]').text() === '✓ übernommen')
    expect(w.find<HTMLInputElement>('input[data-feld="wkr-name"]').element.value).toBe('Muster WKR')
    // Offener Start: ohne „Rest auf Papier“ gesperrt, mit Satz.
    expect(w.find('[data-action="abschluss-senden"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-teil="rest-pflicht"]').text()).toContain('Rest auf Papier')
    await w.find('input[data-feld="rest-papier"]').setValue(true)
    expect(w.find('[data-action="abschluss-senden"]').attributes('disabled')).toBeUndefined()
    await w.find('input[data-feld="wkr-name"]').setValue('')
    expect(w.find('[data-teil="name-pflicht"]').exists()).toBe(true)
    expect(w.find('[data-action="abschluss-senden"]').attributes('disabled')).toBeDefined()
    await w.find('input[data-feld="wkr-name"]').setValue('Neue WKR')
    await klick(w, '[data-action="abschluss-senden"]')
    expect(['unterwegs', 'angenommen']).toContain(w.find('[data-teil="abschluss-ergebnis"]').attributes('data-stufe'))
    await bis(() => !!r.state.value.wkr.abschluss[TOR5]?.['lauf:1'])
    expect(r.state.value.wkr.abschluss[TOR5]['lauf:1'].name).toBe('Neue WKR')
    await zeigt(() => w.find('[data-teil="abschluss-ergebnis"]').attributes('data-stufe') === 'angenommen')
    expect(w.find('[data-teil="abschluss-ergebnis"]').text()).toContain('abgeschlossen ✓')
    expect(ansichtIn(speicher).name).toBe('Neue WKR')
    expect(w.html()).not.toMatch(NAMEN)
  })

  it('Tipp auf eine Zeile der Prüfansicht öffnet die Korrektur', async () => {
    const { w, s, dispatch } = await listeMitStart('tor5')
    await klick(w, '[data-action="haupt"]')
    await zeigt(() => w.find('[data-teil="leiste-zeile"]').exists())
    await oeffneAbschlussUeberBand(w, dispatch)
    await klick(w, '[data-action="pruef-korrigieren"]')
    expect(w.find('[data-teil="abschluss"]').exists()).toBe(false)
    expect(w.find('[data-action="korrektur-abbrechen"]').exists()).toBe(true)
    expect(startNr(w)).toBe(s.startNr)
  })

  it('Steg nur Anlegen: Prüfansicht nennt den Teil, der Abschluss gilt nur für ihn', async () => {
    const r = await bedienrechner()
    const { w } = await mitCode(r.h, [{ art: 'liste', liste: STEG, teil: 'an' }])
    await bis(() => r.state.value.wkr.listen[STEG]?.modus === 'digital')
    const s = r.zeige()
    // Anlegen nachlaufend (T2): erst nach dem nächsten Start; der dann im Boot zählt für den Abschluss nicht (T9).
    r.zeige()
    await zeigt(() => w.find('[data-teil="karte"]').exists())
    await klick(w, '[data-action="haupt"]')
    await bis(() => !!werte(r.state.value, s.starter)['erfasst.an@steg'])
    await oeffneAbschlussUeberBand(w, r.dispatch)
    expect(w.find('[data-teil="abschluss-teil"]').text()).toBe('Nur dein Teil: Anlegen')
    expect(w.find('[data-teil="summe"]').text()).toBe('1 abgeschickt')
    await w.find('input[data-feld="wkr-name"]').setValue('Muster WKR')
    await klick(w, '[data-action="abschluss-senden"]')
    await bis(() => !!r.state.value.wkr.abschluss[STEG]?.['lauf:1|an'])
    expect(r.state.value.wkr.abschluss[STEG]['lauf:1']).toBeUndefined()
    expect(r.state.value.wkr.abschluss[STEG]['lauf:1|ab']).toBeUndefined()
    await zeigt(() => w.find('[data-teil="abschluss-ergebnis"]').attributes('data-stufe') === 'angenommen')
  })

  it('X in der Summe; abgelehnt `offen` steht als Satz da, das Formular bleibt', async () => {
    const { q, w, l } = uebe('dm-2026', 'vorsteg')
    await nextTick()
    const sicht = q.sichten.value[l]!
    const kopf = q.schlange.value[l][0]
    const disq = maskeFuer(sicht, kopf.klasse)!.disq!.feld
    q.schicke(l, { s: kopf.key, zellen: { [disq]: 'X' } })
    // Der nächste Start kommt erst mit dem Übungstakt (hier sofort, aber nach dem Abschicken).
    await warte(0)
    q.schliesseAb(l, sicht.punkt!.id, 'Muster WKR', false)
    await warte(WKR_ANNAHMEN.uebungQuittungMs + 50)
    await nextTick()
    // Mitten im Lauf gibt es kein Band mehr (W3-40, AM10): die Prüfansicht direkt auf derselben Quelle.
    w.unmount()
    wrappers.splice(wrappers.indexOf(w), 1)
    const ab = mount(WkrAbschluss, {
      attachTo: document.body,
      props: { quelle: q, liste: l, listenTitel: sicht.titel, punkt: sicht.punkt!.id, punktTitel: sicht.punkt!.titel, name: '', zeileText: () => ({ klasse: '', codes: '', punkte: null }), korrigierbar: new Set<string>() },
    })
    wrappers.push(ab)
    await nextTick()
    const w2 = ab
    expect(w2.find('[data-teil="summe"]').text()).toMatch(new RegExp(`^1 abgeschickt, \\d+ offen: .+, 1 X: ${kopf.startNr}$`))
    expect(w2.find('[data-teil="pruef-zeile"]').attributes('data-x')).toBe('true')
    const ergebnis = w2.find('[data-teil="abschluss-ergebnis"]')
    expect([ergebnis.attributes('data-stufe'), ergebnis.attributes('data-grund')]).toEqual(['abgelehnt', 'offen'])
    expect(ergebnis.text()).toContain('Es sind noch Starts offen')
    expect(w2.find('[data-action="abschluss-senden"]').exists()).toBe(true)
  })

  it('Band „Liste abschließen“, sobald der eigene Lauf vorbei ist (G16); weg nach dem Abschluss; Name in der Übung nicht gemerkt', async () => {
    const { q, w, l, speicher } = uebe('dm-2026', 'tor5', handy(), 5)
    await nextTick()
    expect(w.find('[data-teil="abschluss-band"]').exists()).toBe(false)
    for (let i = 0; i < 400 && q.sichten.value[l]!.punkt?.id === 'lauf:1'; i++) {
      const kopf = q.schlange.value[l][0]
      if (kopf) q.schicke(l, { s: kopf.key, zellen: {} })
      else await warte(10)
    }
    expect(q.sichten.value[l]!.punkt?.id).toBe('lauf:2')
    await zeigt(() => w.find('[data-teil="abschluss-band"]').exists())
    expect(w.find('[data-teil="abschluss-band"]').attributes('data-punkt')).toBe('lauf:1')
    await klick(w, '[data-action="abschluss-band"]')
    expect(w.find('[data-teil="abschluss"]').attributes('data-punkt')).toBe('lauf:1')
    // Der nächste Lauf beginnt mit dem Zeigen seines ersten Starts – Nr. 20 kann da noch offen sein.
    const imLauf1 = q.zuletzt.value.filter((z) => z.punkt === 'lauf:1').length
    expect(imLauf1).toBeGreaterThanOrEqual(WKR_ANNAHMEN.uebungStarts - 2)
    expect(w.find('[data-teil="summe"]').text()).toBe(`${imLauf1} abgeschickt`)
    await w.find('input[data-feld="wkr-name"]').setValue('Muster WKR')
    await klick(w, '[data-action="abschluss-senden"]')
    await zeigt(() => w.find('[data-teil="abschluss-ergebnis"]').attributes('data-stufe') === 'angenommen')
    await klick(w, '[data-action="abschluss-zurueck"]')
    expect(w.find('[data-teil="abschluss-band"]').exists()).toBe(false)
    expect(ansichtIn(speicher).name).toBeUndefined()
  })
})

describe('WKR-Name aus der Veranstaltung (Nutzer 21.11.2026, W3-13, WN1–WN3)', () => {
  it('„Mehr → Name“ vorbelegt aus der Einteilung, änderbar mit Hinweis; der Abschluss nimmt den aktuellen Namen; der Bedienrechner kennt ihn', async () => {
    const r = await bedienrechner({ ...wkrBetriebsStand(), einteilung: { [P1]: { tor5: 'Erika Einteilung' } } })
    const { w, id } = await mitCode(r.h, [{ art: 'liste', liste: TOR5 }])
    await bis(() => r.state.value.wkr.listen[TOR5]?.modus === 'digital')
    const s1 = r.zeige()
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === s1.startNr)
    await klick(w, '[data-action="mehr"]')
    const feld = () => w.find<HTMLInputElement>('input[data-feld="wkr-name-mehr"]')
    expect(feld().element.value).toBe('Erika Einteilung')
    expect(w.find('[data-teil="wkr-name-einteilung"]').exists()).toBe(true)
    expect(w.find('[data-action="wkr-name-setzen"]').attributes('disabled')).toBeDefined()
    await feld().setValue('Max Vertretung')
    await klick(w, '[data-action="wkr-name-setzen"]')
    expect(w.find('[data-teil="wkr-name-abweichend"]').text()).toContain('Erika Einteilung')
    await bis(() => r.h.raum.value?.geraete.find((g) => g.id === id())?.wkrNamen?.[TOR5] === 'Max Vertretung')
    expect(JSON.stringify(r.state.value)).not.toContain('Max Vertretung')
    await klick(w, '[data-action="mehr"]')

    await klick(w, '[data-action="haupt"]')
    await bis(() => !!werte(r.state.value, s1.starter)['erfasst@tor5'])
    await zeigt(() => taktFrei(w))
    await oeffneAbschlussUeberBand(w, r.dispatch)
    expect(w.find<HTMLInputElement>('input[data-feld="wkr-name"]').element.value).toBe('Max Vertretung')
    await klick(w, '[data-action="abschluss-senden"]')
    await bis(() => !!r.state.value.wkr.abschluss[TOR5]?.['lauf:1'])
    expect(r.state.value.wkr.abschluss[TOR5]['lauf:1'].name).toBe('Max Vertretung')
  })

  it('ohne Einteilung (WN3): „Mehr“ sagt es, der Abschluss fragt; der dort eingegebene Name gilt danach für die Liste', async () => {
    const { w, dispatch } = await listeMitStart('tor5')
    await klick(w, '[data-action="mehr"]')
    expect(w.find('[data-teil="wkr-name-ohne"]').exists()).toBe(true)
    expect(w.find<HTMLInputElement>('input[data-feld="wkr-name-mehr"]').element.value).toBe('')
    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="haupt"]')
    await zeigt(() => taktFrei(w) && w.find('[data-teil="leiste-zeile"]').exists())
    await oeffneAbschlussUeberBand(w, dispatch)
    expect(w.find<HTMLInputElement>('input[data-feld="wkr-name"]').element.value).toBe('')
    expect(w.find('[data-teil="name-pflicht"]').exists()).toBe(true)
    await w.find('input[data-feld="wkr-name"]').setValue('Tom Test')
    await klick(w, '[data-action="abschluss-senden"]')
    await klick(w, '[data-action="abschluss-zurueck"]')
    await klick(w, '[data-action="mehr"]')
    expect(w.find<HTMLInputElement>('input[data-feld="wkr-name-mehr"]').element.value).toBe('Tom Test')
    expect(w.find('[data-teil="wkr-name-eigen"]').exists()).toBe(true)
  })

  it('Übung: kein Namensfeld unter „Mehr“ (G13)', async () => {
    const { w } = uebe('dm-2026', 'tor5')
    await nextTick()
    await klick(w, '[data-action="mehr"]')
    expect(w.find('[data-teil="mehr"]').exists()).toBe(true)
    expect(w.find('[data-teil="wkr-name"]').exists()).toBe(false)
  })
})

describe('Parcours-Ampel und Abschluss (Nutzer 21.11.2026: P-03, R6-10, W3-40)', () => {
  it('Karte eines Parcours-Geräts: kleiner Punkt mit Wort – grün „Start frei“, rot nach „Durchs Start-Tor“ (AM9)', async () => {
    const { w, s, dispatch } = await listeMitStart('tor5')
    const ampel = () => w.find('[data-teil="karten-ampel"]')
    await zeigt(() => ampel().exists())
    expect(ampel().attributes('data-ampel')).toBe('gruen')
    expect(ampel().text()).toContain('Start frei')
    dispatch({ type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref: s.key, an: true })
    await zeigt(() => ampel().attributes('data-ampel') === 'rot')
    expect(ampel().text()).toContain('im Parcours')
  })

  it('Steg-Gerät: keine Ampel in der Karte (Steg läuft autark)', async () => {
    const { w } = await listeMitStart('steg')
    await zeigt(() => w.find('[data-teil="karte"]').exists())
    expect(w.find('[data-teil="karten-ampel"]').exists()).toBe(false)
  })

  it('„Mehr“ ohne „Liste abschließen“; das Band nennt den Zweck; läuft der Lauf noch, fragt der Abschluss nach', async () => {
    const starter = Array.from({ length: 3 }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(101 + i)))
    const r = await bedienrechner(wkrBetriebsStand(starter))
    const { w } = await mitCode(r.h, [{ art: 'liste', liste: TOR5 }])
    await bis(() => r.state.value.wkr.listen[TOR5]?.modus === 'digital')
    // Tor 1/3/5 digital ohne Gerät: Es schickt nie – die Ampel des letzten Starts bleibt rot, der Lauf läuft.
    r.dispatch({ type: 'WKR_LISTE', liste: liste('gate135'), modus: 'digital' })
    let letzter = r.zeige()
    for (let i = 0; i < 3; i++) {
      if (i > 0) letzter = r.zeige()
      const nr = letzter.startNr
      await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === nr && w.find('[data-teil="maske"]').attributes('data-takt') === 'frei')
      await klick(w, '[data-action="haupt"]')
      const st = letzter.starter
      await bis(() => !!werte(r.state.value, st)['erfasst@tor5'])
    }
    await zeigt(() => w.find('[data-teil="abschluss-band"]').exists())
    expect(w.find('[data-teil="abschluss-zweck"]').text()).toContain('Unterschrift für 1. Lauf')
    expect(w.find('[data-teil="abschluss-zweck"]').text()).toContain('alle Klassen')
    if (w.find('[data-action="mehr"]').exists()) await klick(w, '[data-action="mehr"]')
    expect(w.find('[data-action="abschliessen"]').exists()).toBe(false)
    await klick(w, '[data-action="abschluss-band"]')
    await w.find('input[data-feld="wkr-name"]').setValue('Muster WKR')
    await klick(w, '[data-action="abschluss-senden"]')
    const d = w.find('[data-dialog="wkr-abschluss-laeuft"]')
    expect(d.exists()).toBe(true)
    expect(d.text()).toContain(`1. Lauf läuft noch (${letzter.startNr} unterwegs) – trotzdem abschließen?`)
    // „Warten“ schickt nichts.
    await klick(w, '[data-action="abschluss-laeuft-nein"]')
    expect(w.find('[data-dialog="wkr-abschluss-laeuft"]').exists()).toBe(false)
    expect(w.find('[data-teil="abschluss-ergebnis"]').exists()).toBe(false)
    await klick(w, '[data-action="abschluss-senden"]')
    await klick(w, '[data-action="abschluss-laeuft-ja"]')
    await bis(() => !!r.state.value.wkr.abschluss[TOR5]?.['lauf:1'])
  }, 15_000)
})

describe('Ansicht und Sprache (W3.4, G1, F13/G9)', () => {
  it('Wie Gerät/Sonne/Hell/Dunkel und Linkshand unter „Mehr“, gemerkt in alcatraz.geraet.ansicht', async () => {
    const speicher = handy()
    const { w } = uebe('dm-2026', 'tor5', speicher)
    await nextTick()
    // Vorgabe „Wie Gerät“ (GF1, 21.11.2026): happy-dom meldet kein Dunkel → hell.
    expect(w.find('[data-teil="wkr-geraet"]').attributes('data-modus')).toBe('hell')
    expect(w.find('[data-teil="wkr-geraet"]').attributes('data-wahl')).toBe('geraet')
    await klick(w, '[data-action="mehr"]')
    expect(w.find('[data-action="modus"][data-modus="geraet"]').attributes('aria-pressed')).toBe('true')
    await klick(w, '[data-action="modus"][data-modus="sonne"]')
    expect(w.find('[data-teil="wkr-geraet"]').attributes('data-modus')).toBe('sonne')
    await klick(w, '[data-action="modus"][data-modus="dunkel"]')
    expect(w.find('[data-teil="wkr-geraet"]').attributes('data-modus')).toBe('dunkel')
    await klick(w, '[data-action="linkshand"]')
    expect(w.find('[data-teil="fuss"]').classes()).toContain('wkr-fuss--links')
    expect(ansichtIn(speicher)).toMatchObject({ modus: 'dunkel', hand: 'links' })
    await klick(w, '[data-action="modus"][data-modus="hell"]')
    expect(ansichtIn(speicher).modus).toBe('hell')

    // Ein neues Öffnen (Neuladen) liest sie wieder.
    const neu = uebe('dm-2026', 'tor5', speicher)
    await nextTick()
    expect(neu.w.find('[data-teil="wkr-geraet"]').attributes('data-modus')).toBe('hell')
    expect(neu.w.find('[data-teil="fuss"]').classes()).toContain('wkr-fuss--links')
  })

  it('„Wie Gerät“ folgt dem System live (GF1, Nutzer P-18); eine Wahl bleibt beim Wechsel des Systems', async () => {
    let dunkel = true
    const hoerer = new Set<(e: { matches: boolean }) => void>()
    vi.stubGlobal('matchMedia', (q: string) => ({
      media: q,
      get matches() {
        return dunkel
      },
      addEventListener: (_: string, f: (e: { matches: boolean }) => void) => hoerer.add(f),
      removeEventListener: (_: string, f: (e: { matches: boolean }) => void) => hoerer.delete(f),
    }))
    const speicher = handy()
    const { w } = uebe('dm-2026', 'tor5', speicher)
    await nextTick()
    const wurzel = () => w.find('[data-teil="wkr-geraet"]')
    expect(wurzel().attributes('data-modus')).toBe('dunkel')
    dunkel = false
    for (const f of hoerer) f({ matches: false })
    await nextTick()
    expect(wurzel().attributes('data-modus')).toBe('hell')
    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="modus"][data-modus="sonne"]')
    for (const f of hoerer) f({ matches: true })
    await nextTick()
    expect(wurzel().attributes('data-modus')).toBe('sonne')
  })

  it('UIM: Vorgabe Englisch (Sprache der Liste); „Deutsch“ schaltet Bedientexte UND Kataloge (andere)', async () => {
    const speicher = handy()
    const { w } = uebe('uim-2026', 'mueb', speicher)
    await nextTick()
    expect(haupt(w).text()).toBe('No penalty ✓')
    const titelEn = w.find('.wkr-katalog-titel').text()
    await klick(w, '[data-action="mehr"]')
    expect(w.find('[data-action="sprache"][data-sprache="en"]').attributes('aria-pressed')).toBe('true')
    await klick(w, '[data-action="sprache"][data-sprache="de"]')
    expect(haupt(w).text()).toBe('Fehlerfrei ✓')
    expect(w.find('.wkr-katalog-titel').text()).not.toBe(titelEn)
    expect(w.find('[data-teil="nur-bedientexte"]').exists()).toBe(false)
    expect(ansichtIn(speicher).sprache).toBe('de')
    // Zurück zur Sprache der Liste = keine eigene Wahl mehr.
    await klick(w, '[data-action="sprache"][data-sprache="en"]')
    expect(haupt(w).text()).toBe('No penalty ✓')
    expect(w.find('.wkr-katalog-titel').text()).toBe(titelEn)
    expect(ansichtIn(speicher).sprache).toBeUndefined()
  })

  it('DM: „English“ schaltet nur die Bedientexte – die Codes bleiben deutsch, mit Satz', async () => {
    const { w } = uebe('dm-2026', 'tor5')
    await nextTick()
    const titel = w.find('.wkr-katalog-titel').text()
    const code = w.find('[data-action="code"][data-code="1"] .wkr-code-text').text()
    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="sprache"][data-sprache="en"]')
    expect(haupt(w).text()).toBe('No penalty ✓')
    expect(w.find('[data-action="mehr"]').text()).toBe('Less')
    expect(w.find('.wkr-katalog-titel').text()).toBe(titel)
    expect(w.find('[data-action="code"][data-code="1"] .wkr-code-text').text()).toBe(code)
    expect(w.find('[data-teil="nur-bedientexte"]').exists()).toBe(true)
  })
})

describe('Probe beim Einrichten (W3.4, G10)', () => {
  it('einmal je Raum und Liste; drei Schritte, nichts geht an den Bedienrechner; danach nie wieder von selbst', async () => {
    const r = await bedienrechner()
    const speicher = handy()
    const { w } = await mitCode(r.h, [{ art: 'liste', liste: TOR5 }], speicher, 'lassen')
    await zeigt(() => w.find('[data-teil="probe"]').exists())
    const vorher = JSON.stringify(r.state.value.eingaben)
    const probe = () => w.find('[data-teil="probe"]')
    expect(probe().find('[data-teil="probe-band"]').text()).toContain('nichts wird gesendet')
    expect(w.find('[data-teil="karte"] [data-teil="startnr"]').text()).toBe('P')
    expect(probe().attributes('data-schritt')).toBe('code')
    expect(w.find('[data-teil="probe-schritt"]').text()).toBe('Schritt 1 von 3: Tippe Code 1 an.')
    await klick(w, '[data-action="code"][data-code="1"]')
    expect(probe().attributes('data-schritt')).toBe('zurueck')
    await klick(w, '[data-action="zurueck"]')
    expect(probe().attributes('data-schritt')).toBe('haupt')
    expect(w.find('[data-teil="probe-schritt"]').text()).toContain('Fehlerfrei ✓')
    await klick(w, '[data-action="haupt"]')
    expect(probe().attributes('data-takt')).toBe('gesendet')
    expect(w.find('[data-teil="mitte"]').attributes('inert')).toBeDefined()
    await zeigt(() => probe().attributes('data-schritt') === 'fertig')
    await klick(w, '[data-action="probe-fertig"]')
    expect(w.find('[data-teil="probe"]').exists()).toBe(false)
    expect(w.find('[data-teil="maske"]').exists()).toBe(true)
    await warte(200)
    expect(JSON.stringify(r.state.value.eingaben)).toBe(vorher)
    expect(w.find('[data-teil="leiste-zeile"]').exists()).toBe(false)
    expect(JSON.parse(speicher.getItem('alcatraz.geraet.probe')!).listen).toEqual([TOR5])

    // Neu laden: dieselbe Liste im selben Raum – keine Probe mehr, die Maske kommt gleich.
    w.unmount()
    wrappers.splice(wrappers.indexOf(w), 1)
    location.hash = '#/geraet'
    const gemountet = Date.now()
    const w2 = mount(GeraetApp, { attachTo: document.body, props: { umgebung: { ablage: speicher, zeiten: SCHNELL, ablaufTaktMs: 20 } } })
    wrappers.push(w2)
    await zeigt(() => w2.find('[data-teil="ruhe"]').exists() && ruheArt(w2) !== 'warte', geraeteZustand(w2, speicher, r.h, gemountet))
    expect(w2.find('[data-teil="probe"]').exists()).toBe(false)
    // „Mehr → Probe“ wiederholt sie jederzeit.
    await klick(w2, '[data-action="mehr"]')
    await klick(w2, '[data-action="probe"]')
    expect(w2.find('[data-teil="probe"]').exists()).toBe(true)
  })

  it('überspringen; Vorsteg: zweimal X, „Abbrechen“, dann „In Ordnung“ (Fake-Uhr, Übung)', async () => {
    vi.useFakeTimers()
    const { q, w } = uebe('dm-2026', 'vorsteg')
    await nextTick()
    // In der Übung kommt die Probe nicht von selbst – nur über „Mehr“.
    expect(w.find('[data-teil="probe"]').exists()).toBe(false)
    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="probe"]')
    expect(w.find('[data-teil="probe"]').attributes('data-schritt')).toBe('x')
    await klick(w, '[data-action="probe-ueberspringen"]')
    expect(w.find('[data-teil="probe"]').exists()).toBe(false)

    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="probe"]')
    const x = '[data-teil="probe"] [data-action="disq-code"][data-code="X"]'
    await klick(w, x)
    await klick(w, x)
    expect(w.find('[data-dialog="wkr-x"]').exists()).toBe(true)
    await klick(w, '[data-action="x-nein"]')
    expect(w.find('[data-teil="probe"]').attributes('data-schritt')).toBe('haupt')
    expect(haupt(w).text()).toBe('In Ordnung ✓')
    await klick(w, '[data-action="haupt"]')
    expect(w.find('[data-teil="uebertragen"]').text()).toContain('nichts wird gesendet')
    await vi.advanceTimersByTimeAsync(BIS_WECHSEL)
    await nextTick()
    expect(w.find('[data-teil="probe"]').attributes('data-takt')).toBe('sperre')
    expect(w.find('[data-teil="blitz"]').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(WKR_ANNAHMEN.sperreMs)
    await nextTick()
    await klick(w, '[data-action="probe-fertig"]')
    expect(w.find('[data-teil="maske"]').exists()).toBe(true)
    expect(q.zuletzt.value).toHaveLength(0)
    expect(q.entwuerfe.value).toHaveLength(0)
  })
})

describe('Feldtest mit echtem Handy (21.11.2026)', () => {
  it('Befund 4 (N5): Ende der Probe sagt, was jetzt geschieht; „Probe wiederholen“ fängt von vorn an', async () => {
    vi.useFakeTimers()
    const { w } = uebe('dm-2026', 'tor5')
    await nextTick()
    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="probe"]')
    const probe = () => w.find('[data-teil="probe"]')
    await klick(w, '[data-action="code"][data-code="1"]')
    await klick(w, '[data-action="zurueck"]')
    await klick(w, '[data-action="haupt"]')
    await vi.advanceTimersByTimeAsync(BIS_WECHSEL + WKR_ANNAHMEN.sperreMs)
    await nextTick()
    expect(probe().attributes('data-schritt')).toBe('fertig')
    expect(probe().find('[data-teil="probe-band"]').text()).toBe('Probe beendet')
    expect(w.find('[data-teil="probe-fertig"] h2').text()).toBe('Probe fertig.')
    // In der Übung wird auch danach nichts gesendet – der Satz sagt es (der echte sagt „Ab jetzt wird gesendet“).
    expect(w.find('[data-teil="probe-ende"]').text()).toContain('gesendet wird nichts')
    expect(w.find('[data-action="probe-fertig"]').text()).toBe('Los geht’s')
    await klick(w, '[data-action="probe-wiederholen"]')
    expect(probe().attributes('data-schritt')).toBe('code')
    expect(probe().find('[data-teil="probe-band"]').text()).toContain('nichts wird gesendet')
  })

  it('Befund 10 (N6): der Umschaltknopf nennt das Ziel (DISQ ↔ FEHLER), über der offenen Liste steht „Disq.“', async () => {
    const { w } = uebe('dm-2026', 'steg')
    await nextTick()
    const knopf = () => w.find('[data-action="disq"]')
    expect(knopf().text()).toBe('DISQ')
    expect(w.find('[data-teil="disq-titel"]').exists()).toBe(false)
    await klick(w, '[data-action="disq"]')
    expect(knopf().text()).toBe('FEHLER')
    expect(knopf().attributes('aria-expanded')).toBe('true')
    expect(w.find('[data-teil="disq-titel"]').text()).toBe('Disq.')
    await klick(w, '[data-action="disq"]')
    expect(knopf().text()).toBe('DISQ')
    expect(w.find('[data-teil="knoepfe"]').exists()).toBe(true)
  })

  it('Befund 3 (N6): „Andere Startnummer …“ über die volle Breite statt „Nr.“', async () => {
    const { w } = uebe('dm-2026', 'tor5')
    await nextTick()
    const suche = w.find('[data-action="suche"]')
    expect(suche.text()).toBe('Andere Startnummer …')
    expect(suche.classes()).toContain('wkr-knopf--breit')
    await suche.trigger('click')
    expect(w.find('[data-teil="ziffernfeld"]').exists()).toBe(true)
  })

  it('Befund 1 (N3): Code-Knopf – Nummer eigene Spalte, Text und Punkte gemeinsam umbrechend, Zähler fest', async () => {
    const { w } = uebe('dm-2026', 'mueb')
    await nextTick()
    for (const k of w.findAll('[data-action="code"]')) {
      expect(k.element.children[0].className).toBe('wkr-code-nr')
      expect(k.element.children[1].className).toBe('wkr-code-mitte')
      expect(k.find('.wkr-code-mitte .wkr-code-text').exists()).toBe(true)
      expect(k.find('.wkr-code-mitte .wkr-code-punkte').exists()).toBe(true)
    }
  })

  it('Befund 1 (Prüfbefund): die längsten Katalog- und Disq.-Texte von DM und UIM stehen ganz da – Nummer eigene Spalte, kein nowrap, nichts abgeschnitten', async () => {
    const { readFileSync } = await import('node:fs')
    const css = readFileSync(`${process.cwd()}/src/styles/wkr-geraet.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const regel = (sel: string) => css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[2] ?? ''
    for (const sel of ['.wkr-code-text', '.wkr-code-mitte']) expect(regel(sel), sel).not.toMatch(/nowrap|text-overflow|overflow:\s*hidden/)
    for (const regelwerk of ['dm-2026', 'uim-2026']) {
      const texte: { text: string; knopf: Element }[] = []
      for (const typeId of ['tor5', 'mueb', 'steg', 'vorsteg']) {
        const { w } = uebe(regelwerk, typeId)
        await nextTick()
        const sammle = () => {
          for (const t of w.findAll('.wkr-code-text')) texte.push({ text: t.text(), knopf: t.element.closest('button')! })
        }
        sammle()
        if (w.find('[data-action="disq"]').exists()) {
          await klick(w, '[data-action="disq"]')
          sammle()
        }
      }
      expect(texte.length, regelwerk).toBeGreaterThan(5)
      const laengste = [...texte].sort((a, b) => b.text.length - a.text.length).slice(0, 5)
      for (const { text, knopf } of laengste) {
        // Ganz im DOM (kein Kürzel, keine Auslassung), Nummer in eigener Spalte vor dem Text, kein Stil am Element.
        expect(text.length, text).toBeGreaterThan(10)
        expect(text).not.toMatch(/…$/)
        expect(knopf.children[0].className, text).toBe('wkr-code-nr')
        expect(knopf.getAttribute('style') ?? '', text).not.toMatch(/nowrap|overflow/)
      }
    }
  })

  it('Befund 14a (N7): Bildschirm kann ausgehen → gelbes Band mit Tipp, „Ausblenden“ hält über den Neuaufbau', async () => {
    const q = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'tor5', taktMs: 3_600_000, folgeMs: SOFORT })
    quellen.push(q)
    const ohne = mount(WkrGeraet, { props: { quelle: q, ablage: handy() } })
    wrappers.push(ohne)
    expect(ohne.find('[data-teil="wach-hinweis"]').exists()).toBe(false)
    const w = mount(WkrGeraet, { props: { quelle: q, ablage: handy(), bildschirmKannAus: true } })
    wrappers.push(w)
    const band = w.find('[data-teil="wach-hinweis"]')
    expect(band.text()).toContain('Bildschirm kann ausgehen.')
    expect(band.text()).toContain('Display-Zeit am Handy verlängern')
    await klick(w, '[data-action="wach-ausblenden"]')
    expect(w.find('[data-teil="wach-hinweis"]').exists()).toBe(false)
    const neu = mount(WkrGeraet, { props: { quelle: q, ablage: handy(), bildschirmKannAus: true } })
    wrappers.push(neu)
    expect(neu.find('[data-teil="wach-hinweis"]').exists()).toBe(false)
    const { wachHinweisWeg } = await import('./components/wkr/gedaechtnis')
    wachHinweisWeg.weg = false
  })
})

describe('Übung erreichbar ohne Kopplung (W3.4, G13)', () => {
  it('„Üben ohne Verbindung“ im Koppel-Formular → `#/uebung` in derselben Wurzel; Kopf dauerhaft „ÜBUNG“', async () => {
    const r = await bedienrechner()
    r.h.gibCode([{ art: 'liste', liste: TOR5 }])
    await bis(() => !!r.h.raum.value?.koppeln.code)
    location.hash = koppelnAdresse(r.h.raum.value!.koppelLink)
    const w = mount(GeraetApp, { attachTo: document.body, props: { umgebung: { ablage: handy(), zeiten: SCHNELL, ablaufTaktMs: 20 } } })
    wrappers.push(w)
    await zeigt(() => w.find('input[data-feld="code"]').exists())
    const link = w.find('[data-teil="koppeln"] a[data-action="ueben"]')
    expect([link.attributes('href'), link.text()]).toEqual(['#/uebung', 'Üben ohne Verbindung'])
    location.hash = link.attributes('href')!
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await zeigt(() => w.find('[data-teil="uebung-wahl"]').exists())
    expect(w.find('[data-teil="koppeln"]').exists()).toBe(false)
    await klick(w, '[data-action="uebung-liste"][data-liste="vorsteg"]')
    await klick(w, '[data-action="uebung-start"]')
    expect(w.find('[data-teil="wkr-kopf"] [data-teil="uebung"]').text()).toBe('ÜBUNG')
    expect(haupt(w).text()).toBe('In Ordnung ✓')
    expect(w.html()).not.toMatch(NAMEN)
  })
})

describe('Befund 15 (21.11.2026): zwei Tabs derselben Kopplung', () => {
  it('der zuletzt geöffnete Tab sendet allein; der alte zeigt „In einem anderen Tab geöffnet“, jede Zeile kommt an', async () => {
    const r = await listeMitStart('tor5')
    location.hash = '#/geraet'
    const w2 = mount(GeraetApp, { attachTo: document.body, props: { umgebung: { ablage: r.speicher, zeiten: SCHNELL, ablaufTaktMs: 20 } } })
    wrappers.push(w2)
    await zeigt(() => w2.find('[data-teil="karte"]').exists() && startNr(w2) === r.s.startNr)
    // Der alte Tab merkt es spätestens beim nächsten Schreiben (im Browser schon am storage-Ereignis) und stoppt.
    await zeigt(() => r.w.find('[data-meldung="andererTab"]').exists())
    expect(r.w.find('[data-teil="wkr-geraet"]').exists()).toBe(false)
    await klick(w2, '[data-action="haupt"]')
    await bis(() => !!werte(r.state.value, r.s.starter)['erfasst@tor5'])
    const s2 = r.zeige()
    await zeigt(() => startNr(w2) === s2.startNr && w2.find('[data-teil="maske"]').attributes('data-takt') === 'frei')
    await klick(w2, '[data-action="haupt"]')
    await bis(() => !!werte(r.state.value, s2.starter)['erfasst@tor5'])
    // „Hier weitermachen“ im alten Tab: jetzt ist der neue verdrängt.
    await klick(r.w, '[data-action="hier-weiter"]')
    await zeigt(() => r.w.find('[data-teil="wkr-geraet"]').exists())
    await zeigt(() => w2.find('[data-meldung="andererTab"]').exists())
  })
})

describe('Mehr Listen je Gerät (Nutzer 21.11.2026, W3-03, GF8)', () => {
  it('Pad quer mit zwei Listen: zwei Spalten nebeneinander, ohne Reiter', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ media: q, matches: q.includes('min-width: 1000px'), addEventListener: () => {}, removeEventListener: () => {} }))
    const r = await bedienrechner()
    const { w } = await mitCode(r.h, [{ art: 'liste', liste: TOR5 }, { art: 'liste', liste: MUEB }])
    await zeigt(() => w.find('[data-teil="nebeneinander"]').exists())
    expect(w.findAll('[data-teil="nebeneinander"] .wkr-spalte').map((x) => x.attributes('data-liste'))).toEqual([TOR5, MUEB])
    expect(w.find('[data-teil="listen-reiter"]').exists()).toBe(false)
    expect(w.find('[data-teil="wkr-geraet"]').attributes('data-nebeneinander')).toBe('true')
  }, 20_000)
})

describe('Erste Liste auf einem Gerät ohne Liste (Nutzer 21.11.2026, W3-24, GF6)', () => {
  it('Gerät nur mit Start-Freigabe bekommt eine Liste: Maske kommt ohne Neuladen', async () => {
    const r = await bedienrechner()
    const speicher = handy()
    const { w, id } = await mitCode(r.h, [{ art: 'startfreigabe', bereiche: [P1] }], speicher)
    // W3-25 (GF7): Die Art kam mit der Anmeldung (happy-dom: Maus → Rechner); der Bediener kann sie ändern.
    expect(r.h.raum.value!.geraete[0].typ).toBe('rechner')
    r.h.setzeTyp(id(), 'handy')
    await bis(() => r.h.raum.value!.geraete[0].typ === 'handy')
    const seit = Date.now()
    r.zeige()
    r.h.setzeAufgaben(id(), [{ art: 'startfreigabe', bereiche: [P1] }, { art: 'liste', liste: TOR5 }])
    await zeigt(() => w.find(`[data-action="reiter"][data-reiter='${TOR5}']`).exists())
    await klick(w, `[data-action="reiter"][data-reiter='${TOR5}']`)
    await zeigt(
      () => w.find('[data-teil="probe"]').exists() || w.find('[data-teil="karte"]').exists() || (w.find('[data-teil="ruhe"]').exists() && ruheArt(w) !== 'warte'),
      geraeteZustand(w, speicher, r.h, seit),
    )
  }, 20_000)

  it('Gerät ganz ohne Aufgabe bekommt eine Liste: Maske kommt ohne Neuladen', async () => {
    const r = await bedienrechner()
    const speicher = handy()
    const { w, id } = await mitCode(r.h, [{ art: 'liste', liste: TOR5 }], speicher)
    const seit = Date.now()
    r.h.setzeAufgaben(id(), [])
    await zeigt(() => !w.find('[data-teil="karte"]').exists() && (r.h.raum.value?.geraete[0].aufgaben.length ?? 1) === 0)
    r.zeige()
    r.h.setzeAufgaben(id(), [{ art: 'liste', liste: MUEB }])
    await zeigt(
      () => w.find('[data-teil="probe"]').exists() || w.find('[data-teil="karte"]').exists() || (w.find('[data-teil="ruhe"]').exists() && ruheArt(w) !== 'warte'),
      geraeteZustand(w, speicher, r.h, seit),
    )
  }, 20_000)
})

describe('Feldtest 21.11.2026: Neuladen (N11, N12) und „Bitte Nr. prüfen“ (N13)', () => {
  /** Das Handy lädt neu: alte Seite weg, dieselbe Ablage, Adresse `#/geraet`. */
  async function neuLaden(alt: VueWrapper, speicher: Ablage): Promise<VueWrapper> {
    alt.unmount()
    wrappers.splice(wrappers.indexOf(alt), 1)
    location.hash = '#/geraet'
    const w = mount(GeraetApp, { attachTo: document.body, props: { umgebung: { ablage: speicher, zeiten: SCHNELL, ablaufTaktMs: 20 } } })
    wrappers.push(w)
    return w
  }

  it('nach dem Neuladen neutral „verbinde …“ (kein Rot, keine Schätzung), dann verbunden; die nächste Zeile kommt an', async () => {
    const r = await listeMitStart('tor5')
    await klick(r.w, '[data-action="haupt"]')
    await bis(() => !!werte(r.state.value, r.s.starter)['erfasst@tor5'])
    const s2 = r.zeige()
    r.zeige()
    await zeigt(() => startNr(r.w) === s2.startNr && r.w.find('[data-teil="maske"]').attributes('data-takt') === 'frei')

    const w = await neuLaden(r.w, r.speicher)
    // Die abgelegte Sicht zeigt die Maske sofort – während die Verbindung erst aufgebaut wird.
    await zeigt(() => w.find('[data-teil="verbindung"]').exists())
    expect(w.find('[data-teil="verbindung"]').attributes('data-lage')).toBe('verbinde')
    expect(w.find('[data-teil="verbindung"]').text()).toBe('◌ verbinde …')
    expect(w.find('[data-teil="getrennt"]').exists()).toBe(false)
    expect(w.find('[data-teil="geschaetzt"]').exists()).toBe(false)
    expect(w.html()).not.toContain('0 Zeilen')
    await zeigt(() => w.find('[data-teil="verbindung"]').attributes('data-lage') === 'verbunden')
    expect(w.find('[data-teil="getrennt"]').exists()).toBe(false)
    await zeigt(() => startNr(w) === s2.startNr)
    await klick(w, '[data-action="code"][data-code="1"]')
    await klick(w, '[data-action="haupt"]')
    await bis(() => werte(r.state.value, s2.starter)['katalog:tor5'] === '1')
    // Auch ein Start, der erst nach dem Neuladen gezeigt wird, kommt auf das Handy (Abo steht wieder).
    const s4 = r.zeige()
    await zeigt(() => w.findAll('[data-action="ausweichen"]').some((b) => b.text() === s4.startNr) || startNr(w) === s4.startNr)
  })

  it('kommt die Verbindung nach dem Neuladen nicht, wird es erst nach der Karenz rot – ohne „0 Zeilen warten“', async () => {
    const r = await listeMitStart('tor5')
    vi.stubGlobal(
      'WebSocket',
      class extends NachgebauterSocket {
        constructor(url: string) {
          super(url)
          this.close()
        }
      },
    )
    const karenz = WKR_ANNAHMEN.verbindeKarenzSek
    // Nur hier kürzer, damit der Test nicht 12 s wartet; der Wert selbst steht in WKR_ANNAHMEN. 2 s statt 0,4 s (Prüfung
    // unter Last 21.11.2026): Neuladen und erstes Bild brauchen auf zwei belegten Kernen schon fast 0,4 s – dann stünde
    // „getrennt“ da, bevor der Test „verbinde“ sehen kann.
    ;(WKR_ANNAHMEN as { verbindeKarenzSek: number }).verbindeKarenzSek = 2
    try {
      const w = await neuLaden(r.w, r.speicher)
      await zeigt(() => w.find('[data-teil="verbindung"]').exists())
      expect(w.find('[data-teil="verbindung"]').attributes('data-lage')).toBe('verbinde')
      expect(w.find('[data-teil="getrennt"]').exists()).toBe(false)
      await zeigt(() => w.find('[data-teil="getrennt"]').exists())
      expect(w.find('[data-teil="verbindung"]').attributes('data-lage')).toBe('getrennt')
      expect(w.find('[data-teil="getrennt"]').text()).toBe('Keine Verbindung – weiter erfassen')
    } finally {
      ;(WKR_ANNAHMEN as { verbindeKarenzSek: number }).verbindeKarenzSek = karenz
    }
  })

  it('„601 öffnen“: noch offen → Eingabe dieses Starts; gesendet → Korrektur mit den bisherigen Werten; unbekannt → Suche vorbelegt', async () => {
    const { w, h, zeige, s, state } = await listeMitStart('tor5')
    const s2 = zeige()
    await zeigt(() => w.findAll('[data-action="ausweichen"]').length === 1)

    // Noch offen (zweiter in der Schlange): direkt in die Eingabe.
    h.hinweis(TOR5, 'pruefen', s2.startNr)
    await zeigt(() => w.find('[data-action="hinweis-oeffnen"]').exists())
    expect(w.find('[data-teil="hinweis"]').text()).toContain(`Bediener bittet: Start ${s2.startNr} prüfen`)
    expect(w.find('[data-action="hinweis-oeffnen"]').text()).toBe(`${s2.startNr} öffnen`)
    expect(w.find('[data-teil="hinweis"] [data-action="gesehen"]').exists()).toBe(true)
    await klick(w, '[data-action="hinweis-oeffnen"]')
    expect(startNr(w)).toBe(s2.startNr)
    expect(w.find('[data-teil="ausser"]').exists()).toBe(true)
    // Öffnen gilt als gesehen.
    await zeigt(() => !w.find('[data-teil="hinweis"]').exists())

    // Den ersten mit Code 1 abschicken, dann bittet der Bediener um Prüfung: Korrektur mit „1“.
    await klick(w, '[data-action="ausweichen"]')
    expect(startNr(w)).toBe(s.startNr)
    await klick(w, '[data-action="code"][data-code="1"]')
    await klick(w, '[data-action="haupt"]')
    await bis(() => werte(state.value, s.starter)['katalog:tor5'] === '1')
    h.hinweis(TOR5, 'pruefen', s.startNr)
    await zeigt(() => w.find('[data-action="hinweis-oeffnen"]').exists())
    await klick(w, '[data-action="hinweis-oeffnen"]')
    expect(w.find('[data-teil="korrektur"]').text()).toBe(`Korrektur Start ${s.startNr}`)
    expect(w.find('[data-action="code"][data-code="1"]').attributes('data-anzahl')).toBe('1')
    await klick(w, '[data-action="korrektur-abbrechen"]')

    // Unbekannt auf dem Gerät: Suche offen, Nummer vorbelegt, Satz „nicht in der Folge“.
    h.hinweis(TOR5, 'pruefen', '987')
    await zeigt(() => w.find('[data-action="hinweis-oeffnen"]').exists())
    await klick(w, '[data-action="hinweis-oeffnen"]')
    await nextTick()
    expect(w.find('[data-teil="ziffernfeld"] [data-teil="eingabe"]').text()).toBe('987')
    expect(w.find('[data-teil="nicht-gefunden"]').text()).toContain('987')
  })

  it('„601 öffnen“ in Lauf 2: die gesendete Zeile aus Lauf 1 zählt nicht – Eingabe des Lauf-2-Starts, keine Korrektur', async () => {
    // Ein einziger Starter: Nach seinem Lauf 1 kommt derselbe Start in Lauf 2 (dieselbe Nummer, anderer Punkt).
    const { state, dispatch, h, zeige } = await bedienrechner(wkrBetriebsStand([betriebStarter('e1', 'E', 'E01')]))
    const { w } = await mitCode(h, [{ art: 'liste', liste: TOR5 }])
    await bis(() => state.value.wkr.listen[TOR5]?.modus === 'digital')
    const s = zeige()
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === s.startNr)
    await klick(w, '[data-action="code"][data-code="1"]')
    await klick(w, '[data-action="haupt"]')
    await bis(() => werte(state.value, s.starter)['katalog:tor5'] === '1')
    await zeigt(() => w.find('[data-teil="leiste-zeile"]').attributes('data-stufe') === 'uebernommen')
    dispatch({ type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:2' })
    const s2 = zeige()
    expect(s2.startNr).toBe(s.startNr)
    expect(s2.key).not.toBe(s.key)
    await zeigt(() => w.find('[data-teil="maske"]').attributes('data-takt') === 'frei' && w.find('[data-teil="karte"]').exists() && w.find('[data-teil="lauf"]').text().includes('2'))
    h.hinweis(TOR5, 'pruefen', s.startNr)
    await zeigt(() => w.find('[data-action="hinweis-oeffnen"]').exists())
    await klick(w, '[data-action="hinweis-oeffnen"]')
    expect(w.find('[data-teil="korrektur"]').exists()).toBe(false)
    expect(startNr(w)).toBe(s.startNr)
    expect(w.find('[data-teil="lauf"]').text()).toContain('2')
    expect(w.find('[data-action="code"][data-code="1"]').attributes('data-anzahl') ?? '0').toBe('0')
  }, 15_000)

  it('„987 öffnen“ in der Ruhe: Band „nicht in der Folge“ mit „Gesehen“, weg sobald ein Start erscheint', async () => {
    const r = await bedienrechner()
    const g = await mitCode(r.h, [{ art: 'liste', liste: TOR5 }])
    await bis(() => r.state.value.wkr.listen[TOR5]?.modus === 'digital')
    const w = g.w
    await zeigt(() => w.find('[data-teil="wkr-kopf"]').exists())
    r.h.hinweis(TOR5, 'pruefen', '987')
    await zeigt(() => w.find('[data-action="hinweis-oeffnen"]').exists())
    await klick(w, '[data-action="hinweis-oeffnen"]')
    await zeigt(() => w.find('[data-teil="hinweis-unbekannt"]').exists())
    expect(w.find('[data-teil="hinweis-unbekannt"] [data-action="hinweis-unbekannt-weg"]').exists()).toBe(true)
    const s = r.zeige()
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === s.startNr)
    expect(w.find('[data-teil="hinweis-unbekannt"]').exists()).toBe(false)
    // Der nächste Hinweis liegt über dem Kopf (S5) – sein Erscheinen verschiebt keinen Knopf.
    r.h.hinweis(TOR5, 'pruefen', '988')
    await zeigt(() => w.find('[data-action="hinweis-oeffnen"]').exists())
    expect(w.find('[data-teil="hinweis"]').classes()).toContain('wkr-kopf-ueber')
  })

  it('andere Hinweise (Papier ab) behalten nur „Gesehen“', async () => {
    const { w, h, s } = await listeMitStart('tor5')
    h.hinweis(TOR5, 'papier', s.startNr)
    await zeigt(() => w.find('[data-teil="hinweis"]').exists())
    expect(w.find('[data-action="hinweis-oeffnen"]').exists()).toBe(false)
    expect(w.find('[data-teil="hinweis"] [data-action="gesehen"]').exists()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// W4.2: Bojen-Maske (Plan docs/plan-wkr-w4.md §5, 21.11.2026)
// ---------------------------------------------------------------------------

describe('Bojen (W4.2)', () => {
  // Erfundene Starter: Klassen 4 und 7 landen auf Parcours 2 und fahren abwechselnd (401, 701, 402, 702).
  const P2 = 'par_2'
  const GATE2 = listenKennung({ bereich: P2, typeId: 'gate135', racecourse: null })
  const bojenStand = () =>
    wkrBetriebsStand([betriebStarter('a1', '7', '701'), betriebStarter('a2', '7', '702'), betriebStarter('b1', '4', '401'), betriebStarter('b2', '4', '402')])
  const boje = (feld: string) => `[data-action="boje"][data-feld="${feld}"]`

  async function torListe() {
    const r = await bedienrechner(bojenStand(), P2)
    const g = await mitCode(r.h, [{ art: 'liste', liste: GATE2 }])
    await bis(() => r.state.value.wkr.listen[GATE2]?.modus === 'digital')
    return { ...r, ...g }
  }

  it('gate135: Kl. 4 ohne Tor 1 R und ohne Umschalter, Fehlerfrei → Haken ohne Zellen; Kl. 7 mit Band, Umschalter, Schalter, Zähler „15“, Tor 1 R + 2. Durchfahrt, Disq. → Erfassung am Host', async () => {
    const { w, state, zeige } = await torListe()
    const v1 = zeige()
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === v1.startNr)
    expect(v1.startNr).toBe('401')
    // Klasse 4: sieben Zeilen, kein Umschalter, kein Tor 1 auf der Rückfahrt.
    expect(w.find('[data-teil="weg-umschalter"]').exists()).toBe(false)
    expect(w.findAll('[data-teil="halt"]').map((h) => h.attributes('data-halt'))).toEqual(['start', 't1a', 't3a', 't5', 't5', 't3b', 'ziel'])
    expect(w.find('[data-feld^="t1b"]').exists()).toBe(false)
    expect(w.findAll('[data-teil="weg-kopf"]').map((k) => k.text())).toEqual(['HINWEG', 'RÜCKWEG'])
    expect(w.find('[data-teil="maske"]').classes()).toContain('wkr-maske--bojen')
    expect(haupt(w).text()).toBe('Fehlerfrei ✓')
    await klick(w, '[data-action="haupt"]')
    await bis(() => !!werte(state.value, v1.starter)['erfasst@gate135'])
    expect(Object.keys(werte(state.value, v1.starter)).filter((k) => k !== 'erfasst@gate135')).toEqual([])

    // Klasse 7: andere Halte → Band über der Karte (verschiebt nichts), Umschalter auf „Hinweg“.
    const s7 = zeige()
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === s7.startNr)
    expect(w.find('[data-teil="klassen-wechsel"]').text()).toBe('Klasse 7 – andere Halte')
    expect(w.find('.wkr-karten-platz [data-teil="klassen-wechsel"]').exists()).toBe(true)
    const mitte = w.find('[data-teil="bojen"]').html()
    await zeigt(() => !w.find('[data-teil="klassen-wechsel"]').exists())
    expect(w.find('[data-teil="bojen"]').html()).toBe(mitte)
    expect(w.find('[data-action="weg"][data-weg="hin"]').attributes('aria-selected')).toBe('true')
    expect(w.findAll('[data-teil="halt"]').map((h) => h.attributes('data-halt'))).toEqual(['start', 't1a', 't3a', 't5'])

    // Schalter: Tipp setzt („✔ 5“), ein prellender zweiter Tipp gleich danach zählt nicht (bojenSchalterPrellMs),
    // ein späterer nimmt weg, der nächste setzt wieder.
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    const weiter = () => vi.setSystemTime(Date.now() + WKR_ANNAHMEN.bojenSchalterPrellMs + 100)
    await klick(w, boje('t1a|hin seiteB'))
    expect(w.find(boje('t1a|hin seiteB')).text()).toBe('H L✔ 5')
    expect(w.find(boje('t1a|hin seiteB')).attributes('aria-pressed')).toBe('true')
    expect(haupt(w).text()).toBe('Abschicken · 5 Pkt.')
    await klick(w, boje('t1a|hin seiteB'))
    expect(w.find(boje('t1a|hin seiteB')).attributes('aria-pressed')).toBe('true')
    weiter()
    await klick(w, boje('t1a|hin seiteB'))
    expect(haupt(w).text()).toBe('Fehlerfrei ✓')
    weiter()
    await klick(w, boje('t1a|hin seiteB'))
    // Zähler Tor 5: dreimal → „3× = 15“.
    for (let i = 0; i < 3; i++) await klick(w, boje('t5|hin seiteA'))
    expect(w.find(boje('t5|hin seiteA')).find('[data-teil="boje-stand"]').text()).toBe('3× = 15')
    expect(w.find(boje('t5|hin seiteA')).find('[data-teil="boje-max"]').exists()).toBe(false)
    expect(w.find('[data-action="weg"][data-weg="hin"]').text()).toBe('HINWEG · 4')
    expect(w.find('[data-action="weg"][data-weg="rueck"]').text()).toBe('RÜCKWEG · 0')
    // Rückweg: Tor 1 R und die 2. Durchfahrt nach Sp. 2 (wie das Boot fährt).
    await klick(w, '[data-action="weg"][data-weg="rueck"]')
    expect(w.findAll('[data-teil="halt"]').map((h) => `${h.attributes('data-halt')}${h.attributes('data-durchfahrt') ?? ''}`)).toEqual(['t5', 't3b', 't1b', 'speed2', 't1c2', 'ziel'])
    expect(w.find('[data-halt="t1c"] [data-teil="durchfahrt"]').text()).toBe('2. Durchfahrt (Speedrunde)')
    await klick(w, boje('t1b|rueck seiteA'))
    await klick(w, boje('t1c|rueck seiteB'))
    expect(w.find('[data-action="weg"][data-weg="rueck"]').text()).toBe('RÜCKWEG · 2')
    // Disq. (W4-12, BZ4): DISQ fragt erst den Ort – „keine Boje / ganzer Parcours“ → Disq.-Feld der Liste.
    await klick(w, '[data-action="disq"]')
    expect(w.find('[data-teil="disq-ort"]').attributes('data-schritt')).toBe('wo')
    expect(w.findAll('[data-teil="disq-ort-halt"]').map((h) => h.attributes('data-halt'))[0]).toBe('start')
    await klick(w, '[data-action="disq-ort-keine"]')
    const code = w.findAll('[data-action="disq-code"]').map((b) => b.attributes('data-code')!).find((c) => c !== 'X')!
    await klick(w, `[data-action="disq-code"][data-code="${code}"]`)
    await klick(w, `[data-action="disq-code"][data-code="${code}"]`)
    expect(haupt(w).text()).toBe(`Abschicken · 30 Pkt. · Disq. ${code}`)
    await klick(w, '[data-action="haupt"]')
    await bis(() => werte(state.value, s7.starter)['t5|hin seiteA'] === '15')
    const v = werte(state.value, s7.starter)
    expect([v['t1a|hin seiteB'], v['t1b|rueck seiteA'], v['t1c|rueck seiteB'], v['disq@gate135']]).toEqual(['5', '5', '5', code])
    expect(v['t1a|hin seiteA'] ?? '').toBe('')
    expect(w.html()).not.toMatch(NAMEN)
  }, 20_000)

  it('W4-13 (GF9): Band nur beim ersten Start einer Klasse im Punkt; Parcours-Zeichnung unter den Knöpfen', async () => {
    const { w, zeige, state } = await torListe()
    const s4 = zeige()
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === s4.startNr)
    // Die Zeichnung der Klasse steht unter den Knöpfen (Sicht `bild`, wie auf dem Bogen).
    expect(w.find('[data-teil="mitte"] [data-teil="parcours-bild"]').exists()).toBe(true)
    expect(w.find('[data-teil="parcours-bild"]').text()).toContain('Klasse 4')
    const fertig = async (s: { starter: string; startNr: string }, naechste: string) => {
      await klick(w, '[data-action="haupt"]')
      await bis(() => !!werte(state.value, s.starter)['erfasst@gate135'])
      await zeigt(() => startNr(w) === naechste && w.find('[data-teil="maske"]').attributes('data-takt') === 'frei')
    }
    const s7 = zeige()
    await fertig(s4, s7.startNr)
    expect(w.find('[data-teil="klassen-wechsel"]').exists()).toBe(true)
    const s42 = zeige()
    await fertig(s7, s42.startNr)
    // Zurück zu Klasse 4 – deren erster Start war schon da: kein Band.
    expect(w.find('[data-teil="klassen-wechsel"]').exists()).toBe(false)
  }, 20_000)

  it('Umschalter wechselt nie von selbst; Seite je Start gemerkt, ein anderer Start beginnt auf „Hinweg“', async () => {
    const { w, zeige, state } = await torListe()
    const s4 = zeige()
    const s7 = zeige()
    zeige()
    const s72 = zeige()
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === s4.startNr)
    // 401 (Kl. 4) fehlerfrei – dann steht 701 vorn, 402 und 702 zum Ausweichen.
    await klick(w, '[data-action="haupt"]')
    await bis(() => !!werte(state.value, s4.starter)['erfasst@gate135'])
    await zeigt(() => startNr(w) === s7.startNr && w.find('[data-teil="maske"]').attributes('data-takt') === 'frei')
    await klick(w, '[data-action="weg"][data-weg="rueck"]')
    await klick(w, boje('t3b|rueck seiteB'))
    expect(w.find('[data-action="weg"][data-weg="rueck"]').attributes('aria-selected')).toBe('true')
    // Zu 702: neuer Start, Hinweg.
    const nach702 = w.findAll('[data-action="ausweichen"]').find((b) => b.text() === s72.startNr)
    if (!nach702) throw new Error(`702 nicht unter ${w.findAll('[data-action="ausweichen"]').map((b) => b.text())}`)
    await nach702.trigger('click')
    await nextTick()
    expect(startNr(w)).toBe(s72.startNr)
    expect(w.find('[data-action="weg"][data-weg="hin"]').attributes('aria-selected')).toBe('true')
    // Zurück zu 701: wieder Rückweg, der Tipp steht noch.
    await w.findAll('[data-action="ausweichen"]').find((b) => b.text() === s7.startNr)!.trigger('click')
    await nextTick()
    expect(startNr(w)).toBe(s7.startNr)
    expect(w.find('[data-action="weg"][data-weg="rueck"]').attributes('aria-selected')).toBe('true')
    expect(w.find(boje('t3b|rueck seiteB')).attributes('data-anzahl')).toBe('1')
  }, 15_000)

  it('Korrektur aus Zuletzt: „Tor 1 H L: 5 → Tor 1 H L: 5 · Tor 3 R L: 5“, am Host danach beide', async () => {
    const { w, state, zeige } = await torListe()
    const s4 = zeige()
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === s4.startNr)
    await klick(w, boje('t1a|hin seiteB'))
    await klick(w, '[data-action="haupt"]')
    await bis(() => werte(state.value, s4.starter)['t1a|hin seiteB'] === '5')
    await zeigt(() => w.find('[data-action="zuletzt"]').exists())
    await klick(w, '[data-action="zuletzt"]')
    expect(w.find('[data-teil="zuletzt-liste"]').text()).toContain('Tor 1 H L: 5')
    await klick(w, '[data-teil="zuletzt-liste"] [data-action="korrigieren"]')
    expect(w.find(boje('t1a|hin seiteB')).attributes('data-anzahl')).toBe('1')
    await klick(w, boje('t3b|rueck seiteB'))
    await klick(w, '[data-action="haupt"]')
    const d = w.find('[data-dialog="wkr-korrektur"]')
    expect(d.find('[data-teil="alt"]').text()).toBe('Tor 1 H L: 5')
    expect(d.find('[data-teil="neu"]').text()).toBe('Tor 1 H L: 5 · Tor 3 R L: 5')
    await klick(w, '[data-action="korrektur-ja"]')
    await bis(() => werte(state.value, s4.starter)['t3b|rueck seiteB'] === '5')
    expect(werte(state.value, s4.starter)['t1a|hin seiteB']).toBe('5')
  }, 15_000)

  it('Disq. an der Boje (W4-12, 21.11.2026, BZ1/BZ4): DISQ fragt erst die Boje, der Buchstabe kommt zu den Punkten, die Boje nimmt weiter Tipps; Host „5G“, Zuletzt und Korrektur', async () => {
    const { w, state, zeige } = await torListe()
    const s4 = zeige()
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === s4.startNr)
    const feld = 't3b|rueck seiteB'
    const ort = (f: string) => `[data-action="disq-ort"][data-feld="${f}"]`
    await klick(w, boje(feld))
    expect(haupt(w).text()).toBe('Abschicken · 5 Pkt.')
    // DISQ im Fuß: erst „wo?“ – die Bojen der Klasse in Fahrtfolge, dazu „keine Boje / ganzer Parcours“.
    await klick(w, '[data-action="disq"]')
    expect(w.find('[data-teil="disq-ort"]').attributes('data-schritt')).toBe('wo')
    expect(w.findAll('[data-teil="disq-ort-halt"]').map((h) => h.attributes('data-halt'))).toEqual(['start', 't1a', 't3a', 't5', 't5', 't3b', 'ziel'])
    expect(w.find('[data-action="disq-ort-keine"]').text()).toBe('Keine Boje / ganzer Parcours')
    expect(w.find(ort(feld)).text()).toContain('✔ 5')
    await klick(w, ort(feld))
    // Dann die Buchstaben DIESER Zelle (ohne X – das gilt hier nicht, F5), zweiter Tipp setzt (H1).
    expect(w.find('[data-teil="disq-titel"]').text()).toBe('Disq. an Tor 3 · Rück R L')
    const codes = w.findAll('[data-action="disq-code"]').map((b) => b.attributes('data-code'))
    expect(codes).toContain('G')
    expect(codes).not.toContain('X')
    await klick(w, '[data-action="disq-code"][data-code="G"]')
    await klick(w, '[data-action="disq-code"][data-code="G"]')
    // Zurück bei den Bojen: Punkte UND Buchstabe an der Boje.
    expect(w.find('[data-teil="disq-ort"]').exists()).toBe(false)
    expect(w.find(boje(feld)).attributes('data-disq')).toBe('G')
    expect(w.find(boje(feld)).attributes('data-anzahl')).toBe('1')
    expect(w.find(boje(feld)).find('[data-teil="boje-stand"]').text()).toBe('✔ 5Disq. G')
    expect(haupt(w).text()).toBe('Abschicken · 5 Pkt. · Disq. G')
    // Die Boje nimmt weiter Tipps: Schalter nimmt die Berührung weg, der Buchstabe bleibt (nach dem Prellschutz).
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(Date.now() + WKR_ANNAHMEN.bojenSchalterPrellMs + 100)
    await klick(w, boje(feld))
    expect([w.find(boje(feld)).attributes('data-anzahl'), w.find(boje(feld)).attributes('data-disq')]).toEqual(['0', 'G'])
    expect(haupt(w).text()).toBe('Abschicken · Disq. G')
    // „− letzte zurück“ nimmt die letzte Eingabe (das Wegnehmen der Berührung kennt kein Zurück – die Berührung
    // bleibt weg); danach den Buchstaben.
    await klick(w, '[data-action="zurueck"]')
    expect(w.find(boje(feld)).attributes('data-disq')).toBeUndefined()
    // „Disq. an Boje …“ ist derselbe Einstieg: Boje, Buchstabe – und ein Tipp auf den gesetzten nimmt ihn heraus.
    vi.setSystemTime(Date.now() + WKR_ANNAHMEN.bojenSchalterPrellMs + 100)
    await klick(w, boje(feld))
    await klick(w, '[data-action="boje-disq-modus"]')
    await klick(w, ort(feld))
    await klick(w, '[data-action="disq-code"][data-code="G"]')
    await klick(w, '[data-action="disq-code"][data-code="G"]')
    await klick(w, '[data-action="boje-disq-modus"]')
    expect(w.find(ort(feld)).attributes('data-disq')).toBe('G')
    await klick(w, ort(feld))
    await klick(w, '[data-action="disq-code"][data-code="G"]')
    expect(w.find(boje(feld)).attributes('data-disq')).toBeUndefined()
    expect(w.find(boje(feld)).attributes('data-anzahl')).toBe('1')
    await klick(w, '[data-action="disq"]')
    await klick(w, ort(feld))
    await klick(w, '[data-action="disq-code"][data-code="G"]')
    await klick(w, '[data-action="disq-code"][data-code="G"]')
    await klick(w, '[data-action="haupt"]')
    // Am Host stehen Punkte und Buchstabe in der Bojenzelle – wie abgetippt (sanitizeBuoy), das Disq.-Feld bleibt leer.
    await bis(() => werte(state.value, s4.starter)[feld] === '5G')
    expect(werte(state.value, s4.starter)['disq@gate135'] ?? '').toBe('')
    await zeigt(() => w.find('[data-action="zuletzt"]').exists())
    await klick(w, '[data-action="zuletzt"]')
    expect(w.find('[data-teil="zuletzt-liste"]').text()).toContain('Tor 3 R L: 5G')
    await klick(w, '[data-teil="zuletzt-liste"] [data-action="korrigieren"]')
    expect([w.find(boje(feld)).attributes('data-disq'), w.find(boje(feld)).attributes('data-anzahl')]).toEqual(['G', '1'])
  }, 15_000)

  it('Ansicht „Wie der Parcours liegt“ (Nutzer 21.11.2026, V1/V2): je Tor eine Gruppe, Start oben/unten, Spalten tauschen, gemerkt je Liste; Probe ebenso', async () => {
    const { w, l, speicher } = uebe('dm-2026', 'gate135')
    await nextTick()
    const halte = () => w.findAll('[data-teil="halt"]').map((h) => `${h.attributes('data-halt')}${h.attributes('data-durchfahrt') ?? ''}`)
    const orte = () => w.findAll('[data-teil="ort-kopf"]').map((h) => h.text())
    expect(w.find('[data-teil="bojen"]').attributes('data-folge')).toBe('fahrt')
    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="bojen-folge"][data-folge="lage"]')
    expect(w.find('[data-teil="bojen"]').attributes('data-folge')).toBe('lage')
    expect(w.find('[data-teil="weg-umschalter"]').exists()).toBe(false)
    expect(orte()[0]).toBe('Start / Ziel')
    // Spiegeln: Start unten – dieselben Orte umgekehrt.
    const oben = orte()
    await klick(w, '[data-action="bojen-start"][data-start-oben="false"]')
    expect(orte()).toEqual([...oben].reverse())
    // Tauschen: die linke Boje geht nach rechts (gridColumn).
    const spalte = () => (w.find('[data-action="boje"][data-feld="t1a|hin seiteA"]').element as HTMLElement).style.gridColumn
    expect(spalte()).toBe('1')
    await klick(w, '[data-action="bojen-tauschen"]')
    expect(spalte()).toBe('2')
    // Gemerkt je Gerät und Liste (ablage.ts `bojen[liste]`).
    expect(ansichtIn(speicher).bojen).toEqual({ [l]: { folge: 'lage', startOben: false, tauschen: true } })
    await klick(w, '[data-action="bojen-start"][data-start-oben="true"]')
    // Probe (Klasse 7) in derselben Ansicht: Tor 1 einmal mit Hin, Rück und 2. Durchfahrt, Sp. 2 hinter Tor 5,
    // ohne Umschalter und darum ohne den Rückweg-Schritt.
    await klick(w, '[data-action="probe"]')
    expect(w.find('[data-teil="karte"] [data-teil="klasse"]').text()).toBe('Klasse 7')
    expect(orte()).toEqual(['Start / Ziel', 'Tor 1', 'Tor 3', 'Tor 5', 'Sp. 2'])
    expect(halte()).toEqual(['start', 'ziel', 't1a', 't1b', 't1c2', 't3a', 't3b', 't5', 't5', 'speed2'])
    expect(['t1a', 't1b'].map((h) => w.find(`[data-halt="${h}"] [data-teil="halt-titel"]`).text())).toEqual(['Hin', 'Rück'])
    expect(w.find('[data-halt="start"] [data-teil="halt-titel"]').text()).toBe('Start')
    expect(w.find('[data-teil="weg-umschalter"]').exists()).toBe(false)
    expect(w.find('[data-teil="probe-schritt"]').text()).toContain('von 5')
  })

  it('Bojen-Ansicht: die geänderte Liste rückt ans Ende – bei mehr als 8 fällt die am längsten nicht geänderte (Prüfbefund 21.11.2026)', async () => {
    const speicher = handy()
    const q0 = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'gate135', taktMs: 3_600_000, folgeMs: SOFORT })
    const l = q0.listen.value[0].liste
    quellen.push(q0)
    const fahrt = { folge: 'fahrt', startOben: true, tauschen: false }
    const andere = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`andere${i}`, fahrt]))
    speicher.setItem('alcatraz.geraet.ansicht', JSON.stringify({ modus: 'sonne', hand: 'rechts', bojen: { [l]: fahrt, ...andere } }))
    const { w } = uebe('dm-2026', 'gate135', speicher)
    await nextTick()
    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="bojen-folge"][data-folge="lage"]')
    expect(Object.keys(ansichtIn(speicher).bojen)).toEqual([...Object.keys(andere), l])
  })

  it('Doppeltipp in der Sperre wirkt nicht (Fake-Uhr, Übung Tor 1/3/5)', async () => {
    vi.useFakeTimers()
    const { q, w } = uebe('dm-2026', 'gate135')
    await nextTick()
    const erste = startNr(w)
    const knopf = () => w.find('[data-action="boje"]')
    const feld = knopf().attributes('data-feld')
    await klick(w, '[data-action="haupt"]')
    await knopf().trigger('click')
    await nextTick()
    expect(q.zuletzt.value).toHaveLength(1)
    expect(Object.values(q.zuletzt.value[0].zellen).join('')).toBe('')
    await vi.advanceTimersByTimeAsync(BIS_WECHSEL)
    await nextTick()
    expect(w.find('[data-teil="maske"]').attributes('data-takt')).toBe('sperre')
    expect(startNr(w)).not.toBe(erste)
    await w.find(`[data-action="boje"][data-feld="${feld}"]`).trigger('click')
    await nextTick()
    expect(w.find(`[data-action="boje"][data-feld="${feld}"]`).attributes('data-anzahl')).toBe('0')
    await vi.advanceTimersByTimeAsync(WKR_ANNAHMEN.sperreMs)
    await nextTick()
    await w.find(`[data-action="boje"][data-feld="${feld}"]`).trigger('click')
    await nextTick()
    expect(w.find(`[data-action="boje"][data-feld="${feld}"]`).attributes('data-anzahl')).toBe('1')
  })

  it('Probe: Boje, zurück, Tor 5 zweimal, Rückweg, Disq. an Boje, Abschicken – nichts gesendet (Übung Tor 1/3/5, Klasse 7)', async () => {
    vi.useFakeTimers()
    const { q, w } = uebe('dm-2026', 'gate135')
    await nextTick()
    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="probe"]')
    const probe = () => w.find('[data-teil="probe"]')
    expect(w.find('[data-teil="karte"] [data-teil="klasse"]').text()).toBe('Klasse 7')
    expect(probe().attributes('data-schritt')).toBe('boje')
    expect(w.find('[data-teil="probe-schritt"]').text()).toBe('Schritt 1 von 6: Tippe bei „Tor 1“ den Knopf „H R“ an.')
    await klick(w, boje('t1a|hin seiteA'))
    expect(probe().attributes('data-schritt')).toBe('zurueck')
    await klick(w, '[data-action="zurueck"]')
    expect(probe().attributes('data-schritt')).toBe('zaehler')
    expect(w.find('[data-teil="probe-schritt"]').text()).toContain('zweimal auf „H R“ – das zählt 2 Berührungen (10)')
    await klick(w, boje('t5|hin seiteA'))
    expect(probe().attributes('data-schritt')).toBe('zaehler')
    await klick(w, boje('t5|hin seiteA'))
    expect(probe().attributes('data-schritt')).toBe('rueckweg')
    await klick(w, '[data-action="weg"][data-weg="rueck"]')
    // U4 (Nutzer 21.11.2026): Disq. an der Boje – rechter Knopf der ersten zweibojigen Zeile, erster Buchstabe. Mit
    // Umschalter auf der offenen Seite (Rückweg; Prüfbefund 21.11.2026) – die Anweisung genügt, kein Seitenwechsel.
    expect(probe().attributes('data-schritt')).toBe('bojeDisq')
    // Seit W4-12 (21.11.2026) mit Punkt UND Buchstabe: Berührung, „Disq. an Boje …“, Ort, Buchstabe.
    expect(w.find('[data-teil="probe-schritt"]').text()).toContain('Tippe bei „Tor 3“ auf „R L“ (Berührung)')
    await klick(w, boje('t3b|rueck seiteB'))
    expect(probe().attributes('data-schritt')).toBe('bojeDisq')
    await klick(w, '[data-action="boje-disq-modus"]')
    await klick(w, '[data-action="disq-ort"][data-feld="t3b|rueck seiteB"]')
    await klick(w, '[data-action="disq-code"][data-code="A"]')
    await klick(w, '[data-action="disq-code"][data-code="A"]')
    expect(probe().attributes('data-schritt')).toBe('haupt')
    expect(w.find(boje('t3b|rueck seiteB')).attributes('data-disq')).toBe('A')
    expect(haupt(w).text()).toBe('Abschicken · 15 Pkt. · Disq. A')
    await klick(w, '[data-action="haupt"]')
    await vi.advanceTimersByTimeAsync(BIS_WECHSEL + WKR_ANNAHMEN.sperreMs)
    await nextTick()
    expect(probe().attributes('data-schritt')).toBe('fertig')
    await klick(w, '[data-action="probe-fertig"]')
    expect(q.zuletzt.value).toHaveLength(0)
    expect(q.entwuerfe.value).toHaveLength(0)
  })

  it('Übung: Tor 1/3/5, Tor 2/4/5, Parcours mit Start/Ziel; Parallelslalom nur unter UIM', async () => {
    const w = mount(WkrUebung, { attachTo: document.body, props: { ablage: handy(), taktMs: 3_600_000 } })
    wrappers.push(w)
    const listen = () => w.findAll('[data-action="uebung-liste"]').map((b) => b.attributes('data-liste'))
    expect(listen()).toEqual(expect.arrayContaining(['gate135', 'gate245', 'parcoursms']))
    expect(listen()).not.toContain('parallel')
    await klick(w, '[data-action="uebung-regelwerk"][data-regelwerk="uim-2026"]')
    expect(w.find('[data-action="uebung-liste"][data-liste="parallel"]').text()).toBe('Parallelslalom, Racecourse A')
    await klick(w, '[data-action="uebung-liste"][data-liste="parallel"]')
    // Zurück zu DM: Der Parallelslalom fällt weg, die Wahl springt auf Tor 5.
    await klick(w, '[data-action="uebung-regelwerk"][data-regelwerk="dm-2026"]')
    expect(listen()).not.toContain('parallel')
    expect(w.find('[data-action="uebung-liste"][data-liste="tor5"]').attributes('aria-pressed')).toBe('true')
    await klick(w, '[data-action="uebung-liste"][data-liste="gate135"]')
    await klick(w, '[data-action="uebung-start"]')
    expect(w.find('[data-teil="bojen"]').exists()).toBe(true)
    expect(w.find('[data-teil="wkr-kopf"] [data-teil="titel"]').text()).toContain('Tor 1 / 3 / 5')
    expect(w.find('[data-teil="probe"]').exists()).toBe(false)
  })

  it('Übung (Nutzer 21.11.2026, W3-15, GF4): Erklärung oben, zuklappbar und gemerkt; „Übung beenden“ unter den Knöpfen führt zur Wahl zurück', async () => {
    const speicher = handy()
    const w = mount(WkrUebung, { attachTo: document.body, props: { ablage: speicher, taktMs: 3_600_000 } })
    wrappers.push(w)
    await klick(w, '[data-action="uebung-start"]')
    const erklaerung = () => w.find<HTMLDetailsElement>('[data-teil="uebung-erklaerung"]')
    expect(erklaerung().element.open).toBe(true)
    expect(erklaerung().text()).toContain(`Starts 1–${WKR_ANNAHMEN.uebungStarts} ohne Namen`)
    expect(erklaerung().text()).toContain('Rückfrage')
    erklaerung().element.open = false
    await erklaerung().trigger('toggle')
    expect(ansichtIn(speicher).uebungErklaerungZu).toBe(true)
    // Ein Tipp, dann beenden: zurück zur Wahl, die Maske samt Entwurf ist weg.
    await zeigt(() => w.find('[data-action="code"]').exists())
    await klick(w, '[data-action="code"]')
    expect(w.findAll('[data-action="code"]').some((b) => Number(b.attributes('data-anzahl')) > 0)).toBe(true)
    expect(w.find('[data-teil="uebung-ende-unten"] [data-action="uebung-beenden"]').exists()).toBe(true)
    await klick(w, '[data-action="uebung-beenden"]')
    expect(w.find('[data-teil="uebung-wahl"]').exists()).toBe(true)
    expect(w.find('[data-teil="wkr-geraet"]').exists()).toBe(false)
    // Neu begonnen: ohne Entwurf, die Erklärung bleibt zu.
    await klick(w, '[data-action="uebung-start"]')
    expect(erklaerung().element.open).toBe(false)
    await zeigt(() => w.find('[data-action="code"]').exists())
    expect(w.findAll('[data-action="code"]').every((b) => !(Number(b.attributes('data-anzahl')) > 0))).toBe(true)
  })

  it('UIM Parallelslalom Racecourse A: Buoy 1 → „parallel:…“ am Host, Seite A', async () => {
    setLocale('en')
    const start = reducer(uimParallelStand(), { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre', zeit: 500 })
    const r = await bedienrechner(start, 'parallel')
    const A = listenKennung({ bereich: 'parallel', typeId: 'parallelparcours', racecourse: 'A' })
    const { w } = await mitCode(r.h, [{ art: 'liste', liste: A }])
    await bis(() => r.state.value.wkr.listen[A]?.modus === 'digital')
    // Den ersten Start zeigen, in dem auf Seite A jemand fährt.
    let paar: { a: string | null } | undefined
    for (let i = 0; i < 10 && !paar?.a; i++) {
      r.zeige()
      paar = lage(r.state.value, 'parallel').aktuell!.eintrag!.paar ?? undefined
    }
    const nr = r.state.value.starters.find((x) => x.id === paar!.a)!.startNr
    await zeigt(() => w.find('[data-teil="karte"]').exists() && startNr(w) === nr)
    expect(w.findAll('[data-teil="halt-titel"]').map((h) => h.text())).toEqual(['Start', 'Buoy 1', 'Buoy 2', 'Buoy 3', 'Buoy 4', 'Buoy 5'])
    expect(w.find(boje('b1a')).text()).toBe('Touched')
    await klick(w, boje('b1a'))
    expect(w.find(boje('b1a')).text()).toBe('Touched✔ 5')
    await klick(w, '[data-action="haupt"]')
    const lauf = () => Object.keys(r.state.value.eingaben).find((l) => r.state.value.eingaben[l]?.[paar!.a!]?.['b1a'] === '5')
    await bis(() => !!lauf())
    expect(lauf()).toMatch(/^parallel:[^/]+\/\d+$/)
    expect(r.state.value.eingaben[lauf()!][paar!.a!]['erfasst@parallelparcours']).toBeTruthy()
  }, 20_000)
})

// W4.3 (Plan docs/plan-wkr-w4.md §6, 21.11.2026, P16, R1–R6): „Nicht vorbeigekommen“ unter „Mehr“.
describe('„Nicht vorbeigekommen“ (W4.3)', () => {
  const nvMehr = async (w: VueWrapper) => {
    await klick(w, '[data-action="mehr"]')
    return w.find('[data-action="nicht-vorbei"]')
  }

  // W3-17 (Nutzer 21.11.2026, GF10): Wo die Liste J kennt (Tor 5: Bereich parcours), ist es Disq. J – eine gewöhnliche
  // Zeile mit Haken, kein Kennzeichen ⊘. Das Kennzeichen bleibt nur, wo J fehlt (Steg-Anlegen, Test unten).
  it('Mehr → große Rückfrage → Disq. J ins Disq.-Feld mit Haken, kein ⊘; der getippte Entwurf ist verworfen', async () => {
    const { w, state, s, l } = await listeMitStart('tor5')
    await klick(w, '[data-action="code"][data-code="1"]')
    const knopf = await nvMehr(w)
    expect(knopf.text()).toBe('Nicht vorbeigekommen · Disq. J')
    await knopf.trigger('click')
    await nextTick()
    const d = w.find('[data-dialog="wkr-nicht-vorbei"]')
    expect(d.text()).toContain(`${s.startNr} ist hier nicht vorbeigekommen?`)
    expect(d.text()).toContain('Eingetragen wird Disq. J')
    // Abbrechen ändert nichts.
    await klick(w, '[data-action="nicht-vorbei-nein"]')
    expect(w.find('[data-dialog="wkr-nicht-vorbei"]').exists()).toBe(false)
    expect(startNr(w)).toBe(s.startNr)
    await klick(w, '[data-action="nicht-vorbei"]')
    await klick(w, '[data-action="nicht-vorbei-ja"]')
    // Overlay wie beim Abschicken (N1).
    expect(w.find('[data-teil="uebertragen"]').exists()).toBe(true)
    await bis(() => werte(state.value, s.starter)['erfasst@tor5'] === '1')
    expect(werte(state.value, s.starter)).toMatchObject({ 'disq@tor5': 'J', 'erfasst@tor5': '1' })
    expect(werte(state.value, s.starter)['katalog:tor5'] ?? '').toBe('')
    expect(state.value.wkr.nichtVorbei[l]).toBeUndefined()
    await zeigt(() => w.find('[data-action="zuletzt"]').exists())
    expect(w.find('[data-teil="entwuerfe"]').exists()).toBe(false)
    expect(w.html()).not.toMatch(NAMEN)
  }, 12_000)

  it('Korrektur einer J-Zeile auf „fehlerfrei“ nimmt das J am Bedienrechner wieder heraus', async () => {
    const { w, state, s } = await listeMitStart('tor5')
    await (await nvMehr(w)).trigger('click')
    await nextTick()
    await klick(w, '[data-action="nicht-vorbei-ja"]')
    await bis(() => werte(state.value, s.starter)['disq@tor5'] === 'J')
    await zeigt(() => w.find('[data-action="zuletzt"]').exists() && taktFrei(w))
    await klick(w, '[data-action="zuletzt"]')
    await klick(w, '[data-teil="zuletzt-liste"] [data-action="korrigieren"]')
    expect(w.find('[data-action="nicht-vorbei"]').exists()).toBe(false)
    // J steht im Entwurf der Korrektur (aus dem eigenen Stand, M2) – herausnehmen ist ein Tipp.
    await klick(w, '[data-action="disq"]')
    await klick(w, '[data-action="disq-code"][data-code="J"]')
    await klick(w, '[data-action="haupt"]')
    await klick(w, '[data-action="korrektur-ja"]')
    await bis(() => (werte(state.value, s.starter)['disq@tor5'] ?? '') === '')
    expect(werte(state.value, s.starter)['erfasst@tor5']).toBe('1')
  }, 12_000)

  it('nicht am Vorsteg; am Steg nur im Reiter „Anlegen“ (dort X, F5)', async () => {
    const r = await bedienrechner()
    const { w } = await mitCode(r.h, [{ art: 'liste', liste: VORSTEG }])
    await bis(() => r.state.value.wkr.listen[VORSTEG]?.modus === 'digital')
    await zeigt(() => w.find('[data-teil="karte"]').exists())
    expect((await nvMehr(w)).exists()).toBe(false)

    const st = await listeMitStart('steg')
    expect((await nvMehr(st.w)).exists()).toBe(false)
    await klick(st.w, '[data-action="mehr"]')
    // Anlegen nachlaufend (T2) und auf dem ganzen Steg nach dem Ablegen (T3): erst ablegen, dann der nächste Start.
    await klick(st.w, '[data-action="haupt"]')
    await bis(() => !!werte(st.state.value, st.s.starter)['erfasst.ab@steg'])
    await zeigt(() => taktFrei(st.w))
    st.zeige()
    await klick(st.w, '[data-action="steg-teil"][data-steg="an"]')
    await zeigt(() => st.w.find('[data-teil="karte"]').exists() && startNr(st.w) === st.s.startNr)
    const knopf = await nvMehr(st.w)
    expect(knopf.exists()).toBe(true)
    await knopf.trigger('click')
    await nextTick()
    await klick(st.w, '[data-action="nicht-vorbei-ja"]')
    await bis(() => st.state.value.wkr.nichtVorbei[st.l]?.length === 1)
    expect(st.state.value.wkr.nichtVorbei[st.l][0]).toMatch(/\|an$/)
    expect(werte(st.state.value, st.s.starter)).toMatchObject({ 'erfasst.ab@steg': '1', 'erfasst@steg': '1' })
    expect(werte(st.state.value, st.s.starter)['katalog:stegAnlegen'] ?? '').toBe('')
  }, 20_000)
})
