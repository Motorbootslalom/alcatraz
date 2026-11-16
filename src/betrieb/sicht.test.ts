import { describe, expect, it } from 'vitest'
import { reducer } from '../state/reducer'
import { laufSchluessel } from '../lib/eingaben'
import { BETRIEB_STARTER, betriebsStand, betriebStarter, festgeschrieben, testLogo, zeigeNaechsten } from '../testHilfen'
import { refKey } from './folge'
import { sichtOeffentlich } from './sicht'
import type { AppState, OeffentlicheSicht } from '../types'

// Die öffentliche Sicht: was Anzeigetafel, Zuschauer und Start-Freigabe vom Stand sehen. Alle Starter
// sind erfunden (Vor<id>/Nach<id>, Musterclub); Geburtsdatum und Gewicht stehen nur hier, um zu
// prüfen, dass sie draußen bleiben.

const P1 = 'par_1'
const m = (starter: string, lauf: number) => refKey({ art: 'm', starter, lauf })
const GEHEIM = '2014-02-03'

/** Lauf 1 auf Parcours 1 begonnen, zwei Starts gezeigt; alle Starter mit Geburtsdatum, Gewicht, Geschlecht und Werten. */
function imBetrieb(regelwerk = 'dm-2026'): AppState {
  const starter = BETRIEB_STARTER.map((p) => ({ ...p, geburtsdatum: GEHEIM, gewicht: 41.7, geschlecht: 'F' as const }))
  let s = reducer(betriebsStand(starter), { type: 'SET_REGELWERK', regelwerk })
  s = festgeschrieben(s)
  s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:1' })
  s = zeigeNaechsten(zeigeNaechsten(s, P1, 1000), P1, 61_000)
  s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'e1', feld: 'zeit1', wert: '83.4' }] })
  return { ...s, abgemeldet: ['f1'] }
}

/** Alle Schlüssel eines Werts, auch verschachtelt. */
function schluessel(wert: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(wert)) wert.forEach((w) => schluessel(w, out))
  else if (wert && typeof wert === 'object')
    for (const [k, v] of Object.entries(wert)) {
      out.add(k)
      schluessel(v, out)
    }
  return out
}

const name = (sicht: OeffentlicheSicht, id: string) => sicht.starter[id]?.name

describe('Öffentliche Sicht', () => {
  it('Datenschutz: kein Geburtsdatum, Gewicht, Geschlecht, keine Werte, keine Abmeldungen', () => {
    const sicht = sichtOeffentlich(imBetrieb())
    const alle = schluessel(sicht)
    for (const verboten of ['geburtsdatum', 'gewicht', 'geschlecht', 'eingaben', 'abgemeldet', 'abgemeldetBis', 'groesse', 'vorname', 'nachname', 'coPiloten', 'einteilung'])
      expect(alle.has(verboten), verboten).toBe(false)
    const text = JSON.stringify(sicht)
    for (const verboten of [GEHEIM, '41.7', '83.4']) expect(text).not.toContain(verboten)
  })

  it('nur Starter, die in der Sicht vorkommen; der erste offene ist der Nächste', () => {
    const s = reducer(imBetrieb(), { type: 'SET_ANZEIGE', patch: { amSteg: 0, vorSteg: 0 } })
    const sicht = sichtOeffentlich(s)
    const b = sicht.bereiche[0]
    expect([b.id, b.name, b.fest, b.punkt?.id, b.punkt?.titel, b.naechsterPunkt?.id]).toEqual([P1, 'Parcours 1', true, 'lauf:1', '1. Lauf', 'lauf:2'])
    expect([b.aktuell?.key, b.vorig?.key, b.seit, b.offen.map((o) => o.key), b.offenZahl]).toEqual([m('k1', 1), m('e1', 1), 61_000, [m('e2', 1)], 2])
    expect(b.aktuell?.titel).toBe('1. Lauf')
    expect(Object.keys(sicht.starter).sort()).toEqual(['e1', 'e2', 'k1'])
    expect(sicht.starter.k1).toEqual({ startNr: '101', name: 'Vork1 Nachk1', klasse: '1', herkunft: expect.objectContaining({ klartext: 'Musterclub' }) })
    expect(Object.keys(sicht.klassen).sort()).toEqual(['1', 'E'])
    // Parcours 2 hat nicht begonnen: steht da, aber ohne Starter.
    expect(sicht.bereiche[1]).toMatchObject({ id: 'par_2', punkt: null, aktuell: null, offen: [], offenZahl: 0, naechsterPunkt: { id: 'lauf:1' } })
    expect(sicht.auswahl).toEqual([P1, 'par_2'])
  })

  it('Namen nach der Einstellung: wie der Aushang, voll, gekürzt, ohne', () => {
    const mit = (namen: AppState['anzeige']['namen'], s = imBetrieb()) => sichtOeffentlich(reducer(s, { type: 'SET_ANZEIGE', patch: { namen } }))
    expect(name(mit('voll'), 'k1')).toBe('Vork1 Nachk1')
    expect(name(mit('kurz'), 'k1')).toBe('Vork1 N.')
    expect(name(mit('ohne'), 'k1')).toBe('')
    // Vorgabe: wie der Aushang der Wertungslisten.
    expect(imBetrieb().anzeige.namen).toBe('aushang')
    expect(name(mit('aushang'), 'k1')).toBe('Vork1 Nachk1')
    const gekuerzt = reducer(imBetrieb(), { type: 'SET_ERGEBNIS_LISTEN', fassung: 'aushang', patch: { namen: 'kurz' } })
    expect(name(mit('aushang', gekuerzt), 'k1')).toBe('Vork1 N.')
  })

  it('Herkunft nach Stil; „aus“ und Clubmeisterschaft zeigen keine', () => {
    expect(sichtOeffentlich(imBetrieb()).starter.k1.herkunft?.text).toBe('Musterclub')
    expect(sichtOeffentlich(reducer(imBetrieb(), { type: 'SET_ANZEIGE', patch: { herkunft: 'aus' } })).starter.k1.herkunft).toBeNull()
    expect(sichtOeffentlich(reducer(imBetrieb(), { type: 'SET_EVENT_KIND', eventKind: 'club' })).starter.k1.herkunft).toBeNull()
  })

  it('UIM: englisch nach dem Rulebook, Klasse E heißt „Dolphin“', () => {
    const s = imBetrieb('uim-2026')
    const sicht = sichtOeffentlich(s)
    expect(sicht.sprache).toBe('en')
    expect(sicht.klassen.E).toEqual({ name: 'Dolphin', titel: 'Class Dolphin', farbe: expect.any(String) })
    expect(sicht.bereiche[0].name).toBe('Course 1')
    expect(sicht.bereiche[0].aktuell?.titel).toBe('Attempt 1')
    // Als Einstellung deutsch – E bleibt „Dolphin“, der Name hängt am Regelwerk.
    const deutsch = sichtOeffentlich(reducer(s, { type: 'SET_ANZEIGE', patch: { sprache: 'de' } }))
    expect([deutsch.sprache, deutsch.klassen.E?.titel, deutsch.bereiche[0].aktuell?.titel]).toEqual(['de', 'Klasse Dolphin', '1. Lauf'])
    // „Versuche nacheinander“: ein Punkt mit beiden Versuchen.
    const nacheinander = sichtOeffentlich(reducer(s, { type: 'SET_VERSUCHE_NACHEINANDER', on: true }))
    expect(nacheinander.bereiche[0].punkt).toEqual({ id: 'lauf:1', titel: 'Attempt 1 / Attempt 2', laeufe: [1, 2] })
  })

  it('zeitunabhängig und nach Inhalt stabil: Eine Eingabe ändert die Sicht nicht, ein neuer Start schon', () => {
    const s = imBetrieb()
    const vorher = JSON.stringify(sichtOeffentlich(s))
    expect(JSON.stringify(sichtOeffentlich(s))).toBe(vorher)
    const eingabe = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'k1', feld: 'zeit1', wert: '90.1' }] })
    expect(eingabe).not.toBe(s)
    expect(JSON.stringify(sichtOeffentlich(eingabe))).toBe(vorher)
    expect(JSON.stringify(sichtOeffentlich(zeigeNaechsten(s, P1, 99_000)))).not.toBe(vorher)
  })

  it('Kopfzeile: Name und Jahr, eigene oder keine', () => {
    expect(sichtOeffentlich(imBetrieb()).kopf).toBe('Musterpokal 2026')
    expect(sichtOeffentlich(reducer(imBetrieb(), { type: 'SET_ANZEIGE', patch: { kopfzeile: '1. Musterregatta' } })).kopf).toBe('1. Musterregatta')
    expect(sichtOeffentlich(reducer(imBetrieb(), { type: 'SET_ANZEIGE', patch: { kopfzeile: '' } })).kopf).toBe('')
    expect(sichtOeffentlich({ ...imBetrieb(), eventName: ' ' }).kopf).toBe('')
  })

  it('Logos nur am Bedienrechner und nur, wenn eingeschaltet', () => {
    const s = reducer(imBetrieb(), { type: 'SET_LOGO', seite: 'links', logo: testLogo() })
    expect(sichtOeffentlich(s).logos).toEqual({ links: testLogo(), rechts: null })
    expect(sichtOeffentlich(s, { logos: false }).logos).toBeUndefined()
    expect(sichtOeffentlich(reducer(s, { type: 'SET_ANZEIGE', patch: { logos: false } })).logos).toBeUndefined()
    expect(sichtOeffentlich(imBetrieb()).logos).toBeUndefined()
  })

  it('ein gezeigter Starter, den es nicht mehr gibt, steht nicht mehr da; Nachzuholende stehen dabei', () => {
    // Ohne erfasste Werte – sonst steht das Starterfeld fest (lib/eingaben.ts `starterfeldFest`).
    let s: AppState = { ...imBetrieb(), eingaben: {} }
    s = reducer(s, { type: 'ADD_STARTERS', starters: [betriebStarter('e0', 'E', 'E00')] })
    const sicht = sichtOeffentlich(s)
    expect(sicht.bereiche[0].nachzuholen.map((n) => n.key)).toEqual([m('e0', 1)])
    expect(sicht.starter.e0?.startNr).toBe('E00')
    const geloescht = reducer(s, { type: 'REMOVE_STARTER', id: 'k1' })
    const ohne = sichtOeffentlich(geloescht)
    // Keine Angaben mehr zum Starter – aber die Kennung des Starts im Boot bleibt (für `vorher`).
    expect(ohne.starter.k1).toBeUndefined()
    expect(ohne.bereiche[0].aktuell?.key).toBe(m('k1', 1))
    expect(JSON.stringify(ohne)).not.toContain('Nachk1')
  })

  it('Starter im Boot gelöscht: „Nächster Start“ über die Sicht geht weiter, „Zurück“ auch (Prüfung E1)', () => {
    let s: AppState = { ...imBetrieb(), eingaben: {} }
    s = reducer(s, { type: 'REMOVE_STARTER', id: 'k1' })
    // Die Verzahnung ist ohne k1 neu gerechnet; der Nächste ist, was sie jetzt sagt.
    const naechster = sichtOeffentlich(s).bereiche[0].offen[0].key
    const weiter = zeigeNaechsten(s, P1, 90_000)
    expect(weiter).not.toBe(s)
    const b = sichtOeffentlich(weiter).bereiche[0]
    expect([b.aktuell?.key, b.vorig?.key]).toEqual([naechster, m('k1', 1)])
    // „Zurück“ nimmt den gelöschten Start aus dem Verlauf, der davor steht wieder im Boot.
    const zurueck = reducer(s, { type: 'BETRIEB_ZURUECK', bereich: P1, ref: sichtOeffentlich(s).bereiche[0].aktuell!.key })
    expect(sichtOeffentlich(zurueck).bereiche[0].aktuell?.key).toBe(m('e1', 1))
  })
})
