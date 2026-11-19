import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { starteGeraeteHost, type GeraeteHost } from './host'
import { oeffneLeseLink, type LeseGeraet, type LeseUmgebung } from './geraet'
import { ABLAGE, SICHT_GUELTIG_MS, type Ablage } from './ablage'
import { liesLeseLink, packeLesePaket, PAKET_FASSUNG } from './paket'
import { nachgebauterBrowser } from './testBrowser'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, ruhe, SERVER, type NachgebautesNtfy } from './transport/ntfy/testNtfy'
import { canonicalJson, fromBase64Url, toBase64Url } from './transport/ntfy/codec'
import { openGruppe, parseHostWire } from './transport/ntfy/wire'
import { geraeteThemaVon, hostSpeicherImSpeicher, lesePaket, neuerRaum, type HostRaum } from './transport/ntfy/raum'
import { HostTransport } from './transport/ntfy/transport'
import type { NtfyZeiten } from './transport/ntfy/leitung'
import type { Json, Op } from './transport/ntfy/patch'
import { OEFFENTLICH, ZUSCHAUER } from './transport/protokoll'
import nacl from 'tweetnacl'
import { reducer, type Action } from '../state/reducer'
import { SICHT_FASSUNG, sichtOeffentlich, sichtZuschauer } from '../betrieb/sicht'
import { laufSchluessel } from '../lib/eingaben'
import { betriebsStand, festgeschrieben, parallelStarter, testLogo, TEST_PNG_2X1, zeigeNaechsten } from '../testHilfen'
import type { AppState, ClassId } from '../types'

/**
 * Ende zu Ende (E6): Bedienrechner (geraete/host.ts, nachgebauter Browser) → nachgebauter ntfy (testNtfy.ts, kein Netz)
 * → Handys mit Lese-Link (geraete/geraet.ts, eigener Speicher je Handy). Alle Starter sind erfunden
 * (Vor<klasse><n>/Nach<klasse><n>, Musterclub); Geburtsdatum, Gewicht, Geschlecht und Werte nur, um zu zeigen, dass
 * sie die Leitung nie erreichen.
 */

const SCHNELL: Partial<NtfyZeiten> = { abstandMs: 0, wiederholenMs: [20], zuVieleMs: 30, neuVerbindenMs: [10], quittungMs: 150, einstiegAbstandMs: 0 }
const KENNUNG = 'MUSTERK1'
const GEHEIM = '2014-02-03'
const WERT = '83.4'
const GEWICHT = 41.7

let ntfy: NachgebautesNtfy
const hosts: GeraeteHost[] = []
const geraete: LeseGeraet[] = []

beforeEach(() => {
  ntfy = neuesNtfy()
  vi.stubGlobal('WebSocket', NachgebauterSocket)
  vi.stubGlobal('fetch', nachgebautesFetch)
})

afterEach(() => {
  for (const g of geraete.splice(0)) g.stop()
  for (const h of hosts.splice(0)) h.stop()
  vi.unstubAllGlobals()
})

const json = (x: unknown) => JSON.parse(JSON.stringify(x)) as Json
const gleich = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b)

/**
 * Ein Betrieb mit 48 Startern (je Klasse 6) – mit Geburtsdatum, Gewicht, Geschlecht, einem Wert, einer Abmeldung und
 * einem Logo an der Anzeigetafel: alles, was nie hinausgehen darf. Lauf 1 auf dem ersten Parcours begonnen, ein Start
 * gezeigt.
 */
function grosserStand(): { stand: AppState; bereich: string } {
  const klassen: ClassId[] = ['E', '1', '2', '3', '4', '5', '6', '7']
  const starter = klassen.flatMap((k) => parallelStarter(k, 6)).map((p) => ({ ...p, geburtsdatum: GEHEIM, gewicht: GEWICHT, geschlecht: 'F' as const }))
  let s = festgeschrieben(betriebsStand(starter))
  const bereich = sichtOeffentlich(s).bereiche[0].id
  s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich, punkt: 'lauf:1', zeit: 500 })
  s = zeigeNaechsten(s, bereich, 1000)
  s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'E-1', feld: 'zeit1', wert: WERT }], zeit: 1500 })
  s = reducer(s, { type: 'SET_LOGO', seite: 'links', logo: testLogo() })
  return { stand: { ...s, abgemeldet: ['7-6'], kennung: KENNUNG, geraeteServer: SERVER }, bereich }
}

function store(anfang: AppState) {
  const state = shallowRef(anfang)
  let uhr = 10_000
  return {
    state,
    dispatch(action: Action) {
      uhr += 1000
      state.value = reducer(state.value, { ...action, zeit: action.zeit ?? uhr } as Action)
    },
  }
}

/** Ein Bedienrechner mit geöffnetem Raum, verbunden. */
async function bedienrechner(mehr: Parameters<typeof starteGeraeteHost>[1] = {}) {
  const { stand, bereich } = grosserStand()
  const b = nachgebauterBrowser()
  const f = b.fenster()
  const s = store(stand)
  const h = starteGeraeteHost(s, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, sammelnMs: 0, endeWartenMs: 2000, ...mehr })
  hosts.push(h)
  const info = h.oeffne()
  await bis(() => h.verbindung.value?.status === 'verbunden')
  const raum = (): HostRaum => JSON.parse(f.ablage.getItem(ABLAGE.raum)!).raum as HostRaum
  return { b, f, s, h, info, bereich, raum }
}

/** Der Speicher eines Handys – eigener Browser, eigener localStorage. */
function handy(): Ablage & { daten: Map<string, string> } {
  const daten = new Map<string, string>()
  return { daten, getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => void daten.set(k, String(v)), removeItem: (k) => void daten.delete(k) }
}

function lese(link: string, speicher: Ablage = handy(), mehr: LeseUmgebung = {}): LeseGeraet {
  const r = oeffneLeseLink(link, { ablage: speicher, zeiten: SCHNELL, ablaufTaktMs: 20, ...mehr })
  if (!r.ok) throw new Error(`Link: ${r.code}`)
  geraete.push(r.geraet)
  return r.geraet
}

const tafelSicht = (s: AppState) => json(sichtOeffentlich(s, { logos: false }))
const zuschauerSicht = (s: AppState) => json(sichtZuschauer(sichtOeffentlich(s, { logos: false })))

describe('Bedienrechner → ntfy → Handy', () => {
  it('eine Änderung am Bedienrechner steht auf Anzeigetafel und Zuschauer-Handy – ohne Logos, mit Fingerabdruck', async () => {
    const { s, info, bereich } = await bedienrechner()
    const tafel = lese(info.anzeige)
    const zuschauer = lese(info.zuschauer)
    expect([tafel.art, zuschauer.art]).toEqual(['anzeige', 'zuschauer'])
    expect([tafel.fingerabdruck, zuschauer.fingerabdruck]).toEqual([info.fingerabdruck, info.fingerabdruck])
    await tafel.start()
    await zuschauer.start()
    await bis(() => gleich(tafel.anzeige.value, tafelSicht(s.state.value)) && gleich(zuschauer.zuschauer.value, zuschauerSicht(s.state.value)))
    expect(tafel.anzeige.value!.logos).toBeUndefined()
    expect(sichtOeffentlich(s.state.value).logos).toBeDefined()
    // Jedes Handy nur seine Sicht.
    expect(tafel.zuschauer.value).toBeNull()
    expect(zuschauer.anzeige.value).toBeNull()

    s.state.value = zeigeNaechsten(s.state.value, bereich, 99_000)
    await bis(() => gleich(tafel.anzeige.value, tafelSicht(s.state.value)) && gleich(zuschauer.zuschauer.value, zuschauerSicht(s.state.value)))
    s.dispatch({ type: 'BETRIEB_MELDUNG', bereich: '*', meldung: { text: 'Kurze Pause', art: 'pause' } })
    await bis(() => tafel.anzeige.value?.bereiche[0].meldung?.text === 'Kurze Pause' && zuschauer.zuschauer.value?.bereiche[0].meldung?.text === 'Kurze Pause')
    // Eine Eingabe, die die Sicht nicht ändert, schickt nichts.
    const zahl = ntfy.gespeichert.length
    s.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'E-2', feld: 'zeit1', wert: '91.2' }] })
    await ruhe()
    expect(ntfy.gespeichert.length).toBe(zahl)
  })

  it('Leitung: nur oA und oZ, alles verschlüsselt; entschlüsselt kein Stand, kein Geburtsdatum, Gewicht, Geschlecht, Wert, Abmeldung, Logo', async () => {
    const { s, info, bereich, raum } = await bedienrechner()
    const tafel = lese(info.anzeige)
    await tafel.start()
    s.state.value = zeigeNaechsten(s.state.value, bereich, 99_000)
    s.dispatch({ type: 'BETRIEB_MELDUNG', bereich: '*', meldung: { text: 'Kurze Pause', art: 'pause' } })
    await bis(() => tafel.anzeige.value?.bereiche[0].meldung?.text === 'Kurze Pause')
    const r = raum()

    // Nur die beiden öffentlichen Themen – g, d·, k· gibt es im Lese-Betrieb gar nicht.
    expect(new Set(ntfy.gespeichert.map((g) => g.topic))).toEqual(new Set([r.oeffentlich.a, r.oeffentlich.z]))
    // Roh auf der Leitung: nichts im Klartext.
    const roh = ntfy.gespeichert.map((g) => g.body).join('\n')
    for (const verboten of [GEHEIM, WERT, String(GEWICHT), 'VorE1', 'NachE1', 'Musterclub', 'Kurze Pause', TEST_PNG_2X1.slice(30, 60), r.geheimnis, r.box.sk, r.sign.sk, geraeteThemaVon(r), KENNUNG]) {
      expect(roh, verboten).not.toContain(verboten)
    }

    // Entschlüsselt: alle Schlüssel aller Inhalte (Vollstände, Differenzen, Meldungen).
    const inhalte = async (thema: string, gruppe: string) => {
      const aus: unknown[] = []
      for (const body of ntfy.bodies(thema)) {
        const w = parseHostWire(body)
        if (!w || w.l) continue
        expect(w.g).toBe(gruppe)
        const inhalt = await openGruppe(w, fromBase64Url(r.gruppen[gruppe].k)!)
        expect(inhalt).not.toBeNull()
        aus.push(inhalt)
      }
      return aus
    }
    const schluessel = (wert: unknown, out = new Set<string>()): Set<string> => {
      if (Array.isArray(wert)) wert.forEach((x) => schluessel(x, out))
      else if (wert && typeof wert === 'object')
        for (const [k, v] of Object.entries(wert)) {
          out.add(k)
          // Pfade der Differenzen nennen Schlüssel als Text.
          if (k === 'p' && Array.isArray(v)) for (const teil of v as Op['p']) if (typeof teil === 'string') out.add(teil)
          schluessel(v, out)
        }
      return out
    }
    const tafelInhalte = await inhalte(r.oeffentlich.a, OEFFENTLICH)
    const zuschauerInhalte = await inhalte(r.oeffentlich.z, ZUSCHAUER)
    expect(tafelInhalte.some((i) => 'patch' in (i as object))).toBe(true)
    const verbotenUeberall = ['geburtsdatum', 'gewicht', 'geschlecht', 'groesse', 'eingaben', 'abgemeldet', 'abgemeldetBis', 'starters', 'parcoursList', 'betrieb', 'anzeige', 'logos', 'kennung', 'geheimnis', 'einteilung', 'coPiloten', 'vorname', 'nachname', 'geraeteServer']
    for (const [inhalte_, mehr] of [
      [tafelInhalte, []],
      // Die Zuschauer bekommen keine Bedienangaben (BETRIEB_ANNAHMEN.zuschauerSchmal).
      [zuschauerInhalte, ['veranstaltung', 'waehlbar', 'einstieg', 'programm', 'zurueckgestellt', 'nachzuholen', 'auswahl', 'klassenFolge', 'offen']],
    ] as const) {
      const alle = schluessel(inhalte_)
      for (const verboten of [...verbotenUeberall, ...mehr]) expect(alle.has(verboten), verboten).toBe(false)
      const text = JSON.stringify(inhalte_)
      for (const verboten of [GEHEIM, WERT, String(GEWICHT), TEST_PNG_2X1.slice(30, 60), r.geheimnis]) expect(text, verboten).not.toContain(verboten)
    }
    // Der Schlüssel des einen Links öffnet die Nachrichten des anderen nicht.
    const w = parseHostWire(ntfy.bodies(r.oeffentlich.a).find((b) => !parseHostWire(b)!.l)!)!
    expect(await openGruppe(w, fromBase64Url(r.gruppen[ZUSCHAUER].k)!)).toBeNull()
  })

  it('„Zuschauer-Link erneuern“: neuer Link zeigt sofort, der alte nichts mehr, die Anzeigetafel merkt nichts', async () => {
    const { s, h, info, bereich, raum } = await bedienrechner()
    const tafel = lese(info.anzeige)
    const alt = lese(info.zuschauer)
    await tafel.start()
    await alt.start()
    await bis(() => tafel.anzeige.value !== null && alt.zuschauer.value !== null)
    const tafelThema = raum().oeffentlich.a
    const tafelNachrichten = ntfy.bodies(tafelThema).length
    const tafelAbrufe = ntfy.abrufe.filter((u) => u.includes(tafelThema)).length

    h.erneuereZuschauer()
    await bis(() => h.raum.value!.zuschauer !== info.zuschauer)
    expect(h.raum.value!.anzeige).toBe(info.anzeige)
    const neu = lese(h.raum.value!.zuschauer)
    await neu.start()
    await bis(() => gleich(neu.zuschauer.value, zuschauerSicht(s.state.value)))
    // Vom Erneuern selbst nichts an die Anzeigetafel – weder eine Nachricht noch ein neuer Abruf.
    expect(ntfy.bodies(tafelThema)).toHaveLength(tafelNachrichten)
    expect(ntfy.abrufe.filter((u) => u.includes(tafelThema))).toHaveLength(tafelAbrufe)

    const altStand = alt.zuschauer.value
    s.state.value = zeigeNaechsten(s.state.value, bereich, 99_000)
    await bis(() => gleich(tafel.anzeige.value, tafelSicht(s.state.value)) && gleich(neu.zuschauer.value, zuschauerSicht(s.state.value)))
    await ruhe()
    expect(alt.zuschauer.value).toEqual(altStand)
  })

  it('Neuladen von Host und Gerät: die Tafel steht sofort wieder da und folgt weiter, ohne neu zu laden', async () => {
    const { b, s, h, info, bereich } = await bedienrechner()
    const speicher = handy()
    const t1 = lese(info.anzeige, speicher)
    await t1.start()
    await bis(() => gleich(t1.anzeige.value, tafelSicht(s.state.value)))
    t1.stop()

    // Gerät neu geladen: gleich die abgelegte Sicht, noch vor jeder Verbindung.
    const t2 = lese(info.anzeige, speicher)
    expect(gleich(t2.anzeige.value, tafelSicht(s.state.value))).toBe(true)
    await t2.start()

    // Bedienrechner neu geladen (neues Fenster, derselbe Browser): derselbe Raum, das Gerät folgt.
    h.stop()
    const f = b.fenster()
    const h2 = starteGeraeteHost(s, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, sammelnMs: 0 })
    hosts.push(h2)
    expect(h2.raum.value).toEqual(info)
    await bis(() => h2.verbindung.value?.status === 'verbunden')
    s.state.value = zeigeNaechsten(s.state.value, bereich, 99_000)
    await bis(() => gleich(t2.anzeige.value, tafelSicht(s.state.value)))
    expect(t2.fassung.value).toBeNull()
  })

  it('Ablauf: 36 h nach der letzten Nachricht ist die Sicht weg – auf dem Bildschirm und im Speicher (K20)', async () => {
    const { h, info } = await bedienrechner()
    const speicher = handy()
    let jetzt = Date.now()
    const t = lese(info.anzeige, speicher, { uhr: () => jetzt })
    await t.start()
    await bis(() => t.anzeige.value !== null)
    expect(speicher.daten.has(ABLAGE.sicht)).toBe(true)
    // Der Bedienrechner ist weg (Feierabend, ohne „Raum beenden“).
    h.stop()
    jetzt += SICHT_GUELTIG_MS - 60_000
    await ruhe(60)
    expect(t.anzeige.value).not.toBeNull()
    jetzt += 120_000
    await bis(() => t.anzeige.value === null)
    expect(speicher.daten.has(ABLAGE.sicht)).toBe(false)
    // Auch nach dem Neuladen bleibt sie weg.
    expect(lese(info.anzeige, speicher, { uhr: () => jetzt }).anzeige.value).toBeNull()
  })

  it('Raum beenden: signiert an beide Links – die Handys löschen Sicht und Verbindung; ein später geöffneter Link auch', async () => {
    const { h, info } = await bedienrechner()
    const s1 = handy()
    const s2 = handy()
    const tafel = lese(info.anzeige, s1)
    const zuschauer = lese(info.zuschauer, s2)
    await tafel.start()
    await zuschauer.start()
    await bis(() => tafel.anzeige.value !== null && zuschauer.zuschauer.value !== null)
    expect(await h.beende()).toBe('gemeldet')
    expect(h.raum.value).toBeNull()
    await bis(() => tafel.beendet.value && zuschauer.beendet.value)
    expect([tafel.anzeige.value, zuschauer.zuschauer.value]).toEqual([null, null])
    for (const sp of [s1, s2]) expect([...sp.daten.keys()].filter((k) => k === ABLAGE.sicht || k === ABLAGE.verbindung)).toEqual([])
    // Wer den Link danach öffnet, erfährt es auch (aus der Abfrage) – statt auf ewig zu warten.
    const spaet = lese(info.zuschauer)
    await spaet.start()
    await bis(() => spaet.beendet.value)
    expect(spaet.zuschauer.value).toBeNull()
  })

  it('Raum verlassen: nichts mehr empfangen, Verbindung und Sicht auf dem Handy gelöscht', async () => {
    const { s, info, bereich } = await bedienrechner()
    const speicher = handy()
    const t = lese(info.anzeige, speicher)
    await t.start()
    await bis(() => t.anzeige.value !== null)
    t.verlasse()
    expect(t.anzeige.value).toBeNull()
    expect(t.status.value).toBe('aus')
    expect(speicher.daten.has(ABLAGE.sicht) || speicher.daten.has(ABLAGE.verbindung)).toBe(false)
    s.state.value = zeigeNaechsten(s.state.value, bereich, 99_000)
    await ruhe()
    expect(t.anzeige.value).toBeNull()
  })

  it('Uhrversatz aus hz – nur aus frisch Empfangenem, nicht aus der Abfrage beim Einstieg', async () => {
    const { s, info, bereich } = await bedienrechner({ uhr: () => Date.now() + 90_000 })
    await bis(() => ntfy.gespeichert.length >= 2)
    const t = lese(info.anzeige)
    await t.start()
    await bis(() => t.anzeige.value !== null)
    // Der erste Stand kam aus der Abfrage – er kann eine Stunde alt sein und zählt nicht.
    expect(t.versatz.value).toBe(0)
    s.state.value = zeigeNaechsten(s.state.value, bereich, 99_000)
    await bis(() => t.versatz.value !== 0)
    expect(t.versatz.value).toBeGreaterThan(85_000)
    expect(t.versatz.value).toBeLessThanOrEqual(90_000)
    expect(t.hostZeit(1000)).toBe(1000 + t.versatz.value)
  })

  it('Raum eines anderen Links: Abgelegtes des alten Raums wird weggeräumt', async () => {
    const { s, info } = await bedienrechner()
    const speicher = handy()
    const t = lese(info.anzeige, speicher)
    await t.start()
    await bis(() => gleich(t.anzeige.value, tafelSicht(s.state.value)))
    t.stop()
    const anderer = packeLesePaket(lesePaket(neuerRaum(SERVER), 'a'))
    const u = lese(anderer, speicher)
    expect(u.anzeige.value).toBeNull()
    expect(speicher.daten.has(ABLAGE.sicht)).toBe(false)
    expect(speicher.daten.has(ABLAGE.verbindung)).toBe(false)
  })

  it('Logos nimmt ein Gerät nie an – auch nicht, wenn ein Host sie schickte; Unbrauchbares zeigt es nicht', async () => {
    const raum = neuerRaum(SERVER)
    const t = new HostTransport({ server: SERVER, speicher: hostSpeicherImSpeicher(raum), sichtFassung: SICHT_FASSUNG, zeiten: SCHNELL })
    await t.start()
    await bis(() => t.status.value === 'verbunden')
    const { stand } = grosserStand()
    t.verteile(OEFFENTLICH, json(sichtOeffentlich(stand)))
    const speicher = handy()
    const g = lese(packeLesePaket(lesePaket(raum, 'a')), speicher)
    await g.start()
    await bis(() => g.anzeige.value !== null)
    expect(g.anzeige.value!.logos).toBeUndefined()
    expect(speicher.daten.get(ABLAGE.sicht)).not.toContain(TEST_PNG_2X1.slice(30, 60))
    // Keine Sicht (falsche Form): bleibt beim letzten Stand.
    const vorher = g.anzeige.value
    t.verteile(OEFFENTLICH, { stand: 'kaputt' })
    await ruhe()
    expect(g.anzeige.value).toBe(vorher)
    t.stop()
  })

  it('ein ungültiger Link verbindet nichts und legt nichts ab', async () => {
    const speicher = handy()
    expect(oeffneLeseLink('Unsinn', { ablage: speicher })).toEqual({ ok: false, code: 'link-ungueltig' })
    await ruhe(30)
    expect(ntfy.abos).toEqual([])
    expect(ntfy.abrufe).toEqual([])
    expect(speicher.daten.size).toBe(0)
  })
})

describe('Fassungen (F7): Gerätebetrieb nur bei gleicher Fassung', () => {
  /** Ein Host einer anderen Sicht-Fassung, direkt über den Transport. */
  async function hostMitFassung(sv: number) {
    const raum = neuerRaum(SERVER)
    const t = new HostTransport({ server: SERVER, speicher: hostSpeicherImSpeicher(raum), sichtFassung: sv, zeiten: SCHNELL })
    await t.start()
    await bis(() => t.status.value === 'verbunden')
    t.verteile(OEFFENTLICH, { stand: 1 })
    await bis(() => ntfy.bodies(raum.oeffentlich.a).length > 0)
    return { t, link: packeLesePaket(lesePaket(raum, 'a')) }
  }

  it('Host neuer: gezielt neu laden – einmal, nicht in einer Schleife', async () => {
    const { t, link } = await hostMitFassung(SICHT_FASSUNG + 1)
    const speicher = handy()
    const aktualisiere = vi.fn()
    const g = lese(link, speicher, { aktualisiere })
    await g.start()
    await bis(() => g.fassung.value === 'host-neuer')
    expect(aktualisiere).toHaveBeenCalledOnce()
    expect(g.anzeige.value).toBeNull()
    // Nach dem Neuladen noch immer die alte Fassung (Programm ließ sich nicht erneuern): kein zweites Mal.
    const nochmal = lese(link, speicher, { aktualisiere })
    await nochmal.start()
    await bis(() => nochmal.fassung.value === 'host-neuer')
    expect(aktualisiere).toHaveBeenCalledOnce()
    t.stop()
  })

  it('Host älter: „Bedienrechner aktualisieren“, kein Neuladen', async () => {
    const { t, link } = await hostMitFassung(SICHT_FASSUNG - 1)
    const aktualisiere = vi.fn()
    const g = lese(link, handy(), { aktualisiere })
    await g.start()
    await bis(() => g.fassung.value === 'host-aelter')
    expect(aktualisiere).not.toHaveBeenCalled()
    t.stop()
  })

  it('ein Link einer neueren Paket-Fassung: gezielt neu laden; einer älteren: Bedienrechner aktualisieren', () => {
    const mitFassung = (fassung: number) => {
      const bytes = fromBase64Url(packeLesePaket(lesePaket(neuerRaum(SERVER), 'z')))!
      const daten = bytes.slice(0, -4)
      daten[0] = fassung
      const neu = new Uint8Array(daten.length + 4)
      neu.set(daten, 0)
      neu.set(nacl.hash(daten).subarray(0, 4), daten.length)
      return toBase64Url(neu)
    }
    const aktualisiere = vi.fn()
    expect(liesLeseLink(mitFassung(PAKET_FASSUNG + 1)).ok).toBe(false)
    expect(oeffneLeseLink(mitFassung(PAKET_FASSUNG + 1), { ablage: handy(), aktualisiere })).toEqual({ ok: false, code: 'fassung', lage: 'host-neuer' })
    expect(aktualisiere).toHaveBeenCalledOnce()
    expect(oeffneLeseLink(mitFassung(0), { ablage: handy(), aktualisiere })).toEqual({ ok: false, code: 'fassung', lage: 'host-aelter' })
    expect(aktualisiere).toHaveBeenCalledOnce()
  })
})
