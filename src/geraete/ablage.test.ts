import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ABLAGE,
  beendeRaum,
  geraetAblage,
  hostAblage,
  ichOderNeu,
  legeRaumAn,
  liesIch,
  PRAEFIX_GERAET,
  PRAEFIX_HOST,
  pruefeRaum,
  raumKennung,
  SICHT_GUELTIG_MS,
  sichtAblage,
  verlasseRaum,
  type Ablage,
  type RaumBezug,
} from './ablage'
import { fromBase64Url, toBase64Url } from './transport/ntfy/codec'
import { geraetSpeicherImSpeicher, leererGeraetStand, lesePaket, type HostRaum } from './transport/ntfy/raum'
import { GeraetTransport, HostTransport, lesegeraet, type Eingang } from './transport/ntfy/transport'
import { parseHostWire } from './transport/ntfy/wire'
import { OEFFENTLICH } from './transport/protokoll'
import type { NtfyZeiten } from './transport/ntfy/leitung'
import { koppelThema } from './themen'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, ruhe, SERVER, type NachgebautesNtfy } from './transport/ntfy/testNtfy'
import { createStore } from '../state/store'
import { STATE_KEY } from '../persistenz/storage'
import { makeFile } from '../persistenz/backup'

/**
 * Gerätelokale Ablage (Plan §3): Raum und Schlüssel des Hosts, Kennung, Verbindung und Sicht eines Geräts – im
 * localStorage dieses Browsers, nie im AppState. Kennungen, Server und Geräte sind erfunden.
 */

const KENNUNG = 'VERANST1'

beforeEach(() => localStorage.clear())

/** Ein Speicher, der nichts nimmt (voll oder gesperrt). */
const vollerSpeicher: Ablage = {
  getItem: () => null,
  setItem: () => {
    throw new DOMException('voll', 'QuotaExceededError')
  },
  removeItem: () => undefined,
}

function bezugVon(raum: HostRaum): RaumBezug {
  const p = lesePaket(raum, 'a')
  return { u: p.u, r: p.r, s: p.s }
}

describe('Schlüssel', () => {
  it('alle unter alcatraz.geraete.* bzw. alcatraz.geraet.*, keiner im Stand der Veranstaltung', () => {
    for (const schluessel of Object.values(ABLAGE)) {
      expect(schluessel.startsWith(PRAEFIX_HOST) || schluessel.startsWith(PRAEFIX_GERAET)).toBe(true)
      expect(schluessel).not.toBe(STATE_KEY)
    }
    // Die Präfixe überschneiden sich nicht: „Raum verlassen“ auf einem Gerät trifft nie den Raum eines Hosts.
    expect(PRAEFIX_HOST.startsWith(PRAEFIX_GERAET)).toBe(false)
    expect(new Set(Object.values(ABLAGE)).size).toBe(Object.values(ABLAGE).length)
  })
})

describe('Raum des Hosts', () => {
  it('angelegt für eine Veranstaltung; eine andere sieht keinen Raum', () => {
    const raum = legeRaumAn(KENNUNG, SERVER)
    expect(hostAblage(KENNUNG).lies()).toEqual(raum)
    expect(hostAblage('ANDERE2').lies()).toBeNull()
    expect(hostAblage('ANDERE2').aendere(() => undefined)).toBeNull()
    expect(raumKennung()).toBe(KENNUNG)
  })

  it('aendere liest frisch: die Änderung eines anderen Fensters geht nicht verloren', () => {
    legeRaumAn(KENNUNG, SERVER)
    const fensterA = hostAblage(KENNUNG)
    const fensterB = hostAblage(KENNUNG)
    fensterA.aendere((r) => {
      r.gruppen[OEFFENTLICH].n = 7
    })
    const nachB = fensterB.aendere((r) => {
      r.uhr = 3
    })
    expect(nachB?.gruppen[OEFFENTLICH].n).toBe(7)
    expect(hostAblage(KENNUNG).lies()).toMatchObject({ uhr: 3, gruppen: { ko: { n: 7 } } })
  })

  it('S18: die letzte Nummer eines Geräts übersteht das Neuladen', () => {
    legeRaumAn(KENNUNG, SERVER)
    hostAblage(KENNUNG).aendere((r) => {
      r.geraete['geraet-a'] = { pk: toBase64Url(new Uint8Array(32).fill(1)), letzteNr: 5, gruppen: [] }
    })
    // „Neu geladen“: eine neue Ablage über demselben localStorage.
    expect(hostAblage(KENNUNG).lies()?.geraete['geraet-a'].letzteNr).toBe(5)
  })

  it('Kaputtes heißt: kein Raum', () => {
    localStorage.setItem(ABLAGE.raum, 'kein json')
    expect(hostAblage(KENNUNG).lies()).toBeNull()
    localStorage.setItem(ABLAGE.raum, JSON.stringify({ kennung: KENNUNG, raum: { fassung: 1, server: SERVER } }))
    expect(hostAblage(KENNUNG).lies()).toBeNull()
    expect(raumKennung()).toBeNull()
  })

  it('neuer Raum ersetzt den alten (neue Schlüssel, neue Themen); beenden löscht ihn', () => {
    const alt = legeRaumAn(KENNUNG, SERVER)
    const neu = legeRaumAn(KENNUNG, SERVER)
    expect(neu.r).not.toBe(alt.r)
    expect(neu.oeffentlich.a).not.toBe(alt.oeffentlich.a)
    expect(hostAblage(KENNUNG).lies()?.r).toBe(neu.r)
    beendeRaum()
    expect(hostAblage(KENNUNG).lies()).toBeNull()
    expect(localStorage.getItem(ABLAGE.raum)).toBeNull()
  })

  it('Speicher voll: weiter mit dem geänderten Raum im Arbeitsspeicher, nie mit dem alten – und es meldet sich', () => {
    // Befund E5-Prüfung 16.11.2026: Das nächste aendere las wieder den alten Raum, jede Nummer kam doppelt.
    const daten = new Map<string, string>()
    let voll = false
    const ablage: Ablage = {
      getItem: (k) => daten.get(k) ?? null,
      setItem: (k, v) => {
        if (voll) throw new DOMException('voll', 'QuotaExceededError')
        daten.set(k, v)
      },
      removeItem: (k) => void daten.delete(k),
    }
    legeRaumAn(KENNUNG, SERVER, ablage)
    const speicher = hostAblage(KENNUNG, ablage)
    voll = true
    const nummern = [1, 2, 3].map(() => speicher.aendere((r) => void (r.gruppen[OEFFENTLICH].n += 1))!.gruppen[OEFFENTLICH].n)
    expect(nummern).toEqual([1, 2, 3])
    expect(speicher.voll?.()).toBe(true)
    expect(speicher.lies()?.gruppen[OEFFENTLICH].n).toBe(3)
    // Geht das Schreiben wieder, landet der Stand aus dem Arbeitsspeicher.
    voll = false
    speicher.aendere((r) => void (r.gruppen[OEFFENTLICH].n += 1))
    expect(speicher.voll?.()).toBe(false)
    expect(hostAblage(KENNUNG, ablage).lies()?.gruppen[OEFFENTLICH].n).toBe(4)
  })

  it('unbrauchbarer Server, voller Speicher: Fehlercode statt stillem Nichts', () => {
    expect(() => legeRaumAn(KENNUNG, 'ftp://ntfy.example.org')).toThrow('server-ungueltig')
    expect(() => legeRaumAn(KENNUNG, SERVER, vollerSpeicher)).toThrow('ablage-voll')
    expect(() => legeRaumAn(KENNUNG, SERVER, null)).toThrow('ablage-voll')
    expect(hostAblage(KENNUNG, null).lies()).toBeNull()
  })

  it('nie im Stand der Veranstaltung, nie in Sicherung oder Vorlage', () => {
    const raum = legeRaumAn(KENNUNG, SERVER)
    const store = createStore({ idb: null })
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Testpokal' } })
    expect(localStorage.getItem(STATE_KEY)).toContain('Testpokal')
    const texte = [
      localStorage.getItem(STATE_KEY) ?? '',
      JSON.stringify(makeFile('sicherung', store.state.value, '2026-11-16T00:00:00Z')),
      JSON.stringify(makeFile('vorlage', store.state.value, '2026-11-16T00:00:00Z')),
    ]
    for (const text of texte) {
      expect(text).not.toContain(raum.geheimnis)
      expect(text).not.toContain(raum.sign.sk)
      expect(text).not.toContain(raum.oeffentlich.a)
      expect(text).not.toMatch(/alcatraz\.geraete?\./)
    }
    store.beende()
  })
})

describe('Gerät', () => {
  it('eigene Kennung: einmal angelegt, danach dieselbe; abgelegt nur der geheime Schlüssel, mit der Verbindung', () => {
    const bezug = bezugVon(legeRaumAn(KENNUNG, SERVER))
    const ich = ichOderNeu(bezug)
    expect(ichOderNeu(bezug)).toEqual(ich)
    expect(liesIch(bezug)?.schluessel.publicKey).toEqual(ich.schluessel.publicKey)
    const abgelegt = JSON.parse(localStorage.getItem(ABLAGE.verbindung)!) as { ich: Record<string, unknown> }
    expect(Object.keys(abgelegt.ich).sort()).toEqual(['id', 'sk'])
    expect(fromBase64Url(abgelegt.ich.sk as string)).toEqual(ich.schluessel.secretKey)
    // Der Transport schreibt seinen Stand – die Kennung bleibt im selben Eintrag.
    geraetAblage(bezug).schreibe({ ...leererGeraetStand(), naechsteNr: 3 })
    expect(ichOderNeu(bezug)).toEqual(ich)
    expect(geraetAblage(bezug).lies()?.naechsteNr).toBe(3)
  })

  it('Kennung nie ohne ihre Nummernfolge: ist der Stand kaputt, beginnen beide neu (Befund E5-Prüfung)', () => {
    const bezug = bezugVon(legeRaumAn(KENNUNG, SERVER))
    const ich = ichOderNeu(bezug)
    geraetAblage(bezug).schreibe({ ...leererGeraetStand(), naechsteNr: 9 })
    const eintrag = JSON.parse(localStorage.getItem(ABLAGE.verbindung)!) as Record<string, unknown>
    localStorage.setItem(ABLAGE.verbindung, JSON.stringify({ ...eintrag, stand: { gruppen: 'kaputt' } }))
    const neu = ichOderNeu(bezug)
    expect(neu.id).not.toBe(ich.id)
    expect(neu.schluessel.publicKey).not.toEqual(ich.schluessel.publicKey)
    expect(geraetAblage(bezug).lies()).toBeNull()
  })

  it('ohne Speicher gibt es trotzdem eine Kennung (für diese Sitzung)', () => {
    const bezug = bezugVon(legeRaumAn(KENNUNG, SERVER))
    const ich = ichOderNeu(bezug, null)
    expect(ich.id.length).toBeGreaterThan(8)
    expect(liesIch(bezug, null)).toBeNull()
  })

  it('Verbindung gilt nur für ihren Raum: andere Raum-ID oder anderer Host-Schlüssel = nichts', () => {
    const raum = legeRaumAn(KENNUNG, SERVER)
    const bezug = bezugVon(raum)
    const stand = { ...leererGeraetStand(), seen: { ko: 12 }, naechsteNr: 4 }
    geraetAblage(bezug).schreibe(stand)
    expect(geraetAblage(bezug).lies()).toEqual(stand)
    expect(geraetAblage({ ...bezug, r: 'anderRaum1' }).lies()).toBeNull()
    expect(geraetAblage({ ...bezug, s: toBase64Url(new Uint8Array(32)) }).lies()).toBeNull()
    localStorage.setItem(ABLAGE.verbindung, JSON.stringify({ ...bezug, stand: { gruppen: 'kaputt' } }))
    expect(geraetAblage(bezug).lies()).toBeNull()
  })

  it('Sicht läuft 36 h nach der letzten Nachricht ab und gilt nur für ihren Raum (K20)', () => {
    const bezug = bezugVon(legeRaumAn(KENNUNG, SERVER))
    let jetzt = 1_000_000
    const uhr = () => jetzt
    sichtAblage(bezug, localStorage, uhr).schreibe({ sv: 4, bereiche: [] })
    jetzt += SICHT_GUELTIG_MS - 1
    expect(sichtAblage(bezug, localStorage, uhr).lies()).toEqual({ sv: 4, bereiche: [] })
    expect(sichtAblage({ ...bezug, r: 'anderRaum1' }, localStorage, uhr).lies()).toBeNull()
    // Für einen anderen Raum gelesen, ist sie gelöscht – auch für den eigenen.
    expect(localStorage.getItem(ABLAGE.sicht)).toBeNull()

    sichtAblage(bezug, localStorage, uhr).schreibe({ sv: 4, bereiche: [] })
    jetzt += SICHT_GUELTIG_MS
    expect(sichtAblage(bezug, localStorage, uhr).lies()).toBeNull()
    expect(localStorage.getItem(ABLAGE.sicht)).toBeNull()
  })

  it('neuer Link zu einem anderen Raum: Verbindung samt Kennung und Sicht des alten weg', () => {
    const alt = bezugVon(legeRaumAn(KENNUNG, SERVER))
    const neu = bezugVon(legeRaumAn(KENNUNG, SERVER))
    const ich = ichOderNeu(alt)
    geraetAblage(alt).schreibe(leererGeraetStand())
    sichtAblage(alt).schreibe({ alt: true })
    pruefeRaum(alt)
    expect(geraetAblage(alt).lies()).not.toBeNull()
    expect(liesIch(alt)?.id).toBe(ich.id)
    pruefeRaum(neu)
    expect(localStorage.getItem(ABLAGE.verbindung)).toBeNull()
    expect(localStorage.getItem(ABLAGE.sicht)).toBeNull()
    expect(liesIch(alt)).toBeNull()
    expect(ichOderNeu(neu).id).not.toBe(ich.id)
  })

  it('Raum verlassen: Verbindung samt Kennung und Sicht weg, Raum des Hosts bleibt', () => {
    const raum = legeRaumAn(KENNUNG, SERVER)
    const bezug = bezugVon(raum)
    const ich = ichOderNeu(bezug)
    geraetAblage(bezug).schreibe(leererGeraetStand())
    sichtAblage(bezug).schreibe({ x: 1 })
    verlasseRaum()
    expect(localStorage.getItem(ABLAGE.verbindung)).toBeNull()
    expect(localStorage.getItem(ABLAGE.sicht)).toBeNull()
    expect(liesIch(bezug)).toBeNull()
    expect(ichOderNeu(bezug).id).not.toBe(ich.id)
    expect(hostAblage(KENNUNG).lies()?.r).toBe(raum.r)
  })
})

describe('mit dem Transport über einen nachgebauten ntfy-Server', () => {
  let ntfy: NachgebautesNtfy
  const laufend: { stop(): void }[] = []
  const SCHNELL: Partial<NtfyZeiten> = { abstandMs: 0, wiederholenMs: [20], zuVieleMs: 30, neuVerbindenMs: [10], quittungMs: 150, einstiegAbstandMs: 0, bearbeitungMs: 2000 }
  const CODE = 'CODE23'

  beforeEach(() => {
    ntfy = neuesNtfy()
    vi.stubGlobal('WebSocket', NachgebauterSocket)
    vi.stubGlobal('fetch', nachgebautesFetch)
  })

  afterEach(() => {
    for (const t of laufend.splice(0)) t.stop()
    vi.unstubAllGlobals()
  })

  function host(raum: HostRaum) {
    const t = new HostTransport({ server: SERVER, speicher: hostAblage(KENNUNG), sichtFassung: 4, zeiten: SCHNELL })
    laufend.push(t)
    t.liesAuch(koppelThema(raum.oeffentlich.a, CODE))
    const actions: Eingang[] = []
    t.beiEingang((e) => {
      if (e.nachricht.art === 'hallo') {
        if (!e.gebunden && e.nachricht.code !== CODE) return t.ablehnen(e, 'code-ungueltig')
        t.begruesse(e, { gruppen: [OEFFENTLICH], aufgaben: [] })
        return
      }
      actions.push(e)
      t.quittiere(e, 'angewandt')
    })
    return { t, actions }
  }

  function geraet(raum: HostRaum) {
    const t = new GeraetTransport({
      server: SERVER,
      raum: raum.r,
      hostSign: fromBase64Url(raum.sign.pk)!,
      hostBox: fromBase64Url(raum.box.pk)!,
      lesen: [raum.oeffentlich.a],
      oeffentlich: { k: raum.gruppen[OEFFENTLICH].k, e: raum.gruppen[OEFFENTLICH].e },
      koppeln: koppelThema(raum.oeffentlich.a, CODE),
      ich: ichOderNeu(bezugVon(raum)),
      speicher: geraetAblage(bezugVon(raum)),
      sichtFassung: 4,
      zeiten: SCHNELL,
    })
    laufend.push(t)
    return t
  }

  it('Neuladen von Host und Gerät: nichts geht verloren, nichts wirkt doppelt (S2/S3/S18)', async () => {
    const raum = legeRaumAn(KENNUNG, SERVER)
    const h1 = host(raum)
    await h1.t.start()
    await bis(() => h1.t.status.value === 'verbunden')
    const g1 = geraet(raum)
    await g1.start()
    g1.sende({ art: 'hallo', name: 'Steg-Handy', code: CODE })
    await bis(() => g1.unbestaetigt().length === 0)

    // Der Host ist weg, das Gerät schickt eine Action und lädt neu, bevor eine Quittung kommen kann.
    h1.t.stop()
    const nr = g1.sende({ art: 'action', action: { type: 'BETRIEB_MELDUNG', bereich: 'par_1', meldung: null } })
    await bis(() => ntfy.bodies(h1.t.geraeteThema()!).length >= 2)
    g1.stop()

    // Beide neu geladen – Raum, Nummern und Sende-Schlange kommen aus dem localStorage.
    const g2 = geraet(raum)
    expect(g2.unbestaetigt()).toEqual([])
    await g2.start()
    expect(g2.unbestaetigt()).toEqual([nr])
    const h2 = host(raum)
    await h2.t.start()
    await bis(() => g2.unbestaetigt().length === 0)
    await ruhe()
    expect(h2.actions.map((e) => e.nr)).toEqual([nr])
    expect(hostAblage(KENNUNG).lies()?.geraete[liesIch(bezugVon(raum))!.id].letzteNr).toBe(nr)

    // Ein dritter Start des Hosts holt per since nichts doppelt nach.
    h2.t.stop()
    const h3 = host(raum)
    await h3.t.start()
    await bis(() => h3.t.status.value === 'verbunden')
    await ruhe()
    expect(h3.actions).toHaveLength(0)
  })

  it('Speicher voll: der Host vergibt keine Nummer doppelt, das Gerät bleibt aktuell, ablage-voll wird gemeldet', async () => {
    const daten = new Map<string, string>()
    let voll = false
    const ablage: Ablage = {
      getItem: (k) => daten.get(k) ?? null,
      setItem: (k, v) => {
        if (voll) throw new DOMException('voll', 'QuotaExceededError')
        daten.set(k, v)
      },
      removeItem: (k) => void daten.delete(k),
    }
    const raum = legeRaumAn(KENNUNG, SERVER, ablage)
    voll = true
    const t = new HostTransport({ server: SERVER, speicher: hostAblage(KENNUNG, ablage), sichtFassung: 4, zeiten: SCHNELL })
    laufend.push(t)
    await t.start()
    await bis(() => t.status.value === 'verbunden')
    const leser = lesegeraet(lesePaket(raum, 'a'), geraetSpeicherImSpeicher(), 4, SCHNELL)
    laufend.push(leser)
    const sichten: unknown[] = []
    leser.beiEmpfang((e) => {
      if (e.art === 'sicht') sichten.push(e.sicht)
    })
    await leser.start()
    await bis(() => leser.status.value === 'verbunden')
    for (const i of [1, 2, 3]) {
      t.verteile(OEFFENTLICH, { stand: i })
      await bis(() => ntfy.bodies(raum.oeffentlich.a).length === i)
    }
    await bis(() => sichten.length === 3)
    expect(ntfy.bodies(raum.oeffentlich.a).map((b) => parseHostWire(b)!.n)).toEqual([1, 2, 3])
    expect(sichten.at(-1)).toEqual({ stand: 3 })
    expect(t.fehler.value).toEqual({ code: 'ablage-voll' })
  })

  it('Raum verlassen und neu koppeln: neue Kennung, die Anmeldung kommt an, eine Action wirkt genau einmal (Befund E5-Prüfung)', async () => {
    const raum = legeRaumAn(KENNUNG, SERVER)
    const h = host(raum)
    await h.t.start()
    await bis(() => h.t.status.value === 'verbunden')
    const action = () => ({ art: 'action' as const, action: { type: 'BETRIEB_MELDUNG', bereich: 'par_1', meldung: null } })
    const g1 = geraet(raum)
    await g1.start()
    g1.sende({ art: 'hallo', name: 'Steg-Handy', code: CODE })
    for (let i = 0; i < 3; i++) g1.sende(action())
    await bis(() => g1.unbestaetigt().length === 0)
    expect(h.actions).toHaveLength(3)
    const alteId = liesIch(bezugVon(raum))!.id
    g1.stop()

    // „Raum verlassen“, dann denselben Raum wieder: Der Host kennt den alten Schlüssel noch mit letzteNr 4.
    verlasseRaum()
    const g2 = geraet(raum)
    const empfang: string[] = []
    g2.beiEmpfang((e) => {
      if (e.art === 'direkt') empfang.push(e.nachricht.art)
    })
    await g2.start()
    await bis(() => g2.status.value === 'verbunden')
    await ruhe()
    // Das alte willkommen liegt noch auf dem Koppel-Thema – mit dem neuen Schlüssel geht es nicht auf.
    expect(empfang).toEqual([])
    g2.sende({ art: 'hallo', name: 'Steg-Handy', code: CODE })
    const nr = g2.sende(action())
    await bis(() => g2.unbestaetigt().length === 0)
    await ruhe()
    expect(empfang).toEqual(['willkommen', 'quittung'])
    expect(liesIch(bezugVon(raum))!.id).not.toBe(alteId)
    expect(h.actions).toHaveLength(4)
    expect(h.actions.at(-1)).toMatchObject({ nr, gebunden: true })
  })
})
