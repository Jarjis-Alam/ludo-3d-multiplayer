# Responsive & Cross-Platform UI/UX Specifications

This document defines the responsive layout architectures, viewport adaptations, SVG scaling formulas, touch ergonomical targets, and device interaction specifications for the LUDO 2D redesign across all modern form factors.

---

## 1. Breakpoint Architecture & Viewport Matrices

The application uses an adaptive fluid-grid system optimized for five distinct viewport tiers:

| Viewport Tier | Width Range | Target Devices | Primary Layout Strategy |
| :--- | :--- | :--- | :--- |
| **Mobile Portrait** | `360px – 480px` | iPhone SE, iPhone 13/14/15, Galaxy S22/S23, Pixel 7 | Single vertical stack; 100vw board; docked bottom HUD |
| **Mobile Landscape** | `481px – 849px` | Smart phones in landscape orientation | Horizontal split: Board on left, controls & HUD on right |
| **Tablet Portrait** | `768px – 1023px` | iPad Mini, iPad 10th Gen, Galaxy Tab A9 | Centered 640px board with 4 corner player docks |
| **Desktop / Laptop** | `1024px – 1439px` | MacBook Air, 13"–15" Laptops, 1080p Displays | 2-column layout: Center luxury board + right activity sidebar |
| **Ultra-Wide / 4K** | `1440px+` | 27"+ Monitors, 4K Displays, Pro Workstations | Constrained max-width board (840px), ambient glow, theater HUD |

---

## 2. 2D SVG Board Mathematical Scaling

The 2D Ludo board is rendered as a native SVG vector graphic with a square coordinate boundary:

$$\text{viewBox} = "0\ 0\ 1500\ 1500"$$

### Scaling Formula & Container Constraints:
```css
.ludo-board-container {
  width: 100%;
  max-width: min(calc(100vw - 32px), calc(100vh - 220px), 840px);
  aspect-ratio: 1 / 1;
  margin: 0 auto;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ludo-board-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  shape-rendering: geometricPrecision;
  touch-action: manipulation;
}
```

### Advantages of SVG 1500×1500 Coordinate Space:
- Each of the $15 \times 15$ grid cells measures exactly $100 \times 100\text{ SVG units}$.
- Corner bases measure exactly $600 \times 600\text{ SVG units}$ ($6 \text{ cells} \times 100$).
- Arms measure $300 \times 600\text{ SVG units}$ ($3 \text{ cells wide} \times 6 \text{ cells long}$).
- Center goal measures $300 \times 300\text{ SVG units}$.
- Token radii are set to $36\text{ SVG units}$ with an invisible touch/click hit area of radius $54\text{ SVG units}$.
- **Zero Loss of Quality**: Crisply renders at 360px on a budget phone or at 3840px on a 4K TV.
- **Zero Camera Glitches**: Completely eliminates 3D mesh clipping, camera perspective distortion, and gimbal locks.

---

## 3. Tier-Specific Layout Specifications

---

### Tier 1: Mobile Portrait (`360px – 480px`) — Primary Target

Mobile portrait represents over 65% of social board-game sessions. The entire interface must operate comfortably with one-handed thumb interaction.

```
┌──────────────────────────────────────┐
│  [Logo]   ROOM: AB3X9Z    [?] [🔊]   │  <- AppHeader (48px)
├──────────────────────────────────────┤
│  [Red: Alex (YOU)]   [Green: Jordan] │  <- Opponents / Top HUD (56px)
├──────────────────────────────────────┤
│  ▲ "YOUR TURN! Roll the dice."       │  <- Floating Turn Banner (36px)
├──────────────────────────────────────┤
│                                      │
│                                      │
│          2D TOP-DOWN BOARD           │  <- Full Width Square Board
│          (100vw - 24px)              │     Aspect Ratio 1:1
│                                      │
│                                      │
├──────────────────────────────────────┤
│  [Yellow: Taylor]    [Blue: Sam]     │  <- Bottom Players HUD (56px)
├──────────────────────────────────────┤
│      ┌────────────────────────┐      │
│      │   [ ⚅ ]  TAP TO ROLL   │      │  <- Thumb-Zone Dice Action Dock
│      └────────────────────────┘      │     (Fixed Bottom 72px)
└──────────────────────────────────────┘
```

#### Layout Rules:
1. **Vertical Constraint**: The header, top HUD, board, bottom HUD, and dice dock must fit completely within `100dvh` (Dynamic Viewport Height) without vertical body scrolling.
2. **Top / Bottom Split HUD**:
   - Top Bar: Displays Seats 0 (Red) and 1 (Green).
   - Bottom Bar: Displays Seats 3 (Blue) and 2 (Yellow).
   - This mirrors the physical board quadrant positions: Red (top-left), Green (top-right), Blue (bottom-left), Yellow (bottom-right).
3. **Bottom Thumb Zone (Dice Roller)**:
   - Positioned in the bottom 80px thumb-reach zone.
   - Large tactile button (`72px` height) with 3D-styled dice pip icon and high-contrast label.
4. **Mobile Token Picker Drawer**:
   - On screens $< 480\text{px}$, tapping a tiny token on the board can lead to accidental touches.
   - When a dice roll offers $\ge 2$ valid moves, a modal sheet slides up from the bottom:
     - Clear visual cards: *"Token 1: Deploy from base"* vs *"Token 2: Move to cell 24"*.
     - Single tap executes the move with zero precision stress.

---

### Tier 2: Mobile Landscape (`481px – 849px`)

When a user rotates their phone horizontally, vertical space shrinks to 360px–420px while horizontal space expands.

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Logo] LUDO                                         ROOM: AB3X9Z   [X] │
├────────────────────────────────────┬───────────────────────────────────┤
│                                    │  ▲ "YOUR TURN! Roll the dice."    │
│                                    ├───────────────────────────────────┤
│                                    │  [Red: Alex]       [Green: Jordan]│
│         2D TOP-DOWN BOARD          │  [Yellow: Taylor]  [Blue: Sam]    │
│         (Max height 100vh - 60px)  ├───────────────────────────────────┤
│         Aspect Ratio 1:1           │  ┌─────────────────────────────┐  │
│                                    │  │      [ ⚄ ] ROLL DICE        │  │
│                                    │  └─────────────────────────────┘  │
│                                    ├───────────────────────────────────┤
│                                    │  [Action Log / Mini Feed]         │
└────────────────────────────────────┴───────────────────────────────────┘
```

#### Layout Rules:
1. **2-Column Horizontal Split**:
   - Left Column (60% width): Holds the square 2D board, constrained by `height: calc(100vh - 64px)`.
   - Right Column (40% width): Vertical control column holding Turn Banner, 4-Player Roster, Dice Roller, and Mini Action Feed.
2. **Eliminate All Scrolling**: Both columns remain fixed; content auto-scales to viewport height.

---

### Tier 3: Tablet Portrait (`768px – 1023px`)

Tablets provide generous real estate. The board takes center stage, surrounded symmetrically by player cards.

```
┌────────────────────────────────────────────────────────────────────────┐
│  [Logo] LUDO                   ROOM: AB3X9Z                 [?] [🔊]   │
├────────────────────────────────────────────────────────────────────────┤
│                     "YOUR TURN! Roll the dice."                        │
├───────────────────┬────────────────────────────────┬───────────────────┤
│  [Red: Alex]      │                                │  [Green: Jordan]  │
│  4 Tokens Active  │       2D TOP-DOWN BOARD        │  2 Tokens Active  │
│  Lead: 2 in Goal  │       (600px × 600px)          │  Lead: 0 in Goal  │
├───────────────────┤                                ├───────────────────┤
│  [Blue: Sam]      │                                │  [Yellow: Taylor] │
│  3 Tokens Active  │                                │  1 Token Active   │
├───────────────────┴────────────────────────────────┴───────────────────┤
│               ┌────────────────────────────────────────┐               │
│               │             [ ⚂ ] ROLL DICE            │               │
│               └────────────────────────────────────────┘               │
└────────────────────────────────────────────────────────────────────────┘
```

#### Layout Rules:
- Board is centered at `600px × 600px`.
- Player HUD cards sit at the 4 corresponding corners of the board, matching their quadrant positions.
- Generous padding, high-contrast typography, and full action feed available in collapsible side drawer.

---

### Tier 4 & 5: Desktop & Ultra-Wide (`1024px – 1440px+`)

A desktop setup offers a gaming experience comparable to high-end digital board games like Chess.com or Board Game Arena.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  [Logo] LUDO                ROOM CODE: AB3X9Z  [Copy Link]                  [?] [⚙] [🔊]│
├─────────────────────────────────────────────────────────┬───────────────────────────────┤
│                                                         │  MATCH DASHBOARD              │
│                     TURN BANNER                         │  Status: Playing (Turn 18)    │
│             "Alex's Turn: Select Token to Move"         │                               │
│                                                         ├───────────────────────────────┤
│   ┌─────────────────────────────────────────────────┐   │  PLAYER ROSTER                │
│   │                                                 │   │  • Alex (Red) - YOU [Host]    │
│   │                                                 │   │  • Jordan (Green) - Connected │
│   │                                                 │   │  • Taylor (Yellow) - Connected│
│   │                2D TOP-DOWN BOARD                │   │  • Sam (Blue) - Connected     │
│   │                (750px × 750px)                  │   ├───────────────────────────────┤
│   │                                                 │   │  DICE CONTROLS                │
│   │                                                 │   │  ┌─────────────────────────┐  │
│   │                                                 │   │  │    [ ⚅ ] ROLL DICE      │  │
│   │                                                 │   │  └─────────────────────────┘  │
│   └─────────────────────────────────────────────────┘   ├───────────────────────────────┤
│                                                         │  LIVE ACTIVITY LOG            │
│   Player HUD Corner Overlays:                           │  • Jordan rolled 4            │
│   [Red: Alex]                     [Green: Jordan]       │  • Alex captured Taylor's P2! │
│   [Blue: Sam]                     [Yellow: Taylor]      │  • Sam entered Home Stretch   │
└─────────────────────────────────────────────────────────┴───────────────────────────────┘
```

#### Layout Rules:
1. **Asymmetric 2-Column Desktop Grid**:
   - Main Stage (70% width): Features the grand 2D board with soft wooden bevel frame, corner player badges, and ambient drop-shadow.
   - Right Control Sidebar (30% width, min 320px, max 420px): Holds persistent room information, player standings, active dice roller widget, and real-time live activity log.
2. **Ultra-Wide (> 1440px)**:
   - Board size capped at `840px × 840px` to prevent tokens from stretching beyond optical comfort.
   - Background fills with ambient dark wood texture and vignette.

---

## 4. Touch Targets & Ergonomic Specifications

### Touch Target Guidelines (WCAG 2.1 AAA Compliant):
1. **Minimum Touch Size**: Every tappable button, token, and dice trigger must have an effective hit area of at least **$48 \times 48\text{px}$** (exceeding Apple's 44px and Android's 48dp standards).
2. **Token Hit Target Expansion**:
   - In SVG, the visual token disc is $72\text{ units}$ wide, but an invisible `<circle>` overlay with `r="54"` ($108\text{ units}$ diameter) captures touch events:
     ```svg
     <circle cx="750" cy="750" r="36" fill="url(#tokenGradientRed)" filter="url(#dropShadow)" />
     <!-- Invisible touch target -->
     <circle cx="750" cy="750" r="54" fill="transparent" style="cursor: pointer;" />
     ```
3. **Spacing Between Targets**: A minimum of $8\text{px}$ dead space separates adjacent interactive elements to prevent mis-clicks.

---

## 5. Pointer, Touch & Haptic Specifications

### Interaction Matrix:

| Interaction Event | Desktop Pointer | Mobile Touch | Tablet Stylus / Touch |
| :--- | :--- | :--- | :--- |
| **Dice Roll** | Hover: scale(1.05) + cursor pointer; Click to roll | Tap with instant CSS `:active` ripple | Tap with highlight |
| **Token Move Preview** | Hover over token highlights destination cell with dotted gold outline | Tap once to preview destination; tap again or use picker sheet | Tap preview; instant selection |
| **Pinch-to-Zoom** | Disabled (Board fits viewport natively) | Disabled (`touch-action: manipulation`) to prevent double-tap zoom delay | Disabled |
| **Tooltips** | Hover reveals helper tooltip | Long-press or tap icon | Tap icon |

### Haptic Feedback Implementation (Mobile Web Vibration API):
```javascript
// Tactical haptic vibrations for native tactile feel
export const triggerHaptic = (type) => {
  if (!('vibrate' in navigator)) return;
  switch (type) {
    case 'dice_roll':
      navigator.vibrate([15, 30, 20]); // Tumbling vibration
      break;
    case 'token_move':
      navigator.vibrate(25); // Subtle tap
      break;
    case 'capture':
      navigator.vibrate([50, 40, 100]); // Heavy impact buzz
      break;
    case 'victory':
      navigator.vibrate([100, 50, 100, 50, 250]); // Celebratory fanfare rhythm
      break;
  }
};
```
