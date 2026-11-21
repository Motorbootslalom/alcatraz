import { computed, type ComputedRef } from 'vue'
import type { ClassId } from '../../types'
import { useStore } from '../../state/store'
import { useKonfig } from '../../lib/konfig'
import { sichtOeffentlich } from '../../betrieb/sicht'
import { listenDerVeranstaltung, listenKennung, liesListe, teileVon, type ListenTeil } from '../../wkr/liste'
import { listeMitMaske } from '../../wkr/maske'
import { tIn, t, type MessageKey } from '../../i18n'

/**
 * WKR-Listen zum Zuweisen an ein Gerät (W3.2, Plan docs/plan-wkr-w3.md §6, 21.11.2026) – geteilt von GeraeteKoppeln.vue
 * (Aufgabe für das nächste Gerät) und GeraeteListe.vue (Listen eines gekoppelten Geräts ändern). Welche Listen es gibt,
 * sagt allein wkr/liste.ts listenDerVeranstaltung (dieselbe Prüfung wie am Host, erlaubteWkr); die Titel stehen in der
 * Sprache der Oberfläche wie in der Matrix (WkrMatrix.vue), gruppiert nach Parcours bzw. im Parallelslalom nach
 * Racecourse. Listen ohne Maske in W3 (Bojen, Zeit – wkr/maske.ts listeMitMaske, J1) tragen `ohneMaske`.
 */

export interface ListenWahl {
  kennung: string
  /** Titel der Liste in Oberflächensprache, im Parallelslalom mit Racecourse („Tor 5 A“). */
  titel: string
  /** Name des Bereichs (Parcours bzw. Parallelslalom). */
  bereich: string
  /** Steg: in Ablegen/Anlegen teilbar (F16). */
  teilbar: boolean
  /** In W3 ohne Maske auf dem Gerät (G14) – „Maske folgt – Papier“. */
  ohneMaske: boolean
}

export interface ListenGruppe {
  name: string
  listen: ListenWahl[]
}

export function useListenWahl(): {
  gruppen: ComputedRef<ListenGruppe[]>
  liste: (kennung: string) => ListenWahl | undefined
  listeText: (kennung: string, teil?: ListenTeil) => string
} {
  const { state } = useStore()
  const konfig = useKonfig({ oberflaeche: true })

  const alle = computed<ListenWahl[]>(() => {
    const k = konfig.value
    const namen = new Map(sichtOeffentlich(state.value, { logos: false }).bereiche.map((b) => [b.id, b.name]))
    const klassen = state.value.starters.map((s) => s.klasse as ClassId)
    const maske = new Map<string, boolean>()
    return listenDerVeranstaltung(state.value, k).map((l) => {
      const def = k.getPositions().some((p) => p.typeId === l.typeId) ? k.getSheetDef(l.typeId).title : l.typeId
      if (!maske.has(l.typeId)) maske.set(l.typeId, listeMitMaske(k, l.typeId, klassen))
      return {
        kennung: listenKennung(l),
        titel: l.racecourse ? `${def} ${l.racecourse}` : def,
        bereich: namen.get(l.bereich) ?? l.bereich,
        teilbar: !!teileVon(l.typeId),
        ohneMaske: !maske.get(l.typeId),
      }
    })
  })

  const gruppen = computed<ListenGruppe[]>(() => {
    const aus: ListenGruppe[] = []
    for (const l of alle.value) {
      const rc = liesListe(l.kennung)?.racecourse
      const name = rc ? t('geraete.koppeln.liste.racecourse', { bereich: l.bereich, rc }) : l.bereich
      let g = aus.find((x) => x.name === name)
      if (!g) aus.push((g = { name, listen: [] }))
      g.listen.push({ kennung: l.kennung, titel: l.titel, bereich: l.bereich, teilbar: l.teilbar, ohneMaske: l.ohneMaske })
    }
    return aus
  })

  const liste = (kennung: string) => alle.value.find((l) => l.kennung === kennung)

  /** „Steg (Parcours 1, nur Ablegen)“ – für „Für: …“ beim Koppeln und in der Geräteliste. */
  function listeText(kennung: string, teil?: ListenTeil): string {
    const l = liste(kennung)
    if (!l) return t('geraete.koppeln.liste.unbekannt')
    const zusatz = [l.bereich, teil ? t(`geraete.koppeln.liste.teil.${teil}`) : null].filter(Boolean).join(', ')
    return `${l.titel} (${zusatz})`
  }

  return { gruppen, liste, listeText }
}

/**
 * Ist das ein Handy? (G3 nach J2) Das Register kennt keine Geräteart; der Name ist bis zum Umbenennen die übersetzte
 * Art, die das Gerät beim Koppeln vorschlägt (geraete/geraeteName.ts) – in einer der beiden Sprachen.
 */
export function istHandyName(name: string): boolean {
  const n = name.trim().toLowerCase()
  const arten: MessageKey[] = ['geraete.name.iphone', 'geraete.name.android-handy']
  return (['de', 'en'] as const).some((sprache) => arten.some((key) => n.startsWith(tIn(sprache, key).toLowerCase())))
}
