/**
 * Series palette — deliberately NOT a 'use client' module.
 *
 * The Overview page is a Server Component and needs seriesColor() while
 * rendering. When this lived in chart-kit.tsx ('use client'), calling it from
 * the server threw "seriesColor is not a function", exactly like the earlier
 * plainChange() crash: a Server Component importing from a client module gets
 * client references, not functions. Pure values and helpers therefore live
 * here, and only React components live in components/charts/.
 */
/*
 * Series palette.
 *
 * The old chart colors were 15 cycled saturated hues (blue, violet, amber,
 * emerald, red, pink...), which read as a rainbow and cheapened the page. These
 * six are brand-anchored (slot 1 is our brass gold) and were chosen with the
 * data-viz validator rather than by eye: each mode sits inside its lightness
 * band, clears the chroma floor, holds >= 3:1 contrast on its surface, and keeps
 * the worst ADJACENT colorblind separation at dE 8.6 (dark) / 9.9 (light),
 * with normal-vision separation above 22.
 *
 * Two rules matter when editing this:
 *  - Colour follows the STREAM, never its rank, so a stream keeps its colour
 *    when the ranking changes and people can learn it.
 *  - Never extend by cycling. Past six, series fold into the neutral "Other"
 *    bucket (see groupTopN), which is why six is enough.
 */
const SERIES_DARK = ['#b08a22', '#4a8fd6', '#cf6a45', '#279e8c', '#a86fc4', '#7d9e33'] as const;
const SERIES_LIGHT = ['#8a6b14', '#2f6fb8', '#b34f2c', '#00806a', '#8b4fae', '#5f7d1c'] as const;

/** Neutral gray for the "Other" bucket — deliberately not a categorical hue. */
export const OTHER_COLOR = '#6b7280';
export const OTHER_COLOR_LIGHT = '#64748b';

export function isLightTheme(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-theme') === 'light';
}

/**
 * The colour for a series, by its STABLE position in the stream list (not by
 * how much it earned). Pass the same index for the same stream everywhere.
 */
export function seriesColor(index: number, light = isLightTheme()): string {
  const ramp = light ? SERIES_LIGHT : SERIES_DARK;
  return ramp[((index % ramp.length) + ramp.length) % ramp.length];
}

export function otherColor(light = isLightTheme()): string {
  return light ? OTHER_COLOR_LIGHT : OTHER_COLOR;
}

/** Repaints a stream list with the validated palette, keeping order stable. */
export function withSeriesColors<T extends { slug: string }>(streams: T[], light?: boolean): T[] {
  return streams.map((s, i) => ({ ...s, color: seriesColor(i, light) }));
}


