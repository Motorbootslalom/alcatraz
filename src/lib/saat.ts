/**
 * Eine neue Saat für eine Action mit Zufall (Mischen der Starter, lib/reihenfolge.ts). Entsteht
 * in der Oberfläche VOR dem dispatch: Der Reducer bleibt rein und rechnet aus der Saat
 * (lib/beispielwerte.ts zufallAus) – gleiche Saat, gleiches Ergebnis, auch in jedem Fenster.
 */
export const neueSaat = (): number => Math.floor(Math.random() * 0x100000000)
