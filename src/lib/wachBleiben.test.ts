import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { halteWach, useWachBleiben, type WachUmgebung } from './wachBleiben'

/** Nachgebautes `navigator.wakeLock` und `document` mit umschaltbarer Sichtbarkeit (E8, 20.11.2026). */
function nachbau(abweisen = false) {
  const hoerer = new Set<() => void>()
  const dok = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_: string, fn: () => void) => void hoerer.add(fn),
    removeEventListener: (_: string, fn: () => void) => void hoerer.delete(fn),
  }
  const gehalten: { frei: boolean; beiFrei: (() => void)[] }[] = []
  const request = vi.fn(async () => {
    if (abweisen) throw new DOMException('nein', 'NotAllowedError')
    const s = { frei: false, beiFrei: [] as (() => void)[] }
    gehalten.push(s)
    return {
      release: async () => {
        if (s.frei) return
        s.frei = true
        for (const fn of s.beiFrei) fn()
      },
      addEventListener: (_: 'release', fn: () => void) => void s.beiFrei.push(fn),
    }
  })
  const zeige = (sichtbar: boolean) => {
    dok.visibilityState = sichtbar ? 'visible' : 'hidden'
    // Wie der Browser: versteckt → Sperre weg.
    if (!sichtbar) for (const s of gehalten) if (!s.frei) { s.frei = true; for (const fn of s.beiFrei) fn() }
    for (const fn of [...hoerer]) fn()
  }
  const umgebung: WachUmgebung = { wakeLock: { request }, dokument: dok as unknown as WachUmgebung['dokument'] }
  return { umgebung, request, gehalten, zeige, hoerer, offen: () => gehalten.filter((s) => !s.frei).length }
}

const ruhe = () => new Promise((r) => setTimeout(r, 0))

describe('Bildschirm wach halten (Wake Lock)', () => {
  it('fordert an, gibt beim Verstecken ab und fordert beim Sichtbarwerden neu an', async () => {
    const n = nachbau()
    const w = halteWach(n.umgebung)
    w.setze(true)
    await ruhe()
    expect(w.lage.value).toBe('wach')
    expect(n.offen()).toBe(1)
    n.zeige(false)
    await ruhe()
    expect(n.offen()).toBe(0)
    expect(w.lage.value).toBe('aus')
    n.zeige(true)
    await ruhe()
    expect(n.request).toHaveBeenCalledTimes(2)
    expect(w.lage.value).toBe('wach')
    w.stop()
    expect(n.offen()).toBe(0)
    expect(n.hoerer.size).toBe(0)
  })

  it('ohne API (altes iPhone, file://) still: nur die Lage sagt „nicht möglich“', async () => {
    const w = halteWach({ wakeLock: null, dokument: null })
    w.setze(true)
    await ruhe()
    expect(w.lage.value).toBe('nicht-moeglich')
    w.stop()
    expect(w.lage.value).toBe('aus')
  })

  it('abgewiesen (Energiesparen): kein Fehler, Lage „nicht möglich“', async () => {
    const n = nachbau(true)
    const w = halteWach(n.umgebung)
    w.setze(true)
    await ruhe()
    expect(w.lage.value).toBe('nicht-moeglich')
  })

  it('setze(false) gibt frei; eine Anforderung, die nach dem Abschalten ankommt, wird gleich abgegeben', async () => {
    const n = nachbau()
    const w = halteWach(n.umgebung)
    w.setze(true)
    w.setze(false)
    await ruhe()
    expect(n.offen()).toBe(0)
    expect(w.lage.value).toBe('aus')
  })

  it('kurz versteckt während der Anforderung, dann abgewiesen: fordert noch einmal an (Prüfung E8, 21.11.2026)', async () => {
    const n = nachbau()
    // Die erste Anforderung hängt, bis die Seite versteckt und wieder sichtbar war, und wird dann abgewiesen.
    let weise: (() => void) | null = null
    n.request.mockImplementationOnce(() => new Promise((_, nein) => (weise = () => nein(new DOMException('versteckt', 'NotAllowedError')))))
    const w = halteWach(n.umgebung)
    w.setze(true)
    n.zeige(false)
    n.zeige(true)
    weise!()
    await ruhe()
    await ruhe()
    expect(n.request).toHaveBeenCalledTimes(2)
    expect(w.lage.value).toBe('wach')
    expect(n.offen()).toBe(1)
    w.stop()
  })

  it('Feldtest 21.11.2026 (Befund 14c): Browser nimmt die Sperre noch VOR dem Verstecken (release zuerst), Handy aus und wieder an → neu angefordert', async () => {
    const n = nachbau()
    const w = halteWach(n.umgebung)
    w.setze(true)
    await ruhe()
    expect(w.lage.value).toBe('wach')
    // Reihenfolge wie manche Android-Browser: erst `release`, dann `visibilitychange` → versteckt.
    for (const g of n.gehalten) if (!g.frei) { g.frei = true; for (const fn of g.beiFrei) fn() }
    expect(w.lage.value).toBe('nicht-moeglich')
    n.zeige(false)
    await ruhe()
    expect(w.lage.value).toBe('aus')
    n.zeige(true)
    await ruhe()
    expect(n.request).toHaveBeenCalledTimes(2)
    expect(w.lage.value).toBe('wach')
    // Mehrfach hintereinander (Bildschirm aus/an im Takt der Starts): jedes Mal genau eine neue Sperre.
    for (let i = 0; i < 3; i++) {
      n.zeige(false)
      await ruhe()
      n.zeige(true)
      await ruhe()
    }
    expect(n.request).toHaveBeenCalledTimes(5)
    expect(n.offen()).toBe(1)
    w.stop()
  })

  it('useWachBleiben: hält, solange aktiv und die Komponente steht', async () => {
    const n = nachbau()
    const aktiv = ref(false)
    let lage: ReturnType<typeof useWachBleiben> | null = null
    const K = defineComponent({
      setup() {
        lage = useWachBleiben(aktiv, n.umgebung)
        return () => h('div')
      },
    })
    const wrapper = mount(K)
    await ruhe()
    expect(n.request).not.toHaveBeenCalled()
    aktiv.value = true
    await nextTick()
    await ruhe()
    expect(lage!.value).toBe('wach')
    wrapper.unmount()
    await ruhe()
    expect(n.offen()).toBe(0)
  })
})
