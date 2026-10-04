/**
 * Coherent Agency brand tokens — the ONE place to re-theme the whole app.
 *
 * Every page (landing, login, signup, dashboards) reads colors through CSS
 * variables generated from this file at build time (see vite.config.ts →
 * `brandCssPlugin`). Change a value here, restart `npm run dev`, done.
 *
 * TODO(brand): https://coherent.agency could not be reached from the build
 * environment, so every value below is a placeholder taken from the project
 * brief. Replace each value marked TODO with the real brand values.
 */

export const brand = {
  name: 'Coherent', // TODO(brand): confirm wordmark text
  /** Corner radius used by cards, inputs and buttons. */
  radius: {
    sm: '6px', // TODO(brand): match coherent.agency small radius
    md: '10px', // TODO(brand): match coherent.agency button radius
    lg: '16px', // TODO(brand): match coherent.agency card radius
  },
  /** Button shape: 'rounded' uses radius.md, 'pill' uses a full pill. */
  buttonShape: 'rounded' as 'rounded' | 'pill', // TODO(brand): match coherent.agency button style
  colors: {
    light: {
      bg: '#ffffff', // TODO(brand)
      surface: '#f6f7f9', // TODO(brand)
      text: '#0f1419', // TODO(brand)
      muted: '#5b6670', // TODO(brand)
      border: '#e3e6ea', // TODO(brand)
      accent: '#2f5bff', // TODO(brand): primary brand color
      accentText: '#ffffff', // text on top of accent
      success: '#137a3f',
      warning: '#8a5a00',
      danger: '#c2261b',
    },
    dark: {
      bg: '#0d1014', // TODO(brand)
      surface: '#151a20', // TODO(brand)
      text: '#eef1f4', // TODO(brand)
      muted: '#9aa5b1', // TODO(brand)
      border: '#252c34', // TODO(brand)
      accent: '#6f8cff', // TODO(brand): primary brand color (dark)
      accentText: '#0d1014',
      success: '#4ccf86',
      warning: '#f0b44c',
      danger: '#ff7a70',
    },
  },
  fonts: {
    heading: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif",
    body: "'Inter Variable', 'Inter', system-ui, sans-serif",
  },
} as const

type Palette = Record<keyof typeof brand.colors.light, string>

function vars(p: Palette): string {
  return Object.entries(p)
    .map(([k, v]) => `--c-${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}: ${v};`)
    .join(' ')
}

/** Builds the :root CSS variables for both themes. Used by the Vite plugin. */
export function brandCss(): string {
  const shared = `--radius-sm: ${brand.radius.sm}; --radius-md: ${brand.radius.md}; --radius-lg: ${brand.radius.lg}; --radius-btn: ${
    brand.buttonShape === 'pill' ? '9999px' : brand.radius.md
  }; --font-heading-stack: ${brand.fonts.heading}; --font-body-stack: ${brand.fonts.body};`
  return [
    `:root { ${shared} ${vars(brand.colors.light)} color-scheme: light; }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${vars(brand.colors.dark)} color-scheme: dark; } }`,
    `:root[data-theme="dark"] { ${vars(brand.colors.dark)} color-scheme: dark; }`,
    `:root[data-theme="light"] { ${vars(brand.colors.light)} color-scheme: light; }`,
  ].join('\n')
}
