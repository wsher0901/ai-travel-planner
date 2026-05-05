// Filled-silhouette annotation glyphs — replace the prior 22×22 stroke-only
// designs. All glyphs:
//   - 26×26 viewBox (default render size 26 px)
//   - filled with currentColor (no strokes), so the parent sets color via CSS
//   - designed for legibility at the small annotation-strip render size
//
// Intensity is communicated via opacity (set on the wrapping <svg>) — the
// underlying glyph shape doesn't change between sub-tiers, only its
// brightness. Per CLEANUP-C: light → 0.78, moderate → 0.92, heavy → 1.00.

import type { ComponentType, SVGProps } from 'react';

export interface GlyphProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'fill'> {
  // Glyph-wide opacity. Default 1.0; AnnotationStrip overrides for sub-tier
  // intensity (light/moderate/heavy).
  opacity?: number;
}

// Locked-spec colors per tier family / event. Saturation bumped slightly
// from the previous palette so the small filled silhouettes read clearly
// on the dark Jarvis background.
export const GLYPH_COLORS = {
  sun:          '#F8C460',
  partlyCloud:  '#7FB1E2',
  overcast:     '#8492A4',
  foggy:        '#C7CBCE',
  rain:         '#7FA0C2',
  snow:         '#D5D9DD',
  thunderstorm: '#B49DF7',
  sunrise:      '#F59E0B',
  sunset:       '#F59E0B',
} as const;

function GlyphSvg({
  children,
  width = 26,
  height = 26,
  ...rest
}: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 26 26"
      width={width}
      height={height}
      fill="currentColor"
      stroke="none"
      {...rest}
    >
      {children}
    </svg>
  );
}

// Reusable cloud silhouette path (used as the top of rain/snow/storm glyphs
// and as the body of the overcast glyph). 3-lobed cloud, ~7 vb tall.
const CLOUD_PATH = 'M 6 12 C 4 12, 3 11, 3 9.5 C 3 7.5, 5 6.5, 7 7 C 7.5 5, 10 4, 12 4.5 C 14.5 4, 17 5, 18 7 C 20 6.5, 22 7.5, 22 10 C 22 11.5, 20.5 12, 18 12 Z';

// SunGlyph — filled disc + 8 small filled rays (rounded rects).
export const SunGlyph: ComponentType<GlyphProps> = (props) => (
  <GlyphSvg {...props}>
    <circle cx="13" cy="13" r="5" />
    {/* 8 ray dots at radius 9, 45° apart */}
    <circle cx="13"   cy="3"    r="1.4" />
    <circle cx="20.07" cy="5.93" r="1.4" />
    <circle cx="23"   cy="13"   r="1.4" />
    <circle cx="20.07" cy="20.07" r="1.4" />
    <circle cx="13"   cy="23"   r="1.4" />
    <circle cx="5.93"  cy="20.07" r="1.4" />
    <circle cx="3"    cy="13"   r="1.4" />
    <circle cx="5.93"  cy="5.93" r="1.4" />
  </GlyphSvg>
);

// PartlyCloudGlyph — small filled sun upper-left + filled cloud lower-right.
export const PartlyCloudGlyph: ComponentType<GlyphProps> = (props) => (
  <GlyphSvg {...props}>
    {/* Sun upper-left */}
    <circle cx="8" cy="8" r="3.5" />
    {/* Cloud lower-right (shifted right + down from CLOUD_PATH) */}
    <path d="M 11 18 C 9.5 18, 9 17, 9 15.5 C 9 14, 10.5 13, 12 13.5 C 12.5 11.5, 14.5 11, 16 11.5 C 18 11, 19.5 12, 20 14 C 21.5 13.5, 23 14.5, 23 16 C 23 17.5, 22 18, 20 18 Z" />
  </GlyphSvg>
);

// OvercastGlyph — single filled cloud silhouette, centered.
export const OvercastGlyph: ComponentType<GlyphProps> = (props) => (
  <GlyphSvg {...props}>
    <path d={CLOUD_PATH} transform="translate(0, 4)" />
  </GlyphSvg>
);

// FoggyGlyph — 4 horizontal filled bars stacked, varying widths suggest
// drifting fog layers.
export const FoggyGlyph: ComponentType<GlyphProps> = (props) => (
  <GlyphSvg {...props}>
    <rect x="6"  y="6"  width="14" height="2" rx="1" />
    <rect x="3"  y="11" width="20" height="2" rx="1" />
    <rect x="5"  y="16" width="14" height="2" rx="1" />
    <rect x="9"  y="21" width="14" height="2" rx="1" />
  </GlyphSvg>
);

// RainGlyph — filled cloud + 3 filled raindrops (teardrop-shaped paths).
export const RainGlyph: ComponentType<GlyphProps> = (props) => (
  <GlyphSvg {...props}>
    <path d={CLOUD_PATH} />
    {/* 3 raindrops below — teardrop shapes leaning slightly left */}
    <path d="M 7 15 Q 6 17, 6 18.5 Q 6 20, 7.5 20 Q 9 20, 9 18.5 Q 9 17, 7.5 15.5 Z" />
    <path d="M 12 17 Q 11 19, 11 20.5 Q 11 22, 12.5 22 Q 14 22, 14 20.5 Q 14 19, 12.5 17.5 Z" />
    <path d="M 17 15 Q 16 17, 16 18.5 Q 16 20, 17.5 20 Q 19 20, 19 18.5 Q 19 17, 17.5 15.5 Z" />
  </GlyphSvg>
);

// SnowGlyph — filled cloud + 3 small filled discs as snowflake stand-ins.
// Filled circles read more cleanly at 26 px than thin asterisk arms.
export const SnowGlyph: ComponentType<GlyphProps> = (props) => (
  <GlyphSvg {...props}>
    <path d={CLOUD_PATH} />
    <circle cx="7"    cy="17" r="1.5" />
    <circle cx="12.5" cy="20" r="1.5" />
    <circle cx="18"   cy="17" r="1.5" />
    <circle cx="9.5"  cy="22.5" r="1.2" />
    <circle cx="15.5" cy="22.5" r="1.2" />
  </GlyphSvg>
);

// ThunderstormGlyph — filled cloud + filled lightning bolt.
export const ThunderstormGlyph: ComponentType<GlyphProps> = (props) => (
  <GlyphSvg {...props}>
    <path d={CLOUD_PATH} />
    {/* Lightning bolt — angular zigzag, fills inward */}
    <path d="M 14 13 L 11 18 L 13 18 L 10 24 L 16 17 L 14 17 L 16 13 Z" />
  </GlyphSvg>
);

// SunriseGlyph — filled half-disc bulging UPWARD from the horizon line
// (sun rising). Sweep-flag 1 chooses the upper semicircle (y < 14) per the
// SVG arc convention with y-down coordinates: clockwise from (4,14) to
// (22,14) on a chord-equals-diameter arc passes through (13, 5). The
// trailing `Z` closes the path back to the start point along the chord
// (y=14) so the implicit fill region is the upper half-disc only.
export const SunriseGlyph: ComponentType<GlyphProps> = (props) => (
  <GlyphSvg {...props}>
    <path d="M 4 14 A 9 9 0 0 1 22 14 Z" />
    <line x1="2" y1="14" x2="24" y2="14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </GlyphSvg>
);

// SunsetGlyph — filled half-disc bulging DOWNWARD into the horizon line
// (sun sinking). Sweep-flag 0 = counter-clockwise = lower semicircle
// (y > 14, through (13, 23)). Same horizon line as sunrise; the only
// differentiator is the disc's bulge direction.
export const SunsetGlyph: ComponentType<GlyphProps> = (props) => (
  <GlyphSvg {...props}>
    <path d="M 4 14 A 9 9 0 0 0 22 14 Z" />
    <line x1="2" y1="14" x2="24" y2="14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </GlyphSvg>
);
