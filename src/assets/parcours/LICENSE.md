# Parcours-Zeichnungen

Die SVG-Dateien in diesem Ordner stammen aus dem Repository
[Motorbootslalom/Parcours](https://github.com/Motorbootslalom/Parcours)
(Stand: Commit `9b92e699116aa571341e5a32f18adf345297d58c`, Ordner `dist/alcatraz_Parcours`; maschinenlesbar in `QUELLE.json`).

- Titel: „Schlauchbootslalom Parcours“
- Urheber: Matthias Kerk
- Lizenz: [Creative Commons Namensnennung – Nicht kommerziell – Weitergabe unter gleichen Bedingungen 4.0 International (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.de)

Die Zeichnungen stehen damit unter einer anderen Lizenz als der Programmcode
von Alcatraz (AGPL). Sie dürfen nicht kommerziell genutzt werden; wer sie
verändert weitergibt, muss den Urheber nennen und dieselbe Lizenz verwenden.

## Dateien

| Datei | Inhalt | Zustand |
|---|---|---|
| `Parcours.svg` | leerer Parcours (Erklärung der Blickrichtungen im Assistenten) | unverändert übernommen |
| `KlasseE.svg`, `Klasse1.svg` … `Klasse7.svg` | Fahrweg je Klasse | für Alcatraz bearbeitet, siehe unten |
| `Klasse5_Moewe.svg`, `Klasse6_Moewe.svg`, `Klasse7_Moewe.svg` | Fahrweg der Kursvariante „Möwe“ | für Alcatraz bearbeitet, siehe unten |

## Änderungen gegenüber der Quelle

Die Klassen-Zeichnungen holt `npm run parcours:sync` (scripts/parcours-sync.ts) aus dem
Parcours-Repository und macht sie dabei zurecht (`normalisiere` in src/lib/parcoursVertrag.ts):

- `viewBox` ergänzt, damit die Zeichnung skaliert,
- Editor-Angaben (`sodipodi:namedview`, `sodipodi:docname`) und drei ungenutzte Pfeilspitzen entfernt,
- der gestrichelte Rahmen der Exportfläche entfernt,
- Ausweichschriften hinter „Verdana“ und „Arial Black“ ergänzt,
- in den Metadaten (`dc:description`) vermerkt, dass und wie die Zeichnung bearbeitet ist, samt Lizenz.

Am Parcours selbst (Bojen, Fahrweg, Ziffern) ist nichts geändert. Zur Laufzeit blendet
Alcatraz je Wettkampfrichter-Position einzelne Tore ab oder Ziffern aus und dreht das Bild
(src/lib/parcoursbild.ts); im Assistenten liegen Markierungen über der Zeichnung. Auch diese
Fassungen sind Bearbeitungen im Sinne der Lizenz und stehen unter CC BY-NC-SA 4.0.

Den Commit oben und `QUELLE.json` schreibt `npm run parcours:sync`; es bricht ab, wenn
`dist/alcatraz_Parcours` der Quelle Änderungen hat, die in keinem Commit stehen.

## Namensnennung in der App

Wo Alcatraz eine der Zeichnungen zeigt, steht darunter Urheber, Quelle mit Stand, der Hinweis
„bearbeitet“ und die Lizenz (src/components/ParcoursNachweis.vue, Angaben aus `QUELLE.json`).
So reisen sie auch in der einzelnen HTML-Datei mit, in der diese Datei hier nicht liegt.
