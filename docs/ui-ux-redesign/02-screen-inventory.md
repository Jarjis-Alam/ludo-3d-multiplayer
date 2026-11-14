# Complete Screen & Interface Inventory

This document provides a comprehensive, component-level inventory of every screen, view, modal, overlay, and interface state in the LUDO application. It catalogs both the current implementation and the exact specifications required for the 2D Stitch AI redesign.

---

## Screen State Hierarchy

The client application operates as a single-page reactive application (`@ludo/web`) structured around a finite state machine governed by the server's `RoomSnapshot.status` and client network states:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GLOBAL SYSTEM OVERLAYS                          │
│   Network Banner · Toast Notifications · Rules Modal · Confirm Dialog  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴──────────────────────────────┐
    │                                                              │
    ▼                                                              ▼
┌───────────────────────┐                      ┌───────────────────────────────────────┐
│  STATE 0: DISCONNECTED│                      │           STATE 1: CONNECTED          │
│  Offline Screen       │                      └──────────────────┬────────────────────┘
└───────────────────────┘                                         │
        ┌─────────────────────────┬───────────────────────────────┴────────────────────────────┐
        ▼                         ▼                               ▼                            ▼
┌───────────────┐       ┌───────────────────┐           ┌───────────────────┐        ┌───────────────────┐
│   SCREEN A    │       │     SCREEN B      │           │     SCREEN C      │        │     SCREEN D      │
│  Landing Page │       │   Private Lobby   │           │   Active Match    │        │  Victory/Standings│
│(snapshot=null)│       │ (status='lobby')  │           │ (status='playing')│        │(status='finished')│
└───────────────┘       └───────────────────┘           └───────────────────┘        └───────────────────┘
```

---

## Screen A: Landing & Matchmaking Page (`snapshot === null`)

The primary entry point when a user visits the application root or has left an existing room.

### 1. Visual Structure & Layout
- **Header**: Minimalist top navigation with brand logo ("LUDO"), version badge (`v0.2.0`), documentation/rules trigger, and audio toggle.
- **Hero Column (Left / Top on Mobile)**:
  - Punchy typography: "Real-Time Multiplayer Ludo".
  - Subtitle emphasizing instant zero-friction play ("No downloads. No registration. 2–4 players with live synchronization").
  - Primary Action Card: Two tabs or segmented controls — **"Create Room"** and **"Join Room"**.
- **Interactive Preview Column (Right / Bottom on Mobile)**:
  - *Current 3D*: `LandingBoard.tsx` rendering a slow-spinning 3D board with decorative floating dice.
  - *Redesign Mandate (2D)*: High-fidelity, animated 2D top-down mini-board illustrating an active match scenario with pulsing token paths, soft drop-shadows, and micro-animations showing a capture and home-stretch entry.

### 2. Form Controls & State Elements
- **Player Name Input**:
  - Text input with auto-focus, placeholder "Enter your display name (e.g., Alex)".
  - Client-side validation: 1 to 20 alphanumeric characters, whitespace trimming.
  - Remembers last used name in `localStorage.getItem('ludo_player_name')`.
- **Create Room Mode**:
  - Primary button: "Create Private Room".
  - Loading spinner indicator when `isCreating` is true.
  - Automatically requests seat allocation on the server.
- **Join Room Mode**:
  - 6-character room code input with auto-capitalization, monospaced formatting, and dash separator (e.g., `LUD-492`).
  - Paste button helper for mobile users.
  - Primary button: "Join Game Room".
  - Auto-fill support via URL query parameter: `?room=CODE` automatically populates the code and focuses the name field.
- **Session Recovery / Rejoin Banner**:
  - If `localStorage.getItem('ludo_session')` contains an active session token and room code:
    - Surfaces a floating card: "Active match found: Room [CODE]. Rejoin as [Name]?" with "Rejoin Now" and "Dismiss" buttons.

### 3. Error States & Feedback
- **Empty / Invalid Name**: Inline error banner beneath the input field ("Please enter a display name between 1 and 20 characters").
- **Invalid Room Code**: "Room code must be 6 characters" or "Room not found or expired".
- **Room Full Error**: "Room is full (4/4 players already in match)".
- **Server Unreachable**: Warning pill: "Cannot connect to server. Retrying... (Check backend health)".

---

## Screen B: Waiting Room / Private Lobby (`snapshot.status === 'lobby'`)

The pre-match staging screen where players assemble, invite friends, review seat assignments, and where the room host initiates play.

### 1. Room Header & Social Sharing
- **Room Code Display**: Prominent, high-contrast monospace code badge (e.g., `ROOM: AB3X9Z`) with a one-tap "Copy Code" button.
- **Direct Link Sharing**: "Copy Invite Link" button copying `https://[domain]/?room=[CODE]`. Provides instant visual feedback ("Copied to clipboard!" tooltip/toast).
- **Player Capacity Gauge**: Dynamic badge showing `2/4 Players Connected`. Changes color from neutral gray (0–1 players) to accent gold/green (2–4 players: "Ready to start").

### 2. Player Roster & 4 Quadrant Seat Slots
A 2×2 grid (desktop) or vertical stack (mobile) representing the 4 traditional Ludo seats:
- **Seat 0: Red** (Top-Left)
- **Seat 1: Green** (Top-Right)
- **Seat 2: Yellow** (Bottom-Right)
- **Seat 3: Blue** (Bottom-Left)

#### Slot State Variations:
1. **Occupied by Current Player**:
   - Highlighted card with "YOU" badge.
   - Quadrant color avatar/icon.
   - Display name + Host crown badge (if host).
   - "Connected & Ready" status indicator (green dot).
2. **Occupied by Other Player**:
   - Quadrant color avatar/icon.
   - Display name + Host crown badge (if host).
   - Real-time connection badge: Green dot ("Connected") or Red pulsing dot ("Reconnecting...").
3. **Empty / Available Seat**:
   - Dashed border card.
   - Seat color outline with low opacity.
   - Label: "Waiting for player..." with animated pulse.
   - Subtext: "Will be automatically skipped if match starts with 2 or 3 players".

### 3. Host vs. Guest Interface Controls
- **Host View**:
  - Primary CTA: **"Start Game (N Players)"**.
  - **Dynamic State Logic**:
    - **0–1 Players**: Button disabled. Text: "Waiting for at least 1 more player... (Minimum 2 players required)".
    - **2–4 Players**: Button enabled with vivid golden/green primary gradient. Text: "Start Match with N Players".
    - Clicking emits `start_game` via Socket.IO with acknowledgement handler.
- **Guest View**:
  - Primary indicator: Disabled state card with pulsing spinner: "Waiting for host ([Host Name]) to start match...".
  - Readiness status: Automatically marked ready upon joining.
- **Secondary Actions (All Players)**:
  - "Leave Room" button with confirmation prompt to prevent accidental abandonment.
  - "Rules" button opening the tournament rules modal.

---

## Screen C: Active Multiplayer Game (`snapshot.status === 'playing'`)

The central gameplay arena. In the 2D redesign, this replaces the heavy Three.js viewport with an ultra-crisp 1500×1500 SVG vector board framed by an uncluttered, responsive heads-up display (HUD).

### 1. Board Layout & Coordinate Anatomy
- **Geometry**: Mathematically exact 15×15 grid (1500×1500 SVG coordinate space):
  - 4 Corner Bases (6×6 cells each): Red (0,0), Green (9,0), Yellow (9,9), Blue (0,9).
  - 4 Arms (3×6 cells each): Top arm (6–8, 0–5), Right arm (9–14, 6–8), Bottom arm (6–8, 9–14), Left arm (0–5, 6–8).
  - 4 Home Lanes: 5 cells each leading directly into the center goal.
  - Center Victory Goal: 3×3 intersection at cells (6–8, 6–8), segmented into 4 colored triangles meeting at the center point (750, 750).
  - 52 Track Cells: Perimeter loop with distinct border lines and drop shadows.
  - 8 Safe Cells: 4 start cells with color badges + 4 resting cells marked with antique gold stars (cells 8, 21, 34, 47).

### 2. Token Presentations & States
Each of the 4 players has 4 tokens (IDs 0, 1, 2, 3), for a total of 16 tokens on the board.
- **State 1: Base (`kind: 'base'`)**:
  - Sits in designated circular pocket within the player's 6×6 quadrant.
  - If current player's turn AND dice rolled is 6: Token pulses with a golden glow ring and bouncing animation, indicating it is deployable.
- **State 2: Main Track (`kind: 'path', progress: 0..51`)**:
  - Displayed centered on track cell.
  - Token stacking: If multiple tokens of the same player share a cell, they render in an offset cluster (mini-stack) with a numeric badge (e.g., "×2").
  - If current player's turn and token has a valid move: Token glows and hovers slightly with an animated drop-shadow; destination cell highlights with a dotted border preview.
- **State 3: Safe Cell**:
  - When resting on star cells or starting cells: Shield icon or golden star halo badge visibly overlays the token base to signal capture immunity.
- **State 4: Home Lane (`kind: 'home', progress: 0..5`)**:
  - Positioned inside the player's protected colored path.
  - Clear directional indicators pointing toward the central goal.
- **State 5: Finished in Center Goal (`kind: 'home', progress: 6`)**:
  - Sits inside the quadrant's center goal triangle.
  - Crown icon or golden laurel wreath overlay; cannot be moved again.

### 3. Game HUD & Real-Time Dashboard
Surrounding the central 2D board:
- **Active Turn Indicator Banner (Top Bar)**:
  - Dynamic announcement:
    - Current player's turn: "Your Turn! Roll the dice." (pulsing gold).
    - Opponent's turn: "Waiting for [Player Name] to roll..." (subtle seat-color accent).
    - Extra turn granted: "Rolled a 6! You get an extra roll!" (celebratory shimmer).
    - Triple-six penalty: "Three 6s in a row! Turn forfeited." (warning red).
    - No legal moves: "No legal moves. Passing turn..." (subtle gray).
- **Player Status Cards (Corner Docks / Side Columns)**:
  - 4 quadrant cards positioned near their corresponding board corners on desktop, or docked in a top/bottom split on mobile.
  - Card components:
    - Player seat color indicator & avatar.
    - Player display name & Host badge.
    - Finished tokens gauge: Visual 4-slot bar (e.g., `3/4 Home`).
    - Active turn highlight: Card borders pulse in seat color when turn is active.
    - Disconnection warning indicator: Yellow amber badge ("Offline - 45s to forfeit").
- **Dice Rolling Station (Floating Dock / Integrated Control)**:
  - Positioned adjacent to the active player's HUD or fixed at the bottom center on mobile.
  - **States**:
    - **Disabled / Waiting**: Transparent or low-opacity 3D-shaded 2D dice showing last rolled value.
    - **Ready to Roll**: Prominent, tactile button with dice face. Animated pulsing border with prompt "TAP TO ROLL".
    - **Rolling Animation**: 600ms high-speed tumbling sequence with authentic dice sound effect.
    - **Result Display**: High-contrast pip face (1 to 6) with numeric announcement badge.
- **Interactive Move Selection & Mobile Token Picker**:
  - When dice result yields multiple legal moves:
    - **On Desktop**: Board tokens with legal moves highlight with glowing rings; hovering over a token highlights its destination cell. Clicking the token confirms the move.
    - **On Mobile**: In addition to tapping the board directly, a sleek **Bottom Action Sheet** slides up: "Select Token to Move" displaying cards for each eligible token (Token 1: Advance to Cell 14; Token 2: Deploy from Base). This completely eliminates accidental mis-taps on small screens.
- **Match Action Log / Feed (Collapsible Drawer)**:
  - Chronological activity stream:
    - "Alex rolled a 6 and deployed Token 1"
    - "Jordan captured Alex's Token 2 at Cell 24!"
    - "Taylor entered the Home Stretch!"

---

## Screen D: Game Completion & Standings (`snapshot.status === 'finished'`)

Surfaced immediately when a player moves their 4th token into the center victory goal (`home, progress: 6`).

### 1. Victory Presentation & Celebration
- **Hero Banner**: "VICTORY!" with winner's quadrant color theme and display name.
- **Confetti / Particle Overlay**: Full-screen canvas particle burst celebration.
- **Trophy / Medal Podium**:
  - 1st Place (Winner): Gold medal, crown, 4/4 tokens finished.
  - 2nd Place: Silver medal, progress count (e.g., 3/4 tokens).
  - 3rd Place: Bronze medal, progress count.
  - 4th Place: Honorable mention.

### 2. Match Statistics & Performance Summary
Comprehensive match analytics card:
- Total Match Duration (e.g., `14m 32s`).
- Total Turns Played.
- Total Captures Executed (MVP Hunter badge to top capturer).
- Total Sixes Rolled (Lucky Roller badge).
- Total Tokens Sent Home.

### 3. Post-Match Action Controls
- **Host Controls**:
  - Primary CTA: **"Request Rematch"**.
  - Emits `request_rematch` to server, resetting the board to lobby or active match with existing players.
- **Guest Controls**:
  - Primary CTA: **"Ready for Rematch"** (acknowledges host's rematch).
- **Secondary Actions**:
  - "Return to Lobby" button.
  - "Leave Room" / "Main Menu" button.

---

## Screen E: System Overlays, Modals, and Notifications

Global UI components layered above any active screen.

### 1. Connectivity & Sync Banners
- **"Connecting..." Overlay**: Semi-transparent backdrop with branded loader when initial WebSocket handshake is pending.
- **"Reconnecting..." Banner**: Sticky top amber banner with countdown timer ("Connection interrupted. Reconnecting to match... Attempt 2/5").
- **"Disconnected / Match Paused"**: Full modal if connection is permanently dropped, offering "Reconnect" or "Exit to Home".
- **Desynchronization Auto-Recovery**: If client version falls behind `snapshot.version`, silently requests `request_game_state` without jarring UI flickers.

### 2. Rules & Tutorial Modal
- Accessible anytime via the `?` icon in the navigation bar.
- Tabbed interface:
  1. **Quick Start**: 4 simple visual cards (Deploy on 6, Move around track, Capture opponents, Enter goal with exact roll).
  2. **Safe Zones**: Explaining start cells and star cells.
  3. **Turn Rules**: Extra roll on 6, 3-consecutive-six penalty, automatic pass on no moves.
  4. **Multiplayer Scalability**: Explaining how 2-player and 3-player seat rotations work.

### 3. Action Rejection & Toast Notifications
- Floating micro-notifications in top-right (desktop) or top-center (mobile):
  - "Not your turn": Warning toast.
  - "Token cannot move: Overshoots home": Info toast.
  - "Room link copied to clipboard": Success toast.
  - "Player [Name] disconnected": Warning toast.
  - "Player [Name] reconnected": Success toast.

### 4. Settings & Preferences Drawer
- Audio controls: Master volume slider, Mute sound effects toggle.
- Animation speed: Normal (1×) / Fast (1.5×).
- Visual aids: Toggle destination highlight lines, Toggle cell numbering coordinates.

---

## Screen Inventory Summary Table

| Screen ID | State Trigger | Key User Roles | Core Interactions | Critical Edge Cases |
| :--- | :--- | :--- | :--- | :--- |
| **SCR-A: Landing** | `snapshot === null` | Visitor, Returning Player | Name entry, Room creation, Code entry, Rules read | Invalid code, Server 502/down, Room full |
| **SCR-B: Lobby** | `status === 'lobby'` | Host, Guest (2–4 players) | Copy link, Seat review, Ready up, Host start | Disconnect in lobby, Host leaves (migration), 1 player |
| **SCR-C: Active Board** | `status === 'playing'` | Active Player, Waiting Opponents | Roll dice, Select token, Inspect board, Chat/Log | Disconnect mid-roll, 3 consecutive 6s, 0 legal moves |
| **SCR-D: Standings** | `status === 'finished'` | Winner, Competitors | View stats, Rematch request, Leave room | Host leaves before rematch, Disconnected guest |
| **SCR-E: Overlays** | Global / Event-driven | All users | Dismiss toast, Reconnect, Review rules | Persistent network loss, Monotonic sync desync |
