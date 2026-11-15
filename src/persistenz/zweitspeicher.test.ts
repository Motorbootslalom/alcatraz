import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { oeffneZweitspeicher, ZWEIT_DB, type Zweitspeicher } from './zweitspeicher'
import type { VerlaufEintrag } from '../lib/verlauf'

// Der zweite Speicher für sich, mit einer IndexedDB im Arbeitsspeicher. Die Texte sind erfunden.

const eintrag = (id: string, zeit: number, teil: Partial<VerlaufEintrag> = {}): VerlaufEintrag => ({ id, von: zeit, zeit, was: { art: 'einstellung' }, anzahl: 1, groesse: 2, folge: zeit, ...teil })
let idb: IDBFactory
let db: Zweitspeicher

/** Alle Schlüssel des Speichers für die Texte – so viele Texte liegen wirklich. */
function textSchluessel(): Promise<IDBValidKey[]> {
  return new Promise((ok) => {
    const r = idb.open(ZWEIT_DB)
    r.onsuccess = () => {
      const q = r.result.transaction('verlaufStand').objectStore('verlaufStand').getAllKeys()
      q.onsuccess = () => {
        r.result.close()
        ok(q.result)
      }
    }
  })
}

beforeEach(async () => {
  idb = new IDBFactory()
  db = (await oeffneZweitspeicher(idb))!
})

describe('zweiter Speicher (IndexedDB)', () => {
  it('ist anfangs leer', async () => {
    expect(await db.liesAktuell()).toBeNull()
    expect(await db.eintraege()).toEqual([])
    expect(await db.stand('x')).toBeNull()
  })

  it('ohne IndexedDB gibt es keinen – ohne Fehler', async () => {
    expect(await oeffneZweitspeicher(undefined)).toBeNull()
    expect(await oeffneZweitspeicher(null)).toBeNull()
  })

  it('antwortet die IndexedDB gar nicht, wird nicht ewig gewartet', async () => {
    const stumm = { open: () => ({}) } as unknown as IDBFactory
    expect(await oeffneZweitspeicher(stumm, 10)).toBeNull()
  })

  it('der jetzige Stand liegt beim Eintrag des Verlaufs – der Text nur einmal', async () => {
    await db.schreibe({ aktuell: { folge: 1, zeit: 10, json: '{"a":1}' }, eintraege: [{ eintrag: eintrag('e1', 10), json: '{"a":1}' }] })
    expect(await db.liesAktuell()).toEqual({ folge: 1, zeit: 10, json: '{"a":1}' })
    expect(await textSchluessel()).toEqual(['e1'])
    // Fortgeschrieben: derselbe Eintrag, neuer Text.
    await db.schreibe({ aktuell: { folge: 2, zeit: 11, json: '{"a":2}' }, eintraege: [{ eintrag: eintrag('e1', 11), json: '{"a":2}' }] })
    expect(await db.liesAktuell()).toEqual({ folge: 2, zeit: 11, json: '{"a":2}' })
    expect(await db.stand('e1')).toBe('{"a":2}')
    expect(await textSchluessel()).toEqual(['e1'])
  })

  it('ohne Eintrag liegt der jetzige Stand für sich – und räumt sich weg, sobald wieder ein Eintrag ihn trägt', async () => {
    await db.schreibe({ aktuell: { folge: 1, zeit: 10, json: '{"a":1}' } })
    expect(await db.liesAktuell()).toEqual({ folge: 1, zeit: 10, json: '{"a":1}' })
    expect(await db.eintraege()).toEqual([])
    expect(await textSchluessel()).toHaveLength(1)
    await db.schreibe({ aktuell: { folge: 2, zeit: 11, json: '{"a":2}' }, eintraege: [{ eintrag: eintrag('e1', 11), json: '{"a":2}' }] })
    expect(await textSchluessel()).toEqual(['e1'])
  })

  it('der Eintrag, auf dem der jetzige Stand liegt, lässt sich nicht löschen', async () => {
    await db.schreibe({ eintraege: [{ eintrag: eintrag('alt', 5), json: '{"a":0}' }] })
    await db.schreibe({ aktuell: { folge: 1, zeit: 10, json: '{"a":1}' }, eintraege: [{ eintrag: eintrag('e1', 10), json: '{"a":1}' }] })
    await db.loesche(['alt', 'e1'])
    expect((await db.eintraege()).map((e) => e.id)).toEqual(['e1'])
    expect(await db.liesAktuell()).toEqual({ folge: 1, zeit: 10, json: '{"a":1}' })
    expect(await db.stand('alt')).toBeNull()
  })

  it('„leeren“ nimmt alle Einträge und Texte mit, der neue Stand bleibt', async () => {
    await db.schreibe({ aktuell: { folge: 1, zeit: 10, json: '{"a":1}' }, eintraege: [{ eintrag: eintrag('e1', 10, { name: 'gemerkt' }), json: '{"a":1}' }] })
    await db.schreibe({ leeren: true, aktuell: { folge: 2, zeit: 20, json: '{}' }, eintraege: [{ eintrag: eintrag('neu', 20), json: '{}' }] })
    expect((await db.eintraege()).map((e) => e.id)).toEqual(['neu'])
    expect(await textSchluessel()).toEqual(['neu'])
    expect(await db.liesAktuell()).toEqual({ folge: 2, zeit: 20, json: '{}' })
  })

  it('„nur wenn neuer“ lässt einen neueren Stand liegen – samt Verlauf', async () => {
    await db.schreibe({ aktuell: { folge: 5, zeit: 50, json: '{"a":5}' } })
    expect(await db.schreibe({ nurWennNeuer: true, aktuell: { folge: 4, zeit: 99, json: '{"a":4}' }, eintraege: [{ eintrag: eintrag('e4', 99), json: '{"a":4}' }] })).toBe(false)
    expect(await db.liesAktuell()).toEqual({ folge: 5, zeit: 50, json: '{"a":5}' })
    expect(await db.eintraege()).toEqual([])
    expect(await db.schreibe({ nurWennNeuer: true, aktuell: { folge: 6, zeit: 1, json: '{"a":6}' } })).toBe(true)
    expect((await db.liesAktuell())!.json).toBe('{"a":6}')
  })

  it('die Einträge kommen jüngste zuerst', async () => {
    await db.schreibe({ eintraege: [3, 9, 6].map((z) => ({ eintrag: eintrag(`e${z}`, z), json: '{}' })) })
    expect((await db.eintraege()).map((e) => e.id)).toEqual(['e9', 'e6', 'e3'])
  })
})
