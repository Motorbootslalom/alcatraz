import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import StartFreigabe from './StartFreigabe.vue'
import { setLocale } from '../../i18n'
import { vergissAlles } from '../../lib/merken'
import { sichtOeffentlich } from '../../betrieb/sicht'
import { betriebStarter, wkrBetriebsStand, zeigeNaechsten } from '../../testHilfen'
import { reducer } from '../../state/reducer'
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

describe('Wiederholung nach Ausfall (Nutzer 26.11.2026, R11-11)', () => {
  /** Zwei Starts gezeigt; mit `ausgefallen` ist der zweite (im Boot) abgebrochen und wartet. */
  function wkarte({
    ausgefallen = false,
    wiederholen,
    aufheben,
    ausfallGesperrt,
  }: { ausgefallen?: boolean; wiederholen?: (ref: string) => void; aufheben?: (ref: string) => void; ausfallGesperrt?: string[] } = {}) {
    let s = zeigeNaechsten(stand(), P1, 61_000)
    const imBoot = s.betrieb.bereiche[P1].gezeigt.at(-1)!.ref
    if (ausgefallen) s = reducer(s, { type: 'WIEDERHOLUNG_AUSFALL', bereich: P1, ref: imBoot, zeit: 70_000 })
    const sicht = sichtOeffentlich(s, { logos: false, gefahren: true })
    const bereich = sicht.bereiche.find((b) => b.id === P1)!
    const gesendet: BetriebAenderung[] = []
    const w = mount(StartFreigabe, {
      attachTo: document.body,
      props: { sicht, bereich, sende: (a: BetriebAenderung) => void gesendet.push(a), ...(wiederholen ? { wiederholen } : {}), ...(aufheben ? { aufheben } : {}), ...(ausfallGesperrt ? { ausfallGesperrt } : {}) },
    })
    wrappers.push(w)
    return { w, gesendet, imBoot }
  }

  it('nur mit `wiederholen` (Bedienrechner): Wahl der gezeigten Starts, jüngster zuerst, Rückfrage mit Nummer und Lauf', async () => {
    expect(wkarte().w.find('[data-action="ausfall"]').exists()).toBe(false)
    const gewaehlt: string[] = []
    const { w, gesendet, imBoot } = wkarte({ wiederholen: (ref) => gewaehlt.push(ref) })
    await w.find('[data-action="ausfall"]').trigger('click')
    const zeilen = w.findAll('[data-teil="ausfall"] li')
    expect(zeilen.map((z) => z.attributes('data-start'))).toEqual([imBoot, w.vm.$props.sicht.bereiche[0].vorig!.key])
    expect(zeilen[0].text()).toContain('102')
    // Suche nach Startnummer.
    await w.find('[data-feld="ausfall-suche"]').setValue('101')
    expect(w.findAll('[data-teil="ausfall"] li').map((z) => z.text())).toHaveLength(1)
    await w.find('[data-feld="ausfall-suche"]').setValue('')
    await w.find('[data-teil="ausfall"] li [data-action="ausfall-waehlen"]').trigger('click')
    await nextTick()
    const dialog = document.querySelector('[data-dialog="ausfall"]')!
    expect(dialog.textContent).toContain('Wiederholung nach Ausfall: 102, Lauf 1?')
    expect(dialog.textContent).toContain('verworfen')
    // Abbrechen schickt nichts.
    ;(document.querySelector('[data-action="ausfall-nein"]') as HTMLButtonElement).click()
    await nextTick()
    expect(gewaehlt).toEqual([])
    await w.find('[data-teil="ausfall"] li [data-action="ausfall-waehlen"]').trigger('click')
    await nextTick()
    ;(document.querySelector('[data-action="ausfall-ja"]') as HTMLButtonElement).click()
    await nextTick()
    expect(gewaehlt).toEqual([imBoot])
    // Keine Betriebs-Action dafür (die Werte verwirft die Erfassung, BetriebView); die Wahl schließt sich.
    expect(gesendet).toEqual([])
    expect(w.find('[data-teil="ausfall"]').exists()).toBe(false)
  })

  it('„Wiederholung offen“: einreihen, zeigen, „Doch keine Wiederholung“ nur am Bedienrechner; „Zurück“ gesperrt', async () => {
    const handy = wkarte({ ausgefallen: true })
    const liste = handy.w.find('[data-teil="wiederholung"]')
    expect(liste.exists()).toBe(true)
    expect(liste.text()).toContain('Wiederholung offen (1)')
    expect(liste.text()).toContain('Lauf 1 · Wiederholung')
    expect(liste.find('[data-action="wiederholung-aufheben"]').exists()).toBe(false)
    // Im Boot: der abgebrochene Versuch, gekennzeichnet; „Zurück“ nimmt ihn nicht.
    expect(handy.w.find('[data-teil="abgebrochen"]').text()).toBe('Ausfall – wird wiederholt')
    expect(handy.w.find('[data-action="zurueck"]').attributes('disabled')).toBeDefined()
    await liste.find('[data-action="einreihen-naechster"]').trigger('click')
    await liste.find('[data-action="wiederholung-zeigen"]').trigger('click')
    expect(handy.gesendet).toEqual([
      { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: handy.imBoot, wo: 'naechster' },
      { type: 'BETRIEB_ZEIGEN', bereich: P1, ref: handy.imBoot, vorher: handy.imBoot },
    ])
    // Am Bedienrechner: „Doch keine Wiederholung“ geht an BetriebView (WIEDERHOLUNG_AUFHEBEN, eine Action der Erfassung –
    // die Werte kommen zurück, Prüfbefund 27.11.2026), nie über `sende`.
    const aufgehoben: string[] = []
    const am = wkarte({ ausgefallen: true, wiederholen: () => {}, aufheben: (ref) => aufgehoben.push(ref) })
    await am.w.find('[data-teil="wiederholung"] [data-action="wiederholung-aufheben"]').trigger('click')
    expect(aufgehoben).toEqual([am.imBoot])
    expect(am.gesendet).toEqual([])
  })

  it('abgemeldeter Starter: in der Wahl ausgegraut mit Satz statt einer Rückfrage, auf die nichts geschähe (WH10)', async () => {
    const gewaehlt: string[] = []
    // Im Boot steht m2 (102) – abgemeldet.
    const { w, imBoot } = wkarte({ wiederholen: (ref) => gewaehlt.push(ref), ausfallGesperrt: ['m2'] })
    expect(JSON.parse(imBoot)[1]).toBe('m2')
    await w.find('[data-action="ausfall"]').trigger('click')
    const zeile = w.find(`[data-teil="ausfall"] li[data-start='${imBoot}']`)
    expect(zeile.find('[data-teil="ausfall-abgemeldet"]').text()).toBe('abgemeldet – keine Wiederholung')
    expect(zeile.find('[data-action="ausfall-waehlen"]').attributes('disabled')).toBeDefined()
    // Die anderen bleiben wählbar.
    const andere = w.findAll('[data-teil="ausfall"] li').filter((z) => z.attributes('data-start') !== imBoot)
    expect(andere.length).toBeGreaterThan(0)
    expect(andere[0].find('[data-action="ausfall-waehlen"]').attributes('disabled')).toBeUndefined()
  })
})
