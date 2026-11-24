import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BogenBlatt from './BogenBlatt.vue'
import { configFor } from '../../config/konfig'
import { musterZeilen, type BogenAuftrag } from '../../lib/bogen'
import { createStore, storeKey } from '../../state/store'
import { logoFolge, setzeTestLogos } from '../../testHilfen'

// Die Zeilen des Bogens selbst – im Fuß stecken weitere Tabellen (Legende).
const ZEILEN = '.bogen-tabelle > tbody > tr'

const dm = configFor({ regelwerk: 'dm-2026' })
const auftrag = (typeId: string, mehr: Partial<BogenAuftrag> = {}): BogenAuftrag => ({
  typeId,
  klassen: ['7'],
  lauf: 3,
  zeilen: musterZeilen(4, 'M'),
  eventName: 'Hafenpokal 2026',
  aufbauId: 'alcatraz',
  wkr: 'A. Muster',
  ...mehr,
})

describe('BogenBlatt', () => {
  it('zeichnet jede Position jedes Aufbaus in beiden Regelwerken, ohne zu stolpern', () => {
    for (const konfig of [dm, configFor({ regelwerk: 'uim-2026', sprache: 'en' })]) {
      for (const a of konfig.getAufbauten()) {
        for (const typeId of a.order) {
          const klasse = konfig.regelwerk.klassen.filter((k) => konfig.positionAllowsClass(typeId, k)).at(-1)
          if (!klasse) continue
          const wrapper = mount(BogenBlatt, { props: { konfig, auftrag: auftrag(typeId, { klassen: [klasse], aufbauId: a.id }) } })
          const def = konfig.getSheetDef(typeId)
          expect(wrapper.find('.bk-liste').text(), typeId).toBe(def.title)
          expect(wrapper.findAll(ZEILEN), typeId).toHaveLength(7)
          expect(wrapper.find('.bogen').classes(), typeId).toContain(def.orientation === 'landscape' ? 'bogen--quer' : 'bogen--hoch')
          wrapper.unmount()
        }
      }
    }
  })

  it('Kopf, zweizeilige Spaltenköpfe, Trenner, Legende, Bild und Unterschrift', () => {
    const wrapper = mount(BogenBlatt, { props: { konfig: dm, auftrag: auftrag('gate135', { parcours: 'Parcours 2' }) } })
    expect(wrapper.find('.bk-titel').text()).toBe('Hafenpokal 2026')
    expect(wrapper.findAll('.bk-zelle').map((z) => z.text())).toEqual(['Tor 1 / 3 / 5', 'Klasse 7', '3. Lauf', 'Parcours 2'])
    // Ohne Pflege steht der Name als Text, nicht als Feld.
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('.bk-wkr-text').text()).toBe('A. Muster')
    const kopfzeilen = wrapper.findAll('.bogen-tabelle > thead > tr')
    expect(kopfzeilen).toHaveLength(3)
    expect(kopfzeilen[1].find('th').text()).toBe('Nr.')
    expect(kopfzeilen[1].findAll('th.bt-gruppe').length).toBeGreaterThan(3)
    expect(kopfzeilen[2].findAll('th.bt-sub').length).toBe(wrapper.findAll(`${ZEILEN}:first-child > td`).length - 1 - 3)
    expect(wrapper.find('.bl-disq').exists()).toBe(true)
    expect(wrapper.find('.bl-note').text()).not.toBe('')
    expect(wrapper.find('.bogen').classes()).toContain('bogen--gedreht')
    expect(wrapper.find('.bogen-bild svg').attributes('aria-label')).toBe('Tor 1 / 3 / 5 – Klasse 7')
    expect(wrapper.find('.bu-text').text()).toBe('Unterschrift WKR')
    // Ohne Kennzeichen ist es eine echte Liste.
    expect(wrapper.find('.bogen-kennzeichen').exists()).toBe(false)
    expect(wrapper.find('.bogen').attributes('data-muster')).toBeUndefined()
    wrapper.unmount()
  })

  it('Steg: zwei Fehlerblöcke nebeneinander; der Name steht als Text im Kopf, ohne Namen die leere Linie', () => {
    const wrapper = mount(BogenBlatt, { props: { konfig: dm, auftrag: auftrag('steg') } })
    expect(wrapper.findAll('.bl-grouptitle')).toHaveLength(2)
    expect(wrapper.findAll('.bl-grouptitle').every((th) => th.text() !== '')).toBe(true)
    // Gepflegt wird der Name nur in der WKR-Einteilung: im Kopf kein Eingabefeld (Entscheidung vom 15.11.2026).
    expect(wrapper.find('.bogen-kopf input').exists()).toBe(false)
    expect(wrapper.find('.bk-wkr-text').text()).toBe('A. Muster')
    expect(wrapper.find('.bk-wkr-unter').text()).toBe('Name Wettkampfrichter*in')
    wrapper.unmount()
    const leer = mount(BogenBlatt, { props: { konfig: configFor({ regelwerk: 'uim-2026', sprache: 'en' }), auftrag: auftrag('steg', { wkr: '' }) } })
    expect(leer.find('.bk-wkr-text').text()).toBe('')
    expect(leer.find('.bk-wkr-unter').text()).toBe('Name of race official')
    leer.unmount()
  })

  it('feste Zeilenzahl je Seite: mehrere Blätter mit Seitenangabe', () => {
    const wrapper = mount(BogenBlatt, {
      props: { konfig: dm, auftrag: auftrag('steg', { zeilen: musterZeilen(24, 'M') }), optionen: { zeilenJeSeite: 10, leerzeilen: 0 } },
    })
    expect(wrapper.findAll('.bogen').map((b) => b.attributes('data-seite'))).toEqual(['1', '2', '3'])
    expect(wrapper.findAll('.bogen-seitenzahl').map((s) => s.text())).toEqual(['Seite 1 / 3', 'Seite 2 / 3', 'Seite 3 / 3'])
    wrapper.unmount()
  })

  it('Beschreibung auf der Rückseite: vorn der Hinweis, hinten Legende und Bild', () => {
    const wrapper = mount(BogenBlatt, { props: { konfig: dm, auftrag: auftrag('gate135'), rueckseite: true, kennzeichen: 'Beispielansicht' } })
    const [vorn, hinten] = wrapper.findAll('.bogen')
    expect(vorn.find('.bl').exists()).toBe(false)
    expect(vorn.find('.bogen-rueckhinweis').text()).toContain('Rückseite')
    expect(hinten.classes()).toContain('bogen--rueck')
    expect(hinten.find('.bogen-rueck-seite').classes()).toContain('bogen-rueck-seite--flip')
    expect(hinten.find('.bl-disq').exists()).toBe(true)
    expect(hinten.find('.bogen-bild').exists()).toBe(true)
    // Auch die Rückseite einer Beispielansicht ist gekennzeichnet.
    expect(hinten.attributes('data-muster')).toBeDefined()
    // Eine Liste ohne Beschreibung bekommt eine leere Rückseite, damit Vorder- und Rückseiten zusammenbleiben.
    const zeit = mount(BogenBlatt, { props: { konfig: dm, auftrag: auftrag('zeit'), rueckseite: true } })
    expect(zeit.findAll('.bogen')).toHaveLength(2)
    expect(zeit.find('.bogen-rueckhinweis').exists()).toBe(false)
    expect(zeit.find('.bogen--rueck .bl').exists()).toBe(false)
    wrapper.unmount()
    zeit.unmount()
  })

  it('mehrere Klassen: eine Spalte nennt die Klasse, fremde Spalten sind gesperrt', () => {
    const zeilen = [
      { nr: 'M1', klasse: '4' },
      { nr: 'M2', klasse: '7' },
    ]
    const wrapper = mount(BogenBlatt, { props: { konfig: dm, auftrag: auftrag('gate135', { klassen: ['4', '7'], zeilen }), optionen: { leerzeilen: 0 } } })
    expect(wrapper.find('thead th.bt-klasse').text()).toBe('Kl.')
    expect(wrapper.findAll(`${ZEILEN} > td.bt-klasse`).map((td) => td.text())).toEqual(['4', '7'])
    const zeile = wrapper.findAll(ZEILEN)
    expect(zeile[0].find('td[data-spalte="speed2"]').classes()).toContain('bt-entfaellt')
    expect(zeile[1].find('td[data-spalte="speed2"]').classes()).not.toContain('bt-entfaellt')
    // Kurze Klassennamen brauchen nur die schmale Spalte.
    expect(wrapper.find('col.bt-cg-klasse').classes()).not.toContain('bt-cg-klasse--breit')
    wrapper.unmount()
  })

  // Prüfbefund 24.11.2026 (Klassen in der Startfolge, auch unter UIM): Klasse E heißt dort „Dolphin“ – die Spalte wird
  // breit, ihr Kopf folgt der Listensprache.
  it('UIM: „Dolphin“ in einer breiten Spalte „Cl.“', () => {
    const uim = configFor({ regelwerk: 'uim-2026', sprache: 'en' })
    const zeilen = [
      { nr: 'E01', klasse: 'E' },
      { nr: '201', klasse: '2' },
    ]
    const wrapper = mount(BogenBlatt, { props: { konfig: uim, auftrag: auftrag('steg', { klassen: ['E', '2'], zeilen }), optionen: { leerzeilen: 0 } } })
    expect(wrapper.find('thead th.bt-klasse').text()).toBe('Cl.')
    expect(wrapper.findAll(`${ZEILEN} > td.bt-klasse`).map((td) => td.text())).toEqual(['Dolphin', '2'])
    expect(wrapper.find('col.bt-cg-klasse').classes()).toContain('bt-cg-klasse--breit')
    wrapper.unmount()
  })

  it('QR-Code: im Kopf jeder Druckseite, mit ihrer Seite – als Vektor, schwarz auf weiß; ohne Angabe keiner', () => {
    const ohne = mount(BogenBlatt, { props: { konfig: dm, auftrag: auftrag('steg') } })
    expect(ohne.find('svg.qr-code').exists()).toBe(false)
    expect(ohne.find('.bogen-kopf').classes()).not.toContain('bogen-kopf--qr')
    ohne.unmount()

    const qr = 'ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.7.3.STEG'
    const wrapper = mount(BogenBlatt, { props: { konfig: dm, auftrag: auftrag('steg', { qr, zeilen: musterZeilen(7, 'M') }), optionen: { zeilenJeSeite: 3, leerzeilen: 0 }, rueckseite: true } })
    const koepfe = wrapper.findAll('.bogen-kopf')
    expect(koepfe).toHaveLength(3)
    expect(koepfe.map((k) => k.find('svg.qr-code').attributes('data-qr'))).toEqual([`${qr}.S1`, `${qr}.S2`, `${qr}.S3`])
    const svg = koepfe[0].find('svg.qr-code')
    expect(svg.classes()).toContain('bk-qr')
    expect(svg.find('rect').attributes('fill')).toBe('#fff')
    expect(svg.find('path').attributes('fill')).toBe('#000')
    expect(svg.find('path').attributes('d')).toMatch(/^M\d+ \d+h\d+v1h-\d+z/)
    // Die Kennung lässt sich ablesen (Maus auf dem Code) und für Vorleseprogramme nennen.
    expect(svg.find('title').text()).toBe(`${qr}.S1`)
    // Die Rückseiten tragen keinen eigenen Code: Sie gehören zu ihrer Vorderseite.
    expect(wrapper.findAll('svg.qr-code')).toHaveLength(3)
    // Die Seitenzahl meldet der Bogen für die Laufzettel.
    expect(wrapper.emitted('seiten')?.at(-1)).toEqual([3])
    wrapper.unmount()
  })
})

describe('BogenBlatt: Logos in der Titelleiste (16.11.2026)', () => {
  const qr = 'ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.7.3.STEG'
  const props = { konfig: dm, auftrag: auftrag('steg', { qr, zeilen: musterZeilen(7, 'M') }), optionen: { zeilenJeSeite: 3, leerzeilen: 0 }, rueckseite: true }

  it('ohne Logos: keine Klasse, der Titel direkt in der Leiste', () => {
    localStorage.clear()
    const store = createStore({ idb: null })
    const w = mount(BogenBlatt, { props, global: { provide: { [storeKey as symbol]: store } } })
    expect(w.findAll('.bogen-kopf--logos')).toHaveLength(0)
    expect(w.findAll('.bk-leiste > .bk-titel')).toHaveLength(3)
    expect(w.find('img').exists()).toBe(false)
    w.unmount()
  })

  it('mit Logos: links und rechts in der Leiste jeder Seite, der QR-Code bleibt, wo er war', () => {
    localStorage.clear()
    const store = createStore({ idb: null })
    setzeTestLogos(store)
    const w = mount(BogenBlatt, { props, global: { provide: { [storeKey as symbol]: store } } })
    const koepfe = w.findAll('.bogen-kopf')
    expect(koepfe).toHaveLength(3)
    for (const k of koepfe) {
      expect(k.classes()).toEqual(expect.arrayContaining(['bogen-kopf', 'bogen-kopf--qr', 'bogen-kopf--logos']))
      expect(logoFolge(k.find('.bk-leiste').element)).toEqual(['links', 'rechts'])
      expect(k.find('.bk-leiste > .kopf-logos.kopf-logos--leiste > .kopf-logos-mitte > .bk-titel').text()).toBe('Hafenpokal 2026')
      // Der Code ist weiter das schwebende erste Kind des Kopfs, nicht Teil der Leiste.
      expect(k.element.firstElementChild?.matches('svg.qr-code.bk-qr')).toBe(true)
      expect(k.find('.bk-leiste svg.qr-code').exists()).toBe(false)
    }
    expect(koepfe.map((k) => k.find('svg.qr-code').attributes('data-qr'))).toEqual([`${qr}.S1`, `${qr}.S2`, `${qr}.S3`])
    expect(w.findAll('svg.qr-code')).toHaveLength(3)
    // Die Rückseite hat keinen Kopf und bekommt kein Logo.
    expect(w.findAll('img.listen-logo')).toHaveLength(6)
    expect(w.findAll('.bk-zelle').slice(0, 3).map((z) => z.text())).toEqual(['Steg', 'Klasse 7', '3. Lauf'])
    w.unmount()
  })
})
