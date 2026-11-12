import { load as yamlLoad } from 'js-yaml'
import type { RawQuelle } from './schema'

// Die Konfiguration der Positionen liegt unter src/config auf mehrere Dateien
// verteilt. Dieses Modul führt sie zusammen: beim Modulstart von konfig.ts aus den
// eingebundenen YAML-Texten (im Prototyp tat das der Build) und in den Tests.

/** Quelldateien ohne `.yaml`, relativ zu src/config, in Reihenfolge. */
export function quellDateien(aufbautenText: string): string[] {
  const { dateien = [], sprachen = [] } = (yamlLoad(aufbautenText) as { dateien?: string[]; sprachen?: string[] }) ?? {}
  return [
    'einstellungen',
    ...sprachen.map((s) => `i18n/${s}`),
    'aufbauten/gemeinsam',
    ...dateien.map((d) => `aufbauten/${d}`),
  ]
}

/**
 * Listen werden aneinandergehängt, benannte Einträge zusammengelegt. Positionen in
 * Kurzform bleiben, wie sie sind; aufloesen() in kurzform.ts schreibt sie aus.
 */
export function mergePositionen(teile: unknown[]): RawQuelle {
  const out: Record<string, unknown> = { positionen: [] }
  for (const teil of teile) {
    for (const [key, wert] of Object.entries((teil ?? {}) as Record<string, unknown>)) {
      const bisher = out[key]
      if (Array.isArray(wert)) out[key] = [...(Array.isArray(bisher) ? bisher : []), ...wert]
      else if (wert && typeof wert === 'object') out[key] = { ...(bisher as object), ...wert }
      else out[key] = wert
    }
  }
  return out as unknown as RawQuelle
}
