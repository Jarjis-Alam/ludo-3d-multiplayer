---
name: Obsidian & Gilt Ludo
colors:
  surface: '#151311'
  surface-dim: '#151311'
  surface-bright: '#3c3936'
  surface-container-lowest: '#100e0c'
  surface-container-low: '#1d1b19'
  surface-container: '#221f1d'
  surface-container-high: '#2c2927'
  surface-container-highest: '#373432'
  on-surface: '#e8e1dd'
  on-surface-variant: '#d0c5af'
  inverse-surface: '#e8e1dd'
  inverse-on-surface: '#33302d'
  outline: '#99907c'
  outline-variant: '#4d4635'
  surface-tint: '#e9c349'
  primary: '#f2ca50'
  on-primary: '#3c2f00'
  primary-container: '#d4af37'
  on-primary-container: '#554300'
  inverse-primary: '#735c00'
  secondary: '#6fd8c8'
  on-secondary: '#003731'
  secondary-container: '#30a193'
  on-secondary-container: '#00302a'
  tertiary: '#ffbebc'
  on-tertiary: '#680011'
  tertiary-container: '#ff9594'
  on-tertiary-container: '#8f001b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffe088'
  primary-fixed-dim: '#e9c349'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#8cf5e4'
  secondary-fixed-dim: '#6fd8c8'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005048'
  tertiary-fixed: '#ffdad8'
  tertiary-fixed-dim: '#ffb3b1'
  on-tertiary-fixed: '#410007'
  on-tertiary-fixed-variant: '#92001c'
  background: '#151311'
  on-background: '#e8e1dd'
  surface-variant: '#373432'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  display-md:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.01em
  display-md-mobile:
    fontFamily: Space Grotesk
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.08em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system translates the ancestral geometry of Ludo into a bespoke, high-stakes tabletop experience reminiscent of custom lacquerware, turned ebonized walnut, and hand-chased brass hardware resting over deep charcoal felt. It targets discerning players who appreciate tactical tabletop gaming recontextualized as a luxury lounge artifact.

The aesthetic fuses **Tactile Luxury Minimalism** with **Atmospheric Neomorphism and Metallic Accents**. It relies on deep obsidian undertones, ultra-fine metallic framing, and vibrant jewel-tone player identification. Visual weight is communicated through layered material beds rather than excessive skeuomorphic textures: matte surfaces, polished bevels, satin metallic specular reflections, and crisp architectural vector lines.

## Colors

The palette revolves around deep carbon bases, antique gold hardware, and four saturated jewel tones that identify the quad-player territories.

### Foundation & Surfaces
- **Canvas Base:** `#12100e` (Obsidian Felt background)
- **Board Container Bed:** `#1a1714` (Lacquered walnut inner well)
- **Surface Elevation 1:** `#221f1b` with stroke `#38322a` (HUD docks, inactive player consoles, cards)
- **Surface Elevation 2:** `#2c2823` with stroke `#52493e` (Active modals, popovers, hovering tokens, dice tray)

### Hardware & Metallic Accents
- **Antique Gold Hardware (Default):** `#d4af37`
- **Gold Hover / Active State:** `#f3ca40`
- **Gold Specular Glow:** `rgba(212, 175, 55, 0.45)`
- **Subdued Brass:** `#8c7322`

### Quadrant Jewel Tones
- **Player 1 (Ruby Crimson):** `#e63946` | Soft backing: `rgba(230, 57, 70, 0.15)`
- **Player 2 (Emerald Jade):** `#2a9d8f` | Soft backing: `rgba(42, 157, 143, 0.15)`
- **Player 3 (Amber Topaz):** `#e9c46a` | Soft backing: `rgba(233, 196, 106, 0.15)`
- **Player 4 (Sapphire Cobalt):** `#457b9d` | Soft backing: `rgba(69, 123, 157, 0.15)`

## Typography

Typography establishes an aristocratic balance between bold architectural headings, effortless interface legibility, and technical numeric precision:

- **Headlines (`Space Grotesk`):** Provides a chiselled, modern, geometry-driven presence for victor announcements, phase titles, and modal headers.
- **Body (`Inter`):** Neutral, highly legible humanist-grotesque for turn logs, match rules, settings descriptions, and chat dialogues.
- **Labels, Telemetry, and Scores (`JetBrains Mono`):** Fixed-width clarity for timers, roll history, token step counts, seat identifiers, and coordinates. Uppercase styling with expanded tracking (`0.05em` to `0.1em`) is mandatory for turn labels and hardware indicators.

## Layout & Spacing

The layout treats the screen as an illuminated game salon table with an anchored, aspect-ratio-locked board framed by contextual tactile peripheral modules.

### Grid & Layout Principles
- **Desktop (1024px+):** Centered fixed 1:1 board stage (maximum 720px × 720px) flanked symmetrically by 4 player pods and HUD consoles via a 12-column fluid grid. Gutters are fixed to `1.5rem` (`gutter-desktop`).
- **Tablet (768px – 1023px):** Board commands the primary viewport with collapsed player badges occupying the top and bottom bands.
- **Mobile (<768px):** Board spans edge-to-edge with a `1rem` outer canvas margin (`margin`). Player quadrant statuses sit in a condensed bottom tray and top header.
- **Component Rhythm:** Interior padding consistently leverages `space-sm` (8px) for compact tags, `space-md` (16px) for cards and dice docks, and `space-xl` (40px) for stage sectional delineations.

## Elevation & Depth

Visual depth is conveyed through inset wells, hairline brass inlays, and ambient directional lighting. 

### Elevation Tiers
1. **Floor (Canvas):** `#12100e`, flat matte charcoal felt absorbing all peripheral spill.
2. **Depressed Well (Board Recess):** `#1a1714` bordered by an inner shadow (`inset 0 4px 12px rgba(0, 0, 0, 0.7)`), producing the impression of sunken lacquered woodwork.
3. **Resting Tier (Surface 1):** `#221f1b` with a crisp 1px solid border `#38322a` and soft contact shadow: `0 4px 16px rgba(0, 0, 0, 0.45)`.
4. **Floating Tier (Surface 2 / Modals / Active Pawns):** `#2c2823` with stroke `#52493e`, supported by a composite shadow: `0 12px 32px rgba(0, 0, 0, 0.65), 0 2px 6px rgba(0, 0, 0, 0.35)`.
5. **Turn Highlights & Active Glows:** Active interactable pieces and current-turn indicators receive a localized dual illumination: `0 0 16px rgba(212, 175, 55, 0.45)` alongside an inner bevel highlight `inset 0 1px 0 rgba(243, 202, 64, 0.5)`.

## Shapes

The design system adopts a **Soft (Level 1)** geometric language. Base elements use `0.25rem` (4px), containers utilize `0.5rem` (8px), and game cards / modal shells apply `0.75rem` (12px). 

Circular elements are reserved strictly for functional game tokens (pawns/markers), player profile crests, and coordinate steps on the Ludo track. Board tiles remain crisp, square-cut architectural cells featuring microscopic 2px rounded corners to imitate hand-cut lacquer inlays.

## Components

### 1. Buttons
- **Primary (Gilt Action):** Background in antique gold `#d4af37`, foreground text `#12100e` (JetBrains Mono bold uppercase). On hover, shifts to `#f3ca40` with an outer glow `0 0 14px rgba(212, 175, 55, 0.45)`. Active press reduces scale by `0.98`.
- **Secondary (Obsidian Slab):** Background `#221f1b`, 1px border `#38322a`, text `#d4af37`. Hover elevates background to `#2c2823` with border `#52493e`.
- **Destructive / Surrender:** Background transparent, border `#e63946` at 50% opacity, text `#e63946`.

### 2. The Board & Pathway Tiles
- **Board Perimeter:** 1.5px metallic brass border `#d4af37` bounding the `#1a1714` bed.
- **Track Cells:** Square cells styled in `#221f1b` with an inset perimeter stroke of `#38322a`.
- **Safe / Star Havens:** Star glyph debossed with antique brass fill `#d4af37`.
- **Home Triangles & Quadrants:** Finished in 15% opacity fills of the corresponding jewel tones (`#e63946`, `#2a9d8f`, `#e9c46a`, `#457b9d`) framed by 1px jewel borders.

### 3. Game Tokens (Pawns)
- **Geometry:** Multi-ringed 2D concentric vector tokens. Outer brass collar (`#d4af37`), inner core filled with the player's vibrant jewel tone.
- **Movable State:** Gentle vertical bob animation, pulsing an ambient glow of `rgba(212, 175, 55, 0.6)`. Hover cursor displays `pointer`.

### 4. Dice Tray & Interactive Die
- **Tray:** Circular or pill enclosure in `#1a1714`, lined with `#38322a` border and inset shadow.
- **Die Body:** Deep obsidian `#221f1b` with bevel edges `#52493e`, pips in inlaid metallic gold `#d4af37`. When rolling is available, the die features an oscillating outer aura of `rgba(212, 175, 55, 0.35)`.

### 5. Cards & Player HUD Pods
- **Turn Card:** `#221f1b` surface. Active player has an active border mapped to their jewel tone with a top accent bar (2px) and timer badge rendered in `JetBrains Mono`.
- **Status Chips:** Pill containers with background `rgba(18, 16, 14, 0.8)`, 1px border `#38322a`, displaying captured pawns, yards, and rank.

### 6. Input Fields & Selectors
- **Input Surface:** `#12100e` inset field with border `#38322a`, text in `#Inter` 14px, focus state transitioning border to `#d4af37` without outline offsets.