/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Zusage an den Nutzer (15.11.2026): Ein Datum im Muster mm/dd/yyyy „darf es nie geben“. Die
// Datumswahl des Browsers zeigt es je nach Systemsprache – deshalb gibt es sie nirgends, auch in
// künftigen Ansichten nicht. Datumsfelder sind components/DatumFeld.vue (Verhalten:
// components/ClassSection.test.ts, lib/datum.test.ts).

function vueDateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name)
    return statSync(pfad).isDirectory() ? vueDateien(pfad) : name.endsWith('.vue') ? [pfad] : []
  })
}

describe('keine Datumswahl des Browsers', () => {
  // Auch kein gebundenes `:type` – es könnte zur Laufzeit „date“ ergeben, ohne dass es hier auffiele.
  it('kein <input> vom Typ date, datetime-local, month oder week in einer Vorlage', () => {
    const dateien = vueDateien(`${process.cwd()}/src`)
    expect(dateien.length).toBeGreaterThan(50)
    const funde = dateien.flatMap((datei) => {
      // Nur die Vorlage zählt – Kommentare im Skript dürfen das Wort nennen.
      const vorlage = readFileSync(datei, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '')
      return /type\s*=\s*["'](date|datetime-local|month|week)["']/.test(vorlage) || /:type\s*=/.test(vorlage) ? [datei] : []
    })
    expect(funde).toEqual([])
  })
})
