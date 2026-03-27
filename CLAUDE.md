# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio website for Marcus Strauss — a systems engineer and AI integration specialist. Intended for a professional audience: potential clients, collaborators, and hiring teams in the tech space.

## Commands

```bash
npm run dev      # start dev server (localhost:4321)
npm run build    # production build → dist/
npm run preview  # preview the production build locally
```

## Tech Stack

- **Framework:** Astro 6 (static site generation — vanilla JS preferred, no React)
- **Styling:** Tailwind CSS v4 (configured via CSS `@theme`, not `tailwind.config.js`)
- **Animation:** GSAP
- **3D / WebGL:** Three.js (background effects)
- **Dev tooling:** Tweakpane (development only — never ship to production)

## Architecture

**Single-page application with swap-based navigation.** There are no separate pages or routes — navigation replaces the foreground content in-place while a persistent background layer remains mounted and running continuously. Sections: Home, Projects, About, Stack, Contact.

The entry point is `src/pages/index.astro`. Global styles are imported there (or in a shared layout if one is added). Astro components live in `src/components/`.

**Tailwind v4 note:** Custom color tokens are defined in `src/styles/global.css` using `@theme {}`, not a config file. They map directly to Tailwind utility classes:

| Token | Hex | Tailwind class example |
|---|---|---|
| `--color-background` | `#0e0e0e` | `bg-background` |
| `--color-surface-low` | `#131313` | `bg-surface-low` |
| `--color-surface-bright` | `#2c2c2c` | `bg-surface-bright` |
| `--color-text-primary` | `#e8e8e8` | `text-text-primary` |
| `--color-accent-primary` | `#f3bf32` | `text-accent-primary` |
| `--color-accent-tertiary` | `#ffede7` | `text-accent-tertiary` |

## Design Philosophy

Dark, minimal, restrained. Neutral black and white with warm accents — nothing saturated or loud.

- Animations must serve content or atmosphere — never decorative for its own sake
- The background is atmosphere, not spectacle
- Accents are earned: a single gold element in a monochrome layout carries more weight than gold used liberally — **when in doubt, use less**

## Workflow Conventions

- Features are built one at a time, each on its own branch: `feat/feature-name`
- Always confirm the current branch before starting new feature work
- Prefer lightweight, well-scoped solutions — no heavy abstractions
