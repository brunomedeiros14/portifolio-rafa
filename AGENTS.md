# AGENTS.md — Rafael Dias Photography Portfolio

Project-specific context for AI coding agents working on this repository.
Read this first before making any changes.

## Objective
Preserve and refine an existing Vite + TypeScript + Bun photography portfolio site for
photographer **"RAFA" / "Rafael Dias"** (project concept "Between Moments" — a dark,
gallery-like wedding/pre-wedding photography portfolio). Keep all original features
(WebGL gallery, i18n, animations, lightbox, carousel, project view) while iterating on
design details requested by the user.

## Important Details
- Project location: `/Users/bruno/projects/temp/portifolio-rafa`
- **Tech**: Vite v8.2.2 + TypeScript (strict) + Bun + Three.js v0.185.1 (npm)
- `publicDir: 'assets'` in Vite config → `assets/` contents become static files in dist
- `tsconfig.json`: `"moduleResolution": "bundler"`, `"strict": true`, alias `@/*` → `src/*`
- Google Fonts loaded via `<link>` tags (NOT npm)
- **Bilingual**: Default language is **pt-BR**; English appears only when the user toggles.
  Latest `initI18n` sets `let currentLang: Language = 'pt'` and calls `applyLang(currentLang)`
  on init. `index.html` starts with `<html lang="pt-BR" data-lang="pt">`. All default
  `data-i18n` texts in HTML are Portuguese.
- **Manifesto**: Section internationalized via i18n key `manifesto.text`, `applyManifesto()`
  splits into `.manifesto__word` spans, robustness via `(window as any).__manifestoRevealed`
  flag set in `initWordReveal` (animations.ts).
- **Custom cursor**: Standard OS-style arrow pointer (SVG) tracking mouse exactly (no lerp);
  hover labels (`data-cursor`) show as accent badge.
- **Hero**: WebGL `HeroScene` fully removed; hero uses HTML `<img>` background
  (`hero__bg`/`hero__bg-img`) with CSS parallax via `initParallax` (animations.ts).
  Unsplash image `photo-1511285560929-80b456fea0bc` (`w=2000&q=85`, `fetchpriority="high"`).
  Title "RAFAEL / DIAS"; i18n keys `hero.tagline`, `hero.label` = "FOTÓGRAFO DE CASAMENTOS",
  `hero.specialties` = "CASAMENTOS / PRÉ-WEDDING / ENSAIOS".
- **Nav contrast**: `.nav` has permanent top scrim gradient; `.is-scrolled` =
  `rgba(10,10,10,0.92)` + blur; links use `rgba(240,236,228,0.85)` with `text-shadow`.
- **Carousel drag fix**: `-webkit-user-drag: none` + `user-select: none` on
  `.carousel__slide img` (CSS) + `dragstart` → `preventDefault()` listener (gallery.ts).
- **Footer design direction** (user's minimalist luxury studio spec):
  - Near-black charcoal background, generous negative space
  - Bold uppercase photographer logo aligned LEFT
  - Refined horizontal navigation CENTERED horizontally
  - Small monochromatic social icons aligned RIGHT
  - Very thin low-contrast horizontal divider separating nav from legal section
  - Editorial Swiss-inspired typography: uppercase labels with subtle letter-spacing,
    muted gray secondary text, crisp white primary text
  - **AVOID**: cards, gradients, excessive rounded corners, glassmorphism, bright colors,
    decorative UI elements
- **User CANNOT be shown reference images reliably** — this AI model has no image input.
  Implement visual direction from written descriptions only; ask for clarification when a
  written spec is ambiguous.

## Current Footer Implementation (latest state)
- **Markup** (`index.html`) — `<footer class="footer" role="contentinfo">` has these DIRECT
  children (NO `footer__inner` wrapper — removed 2026-09-03):
  - `.footer__brand` (logo link "RAFA", `href="#hero"`)
  - `.footer__nav` (semantic `<nav>`, 4 links: PORTFÓLIO/PROJETOS/SOBRE/CONTATO, i18n keys
    `footer.work`, `footer.projects`, `footer.about`, `footer.contact`)
  - `.footer__legal` (COPYRIGHT/LOCATION/BACK-TOP container — this is where the thin divider
    belongs): `.footer__copy` (`© 2026 Rafael Dias`), `.footer__location`
    (`Minas Gerais, Brasil`), `.footer__back-top` button (`id="back-to-top"`, i18n `footer.top`)
- **CSS** (`src/styles/style.css`, footer block ~line 1531):
  - `.footer`: `display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;`
    plus `max-width: 1600px; margin: 0 auto; padding: calc(var(--space-xl) * 2)
    var(--container-padding); background: var(--color-bg); border-top: 1px solid var(--color-border);`
  - `.footer__brand`: `justify-self: start`
  - `.footer__name`: serif, `--text-2xl`, `font-weight: 700`, `letter-spacing: 0.18em`,
    uppercase, `--color-text`; hover → `--color-text-muted`
  - `.footer__nav`: centered flex, gap `--space-xl`
  - `.footer__link`: `--text-xs`, `letter-spacing: 0.2em`, uppercase, `--color-text-muted`;
    hover → `--color-text`
  - `.footer__social` was REMOVED from markup? NO — verified: still present in markup between
    nav and legal (3 Lucide-style SVG icons 16×16: Instagram, Mail, Behance). Styles:
    `.footer__social` centered/`justify-self: end`, `.footer__social-link` monochrome
    `--color-text-dim` (no circles/borders), hover → `--color-text`
  - `.footer__legal`: flex `space-between`, `max-width: 1600px`, `margin:
    calc(var(--space-xl) * 2) auto 0; padding-top: var(--space-lg); border-top: 1px solid
    var(--color-border)` (the thin low-contrast divider)
  - `.footer__copy`, `.footer__location`: `--text-xs`, `letter-spacing: 0.18em`, uppercase,
    `--color-text-dim`
  - `.footer__back-top`: `--text-xs`, uppercase, `--color-text-dim`, hover → `--color-text`
  - Responsive `@media` block (~line 2066): `.footer` becomes single centered column
    (`grid-template-columns: 1fr`), brand/nav/social centered, `.footer__legal` vertical
    centered stack with `gap: var(--space-sm)`
- **Note**: `--text-2xs` does NOT exist; smallest token is `--text-xs`. The old
  `.footer__inner`, `.footer__meta`, `.footer__tagline` rules were fully removed (verified no
  references remain). `footer.tagline` i18n key still exists unused in i18n.ts (harmless).

## Design Tokens (CSS variables, from style.css `:root`)
- `--color-bg: #0a0a0a` (near-black charcoal), `--color-bg-elevated: #111111`
- `--color-text-dim: #4a4a4a` (muted gray secondary)
- `--color-border: rgba(240,236,228,0.08)` (thin low-contrast divider)
- `--color-border-hover: rgba(240,236,228,0.2)`
- `--color-accent-subtle: rgba(200,169,126,0.15)`
- `--font-display: 'Playfair Display', Georgia, serif`
- `--font-ui: 'Space Grotesk', 'Helvetica Neue', sans-serif`
- `--font-body` also exists
- Spacing: `--space-xs: 0.25rem`, `--space-sm: 0.5rem`, `--space-md: 1rem`,
  `--space-lg: clamp(1.5rem,3vw,2rem)`, `--space-xl: clamp(2rem,5vw,4rem)`
- Text: `--text-xs` (smallest) … `--text-hero: clamp(4rem,12vw+1rem,14rem)`; no `--text-2xs`
- `--container-padding: clamp(1.25rem,4vw,3rem)`

## i18n (src/i18n.ts)
- Footer keys (PT + EN): `footer.work`, `footer.projects`, `footer.about`, `footer.contact`,
  `footer.top` (all used). `footer.tagline` unused but defined — safe to remove if desired.
- `applyLang`, `applyManifesto`, `initI18n` (default `'pt'`) live here.
- Add any new visible text as a `data-i18n` key AND define it in BOTH PT and EN blocks.

## Commands
- Dev server: `bun run dev`
- Build (type-check + bundle): `bun run build`
  (runs `tsc --noEmit && vite build`; must pass after any change)
- Lint/typecheck: `tsc --noEmit` (build already does this)

## Relevant Files
- `index.html` — footer markup, hero, manifesto, cursor SVG; `<html lang="pt-BR">`
- `src/styles/style.css` — all styles; footer block ~line 1531, responsive ~line 2066
- `src/i18n.ts` — PT/EN strings, `applyLang`, `applyManifesto`, `initI18n`
- `src/animations.ts` — scroll reveals, hero parallax, `initWordReveal`/`__manifestoRevealed`
- `src/gallery.ts` — Lightbox/Carousel/FullscreenGallery/ProjectView, carousel drag fix
- `src/three-scene.ts` — GalleryScene only (HeroScene removed)
- `src/data.ts` — `DATA` object; `src/types.ts` — interfaces
- `package.json` — scripts/deps; `vite.config.ts`; `tsconfig.json`

## Work State
### Completed
- Full migration to Vite + TS + Bun; type-check and production build pass.
- Default site language pt-BR; English only via toggle.
- Manifesto fully internationalized.
- Cursor → standard pointer arrow.
- Hero → HTML image + CSS parallax; `HeroScene`/hero shaders removed.
- Carousel drag fixed.
- Nav contrast improved.
- Footer redesigned per minimalist luxury spec AND stripped of `footer__inner` wrapper
  (grid moved directly onto `.footer`); build verified passing.
- Last verified: `bun run build` succeeds (2026-09-03).

### Blocked
- None currently.

## Next Move / Suggested Follow-ups
1. Confirm with the user whether the footer's social icons block is still desired (it was
   retained in markup; if the reference image omits it, remove `.footer__social` from both
   HTML and CSS).
2. Optionally remove the unused `footer.tagline` i18n key.
3. Re-verify `bun run build` after any further edit.
