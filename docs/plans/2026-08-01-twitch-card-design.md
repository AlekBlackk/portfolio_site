# Twitch Card Purple Design

## Goal

Give only the `twitch_bot` project card a recognisable Twitch treatment while preserving the existing dark IDE aesthetic and all other project cards.

## Design

- Set the card accent to Twitch Purple (`#9146FF`).
- Use that accent for the Twitch icon, preview halo, hover border, glow, and technology badges through the existing card accent token.
- Keep the card structure, copy, animation timing, interaction behaviour, and all non-Twitch project cards unchanged.

## Verification

- Confirm the card source uses the new Twitch Purple accent value.
- Run the existing Node test suite to ensure navigation and interface behaviour remain intact.
