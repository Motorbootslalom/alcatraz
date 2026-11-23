# Parcours-Zeichnungen

Die SVG-Dateien in diesem Ordner stammen aus dem Repository
[Motorbootslalom/Parcours](https://github.com/Motorbootslalom/Parcours)
(Stand: Commit `a9c427581543d159193f32e8ef120851cc2d4a31`, Ordner `dist/alcatraz_Parcours`, die Parallelslalom-Zeichnung
aus `dist/parallel/alcatraz_Parcours`; maschinenlesbar in `QUELLE.json`).

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
| `Parallel.svg` | Parallelslalom, eine Bahn ohne Steg (Quelle `ParallelSlalom.svg`) | für Alcatraz bearbeitet, siehe unten |

## Änderungen gegenüber der Quelle

Die Klassen-Zeichnungen holt `npm run parcours:sync` (scripts/parcours-sync.ts) aus dem
Parcours-Repository und macht sie dabei zurecht (`normalisiere` in src/lib/parcoursVertrag.ts):

- `viewBox` ergänzt, damit die Zeichnung skaliert,
- Editor-Angaben (`sodipodi:namedview`, `sodipodi:docname`) und drei ungenutzte Pfeilspitzen entfernt,
- der gestrichelte Rahmen der Exportfläche entfernt,
- Ausweichschriften hinter „Verdana“ und „Arial Black“ ergänzt,
- in den Metadaten (`dc:description`) vermerkt, dass und wie die Zeichnung bearbeitet ist, samt Lizenz.

Die Parallelslalom-Zeichnung (`Parallel.svg`) ist seit 23.11.2026 die Ausgabe „eine Bahn ohne Steg“ des
Parcours-Repositorys: Zuschnitt auf eine Bahn und die IDs der Bojen (`A_Boje1` … `A_Boje5`, `A_StartZiel_oben`/`_unten`)
stammen von dort. Derselbe Sync macht sie zurecht (`machParallel` in src/lib/parcoursVertrag.ts) wie die
Klassen-Zeichnungen (viewBox, Editor-Angaben, Ausweichschriften), dazu:

- die Exportfläche (unsichtbares Rechteck) sowie ungenutzte Pfeilspitzen und Verläufe entfernt,
- Inkscape-Schriftangaben entfernt,
- der Bearbeitungsvermerk nennt diese Änderungen.

Am Parcours selbst (Bojen, Fahrweg, Ziffern) ist nichts geändert. Zur Laufzeit blendet
Alcatraz je Wettkampfrichter-Position einzelne Tore ab oder Ziffern aus und dreht das Bild
(src/lib/parcoursbild.ts); im Assistenten liegen Markierungen über der Zeichnung. Auch diese
Fassungen sind Bearbeitungen im Sinne der Lizenz und stehen unter CC BY-NC-SA 4.0.

Den Commit oben und `QUELLE.json` schreibt `npm run parcours:sync`; es bricht ab, wenn
`dist/alcatraz_Parcours` oder `dist/parallel/alcatraz_Parcours` der Quelle Änderungen hat, die in keinem Commit stehen.

## Namensnennung in der App

Wo Alcatraz eine der Zeichnungen zeigt, steht darunter Urheber, Quelle mit Stand, der Hinweis
„bearbeitet“ und die Lizenz (src/components/ParcoursNachweis.vue; auf den WKR-Geräten seit 23.11.2026 zugeklappt
unter „Mehr“, src/components/wkr/WkrBildNachweis.vue – auch für die Parallelslalom-Zeichnung; Angaben aus `QUELLE.json`).
Auf gedruckten WKR-Bögen mit Zeichnung steht dasselbe als Zeile im Fuß (src/lib/parcoursNachweis.ts) – seit 23.11.2026
auch auf dem Fahrweg-Bogen des Parallelslaloms, der die eine Bahn neben der Legende trägt.
So reisen sie auch in der einzelnen HTML-Datei mit, in der diese Datei hier nicht liegt.
