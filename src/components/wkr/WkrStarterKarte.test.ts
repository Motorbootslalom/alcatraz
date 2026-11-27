import { describe, expect, it } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import WkrStarterKarte from './WkrStarterKarte.vue'
import { stelleWkrText } from './texte'
import type { ListenCoPilot } from '../../wkr/sicht'

// Starterkarte am Steg (Nutzer 27.11.2026: „Hier beim Steg bitte noch das Boot und ggf. die Co-Piloten mit anzeigen“,
// WKR_ANNAHMEN CP5–CP7): das Boot unter dem Ausgleichsgewicht des Starters, darunter über die ganze Breite der Karte
// Co-Pilot und kleiner der Ersatz, Klammer wie auf der Papierliste; der Platz richtet sich nach dem höchsten Block der
// Liste (Platzhalter der anderen Klassen in derselben Rasterzelle, Stile: styles/wkr-geraet.test.ts). Welcher Teil die
// Klammer zeigt, entscheidet WkrMaske (GeraetWkr.test.ts „Co-Piloten am Steg“). Nur erfundene Namen.

const START = { startNr: '101', titel: '1. Lauf', boot: 'Flotte Lotte' }
const PAAR: ListenCoPilot[] = [
  { rolle: 'haupt', coPilot: 'Copi Muster', ausgleich: 3.5 },
  { rolle: 'ersatz', coPilot: 'Copa Beispiel', ausgleich: 'fehlt' },
]

/** Die Karte in der Sprache einer Liste (wie WkrGeraet über stelleWkrText). */
function karte(props: Record<string, unknown>, sprache: 'de' | 'en' = 'de') {
  const Huelle = defineComponent({
    setup() {
      stelleWkrText(computed(() => sprache))
      return () => h(WkrStarterKarte, { start: START, klasse: 'Klasse 1', ...props })
    },
  })
  return mount(Huelle)
}

const angaben = (w: ReturnType<typeof karte>) => w.findAll('.wkr-starterkarte-angaben > [data-teil]').map((x) => x.attributes('data-teil'))
/** Was die Karte unter sich trägt (direkte Kinder), in der Folge des DOM. */
const teile = (w: ReturnType<typeof karte>) => w.findAll('[data-teil="karte"] > [data-teil], [data-teil="karte"] > .wkr-starterkarte-zeile').map((x) => x.attributes('data-teil') ?? 'zeile')
const ANDERE: ListenCoPilot[] = [{ rolle: 'haupt', coPilot: 'Carla Langername-Beispielhaft', ausgleich: 6 }]

describe('WkrStarterKarte – Boot und Co-Piloten (CP5–CP7)', () => {
  it('Folge: Klasse, Lauf, Ausgleichsgewicht des Starters, Boot; darunter über die ganze Breite Co-Pilot und kleiner der Ersatz; Klammern wie auf Papier', () => {
    const w = karte({ ausgleich: 4, coPiloten: PAAR })
    expect(angaben(w)).toEqual(['klasse', 'start-titel', 'ausgleich', 'boot'])
    // Nicht in der Spalte neben der Nummer (Prüfbefund 27.11.2026): eine eigene Zeile unter Nummer und Angaben.
    expect(teile(w)).toEqual(['zeile', 'co-piloten'])
    expect(w.find('[data-teil="boot"]').text()).toBe('Boot Flotte Lotte')
    const zeilen = w.findAll('[data-teil="co-pilot"]')
    expect(zeilen.map((z) => [z.attributes('data-rolle'), z.text()])).toEqual([
      ['haupt', 'Co-Pilot Copi Muster (+3,5 kg)'],
      ['ersatz', 'Ersatz Copa Beispiel (nicht gewogen)'],
    ])
    expect(zeilen[1].classes()).toContain('wkr-starterkarte-copilot--ersatz')
    expect(zeilen[1].attributes('title')).toBe('Ersatz-Co-Pilot')
    expect(zeilen.map((z) => z.find('[data-teil="co-pilot-ag"]').attributes('data-ausgleich'))).toEqual(['3.5', 'fehlt'])
    expect(zeilen[1].find('[data-teil="co-pilot-ag"]').classes()).toContain('wkr-starterkarte-copilot-ag--fehlt')
    // Ohne andere Klassen kein Platzhalter.
    expect(w.find('[data-teil="co-pilot-platz"]').exists()).toBe(false)
    // Nie der Name des Starters: die Karte kennt nur Startnummer, Klasse und Lauf – Namen nur bei den Co-Piloten.
    expect(w.find('[data-teil="karte"]').text()).not.toMatch(/Vor|Nach/)
    w.unmount()
  })

  it('ohne Klammer (Teil „Anlegen“, CP6) nur die Namen; ohne Co-Piloten und ohne Platz kein Block', () => {
    const an = karte({ coPiloten: PAAR.map(({ ausgleich: _a, ...c }) => c) })
    expect(an.findAll('[data-teil="co-pilot"]').map((z) => z.text())).toEqual(['Co-Pilot Copi Muster', 'Ersatz Copa Beispiel'])
    expect(an.find('[data-teil="co-pilot-ag"]').exists()).toBe(false)
    an.unmount()
    const ohne = karte({})
    expect(ohne.find('[data-teil="co-piloten"]').exists()).toBe(false)
    expect(angaben(ohne)).toEqual(['klasse', 'start-titel', 'boot'])
    expect(teile(ohne)).toEqual(['zeile'])
    ohne.unmount()
  })

  it('Platz (CP7): die Blöcke der anderen Klassen liegen unsichtbar in derselben Zelle – auch ohne eigene Co-Piloten; nie als Co-Pilot dieses Starts', () => {
    // Klasse ohne Co-Piloten in einer Liste, deren andere Klassen welche haben: Platz, aber nichts Sichtbares.
    const leer = karte({ coPiloten: null, coPilotPlatz: [PAAR, ANDERE] })
    expect(leer.find('[data-teil="co-piloten"]').exists()).toBe(true)
    expect(leer.find('[data-teil="co-piloten-sichtbar"]').exists()).toBe(false)
    expect(leer.find('[data-teil="co-pilot"]').exists()).toBe(false)
    const platz = leer.findAll('[data-teil="co-pilot-platz"]')
    expect(platz.map((p) => [p.attributes('aria-hidden'), p.classes('wkr-starterkarte-copiloten--platz')])).toEqual([
      ['true', true],
      ['true', true],
    ])
    // Dieselben Zeilen, Klassen und Klammern wie sichtbar – sonst wäre der Platz nicht so hoch wie der Block.
    expect(platz[0].findAll('.wkr-starterkarte-copilot').map((z) => [z.classes('wkr-starterkarte-copilot--ersatz'), z.text()])).toEqual([
      [false, 'Co-Pilot Copi Muster (+3,5 kg)'],
      [true, 'Ersatz Copa Beispiel (nicht gewogen)'],
    ])
    expect(platz[0].find('.wkr-starterkarte-copilot-ag--fehlt').exists()).toBe(true)
    // Platzhalter tragen keine Kennzeichen der sichtbaren Zeilen (Tests und Maske zählen nur `co-pilot`).
    expect(platz[0].find('[data-teil]').exists()).toBe(false)
    leer.unmount()
    // Mit eigenen Co-Piloten: der sichtbare Block zuerst, die anderen dahinter in derselben Zelle; leere Blöcke fallen weg.
    const eine = karte({ coPiloten: [PAAR[0]], coPilotPlatz: [ANDERE, []] })
    const kinder = eine.findAll('[data-teil="co-piloten"] > *').map((x) => x.attributes('data-teil'))
    expect(kinder).toEqual(['co-piloten-sichtbar', 'co-pilot-platz'])
    expect(eine.findAll('[data-teil="co-pilot"]').map((z) => z.text())).toEqual(['Co-Pilot Copi Muster (+3,5 kg)'])
    eine.unmount()
  })

  it('englische Liste (UIM): „Co-driver …“, „Substitute …“, Dezimalpunkt', () => {
    const w = karte({ coPiloten: PAAR, coPilotPlatz: [ANDERE] }, 'en')
    expect(w.findAll('[data-teil="co-pilot"]').map((z) => z.text())).toEqual(['Co-driver Copi Muster (+3.5 kg)', 'Substitute Copa Beispiel (not weighed)'])
    expect(w.find('[data-teil="co-pilot-platz"]').text()).toBe('Co-driver Carla Langername-Beispielhaft (+6 kg)')
    expect(w.find('[data-teil="boot"]').text()).toBe('Boat Flotte Lotte')
    w.unmount()
  })
})
