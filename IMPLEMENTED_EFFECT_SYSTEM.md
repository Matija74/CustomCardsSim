# Implemented Effect System

This document lists the gameplay capabilities currently registered in the rebuilt effect system. An activator being supported means the engine can resolve that timing; an individual card still needs a compiled list of registered actions before its effect is executable.

## Activators (16)

### Manual activators

| Activator | Explanation |
|---|---|
| `activateMain` | Activated by the card's controller during their own Main Phase. The source must be that player's Leader, Character, or Stage and no other combat, selection, activation, Trigger, or effect resolution may be pending. Main Events use this timing when played from hand. |
| `counter` | Activated by the defending player during the Counter Step. Counter Events must be in that player's hand, must have an executable Counter effect, and require their DON!! cost to be paid. |
| `trigger` | Offered when a Life card with an executable Trigger is taken as normal battle damage. The defending player may activate it, sending the Life card to Trash before its effect resolves, or decline and add it to their hand. Banish prevents this activator. |

### Automatic activators

| Activator | Explanation |
|---|---|
| `onPlay` | Queued when a Character or Stage enters play, whether normally from hand or through an effect. |
| `onKO` | Queued when a Character is K.O.'d by battle or by an effect. Trashing or returning a Character is not a K.O. |
| `whenAttacking` | Queued for the attacker immediately after an attack is declared. It resolves before the Blocker and Counter Steps. |
| `onOpponentAttack` | Queued for eligible cards controlled by the defending player when their opponent declares an attack. |
| `whenAttacked` | Queued for the card chosen as the original attack target when the attack is declared. |
| `onBlock` | Queued for a Character after it activates Blocker, rests, and becomes the new attack target. |
| `gameStart` | Queued after setup and Life placement, before normal turn progression continues. |
| `startOfTurn` | Queued for the active player's eligible board cards when that player's turn begins. |
| `endOfTurn` | Queued for the active player's eligible board cards when their Main Phase ends. |
| `endOfOpponentTurn` | Queued for the non-active player's eligible board cards when the opponent's Main Phase ends. |
| `onOpponentDealsDamage` | Queued for eligible defending-player cards after an opponent successfully deals Leader damage and all Life/Trigger processing for that damage finishes. |
| `onCharacterPlay` | Queued for eligible board cards on both sides after a Character enters the Character Area, including Characters played by effects. |
| `whenTrashedFromDeck` | Queued when effect resolution moves a card directly from the main deck to Trash. |

Automatic effects marked as optional ask their controller whether to activate. `oncePerTurn` and `maxUsesPerTurn` limits are tracked per card instance and turn.

Supported aliases are normalized before resolution: `main` becomes `activateMain`, `onOpponentsAttack` becomes `onOpponentAttack`, `endOfYourTurn` becomes `endOfTurn`, and `endOfOpponentsTurn` becomes `endOfOpponentTurn`.

## Keywords (6)

| Keyword | Explanation |
|---|---|
| `Rush` | A Character may attack on the turn it was played. It must still be active and must follow normal attack-target rules. |
| `Rush: Characters` | On the turn the Character was played, it may attack an opponent's rested Character but cannot attack the opponent's Leader. From later turns onward it attacks normally. `Character Rush` is treated as the same keyword. |
| `Blocker` | During the Blocker Step, an active defending Character with Blocker may rest to redirect the attack to itself. Only the defending player may choose their Blocker. |
| `Unblockable` | The defending player cannot activate Blocker against this card's attack. The battle proceeds directly to the Counter Step, where normal card and Event Counters are still allowed. |
| `Banish` | When the attack deals Leader damage, each affected Life card is placed face-up in Trash instead of entering the defender's hand. Its Trigger cannot activate. |
| `Double Attack` | A successful attack against a Leader deals 2 Life damage instead of 1. Life cards are processed individually, so Trigger choices pause the remaining damage and resolution resumes afterward. `doubleAttack` is normalized to this keyword. |

Keywords may be printed on a card, granted temporarily by `grantKeyword`, or supplied by a registered continuous condition. Turn-duration keywords expire at the end of the correct turn, battle-duration keywords expire with that battle, and in-play grants are cleared when the card leaves play.

## Effect staples (33)

Effect staples are the reusable actions that card-specific effect definitions combine into an ordered effect.

### Card and zone actions

| Action | Explanation |
|---|---|
| `drawCard` | Draws a positive number of cards from the top of the selected player's deck. Attempting to draw from an empty deck causes that player to lose. |
| `trashCard` | Moves the selected non-Leader card to the top of its owner's Trash. Leaders are excluded from trash selections and rejected by the action. Attached DON!! returns rested, temporary keywords are cleared, and this does not count as a K.O. |
| `cardKO` | K.O.'s a selected Character in the Character Area, returns attached DON!! rested, moves the Character to its owner's Trash, and emits its `onKO` effects. |
| `returnCardToHand` | Returns a selected non-Leader card to its owner's hand. Cards cannot be returned from the deck or Life with this action. Attached DON!! returns rested and temporary keywords are cleared. |
| `returnCardToDeck` | Returns a selected non-Leader card to the top or bottom of its owner's deck. Attached DON!! returns rested and temporary keywords are cleared. |
| `moveCardToLife` | Moves a selected non-Leader card to the chosen player's top or bottom Life position with the configured face-up or face-down orientation. |
| `playCard` | Plays a selected Character or Stage into its proper board area, sets its state and played turn, and emits `onPlay`. Effect-based play does not pay the card's normal DON!! cost unless another action explicitly does so. |
| `replaceCharacter` | Trashes a chosen Character, preserves its slot, and plays the selected replacement Character into that slot. |
| `useEventCard` | Starts the selected Event's `activateMain` effect and moves the Event from hand to Trash. Normal Event play validation and DON!! payment are handled by the game engine. |
| `restCard` | Changes a controlled card to rested. Opposing cards require the effect definition to explicitly allow opponent targeting. |
| `restandCard` | Changes a controlled card to active. Opposing cards require the effect definition to explicitly allow opponent targeting. |
| `preventStateChange` | Adds one of the four state restrictions below to every selected card for a required duration. Legacy `preventedState: "rested"` and `preventedState: "active"` values map to `cannotBeRested` and `cannotBecomeActive`. |

#### State prevention varieties

| Prevention | Explanation |
|---|---|
| `cannotBeRested` | The card cannot be changed to rested by an effect or game action. Because attacking and activating Blocker both require the card to rest, it cannot attack or block while this prevention is active. |
| `cannotAttack` | The card cannot declare an attack. It may still be rested by effects and may still activate Blocker if it has that keyword. |
| `skipRefreshActivation` | The card does not become active during a Refresh Phase while the prevention applies. Effects may still set it as active. With `nextRefresh`, the prevention is consumed after that player's next Refresh Phase. |
| `cannotBecomeActive` | The card cannot be set as active by effects and does not become active during the Refresh Phase. An already-active card remains active until another rule rests it. |

#### State prevention durations

| Duration | Expiration |
|---|---|
| `turn`, `currentTurn`, `endOfTurn`, `untilEndOfTurn` | End of the current turn. |
| `untilEndOfYourTurn` | End of the prevention source controller's turn. |
| `untilEndOfOpponentTurn` | End of the prevention source controller's opponent's turn. |
| `untilEndOfTargetTurn` | End of the affected card controller's turn. |
| `nextRefresh`, `nextRefreshPhase`, `untilNextRefresh` | After the affected card controller's next Refresh Phase. |
| `battle` | End of the current battle. |
| `whileInPlay` | When the prevention's source card leaves the Leader, Character, or Stage area. |
| `permanent` | No automatic time-based expiration; leaving play still clears the prevention. |

### DON!! actions

| Action | Explanation |
|---|---|
| `addDon` | Moves a positive number of DON!! from the selected player's DON!! deck to their active or rested Cost Area, limited by the number remaining. |
| `returnDon` | Returns up to the requested number of DON!! to the selected player's DON!! deck. It never fails because too few DON!! are available and reports the amount actually returned. `source` may be `active`, `rested`, `costArea`, `attached`, or `any`; `any` is the default and uses rested, then active, then attached DON!!. When card targets are supplied, only attached DON!! on those controlled board cards are eligible. |
| `restDon` | Moves the required number of DON!! from active to rested in the selected player's Cost Area. |
| `restandDon` | Moves the required number of DON!! from rested to active in the selected player's Cost Area. |
| `attachDon` | Attaches active DON!! from the acting player's Cost Area to one of that player's cards. A player cannot attach DON!! to an opponent's card. |
| `detachDon` | Removes the required number of attached DON!! from a card and returns it to that card controller's Cost Area rested. |
| `moveAttachedDon` | Moves attached DON!! between two cards controlled by the acting player without returning it to the Cost Area. |

### Life, power, and cost actions

| Action | Explanation |
|---|---|
| `heal` | Moves cards from the top or bottom of the selected player's main deck to the top or bottom of their Life, using the configured face orientation. It stops safely if the deck runs out. |
| `damage` | Moves the requested number of cards from the top of the selected player's Life to their hand. If damage is attempted while that player has no Life, they lose. This staple does not open Life Trigger choices; battle damage handles Triggers separately. |
| `flipLife` | Turns a selected Life card face-up, face-down, or toggles its current orientation when no orientation is supplied. |
| `reorderLife` | Replaces a player's Life order with a complete, unique ordering of every card currently in that Life area. |
| `increasePower` | Adds the configured amount to a card's power for the specified duration. Multiple additive modifiers stack. |
| `decreasePower` | Subtracts the configured amount from a card's power for the specified duration. Effective power cannot fall below 0. |
| `setPower` | Sets a card's base power to the configured amount for the specified duration. Later additive modifiers and attached DON!! still apply. |
| `increaseCost` | Adds the configured amount to a card's cost for the specified duration. Multiple additive modifiers stack. |
| `decreaseCost` | Subtracts the configured amount from a card's cost for the specified duration. Effective cost cannot fall below 0. |
| `setCost` | Sets a card's base cost to the configured amount for the specified duration. Later additive modifiers still apply. |

### Search actions

| Action | Explanation |
|---|---|
| `search` | Temporarily removes a configured number of cards from the top or bottom of a player's deck, applies card filters, and lets the acting player take the required number or up to that number into the configured destination. The remaining cards stay in the search buffer until a cleanup action resolves. |
| `returnRest` | Returns all cards remaining in the current search buffer to the top or bottom of the deck. It preserves the player's chosen order when an order was requested. |
| `trashRest` | Moves all cards remaining in the current search buffer to the player's Trash. |

### Keyword action

| Action | Explanation |
|---|---|
| `grantKeyword` | Grants a normalized keyword to one or more selected cards. It supports permanent, `whileInPlay`, turn (`turn` or `untilEndOfTurn`), and `battle` durations. Opposing cards require explicit permission in the effect definition. |

## Shared staple options

Actions may target their source with `target: "source"`, the current combat target with `target: "battleTarget"`, a supplied instance ID, or a selection definition.

A selection can specify:

- Controller: self, owner, acting player, opponent, `p1`, or `p2`.
- Area: deck, hand, Life, Trash, Leader, Character Area, Stage, or multiple board areas.
- Amount: an exact number or `upTo` that number.
- Source exclusion when the effect cannot select itself.
- Filters for maximum or minimum cost, maximum or minimum power, card type, active/rested state, name, excluded name, type text, and color.

Effect requirements can currently check Leader name, Stage name, absence of a Stage, Character name, number of rested Characters, own or opposing Life count, Leader type, attached DON!! on the source, and whether the player controls a Character at or above a required power.
