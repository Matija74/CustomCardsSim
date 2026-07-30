# Unsupported Card Effects

Compact audit generated from every saved card, the compiled card-effect registry, the activator registry, the action registry, continuous keyword rules, and supported printed keywords.

Regenerate after gameplay-system changes with `node scripts/generateUnsupportedEffects.mjs`.

## Summary

- Saved cards checked: **171**
- Declared effects checked: **267**
- Currently executable: **122**
- Ready to wire with existing activators and staples: **0**
- Still requires additional engine behavior: **145**
- Unsupported printed keywords: **0**

"Ready to wire" means the effect is not implemented yet, but its complete rules can be represented with the current system. It does not mean the card works today.

## Ready to wire with the current system

None.

## Still blocked by missing engine behavior

Each effect appears once under its primary missing capability. Some effects will need more than one new capability.

### Hidden-card, positional deck, or positional Life operations (36)

- `BL01-001-damage-upgrade-zangetsu`, `BL01-009-on-play-getsuga-search`, `DD01-004-main`, `IMU1-001-when-attacking`, `IMU1-002-on-ko-in-combat`, `IMU1-004-on-ko`, `IMU1-004-when-attacking`, `IMU1-008-on-play`
- `IMU1-010-end-of-turn`, `IMU1-011-counter`, `IMU1-012-main`, `IMU1-013-main`, `JK01-007-on-play`, `JK01-011-activate-main`, `JK02-021-on-play`, `KIL1-001-on-opponent-attack`
- `KIL1-003-activate-main`, `KIL1-004-activate-main`, `KIL1-005-activate-main`, `KIL1-006-on-play`, `KIL1-006-trigger`, `KIL1-008-trigger`, `KIL1-011-on-play`, `KIL1-012-when-attacked`
- `KIL1-014-main`, `OP06-107-on-play-life`, `OP13-104-on-ko-add-life`, `OP16-099-main`, `POG1-001-start-of-turn-search`, `POG1-005-on-opponent-attack`, `POG1-005-when-attacking`, `POG1-007-on-play`
- `PRB02-016-activate-main-power`, `SUB1-004-on-play-rush`, `SUB1-009-when-attacking-life-power`, `SUB1-012-on-play-search-emilia`

### Persistent, aura, or turn-condition evaluation (26)

- `BK01-001-removed-character-power`, `BK01-007-guts-base-power`, `BK01-010-farnese-power`, `BK01-016-guts-rush-leader-power`, `BL01-002-ichigo-base-power`, `BL01-003-ichigo-base-power`, `BL01-004-ichigo-base-power`, `BL01-005-ichigo-base-power`
- `BL01-012-stage-cost-power`, `BL01-014-ichigo-character-power`, `DD01-001-name-okarun`, `DD01-002-your-turn-power`, `DD01-006-name-okarun`, `DD01-016-name-jiji`, `DD01-016-opponents-turn-event-counter`, `IMU1-009-don-one`
- `JK01-006-continuous`, `JK01-010-on-play`, `JK02-001-deck-rule`, `JK02-020-cost-reduction`, `KIL1-007-custom`, `KIL1-008-don-two`, `OP16-082-plus-cost`, `ST28-004-your-turn-leader-power`
- `ST28-005-your-turn-power`, `YAM1-004-your-turn-power`

### Additional condition, duration, cost, or target-flow support (25)

- `BK01-007-on-play-give-don`, `BK01-013-on-play-give-don`, `BK01-015-main`, `BK01-016-on-play-give-don`, `DD01-007-when-attacking-refresh-don`, `DD01-013-counter`, `DD01-015-activate-main-power`, `EB03-057-on-ko-trash-life`
- `IMU1-012-trigger`, `JK01-001-on-opponent-attack`, `JK01-006-when-attacking`, `JK01-009-on-opponent-attack`, `JK01-011-on-ko`, `JK01-012-on-play`, `JK02-002-on-play`, `JK02-003-on-play`
- `JK02-005-main`, `JK02-014-on-play`, `JK02-018-activate-main`, `KIL1-014-counter`, `POG1-006-activate-main`, `SUB1-001-when-attacking-power`, `YAM1-001-on-character-play-draw`, `YAM1-003-counter`
- `YAM1-003-main`

### Replacement, protection, negation, or attack redirection (23)

- `BK01-006-activate-main-protect-guts`, `BL01-002-stage-removal-replace`, `BL01-003-stage-removal-replace`, `BL01-004-stage-removal-replace`, `BL01-005-stage-removal-replace`, `BL01-008-life-flip-replace`, `EGG1-013-opponents-turn-save`, `IMU1-005-stage-protection`
- `IMU1-007-effect-protection`, `IMU1-007-on-opponents-attack`, `IMU1-008-battle-protection`, `JK01-002-counter`, `JK01-003-counter`, `JK01-004-counter`, `JK01-008-continuous`, `JK01-009-continuous`
- `JK02-007-main`, `JK02-014-protection`, `JK02-015-protection`, `KIL1-009-activate-main`, `POG1-011-main`, `POG1-012-continuous`, `SUB1-003-continuous-rem-buff`

### Dynamic values, bulk operations, or reusing a selected target (12)

- `BK01-002-main`, `BL01-016-counter`, `DD01-002-end-of-turn-refresh-limit`, `DD01-013-main`, `DD01-017-when-attacking-ko-blocker`, `EGG1-006-activate-main-base-power`, `EGG1-008-activate-main-trash-power`, `EGG1-009-on-play-bounce-ko`
- `JK02-006-main`, `JK02-015-on-play`, `JK02-016-activate-main`, `POG1-002-on-play-mark-character`

### Branching choices, copied effects, or invoking another effect (10)

- `DD01-004-trigger`, `DD01-012-play-choice`, `EGG1-002-activate-main-copy`, `EGG1-005-on-play-choice`, `EGG1-012-main`, `JK02-004-main`, `POG1-003-on-play`, `POG1-009-main`
- `SUB1-007-activate-main-stage-copy`, `SUB1-007-on-play-stage-copy`

### Special game, deck-building, checkpoint, or win-condition rules (7)

- `BL01-001-starting-zangetsu`, `BL01-006-main`, `IMU1-001-deck-rule`, `JK01-001-deck-rule`, `JK01-005-counter`, `SUB1-001-checkpoint`, `SUB1-008-on-play-checkpoint`

### Attaching DON!! directly from the rested Cost Area (6)

- `BK01-005-activate-main-give-don`, `EB03-057-on-play-don`, `JK02-016-when-attacking`, `KIL1-001-activate-main`, `OP14-005-activate-main`, `YAM1-004-activate-main-attach-don`

## Unsupported printed keywords

None. Rush, Rush: Characters, Blocker, Unblockable, Banish, and Double Attack are implemented.
