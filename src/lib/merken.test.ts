import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ein Neuladen im Test: Das Modul (und damit sein Gedächtnis im Fenster) entsteht neu, der
// sessionStorage bleibt.
async function neuGeladen() {
  vi.resetModules()
  return (await import('./merken')).merke
}

describe('Gemerktes über das Neuladen', () => {
  beforeEach(() => sessionStorage.clear())

  it('ohne `ueberNeuladen` beginnt man nach dem Neuladen von vorn', async () => {
    const merke = await neuGeladen()
    merke('t.a', 1).value = 5
    expect(merke('t.a', 1).value).toBe(5)
    expect((await neuGeladen())('t.a', 1).value).toBe(1)
  })

  it('mit `ueberNeuladen` bleibt die Wahl – auch eine Liste (die aufgeklappten Klassen)', async () => {
    const merke = await neuGeladen()
    const offen = merke<string[]>('t.offen', () => ['1', '4'], { ueberNeuladen: true })
    offen.value = [...offen.value, '7']
    merke('t.wahl', '', { ueberNeuladen: true }).value = 'Musterclub'
    const wieder = await neuGeladen()
    expect(wieder<string[]>('t.offen', () => ['1'], { ueberNeuladen: true }).value).toEqual(['1', '4', '7'])
    expect(wieder('t.wahl', '', { ueberNeuladen: true }).value).toBe('Musterclub')
  })

  it('was die Form des Anfangswerts nicht hat oder `gueltig` nicht besteht, zählt nicht', async () => {
    sessionStorage.setItem('alcatraz.merke.t.liste', '"keine Liste"')
    sessionStorage.setItem('alcatraz.merke.t.zahl', '{kaputt')
    sessionStorage.setItem('alcatraz.merke.t.art', '"gibtsnicht"')
    sessionStorage.setItem('alcatraz.merke.t.klasse', '"4"')
    sessionStorage.setItem('alcatraz.merke.t.leer', 'null')
    const merke = await neuGeladen()
    expect(merke<string[]>('t.liste', ['1'], { ueberNeuladen: true }).value).toEqual(['1'])
    expect(merke('t.zahl', 10, { ueberNeuladen: true }).value).toBe(10)
    expect(merke('t.art', 'stoppuhr', { ueberNeuladen: true, gueltig: (w) => w === 'stoppuhr' || w === 'lichtschranke' }).value).toBe('stoppuhr')
    // Ein Anfangswert `undefined` verrät keine Form: Dann entscheidet `gueltig`.
    expect(merke<string | undefined>('t.klasse', undefined, { ueberNeuladen: true, gueltig: (w) => typeof w === 'string' }).value).toBe('4')
    expect(merke<string | undefined>('t.leer', undefined, { ueberNeuladen: true, gueltig: (w) => typeof w === 'string' }).value).toBeUndefined()
  })

  it('`vergissAuswahl` (Zurücksetzen, Sicherung laden): jede Auswahl steht wieder am Anfang, auch nach dem Neuladen', async () => {
    vi.resetModules()
    const { merke, vergissAuswahl } = await import('./merken')
    const wahl = merke('t.wahl', '', { ueberNeuladen: true })
    const art = merke('t.art', 'a')
    wahl.value = 'Musterclub'
    art.value = 'b'
    vergissAuswahl()
    // Dieselben Werte an Ort und Stelle: Eine gezeigte Ansicht und das Gemerkte bleiben eins.
    expect([wahl.value, art.value]).toEqual(['', 'a'])
    expect(merke('t.wahl', 'x', { ueberNeuladen: true })).toBe(wahl)
    expect((await neuGeladen())('t.wahl', '', { ueberNeuladen: true }).value).toBe('')
    // Danach wird weiter gemerkt.
    wahl.value = 'Beispielverein'
    expect((await neuGeladen())('t.wahl', '', { ueberNeuladen: true }).value).toBe('Beispielverein')
  })

  it('gemerkt wird auch, nachdem die Ansicht, die zuerst fragte, verlassen wurde', async () => {
    vi.resetModules()
    const { merke } = await import('./merken')
    const { defineComponent, h } = await import('vue')
    const { mount } = await import('@vue/test-utils')
    const Ansicht = defineComponent({
      setup() {
        const wahl = merke('t.ansicht', '', { ueberNeuladen: true })
        return () => h('button', { onClick: () => (wahl.value += 'x') })
      },
    })
    // Erste Ansicht: Dort entsteht der Wert. Sie wird verlassen (Wechsel des Reiters).
    const erste = mount(Ansicht)
    await erste.find('button').trigger('click')
    erste.unmount()
    // Wieder da: Die Änderung muss weiter im Speicher ankommen.
    const zweite = mount(Ansicht)
    await zweite.find('button').trigger('click')
    zweite.unmount()
    expect(sessionStorage.getItem('alcatraz.merke.t.ansicht')).toBe('"xx"')
  })
})
