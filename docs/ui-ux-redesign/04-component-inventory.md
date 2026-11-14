# Comprehensive Component Inventory & Design Catalog

This catalog documents every interface component, interactive control, SVG element, HUD widget, and system overlay required for the LUDO application. It serves as the primary implementation blueprint for Google's Stitch AI to generate complete, production-ready React components and design tokens.

---

## 1. Global Navigation & Application Frame

### COMP-NAV-01: Global App Header (`AppHeader`)
- **Purpose**: Provides persistent branding, current room context, network health indicator, and utility actions.
- **Visual Presentation**: Fixed top bar with frosted glass backdrop (`backdrop-filter: blur(12px)`), dark charcoal surface (`#1c1a17`), and bottom border (`#3a3630`).
- **Data Required**: `roomCode: string | null`, `connectionStatus: 'connected' | 'reconnecting' | 'disconnected'`, `soundEnabled: boolean`.
- **Children**:
  - `BrandLogo`: Stylized serif logotype "LUDO" with miniature gold dice accent.
  - `RoomBadge`: (Visible when in room) Displays monospaced room code with instant copy action.
  - `NetworkPill`: Micro-indicator showing live WebSocket status (Green: Connected, Amber: Retrying, Red: Offline).
  - `RulesTriggerButton`: Opens the how-to-play rules modal.
  - `AudioToggleButton`: Mutes / unmutes sound effects.
- **Lifecycle**: Mounts on application launch and persists across all views.

---

## 2. Landing & Matchmaking Components (Screen A)

### COMP-LAND-01: Hero Headline & Value Banner (`LandingHero`)
- **Purpose**: Instantly establishes product identity and zero-friction multiplayer value proposition.
- **Visual Presentation**: Bold typography, gradient text accent, and bulleted features ("No install · Instant link share · 2 to 4 players").
- **State Variations**: Default, compact layout on mobile screens (< 640px).

### COMP-LAND-02: Matchmaking Action Card (`MatchmakingCard`)
- **Purpose**: Encapsulates room creation and room joining flows with clear tabbed navigation.
- **Visual Presentation**: Elevated card with subtle golden border glow, containing:
  - Segmented tab switch: **"Create Room"** vs. **"Join Room"**.
  - `PlayerNameInput`: Input with validation, auto-focus, and character counter.
  - `RoomCodeInput`: 6-character formatted input with auto-capitalization and paste button.
  - Primary Submit CTA button with loading spinner state.
- **Interaction**:
  - Tapping "Create" switches to room creation mode.
  - Tapping "Join" activates room code entry with deep-link pre-fill support.

### COMP-LAND-03: Animated 2D Board Preview (`LandingBoardPreview`)
- **Purpose**: Replaces the legacy spinning 3D canvas with an elegant, responsive 2D SVG board animation demonstrating game action.
- **Visual Presentation**: Top-down 15×15 mini-board with automated looping micro-animations:
  - Token jumping along the track.
  - A friendly capture scenario where an opponent token returns to base.
  - Soft ambient lighting and subtle drop shadows.
- **Lifecycle**: Only rendered on Screen A (`snapshot === null`). Unmounts upon entering a room to conserve CPU/GPU cycles.

### COMP-LAND-04: Session Recovery Banner (`SessionRecoveryBanner`)
- **Purpose**: Detects an ongoing match in browser storage and offers instant 1-tap re-entry.
- **Visual Presentation**: Amber floating notification banner: *"You have an active match in Room [CODE] as [Name]."*
- **Interaction**: "Rejoin Game" (triggers `rejoin_room`) or "Dismiss" (clears local cache).

---

## 3. Waiting Room & Private Lobby Components (Screen B)

### COMP-LOBBY-01: Lobby Room Header (`LobbyHeader`)
- **Purpose**: Displays the room identity, copyable invitation link, and live player count.
- **Visual Presentation**: High-contrast card with large 6-character room code, "Copy Code" button, and prominent "Copy Invite Link" CTA.
- **Data Required**: `roomCode: string`, `playerCount: number`, `maxPlayers: 4`.
- **Interaction**: Clicking "Copy Invite Link" invokes `navigator.clipboard.writeText` and triggers a success toast.

### COMP-LOBBY-02: Player Roster Grid (`LobbyRosterGrid`)
- **Purpose**: Displays the 4 tournament seats (Red, Green, Yellow, Blue) and their current assignment status.
- **Layout**: 2×2 responsive grid on desktop, single-column stacked list on mobile.
- **Children**: 4 instances of `LobbySeatCard`.

### COMP-LOBBY-03: Seat Slot Card (`LobbySeatCard`)
- **Purpose**: Represents an individual player seat (Seats 0 to 3).
- **Visual Presentation & States**:
  - **Occupied (Self)**: Highlighted border, "YOU" badge, avatar with seat color, display name, Host crown (if applicable), and green "Connected & Ready" pill.
  - **Occupied (Opponent)**: Avatar, display name, Host crown (if applicable), connection status indicator.
  - **Empty Slot**: Dashed border with subtle seat color tint, animated pulse icon, label: *"Waiting for player..."*, subtext: *"Will be skipped if match starts with 2 or 3 players"*.
  - **Disconnected Slot**: Amber warning outline, *"Reconnecting..."* status with 60s countdown timer.
- **Data Required**: `seatIndex: number`, `player: RoomPlayer | null`, `isSelf: boolean`, `isHost: boolean`.

### COMP-LOBBY-04: Host Start Game Bar (`LobbyHostControls`)
- **Purpose**: Dedicated control panel for the room host to launch the game when valid player thresholds are met.
- **Visual Presentation & States**:
  - **Disabled (< 2 Players)**: Grayed button with padlock icon and helper tooltip: *"Waiting for at least 1 more player... (Requires 2–4 players)"*.
  - **Enabled (2–4 Players)**: Vivid gradient button (golden yellow to emerald green) with pulsing border: *"Start Game (2 Players)"* or *"Start Game (N Players)"*.
  - **Loading**: Spinner with label *"Starting match..."*.
- **Data Required**: `isHost: boolean`, `playerCount: number`, `onStart: () => void`.

### COMP-LOBBY-05: Guest Waiting Indicator (`LobbyGuestIndicator`)
- **Purpose**: Informs non-host players that they are ready and awaiting the host's action.
- **Visual Presentation**: Subtle card with animated wave loader and message: *"You are all set! Waiting for Host ([Host Name]) to start the match..."*.

---

## 4. 2D Top-Down Vector Board Components (Screen C)

### COMP-BOARD-01: 2D Board Master Canvas (`LudoBoard2D`)
- **Purpose**: The core game arena rendering the complete 15×15 Ludo board using responsive, hardware-accelerated SVG.
- **Coordinate Space**: Exact `viewBox="0 0 1500 1500"` with `preserveAspectRatio="xMidYMid meet"`.
- **Styling**: Rounded outer container (`border-radius: 24px`), deep charcoal mahogany finish (`#1e1b18`), subtle wooden inlay border, and rich drop shadow (`0 20px 50px rgba(0,0,0,0.6)`).
- **Sub-Layers**:
  1. `<rect>` Master background and outer bevel.
  2. `<g id="bases">`: 4 Corner Home Bases.
  3. `<g id="tracks">`: 52 Perimeter Outer Track Cells.
  4. `<g id="safe-stars">`: 8 Safe Cell Star Badges.
  5. `<g id="home-lanes">`: 4 Colored Home Run Paths.
  6. `<g id="center-goal">`: 4 Center Victory Triangles.
  7. `<g id="tokens">`: 16 Game Tokens with live positions and animations.

### COMP-BOARD-02: Corner Base Quadrant (`BoardBase`)
- **Purpose**: Houses the 4 token pockets for an individual player color before deployment.
- **Geometry**: 6×6 grid unit square (600×600 SVG units) positioned at:
  - Red: `(0, 0)`
  - Green: `(900, 0)`
  - Yellow: `(900, 900)`
  - Blue: `(0, 900)`
- **Visual Presentation**:
  - Solid quadrant background with inner rounded white/neutral container.
  - 4 circular recessed token pockets (`<circle>` with inset shadow).
  - Quadrant heraldic emblem or subtle color watermark.
  - Dimmed opacity (30%) if seat is unoccupied in a 2-player or 3-player match.

### COMP-BOARD-03: Track Cell (`BoardCell`)
- **Purpose**: Individual cell on the 52-cell shared perimeter or 6-cell home lane.
- **Geometry**: 100×100 SVG units per cell.
- **Visual Presentation & States**:
  - **Standard Cell**: Crisp neutral cell (`#2a2723`) with soft rounded corners (`rx="8"`).
  - **Quadrant Start Cell**: Colored background matching seat color (Red: Cell 0, Green: Cell 13, Yellow: Cell 26, Blue: Cell 39) with directional exit arrow.
  - **Safe Star Cell**: Cells 8, 21, 34, 47 feature an embossed 8-pointed antique gold star icon (`#f4c542`).
  - **Target Move Highlight**: When active player has a legal move landing on this cell, it displays an animated pulsing dashed golden border with preview marker.

### COMP-BOARD-04: Center Victory Goal (`BoardGoal`)
- **Purpose**: The final destination for all 4 player home runs.
- **Geometry**: 3×3 grid unit square (300×300 SVG units) from `(600, 600)` to `(900, 900)`.
- **Visual Presentation**:
  - Divided into 4 equal triangles meeting at the center point `(750, 750)`.
  - Red triangle (Left), Green triangle (Top), Yellow triangle (Right), Blue triangle (Bottom).
  - Golden laurel wreath or crown icon in the center vertex.
  - Completed tokens sit inside their respective color triangle with victory badges.

### COMP-BOARD-05: Game Token (`BoardToken`)
- **Purpose**: Represents an individual playing piece on the board (4 per player, 16 total).
- **Visual Presentation**:
  - Rich 2D illustrated pawn/disc with radial gradient, glossy highlight cap, and dynamic drop shadow.
  - Distinct player colors:
    - Red: `#e74c3c` (Crimson)
    - Green: `#2ecc71` (Emerald)
    - Yellow: `#f1c40f` (Amber Gold)
    - Blue: `#3498db` (Cobalt)
- **Interactive States & Behaviors**:
  - **Idle**: Sits cleanly on cell with subtle drop shadow.
  - **Selectable / Legal Move**:
    - Animated pulsing golden glow ring (`filter="url(#glow)"`).
    - Bouncing hover animation.
    - Cursor changes to `pointer`.
    - Clicking emits `move_token({ tokenId })`.
  - **In Safe Cell**: Small golden shield badge overlays token base.
  - **Stacked (Multiple tokens on same cell)**: Renders in a compact cluster with numeric count badge (e.g., "×2").
  - **Capture Animation**: Smooth 400ms parabolic fly-back to home base with pop particle effect.
  - **Move Animation**: Step-by-step hopping along SVG track coordinates (120ms per cell).

---

## 5. In-Game HUD & Game Controls (Screen C)

### COMP-HUD-01: Turn Status Banner (`TurnBanner`)
- **Purpose**: Unmissable announcement of whose turn it is, action required, and special rule events.
- **Visual Presentation**: Top-centered floating pill with smooth color transitions:
  - **Your Turn to Roll**: *"Your Turn! Roll the dice."* (Pulsing gold glow).
  - **Your Turn to Move**: *"Select a token to move."* (Vivid green).
  - **Opponent's Turn**: *"Waiting for [Player Name] to roll..."* (Subtle slate).
  - **Bonus Turn**: *"Rolled a 6! You get an extra roll!"* (Golden shimmer).
  - **Penalty**: *"Three 6s! Turn forfeited."* (Warning red).
  - **No Valid Moves**: *"No moves available. Passing turn..."* (Neutral gray).

### COMP-HUD-02: Player Status Cards (`PlayerHUDCard`)
- **Purpose**: Displays player status, token progression, and live network health during active gameplay.
- **Placement**: 4 cards positioned at the screen corners (desktop) or docked top/bottom (mobile).
- **Components**:
  - Color avatar with seat color border.
  - Display name and Host crown.
  - Token Progress Bar: 4 mini circular slots indicating token states (In Base, On Track, In Goal).
  - Active turn halo: Card pulses in seat color when it is that player's turn.
  - Disconnect badge: Amber alert if player is disconnected with remaining grace timer.

### COMP-HUD-03: Interactive Dice Roller (`DiceRollerWidget`)
- **Purpose**: Primary gameplay trigger for rolling the dice.
- **Visual Presentation**:
  - Tactile 2D-rendered dice with authentic 3D-shaded bevels and high-contrast pips (1 to 6).
  - Prominent "ROLL" button badge beneath dice.
- **State Variations**:
  - **Waiting / Inactive**: Low opacity, disabled cursor. Shows last rolled value.
  - **Ready to Roll**: Pulsing golden ring with animated prompt: *"TAP TO ROLL"*.
  - **Rolling**: High-speed 500ms tumbling animation cycling through random pip configurations with haptic feedback and rolling sound.
  - **Result**: Lands cleanly on final rolled number with celebratory expansion pulse.
- **Data Required**: `isCurrentTurn: boolean`, `hasRolled: boolean`, `diceValue: number | null`, `onRoll: () => void`.

### COMP-HUD-04: Mobile Token Picker Sheet (`MobileTokenPicker`)
- **Purpose**: Eliminates mis-taps on small smartphone screens when a roll yields multiple valid token moves.
- **Visual Presentation**: Bottom slide-up drawer appearing immediately after a roll if 2+ tokens can move:
  - Header: *"Choose Token to Move"*
  - Option Cards:
    - *Card A*: "Token 1 — Deploy onto Start Cell"
    - *Card B*: "Token 2 — Advance 6 cells to Cell 19"
  - Each card shows a miniature preview of the token's current and target positions.
- **Interaction**: Tapping a card immediately submits the move and closes the drawer.

### COMP-HUD-05: Real-Time Match Activity Feed (`MatchActionLog`)
- **Purpose**: Transparent, chronological log of all dice rolls, moves, captures, and penalties.
- **Visual Presentation**: Semi-transparent collapsible panel with auto-scrolling entries:
  - *"Alex rolled a 6"*
  - *"Alex deployed Token 1"*
  - *"Jordan captured Alex's Token 2 at Cell 26!"*
  - *"Jordan was awarded an extra roll!"*

---

## 6. Victory, Standings & Post-Game (Screen D)

### COMP-VIC-01: Victory Celebration Screen (`VictoryModal`)
- **Purpose**: Celebrates match completion and announces the winner.
- **Visual Presentation**:
  - Full-screen modal overlay with dark tinted backdrop.
  - Canvas confetti particle animation.
  - Large golden trophy illustration with winner's display name and quadrant color.
  - Sound effect: Orchestral victory fanfare.

### COMP-VIC-02: Final Standings & Statistics Table (`MatchSummaryTable`)
- **Purpose**: Detailed breakdown of player rankings and match achievements.
- **Visual Presentation**:
  - Podium cards (1st Place Winner, 2nd Place Runner-Up, etc.).
  - Statistics badges:
    - *Match Duration* (e.g., `12m 40s`).
    - *Captures Executed* (MVP Hunter badge).
    - *Sixes Rolled* (Lucky Roller badge).
    - *Total Turns Taken*.

### COMP-VIC-03: Rematch & Navigation Bar (`PostGameActions`)
- **Purpose**: Allows players to immediately play again without re-sharing codes.
- **Controls**:
  - **Host View**: Primary button **"Request Rematch"** (resets board, keeps players).
  - **Guest View**: Primary button **"Accept Rematch"** or waiting status.
  - **Secondary Button**: "Return to Lobby" or "Exit to Home".

---

## 7. Global Modals, Overlays & Notifications (Screen E)

### COMP-SYS-01: Tournament Rules & Tutorial Modal (`RulesModal`)
- **Purpose**: Clear, visual explanation of standard Ludo rules and interface controls.
- **Tabs**:
  1. *Basic Rules* (Dice 6 to deploy, track traversal, exact roll to win).
  2. *Safe Zones & Captures* (Star cells, starting cells, capturing opponents).
  3. *Special Rules* (Extra turn on 6 or capture, 3 consecutive 6s penalty).
  4. *Multiplayer Scaling* (How 2-player and 3-player matches skip empty seats).

### COMP-SYS-02: Connection Status Alert Banner (`ConnectionAlert`)
- **Purpose**: Warns the player of network drops and displays reconnection attempts.
- **Visual Presentation**: Fixed top notification banner with amber or red background:
  - *"Network connection interrupted. Reconnecting... Attempt 2/5"*.
  - Includes manual "Retry Now" button.

### COMP-SYS-03: System Toast Manager (`ToastContainer`)
- **Purpose**: Displays lightweight, transient feedback messages in top-right corner.
- **Toast Types**:
  - **Success (Green)**: "Link copied to clipboard", "Reconnected successfully".
  - **Warning (Amber)**: "Opponent disconnected — waiting for reconnection".
  - **Error (Red)**: "Cannot move token: Overshoots home goal", "Not your turn".

---

## Component Inventory Summary

| Component ID | Category | Primary Role | Responsive Handling |
| :--- | :--- | :--- | :--- |
| `COMP-NAV-01` | Navigation | App Header & Utility Controls | Compact icons on mobile |
| `COMP-LAND-01..04` | Landing Page | Branding, Room Creation & Joining | Stacked vertical layout on mobile |
| `COMP-LOBBY-01..05` | Lobby | Room Code, Seat Roster & Host Launch | 2×2 grid (desktop) → 1-col list (mobile) |
| `COMP-BOARD-01..05` | 2D SVG Board | Master 15×15 Board, Bases, Cells, Tokens | 100% width, viewBox scaling (0 0 1500 1500) |
| `COMP-HUD-01..05` | In-Game HUD | Turn Banner, Dice Roller, Token Picker | Corner cards (desktop) → Top/Bottom docks (mobile) |
| `COMP-VIC-01..03` | Standings | Victory Celebration & Rematch | Responsive modal card |
| `COMP-SYS-01..03` | Overlays | Rules Modal, Connection Banner, Toasts | Full-screen modal on mobile |
