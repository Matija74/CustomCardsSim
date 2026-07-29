# JavaScript Structure

The JavaScript files are grouped by responsibility so gameplay can be reworked without mixing card data, interface code, and multiplayer synchronization.

## Folders

- `cards/` contains card data loading, preset deck definitions, and JSON datasets.
- `decks/` contains deck parsing, validation, saved decks, and deck selection tools.
- `game/` contains the current shared gameplay implementation:
  - `actions/` contains the base card and match actions used without card effects.
  - `phases/` contains turn, phase, mulligan, and counter flow.
  - `settings/` contains runtime game-setting access.
  - `shared/` contains match state and behavior shared by both match pages.
- `multiplayer/` contains Firebase access and multiplayer synchronization.
- `ui/` contains shared presentation behavior and page-specific controllers.

## Current Load Model

Most gameplay files are classic browser scripts that share functions through the global scope, so their order in `singleplayer.html` and `multiplayer.html` is significant. Multiplayer synchronization files are JavaScript modules and use explicit imports.

Card JSON keeps the printed effect text for the planned rebuild, but the runtime strips effects and keywords from every card. Event activation, triggers, passive effects, blockers, and other keyword behavior are disabled. The current match pages support the base turn, DON!!, play, attack, life, K.O., deck-out, and printed character-counter rules only.

Future effect work belongs in a new focused area under `game/`; page controllers should only display choices and pass them to shared game rules.
