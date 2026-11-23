import { describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { configFor } from '../../config/konfig'
import { parcoursSvg } from '../../lib/parcoursQuelle'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import { bildTreffer } from '../../wkr/bild'
import { listenKennung } from '../../wkr/liste'
import { leererEntwurf, maskeFuer, tippeBoje, tippeBojenDisq, type Entwurf, type MaskenBoje } from '../../wkr/maske'
import { maskenJeKlasse, type ListenSicht } from '../../wkr/sicht'
import type { ClassId } from '../../types'
import WkrBild from './WkrBild.vue'
import WkrMitte from './WkrMitte.vue'

/**
 * Maske „Bild“ (W5.2, Plan docs/plan-wkr-w5.md §5.2, 22.11.2026): Im Test-DOM gibt es keine Lage der Bojen – WkrBild
 * zeigt dieselben Treffer als Knopfliste (BD6). Geprüft wird die Zuordnung über `data-feld`, nicht Koordinaten:
 * Umschalter Hin/Rück/Rück 2 (BD5), nur von Hand (BD4 umgebaut 22.11.2026, R8-20), Stand „✔ 5“, „2×“, „5 G“ (BZ1) und
 * Disq. über „Disq. an Boje …“ + Tipp (BD7) bzw. langes Drücken (R8-23, LD1–LD4).
 */
const DM = configFor({ regelwerk: 'dm-2026' })
const KLASSEN: ClassId[] = ['1', '2', '3', '4', '5', '6', '7', 'E']

function sicht(typeId: string): ListenSicht {
  return { liste: listenKennung({ bereich: 'p1', typeId, racecourse: null }), klassen: maskenJeKlasse(DM, DM, typeId, KLASSEN, false, 'alcatraz') } as ListenSicht
}

/** Mount mit Entwurf, der den Ereignissen folgt (wie WkrMaske). */
function baue(typeId: string, klasse: ClassId) {
  const s = sicht(typeId)
  const aufbau = maskeFuer(s, klasse)!
  const zuordnung = bildTreffer(s, klasse, parcoursSvg)!
  let entwurf: Entwurf = leererEntwurf()
  const w: VueWrapper = mount(WkrBild, {
    props: {
      aufbau,
      entwurf,
      zuordnung,
      klasse: aufbau.titel,
      startNr: '23',
      weg: 'hin',
      onBoje: (b: MaskenBoje) => {
        entwurf = tippeBoje(entwurf, b)
        void w.setProps({ entwurf })
      },
      onBojeDisq: (b: MaskenBoje, c: string | null) => {
        entwurf = tippeBojenDisq(entwurf, b, c)
        void w.setProps({ entwurf })
      },
    },
  })
  return { w, aufbau, zuordnung, entwurf: () => entwurf }
}

const treffer = (w: VueWrapper, id: string) => w.find(`[data-action="bild-boje"][data-bild-id="${id}"]`)

describe('WkrBild (W5.2)', () => {
  it('ohne Lage: Knopfliste mit den eigenen Bojen, fremde fehlen; Tipp = dieselbe Boje wie in den Knöpfen', async () => {
    const { w, entwurf } = baue('gate135', '7')
    expect(w.find('[data-teil="bild"]').attributes('data-art')).toBe('svg')
    expect(w.find('[data-teil="bild-ersatz"]').exists()).toBe(true)
    // Die Zeichnung steht inline, mit eigenem Präfix an jeder ID.
    expect(w.find('.wkr-bild-svg').html()).toMatch(/id="wb[a-z0-9]+-Tor1_innen"/)
    expect(treffer(w, 'Tor2_innen').exists()).toBe(false)
    expect(treffer(w, 'Tor1_innen').attributes('data-feld')).toBe('t1a|hin seiteB')
    await treffer(w, 'Tor1_innen').trigger('click')
    await nextTick()
    expect(entwurf().bojen['t1a|hin seiteB']).toBe(1)
    expect(treffer(w, 'Tor1_innen').find('[data-teil="bild-stand"]').text()).toBe('✔ 5')
    // Kein Titel, keine Namensnennung unter dem Bild (Nutzer 23.11.2026: Platz) – sie steht unter „Mehr“ (WkrMehr).
    expect(w.find('figcaption').exists()).toBe(false)
    expect(w.find('[data-teil="bild-nachweis"]').exists()).toBe(false)
  })

  it('Umschalter Hin / Rück / Rück 2 (BD5): Tor 1 ist je Seite eine andere Boje', async () => {
    const { w } = baue('gate135', '7')
    const wege = w.findAll('[data-action="bild-weg"]').map((b) => b.attributes('data-weg'))
    expect(wege).toEqual(['hin', 'rueck', 'rueck2'])
    await w.find('[data-action="bild-weg"][data-weg="rueck"]').trigger('click')
    expect(treffer(w, 'Tor1_innen').attributes('data-feld')).toBe('t1b|rueck seiteB')
    expect(w.emitted('weg')!.at(-1)).toEqual(['rueck'])
    await w.find('[data-action="bild-weg"][data-weg="rueck2"]').trigger('click')
    expect(treffer(w, 'Tor1_innen').attributes('data-feld')).toBe('t1c|rueck seiteB')
    // WkrMaske kennt nur Hin/Rück – Rück 2 meldet „rueck“.
    expect(w.emitted('weg')!.at(-1)).toEqual(['rueck'])
  })

  it('BD4 umgebaut (R8-20, 22.11.2026): Tipp an Tor 5 lässt „Hinweg“ stehen, der zweite zählt auf dem Hinweg; Zähler „n×“', async () => {
    const { w, entwurf } = baue('gate135', '7')
    await treffer(w, 'Tor5_unten').trigger('click')
    await nextTick()
    expect(entwurf().bojen['t5|hin seiteA']).toBe(1)
    expect(w.find('[data-teil="bild"]').attributes('data-weg')).toBe('hin')
    expect(w.emitted('weg')).toBeUndefined()
    expect(treffer(w, 'Tor5_unten').attributes('data-feld')).toBe('t5|hin seiteA')
    await treffer(w, 'Tor5_unten').trigger('click')
    await nextTick()
    expect(entwurf().bojen['t5|hin seiteA']).toBe(2)
    expect(entwurf().bojen['t5|rueck seiteA']).toBeUndefined()
    expect(treffer(w, 'Tor5_unten').find('[data-teil="bild-stand"]').text()).toBe('2×')
    // Von Hand auf den Rückweg: dort zählt Tor 5 getrennt.
    await w.find('[data-action="bild-weg"][data-weg="rueck"]').trigger('click')
    await treffer(w, 'Tor5_unten').trigger('click')
    await nextTick()
    expect(entwurf().bojen['t5|rueck seiteA']).toBe(1)
    expect(w.find('[data-action="bild-weg"][data-weg="hin"]').attributes('data-anzahl')).toBe('2')
    expect(w.find('[data-action="bild-weg"][data-weg="rueck"]').attributes('data-anzahl')).toBe('1')
    expect(WKR_ANNAHMEN.bildUmschalterNurVonHand).toBe(true)
  })

  it('BD7: „Disq. an Boje …“, dann Tipp auf die Boje, dann der Buchstabe (zweimal) → „5, G“; Mehrfachwahl bis „Fertig“ (BZ7, 22.11.2026)', async () => {
    const { w, entwurf } = baue('gate135', '3')
    await treffer(w, 'Tor3_innen').trigger('click')
    await w.find('[data-action="bild-disq-modus"]').trigger('click')
    expect(w.find('[data-teil="bild-disq-tippe"]').text()).toContain('23')
    await treffer(w, 'Tor3_innen').trigger('click')
    // Kein Tipp gezählt – die Boje wurde nur gewählt.
    expect(entwurf().bojen['t3a|hin seiteB']).toBe(1)
    const code = w.find('[data-action="disq-code"]').attributes('data-code')!
    await w.find(`[data-action="disq-code"][data-code="${code}"]`).trigger('click')
    await w.find(`[data-action="disq-code"][data-code="${code}"]`).trigger('click')
    await nextTick()
    expect(entwurf().bojenDisq['t3a|hin seiteB']).toEqual([code])
    // Die Wahl bleibt offen (Mehrfachwahl): ein zweiter Buchstabe kommt dazu, „Fertig“ schließt.
    const codes = w.findAll('[data-action="disq-code"]').map((x) => x.attributes('data-code')!)
    const zweiter = codes.find((c) => c !== code)!
    await w.find(`[data-action="disq-code"][data-code="${zweiter}"]`).trigger('click')
    await w.find(`[data-action="disq-code"][data-code="${zweiter}"]`).trigger('click')
    await nextTick()
    const katalog = codes.filter((c) => c === code || c === zweiter).join(', ')
    expect(w.find('[data-action="disq-ort-fertig"]').text()).toContain(katalog)
    await w.find('[data-action="disq-ort-fertig"]').trigger('click')
    expect(w.find('[data-action="disq-code"]').exists()).toBe(false)
    expect(treffer(w, 'Tor3_innen').find('[data-teil="bild-stand"]').text()).toBe(`5, ${katalog}`)
    expect(treffer(w, 'Tor3_innen').attributes('data-disq')).toBe(katalog)
    expect(WKR_ANNAHMEN.bildDisqKnopfUndLangdruck).toBe(true)
  })

  it('Langdruck auf einen Treffer (R8-23, LD1/LD2): Buchstaben DIESER Boje, kein Tipp; kurz zählt beim Loslassen', async () => {
    vi.useFakeTimers()
    try {
      const { w, entwurf } = baue('gate135', '3')
      const druck = (typ: string) => treffer(w, 'Tor3_innen').trigger(typ, { pointerId: 1, button: 0, clientX: 0, clientY: 0 })
      // Kurz: Berührung beim Loslassen, der nachlaufende click zählt nicht noch einmal.
      await druck('pointerdown')
      await druck('pointerup')
      await treffer(w, 'Tor3_innen').trigger('click')
      await nextTick()
      expect(entwurf().bojen['t3a|hin seiteB']).toBe(1)
      // Lang: die Buchstaben öffnen sich, die Berührungen bleiben (kein Tipp, LD2).
      vi.advanceTimersByTime(2000)
      await druck('pointerdown')
      vi.advanceTimersByTime(WKR_ANNAHMEN.langdruckMs)
      await nextTick()
      expect(w.find('[data-action="disq-code"]').exists()).toBe(true)
      expect(w.find('[data-teil="disq-ort-hint"]').exists()).toBe(true)
      expect(entwurf().bojen['t3a|hin seiteB']).toBe(1)
      const code = w.find('[data-action="disq-code"]').attributes('data-code')!
      await w.find(`[data-action="disq-code"][data-code="${code}"]`).trigger('click')
      await w.find(`[data-action="disq-code"][data-code="${code}"]`).trigger('click')
      await w.find('[data-action="disq-ort-fertig"]').trigger('click')
      expect(entwurf().bojenDisq['t3a|hin seiteB']).toEqual([code])
      expect(entwurf().bojen['t3a|hin seiteB']).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('Langdruck zweimal (Prüfbefund 22.11.2026): der Treffer verschwindet unter dem Finger, der zweite Langdruck öffnet trotzdem, ein Tipp mit pointerId 1 zählt einmal', async () => {
    vi.useFakeTimers()
    try {
      const { w, entwurf } = baue('gate135', '3')
      const p = (id: string, typ: string) => treffer(w, id).trigger(typ, { pointerId: 1, button: 0, clientX: 0, clientY: 0 })
      const losAmFenster = () => window.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 1, clientX: 0, clientY: 0 }))
      const ids = w.findAll('[data-action="bild-boje"]').map((t) => t.attributes('data-bild-id')!)
      const [a, b] = ids
      // Erster Langdruck: die Wahl ersetzt die Fläche, das Loslassen trifft nur noch das Fenster.
      await p(a, 'pointerdown')
      vi.advanceTimersByTime(WKR_ANNAHMEN.langdruckMs)
      await nextTick()
      expect(treffer(w, a).exists()).toBe(false)
      losAmFenster()
      await w.find('[data-action="disq-ort-fertig"]').trigger('click')
      vi.advanceTimersByTime(2000)
      // Zweiter Langdruck auf eine andere Boje: wieder die Buchstaben, kein Tipp.
      await p(b, 'pointerdown')
      vi.advanceTimersByTime(WKR_ANNAHMEN.langdruckMs)
      await nextTick()
      expect(w.find('[data-action="disq-code"]').exists()).toBe(true)
      losAmFenster()
      await w.find('[data-action="disq-ort-fertig"]').trigger('click')
      expect(Object.values(entwurf().bojen).reduce((s, n) => s + n, 0)).toBe(0)
      vi.advanceTimersByTime(2000)
      // Kurzer Tipp (Maus/Stift, pointerId 1): zählt genau einmal.
      await p(a, 'pointerdown')
      await p(a, 'pointerup')
      await treffer(w, a).trigger('click')
      await nextTick()
      expect(Object.values(entwurf().bojen).reduce((s, n) => s + n, 0)).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  // R8-19 (22.11.2026, BD3 umgebaut); seit 23.11.2026 (R9-05 bis R9-07, BD8–BD10 umgebaut) eine Bahn ohne Steg mit den
  // IDs des Parcours-Repositorys – für Racecourse A und B dieselbe.
  const UIM = configFor({ regelwerk: 'uim-2026' })
  const parallel = (rc: 'A' | 'B', svgVon?: (d: string) => string | undefined) => {
    const s = { liste: listenKennung({ bereich: 'parallel', typeId: 'parallelparcours', racecourse: rc }), klassen: maskenJeKlasse(UIM, UIM, 'parallelparcours', KLASSEN, false) } as ListenSicht
    const k = (Object.keys(s.klassen) as ClassId[]).find((x) => maskeFuer(s, x)?.art === 'bojen')!
    const aufbau = maskeFuer(s, k)!
    return mount(WkrBild, { props: { aufbau, entwurf: leererEntwurf(), zuordnung: bildTreffer(s, k, svgVon)!, klasse: aufbau.titel, startNr: '5', weg: 'hin' } })
  }

  it('Parallelslalom: eine Bahn für A und B, nichts gedimmt, Racecourse aus der Liste, Namensnennung unter „Mehr“', () => {
    const ids: Record<string, string[]> = {}
    for (const rc of ['A', 'B'] as const) {
      const w = parallel(rc, parcoursSvg)
      expect(w.find('[data-teil="bild"]').attributes('data-art')).toBe('svg')
      expect(w.find('[data-teil="bild-flaeche"]').attributes('data-racecourse')).toBe(rc)
      expect(w.find('[data-teil="bild-schema"]').exists()).toBe(false)
      expect(w.find('figure').attributes('aria-label')).toBe(`Racecourse ${rc}`)
      const svg = w.find('.wkr-bild-svg > svg')
      expect(svg.exists()).toBe(true)
      expect(svg.html()).not.toContain('<image')
      // Nur die eine Bahn: keine zweite, kein Steg, nichts gedimmt (R9-07 „Nur eine Bahn.“).
      expect(svg.html()).not.toMatch(/id="[^"]*-B_|Steg/)
      expect(svg.html()).not.toMatch(/style="[^"]*;opacity:0\./)
      for (const n of [1, 2, 3, 4, 5]) expect(treffer(w, `A_Boje${n}`).exists(), `${rc} Boje ${n}`).toBe(true)
      expect(treffer(w, 'A_StartZiel_unten').exists()).toBe(true)
      expect(treffer(w, 'A_StartZiel_oben').exists()).toBe(true)
      ids[rc] = w.findAll('[data-action="bild-boje"]').map((b) => `${b.attributes('data-bild-id')}|${b.attributes('data-feld')}`)
      // Namensnennung nicht unter dem Bild, sondern unter „Mehr“ (Nutzer 23.11.2026).
      expect(w.find('[data-teil="bild-nachweis"]').exists()).toBe(false)
    }
    // Dieselben Treffer auf derselben Bahn – welcher Racecourse, sagt nur die Liste.
    expect(ids.B).toEqual(ids.A)
  })

  it('Parallelslalom ohne Parallel.svg: Schema des Racecourse (Rückfall, für A und B gleich), ohne Namensnennung', () => {
    for (const rc of ['A', 'B'] as const) {
      const w = parallel(rc)
      expect(w.find('[data-teil="bild-schema"]').attributes('data-racecourse')).toBe(rc)
      expect(w.find("figure").attributes("aria-label")).toBe(`Racecourse ${rc}`)
      expect(treffer(w, 'P_b5').exists()).toBe(true)
      // Das Schema ist eigene Zeichnung – keine fremde Namensnennung.
      expect(w.find('[data-teil="bild-nachweis"]').exists()).toBe(false)
    }
  })

  it('Rück 2 bleibt nach der Disq.-Wahl im Fuß stehen (Prüfbefund 22.11.2026: WkrMitte merkt es je Start)', async () => {
    const s = sicht('gate135')
    const aufbau = maskeFuer(s, '7')!
    const props = {
      art: 'bojen' as const,
      schluessel: 'start-23',
      aufbau,
      entwurf: leererEntwurf(),
      startNr: '23',
      disqOffen: false,
      disqCodes: [],
      gesperrt: false,
      weg: 'hin' as const,
      bojenFolge: 'gedreht' as const,
      sichtbareTeile: [],
      maske: 'bild' as const,
      bild: bildTreffer(s, '7', parcoursSvg)!,
      klasse: aufbau.titel,
      pad: true,
    }
    const w = mount(WkrMitte, { props: { ...props, onWeg: (x: 'hin' | 'rueck') => void w.setProps({ weg: x }) } })
    await w.find('[data-action="bild-weg"][data-weg="rueck2"]').trigger('click')
    await nextTick()
    expect(w.find('[data-teil="bild"]').attributes('data-weg')).toBe('rueck2')
    // DISQ im Fuß: WkrDisqOrt statt des Bilds, danach zurück – das Bild wird neu gebaut.
    await w.setProps({ disqOffen: true })
    expect(w.find('[data-teil="bild"]').exists()).toBe(false)
    await w.setProps({ disqOffen: false })
    expect(w.find('[data-teil="bild"]').attributes('data-weg')).toBe('rueck2')
    expect(treffer(w, 'Tor1_innen').attributes('data-feld')).toBe('t1c|rueck seiteB')
    // Ein anderer Start beginnt nicht auf Rück 2, auch wenn WkrMaske „rueck“ meldet.
    await w.setProps({ schluessel: 'start-24', weg: 'rueck' })
    expect(w.find('[data-teil="bild"]').attributes('data-weg')).toBe('rueck')
    // Zurück auf Hin vergisst Rück 2.
    await w.setProps({ schluessel: 'start-23' })
    await w.find('[data-action="bild-weg"][data-weg="hin"]').trigger('click')
    await w.setProps({ disqOffen: true })
    await w.setProps({ disqOffen: false, weg: 'rueck' })
    expect(w.find('[data-teil="bild"]').attributes('data-weg')).toBe('rueck')
  })

  it('Fläche neu nach „Disq. an Boje …“: der ResizeObserver zieht auf das neue Element um (Prüfbefund 22.11.2026)', async () => {
    const beobachtet: Element[] = []
    const alt = globalThis.ResizeObserver
    class Spion {
      observe(el: Element) {
        beobachtet.push(el)
      }
      unobserve(el: Element) {
        const i = beobachtet.indexOf(el)
        if (i >= 0) beobachtet.splice(i, 1)
      }
      disconnect() {
        beobachtet.length = 0
      }
    }
    globalThis.ResizeObserver = Spion as unknown as typeof ResizeObserver
    try {
      const { w } = baue('gate135', '3')
      await nextTick()
      const erste = w.find('[data-teil="bild-flaeche"]').element
      expect(beobachtet).toEqual([erste])
      await w.find('[data-action="bild-disq-modus"]').trigger('click')
      await treffer(w, 'Tor3_innen').trigger('click')
      expect(w.find('[data-teil="bild-flaeche"]').exists()).toBe(false)
      await w.find('[data-action="bild-disq-zurueck"]').trigger('click')
      await nextTick()
      const zweite = w.find('[data-teil="bild-flaeche"]').element
      expect(zweite).not.toBe(erste)
      expect(beobachtet).toEqual([zweite])
    } finally {
      globalThis.ResizeObserver = alt
    }
  })
})
