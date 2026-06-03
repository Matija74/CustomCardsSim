# Custom Cards Simulator

A browser-based deck builder and practice simulator for custom cards inspired by
the One Piece Card Game rule structure. Build a deck, choose leaders, test card
interactions, and run self-play games without installing a full game client.

## Patch Notes

### 0.41

- Added the `UB Higuruma` preset deck.
- Notice: this deck has not yet been fully tested for bugs.

### 0.4

- Updated the game layout to adapt better across browsers and screen sizes.
- Fixed `Banana Onemoglosti` so it now negates card effects, keywords, and
  continuous effects until the end of the turn.
- Fixed `Hvala hvala hvala` so it can now be played during counter phase.
- Updated `Mr. Jeremić` so it now lets you type a card name, plays a matching
  card from the deck if found, then shuffles the deck.
- Fixed `Johan Johanović` so it now places both chosen cards on top of the deck
  or both on the bottom.
- Updated stages so they can no longer be played over another stage.

### 0.3

- Added local save, load, delete, and copy/import support to the Deck Editor.
- Updated saved deck data to include deck name, selected leader, and card list.
- Added deck selection popups for VS Self and queue-based deck selection for
  multiplayer.

### 0.2

- Added multiplayer foundations including live board syncing.
- Updated multiplayer visibility so each player sees their own board on bottom
  while opponent hand, life, and deck stay hidden.
- Added queue and match start fixes, plus gameplay settings automation.

### 0.1

- Added the Patch Notes page on the main menu.
