import { describe, expect, it } from 'vitest'
import { adressbuch, ADRESSEN, liesAdresse, schreibeAdresse, VIEWS, wortraum, type AdressTabelle } from './adressen'
import { LOCALES } from '../i18n'

describe('Wörter der Adresse', () => {
  it('schreibt je Sprache das eigene Wort und liest jede Sprache', () => {
    const raum = wortraum({ de: { listen: 'listen', starter: 'starter' }, en: { listen: 'lists', starter: 'competitors' } })
    expect(raum.schreibe.de).toEqual({ listen: 'listen', starter: 'starter' })
    expect(raum.schreibe.en).toEqual({ listen: 'lists', starter: 'competitors' })
    expect(raum.lies).toMatchObject({ listen: 'listen', lists: 'listen', starter: 'starter', competitors: 'starter' })
    expect(raum.ersetzt).toEqual([])
    expect(raum.fehler).toEqual([])
  })

  it('dasselbe Wort für dasselbe Ziel in zwei Sprachen ist eindeutig', () => {
    const raum = wortraum({ de: { codes: 'codes' }, en: { codes: 'codes' } })
    expect(raum.ersetzt).toEqual([])
    expect(raum.lies.codes).toBe('codes')
  })

  it('eine dritte Sprache, deren Wort mit einer anderen Sprache kollidiert, schreibt das englische', () => {
    // Erfunden: „listen“ hieße in xx die Erfassung – deutsch ist es die Ansicht „Listen“.
    const raum = wortraum({
      de: { listen: 'listen', erfassung: 'erfassung', starter: 'starter' },
      en: { listen: 'lists', erfassung: 'entry', starter: 'competitors' },
      xx: { listen: 'lista', erfassung: 'Listen', starter: 'startoj' },
    })
    // Beide Sprachen, die das mehrdeutige Wort führen, weichen für ihr Ziel auf Englisch aus.
    expect(raum.schreibe.xx).toEqual({ listen: 'lista', erfassung: 'entry', starter: 'startoj' })
    expect(raum.schreibe.de).toEqual({ listen: 'lists', erfassung: 'erfassung', starter: 'starter' })
    expect(raum.schreibe.en).toEqual({ listen: 'lists', erfassung: 'entry', starter: 'competitors' })
    expect(raum.ersetzt).toEqual([
      { sprache: 'de', ziel: 'listen', wort: 'listen' },
      { sprache: 'xx', ziel: 'erfassung', wort: 'listen' },
    ])
    // Das mehrdeutige Wort schreibt niemand mehr. Gelesen gilt zuletzt der interne Name.
    expect(raum.lies.listen).toBe('listen')
    expect(raum.lies).toMatchObject({ lista: 'listen', lists: 'listen', entry: 'erfassung', erfassung: 'erfassung', startoj: 'starter' })
    expect(raum.fehler).toEqual([])
  })

  it('kollidiert ein Wort mit einem englischen, gewinnt beim Lesen das englische Ziel', () => {
    const raum = wortraum({
      en: { listen: 'lists', erfassung: 'entry' },
      xx: { listen: 'entry', erfassung: 'enigo' },
    })
    expect(raum.schreibe.xx).toEqual({ listen: 'lists', erfassung: 'enigo' })
    expect(raum.lies.entry).toBe('erfassung')
    expect(raum.lies.enigo).toBe('erfassung')
  })

  it('mehrdeutig innerhalb einer Sprache: beide Ziele schreiben englisch', () => {
    const raum = wortraum({ en: { a: 'one', b: 'two' }, xx: { a: 'same', b: 'same' } })
    expect(raum.schreibe.xx).toEqual({ a: 'one', b: 'two' })
    expect(raum.lies.same).toBeUndefined()
  })

  it('fehlt einer Sprache ein Wort, gilt das englische', () => {
    const raum = wortraum({ en: { a: 'one', b: 'two' }, xx: { a: 'unu' } })
    expect(raum.schreibe.xx).toEqual({ a: 'unu', b: 'two' })
  })

  it('meldet, was auch der Fallback nicht löst', () => {
    expect(wortraum({ en: { a: 'same', b: 'same' } }).fehler).toHaveLength(1)
  })

  it('kollidieren zwei Sprachen bei Zielen, für die Englisch kein Wort hat: Fehler, und keine schreibt das mehrdeutige Wort', () => {
    const raum = wortraum({ en: { a: 'alpha' }, de: { a: 'eins', b: 'foo' }, xx: { a: 'aa', c: 'foo' } })
    expect(raum.schreibe.de).toEqual({ a: 'eins' })
    expect(raum.schreibe.xx).toEqual({ a: 'aa' })
    expect(raum.lies.foo).toBeUndefined()
    // Gemeldet statt als „ersetzt“ behauptet: Es gab kein Wort zum Ersetzen.
    expect(raum.ersetzt).toEqual([])
    expect(raum.fehler).toHaveLength(2)
    // Die internen Namen bleiben lesbar – geschrieben wird dann der interne Name.
    expect(raum.lies).toMatchObject({ b: 'b', c: 'c' })
    // Ebenso ganz ohne Fallback-Sprache in den Tabellen.
    expect(wortraum({ de: { b: 'foo' }, xx: { c: 'foo' } }).fehler).toHaveLength(2)
  })

  it('ein leeres Wort zählt wie ein fehlendes', () => {
    const raum = wortraum({ en: { a: 'one', b: 'two' }, xx: { a: '', b: '  ' } })
    expect(raum.schreibe.xx).toEqual({ a: 'one', b: 'two' })
    expect(raum.lies['']).toBeUndefined()
    expect(raum.fehler).toEqual([])
  })
})

describe('Tabellen der Sprachen', () => {
  const buch = adressbuch(ADRESSEN)
  const raeume = [buch.ansichten, buch.ziele, ...Object.values(buch.reiter)]

  it('jede Sprache der Oberfläche hat ihre Tabelle', () => {
    expect(Object.keys(ADRESSEN).sort()).toEqual(LOCALES.map((l) => l.id).sort())
  })

  it('de und en sind heute eindeutig: Nirgends springt der Fallback ein', () => {
    for (const raum of raeume) {
      expect(raum.ersetzt).toEqual([])
      expect(raum.fehler).toEqual([])
    }
    expect(buch.ansichten.schreibe.de).toEqual(ADRESSEN.de.ansichten)
    expect(buch.ansichten.schreibe.en).toEqual(ADRESSEN.en.ansichten)
    expect(buch.reiter.listen.schreibe.de).toEqual(ADRESSEN.de.reiter.listen)
    expect(buch.reiter.listen.schreibe.en).toEqual(ADRESSEN.en.reiter.listen)
  })

  it('die Wörter lassen sich abtippen: klein, ohne Umlaute, Leerzeichen und Sonderzeichen der Adresse', () => {
    for (const raum of raeume) for (const woerter of Object.values(raum.schreibe)) for (const wort of Object.values(woerter)) expect(wort).toMatch(/^[a-z0-9-]+$/)
  })

  it('schreibt in der Sprache der Oberfläche und liest beide', () => {
    expect(schreibeAdresse(buch, 'de', 'listen', { reiter: 'wkr' })).toBe('#/listen/wkr')
    expect(schreibeAdresse(buch, 'en', 'listen', { reiter: 'wkr' })).toBe('#/lists/judges')
    expect(schreibeAdresse(buch, 'en', 'einstellungen', { ziel: 'ergebnislisten' })).toBe('#/settings?result-lists')
    expect(schreibeAdresse(buch, 'de', 'veranstaltung', { ziel: 'wkr' })).toBe('#/veranstaltung?wkr')
    expect(schreibeAdresse(buch, 'en', 'veranstaltung', { ziel: 'besetzung' })).toBe('#/event?assignments')
    expect(schreibeAdresse(buch, 'en', 'verzahnung', { reiter: 'manoever' })).toBe('#/interleaving/manoeuvring')
    for (const sprache of ['de', 'en']) {
      for (const view of VIEWS) expect(liesAdresse(buch, schreibeAdresse(buch, sprache, view))).toEqual({ view, reiter: '', ziel: '' })
    }
    expect(liesAdresse(buch, '#/lists/judges')).toEqual({ view: 'listen', reiter: 'wkr', ziel: '' })
    expect(liesAdresse(buch, '#/Listen/WKR')).toEqual({ view: 'listen', reiter: 'wkr', ziel: '' })
    expect(liesAdresse(buch, '#/settings?scoring')).toEqual({ view: 'einstellungen', reiter: '', ziel: 'wertung' })
    expect(liesAdresse(buch, '#/event?judges')).toEqual({ view: 'veranstaltung', reiter: '', ziel: 'wkr' })
    // Die WKR-Einteilung stand unter „Einstellungen“: Der alte Verweis führt zur Veranstaltung – in jeder Sprache.
    expect(liesAdresse(buch, '#/einstellungen?wkr')).toEqual({ view: 'veranstaltung', reiter: '', ziel: 'wkr' })
    expect(liesAdresse(buch, '#/settings?judges')).toEqual({ view: 'veranstaltung', reiter: '', ziel: 'wkr' })
    // Ohne die Tabelle der Umzüge bliebe er, wo er war; andere Ziele der Einstellungen bleiben dort.
    expect(liesAdresse(buch, '#/einstellungen?wkr', { reiter: {}, ziele: {} }).view).toBe('einstellungen')
    expect(liesAdresse(buch, '#/einstellungen?dateien').view).toBe('einstellungen')
    // Verweise mit den internen Namen gehen weiter.
    expect(liesAdresse(buch, '#/listen/starter').reiter).toBe('starter')
    expect(liesAdresse(buch, '#/listen/pokal').reiter).toBe('pokal')
  })

  it('die Mannschaftswertung steht mit dem Wort der Regelbücher in der Adresse; die früheren Wörter werden weiter gelesen', () => {
    expect(schreibeAdresse(buch, 'de', 'listen', { reiter: 'pokal' })).toBe('#/listen/mannschaftswertung')
    expect(schreibeAdresse(buch, 'en', 'listen', { reiter: 'pokal' })).toBe('#/lists/team-competition')
    // Die Druckdatei steht direkt dahinter; gelesen wird jede Sprache.
    expect(schreibeAdresse(buch, 'de', 'listen', { reiter: 'druckdatei' })).toBe('#/listen/druckdatei')
    expect(schreibeAdresse(buch, 'en', 'listen', { reiter: 'druckdatei' })).toBe('#/lists/results-booklet')
    expect(liesAdresse(buch, '#/listen/results-booklet').reiter).toBe('druckdatei')
    expect(schreibeAdresse(buch, 'de', 'einstellungen', { ziel: 'pokal' })).toBe('#/einstellungen?mannschaftswertung')
    expect(schreibeAdresse(buch, 'en', 'einstellungen', { ziel: 'pokal' })).toBe('#/settings?team-competition')
    for (const alt of ['#/listen/pokal', '#/lists/team-ranking', '#/listen/team-ranking', '#/lists/Team-Ranking']) expect(liesAdresse(buch, alt), alt).toEqual({ view: 'listen', reiter: 'pokal', ziel: '' })
    for (const alt of ['#/einstellungen?pokal', '#/settings?team-ranking']) expect(liesAdresse(buch, alt), alt).toEqual({ view: 'einstellungen', reiter: '', ziel: 'pokal' })
    // Kein Wort wird mehr geschrieben, das „Pokal“ oder „ranking“ heißt.
    for (const raum of [buch.reiter.listen, buch.ziele]) for (const woerter of Object.values(raum.schreibe)) expect(Object.values(woerter).join(' ')).not.toMatch(/pokal|ranking/)
  })

  it('ein Reiter „Starterlisten“: Die Adressen der beiden früheren Reiter führen dorthin und nennen die Art', () => {
    expect(schreibeAdresse(buch, 'de', 'listen', { reiter: 'starter' })).toBe('#/listen/starterlisten')
    expect(schreibeAdresse(buch, 'en', 'listen', { reiter: 'starter' })).toBe('#/lists/competitor-lists')
    for (const alt of ['#/listen/verzahnt', '#/lists/interleaved', '#/listen/interleaved']) expect(liesAdresse(buch, alt), alt).toEqual({ view: 'listen', reiter: 'starter', ziel: '', art: 'verzahnt' })
    for (const alt of ['#/listen/nach-klasse', '#/lists/by-class', '#/listen/byClass']) expect(liesAdresse(buch, alt), alt).toEqual({ view: 'listen', reiter: 'starter', ziel: '', art: 'klasse' })
    // Die heutigen Wörter nennen keine Art: Es gilt die gemerkte.
    expect(liesAdresse(buch, '#/listen/starterlisten')).toEqual({ view: 'listen', reiter: 'starter', ziel: '' })
    // Ein früheres Wort gilt nur in seiner Ansicht.
    expect(liesAdresse(buch, '#/verzahnung/verzahnt').reiter).toBe('verzahnt')
  })

  it('Unbekanntes bleibt, wie es dasteht; ohne Ansicht gibt es keine', () => {
    expect(liesAdresse(buch, '')).toEqual({ view: undefined, reiter: '', ziel: '' })
    expect(liesAdresse(buch, '#/quatsch/x')).toEqual({ view: undefined, reiter: 'x', ziel: '' })
    expect(liesAdresse(buch, '#/listen/gibt-es-nicht?was')).toEqual({ view: 'listen', reiter: 'gibt-es-nicht', ziel: 'was' })
    expect(liesAdresse(buch, '#/listen/%E0%A4%A')).toMatchObject({ view: 'listen' })
  })

  it('eine weitere Sprache ist nur eine weitere Tabelle – ihre Kollision löst der Fallback', () => {
    const xx: AdressTabelle = {
      ...ADRESSEN.en,
      // Erfunden: „starter“ hieße in xx die Ansicht „Listen“.
      ansichten: { ...ADRESSEN.en.ansichten, listen: 'starter', starter: 'startoj' },
    }
    const mit = adressbuch({ ...ADRESSEN, xx })
    expect(schreibeAdresse(mit, 'xx', 'listen')).toBe('#/lists')
    expect(schreibeAdresse(mit, 'xx', 'starter')).toBe('#/startoj')
    // Auch die deutsche Adresse weicht aus – sonst läse xx sie falsch.
    expect(schreibeAdresse(mit, 'de', 'starter')).toBe('#/competitors')
    expect(liesAdresse(mit, '#/startoj').view).toBe('starter')
    // Eine Sprache ohne Tabelle schreibt englisch.
    expect(schreibeAdresse(mit, 'yy', 'listen')).toBe('#/lists')
  })
})
