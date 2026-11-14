# Ludo implementation plan

## Approach

Build a canonical, pure TypeScript game engine first. The engine owns board coordinates, legal moves, captures, safe cells, home lanes, exact finishing, extra turns and winner detection. The Node server owns sessions, rooms, dice generation, turn transitions and all mutations. Socket.IO broadcasts authoritative snapshots; the React client renders and animates confirmed state only.

## Design

- **Style options:** premium tabletop (0.06); quiet arcade (0.04); warm family board game (0.03).
- **Chosen style — premium tabletop:** elevated dimensional board, restrained charcoal background, glossy tokens and clear ivory surfaces.
- **Core principles:** board-first hierarchy, high-contrast player colors, minimal chrome, tactile motion.
- **Color philosophy:** red, green, yellow and blue are reserved for player identity; ivory and charcoal keep the play surface legible.
- **Layout:** a wide game table with the board as the anchor and slim side information rails rather than a dense dashboard grid.
- **Signature elements:** inset board frame, raised path cells, soft token shadows.
- **Interaction:** every action is explicit, validated by the server and reflected with immediate pending feedback followed by authoritative confirmation.
- **Typography:** system sans for compact UI with high-weight uppercase labels and relaxed numeric readouts.
- **Brand essence:** a private four-friend Ludo table that feels considered and dependable; tactile, social, precise.
