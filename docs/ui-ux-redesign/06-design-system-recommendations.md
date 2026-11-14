# Design System, Visual Language & Sensory Specifications

This document defines the complete visual identity, design tokens, typography hierarchy, elevation scales, motion curves, sound architecture, and tactile specifications for the LUDO 2D redesign. It adopts a **modern, dark-mode-first luxury board-game aesthetic** reminiscent of high-end physical tabletop games (warm charcoal finishes, lacquered accents, brushed gold hardware, and vivid jewel-toned player colors).

---

## 1. Visual Theme & Aesthetic Philosophy

- **Tactile Materiality**: The interface feels like a finely crafted wooden and lacquered tabletop game rather than flat software. Subtle radial gradients, soft bevels, and drop shadows evoke depth without the overhead and clunkiness of 3D polygon meshes.
- **Dark-Mode-First Harmony**: Deep, warm charcoal surfaces (`#161412` to `#262320`) minimize eye strain and make the four player colors vibrate with jewel-toned clarity.
- **Uncompromised Accessibility**: All text, interactive tokens, and badges maintain WCAG 2.1 AA/AAA contrast ratios against their respective backdrops. Player colors feature distinct secondary iconography (shields, stars, crowns) to ensure instant identification for colorblind users.

---

## 2. Complete Design Token Palette

```css
:root {
  /* ==========================================================================
     Surfaces & Backgrounds (Dark Mahogany & Warm Charcoal Elevation)
     ========================================================================== */
  --surface-canvas:      #12100e; /* Deep obsidian backdrop */
  --surface-board-bg:    #1a1714; /* Board container bed */
  --surface-card-base:   #221f1b; /* Level 1 card elevation */
  --surface-card-raised: #2c2823; /* Level 2 card / hover elevation */
  --surface-card-overlay:#36312a; /* Level 3 modal & dropdown elevation */
  --surface-border-subtle:#38322a; /* Dividers & quiet outlines */
  --surface-border-strong:#52493e; /* Active borders & slot outlines */

  /* ==========================================================================
     Four Player Jewel-Tone Colors (Enhanced for Dark Mode & Contrast)
     ========================================================================== */
  /* Seat 0: Red (Ruby Crimson) */
  --player-red:          #e63946;
  --player-red-hover:    #ff4d5a;
  --player-red-surface:  rgba(230, 57, 70, 0.15);
  --player-red-glow:     rgba(230, 57, 70, 0.45);

  /* Seat 1: Green (Emerald Jade) */
  --player-green:        #2a9d8f;
  --player-green-hover:  #38b6a6;
  --player-green-surface:rgba(42, 157, 143, 0.15);
  --player-green-glow:   rgba(42, 157, 143, 0.45);

  /* Seat 2: Yellow (Amber Topaz) */
  --player-yellow:       #e9c46a;
  --player-yellow-hover: #f4d07d;
  --player-yellow-surface:rgba(233, 196, 106, 0.15);
  --player-yellow-glow:  rgba(233, 196, 106, 0.45);

  /* Seat 3: Blue (Sapphire Cobalt) */
  --player-blue:         #457b9d;
  --player-blue-hover:   #5b93b7;
  --player-blue-surface: rgba(69, 123, 157, 0.15);
  --player-blue-glow:    rgba(69, 123, 157, 0.45);

  /* ==========================================================================
     Tabletop Accents & Material Hardware
     ========================================================================== */
  --accent-gold:         #d4af37; /* Antique Brushed Gold for safe cells & stars */
  --accent-gold-hover:   #f3ca40;
  --accent-gold-surface: rgba(212, 175, 55, 0.18);
  --accent-gold-glow:    rgba(212, 175, 55, 0.50);

  /* ==========================================================================
     Functional & Status Colors
     ========================================================================== */
  --status-success:      #48bb78;
  --status-warning:      #ed8936;
  --status-danger:       #f56565;
  --status-info:         #4299e1;

  /* ==========================================================================
     Typography & Text Hierarchy
     ========================================================================== */
  --text-primary:        #f7f4ed; /* Crisp warm bone white (100% opacity) */
  --text-secondary:      #c2baa9; /* Muted parchment (75% opacity) */
  --text-tertiary:       #8a8274; /* Dim helper captions (50% opacity) */
  --text-disabled:       #595349; /* Disabled labels */
}
```

---

## 3. Typography Scale & Hierarchy

- **Display & Heading Font**: `'Cabinet Grotesk'`, `'Cinzel'`, or `'Inter'` with heavy font weight (`700` / `800`) for high-impact game titles, victory announcements, and modal headers.
- **Interface & Body Font**: `'Inter'`, `system-ui`, `-apple-system`, `sans-serif` for clean legibility across all screen sizes.
- **Monospace Code Font**: `'JetBrains Mono'`, `'Fira Code'`, `'Courier New'` for room codes, dice values, turn numbers, and timers.

### Typography Matrix:

| Token Name | Font Size | Line Height | Weight | Letter Spacing | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `text-display-2xl` | `2.50rem` (40px) | `1.15` | `800` | `-0.03em` | Victory Title, Splash Hero |
| `text-display-xl` | `2.00rem` (32px) | `1.20` | `750` | `-0.02em` | Screen Headers, Standings |
| `text-heading-lg` | `1.50rem` (24px) | `1.25` | `700` | `-0.01em` | Modal Titles, Turn Banner |
| `text-heading-md` | `1.25rem` (20px) | `1.30` | `600` | `0` | Card Titles, Player Names |
| `text-body-base` | `1.00rem` (16px) | `1.50` | `400` | `0` | Standard Body Copy, Rules |
| `text-body-sm` | `0.875rem` (14px)| `1.40` | `500` | `+0.01em` | Tooltips, Status Badges |
| `text-caption-xs` | `0.75rem` (12px) | `1.30` | `600` | `+0.02em` | Token Subscripts, Timestamps |
| `text-code-room` | `1.75rem` (28px) | `1.10` | `700` | `+0.12em` | 6-Character Room Codes |

---

## 4. Spacing, Borders & Elevation System

### Spacing Scale (8pt Grid with 4pt Micro-steps):
- `space-1`: `4px`
- `space-2`: `8px`
- `space-3`: `12px`
- `space-4`: `16px`
- `space-6`: `24px`
- `space-8`: `32px`
- `space-12`: `48px`

### Border Radii System:
- **Sharp Details**: `4px` (Star points, dice pips).
- **Cells & Inputs**: `8px` (Board track cells, input fields).
- **Cards & Boards**: `16px` to `24px` (Player HUD cards, main Ludo board frame).
- **Pills & Badges**: `9999px` (Turn banners, room code badges, buttons).

### Elevation & Shadows:
```css
/* Tabletop Wood Bevel Shadow */
--shadow-board: 0 24px 64px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05);

/* Card Elevation Level 1 */
--shadow-card: 0 4px 16px rgba(0, 0, 0, 0.40);

/* Elevated Token Drop Shadow */
--shadow-token: 0 6px 14px rgba(0, 0, 0, 0.60);

/* Pulsing Legal Move Glow */
--glow-gold: 0 0 20px rgba(212, 175, 55, 0.65), 0 0 6px rgba(212, 175, 55, 0.90);
```

---

## 5. Animation, Motion Curves & Timings

### Core Motion Principles:
1. **Snappy & Purposeful**: Animations inform players of state transitions (who rolled, where the piece moved, who was captured); they never artificially drag out the game.
2. **Deterministic Durations**: Move durations are predictable so multiplayer sessions remain synchronized.
3. **Reduced Motion Respect**: Automatically switches to instant fade transitions when `prefers-reduced-motion: reduce` is detected.

### Specific Timing Specifications:

| Animation Event | Duration | Easing Curve | Visual Description |
| :--- | :--- | :--- | :--- |
| **Dice Roll Tumbling** | `550ms` | `cubic-bezier(0.25, 1, 0.5, 1)` | 3D-shaded face cycling with micro-bounce upon landing |
| **Token Track Hop** | `110ms / cell` | `ease-in-out` | Step-by-step parabolic jump along cell centers |
| **Opponent Capture** | `420ms` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Token pops, scales down, and flies back to home pocket |
| **Deploy from Base** | `300ms` | `ease-out` | Token floats smoothly from base socket to starting cell |
| **Turn Transition Banner**| `250ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Slide down and fade in with color transition |
| **Victory Confetti Burst**| `2500ms` | Gravity physics | Multi-colored confetti and laurel scale-in |

---

## 6. Sound Architecture & Audio Cues

Sound design uses organic, subtle wooden and ceramic acoustics rather than abrasive electronic beeps.

### Sound Event Mapping:
1. `sfx_dice_roll.mp3`: Subtle clatter of a wooden dice tumbling on a felt-lined tray (`duration: 500ms`).
2. `sfx_token_hop.mp3`: Gentle ceramic tap (`duration: 80ms`).
3. `sfx_token_deploy.mp3`: Resonant wooden click as token lands on start cell (`duration: 180ms`).
4. `sfx_capture.mp3`: Decisive, satisfying wooden strike followed by a soft rewind whistle (`duration: 400ms`).
5. `sfx_safe_landing.mp3`: Shimmering antique brass bell chime (`duration: 350ms`).
6. `sfx_your_turn.mp3`: Welcoming two-tone marimba chime notifying the player (`duration: 250ms`).
7. `sfx_victory.mp3`: Triumphant brass fanfare with applause ambient (`duration: 2200ms`).

### Audio Controls:
- Global mute toggle in top navigation.
- Remembers audio preference in `localStorage.getItem('ludo_sound_enabled')`.
- Volume normalized to `-12dB LUFS` to prevent startling headphone users.
