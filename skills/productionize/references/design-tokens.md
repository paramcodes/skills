# Design tokens and motion rules

## globals.css skeleton

```css
@import "tailwindcss";

:root {
  /* Brand */
  --red: oklch(0.59 0.25 27);
  --red-dark: oklch(0.47 0.22 27);

  /* Surfaces */
  --bg: oklch(0.12 0 0);
  --bg-elev: oklch(0.18 0 0);
  --bg-card: oklch(0.24 0 0);

  /* Text */
  --foreground: oklch(0.985 0 0);
  --fg-muted: oklch(0.72 0 0);

  /* Border */
  --border: oklch(1 0 0 / 10%);

  /* Motion */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --duration-fast: 100ms;
  --duration-base: 150ms;
  --duration-drawer: 240ms;

  /* shadcn mapping */
  --background: var(--bg);
  --card: var(--bg-card);
  --primary: var(--red);
  --primary-foreground: oklch(0.985 0 0);

  /* Font */
  --font-sans: var(--font-figtree), system-ui, sans-serif;
}

* { box-sizing: border-box; }

html { color-scheme: dark; }

body {
  background: var(--bg);
  color: var(--foreground);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

h1, h2, h3 { text-wrap: balance; }
p { text-wrap: pretty; }

button { cursor: pointer; }

/* Reduced motion: keep opacity/color, drop movement */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition-property: color, background-color, border-color, opacity !important;
    transition-duration: 100ms !important;
  }
}

/* Hover only on fine pointers (no sticky hover on touch) */
@media (hover: hover) and (pointer: fine) {
  .hover-lift:hover { transform: translateY(-1px); }
}

/* Scrollbars */
.scroll-pane {
  scrollbar-width: thin;
  scrollbar-color: oklch(1 0 0 / 20%) transparent;
}
.scroll-pane::-webkit-scrollbar { width: 8px; height: 8px; }
.scroll-pane::-webkit-scrollbar-thumb {
  background: oklch(1 0 0 / 20%);
  border-radius: 999px;
}
.scroll-pane::-webkit-scrollbar-thumb:hover { background: oklch(1 0 0 / 35%); }

/* Long lists: cheap always-on virtualization */
.song-row {
  contain: layout style;
  content-visibility: auto;
  contain-intrinsic-size: 0 56px;
}

/* Tabular numbers for time/counts */
.tabular { font-variant-numeric: tabular-nums; }
```

## Motion rules (summary)

- Easing: `--ease-out` for enters/exits and press feedback; `--ease-in-out` for on-screen
  movement; `--ease-drawer` for drawers/sheets.
- Transitions: named properties only, 100-150ms, `ease-out`. Never `transition: all`.
- Press: `scale(0.96)` on active, never below 0.95.
- Stagger: 40ms per item for grid entrances.
- Buffering spinners debounced 200ms so instant loads never flash.
- Like pop: scale to 1.25 for 200ms then settle; removal raises an Undo toast.
- Empty states fade in over 240ms.
- Collapsible panels: content fades out over `--duration-drawer`, region goes `inert`.

## Typography scale

| Role | Size | Weight | Usage |
|---|---|---|---|
| Display | text-3xl (30px) | bold | Hero title on detail page |
| Page title | text-2xl (24px) | bold | Top-level route heading |
| Section | text-lg (18px) | semibold | In-page section heading |
| Body | text-sm (14px) | medium/semibold | Row title, button label |
| Caption | text-xs (12px) | normal/medium | Artist, duration, meta, eyebrows (sentence case) |

Never skip a level; never introduce sizes outside this scale. Eyebrows are sentence case, not
all caps.

## Icons

- One icon set, one stroke weight per surface, `currentColor`, outline default / fill active.
- RTL: flip directional icons only.
- Load icons via `optimizePackageImports` to tree-shake.

## Mobile

- Below `lg`: bottom nav replaces sidebar; queue opens in a bottom sheet.
- Touch targets ≥ 44px (`min-h-11` on nav items).
- Player bar keeps art + transport + like; seek bar and speed from `md` up.
- Mobile seek: draggable slider on the player's top edge, commit on release (`onValueCommitted`).
- Sticky hover gated to `pointer: fine`.
