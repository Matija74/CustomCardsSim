# JavaScript Structure

The project keeps card/deck data, page controllers, multiplayer room connectivity, and the rebuilt gameplay runtime in separate modules.

## Folders

- `cards/` contains the complete card database loader, preset deck definitions, and all JSON datasets. Card effects and keywords remain stored in the JSON unchanged.
- `cards/effects/` contains card-specific declarative effect definitions grouped one file per activator. `cardEffectDefinitions.js` is the aggregation point and `effectCompiler.js` merges those definitions into the saved JSON cards without modifying staple actions.
- `decks/` contains deck parsing, validation, saved-deck, and deck-selection tools.
- `multiplayer/firebase/` contains Firebase initialization plus room, deck-selection, ready-state, and presence operations.
- `game/` contains centralized match state, validation, registered actions, effect resolution, turn phases, battle timing, and the command processor.
- `multiplayer/sync/` contains the host-authoritative multiplayer gameplay runtime.
- `ui/match/` renders centralized game state into the existing match pages and translates player input into commands.
- `ui/pages/` contains controllers for the non-match pages.
- `ui/shared/` contains presentation behavior shared by pages.

## Match Pages

`singleplayer.html` and `multiplayer.html` retain their existing play-area markup and styling. Both load the same gameplay engine and match controller; singleplayer permits local control of both players while multiplayer restricts input to the authenticated room slot.

Multiplayer rooms support guest sign-in, creation, joining, deck selection, ready state, presence, host-authoritative commands, private redacted state views, and disconnect handling. Only declarative effects with registered action arrays execute; remaining prose effects are listed in `UNSUPPORTED_CARD_EFFECTS.md`. Regenerate that audit after each activator batch with `node scripts/generateUnsupportedEffects.mjs`.
