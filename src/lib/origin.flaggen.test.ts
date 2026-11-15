/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { flaggeAllein, herkunftAnzeige, istOriginStyle, ORIGIN_STYLES, originText, starterHerkunft, wirksamerStil } from './origin'
import { migrate } from '../state/migrate'
import { emptyState } from '../state/reducer'
import { makeFile, parseFile } from '../persistenz/backup'
import HerkunftText from '../components/HerkunftText.vue'
import type { OriginStyle, Starter } from '../types'

// Erfundener Starter.
const s = (mehr: Partial<Starter>): Starter => ({ id: 'a', startNr: '1', vorname: 'V', nachname: 'N', verein: 'Musterclub', bundesland: 'Brandenburg', geburtsdatum: '', groesse: '', klasse: '3', ...mehr })
const zeige = (name: string, mode: Parameters<typeof herkunftAnzeige>[1], stil: OriginStyle, eigene: Record<string, string> = {}, sprache = 'de') => {
  const a = herkunftAnzeige(name, mode, stil, eigene, sprache)
  return { flagge: a.flagge?.code, text: a.text, druck: a.druck, alt: a.alt }
}

describe('Herkunft anzeigen: Text, Kürzel, Flagge – eine Stelle für alle Listen', () => {
  it('die fünf Darstellungen für ein Bundesland', () => {
    expect(zeige('Brandenburg', 'bundesland', 'lang')).toEqual({ flagge: undefined, text: 'Brandenburg', druck: '', alt: '' })
    expect(zeige('Brandenburg', 'bundesland', 'kurz')).toEqual({ flagge: undefined, text: 'BB', druck: '', alt: '' })
    // Neben dem Kürzel nennt die Flagge den Namen; neben dem Namen ist sie Schmuck (sonst läse ein Vorleseprogramm ihn doppelt).
    expect(zeige('Brandenburg', 'bundesland', 'flagge-kurz')).toEqual({ flagge: 'BB', text: 'BB', druck: '', alt: 'Brandenburg' })
    expect(zeige('Brandenburg', 'bundesland', 'flagge-lang')).toEqual({ flagge: 'BB', text: 'Brandenburg', druck: '', alt: '' })
    expect(zeige('Brandenburg', 'bundesland', 'flagge')).toEqual({ flagge: 'BB', text: '', druck: 'BB', alt: 'Brandenburg' })
  })

  it('Druckregel: „nur Flagge“ trägt immer ein Kürzel für das Papier – das eigene, sonst das amtliche', () => {
    expect(herkunftAnzeige('Brandenburg', 'bundesland', 'flagge', { Brandenburg: 'BRB' }).druck).toBe('BRB')
    expect(herkunftAnzeige('Germany', 'land', 'flagge', {}).druck).toBe('DEU')
    expect(herkunftAnzeige('GER', 'land', 'flagge', {}).druck).toBe('GER')
    expect(herkunftAnzeige('Holland', 'land', 'flagge', {}).druck).toBe('NLD')
    for (const name of ['Bayern', 'BY', 'nrw', 'Thüringen']) expect(herkunftAnzeige(name, 'bundesland', 'flagge', {}).druck, name).not.toBe('')
    // Die anderen Darstellungen zeigen ihren Text ohnehin auch auf Papier.
    for (const stil of ORIGIN_STYLES.filter((x) => x !== 'flagge')) expect(herkunftAnzeige('Bayern', 'bundesland', stil, {}).druck, stil).toBe('')
  })

  it('Staaten: Kürzel aus dem erkannten Staat, Textalternative in der Sprache der Liste', () => {
    expect(zeige('Österreich', 'land', 'flagge-kurz')).toEqual({ flagge: 'AT', text: 'AUT', druck: '', alt: 'Österreich' })
    expect(zeige('Austria', 'land', 'flagge-kurz', {}, 'en')).toEqual({ flagge: 'AT', text: 'AUT', druck: '', alt: 'Austria' })
    // Eine Angabe, die selbst ein Kürzel ist, bleibt stehen (GER wird nicht zu DEU).
    expect(zeige('GER', 'land', 'flagge-kurz', {}, 'en')).toEqual({ flagge: 'DE', text: 'GER', druck: '', alt: 'Germany' })
    // Ausgeschrieben steht auf einer englischen Liste der englische Name des Staates (Nationen international,
    // Entscheidung des Nutzers vom 15.11.2026) – die Flagge bleibt dann stumm (nicht „Czechia Czechia“).
    expect(zeige('GER', 'land', 'flagge-lang', {}, 'en')).toEqual({ flagge: 'DE', text: 'Germany', druck: '', alt: '' })
    expect(zeige('Czech Republic', 'land', 'flagge-lang', {}, 'en')).toEqual({ flagge: 'CZ', text: 'Czechia', druck: '', alt: '' })
    expect(zeige('Great Britain', 'land', 'flagge-lang', {}, 'en')).toEqual({ flagge: 'GB', text: 'United Kingdom', druck: '', alt: '' })
    // Ein deutscher Name steht auf einer englischen Liste englisch, auf einer deutschen, wie er eingetragen ist.
    expect(zeige('Litauen', 'land', 'lang', {}, 'en')).toMatchObject({ text: 'Lithuania' })
    expect(zeige('Litauen', 'land', 'lang', {}, 'de')).toMatchObject({ text: 'Litauen' })
    // Die Angabe selbst (Starter-Reiter, Tabelle der Kürzel) steht immer, wie sie eingetragen ist.
    expect(herkunftAnzeige('Litauen', 'land', 'flagge-lang', {}, 'en', true)).toMatchObject({ text: 'Litauen', alt: '' })
    expect(zeige('Litauen', 'land', 'kurz', {}, 'en')).toMatchObject({ text: 'LTU' })
    // Nicht erkannt bleibt, was eingetragen ist; Bundesländer und Vereine werden nicht übersetzt.
    expect(zeige('Atlantis', 'land', 'lang', {}, 'en')).toMatchObject({ text: 'Atlantis' })
    expect(zeige('Bayern', 'bundesland', 'lang', {}, 'en')).toMatchObject({ text: 'Bayern' })
    expect(zeige('Great Britain', 'land', 'flagge-kurz', {}, 'en')).toEqual({ flagge: 'GB', text: 'GBR', druck: '', alt: 'United Kingdom' })
    // Auch ohne Flagge gilt das Kürzel des erkannten Staates.
    expect(zeige('Holland', 'land', 'kurz')).toMatchObject({ flagge: undefined, text: 'NLD' })
    expect(zeige('Österreich', 'land', 'flagge-kurz', { Österreich: 'A' })).toMatchObject({ flagge: 'AT', text: 'A' })
  })

  it('Kürzel nach IOC (DM und UIM, Regel 209): jede Schreibweise eines Staates wird zu demselben Kürzel', () => {
    const ioc = (name: string, stil: OriginStyle = 'kurz', eigene: Record<string, string> = {}) => herkunftAnzeige(name, 'land', stil, eigene, 'en', false, 'ioc')
    // Auf einer Liste steht dieselbe Nation nicht unter zwei Codes (DEU neben GER).
    expect(['Germany', 'Deutschland', 'DEU', 'GER', 'germany'].map((n) => ioc(n).text)).toEqual(['GER', 'GER', 'GER', 'GER', 'GER'])
    expect(['Schweiz', 'Holland', 'Lettland', 'Österreich'].map((n) => ioc(n).text)).toEqual(['SUI', 'NED', 'LAT', 'AUT'])
    expect(ioc('Germany', 'flagge')).toMatchObject({ flagge: { code: 'DE' }, text: '', druck: 'GER' })
    expect(ioc('England', 'flagge-kurz')).toMatchObject({ text: 'ENG' })
    // Eigene Einträge gehen vor; nicht Erkanntes und Bundesländer bleiben, wie sie sind.
    expect(ioc('Deutschland', 'kurz', { Deutschland: 'D' }).text).toBe('D')
    expect(ioc('Atlantis').text).toBe('Atlantis')
    expect(herkunftAnzeige('Bayern', 'bundesland', 'kurz', {}, 'en', false, 'ioc').text).toBe('BY')
    // Unter ISO (Vorgabe eines Regelwerks ohne `laenderKuerzel`) bleibt alles wie bisher.
    expect(['Germany', 'DEU', 'GER'].map((n) => herkunftAnzeige(n, 'land', 'kurz', {}, 'de').text)).toEqual(['DEU', 'DEU', 'GER'])
  })

  it('nicht Erkanntes steht ohne Flagge als Text da – bei „nur Flagge“ bleibt der Text', () => {
    expect(zeige('Atlantis', 'land', 'flagge-kurz')).toEqual({ flagge: undefined, text: 'Atlantis', druck: '', alt: '' })
    expect(zeige('Atlantis', 'land', 'flagge-lang')).toEqual({ flagge: undefined, text: 'Atlantis', druck: '', alt: '' })
    expect(zeige('Atlantis', 'land', 'flagge')).toEqual({ flagge: undefined, text: 'Atlantis', druck: '', alt: '' })
    expect(zeige('', 'land', 'flagge')).toEqual({ flagge: undefined, text: '', druck: '', alt: '' })
  })

  it('Vereine haben keine Flaggen: Eine Flaggen-Darstellung gilt dort wie die ohne', () => {
    expect(wirksamerStil('flagge-lang', 'verein')).toBe('lang')
    expect(wirksamerStil('flagge-kurz', 'verein')).toBe('kurz')
    expect(wirksamerStil('flagge', 'verein')).toBe('kurz')
    expect(wirksamerStil('flagge', 'land')).toBe('flagge')
    expect(wirksamerStil('flagge', 'bundesland')).toBe('flagge')
    expect(zeige('Musterclub', 'verein', 'flagge', { Musterclub: 'MC' })).toEqual({ flagge: undefined, text: 'MC', druck: '', alt: '' })
    expect(zeige('Bayern', 'verein', 'flagge-lang')).toEqual({ flagge: undefined, text: 'Bayern', druck: '', alt: '' })
  })

  it('Breite für die Spalten: Die Flagge zählt mit, bei „nur Flagge“ auch das gedruckte Kürzel', () => {
    expect(herkunftAnzeige('Brandenburg', 'bundesland', 'lang', {}).mass).toHaveLength(11)
    expect(herkunftAnzeige('Brandenburg', 'bundesland', 'flagge-lang', {}).mass).toHaveLength(14)
    expect(herkunftAnzeige('Brandenburg', 'bundesland', 'flagge-kurz', {}).mass).toHaveLength(5)
    expect(herkunftAnzeige('Brandenburg', 'bundesland', 'flagge', {}).mass).toHaveLength(5)
    expect(herkunftAnzeige('Brandenburg', 'bundesland', 'flagge', {}).klartext).toBe('BB')
  })

  it('als reiner Text bleibt alles wie bisher; der Starter liefert die Herkunft der gewählten Art', () => {
    expect(originText(s({}), 'bundesland', 'kurz', {})).toBe('BB')
    expect(originText(s({}), 'bundesland', 'lang', {})).toBe('Brandenburg')
    expect(originText(s({}), 'verein', 'kurz', {})).toBe('Musterclub')
    expect(originText(s({}), 'none', 'kurz', {})).toBe('')
    expect(starterHerkunft(s({ land: 'Polen' }), 'land', 'flagge-kurz', {}).flagge?.code).toBe('PL')
    expect(flaggeAllein('Polen', 'land')).toMatchObject({ text: '', druck: '', alt: '' })
  })
})

describe('HerkunftText: die eine Komponente', () => {
  const blatt = (name: string, stil: OriginStyle) => mount(HerkunftText, { props: { anzeige: herkunftAnzeige(name, 'bundesland', stil, {}) } })

  it('ohne Flagge steht nur der Text da', () => {
    const w = blatt('Brandenburg', 'kurz')
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toBe('BB')
  })

  it('Flagge + Kürzel: Bild mit dem Namen als Textalternative, daneben das Kürzel', () => {
    const w = blatt('Brandenburg', 'flagge-kurz')
    const bild = w.get('img.flagge')
    expect(bild.attributes('src')).toMatch(/^data:image\/svg\+xml,/)
    expect(bild.attributes('alt')).toBe('Brandenburg')
    // Breite und Höhe stehen am Bild: Seine Breite steht fest, bevor es gezeichnet ist.
    expect(Number(bild.attributes('width')) / Number(bild.attributes('height'))).toBeCloseTo(5 / 3, 1)
    expect(w.text()).toBe('BB')
    expect(w.find('.herkunft-druck').exists()).toBe(false)
  })

  it('Flagge + ausgeschrieben: Die Flagge ist Schmuck (alt leer) – der Name wird nicht doppelt vorgelesen', () => {
    const w = blatt('Brandenburg', 'flagge-lang')
    expect(w.get('img.flagge').attributes('alt')).toBe('')
    expect(w.text()).toBe('Brandenburg')
  })

  it('nur Flagge: das Kürzel steht im Blatt, aber nur für den Druck – und nicht für Vorleseprogramme', () => {
    const w = blatt('Brandenburg', 'flagge')
    expect(w.get('img.flagge').attributes('alt')).toBe('Brandenburg')
    const druck = w.get('.herkunft-druck')
    expect(druck.text()).toBe('BB')
    expect(druck.attributes('aria-hidden')).toBe('true')
    // Am Bildschirm verborgen, im Druck sichtbar (styles/app.css).
    const css = readFileSync(`${process.cwd()}/src/styles/app.css`, 'utf8')
    expect(css).toMatch(/\n\.herkunft-druck \{\s*display: none;\s*\}/)
    expect(css).toMatch(/@media print \{\s*\.herkunft-druck \{\s*display: inline;\s*\}/)
  })

  it('nicht erkannt: Text ohne Bild', () => {
    const w = blatt('Atlantis', 'flagge')
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toBe('Atlantis')
  })

  it('die Flagge bleibt unter der Zeilenhöhe: feste Höhe in em, Rand eingerechnet, Farben auch im Druck', () => {
    const css = readFileSync(`${process.cwd()}/src/styles/app.css`, 'utf8')
    const regel = css.match(/\n\.flagge \{([^}]*)\}/)?.[1] ?? ''
    const hoehe = Number(regel.match(/height: ([\d.]+)em/)?.[1])
    // Die Listen setzen ihre Zeilen mit mindestens 1 em Zeilenhöhe; die Flagge muss darunter bleiben.
    expect(hoehe).toBeGreaterThan(0.5)
    expect(hoehe).toBeLessThan(1)
    expect(regel).toMatch(/box-sizing: border-box/)
    expect(regel).toMatch(/print-color-adjust: exact/)
    expect(regel).toMatch(/border: 1px solid var\(--blatt-/)
  })
})

describe('Einstellung: Migration und Dateien', () => {
  it('alte Stände (kurz/lang, aus/kurz/lang) gelten unverändert weiter', () => {
    const alt = migrate({ ...emptyState(), listOrigin: 'kurz', ergebnisListen: { aushang: { namen: 'kurz', herkunft: 'lang' }, intern: { herkunft: 'aus' } } })!
    expect(alt.listOrigin).toBe('kurz')
    expect(alt.ergebnisListen).toEqual({ aushang: { namen: 'kurz', herkunft: 'lang' }, intern: { herkunft: 'aus' } })
    const ohne = migrate({ ...emptyState(), listOrigin: undefined, ergebnisListen: undefined })!
    expect(ohne.listOrigin).toBe('lang')
    expect(ohne.ergebnisListen).toEqual(emptyState().ergebnisListen)
  })

  it('die Flaggen-Darstellungen bleiben erhalten; Unbekanntes wird die Vorgabe', () => {
    for (const stil of ORIGIN_STYLES) {
      const geladen = migrate({ ...emptyState(), listOrigin: stil, ergebnisListen: { aushang: { namen: 'voll', herkunft: stil }, intern: { herkunft: stil } } })!
      expect(geladen.listOrigin, stil).toBe(stil)
      expect(geladen.ergebnisListen.aushang.herkunft, stil).toBe(stil)
      expect(geladen.ergebnisListen.intern.herkunft, stil).toBe(stil)
    }
    const kaputt = migrate({ ...emptyState(), listOrigin: 'emoji', ergebnisListen: { aushang: { namen: 'voll', herkunft: 'wappen' }, intern: { herkunft: 7 } } })!
    expect(kaputt.listOrigin).toBe('lang')
    expect(kaputt.ergebnisListen).toEqual(emptyState().ergebnisListen)
    expect(istOriginStyle('flagge-kurz')).toBe(true)
    expect(istOriginStyle('aus')).toBe(false)
  })

  it('Vorlage und Sicherung tragen die Einstellung', () => {
    const stand = { ...emptyState(), originMode: 'bundesland' as const, listOrigin: 'flagge-kurz' as const, ergebnisListen: { aushang: { namen: 'voll' as const, herkunft: 'flagge' as const }, intern: { herkunft: 'flagge-lang' as const } } }
    const vorlage = parseFile(JSON.stringify(makeFile('vorlage', stand, '2026-11-11T22:15:00.000Z')))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    const angewandt = vorlage.apply(emptyState())
    expect(angewandt.listOrigin).toBe('flagge-kurz')
    expect(angewandt.ergebnisListen).toEqual(stand.ergebnisListen)
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', stand, '2026-11-11T22:15:00.000Z')))
    if (!sicherung.ok || sicherung.kind !== 'sicherung') throw new Error('keine Sicherung')
    expect(sicherung.state.listOrigin).toBe('flagge-kurz')
    expect(sicherung.state.ergebnisListen).toEqual(stand.ergebnisListen)
  })
})
