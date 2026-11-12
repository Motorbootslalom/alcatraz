import { computed } from 'vue'
import { useStore } from '../state/store'
import { CLASSES } from '../domain/classes'
import { hasParallel, regelwerkOf } from '../config/catalog'
import { t } from '../i18n'
import type { ClassId } from '../types'

/**
 * Was sich aus dem Regelwerk der Veranstaltung ergibt: welche Klassen es gibt,
 * wie sie heißen und ob ein Parallelslalom gefahren wird.
 */
export function useEvent() {
  const { state } = useStore()
  const regelwerk = computed(() => regelwerkOf(state.value.regelwerk))

  /**
   * Klassen der Veranstaltung. Klassen außerhalb des Regelwerks bleiben
   * sichtbar, solange noch Starter darin stehen – sonst verschwänden nach einem
   * Wechsel des Regelwerks Starter, ohne dass man sie löschen könnte.
   */
  const classes = computed(() => {
    const used = new Set(state.value.starters.map((p) => p.klasse))
    return CLASSES.filter((c) => regelwerk.value.klassen.includes(c.id) || used.has(c.id))
  })

  /** Klassen mit Startern, die es nach dem Regelwerk nicht gibt. */
  const foreignClasses = computed(() => classes.value.filter((c) => !regelwerk.value.klassen.includes(c.id)))

  /** „Klasse 3“ – oder der Name aus dem Regelwerk, z. B. „Dolphin“. */
  const classLabel = (id: ClassId) => regelwerk.value.klassenNamen[id] ?? t('common.class', { id })

  const parallel = computed(() => hasParallel(state.value.regelwerk))

  return { regelwerk, classes, foreignClasses, classLabel, parallel }
}
