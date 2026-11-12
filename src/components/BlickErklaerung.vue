<script setup lang="ts">
import bild from '../assets/parcours/Parcours.svg'
import { t } from '../i18n'

/**
 * Was die Blickrichtungen im Assistenten bedeuten: der leere Parcours wie in
 * den Listen (Start links, Tor 5 rechts) mit je einem Pfeil von der Seite, von
 * der die Person überwiegend schaut. „Rechts“ und „links“ meinen die Seiten auf
 * der Hinfahrt – im Bild unten und oben.
 */
const PFEILE = [
  { id: 'vorne', x1: 20, y1: 290, x2: 218, y2: 290, tx: 14, ty: 196, anker: 'start' },
  { id: 'hinten', x1: 1260, y1: 290, x2: 1062, y2: 290, tx: 1266, ty: 196, anker: 'end' },
  { id: 'links', x1: 640, y1: 8, x2: 640, y2: 80, tx: 662, ty: 30, anker: 'start' },
  { id: 'rechts', x1: 640, y1: 512, x2: 640, y2: 446, tx: 662, ty: 470, anker: 'start' },
] as const
</script>

<template>
  <svg class="blick-erklaerung" viewBox="0 0 1280 520" role="img" :aria-label="t('assist.viewPic.label')">
    <defs>
      <marker id="blick-spitze" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
      </marker>
    </defs>
    <rect x="230" y="90" width="820" height="347" rx="6" class="blick-wasser" />
    <image :href="bild" x="230" y="90" width="820" height="347" />
    <!-- Fahrtrichtung, damit rechts und links eindeutig sind -->
    <line x1="420" y1="278" x2="850" y2="278" class="blick-hinfahrt" marker-end="url(#blick-spitze)" />
    <text x="635" y="268" text-anchor="middle" class="blick-klein blick-im-bild">{{ t('assist.viewPic.way') }}</text>
    <g v-for="p in PFEILE" :key="p.id" class="blick-pfeil">
      <line :x1="p.x1" :y1="p.y1" :x2="p.x2" :y2="p.y2" marker-end="url(#blick-spitze)" />
      <text :x="p.tx" :y="p.ty" :text-anchor="p.anker" class="blick-titel">{{ t(`assist.view.${p.id}`) }}</text>
      <text :x="p.tx" :y="p.ty + 24" :text-anchor="p.anker" class="blick-klein">{{ t(`assist.viewPic.where.${p.id}`) }}</text>
      <text :x="p.tx" :y="p.ty + 46" :text-anchor="p.anker" class="blick-klein blick-grau">
        {{ t(`assist.viewPic.turn.${p.id}`) }}
      </text>
    </g>
  </svg>
</template>
