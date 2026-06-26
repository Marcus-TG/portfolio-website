# Agent guide

Working notes for AI agents (and humans) on this repo. Read the README first for
the high-level picture; this file covers conventions and the load-bearing details
that aren't obvious from the code.

## Verify changes

There is no test suite. After any change:

```bash
npm run build      # must pass
npx astro check    # TypeScript / template diagnostics — run separately
```

Then sanity-check visually with `npm run dev` — especially anything touching the
reveal, routing, sliders, or background. `astro build` does **not** run
`astro check`.

## How the page is wired

- `src/pages/index.astro` owns the whole runtime: preloader, hash routing,
  section crossfades, reveal orchestration, and the background lifecycle. Start
  there.
- Sections live in a fixed content area, stacked and absolutely positioned. Each
  is `class="section absolute inset-0 opacity-0 pointer-events-none"` and shown by
  toggling opacity + `pointer-events-none`. Exactly one is active.
- Routing is hash-based and manual — no router library. A section id must appear
  in **all three** of: `Nav.astro` `links`, the `<Work/>`-style placement in
  `index.astro`, and the `valid` array in `getTargetSection()`.

## Reveal animation — the big rule

`src/scripts/revealMotion.ts` is a GSAP/SplitText engine that animates elements
marked `data-reveal="title" | "lines" | "item"`.

- **It plays once, on initial page load only.** Section switches and slider slide
  changes must stay plain opacity crossfades. Do not reintroduce `revealElement` /
  `prepareSection` / `playSection` into navigation or the sliders — use
  `showSection(id)` (shows content instantly) instead. This was a deliberate
  change; replaying the reveal on every transition was unwanted.
- Every `[data-reveal]` element is `visibility: hidden` by default (see
  `global.css`). It only becomes visible when the engine runs — so any new
  `data-reveal` element that is *never* revealed/shown will be invisible. If you
  add reveal targets to a section, ensure it goes through `showSection` or the
  load reveal.
- Reduced-motion (`prefers-reduced-motion: reduce`) skips all animation and just
  shows content. Keep that path working.

## Sliders (Work & Projects)

- `Work.astro` and `Projects.astro` are near-identical sliders. Keep their
  behavior in sync when changing one.
- Entries are data arrays in component frontmatter. The counter derives from array
  length — don't hardcode totals.
- Controls: arrows, ArrowLeft/ArrowRight keys (guarded so they only fire while the
  section is active, i.e. not `pointer-events-none`), wheel, and touch swipe.
- Slide transition is a plain opacity crossfade (per the reveal rule above).

## Background (WebGL)

- `src/background/BackgroundScene.js` is a hand-written WebGL renderer (no
  Three.js). Shaders are in `src/background/shaders/` + `noise.glsl`, imported with
  Vite's `?raw`.
- It must **degrade gracefully**: construction is wrapped in try/catch in
  `index.astro`; if WebGL is unavailable the scene is skipped and the solid
  `#background` color remains. Don't let background code throw and break the page
  script.
- The render loop starts at reveal time (warm-up stall hidden behind the
  preloader) and is disposed on `pagehide`. Preserve that lifecycle.

## Styling conventions

- Tailwind v4, CSS-first. All design tokens live in the `@theme` block in
  `src/styles/global.css` — there is no `tailwind.config.js`. Don't hardcode hex
  values when a token exists (`--color-text-primary`, `--color-accent-primary`,
  `--color-surface-bright`, etc.).
- Components use scoped `<style>` blocks with `.work-`/`.projects-` prefixes.
- Mobile rules live both in component `@media (max-width: 768px)` blocks and the
  global mobile block in `global.css`.

## Assets

- Work screenshots are in `public/images/` at stable paths
  (`saros-creative.png`, `luke-chin.png`); swap by overwriting the file.
- `sharp` is available via Astro's deps for image work (cropping, inspection) —
  run such scripts from the project root so `sharp` resolves. macOS screenshot
  filenames contain non-breaking-space characters; match them with globs, not
  literal spaces.

## Git / commits

- No AI/assistant attribution in commit messages or PR metadata — human-authored
  message only, no `Co-Authored-By` trailers.
- Commit to the current branch; only branch when asked.
