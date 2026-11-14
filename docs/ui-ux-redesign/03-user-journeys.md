# End-to-End User Journeys & Interaction Flows

This document details every end-to-end user flow in the LUDO application. For each journey, it specifies user actions, visual and audio feedback, underlying Socket.IO network events, edge cases, friction points in the existing application, and the exact design solutions for the 2D redesign.

---

## Journey 1: Host Room Creation & Friend Onboarding

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Enter Name  │ ──► │ Create Room  │ ──► │ Private Room │ ──► │  Copy Invite │ ──► Start Game
│  "Alex"      │     │  Button Tap  │     │ Lobby (1/4)  │     │  Link to SMS │     (2–4 Players)
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Step-by-Step Flow:
1. **User Action**: Alex arrives at the root domain (`https://ludo.example.com`).
2. **Visual Presentation**:
   - The landing hero displays an animated 2D top-down mini-board showing lively game interactions.
   - Alex types "Alex" into the Display Name input field (auto-saved to `localStorage`).
   - Alex taps the primary button: **"Create Private Room"**.
3. **Network Event**:
   - Client emits `create_room({ playerName: 'Alex' })`.
   - Server allocates a 6-character room code (e.g., `NW84K2`), assigns Alex to Seat 0 (Red) as Host, and replies with `{ success: true, room: RoomSnapshot }`.
4. **Transition to Lobby**:
   - Client seamlessly transitions to `Screen B (Lobby)`.
   - The room header displays `ROOM CODE: NW84K2` with a pulsing "Copy Link" pill.
   - Seat 0 displays "Alex (YOU)" with a golden crown icon and green "Connected" badge. Seats 1, 2, and 3 display dashed empty placeholders.
   - The primary action button reads: `"Waiting for at least 1 more player... (Minimum 2 players required)"` and is disabled.
5. **Inviting Friends**:
   - Alex clicks **"Copy Invite Link"**.
   - A success toast announces: *"Invite link copied to clipboard!"*.
   - Alex shares `https://ludo.example.com/?room=NW84K2` via messaging apps.
6. **Starting Match**:
   - As soon as Jordan joins (Player 2), the lobby updates in real-time. Player gauge switches to `2/4 Players`.
   - The Host button activates with an illuminated gold gradient: **"Start Game (2 Players)"**.
   - Alex clicks the button.
   - Client emits `start_game({ roomCode: 'NW84K2' })`. Server validates player count (≥ 2), updates status to `'playing'`, and broadcasts `game_started` to all room sockets.

### Friction Points & Redesign Fixes:
- *Current Friction*: In the legacy UI, users were confused about whether 4 players were mandatory because the button was disabled without an explicit explanation.
- *Redesign Solution*: A real-time capacity badge explicitly states: `"2–4 Players Supported. Can start now or wait for more friends."` The button dynamically updates its label: `"Start Match with 2 Players"`.

---

## Journey 2: Guest One-Click Join via Shared URL

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Open Invite Link │ ──► │ Name Auto-Focus  │ ──► │ One-Tap "Join"   │ ──► │ Synchronized     │
│ ?room=NW84K2     │     │ Pre-filled Code  │     │ Instant Handshake│     │ Lobby (Seat 1)   │
└──────────────────┘     └──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Step-by-Step Flow:
1. **User Action**: Jordan taps Alex's shared link on mobile.
2. **Visual Presentation**:
   - Browser opens directly to `https://ludo.example.com/?room=NW84K2`.
   - The Join Tab is automatically selected.
   - The Room Code field is pre-filled with `NW84K2` and locked/highlighted.
   - Focus immediately jumps to the "Enter your name" input.
3. **User Action**: Jordan enters "Jordan" and taps **"Join Game Room"**.
4. **Network Event**:
   - Client emits `join_room({ roomCode: 'NW84K2', playerName: 'Jordan' })`.
   - Server allocates Jordan to Seat 1 (Green) and updates the room snapshot.
   - Server broadcasts `room_updated` to all connected clients in that room.
5. **Lobby Presentation**:
   - Jordan's screen updates to `Screen B (Lobby)`.
   - Seat 0 shows Alex (Host). Seat 1 shows Jordan (YOU).
   - Jordan's primary indicator shows: `"Waiting for Host (Alex) to start match..."` with an animated waiting pulse.
   - When Alex clicks Start, Jordan's screen instantly transitions to the active 2D game board.

### Friction Points & Redesign Fixes:
- *Current Friction*: If a user was prompted to manually copy-paste the room code, typos and missing dashes caused failed joins.
- *Redesign Solution*: Deep-link parsing automatically extracts `?room=CODE`, strips whitespace/dashes, validates format, and surfaces a friendly banner: *"You've been invited to join Alex's room!"*.

---

## Journey 3: Dynamic 2, 3, and 4 Player Game Scaling

LUDO adapts seamlessly to any group size from 2 to 4 players without requiring artificial computer bots.

### Scenario A: 2-Player Match (Seat 0 Red vs. Seat 1 Green or Seat 2 Yellow)
- Host starts the match with 2 players.
- Turn progression cycles exclusively between active seats:
  - Red rolls → moves → Turn passes directly to Green.
  - Green rolls → moves → Turn passes directly back to Red.
  - Seats 2 (Yellow) and 3 (Blue) remain completely dormant: their base pockets are dimmed with subtle opacity, their tokens are absent, and their turns are skipped in zero milliseconds.

### Scenario B: 3-Player Match (Seat 0 Red, Seat 1 Green, Seat 2 Yellow)
- 3 players assemble. Seat 3 (Blue) is unoccupied.
- Turn rotation: `Red → Green → Yellow → Red`.
- Blue quadrant is visually marked as "Unoccupied Slot".

### Scenario C: 4-Player Match (All Seats Filled)
- Full tournament format: `Red → Green → Yellow → Blue → Red`.
- Maximum board competition with frequent captures and tactical blockades.

---

## Journey 4: The Core Active Gameplay Loop

The interactive heart of the game, executed through crisp SVG elements and zero-latency WebSocket synchronization.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Opponent's Turn │ ──► │  "YOUR TURN!"   │ ──► │  Roll the Dice  │ ──► │ Move Selection  │
│ Live Board Sync │     │  Sound + Banner │     │  Tactile Tap    │     │ 2D Highlight/Tap│
└─────────────────┘     └─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                                                 │
                        ┌─────────────────┐     ┌─────────────────┐              │
                        │ Next Player     │ ◄── │ Server Validates│ ◄────────────┘
                        │ Turn Rotates    │     │ & Broadcasts    │
                        └─────────────────┘     └─────────────────┘
```

### Detailed Loop Phases:

#### 1. Waiting for Turn:
- Board is interactive for panning/zooming, but token click handlers are inactive.
- The top turn banner displays: `"Waiting for Jordan (Green) to roll..."`.
- The active player's HUD card pulses with a gentle colored border.

#### 2. Turn Transition Notification:
- Server advances turn to user (`snapshot.game.turn === userSeat`).
- Client triggers a soft audio chime ("Your Turn!").
- Top banner illuminates: `"YOUR TURN! Roll the dice."`.
- Dice component in the bottom HUD pulses with a golden glow and "TAP TO ROLL" label.

#### 3. Rolling the Dice:
- User taps the dice button.
- Client emits `roll_dice({ roomCode: 'NW84K2' })`.
- Dice begins a 500ms tumbling animation with authentic rolling audio.
- Server generates cryptographically secure roll (1–6), updates `diceValue` and `pendingMoves`, and broadcasts the state update.
- Dice lands on value (e.g., `6`).

#### 4. Outcome Branching:

##### Branch A: Dice Roll = 6
- **Case 1: Tokens in Base & Tokens on Track**:
  - Both base tokens and active track tokens have valid moves.
  - Base tokens pulse with an outbound deployment arrow (`kind: 'base' → start cell`).
  - Active tokens on track highlight with glowing rings; destination preview dots appear 6 cells ahead.
  - **Mobile Enhancement**: A sleek bottom action sheet slides up showing clear cards:
    - *Card 1*: "Deploy Token 1 onto Start Cell"
    - *Card 2*: "Advance Token 2 to Cell 18"
- **Case 2: Extra Turn Award**:
  - Moving a token on a 6 automatically awards an extra roll.
  - Turn indicator announces: *"Rolled a 6! You get an extra roll!"*.
- **Case 3: Triple-Six Penalty**:
  - If a player rolls 6 three consecutive times, the server detects `consecutiveSixes === 3`.
  - The third roll is voided, and the turn automatically passes to the next player.
  - Notification banner shows: *"Three 6s in a row! Turn forfeited."* with a subtle warning sound.

##### Branch B: Dice Roll = 1 to 5
- **Case 1: No Tokens on Track**:
  - If all tokens are in base, no legal moves exist.
  - System automatically announces: *"No legal moves. Passing turn..."*.
  - Turn passes after a brief 1.2-second pause so the player clearly understands what happened.
- **Case 2: Single Valid Move**:
  - Only one token can move (or only one token is on the track).
  - To prevent accidental missteps, the token pulses and destination flashes. User taps the token (or picker card) to confirm. (Optionally: auto-advance setting can execute it).
- **Case 3: Multiple Valid Moves**:
  - Eligible tokens glow brightly with elevated drop shadows.
  - Tapping a token sends `move_token({ roomCode, tokenId })`.

#### 5. Executing the Move & Captures:
- Client animates token step-by-step along the 2D SVG track cells (120ms per cell hop).
- **Capture Event**:
  - If destination is a non-safe cell containing an opponent's token:
    - Opponent token triggers a wobble and pop animation with a capture sound effect.
    - Opponent token zooms smoothly back to its home base pocket.
    - Top banner announces: *"Alex captured Jordan's token!"*.
    - Alex is awarded an immediate bonus turn.
- **Safe Cell Landing**:
  - If destination is a star cell (cells 8, 21, 34, 47) or quadrant start cell:
    - Token sits securely with a golden shield halo. Opponents cannot land on or capture this token.

#### 6. Entering Home Stretch & Victory:
- Once a token reaches `progress >= 52`, it enters the private colored home lane.
- Progressing into the center goal triangle (`progress: 6`) requires an **exact roll**.
  - If a token is at home cell 4, it needs exactly 2 to reach goal. A roll of 3, 4, 5, or 6 cannot be applied to this token.
- When the 4th token enters the goal:
  - Server marks player as winner and sets `snapshot.status = 'finished'`.
  - Match instantly transitions to `Screen D (Victory Standings)`.

---

## Journey 5: Fault-Tolerant Reconnection & Session Recovery

```
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│ Mobile Network Drop│ ──► │ Auto-Reconnect     │ ──► │ Monotonic Version  │ ──► Seamless
│ Or Browser Refresh │     │ WebSocket Retry    │     │ State Sync         │     Gameplay Resumed
└────────────────────┘     └────────────────────┘     └────────────────────┘
```

### Step-by-Step Flow:
1. **Disconnection Event**: A player rides through a tunnel, switches from Wi-Fi to 5G, or accidentally refreshes the browser.
2. **Visual Feedback**:
   - The UI does **not** crash or redirect to home.
   - An amber sticky banner drops from the top: *"Connection lost. Reconnecting to match... (Attempt 1/5)"*.
   - Opponents see a yellow alert dot on that player's HUD card: *"Jordan is reconnecting (45s grace period)"*.
3. **Reconnection & State Restoration**:
   - The client's Socket.IO manager reconnects to Render.
   - Client checks `localStorage` for `sessionToken` and `roomCode`.
   - Client emits `rejoin_room({ roomCode, sessionToken })`.
   - Server validates the session, reassociates the socket ID, retrieves the latest `RoomSnapshot` from memory or PostgreSQL, and emits `room_snapshot`.
4. **Resumption**:
   - Amber banner disappears, replaced by a momentary green toast: *"Reconnected!"*.
   - The 2D board renders the exact current token positions, active turn, and dice state with zero loss of progress.

---

## Journey 6: Comprehensive Error Handling & Recovery

| Error Trigger | System Response & UI Presentation | User Remediation |
| :--- | :--- | :--- |
| **Invalid Room Code** | Red inline banner below code input: *"Room code not found or expired. Check the code and try again."* | Re-enter 6-character code or create a new room. |
| **Room Full (4/4)** | Modal dialog: *"This room is already at full capacity (4/4 players)."* | Return to landing page or ask host for new room. |
| **Host Disconnects in Lobby** | Server automatically migrates host privileges to the next connected player. UI updates crown badge to new host. | New host can now configure and start the match. |
| **Illegal Move Attempt** | Shakes the invalid token with red aura. Toast: *"Illegal move: Roll overshoots the home goal."* | Select an alternative valid token. |
| **Server Restart / Crash** | Server recovers active room from Supabase PostgreSQL pool. Client reconnects and requests `request_game_state`. | Match continues seamlessly without data loss. |

---

## Journey 7: Post-Game Standings, Rematch & Exit

```
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│ 4th Token in Goal  │ ──► │ Confetti & Podium  │ ──► │ Rematch Requested  │ ──► New Match Starts
│ Status: 'finished' │     │ Match Statistics   │     │ By Host            │     (Seats Retained)
└────────────────────┘     └────────────────────┘     └────────────────────┘
```

### Step-by-Step Flow:
1. **Victory Trigger**: Alex moves their final token into the Red home goal.
2. **Visual Presentation**:
   - Full-screen gold and red confetti particle shower.
   - Victory fanfare sound effect.
   - Podium displays:
     - 🥇 1st Place: **Alex** (Red) — 4 tokens home
     - 🥈 2nd Place: **Jordan** (Green) — 2 tokens home
   - Match Stats Card: Duration `11m 45s`, Total Captures `7`, Sixes Rolled `14`.
3. **Rematch Flow**:
   - Alex (Host) clicks **"Request Rematch"**.
   - Client emits `request_rematch({ roomCode })`.
   - Jordan's screen updates with a prominent banner: *"Host requested a rematch! Ready to play again?"* with **"Accept Rematch"** button.
   - Once accepted, server resets token positions to home bases, randomizes first turn or awards it to the winner, sets status to `'playing'`, and starts the new match immediately.
4. **Exit Flow**:
   - Any player can click **"Exit to Main Menu"**.
   - Client emits `leave_room({ roomCode })`, clears active match session from `localStorage`, and returns to the clean Landing Page.
