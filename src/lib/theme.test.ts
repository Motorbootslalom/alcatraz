import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { dark, mode, scheme, SCHEMES, setMode, setScheme, toggleDark } from './theme'
import de from '../i18n/de'

describe('Farbschema und Hell/Dunkel', () => {
  beforeEach(() => {
    localStorage.clear()
    setMode('light')
    setScheme('steg')
  })

  it('bietet fünf bis zwölf Schemata, jedes mit Namen', () => {
    expect(SCHEMES.length).toBeGreaterThanOrEqual(5)
    expect(SCHEMES.length).toBeLessThanOrEqual(12)
    for (const s of SCHEMES) {
      expect(de).toHaveProperty(`theme.scheme.${s.id}`)
    }
  })

  it('setzt Schema und Helligkeit am Dokument und merkt sie sich', async () => {
    setScheme('blau')
    setMode('dark')
    await nextTick()
    expect(document.documentElement.dataset.scheme).toBe('blau')
    expect(document.documentElement.dataset.mode).toBe('dark')
    expect(localStorage.getItem('alcatraz:ui-scheme')).toBe('blau')
    expect(localStorage.getItem('alcatraz:ui-mode')).toBe('dark')
  })

  it('schaltet im Kopf zwischen hell und dunkel und lässt Unbekanntes nicht zu', () => {
    expect(dark.value).toBe(false)
    toggleDark()
    expect(mode.value).toBe('dark')
    toggleDark()
    expect(mode.value).toBe('light')
    setScheme('gibt-es-nicht')
    expect(scheme.value).toBe('steg')
  })
})
