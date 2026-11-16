import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FremdeBestandteile from './FremdeBestandteile.vue'
import { setLocale } from '../i18n'
import tweetnaclPaket from '../../node_modules/tweetnacl/package.json'
import alcatrazPaket from '../../package.json'

/**
 * Lizenzvermerke fremder Bestandteile (Einstellungen → ganz unten). Was hier steht, muss zu den Paketen passen:
 * Wechselt ein Paket die Lizenz, fällt das hier auf statt in einer weitergereichten Ein-Datei-Fassung.
 */

afterEach(() => setLocale('de'))

describe('Fremde Bestandteile', () => {
  it('nennt tweetnacl (Gerätebetrieb, ab E5) mit seiner Lizenz – deutsch und englisch', () => {
    expect(Object.keys(alcatrazPaket.dependencies)).toContain('tweetnacl')
    expect(tweetnaclPaket.license).toBe('Unlicense')
    for (const sprache of ['de', 'en'] as const) {
      setLocale(sprache)
      const text = mount(FremdeBestandteile).find('[data-lizenz="tweetnacl"]').text()
      expect(text).toContain('tweetnacl')
      expect(text).toContain('Unlicense')
    }
  })

  it('behält die übrigen Vermerke: Flaggen (MIT-Text aus dem Paket) und Parcours-Zeichnungen', () => {
    const wrapper = mount(FremdeBestandteile)
    expect(wrapper.text()).toContain('country-flag-icons')
    expect(wrapper.find('.lizenz-text').text()).toContain('Permission is hereby granted')
    expect(wrapper.text()).toContain('Parcours-Zeichnungen')
  })
})
