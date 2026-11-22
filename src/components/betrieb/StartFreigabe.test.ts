import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import StartFreigabe from './StartFreigabe.vue'
import { setLocale } from '../../i18n'
import { vergissAlles } from '../../lib/merken'
import { sichtOeffentlich } from '../../betrieb/sicht'
import { betriebStarter, wkrBetriebsStand, zeigeNaechsten } from '../../testHilfen'
import type { BetriebAenderung } from '../../state/reducer/betrieb'
import { FREIGABE_SICHT_FASSUNG, type FreigabeErfassung, type FreigabeListe } from '../../wkr/freigabe'

// Start-Freigabe mit Parcours-Ampel und Auto-Modus (Nutzer 21.11.2026, P-03/P-04; WKR_ANNAHMEN AM4/AM5,
// BETRIEB_ANNAHMEN AM6/AM7) – nur aus den Props (dieselbe Komponente auf Bedienrechner und Handy): Knopf „Durchs
// Start-Tor“, Rückfrage nur mit warnender Parcours-Liste, Countdown mit falscher Uhr, „Anhalten“. Nur erfundene Starter.

const P1 = 'par_1'
const wrappers: VueWrapper[] = []

beforeEach(() => {
  vergissAlles()
  setLocale('de')
})
afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

function stand() {
  const starter = Array.from({ length: 4 }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(101 + i)))
  return zeigeNaechsten(wkrBetriebsStand(starter), P1, 1000)
}

const tor = (mehr: Partial<FreigabeListe> = {}): FreigabeListe => ({ titel: 'Tor 1/3/5', stand: 'aktiv', ampel: 'gehoert', offen: 0, von: '', bis: '', rueckfragen: 0, warnt: false, parcours: true, ...mehr })

function erfassung(key: string, mehr: Partial<FreigabeErfassung> = {}): FreigabeErfassung {
  return { fv: FREIGABE_SICHT_FASSUNG, bereich: P1, warnung: 'nachfragen', listen: [tor()], ampel: 'gruen', ampelRef: key, perKnopf: false, autoMoeglich: false, autoOhne: [], autoIn: null, ...mehr }
}

function karte(e: (key: string) => FreigabeErfassung, autoAnhalten?: (ref: string) => void) {
  const sicht = sichtOeffentlich(stand(), { logos: false })
  const bereich = sicht.bereiche.find((b) => b.id === P1)!
  const gesendet: BetriebAenderung[] = []
  const w = mount(StartFreigabe, { attachTo: document.body, props: { sicht, bereich, sende: (a: BetriebAenderung) => void gesendet.push(a), erfassung: e(bereich.aktuell!.key), ...(autoAnhalten ? { autoAnhalten } : {}) } })
  wrappers.push(w)
  return { w, gesendet, key: bereich.aktuell!.key }
}

describe('Parcours-Ampel an der Start-Freigabe', () => {
  it('grün: Zeichen und Wort, Knopf „Durchs Start-Tor“ schickt BETRIEB_DURCHFAHRT; keine Rückfrage vor „Nächster Start“', async () => {
    const { w, gesendet, key } = karte((k) => erfassung(k))
    const a = w.find('[data-teil="ampel"]')
    expect(a.attributes('data-ampel')).toBe('gruen')
    expect(a.text()).toContain('Start frei')
    await w.find('[data-action="durchfahrt"]').trigger('click')
    expect(gesendet).toEqual([{ type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref: key, an: true }])
    await w.find('[data-action="zeigen"]').trigger('click')
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).toBeNull()
    expect(gesendet.at(-1)!.type).toBe('BETRIEB_ZEIGEN')
  })

  it('rot: offene Parcours-Liste genannt, „Doch nicht durch“ nur per Knopf; Rückfrage nur über warnende Parcours-Listen', async () => {
    const offen = tor({ offen: 1, von: '101', bis: '101', warnt: true })
    const steg: FreigabeListe = { ...tor({ titel: 'Steg', offen: 2, von: '101', bis: '102' }), parcours: false }
    const { w, gesendet, key } = karte((k) => erfassung(k, { ampel: 'rot', perKnopf: true, listen: [offen, steg] }))
    expect(w.find('[data-teil="ampel"]').text()).toContain('noch offen: Tor 1/3/5')
    expect(w.find('[data-teil="ampel"]').text()).not.toContain('Steg')
    await w.find('[data-action="durchfahrt-zurueck"]').trigger('click')
    expect(gesendet).toEqual([{ type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref: key, an: false }])
    await w.find('[data-action="zeigen"]').trigger('click')
    await nextTick()
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).not.toBeNull()
    // Nie gesperrt (F4).
    ;(document.querySelector('[data-action="trotzdem-freigeben"]') as HTMLButtonElement).click()
    await nextTick()
    expect(gesendet.at(-1)!.type).toBe('BETRIEB_ZEIGEN')
  })

  it('Ampel für einen anderen Start (Sichten getrennt angekommen): keine Ampel', () => {
    const { w } = karte(() => erfassung('["m","x",1]'))
    expect(w.find('[data-teil="ampel"]').exists()).toBe(false)
  })
})

describe('Auto-Modus an der Start-Freigabe (AM6/AM7)', () => {
  it('Countdown mit falscher Uhr; „Anhalten“ meldet den Start und hält bis zum nächsten', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    const halt = vi.fn()
    const { w, key } = karte((k) => erfassung(k, { ampel: 'frei', autoMoeglich: true, autoIn: 3 }), halt)
    const countdown = () => w.find('[data-teil="auto-countdown"]')
    expect(countdown().text()).toBe('Nächster Start in 3 s')
    vi.advanceTimersByTime(1100)
    await nextTick()
    expect(countdown().text()).toBe('Nächster Start in 2 s')
    await w.find('[data-action="auto-anhalten"]').trigger('click')
    expect(halt).toHaveBeenCalledWith(key)
    expect(countdown().exists()).toBe(false)
    expect(w.find('[data-teil="auto"]').text()).toContain('Auto angehalten')
  })

  it('ohne wirksamen Auto-Modus: „Auto aus: …“ mit den Listen; ohne Einstellung nichts', () => {
    const { w } = karte((k) => erfassung(k, { autoOhne: ['Tor 2/4', 'Mann-über-Bord'] }))
    expect(w.find('[data-teil="auto-aus"]').text()).toBe('Auto aus: Tor 2/4, Mann-über-Bord ohne Gerät oder auf Papier')
    expect(w.find('[data-teil="auto"]').exists()).toBe(false)
    const ohne = karte((k) => erfassung(k))
    expect(ohne.w.find('[data-teil="auto-aus"]').exists()).toBe(false)
  })
})
