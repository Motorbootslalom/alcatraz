import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBDatabase as FakeDatabase, IDBFactory } from 'fake-indexeddb'
import { createStore, type Store } from './store'
import { liesGespeichert, markeAus, STATE_KEY, VERLAUF_LEEREN_KEY } from '../persistenz/storage'
import { oeffneZweitspeicher } from '../persistenz/zweitspeicher'
import { makeFile } from '../persistenz/backup'
import { laufSchluessel } from '../lib/eingaben'
import type { VerlaufEintrag } from '../lib/verlauf'
import type { ClassId, Starter } from '../types'

// Zweiter Speicher und Verlauf im Zusammenspiel mit dem Store. Statt der IndexedDB des Browsers
// eine im Arbeitsspeicher (fake-indexeddb) – je Test eine frische. Alle Starter sind erfunden.

const starter = (id: string, klasse: ClassId): Starter => ({ id, startNr: id.toUpperCase(), vorname: 'Test', nachname: id, verein: 'Club', bundesland: 'Land', geburtsdatum: '', klasse, groesse: '' })
const START = [starter('a', '4'), starter('b', '4'), starter('c', '1')]
const eingabe = (store: Store, id: string, wert: string, lauf = 1) =>
  store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', lauf), starter: id, feld: 'zeit1', wert }] })
const wert = (store: Store, id: string, lauf = 1) => store.state.value.eingaben[laufSchluessel('manoevrieren', lauf)]?.[id]?.zeit1
const arten = (eintraege: VerlaufEintrag[]) => eintraege.map((e) => e.was.art)

let idb: IDBFactory
/** Jeder Store hört auf das `storage`-Ereignis des einen Fensters der Tests – nach dem Test nicht mehr. */
const stores: Store[] = []
const neuerStore = (um: Parameters<typeof createStore>[0]) => {
  const store = createStore(um)
  stores.push(store)
  return store
}
afterEach(() => stores.splice(0).forEach((s) => s.beende()))
/** Ein Store mit Startern, fertig geschrieben. */
async function mitStartern() {
  const store = neuerStore({ idb })
  store.dispatch({ type: 'ADD_STARTERS', starters: START })
  await store.zweit.fertig()
  return store
}
/** Was im zweiten Speicher liegt – über eine eigene Verbindung gelesen. */
async function imZweiten() {
  const db = (await oeffneZweitspeicher(idb))!
  const aktuell = await db.liesAktuell()
  const eintraege = await db.eintraege()
  db.schliesse()
  return { aktuell, eintraege }
}

beforeEach(() => {
  localStorage.clear()
  idb = new IDBFactory()
})

describe('zweiter Speicher', () => {
  it('jede Änderung liegt in beiden Speichern – derselbe Text, dieselbe Marke', async () => {
    const store = await mitStartern()
    eingabe(store, 'a', '80')
    await store.zweit.fertig()
    const { aktuell } = await imZweiten()
    const erster = liesGespeichert()
    expect(aktuell!.json).toBe(erster.json)
    expect({ folge: aktuell!.folge, zeit: aktuell!.zeit }).toEqual(erster.marke)
    expect(store.zweit.lage.value).toBe('bereit')
    expect(store.zweit.wiederhergestellt.value).toBeNull()
  })

  it('die Marke zählt mit jeder Speicherung hoch und steht nicht im Stand', async () => {
    const store = await mitStartern()
    const vorher = liesGespeichert().marke!
    eingabe(store, 'a', '80')
    expect(liesGespeichert().marke!.folge).toBe(vorher.folge + 1)
    expect(store.state.value).not.toHaveProperty('gespeichert')
    expect(liesGespeichert().state).not.toHaveProperty('gespeichert')
    // Sicherung und Vorlage kennen weder Marke noch Verlauf.
    for (const art of ['sicherung', 'vorlage', 'starter'] as const) {
      const text = JSON.stringify(makeFile(art, store.state.value, '2026-01-01T00:00:00.000Z'))
      expect(text).not.toContain('gespeichert')
      expect(text).not.toContain('verlauf')
    }
  })

  it('fehlt dem localStorage nach einem Abbruch die letzte Änderung, gilt der zweite Speicher – mit Hinweis und Zeitpunkt', async () => {
    const store = await mitStartern()
    eingabe(store, 'a', '80')
    await store.zweit.fertig()
    const alt = localStorage.getItem(STATE_KEY)!
    eingabe(store, 'a', '81')
    await store.zweit.fertig()
    const neu = liesGespeichert()
    // Der Abbruch: Die letzte Änderung hat es nicht mehr in den localStorage geschafft.
    localStorage.setItem(STATE_KEY, alt)

    const danach = neuerStore({ idb })
    expect(wert(danach, 'a')).toBe('80')
    await danach.zweit.fertig()
    expect(wert(danach, 'a')).toBe('81')
    expect(danach.zweit.wiederhergestellt.value).toEqual({ zeit: neu.marke!.zeit })
    // Beide Speicher sind wieder gleich.
    expect(localStorage.getItem(STATE_KEY)).toBe(neu.json)
    // Der verdrängte Stand ist nicht weg: Er steht im Verlauf, darüber der wiederhergestellte.
    const { eintraege } = await imZweiten()
    expect(arten(eintraege).slice(0, 2)).toEqual(['abbruch', 'verdraengt'])
    expect(eintraege[0].folge).toBe(danach.zweit.folge.value)
  })

  it('auch ein ganz leerer localStorage wird aus dem zweiten Speicher gefüllt', async () => {
    const store = await mitStartern()
    eingabe(store, 'a', '80')
    await store.zweit.fertig()
    localStorage.clear()
    const danach = neuerStore({ idb })
    await danach.zweit.fertig()
    expect(danach.state.value.starters).toHaveLength(3)
    expect(wert(danach, 'a')).toBe('80')
    expect(danach.state.value.kennung).toBe(store.state.value.kennung)
    expect(danach.zweit.wiederhergestellt.value).not.toBeNull()
    // Ein leerer Stand muss nicht aufgehoben werden.
    expect(arten((await imZweiten()).eintraege)).not.toContain('verdraengt')
  })

  it('ist der localStorage neuer, bleibt er – der zweite Speicher wird nachgezogen, ohne Hinweis', async () => {
    const store = await mitStartern()
    eingabe(store, 'a', '80')
    await store.zweit.fertig()
    // Ein Fenster ohne zweiten Speicher schreibt weiter (oder das Schreiben dort scheiterte).
    const ohne = neuerStore({ idb: null })
    eingabe(ohne, 'a', '85')
    expect((await imZweiten()).aktuell!.json).not.toBe(localStorage.getItem(STATE_KEY))

    const danach = neuerStore({ idb })
    await danach.zweit.fertig()
    expect(wert(danach, 'a')).toBe('85')
    expect(danach.zweit.wiederhergestellt.value).toBeNull()
    const { aktuell, eintraege } = await imZweiten()
    expect(aktuell!.json).toBe(localStorage.getItem(STATE_KEY))
    expect(eintraege[0].was.art).toBe('start')
  })

  it('sind beide gleich, geschieht beim Start nichts', async () => {
    await mitStartern()
    const vorher = await imZweiten()
    const text = localStorage.getItem(STATE_KEY)
    const danach = neuerStore({ idb })
    await danach.zweit.fertig()
    expect(localStorage.getItem(STATE_KEY)).toBe(text)
    expect(await imZweiten()).toEqual(vorher)
    expect(danach.zweit.wiederhergestellt.value).toBeNull()
  })

  it('ein Stand ohne Marke (vor dem zweiten Speicher) gilt, bekommt eine Marke und steht als „Stand beim Öffnen“ im Verlauf', async () => {
    const alt = await mitStartern()
    eingabe(alt, 'a', '80')
    await alt.zweit.fertig()
    // Eine ältere Fassung schreibt den Stand ohne Marke.
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...alt.state.value, eventName: 'Aus der alten Fassung' }))
    const store = neuerStore({ idb })
    await store.zweit.fertig()
    expect(store.state.value.eventName).toBe('Aus der alten Fassung')
    expect(store.zweit.wiederhergestellt.value).toBeNull()
    const { aktuell, eintraege } = await imZweiten()
    expect(liesGespeichert().marke).toEqual({ folge: aktuell!.folge, zeit: aktuell!.zeit })
    expect(aktuell!.json).toBe(localStorage.getItem(STATE_KEY))
    expect(eintraege[0].was.art).toBe('start')
  })

  it('ohne IndexedDB läuft alles wie bisher – und sagt es', async () => {
    const store = neuerStore({ idb: null })
    store.dispatch({ type: 'ADD_STARTERS', starters: START })
    eingabe(store, 'a', '80')
    await store.zweit.fertig()
    expect(store.zweit.lage.value).toBe('nicht-verfuegbar')
    expect(store.saved.value).toBe(true)
    expect(liesGespeichert().state?.starters).toHaveLength(3)
    expect(await store.zweit.eintraege()).toEqual([])
    expect(await store.zweit.merke('x')).toBe(false)
    expect(await store.zweit.stand('x')).toBeNull()
  })

  it('eine IndexedDB, die sich nicht öffnen lässt (privates Fenster), stört nicht', async () => {
    const wirft = { open: () => { throw new Error('SecurityError') } } as unknown as IDBFactory
    const scheitert = {
      open: () => {
        const r = {} as { onerror?: () => void }
        queueMicrotask(() => r.onerror?.())
        return r
      },
    } as unknown as IDBFactory
    for (const fabrik of [wirft, scheitert]) {
      const store = neuerStore({ idb: fabrik })
      store.dispatch({ type: 'ADD_STARTERS', starters: START })
      await store.zweit.fertig()
      expect(store.zweit.lage.value).toBe('nicht-verfuegbar')
      expect(store.state.value.starters).toHaveLength(3)
      localStorage.clear()
    }
  })

  it('scheitert das Schreiben, läuft die Anwendung weiter und versucht es bei der nächsten Änderung wieder', async () => {
    const store = await mitStartern()
    const original = FakeDatabase.prototype.transaction
    const kaputt = vi.spyOn(FakeDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
      if (args[1] === 'readwrite') throw new DOMException('voll', 'QuotaExceededError')
      return original.apply(this, args)
    })
    eingabe(store, 'a', '80')
    await store.zweit.fertig()
    expect(store.zweit.lage.value).toBe('gestoert')
    expect(store.saved.value).toBe(true)
    kaputt.mockRestore()
    eingabe(store, 'a', '81')
    await store.zweit.fertig()
    expect(store.zweit.lage.value).toBe('bereit')
    expect((await imZweiten()).aktuell!.json).toBe(localStorage.getItem(STATE_KEY))
  })
})

describe('mehrere Fenster', () => {
  it('ein Fenster übernimmt den Stand des anderen und dessen Folge-Nummer – ohne selbst zu schreiben', async () => {
    const a = await mitStartern()
    const b = neuerStore({ idb })
    await b.zweit.fertig()
    eingabe(a, 'a', '80')
    const text = localStorage.getItem(STATE_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: STATE_KEY }))
    expect(wert(b, 'a')).toBe('80')
    expect(localStorage.getItem(STATE_KEY)).toBe(text)
    // Die nächste Änderung von B liegt über der von A – kein Hin und Her.
    eingabe(b, 'b', '90')
    expect(liesGespeichert().marke!.folge).toBe(markeAus(text)!.folge + 1)
    window.dispatchEvent(new StorageEvent('storage', { key: STATE_KEY }))
    expect(wert(a, 'b')).toBe('90')
    await Promise.all([a.zweit.fertig(), b.zweit.fertig()])
    expect((await imZweiten()).aktuell!.json).toBe(localStorage.getItem(STATE_KEY))
  })

  it('ein zweites Fenster, das später öffnet, stellt nichts Älteres wieder her und meldet keinen Abbruch', async () => {
    const a = await mitStartern()
    eingabe(a, 'a', '80')
    await a.zweit.fertig()
    const b = neuerStore({ idb })
    eingabe(a, 'a', '81')
    await Promise.all([a.zweit.fertig(), b.zweit.fertig()])
    expect(b.zweit.wiederhergestellt.value).toBeNull()
    const { aktuell } = await imZweiten()
    expect(aktuell!.json).toBe(localStorage.getItem(STATE_KEY))
    expect(JSON.parse(aktuell!.json).eingaben[laufSchluessel('manoevrieren', 1)].a.zeit1).toBe('81')
  })

  it('der Abgleich beim Start überschreibt keinen neueren Stand eines anderen Fensters im zweiten Speicher', async () => {
    const a = await mitStartern()
    const db = (await oeffneZweitspeicher(idb))!
    const alt = (await db.liesAktuell())!
    eingabe(a, 'a', '80')
    await a.zweit.fertig()
    const neu = (await db.liesAktuell())!
    expect(await db.schreibe({ aktuell: alt, nurWennNeuer: true })).toBe(false)
    expect(await db.liesAktuell()).toEqual(neu)
    expect(await db.schreibe({ aktuell: { ...neu, folge: neu.folge + 1 }, nurWennNeuer: true })).toBe(true)
    db.schliesse()
  })

  it('schreibt ein Fenster mit älterer Fassung (Marke bleibt stehen), gilt sein Stand und bekommt eine neue Marke', async () => {
    const store = await mitStartern()
    eingabe(store, 'a', '80')
    await store.zweit.fertig()
    const vorher = liesGespeichert()
    // Die ältere Fassung trägt die Marke als unbekanntes Feld mit und schreibt sie unverändert zurück.
    localStorage.setItem(STATE_KEY, JSON.stringify({ gespeichert: { folge: 1, zeit: 5 }, ...vorher.state, eventName: 'Altes Fenster' }))
    window.dispatchEvent(new StorageEvent('storage', { key: STATE_KEY }))
    expect(store.state.value.eventName).toBe('Altes Fenster')
    expect(liesGespeichert().marke!.folge).toBe(vorher.marke!.folge + 1)
    await store.zweit.fertig()
    // Nach einem Neustart ist nichts „wiederherzustellen“.
    const danach = neuerStore({ idb })
    await danach.zweit.fertig()
    expect(danach.state.value.eventName).toBe('Altes Fenster')
    expect(danach.zweit.wiederhergestellt.value).toBeNull()
  })
})

describe('Verlauf', () => {
  it('gleichartige Eingaben sind ein Eintrag, eine andere Klasse ein neuer', async () => {
    const store = await mitStartern()
    for (const w of ['8', '80', '80,5']) {
      eingabe(store, 'a', w)
      await store.zweit.fertig()
    }
    eingabe(store, 'c', '70')
    await store.zweit.fertig()
    const eintraege = await store.zweit.eintraege()
    expect(eintraege.map((e) => [e.was.art, e.was.klasse, e.was.lauf, e.anzahl])).toEqual([
      ['eingabe', '1', 1, 1],
      ['eingabe', '4', 1, 3],
      ['starterNeu', undefined, undefined, 1],
    ])
    expect(eintraege[1].was).toEqual({ art: 'eingabe', klasse: '4', lauf: 1 })
    expect(eintraege[2].was.n).toBe(3)
  })

  it('zwei Actions eines Knopfdrucks (erst leeren, dann anlegen) sind EIN Eintrag – der Zwischenstand bleibt nicht liegen', async () => {
    const store = await mitStartern()
    await new Promise((r) => setTimeout(r, 0))
    // Wie „Beispiel-Starterfeld“: beide Actions in einem Zug.
    store.dispatch({ type: 'CLEAR_ALL_STARTERS' })
    store.dispatch({ type: 'ADD_STARTERS', starters: START.slice(0, 2), beispiel: true })
    await store.zweit.fertig()
    const eintraege = await store.zweit.eintraege()
    expect(eintraege.map((e) => e.was)).toEqual([{ art: 'beispielStarter', n: 2 }, { art: 'starterNeu', n: 3 }])
    expect(JSON.parse((await store.zweit.stand(eintraege[0].id))!).starters).toHaveLength(2)
    // Ein Augenblick später ist es wieder ein eigener Eintrag.
    await new Promise((r) => setTimeout(r, 0))
    store.dispatch({ type: 'CLEAR_ALL_STARTERS' })
    await store.zweit.fertig()
    expect((await store.zweit.eintraege()).map((e) => e.was.art)).toEqual(['starterGeloescht', 'beispielStarter', 'starterNeu'])
  })

  it('Änderungen, die schneller kommen als der Speicher schreibt, gehen nicht verloren: Der letzte Stand liegt', async () => {
    const store = await mitStartern()
    for (let i = 0; i < 30; i++) eingabe(store, 'a', String(i))
    await store.zweit.fertig()
    const { aktuell, eintraege } = await imZweiten()
    expect(aktuell!.json).toBe(localStorage.getItem(STATE_KEY))
    expect(eintraege[0]).toMatchObject({ was: { art: 'eingabe' }, anzahl: 30 })
    expect(eintraege).toHaveLength(2)
  })

  it('ein Stand lässt sich wiederherstellen – und der vorige steht danach selbst im Verlauf', async () => {
    const store = await mitStartern()
    eingabe(store, 'a', '80')
    await store.zweit.fertig()
    eingabe(store, 'c', '70')
    await store.zweit.fertig()
    const [vorn, zurueck] = await store.zweit.eintraege()

    // Zurück: wie beim Laden einer Sicherung (migrate, dann LOAD_STATE).
    const { standAus } = await import('../persistenz/storage')
    store.dispatch({ type: 'LOAD_STATE', state: standAus(await store.zweit.stand(zurueck.id))! }, { art: 'verlauf', zeit: zurueck.zeit })
    expect(wert(store, 'c')).toBeUndefined()
    expect(wert(store, 'a')).toBe('80')
    await store.zweit.fertig()
    const danach = await store.zweit.eintraege()
    expect(danach[0].was).toEqual({ art: 'verlauf', zeit: zurueck.zeit })
    expect(danach[0].folge).toBe(store.zweit.folge.value)
    // Wieder nach vorn: Der Stand von eben ist noch da.
    expect(danach.map((e) => e.id)).toContain(vorn.id)
    store.dispatch({ type: 'LOAD_STATE', state: standAus(await store.zweit.stand(vorn.id))! }, { art: 'verlauf', zeit: vorn.zeit })
    expect(wert(store, 'c')).toBe('70')
  })

  it('die Zeitpunkte der Wertungslisten bleiben wie im wiederhergestellten Stand', async () => {
    const store = await mitStartern()
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'a', feld: 'zeit1', wert: '80' }], zeit: 1000 })
    await store.zweit.fertig()
    const listenStand = store.state.value.listenStand
    const [eintrag] = await store.zweit.eintraege()
    // Eine andere Klasse: ein neuer Eintrag, der vorige behält seinen Stand.
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'c', feld: 'zeit1', wert: '81' }], zeit: 2000 })
    expect(store.state.value.listenStand).not.toEqual(listenStand)
    const { standAus } = await import('../persistenz/storage')
    store.dispatch({ type: 'LOAD_STATE', state: standAus(await store.zweit.stand(eintrag.id))! }, { art: 'verlauf', zeit: eintrag.zeit })
    expect(store.state.value.listenStand).toEqual(listenStand)
  })

  it('„Stand merken“ legt den jetzigen Stand mit Namen ab; er wird nicht fortgeschrieben und lässt sich löschen', async () => {
    const store = await mitStartern()
    eingabe(store, 'a', '80')
    expect(await store.zweit.merke('vor dem Test')).toBe(true)
    eingabe(store, 'a', '99')
    await store.zweit.fertig()
    const eintraege = await store.zweit.eintraege()
    const gemerkt = eintraege.find((e) => e.name === 'vor dem Test')!
    expect(gemerkt.was.art).toBe('gemerkt')
    expect(JSON.parse((await store.zweit.stand(gemerkt.id))!).eingaben[laufSchluessel('manoevrieren', 1)].a.zeit1).toBe('80')
    // Die Eingabe danach ist ein eigener Eintrag, obwohl sie gleichartig ist.
    expect(eintraege.filter((e) => e.was.art === 'eingabe')).toHaveLength(2)
    await store.zweit.loesche(gemerkt.id)
    expect((await store.zweit.eintraege()).some((e) => e.name)).toBe(false)
    expect(await store.zweit.stand(gemerkt.id)).toBeNull()
  })

  it('von selbst angelegte Stände weichen neueren, gemerkte bleiben', async () => {
    const store = await mitStartern()
    await store.zweit.merke('bleibt')
    // Jede Änderung ein eigener Eintrag: abwechselnd zwei Klassen.
    for (let i = 0; i < 110; i++) {
      eingabe(store, i % 2 ? 'a' : 'c', String(i))
      await store.zweit.fertig()
    }
    const eintraege = await store.zweit.eintraege()
    expect(eintraege.filter((e) => !e.name)).toHaveLength(100)
    expect(eintraege.some((e) => e.name === 'bleibt')).toBe(true)
    // Die Stände der ausgesonderten Einträge sind mit weg.
    const db = (await oeffneZweitspeicher(idb))!
    expect(await db.stand(eintraege.at(-1)!.id)).not.toBeNull()
    db.schliesse()
  })

  it('„Alles zurücksetzen“ löscht den Verlauf mit – auch die gemerkten Stände', async () => {
    const store = await mitStartern()
    eingabe(store, 'a', '80')
    await store.zweit.merke('vor dem Test')
    store.dispatch({ type: 'RESET_ALL' })
    await store.zweit.fertig()
    const { aktuell, eintraege } = await imZweiten()
    expect(arten(eintraege)).toEqual(['zurueckgesetzt'])
    expect(aktuell!.json).toBe(localStorage.getItem(STATE_KEY))
    // Nirgends im zweiten Speicher steht noch ein Name.
    const db = (await oeffneZweitspeicher(idb))!
    expect(await db.stand(eintraege[0].id)).not.toContain('"nachname"')
    expect(aktuell!.json).not.toContain('"nachname"')
    db.schliesse()
  })

  // Die Rückfrage sagt zu, dass der Verlauf gelöscht wird. Scheitert genau dieser Schreibvorgang,
  // darf das Leeren nicht verloren gehen: Sonst lägen die Namen der vorigen Veranstaltung weiter da.
  describe('scheitert das Schreiben genau beim Zurücksetzen', () => {
    /** Setzt zurück, während der zweite Speicher nichts annimmt; danach nimmt er wieder an. */
    async function zurueckgesetztMitStoerung() {
      const store = await mitStartern()
      eingabe(store, 'a', '80')
      await store.zweit.merke('vor dem Test')
      const original = FakeDatabase.prototype.transaction
      const kaputt = vi.spyOn(FakeDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
        if (args[1] === 'readwrite') throw new DOMException('voll', 'QuotaExceededError')
        return original.apply(this, args)
      })
      store.dispatch({ type: 'RESET_ALL' })
      await store.zweit.fertig()
      kaputt.mockRestore()
      expect(store.zweit.lage.value).toBe('gestoert')
      // Noch liegt alles da – und der Merker sagt, dass das Leeren aussteht.
      expect((await imZweiten()).eintraege.some((e) => e.name === 'vor dem Test')).toBe(true)
      expect(localStorage.getItem(VERLAUF_LEEREN_KEY)).not.toBeNull()
      return store
    }
    const ohneNamen = async () => {
      const { aktuell, eintraege } = await imZweiten()
      const db = (await oeffneZweitspeicher(idb))!
      const texte = await Promise.all(eintraege.map((e) => db.stand(e.id)))
      db.schliesse()
      expect(eintraege.filter((e) => e.name)).toEqual([])
      expect(texte.join('') + (aktuell?.json ?? '')).not.toContain('"nachname"')
      expect(localStorage.getItem(VERLAUF_LEEREN_KEY)).toBeNull()
      return { aktuell, eintraege }
    }

    it('holt die nächste Änderung das Leeren nach', async () => {
      const store = await zurueckgesetztMitStoerung()
      store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Neu' } })
      await store.zweit.fertig()
      expect(store.zweit.lage.value).toBe('bereit')
      const { aktuell, eintraege } = await ohneNamen()
      expect(eintraege).toHaveLength(1)
      expect(aktuell!.json).toBe(localStorage.getItem(STATE_KEY))
    })

    it('räumt der nächste Start auf, wenn das Fenster vorher geschlossen wurde', async () => {
      const store = await zurueckgesetztMitStoerung()
      store.beende()
      const neu = neuerStore({ idb })
      await neu.zweit.fertig()
      expect(neu.state.value.starters).toHaveLength(0)
      // Kein „nach einem Abbruch wiederhergestellt“: Der alte Stand im zweiten Speicher gilt nicht mehr.
      expect(neu.zweit.wiederhergestellt.value).toBeNull()
      const { aktuell } = await ohneNamen()
      expect(aktuell!.json).toBe(localStorage.getItem(STATE_KEY))
    })

    it('nimmt „Stand merken“ das Leeren mit – der gemerkte Stand bleibt', async () => {
      const store = await zurueckgesetztMitStoerung()
      expect(await store.zweit.merke('neu angefangen')).toBe(true)
      const { eintraege } = await imZweiten()
      expect(eintraege.map((e) => e.name)).toEqual(['neu angefangen'])
      expect(localStorage.getItem(VERLAUF_LEEREN_KEY)).toBeNull()
      // Die nächste Änderung leert nicht noch einmal.
      store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Neu' } })
      await store.zweit.fertig()
      expect((await imZweiten()).eintraege.some((e) => e.name === 'neu angefangen')).toBe(true)
    })
  })

  it('ein verworfener Scan (stelleHer) hinterlässt keinen eigenen Eintrag', async () => {
    const store = await mitStartern()
    const vorher = store.state.value
    eingabe(store, 'a', '8')
    store.stelleHer(vorher)
    await store.zweit.fertig()
    const { aktuell } = await imZweiten()
    expect(aktuell!.json).toBe(localStorage.getItem(STATE_KEY))
    expect(JSON.parse(aktuell!.json).eingaben).toEqual({})
  })
})
