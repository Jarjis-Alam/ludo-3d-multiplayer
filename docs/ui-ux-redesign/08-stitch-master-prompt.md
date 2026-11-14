# Google Stitch AI Master Redesign Prompt: 2D Multiplayer Ludo

> **HOW TO USE THIS DOCUMENT**:
> Copy and paste the entire prompt below directly into Google Stitch AI (or any advanced visual design agent) to generate the complete, production-ready UI/UX design, visual screens, component layouts, and design tokens for the LUDO application.
>
> **CRITICAL ARCHITECTURAL DIRECTIVE**:
> This design completely eliminates 3D viewports, Three.js canvases, perspective distortion, and orbital cameras. The board is rendered strictly as a **crisp, top-down 2D vector board (15×15 grid SVG)**, styled in a **dark-mode-first luxury tabletop board game aesthetic**.

---

```markdown
# STITCH AI DESIGN BRIEF: REAL-TIME MULTIPLAYER LUDO (2D REDESIGN)

You are the Lead Visual & Experience Designer tasked with designing a world-class, responsive, real-time multiplayer 2D Ludo web application named **LUDO**.

## 1. PRODUCT CONTEXT & VALUE PROPOSITION
- **Product**: Engine-first, server-authoritative, real-time multiplayer Ludo web application.
- **Audience**: Casual social players, friends, families, and tournament board-game enthusiasts across desktop, tablet, and mobile browsers.
- **Key Value**: Instant play with zero downloads or account creation. A host creates a room in one tap, shares a 6-character code or link, and 2 to 4 players compete under international tournament rules with live WebSocket synchronization.
- **Dynamic 2–4 Player Scalability**: Matches seamlessly adapt to 2, 3, or 4 players without requiring artificial bots. Unoccupied seats are automatically skipped during turn rotations.

---

## 2. CORE VISUAL THEME & DESIGN SYSTEM

### A. Aesthetic Philosophy: "Modern Luxury Tabletop"
- The interface evokes the tactile beauty of a custom wooden, lacquer, and brass board game set upon a dark charcoal felt table.
- Dark-mode-first palette eliminates glare, extends battery life on mobile OLED screens, and creates high visual contrast for the 4 jewel-toned player colors.
- Subtle drop shadows, soft radial gradients, and satin bevels create tactile materiality without 3D camera overhead.

### B. Color Tokens (HEX & Semantic Usage)
- **Background Canvas**: `#12100e` (Deep obsidian charcoal)
- **Board Container Bed**: `#1a1714` (Dark mahogany wood finish)
- **Surface Elevation 1 (Cards & Slots)**: `#221f1b` with border `#38322a`
- **Surface Elevation 2 (Raised Panels & Modals)**: `#2c2823` with border `#52493e`
- **Antique Gold Hardware (Safe Stars & Accents)**:
  - Base: `#d4af37`
  - Hover: `#f3ca40`
  - Glow: `rgba(212, 175, 55, 0.45)`
- **Four Player Jewel-Tone Colors (Accessible & Vibrant)**:
  - **Seat 0 (Red / Ruby)**: `#e63946` | Surface: `rgba(230, 57, 70, 0.15)` | Glow: `rgba(230, 57, 70, 0.5)`
  - **Seat 1 (Green / Emerald)**: `#2a9d8f` | Surface: `rgba(42, 157, 143, 0.15)` | Glow: `rgba(42, 157, 143, 0.5)`
  - **Seat 2 (Yellow / Amber Topaz)**: `#e9c46a` | Surface: `rgba(233, 196, 106, 0.15)` | Glow: `rgba(233, 196, 106, 0.5)`
  - **Seat 3 (Blue / Cobalt Sapphire)**: `#457b9d` | Surface: `rgba(69, 123, 157, 0.15)` | Glow: `rgba(69, 123, 157, 0.5)`
- **Functional Status Colors**:
  - Success / Connected: `#48bb78`
  - Warning / Reconnecting: `#ed8936`
  - Error / Forfeit: `#f56565`
- **Typography Colors**:
  - Primary Text: `#f7f4ed` (Warm bone white, 100%)
  - Secondary Text: `#c2baa9` (Muted parchment, 75%)
  - Tertiary / Helper: `#8a8274` (Subtle caption, 50%)

### C. Typography Scale
- **Display Headings**: `'Cabinet Grotesk'` or `'Cinzel'` or `'Inter'` Bold (Weights: 700, 800)
- **Body & Controls**: `'Inter'`, `system-ui`, sans-serif (Weights: 400, 500, 600)
- **Monospace Room Codes & Clocks**: `'JetBrains Mono'`, `'Fira Code'` (Weight: 700)

---

## 3. 2D BOARD GEOMETRY & EXACT COORDINATE SPECIFICATIONS

The central game board is rendered strictly as a 2D top-down SVG with coordinate system `viewBox="0 0 1500 1500"`:
- **Total Dimensions**: 15×15 uniform grid cells. Each grid cell is exactly $100 \times 100\text{ units}$.
- **4 Corner Bases (6×6 cells each, 600×600 units)**:
  - **Top-Left (0, 0) to (600, 600)**: Red Quadrant. 4 circular pockets with radial gradient tokens.
  - **Top-Right (900, 0) to (1500, 600)**: Green Quadrant. 4 circular pockets.
  - **Bottom-Right (900, 900) to (1500, 1500)**: Yellow Quadrant. 4 circular pockets.
  - **Bottom-Left (0, 900) to (600, 1500)**: Blue Quadrant. 4 circular pockets.
- **4 Arms (3×6 cells each, 300×600 units)**:
  - **Top Arm**: X: 600..900, Y: 0..600 (3 columns: outer track, green home lane, outer track).
  - **Right Arm**: X: 900..1500, Y: 600..900 (3 rows: outer track, yellow home lane, outer track).
  - **Bottom Arm**: X: 600..900, Y: 900..1500 (3 columns: outer track, blue home lane, outer track).
  - **Left Arm**: X: 0..600, Y: 600..900 (3 rows: outer track, red home lane, outer track).
- **The 52-Cell Shared Perimeter Track**:
  - Cell size: $100 \times 100\text{ units}$ with `rx="8"`.
  - Neutral cell fill: `#262320` with subtle border `#3a352e`.
- **4 Starting Cells (Color-coded with exit arrows)**:
  - Red Start: Cell 0 at `(100, 600)`.
  - Green Start: Cell 13 at `(800, 100)`.
  - Yellow Start: Cell 26 at `(1300, 800)`.
  - Blue Start: Cell 39 at `(600, 1300)`.
- **8 Safe Cells (Immune to captures)**:
  - 4 Start Cells (0, 13, 26, 39) + 4 Track Resting Stars at Cells 8, 21, 34, 47.
  - Decorated with an embossed 8-pointed antique gold star icon (`#d4af37`).
- **4 Home Lanes (5 protected colored cells each)**:
  - Red Lane: Cells at Y: 700, X: 100..500.
  - Green Lane: Cells at X: 700, Y: 100..500.
  - Yellow Lane: Cells at Y: 700, X: 900..1300.
  - Blue Lane: Cells at X: 700, Y: 900..1300.
- **Center Victory Goal (3×3 cells, 300×300 units)**:
  - Positioned from `(600, 600)` to `(900, 900)`.
  - Divided diagonally into 4 colored victory triangles converging at `(750, 750)`.
  - Center golden laurel wreath emblem. Finished tokens sit proudly inside their respective triangle with gold crowns.

---

## 4. DETAILED SCREEN INVENTORY TO DESIGN

### SCREEN 1: LANDING & MATCHMAKING PAGE (`snapshot === null`)
1. **Header**:
   - Left: Stylized "LUDO" logo in gold with miniature dice emblem.
   - Right: How-to-Play `(?)` button, Sound toggle `(🔊)`, and version badge (`v0.2.0`).
2. **Hero Column**:
   - Headline: *"Real-Time Multiplayer Ludo"*.
   - Subtitle: *"No downloads. No registration. Fast 2 to 4 player matches with instant room links."*
   - Matchmaking Card with Segmented Tabs:
     - **Tab A: "Create Room"**:
       - Input: "Enter your display name" (with character counter).
       - CTA Button: *"Create Private Room"* (with golden glow hover).
     - **Tab B: "Join Room"**:
       - Input: "Enter your display name".
       - Input: "6-Character Room Code" (monospaced format `LUD-###` with quick Paste button).
       - CTA Button: *"Join Game Room"*.
3. **Interactive 2D Board Preview Column**:
   - An elegant 2D mini-board running a gentle looping animation showing tokens hopping, a friendly capture, and a token entering the home stretch.
4. **Session Recovery Banner (Conditional)**:
   - Floating banner: *"Ongoing game detected: Room NW84K2. [Rejoin Now] [Dismiss]"*.

---

### SCREEN 2: WAITING ROOM / PRIVATE LOBBY (`status === 'lobby'`)
1. **Lobby Header Card**:
   - High-contrast room code badge: `ROOM: NW84K2` with a 1-tap "Copy Code" button.
   - Prominent CTA: **"Copy Invite Link"** (copies `https://ludo.example.com/?room=NW84K2`).
   - Capacity Gauge: `2/4 Players Connected` (green pill badge).
2. **Player Roster (4 Quadrant Slots)**:
   - Arranged in a 2×2 grid (desktop) or vertical stack (mobile) matching quadrant colors:
     - **Seat 0: Red** (Alex - YOU [Host Crown]) -> "Connected & Ready" (green dot).
     - **Seat 1: Green** (Jordan) -> "Connected & Ready".
     - **Seat 2: Yellow** -> Empty Slot (dashed border, *"Waiting for player... Will be skipped if match starts with 2 players"*).
     - **Seat 3: Blue** -> Empty Slot (dashed border).
3. **Action Footer / Start Game Control**:
   - **Host View**:
     - 0–1 Players: Disabled button: *"Waiting for at least 1 more player... (Minimum 2 players required)"*.
     - 2–4 Players: Vibrant green/gold gradient CTA: **"Start Game (2 Players)"** (or 3/4 Players).
   - **Guest View**:
     - Disabled status card with animated wave dots: *"Ready! Waiting for Host (Alex) to start match..."*.
   - Leave Room button with confirmation safeguard.

---

### SCREEN 3: ACTIVE MULTIPLAYER MATCH (`status === 'playing'`)
1. **Top Turn Announcement Banner**:
   - Floating pill banner centered above the board:
     - When your turn to roll: *"YOUR TURN! Roll the dice."* (pulsing gold ring).
     - When your turn to move: *"Select a token to move."* (vivid emerald).
     - Opponent's turn: *"Waiting for Jordan (Green) to roll..."* (subtle slate).
     - Extra roll event: *"Rolled a 6! You get an extra roll!"* (celebratory shimmer).
     - Triple-six penalty: *"Three consecutive 6s! Turn forfeited."* (warning red).
     - No moves event: *"No legal moves for roll of [N]. Passing turn..."* (1.2s pause).
2. **The 2D Vector Board (Center Stage)**:
   - 1500×1500 SVG board in a responsive square container (`max-width: 840px`).
   - Tokens with distinct states:
     - **Idle in Base**: Sits in circular socket.
     - **Deployable (on roll of 6)**: Pulses with golden halo ring and upward bounce.
     - **Active on Track**: Renders with drop-shadow; destination cell lights up with preview dots on hover/tap.
     - **In Safe Cell**: Small antique gold shield badge overlays token base.
     - **Finished in Goal**: Sits in center triangle with golden crown badge.
3. **Four Player HUD Status Cards**:
   - Positioned at the 4 corners of the board (desktop) or split top/bottom (mobile):
     - Player name, seat color swatch, host badge, connection status.
     - Visual progress bar: `Tokens Home: 2/4`.
     - Active player card border illuminates with a flowing jewel-toned gradient border.
4. **Dedicated Dice Action Dock**:
   - **CRITICAL**: The dice roller is **NOT** on the board playing surface.
   - Fixed at bottom-center (mobile thumb zone) or right dashboard (desktop).
   - Features a large 2D-shaded tactile dice widget with clear pips (1–6) and a large **"ROLL DICE"** button.
   - Tumbling animation (550ms) with realistic wooden dice acoustics.
5. **Mobile Token Picker Bottom Sheet**:
   - If a dice roll provides $\ge 2$ valid token moves on screens $< 480\text{px}$, a drawer slides up:
     - *"Choose Token to Move"*: Card 1 (*"Deploy Token 1 onto Start Cell"*), Card 2 (*"Advance Token 2 to Cell 19"*).
     - Eliminates small touch mis-taps entirely.
6. **Live Match Activity Drawer**:
   - Collapsible live feed: *"Alex rolled a 6"*, *"Alex deployed Token 1"*, *"Jordan captured Alex's Token 2 at Cell 24!"*.

---

### SCREEN 4: VICTORY, STANDINGS & REMATCH (`status === 'finished'`)
1. **Victory Modal & Celebration**:
   - Full-screen celebratory overlay with gold and jewel-colored confetti.
   - Large golden trophy illustration with winner's name: *"VICTORY! ALEX WINS!"*.
   - Standings Podium:
     - 🥇 1st Place: Alex (Red) — 4 tokens home.
     - 🥈 2nd Place: Jordan (Green) — 2 tokens home.
2. **Match Statistics Card**:
   - Match Duration (e.g., `12m 44s`), Total Captures (`7`), Sixes Rolled (`14`), Total Turns (`38`).
3. **Rematch Action Flow**:
   - Host CTA: **"Request Rematch"** (keeps players in room and resets board).
   - Guest CTA: **"Accept Rematch"**.
   - Secondary Button: "Return to Lobby" or "Exit to Main Menu".

---

### SCREEN 5: SYSTEM MODALS & NOTIFICATION OVERLAYS
1. **Connection Alert Sticky Banner**:
   - Amber alert at top: *"Connection lost. Reconnecting to match... Attempt 2/5 [Retry]"*.
2. **Tournament Rules Modal**:
   - Visual cards explaining: Deployment on 6, Safe star cells, Capturing mechanics, Home run exact rolls, and 2–4 player dynamic seat skipping.
3. **System Toast Notifications**:
   - Floating micro-toasts: *"Invite link copied!"*, *"Not your turn"*, *"Illegal move: overshoots goal"*.

---

## 5. RESPONSIVE LAYOUT SPECIFICATIONS

- **Mobile Portrait (360px – 480px, Primary Focus)**:
  - Header: Fixed 48px.
  - Top HUD: Seats 0 (Red) and 1 (Green) docked in a slim 52px bar.
  - 2D Board: Square aspect ratio `calc(100vw - 24px)`.
  - Bottom HUD: Seats 3 (Blue) and 2 (Yellow) docked in a 52px bar.
  - Bottom Action Dock: Large thumb-friendly Dice Roller (`72px` height) with haptic feedback.
  - Zero page scrolling required during active gameplay.
- **Tablet (768px – 1023px)**:
  - Centered 600px board surrounded by 4 dedicated corner player cards.
- **Desktop (1024px – 1440px+)**:
  - Asymmetric 2-column layout: Center luxury board stage (750px) + Right control sidebar with live activity feed, room info, and dice controls.

---

## 6. DELIVERABLE REQUIREMENTS FOR STITCH AI

Please generate the complete visual screens, responsive layouts, SVG component definitions, and CSS token architecture for all 5 screens detailed above. Ensure the design is **100% 2D top-down**, elegant, accessible, tactile, and ready for frontend implementation in React 18, SVG, and CSS variables.
```
