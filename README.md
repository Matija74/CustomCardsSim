# Custom Cards Simulator

A browser-based deck builder and practice simulator for custom cards inspired by
the One Piece Card Game rule structure. Build a deck, choose leaders, test card
interactions, and run self-play games without installing a full game client.

## Highlights

- **Deck editor** with leader selection, card search, filters, copy limits, and
  image previews.
- **Self-play simulator** for testing two decks side by side in the browser.
- **Rule-flow helpers** for dice rolls, mulligans, life setup, refresh, draw,
  DON!!, main phase, counters, attacks, and turn passing.
- **Data-driven card pool** using JSON files for leaders, characters, events,
  and stages.
- **Sample decks and card art** included so you can start testing immediately.
- **Static frontend** built with plain HTML, CSS, and JavaScript.

## Quick Start

Because the app loads card data from JSON files, run it through a local web
server instead of opening `index.html` directly.

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

From the main menu you can open the deck editor, pick decks for both players,
and launch a self-play game.

## Project Structure

```text
CustomCardsSim/
|-- index.html              # Main menu
|-- html/                   # App pages
|-- css/                    # Page styles
|-- js/
|   |-- cards/              # Card database and deck definitions
|   |-- core/               # Game flow, phases, effects, interactions
|   `-- pages/              # Page-specific controllers
|-- data/cards/             # JSON card definitions
`-- images/                 # Card backs and sample card artwork
```

## Working With Cards

Card definitions live in `data/cards/` and are loaded into the browser at
runtime. Add or update JSON entries there, then reference matching image paths
from `images/` to make new cards available in the deck editor and simulator.

Prebuilt deck lists are currently defined in `js/cards/decks.js`. Each deck
selects a leader and a text-style card list, making it easy to add quick testing
lists while iterating on custom cards.

## Current Status

This project is focused on local card design, deck testing, and practice play.
It is a lightweight simulator rather than a full online rules engine, so expect
the custom card pool and supported interactions to grow as new cards and effects
are added.
