# Unsupported Card Effects

Compact audit generated from every saved card, the compiled card-effect registry, the activator registry, the action registry, continuous keyword rules, and supported printed keywords.

Regenerate after gameplay-system changes with `node scripts/generateUnsupportedEffects.mjs`.

## Summary

| Audit result | Count |
|---|---:|
| Saved cards checked | 171 |
| Declared effects checked | 267 |
| Currently executable | 122 |
| Ready to wire with existing activators and staples | 0 |
| Requires additional engine behavior | 145 |
| Unsupported printed keywords | 0 |

"Ready to wire" means the effect is not implemented yet, but its complete rules can be represented with the current system. It does not mean the card works today.

## Ready to wire with the current system

None.

## Still blocked by missing engine behavior

Each effect appears once with its primary missing capability. Some effects will require more than one new capability.

| Card | Effect ID | Activator | Missing support |
|---|---|---|---|
| `BK01-001` — Guts | `BK01-001-removed-character-power` | continuous | Persistent, aura, or turn-condition evaluation |
| `BK01-002` — Get that... to the Black Swordsman | `BK01-002-main` | main | Dynamic values, bulk operations, or reusing a selected target |
| `BK01-005` — Puck | `BK01-005-activate-main-give-don` | activateMain | Attaching DON!! directly from the rested Cost Area |
| `BK01-006` — Schierke | `BK01-006-activate-main-protect-guts` | activateMain | Replacement, protection, negation, or attack redirection |
| `BK01-007` — Ishidro | `BK01-007-guts-base-power` | continuous | Persistent, aura, or turn-condition evaluation |
| `BK01-007` — Ishidro | `BK01-007-on-play-give-don` | onPlay | Additional condition, duration, cost, or target-flow support |
| `BK01-010` — Serpico | `BK01-010-farnese-power` | continuous | Persistent, aura, or turn-condition evaluation |
| `BK01-013` — Guts | `BK01-013-on-play-give-don` | onPlay | Additional condition, duration, cost, or target-flow support |
| `BK01-015` — Artificial Arm Huh? It's Groovy. | `BK01-015-main` | main | Additional condition, duration, cost, or target-flow support |
| `BK01-016` — Guts | `BK01-016-guts-rush-leader-power` | continuous | Persistent, aura, or turn-condition evaluation |
| `BK01-016` — Guts | `BK01-016-on-play-give-don` | onPlay | Additional condition, duration, cost, or target-flow support |
| `BL01-001` — Kurosaki Ichigo | `BL01-001-damage-upgrade-zangetsu` | onOpponentDealsDamage | Hidden-card, positional deck, or positional Life operations |
| `BL01-001` — Kurosaki Ichigo | `BL01-001-starting-zangetsu` | gameStart | Special game, deck-building, checkpoint, or win-condition rules |
| `BL01-002` — Zangetsu: Sealed | `BL01-002-ichigo-base-power` | continuous | Persistent, aura, or turn-condition evaluation |
| `BL01-002` — Zangetsu: Sealed | `BL01-002-stage-removal-replace` | replacement | Replacement, protection, negation, or attack redirection |
| `BL01-003` — Zangetsu: Shikai | `BL01-003-ichigo-base-power` | continuous | Persistent, aura, or turn-condition evaluation |
| `BL01-003` — Zangetsu: Shikai | `BL01-003-stage-removal-replace` | replacement | Replacement, protection, negation, or attack redirection |
| `BL01-004` — Bankai: Tensa Zangetsu | `BL01-004-ichigo-base-power` | continuous | Persistent, aura, or turn-condition evaluation |
| `BL01-004` — Bankai: Tensa Zangetsu | `BL01-004-stage-removal-replace` | replacement | Replacement, protection, negation, or attack redirection |
| `BL01-005` — Tensa Zangetsu: Visored | `BL01-005-ichigo-base-power` | continuous | Persistent, aura, or turn-condition evaluation |
| `BL01-005` — Tensa Zangetsu: Visored | `BL01-005-stage-removal-replace` | replacement | Replacement, protection, negation, or attack redirection |
| `BL01-006` — Getsuga Tensho | `BL01-006-main` | main | Special game, deck-building, checkpoint, or win-condition rules |
| `BL01-008` — Uryu Ishida | `BL01-008-life-flip-replace` | replacement | Replacement, protection, negation, or attack redirection |
| `BL01-009` — Kisuke Urahara | `BL01-009-on-play-getsuga-search` | onPlay | Hidden-card, positional deck, or positional Life operations |
| `BL01-012` — Kurosaki Ichigo | `BL01-012-stage-cost-power` | continuous | Persistent, aura, or turn-condition evaluation |
| `BL01-014` — Uryu Ishida | `BL01-014-ichigo-character-power` | continuous | Persistent, aura, or turn-condition evaluation |
| `BL01-016` — Santen Kesshun | `BL01-016-counter` | counter | Dynamic values, bulk operations, or reusing a selected target |
| `DD01-001` — Takakura Ken | `DD01-001-name-okarun` | continuous | Persistent, aura, or turn-condition evaluation |
| `DD01-002` — Turbo Granny Form | `DD01-002-end-of-turn-refresh-limit` | endOfTurn | Dynamic values, bulk operations, or reusing a selected target |
| `DD01-002` — Turbo Granny Form | `DD01-002-your-turn-power` | continuous | Persistent, aura, or turn-condition evaluation |
| `DD01-004` — If you lose the race against Turbo Granny... | `DD01-004-main` | main | Hidden-card, positional deck, or positional Life operations |
| `DD01-004` — If you lose the race against Turbo Granny... | `DD01-004-trigger` | trigger | Branching choices, copied effects, or invoking another effect |
| `DD01-006` — Takakura Ken | `DD01-006-name-okarun` | continuous | Persistent, aura, or turn-condition evaluation |
| `DD01-007` — Unji Zuma | `DD01-007-when-attacking-refresh-don` | whenAttacking | Additional condition, duration, cost, or target-flow support |
| `DD01-012` — Vamola | `DD01-012-play-choice` | onPlay | Branching choices, copied effects, or invoking another effect |
| `DD01-013` — The Power of Words! | `DD01-013-counter` | counter | Additional condition, duration, cost, or target-flow support |
| `DD01-013` — The Power of Words! | `DD01-013-main` | main | Dynamic values, bulk operations, or reusing a selected target |
| `DD01-015` — Turbo Granny | `DD01-015-activate-main-power` | activateMain | Additional condition, duration, cost, or target-flow support |
| `DD01-016` — Enjoji Jin | `DD01-016-name-jiji` | continuous | Persistent, aura, or turn-condition evaluation |
| `DD01-016` — Enjoji Jin | `DD01-016-opponents-turn-event-counter` | opponentsTurn | Persistent, aura, or turn-condition evaluation |
| `DD01-017` — Shiratori Aira | `DD01-017-when-attacking-ko-blocker` | whenAttacking | Dynamic values, bulk operations, or reusing a selected target |
| `EB03-057` — Yamato | `EB03-057-on-ko-trash-life` | onKO | Additional condition, duration, cost, or target-flow support |
| `EB03-057` — Yamato | `EB03-057-on-play-don` | onPlay | Attaching DON!! directly from the rested Cost Area |
| `EGG1-002` — Metal Sonic | `EGG1-002-activate-main-copy` | activateMain | Branching choices, copied effects, or invoking another effect |
| `EGG1-005` — Eggman (Dr. Ivo Robotnik) | `EGG1-005-on-play-choice` | onPlay | Branching choices, copied effects, or invoking another effect |
| `EGG1-006` — Infinite | `EGG1-006-activate-main-base-power` | activateMain | Dynamic values, bulk operations, or reusing a selected target |
| `EGG1-008` — Metal Sonic | `EGG1-008-activate-main-trash-power` | activateMain | Dynamic values, bulk operations, or reusing a selected target |
| `EGG1-009` — The Death Egg | `EGG1-009-on-play-bounce-ko` | onPlay | Dynamic values, bulk operations, or reusing a selected target |
| `EGG1-012` — Get A Load Of This! | `EGG1-012-main` | main | Branching choices, copied effects, or invoking another effect |
| `EGG1-013` — Sage | `EGG1-013-opponents-turn-save` | opponentsTurn | Replacement, protection, negation, or attack redirection |
| `IMU1-001` — Nerona Imu | `IMU1-001-deck-rule` | continuous | Special game, deck-building, checkpoint, or win-condition rules |
| `IMU1-001` — Nerona Imu | `IMU1-001-when-attacking` | whenAttacking | Hidden-card, positional deck, or positional Life operations |
| `IMU1-002` — St. Sheperd Sommers | `IMU1-002-on-ko-in-combat` | onKO | Hidden-card, positional deck, or positional Life operations |
| `IMU1-004` — Harald | `IMU1-004-on-ko` | onKO | Hidden-card, positional deck, or positional Life operations |
| `IMU1-004` — Harald | `IMU1-004-when-attacking` | whenAttacking | Hidden-card, positional deck, or positional Life operations |
| `IMU1-005` — St. Figarland Garling | `IMU1-005-stage-protection` | replacement | Replacement, protection, negation, or attack redirection |
| `IMU1-007` — St. Manmayer Gunko | `IMU1-007-effect-protection` | continuous | Replacement, protection, negation, or attack redirection |
| `IMU1-007` — St. Manmayer Gunko | `IMU1-007-on-opponents-attack` | onOpponentsAttack | Replacement, protection, negation, or attack redirection |
| `IMU1-008` — St. Rimoshifu Killingham | `IMU1-008-battle-protection` | replacement | Replacement, protection, negation, or attack redirection |
| `IMU1-008` — St. Rimoshifu Killingham | `IMU1-008-on-play` | onPlay | Hidden-card, positional deck, or positional Life operations |
| `IMU1-009` — St. Satchels Maffey | `IMU1-009-don-one` | continuous | Persistent, aura, or turn-condition evaluation |
| `IMU1-010` — Nerona Imu | `IMU1-010-end-of-turn` | endOfTurn | Hidden-card, positional deck, or positional Life operations |
| `IMU1-011` — Omen | `IMU1-011-counter` | counter | Hidden-card, positional deck, or positional Life operations |
| `IMU1-012` — There is Little Time | `IMU1-012-main` | main | Hidden-card, positional deck, or positional Life operations |
| `IMU1-012` — There is Little Time | `IMU1-012-trigger` | trigger | Additional condition, duration, cost, or target-flow support |
| `IMU1-013` — A Magic Circle?!! | `IMU1-013-main` | main | Hidden-card, positional deck, or positional Life operations |
| `JK01-001` — Hiromi Higuruma | `JK01-001-deck-rule` | continuous | Special game, deck-building, checkpoint, or win-condition rules |
| `JK01-001` — Hiromi Higuruma | `JK01-001-on-opponent-attack` | onOpponentAttack | Additional condition, duration, cost, or target-flow support |
| `JK01-002` — Evidence | `JK01-002-counter` | counter | Replacement, protection, negation, or attack redirection |
| `JK01-003` — Guilty, Confiscation | `JK01-003-counter` | counter | Replacement, protection, negation, or attack redirection |
| `JK01-004` — Guilty, Confiscation, Death Penalty!!! | `JK01-004-counter` | counter | Replacement, protection, negation, or attack redirection |
| `JK01-005` — Yeah, I did that, I'm not lying, and I won't deny it | `JK01-005-counter` | counter | Special game, deck-building, checkpoint, or win-condition rules |
| `JK01-006` — Hiromi Higuruma | `JK01-006-continuous` | continuous | Persistent, aura, or turn-condition evaluation |
| `JK01-006` — Hiromi Higuruma | `JK01-006-when-attacking` | whenAttacking | Additional condition, duration, cost, or target-flow support |
| `JK01-007` — Yuji Itadori | `JK01-007-on-play` | onPlay | Hidden-card, positional deck, or positional Life operations |
| `JK01-008` — Yuta Okkotsu | `JK01-008-continuous` | continuous | Replacement, protection, negation, or attack redirection |
| `JK01-009` — Takako Uro | `JK01-009-continuous` | continuous | Replacement, protection, negation, or attack redirection |
| `JK01-009` — Takako Uro | `JK01-009-on-opponent-attack` | onOpponentAttack | Additional condition, duration, cost, or target-flow support |
| `JK01-010` — Hajime Kashimo | `JK01-010-on-play` | continuous | Persistent, aura, or turn-condition evaluation |
| `JK01-011` — Deadly Sentencing | `JK01-011-activate-main` | activateMain | Hidden-card, positional deck, or positional Life operations |
| `JK01-011` — Deadly Sentencing | `JK01-011-on-ko` | onKO | Additional condition, duration, cost, or target-flow support |
| `JK01-012` — Ryomen Sukuna | `JK01-012-on-play` | onPlay | Additional condition, duration, cost, or target-flow support |
| `JK02-001` — Hanami | `JK02-001-deck-rule` | continuous | Persistent, aura, or turn-condition evaluation |
| `JK02-002` — Domain amplification | `JK02-002-on-play` | onPlay | Additional condition, duration, cost, or target-flow support |
| `JK02-003` — Cursed energy absorption | `JK02-003-on-play` | onPlay | Additional condition, duration, cost, or target-flow support |
| `JK02-004` — Wooden Ball | `JK02-004-main` | main | Branching choices, copied effects, or invoking another effect |
| `JK02-005` — Cursed Buds | `JK02-005-main` | main | Additional condition, duration, cost, or target-flow support |
| `JK02-006` — Domain Expansion!! | `JK02-006-main` | main | Dynamic values, bulk operations, or reusing a selected target |
| `JK02-007` — Flower Field | `JK02-007-main` | main | Replacement, protection, negation, or attack redirection |
| `JK02-014` — Smallpox curse | `JK02-014-on-play` | onPlay | Additional condition, duration, cost, or target-flow support |
| `JK02-014` — Smallpox curse | `JK02-014-protection` | continuous | Replacement, protection, negation, or attack redirection |
| `JK02-015` — Mahito | `JK02-015-on-play` | onPlay | Dynamic values, bulk operations, or reusing a selected target |
| `JK02-015` — Mahito | `JK02-015-protection` | continuous | Replacement, protection, negation, or attack redirection |
| `JK02-016` — Jogo | `JK02-016-activate-main` | activateMain | Dynamic values, bulk operations, or reusing a selected target |
| `JK02-016` — Jogo | `JK02-016-when-attacking` | whenAttacking | Attaching DON!! directly from the rested Cost Area |
| `JK02-018` — Grasshopper curse | `JK02-018-activate-main` | activateMain | Additional condition, duration, cost, or target-flow support |
| `JK02-020` — kurourushi | `JK02-020-cost-reduction` | continuous | Persistent, aura, or turn-condition evaluation |
| `JK02-021` — Dagon small | `JK02-021-on-play` | onPlay | Hidden-card, positional deck, or positional Life operations |
| `KIL1-001` — Killer | `KIL1-001-activate-main` | activateMain | Attaching DON!! directly from the rested Cost Area |
| `KIL1-001` — Killer | `KIL1-001-on-opponent-attack` | onOpponentAttack | Hidden-card, positional deck, or positional Life operations |
| `KIL1-003` — Reck | `KIL1-003-activate-main` | activateMain | Hidden-card, positional deck, or positional Life operations |
| `KIL1-004` — Pomp | `KIL1-004-activate-main` | activateMain | Hidden-card, positional deck, or positional Life operations |
| `KIL1-005` — Boogie | `KIL1-005-activate-main` | activateMain | Hidden-card, positional deck, or positional Life operations |
| `KIL1-006` — UK | `KIL1-006-on-play` | onPlay | Hidden-card, positional deck, or positional Life operations |
| `KIL1-006` — UK | `KIL1-006-trigger` | trigger | Hidden-card, positional deck, or positional Life operations |
| `KIL1-007` — Bubblegum | `KIL1-007-custom` | custom | Persistent, aura, or turn-condition evaluation |
| `KIL1-008` — Gig | `KIL1-008-don-two` | continuous | Persistent, aura, or turn-condition evaluation |
| `KIL1-008` — Gig | `KIL1-008-trigger` | trigger | Hidden-card, positional deck, or positional Life operations |
| `KIL1-009` — Heat | `KIL1-009-activate-main` | activateMain | Replacement, protection, negation, or attack redirection |
| `KIL1-011` — Eustass \"Captain\" Kid | `KIL1-011-on-play` | onPlay | Hidden-card, positional deck, or positional Life operations |
| `KIL1-012` — Killer | `KIL1-012-when-attacked` | whenAttacked | Hidden-card, positional deck, or positional Life operations |
| `KIL1-014` — Kid Has No Left Arm!!! | `KIL1-014-counter` | counter | Additional condition, duration, cost, or target-flow support |
| `KIL1-014` — Kid Has No Left Arm!!! | `KIL1-014-main` | main | Hidden-card, positional deck, or positional Life operations |
| `OP06-107` — Kouzuki Momonosuke | `OP06-107-on-play-life` | onPlay | Hidden-card, positional deck, or positional Life operations |
| `OP13-104` — Kouzuki Hiyori | `OP13-104-on-ko-add-life` | onKO | Hidden-card, positional deck, or positional Life operations |
| `OP14-005` — Killer | `OP14-005-activate-main` | activateMain | Attaching DON!! directly from the rested Cost Area |
| `OP16-082` — Kin'emon | `OP16-082-plus-cost` | continuous | Persistent, aura, or turn-condition evaluation |
| `OP16-099` — I've Come Here... To Cut Those Chains!!! | `OP16-099-main` | main | Hidden-card, positional deck, or positional Life operations |
| `POG1-001` — David Taglavnovič | `POG1-001-start-of-turn-search` | startOfTurn | Hidden-card, positional deck, or positional Life operations |
| `POG1-002` — Parfum | `POG1-002-on-play-mark-character` | onPlay | Dynamic values, bulk operations, or reusing a selected target |
| `POG1-003` — Mr. JeremiÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ | `POG1-003-on-play` | onPlay | Branching choices, copied effects, or invoking another effect |
| `POG1-005` — Dejan Sigma | `POG1-005-on-opponent-attack` | onOpponentAttack | Hidden-card, positional deck, or positional Life operations |
| `POG1-005` — Dejan Sigma | `POG1-005-when-attacking` | whenAttacking | Hidden-card, positional deck, or positional Life operations |
| `POG1-006` — David TaglavnoviÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚Â | `POG1-006-activate-main` | activateMain | Additional condition, duration, cost, or target-flow support |
| `POG1-007` — Johan JohanoviÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ | `POG1-007-on-play` | onPlay | Hidden-card, positional deck, or positional Life operations |
| `POG1-009` — Bingo | `POG1-009-main` | main | Branching choices, copied effects, or invoking another effect |
| `POG1-011` — Banana Onemoglosti | `POG1-011-main` | main | Replacement, protection, negation, or attack redirection |
| `POG1-012` — B.R.A.N.K.O. | `POG1-012-continuous` | continuous | Replacement, protection, negation, or attack redirection |
| `PRB02-016` — Otama | `PRB02-016-activate-main-power` | activateMain | Hidden-card, positional deck, or positional Life operations |
| `ST28-004` — Kouzuki Momonosuke | `ST28-004-your-turn-leader-power` | yourTurn | Persistent, aura, or turn-condition evaluation |
| `ST28-005` — Yamato | `ST28-005-your-turn-power` | yourTurn | Persistent, aura, or turn-condition evaluation |
| `SUB1-001` — Subaru Natsuki | `SUB1-001-checkpoint` | activateMain | Special game, deck-building, checkpoint, or win-condition rules |
| `SUB1-001` — Subaru Natsuki | `SUB1-001-when-attacking-power` | whenAttacking | Additional condition, duration, cost, or target-flow support |
| `SUB1-003` — Ram | `SUB1-003-continuous-rem-buff` | continuous | Replacement, protection, negation, or attack redirection |
| `SUB1-004` — Elsa | `SUB1-004-on-play-rush` | onPlay | Hidden-card, positional deck, or positional Life operations |
| `SUB1-007` — Echidna | `SUB1-007-activate-main-stage-copy` | activateMain | Branching choices, copied effects, or invoking another effect |
| `SUB1-007` — Echidna | `SUB1-007-on-play-stage-copy` | onPlay | Branching choices, copied effects, or invoking another effect |
| `SUB1-008` — Return by death | `SUB1-008-on-play-checkpoint` | onPlay | Special game, deck-building, checkpoint, or win-condition rules |
| `SUB1-009` — Elsa | `SUB1-009-when-attacking-life-power` | whenAttacking | Hidden-card, positional deck, or positional Life operations |
| `SUB1-012` — Puck | `SUB1-012-on-play-search-emilia` | onPlay | Hidden-card, positional deck, or positional Life operations |
| `YAM1-001` — Ace & Yamato | `YAM1-001-on-character-play-draw` | onCharacterPlay | Additional condition, duration, cost, or target-flow support |
| `YAM1-003` — I Want To Live As Free As Oden Did!!! | `YAM1-003-counter` | counter | Additional condition, duration, cost, or target-flow support |
| `YAM1-003` — I Want To Live As Free As Oden Did!!! | `YAM1-003-main` | main | Additional condition, duration, cost, or target-flow support |
| `YAM1-004` — Wano Country | `YAM1-004-activate-main-attach-don` | activateMain | Attaching DON!! directly from the rested Cost Area |
| `YAM1-004` — Wano Country | `YAM1-004-your-turn-power` | yourTurn | Persistent, aura, or turn-condition evaluation |

## Unsupported printed keywords

None. Rush, Rush: Characters, Blocker, Unblockable, Banish, and Double Attack are implemented.
