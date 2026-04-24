# Marcus Strauss — Portfolio

Personal portfolio website for Marcus Strauss.

## Tech Stack

- **Framework:** Astro 6 (static site generation)
- **Styling:** Tailwind CSS v4
- **Animation:** GSAP
- **3D / WebGL:** Three.js (background effects)

## Architecture

Single-page application with swap-based navigation. Sections (Home, Projects, Contact) replace foreground content in-place while a persistent background layer remains mounted. Navigation is hash-based with GSAP crossfade transitions.

## Commands

| Command            | Action                                    |
| :----------------- | :---------------------------------------- |
| `npm install`      | Install dependencies                      |
| `npm run dev`      | Start dev server at `localhost:4321`       |
| `npm run build`    | Production build to `./dist/`             |
| `npm run preview`  | Preview production build locally          |
