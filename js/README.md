# JavaScript Structure

The project currently keeps card/deck data, page controllers, and multiplayer room connectivity. The playable match runtime has been removed so a new game implementation can be built from a clean base.

## Folders

- `cards/` contains the complete card database loader, preset deck definitions, and all JSON datasets. Card effects and keywords remain stored in the JSON unchanged.
- `decks/` contains deck parsing, validation, saved-deck, and deck-selection tools.
- `multiplayer/firebase/` contains Firebase initialization plus room, deck-selection, ready-state, and presence operations.
- `multiplayer/sync/` contains the connection-only runtime used after players open a multiplayer play area.
- `ui/pages/` contains controllers for the non-match pages.
- `ui/shared/` contains presentation behavior shared by pages.

## Match Pages

`singleplayer.html` and `multiplayer.html` retain their existing play-area markup and styling. They do not load a game engine or match controller. Start, sort, surrender, and gameplay actions are disabled, leaving the board as a view-only play area.

Multiplayer rooms still support guest sign-in, creation, joining, deck selection, ready state, opening the play area, live presence, and disconnect handling. No match state, turn flow, card movement, attacks, counters, effects, or win conditions are created or synchronized.
