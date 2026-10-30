// Turns a CSS colour such as "var(--q-open)" into the value it stands for (e.g. "#1d6b4f"), using the
// design tokens in style.css. Needed where a library can't read CSS variables, like Leaflet map markers.
// Plain colours ("#ffffff") are returned as they are.
export function cssColor(value) {
  const match = /^var\((--[\w-]+)\)$/.exec(String(value).trim())
  if (!match) return value
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || value
}
