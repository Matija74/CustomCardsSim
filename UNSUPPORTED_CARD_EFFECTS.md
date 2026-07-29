# Unsupported Card Effects

Generated from the current JSON card definitions, the card-effect registry, and the same compiler used by `js/cards/cardDatabase.js`.

Regenerate this file after each activator batch with:

```powershell
node scripts/generateUnsupportedEffects.mjs
```

## Audit summary

- Saved cards checked: **171**
- Saved effect records checked: **267**
- Executable effect records: **23**
- Unsupported effect records: **244** across **156 cards**
- Unsupported printed keyword entries: **12**
- Cards with every declared effect executable: **11**
- Cards containing both working and unsupported effects: **9**
- Cards with no declared effects: **4**

An effect is counted as executable only when its timing maps to the current activator layer, it has a non-empty compiled `actions` array, and every action name is registered. This is a static executable check, not proof that every possible rules interaction has been exhaustively tested.

Continuous, replacement, and persistent turn-condition effects are included below because they require rules evaluators rather than activator buttons. Printed keywords are audited separately after the effect table.

## Unsupported effects by type

| Type | Count |
|---|---:|
| onPlay | 46 |
| continuous | 34 |
| activateMain | 30 |
| main | 25 |
| trigger | 25 |
| counter | 22 |
| whenAttacking | 21 |
| onKO | 10 |
| replacement | 7 |
| onOpponentAttack | 5 |
| endOfTurn | 4 |
| yourTurn | 3 |
| opponentsTurn | 2 |
| custom | 1 |
| endOfYourTurn | 1 |
| gameStart | 1 |
| onBlock | 1 |
| onCharacterPlay | 1 |
| onOpponentDealsDamage | 1 |
| onOpponentsAttack | 1 |
| startOfTurn | 1 |
| whenAttacked | 1 |
| whenTrashedFromDeck | 1 |

## Cards whose declared effects are currently executable

BK01-009 - Serpico; BK01-012 - Farnese de Vandimion; BK01-014 - Guts; BL01-007 - Inoue Orihime; BL01-015 - Ganju Shiba; DD01-003 - Ayase Seiko; DD01-005 - We'll kill all of ya.; DD01-008 - Ayase Momo; EGG1-003 - Motobug; EGG1-011 - Eggrobo; SUB1-006 - Subaru Natsuki

## Cards with a mixture of working and unsupported effects

BK01-003 - Isma; IMU1-003 - Cerberus; IMU1-009 - St. Satchels Maffey; JK02-012 - Stingray curse; KIL1-002 - Dive; OP14-089 - Ryuma; OP16-098 - Yamato; ST28-005 - Yamato; YAM1-005 - Kouzuki Momonosuke

## Executable effect records excluded from the unsupported table

| Card ID | Name | Effect ID | Activator | Registered actions |
|---|---|---|---|---|
| BK01-003 | Isma | BK01-003-on-play-search | onPlay | search, returnRest |
| BK01-009 | Serpico | BK01-009-on-play-ko-cost-five | onPlay | cardKO |
| BK01-012 | Farnese de Vandimion | BK01-012-on-play-minus-cost | onPlay | decreaseCost |
| BK01-014 | Guts | BK01-014-on-play-ko-each | onPlay | cardKO, cardKO |
| BL01-007 | Inoue Orihime | BL01-007-on-play-human-search | onPlay | search, returnRest |
| BL01-015 | Ganju Shiba | BL01-015-on-play-draw | onPlay | drawCard |
| BL01-015 | Ganju Shiba | BL01-015-trigger | trigger | playCard |
| DD01-003 | Ayase Seiko | DD01-003-on-play | onPlay | search, returnRest |
| DD01-005 | We'll kill all of ya. | DD01-005-main | activateMain | search, returnRest |
| DD01-005 | We'll kill all of ya. | DD01-005-trigger | trigger | search, returnRest |
| DD01-008 | Ayase Momo | DD01-008-on-ko-draw | onKO | drawCard |
| DD01-008 | Ayase Momo | DD01-008-on-play-add-don | onPlay | addDon |
| EGG1-003 | Motobug | EGG1-003-on-play-draw | onPlay | drawCard |
| EGG1-011 | Eggrobo | EGG1-011-on-play-draw | onPlay | drawCard |
| IMU1-003 | Cerberus | IMU1-003-on-play | onPlay | increasePower |
| IMU1-009 | St. Satchels Maffey | IMU1-009-on-play | onPlay | search, returnRest |
| JK02-012 | Stingray curse | JK02-012-on-play | onPlay | decreaseCost |
| KIL1-002 | Dive | KIL1-002-on-play-search | onPlay | search, trashRest |
| OP14-089 | Ryuma | OP14-089-on-ko-draw-trash | onKO | drawCard, trashCard |
| OP16-098 | Yamato | OP16-098-on-play-draw-trash | onPlay | drawCard, trashCard |
| ST28-005 | Yamato | ST28-005-on-play-search | onPlay | search, returnRest |
| SUB1-006 | Subaru Natsuki | SUB1-006-on-play-search | onPlay | search, returnRest |
| YAM1-005 | Kouzuki Momonosuke | YAM1-005-on-play-draw | onPlay | trashCard, drawCard |

## Unsupported effect records

| Card ID | Name | Effect ID | Type | Effect text | Current missing behavior |
|---|---|---|---|---|---|
| BK01-001 | Guts | BK01-001-removed-character-power | continuous | DON!! x1: When one of your opponent's Characters is removed from the field, give this Leader +1000 power until the end of your next turn. | No continuous-effect evaluator is implemented; this is not an activator. |
| BK01-002 | Get that... to the Black Swordsman | BK01-002-main | main | Main: Give up to 1 of your [Guts] or [Skull Knight] Characters +5000 power for this turn. When that Character attacks, your opponent cannot activate Blocker during this battle, then add the top of your Life cards to your hand. | Activator activateMain is supported, but this effect has no executable actions. |
| BK01-002 | Get that... to the Black Swordsman | BK01-002-trigger | trigger | Trigger: Give 1 of your leaders +1000 power until the end of the turn. | Activator trigger is supported, but this effect has no executable actions. |
| BK01-003 | Isma | BK01-003-on-opponent-attack-draw | onOpponentAttack | On Your Opponent's Attack: You may trash this Character; draw 1 card. | Activator onOpponentAttack is supported, but actionId trashThisDrawOne has no executable compiler mapping. |
| BK01-004 | Puck | BK01-004-on-play-minus-cost | onPlay | On Play: If you have a [Guts] Character in play; give up to one of your opponent's Characters -1 cost for this turn. | Activator onPlay is supported, but this effect has no executable actions. |
| BK01-005 | Puck | BK01-005-activate-main-give-don | activateMain | Activate: Main Once Per Turn: Give up to 1 rested DON!! card to your Leader or 1 of your Characters. | Activator activateMain is supported, but this effect has no executable actions. |
| BK01-006 | Schierke | BK01-006-activate-main-protect-guts | activateMain | Activate: Main: Up to 1 of your [Guts] Characters cannot be removed from play by your opponent's effects until the start of your next turn. | Activator activateMain is supported, but this effect has no executable actions. |
| BK01-007 | Ishidro | BK01-007-guts-base-power | continuous | If you have a [Guts] Character in play, this character gains a base power of 6000. | No continuous-effect evaluator is implemented; this is not an activator. |
| BK01-007 | Ishidro | BK01-007-on-play-give-don | onPlay | On Play: Give your Leader or up to 1 Character 1 rested DON!! | Activator onPlay is supported, but this effect has no executable actions. |
| BK01-008 | Ishidro | BK01-008-activate-main-minus-cost-rest | activateMain | Activate: Main: Give up to 1 of your opponent's Characters -2 cost during this turn then, rest this Character. | Activator activateMain is supported, but this effect has no executable actions. |
| BK01-010 | Serpico | BK01-010-farnese-power | continuous | Give all of your [Farnese] Characters +2000 power. | No continuous-effect evaluator is implemented; this is not an activator. |
| BK01-010 | Serpico | BK01-010-on-play-rush | onPlay | On Play: If you have a [Farnese] Character in play, this Character gains Rush. | Activator onPlay is supported, but this effect has no executable actions. |
| BK01-011 | ...Indeed It Was Like a Heap of Raw Iron. | BK01-011-main | main | Main: Give up to 1 of your opponent's characters -2 cost until the end of this turn. Then, K.O. up to 1 of your opponent's Characters with a cost of 5 or less. | Activator activateMain is supported, but this effect has no executable actions. |
| BK01-013 | Guts | BK01-013-guts-double-attack | continuous | If your leader is [Guts] this Character gains Double Attack. | No continuous-effect evaluator is implemented; this is not an activator. |
| BK01-013 | Guts | BK01-013-on-play-give-don | onPlay | On Play: If your leader is [Guts] give your leader up to 1 rested DON!! | Activator onPlay is supported, but this effect has no executable actions. |
| BK01-015 | Artificial Arm Huh? It's Groovy. | BK01-015-main | main | Main: If your leader is [Guts], give your leader up to 1 rested DON!! Then, K.O. one of your opponent's Characters with a cost of 3 or less. | Activator activateMain is supported, but this effect has no executable actions. |
| BK01-016 | Guts | BK01-016-guts-rush-leader-power | continuous | If your leader is [Guts] give your leader +1000 power and this Character gains Rush. | No continuous-effect evaluator is implemented; this is not an activator. |
| BK01-016 | Guts | BK01-016-on-play-give-don | onPlay | On Play: If your leader is [Guts] give your leader up to 1 rested DON!! | Activator onPlay is supported, but this effect has no executable actions. |
| BL01-001 | Kurosaki Ichigo | BL01-001-damage-upgrade-zangetsu | onOpponentDealsDamage | Once Per Turn: If your Opponent deals damage, play up to 1 [Zangetsu] stage with a cost higher than the current one, by 1 from your deck. Then, shuffle your deck. | Activator onOpponentDealsDamage is supported, but this effect has no executable actions. |
| BL01-001 | Kurosaki Ichigo | BL01-001-starting-zangetsu | gameStart | Under the rules of the game, you may play up to 1 cost 1 [Zangetsu] Stage card at the beginning of the game. | Activator gameStart is supported, but this effect has no executable actions. |
| BL01-002 | Zangetsu: Sealed | BL01-002-ichigo-base-power | continuous | If your leader is [Kurosaki Ichigo], up to one of your Leaders gains a base power of 4000. | No continuous-effect evaluator is implemented; this is not an activator. |
| BL01-002 | Zangetsu: Sealed | BL01-002-stage-removal-replace | replacement | Once Per Turn: If this stage would be removed by your Opponent's effects, you may give up to one of your Leaders -1000 power during this turn. | No replacement-effect interception is implemented; this is not an activator. |
| BL01-003 | Zangetsu: Shikai | BL01-003-ichigo-base-power | continuous | If your leader is [Kurosaki Ichigo], up to one of your Leaders gains a base power of 5000. | No continuous-effect evaluator is implemented; this is not an activator. |
| BL01-003 | Zangetsu: Shikai | BL01-003-stage-removal-replace | replacement | Once Per Turn: If this stage would be removed by your Opponent's effects, you may give up to one of your Leaders -1000 power during this turn. | No replacement-effect interception is implemented; this is not an activator. |
| BL01-004 | Bankai: Tensa Zangetsu | BL01-004-ichigo-base-power | continuous | If your leader is [Kurosaki Ichigo], up to one of your Leaders gains a base power of 6000. | No continuous-effect evaluator is implemented; this is not an activator. |
| BL01-004 | Bankai: Tensa Zangetsu | BL01-004-stage-removal-replace | replacement | Once Per Turn: If this stage would be removed by your Opponent's effects, you may give up to one of your Leaders -1000 power during this turn. | No replacement-effect interception is implemented; this is not an activator. |
| BL01-005 | Tensa Zangetsu: Visored | BL01-005-ichigo-base-power | continuous | If your leader is [Kurosaki Ichigo], up to one of your Leaders gains a base power of 7000. | No continuous-effect evaluator is implemented; this is not an activator. |
| BL01-005 | Tensa Zangetsu: Visored | BL01-005-stage-removal-replace | replacement | Once Per Turn: If this stage would be removed by your Opponent's effects, you may give up to one of your Leaders -1000 power during this turn. | No replacement-effect interception is implemented; this is not an activator. |
| BL01-006 | Getsuga Tensho | BL01-006-main | main | Main: If your leader is [Kurosaki Ichigo], give all of your Characters and up to one of your Leader +5000 power. Then, your Leader gains Unblockable during this turn. If you do not win the game until the end of this turn, you lose the game. | Activator activateMain is supported, but this effect has no executable actions. |
| BL01-008 | Uryu Ishida | BL01-008-life-flip-replace | replacement | Once Per Turn: If one of your Characters would be removed by your Opponent's effects, you may flip the top card of your life cards face up instead. | No replacement-effect interception is implemented; this is not an activator. |
| BL01-009 | Kisuke Urahara | BL01-009-on-play-getsuga-search | onPlay | On Play: If your leader is [Kurosaki Ichigo]; reveal up to 1 [Getsuga Tensho] event card from your deck and put it in your hand. Then, shuffle your deck. | Activator onPlay is supported, but this effect has no executable actions. |
| BL01-009 | Kisuke Urahara | BL01-009-when-attacking-ichigo-power | whenAttacking | When Attacking: Give up to 1 of your [Kurosaki Ichigo] +1000 power for this turn. | Activator whenAttacking is supported, but this effect has no executable actions. |
| BL01-010 | Mr. Yoruichi | BL01-010-trigger | trigger | Trigger: Play this card. | Activator trigger is supported, but actionId playThisCardFromTrigger has no executable compiler mapping. |
| BL01-011 | Yoruichi Shihoin | BL01-011-when-attacking-don-power | whenAttacking | When Attacking: DON!! x1: This Character gains +3000 power during this turn. | Activator whenAttacking is supported, but this effect has no executable actions. |
| BL01-012 | Kurosaki Ichigo | BL01-012-stage-cost-power | continuous | This Character gains +1000 power for every cost number of your stage. | No continuous-effect evaluator is implemented; this is not an activator. |
| BL01-013 | Yasutora Sado (Chad) | BL01-013-on-block-minus-power | onBlock | On Block: Give up to 1 of your Opponent's Characters -1000 power during this turn. | Activator onBlock is supported, but this effect has no executable actions. |
| BL01-014 | Uryu Ishida | BL01-014-ichigo-character-power | continuous | If you have a [Kurosaki Ichigo] Character in play, this Character gains +1000 power. | No continuous-effect evaluator is implemented; this is not an activator. |
| BL01-014 | Uryu Ishida | BL01-014-when-attacking-minus-ko | whenAttacking | When Attacking: Give up to one of your Opponent's Characters -1000 power and K.O. up to 1 of your Opponent's Characters with a power of 4000 or less. | Activator whenAttacking is supported, but this effect has no executable actions. |
| BL01-016 | Santen Kesshun | BL01-016-counter | counter | Counter: Up to 1 of your Leader or Character cards gains +2000 power during this battle. Then, if you have 2 or less Life cards, that card gains an additional +2000 power. | Activator counter is supported, but actionId santenKesshunCounterPower has no executable compiler mapping. |
| BL01-016 | Santen Kesshun | BL01-016-trigger | trigger | Trigger: Up to 1 of your Leader or Character cards gains +1000 power during this turn. | Activator trigger is supported, but actionId leaderOrCharacterTriggerPower has no executable compiler mapping. |
| BL01-017 | Soten Kisshun | BL01-017-counter | counter | Counter: Your Leader gains +3000 power during this battle. | Activator counter is supported, but actionId leaderCounterPower has no executable compiler mapping. |
| BL01-017 | Soten Kisshun | BL01-017-main | main | Main: You may rest 7 of your DON!! cards: If your Leader is [Kurosaki Ichigo], place up to 1 card from the top of your deck to the top of your life cards. | Activator activateMain is supported, but this effect has no executable actions. |
| DD01-001 | Takakura Ken | DD01-001-name-okarun | continuous | Also treat this card's name as [Okarun]. | No continuous-effect evaluator is implemented; this is not an activator. |
| DD01-001 | Takakura Ken | DD01-001-when-attacking-active | whenAttacking | When Attacking Once Per Turn: If you have a [Turbo Granny Form] stage in play, set this leader as active. | Activator whenAttacking is supported, but this effect has no executable actions. |
| DD01-002 | Turbo Granny Form | DD01-002-end-of-turn-refresh-limit | endOfTurn | End Of Turn: If your Leader attacked twice this turn, it will not become active during your next refresh phase. | Activator endOfTurn is supported, but this effect has no executable actions. |
| DD01-002 | Turbo Granny Form | DD01-002-your-turn-power | continuous | Permanent: Your Leader and Characters with the name [Okarun] gain +2000 power. | No continuous-effect evaluator is implemented; this is not an activator. |
| DD01-004 | If you lose the race against Turbo Granny... | DD01-004-main | main | Main: If you have 5 or more DON!! cards on your field, play up to one [Turbo Granny Form] stage card from your deck. Then, shuffle your deck. | Activator activateMain is supported, but this effect has no executable actions. |
| DD01-004 | If you lose the race against Turbo Granny... | DD01-004-trigger | trigger | Trigger: Activate this card's Main effect. | Activator trigger is supported, but actionId activateMainEffect has no executable compiler mapping. |
| DD01-006 | Takakura Ken | DD01-006-name-okarun | continuous | Also treat this card's name as [Okarun]. | No continuous-effect evaluator is implemented; this is not an activator. |
| DD01-006 | Takakura Ken | DD01-006-when-attacking-active | whenAttacking | When Attacking Once Per Turn: If you have a [Turbo Granny Form] stage card in play, set this character as active. | Activator whenAttacking is supported, but this effect has no executable actions. |
| DD01-007 | Unji Zuma | DD01-007-when-attacking-refresh-don | whenAttacking | When Attacking: You may set up to 2 of your DON!! cards as active. | Activator whenAttacking is supported, but this effect has no executable actions. |
| DD01-009 | Sakata Kinta | DD01-009-on-play-rest-character | onPlay | On Play: Rest up to 1 of your opponent's characters with a cost of 4 or less. | Activator onPlay is supported, but this effect has no executable actions. |
| DD01-010 | Evil Eye | DD01-010-when-attacking-unblockable | whenAttacking | When Attacking: DON!! -1: This character gains Unblockable until the end of this turn. | Activator whenAttacking is supported, but this effect has no executable actions. |
| DD01-011 | If its for Momo-chan, I can go All-out! | DD01-011-main | main | Main: Take 1 damage: Set 1 of your [Okarun] cards as active. | Activator activateMain is supported, but this effect has no executable actions. |
| DD01-011 | If its for Momo-chan, I can go All-out! | DD01-011-trigger | trigger | Trigger: Set 1 of your [Okarun] cards as active. | Activator trigger is supported, but this effect has no executable actions. |
| DD01-012 | Vamola | DD01-012-on-ko-add-don | onKO | On K.O.: Add up to 1 DON!! card from your DON!! deck and set it as active. | Activator onKO is supported, but this effect has no executable actions. |
| DD01-012 | Vamola | DD01-012-play-choice | onPlay | When you play this character, choose whether it will gain Blocker or Rush. | Activator onPlay is supported, but this effect has no executable actions. |
| DD01-013 | The Power of Words! | DD01-013-counter | counter | Counter: If your leader is rested, give your leader or 1 of your {Dandadan} type characters +3000 power during this battle. | Activator counter is supported, but this effect has no executable actions. |
| DD01-013 | The Power of Words! | DD01-013-main | main | Main: You may rest 3 of your DON!! cards: give up to one of your {Dandadan} type characters +4000 power for 1 battle. That character also gains Unblockable for that battle. | Activator activateMain is supported, but this effect has no executable actions. |
| DD01-015 | Turbo Granny | DD01-015-activate-main-power | activateMain | Activate: Main Once Per Turn: You may rest this character: Give up to 1 of your [Ayase Seiko] or [Okarun] +3000 power for 1 battle. | Activator activateMain is supported, but this effect has no executable actions. |
| DD01-016 | Enjoji Jin | DD01-016-name-jiji | continuous | Also treat this card's name as [Jiji]. | No continuous-effect evaluator is implemented; this is not an activator. |
| DD01-016 | Enjoji Jin | DD01-016-opponents-turn-event-counter | opponentsTurn | Opponent's Turn: If your Leader is rested, all your Events in hand gain +1000 counter. | No persistent turn-condition evaluator is implemented; this is not an activator. |
| DD01-017 | Shiratori Aira | DD01-017-when-attacking-ko-blocker | whenAttacking | When Attacking Once Per Turn: DON!! -1: K.O. up to 1 of your opponent's cost 5 or lower Blocker characters. Your opponent cannot protect that character with anti-K.O. effects. | Activator whenAttacking is supported, but this effect has no executable actions. |
| EB03-057 | Yamato | EB03-057-on-ko-trash-life | onKO | On K.O.: Trash up to 1 card from the top of your opponent's Life cards. | Activator onKO is supported, but this effect has no executable actions. |
| EB03-057 | Yamato | EB03-057-on-play-don | onPlay | On Play: Give up to 3 rested DON!! cards to your {Land of Wano} type Leader. | Activator onPlay is supported, but this effect has no executable actions. |
| EGG1-001 | Eggman (Dr. Ivo Robotnik) | EGG1-001-when-attacking-power | whenAttacking | When Attacking: One of your characters with a cost of 2 or less gains +3000 power during this turn. | Activator whenAttacking is supported, but this effect has no executable actions. |
| EGG1-002 | Metal Sonic | EGG1-002-activate-main-copy | activateMain | Activate: Main Once Per Turn: Use one of your opponent's character or leader abilities. | Activator activateMain is supported, but this effect has no executable actions. |
| EGG1-005 | Eggman (Dr. Ivo Robotnik) | EGG1-005-on-play-choice | onPlay | On Play: Choose: Play up to 1 {Eggman Empire} character with a cost of 5 or less from your trash and draw 1; or play up to 2 {Eggman Empire} characters with a cost of 2 or less from your trash and draw 1. | Activator onPlay is supported, but this effect has no executable actions. |
| EGG1-006 | Infinite | EGG1-006-activate-main-base-power | activateMain | Activate: Main Once Per Turn: One of your {Eggman Empire} type characters' base power becomes the same as one of your opponent's characters until the end of your opponent's next end phase. | Activator activateMain is supported, but this effect has no executable actions. |
| EGG1-007 | Im Pissing On The Moon!!! | EGG1-007-counter | counter | Counter: Up to 1 of your {Eggman Empire} cards gets +4000 power during this battle. | Activator counter is supported, but actionId eggmanCounterPower has no executable compiler mapping. |
| EGG1-008 | Metal Sonic | EGG1-008-activate-main-trash-power | activateMain | Activate: Main Once Per Turn: You may trash 1 of your characters: This character gains +1000 power during this turn per 1 cost on the trashed character. | Activator activateMain is supported, but this effect has no executable actions. |
| EGG1-009 | The Death Egg | EGG1-009-on-play-bounce-ko | onPlay | On Play: You may return all of your characters to your hand: K.O. all of your opponent's characters. | Activator onPlay is supported, but this effect has no executable actions. |
| EGG1-012 | Get A Load Of This! | EGG1-012-counter | counter | Counter: One of your Leader or Character cards gains +2000 power during this battle. | Activator counter is supported, but actionId leaderOrCharacterCounterPower has no executable compiler mapping. |
| EGG1-012 | Get A Load Of This! | EGG1-012-main | main | Main: You may give your leader -5000 power during this turn: Activate your leader's When Attacking ability. | Activator activateMain is supported, but this effect has no executable actions. |
| EGG1-013 | Sage | EGG1-013-opponents-turn-save | opponentsTurn | Opponent's turn Once Per Turn: If your {Eggman Empire} type character were to be removed from the field by your opponent's effects, you may trash 2 cards from your hand instead. | No persistent turn-condition evaluator is implemented; this is not an activator. |
| EGG1-014 | Chaos | EGG1-014-on-play-freeze | onPlay | On Play: Up to 2 of your opponent's characters with a cost of 7 or less cannot attack until your opponent's next end phase. | Activator onPlay is supported, but this effect has no executable actions. |
| IMU1-001 | Nerona Imu | IMU1-001-deck-rule | continuous | Under the rules of this game, your deck consists of 40 cards and you cannot return cards from your trash to your deck by effects. | No continuous-effect evaluator is implemented; this is not an activator. |
| IMU1-001 | Nerona Imu | IMU1-001-when-attacking | whenAttacking | When Attacking: You may trash 1 card from the top of your deck: Up to 1 of your {Holy Knight} type Characters gains Rush and +1000 power until the end of your opponent's next End Phase. | Activator whenAttacking is supported, but this effect has no executable actions. |
| IMU1-002 | St. Sheperd Sommers | IMU1-002-on-ko-in-combat | onKO | If this Character is K.O.'d in combat, you may trash 1 card from the top of your deck: Give the attacking card -2000 power until the end of your next turn. | Activator onKO is supported, but this effect has no executable actions. |
| IMU1-003 | Cerberus | IMU1-003-when-attacking | whenAttacking | When Attacking: Give up to 1 of your opponent's Leaders or Characters -1000 power during this turn. | Activator whenAttacking is supported, but this effect has no executable actions. |
| IMU1-004 | Harald | IMU1-004-on-ko | onKO | On K.O.: Trash 3 cards from the top of your deck. | Activator onKO is supported, but this effect has no executable actions. |
| IMU1-004 | Harald | IMU1-004-when-attacking | whenAttacking | When Attacking: Trash 1 card from the top of your deck. | Activator whenAttacking is supported, but this effect has no executable actions. |
| IMU1-005 | St. Figarland Garling | IMU1-005-on-play | onPlay | On Play: Play up to 1 [Mary Geoise] from your hand or trash. | Activator onPlay is supported, but this effect has no executable actions. |
| IMU1-005 | St. Figarland Garling | IMU1-005-stage-protection | replacement | If one of your Stage cards would be removed from the field by your opponent's effect, you may trash this Character instead. | No replacement-effect interception is implemented; this is not an activator. |
| IMU1-006 | St. Figarland Shamrock | IMU1-006-end-of-turn | endOfTurn | End of Your Turn: Place this Character on the bottom of your deck. | Activator endOfTurn is supported, but this effect has no executable actions. |
| IMU1-006 | St. Figarland Shamrock | IMU1-006-on-play | onPlay | On Play: Trash up to 1 of your opponent's Characters with a power of 8000 or less. | Activator onPlay is supported, but this effect has no executable actions. |
| IMU1-007 | St. Manmayer Gunko | IMU1-007-effect-protection | continuous | This Character cannot be K.O'd by your opponent's effects. | No continuous-effect evaluator is implemented; this is not an activator. |
| IMU1-007 | St. Manmayer Gunko | IMU1-007-on-opponents-attack | onOpponentsAttack | On Your Opponent's Attack Once Per Turn: You may trash 2 cards from the top of your deck: If your Leader is [Imu], change the target of that attack to your Leader or one of your {Holy Knight} type Characters. | Activator onOpponentAttack is supported, but this effect has no executable actions. |
| IMU1-008 | St. Rimoshifu Killingham | IMU1-008-battle-protection | replacement | If this Character would be K.O'd in combat, you may trash 2 cards from the top of your deck instead. | No replacement-effect interception is implemented; this is not an activator. |
| IMU1-008 | St. Rimoshifu Killingham | IMU1-008-on-play | onPlay | On Play: You may trash 1 card from the top of your deck: Add up to 1 {Holy Knight} or {Celestial Dragon} type Character from your trash to your hand. | Activator onPlay is supported, but this effect has no executable actions. |
| IMU1-009 | St. Satchels Maffey | IMU1-009-don-one | continuous | DON!! x1 This Character gains +1000 power. | No continuous-effect evaluator is implemented; this is not an activator. |
| IMU1-010 | Nerona Imu | IMU1-010-end-of-turn | endOfTurn | End of Your Turn: Trash 5 cards from the top of your deck. | Activator endOfTurn is supported, but this effect has no executable actions. |
| IMU1-010 | Nerona Imu | IMU1-010-when-attacking | whenAttacking | When Attacking: Set up to 1 of your {Holy Knight} type Characters as active. | Activator whenAttacking is supported, but this effect has no executable actions. |
| IMU1-011 | Omen | IMU1-011-counter | counter | Counter: You may trash 1 card from the top of your deck: If your Leader is [Imu], up to 1 of your Leader or Character cards gains +2000 power until the end of your next End Phase. | Activator counter is supported, but this effect has no executable actions. |
| IMU1-011 | Omen | IMU1-011-main | main | Main: You may rest 2 of your DON!! cards: Trash up to 1 of your opponent's Characters with 5000 power or less. | Activator activateMain is supported, but this effect has no executable actions. |
| IMU1-012 | There is Little Time | IMU1-012-main | main | Main: You may trash 1 card from the top of your deck: Up to 1 of your [IMU] Leaders or {Holy Knight} type Characters gains Banish during this turn. Then, draw 1 card. | Activator activateMain is supported, but this effect has no executable actions. |
| IMU1-012 | There is Little Time | IMU1-012-trigger | trigger | Trigger: Up to 1 of your Leader or Character cards gains +1000 power until the end of your next turn. | Activator trigger is supported, but this effect has no executable actions. |
| IMU1-013 | A Magic Circle?!! | IMU1-013-main | main | Main: You may trash 2 cards from the top of your deck: Play up to 1 {Holy Knight} type Character with a cost of 6 or less from your trash. Then, draw 1 card. | Activator activateMain is supported, but this effect has no executable actions. |
| IMU1-013 | A Magic Circle?!! | IMU1-013-trigger | trigger | Trigger: Add up to 1 {Holy Knight} type card from your trash to your hand. | Activator trigger is supported, but this effect has no executable actions. |
| JK01-001 | Hiromi Higuruma | JK01-001-deck-rule | continuous | Under the rules of this game, you can have up to 6 copies of any "Deadly Sentencing" type event cards in your deck. Additionally, if you have 7 or less DON!! cards in your field, you cannot activate event cards that are cost 7 or higher from your trash. | No continuous-effect evaluator is implemented; this is not an activator. |
| JK01-001 | Hiromi Higuruma | JK01-001-on-opponent-attack | onOpponentAttack | On Your Opponent's Attack Twice Per Turn: Activate an event card with a Counter from your trash. Then, draw 1 trash 1. | Activator onOpponentAttack is supported, but this effect has no executable actions. |
| JK01-002 | Evidence | JK01-002-counter | counter | Counter: If your opponent's attack is 7000 power or lower, you may negate it. If you did, reveal the top card of your life, if it is either "Culling Game Participant" or "Deadly Sentencing" type, you may either add it to your hand, or draw 1 from the top or bottom of your deck. Then, flip the top card of your life down. | Activator counter is supported, but this effect has no executable actions. |
| JK01-003 | Guilty, Confiscation | JK01-003-counter | counter | Counter: If your opponent's attack is 7000 power or lower, you may negate it. If you did, K.O your own stage card, then negate one of your opponent character's effect. | Activator counter is supported, but this effect has no executable actions. |
| JK01-004 | Guilty, Confiscation, Death Penalty!!! | JK01-004-counter | counter | Counter: If your opponent's attack is 10000 power or lower, you may negate it. If you did, If you have 3 or less life cards in your life area, your leader's base power becomes 9000 and gains Double Attack until the end of your next turn. | Activator counter is supported, but this effect has no executable actions. |
| JK01-005 | Yeah, I did that, I'm not lying, and I won't deny it | JK01-005-counter | counter | Counter: If your opponent's attack is 12000 power or lower, you may negate it. If you did, you may rest 10 of your DON!! cards. If you have 2 or less life cards in your life area, your leader's base power becomes 9000, and gains Double Attack and Banish. Additionally, if your opponent's life hits 0 during this turn, you win the game. | Activator counter is supported, but this effect has no executable actions. |
| JK01-006 | Hiromi Higuruma | JK01-006-continuous | continuous | If you have no stage cards on your stage field, give your leader +1000 power, and this character gains Rush. | No continuous-effect evaluator is implemented; this is not an activator. |
| JK01-006 | Hiromi Higuruma | JK01-006-when-attacking | whenAttacking | When Attacking: When this character deals damage to your opponent's leader, your opponent puts all their life cards to their hand. | Activator whenAttacking is supported, but this effect has no executable actions. |
| JK01-007 | Yuji Itadori | JK01-007-on-play | onPlay | On Play: If your leader is [Hiromi Higuruma], trash the top 5 cards of your deck. | Activator onPlay is supported, but this effect has no executable actions. |
| JK01-007 | Yuji Itadori | JK01-007-when-attacking | whenAttacking | When Attacking Once Per Turn: Place a [Hiromi Higuruma] card from your trash to your hand. | Activator whenAttacking is supported, but this effect has no executable actions. |
| JK01-008 | Yuta Okkotsu | JK01-008-continuous | continuous | If your leader either has "Culling Game Participant" or "Jujutsu High" type, this character cannot be removed from the field or rested by your opponent's effects and gains +2000 power. | No continuous-effect evaluator is implemented; this is not an activator. |
| JK01-009 | Takako Uro | JK01-009-continuous | continuous | If your leader either has "Culling Game Participant" type, this character cannot be removed from the field or rested by your opponent's effects and gains +2000 power. | No continuous-effect evaluator is implemented; this is not an activator. |
| JK01-009 | Takako Uro | JK01-009-on-opponent-attack | onOpponentAttack | When your opponent attacks your leader, you may activate an event card's Counter from your hand that has the base cost of 6 or less. | Activator onOpponentAttack is supported, but this effect has no executable actions. |
| JK01-010 | Hajime Kashimo | JK01-010-on-play | continuous | If you have taken any life cards from your life area, draw 2 trash 2. | No continuous-effect evaluator is implemented; this is not an activator. |
| JK01-011 | Deadly Sentencing | JK01-011-activate-main | activateMain | Activate: Main: You may rest this stage If your leader is [Hiromi Higuruma] trash the top 2 cards of your deck, and then Draw 1 trash 1. | Activator activateMain is supported, but this effect has no executable actions. |
| JK01-011 | Deadly Sentencing | JK01-011-on-ko | onKO | On K.O.: Draw 1 trash 1. | Activator onKO is supported, but this effect has no executable actions. |
| JK01-012 | Ryomen Sukuna | JK01-012-on-play | onPlay | On Play: Add life cards to your hand until your life area has 1 card. If you did, your leader gains +2000 power for the rest of the game. | Activator onPlay is supported, but this effect has no executable actions. |
| JK02-001 | Hanami | JK02-001-activate-main | activateMain | Activate: Main Once Per Turn: Give 1 of your rested Characters Rush until the end of the turn. | Activator activateMain is supported, but this effect has no executable actions. |
| JK02-001 | Hanami | JK02-001-deck-rule | continuous | All characters you play are played as rested. | No continuous-effect evaluator is implemented; this is not an activator. |
| JK02-001 | Hanami | JK02-001-when-attacking | whenAttacking | When Attacking: You may rest 4 of your DON!! cards: Set up to 1 of your Characters with a cost of 6 or less as active. | Activator whenAttacking is supported, but this effect has no executable actions. |
| JK02-002 | Domain amplification | JK02-002-counter | counter | Counter: Give your Leader +3000 power for this battle. | Activator counter is supported, but this effect has no executable actions. |
| JK02-002 | Domain amplification | JK02-002-on-play | onPlay | On Play: You may rest 2 of your DON!! cards: Set up to 1 [Hanami] card as active and give it +1000 power. | Activator onPlay is supported, but this effect has no executable actions. |
| JK02-003 | Cursed energy absorption | JK02-003-on-play | onPlay | On Play: Give up to 1 of your opponent's Characters -2000 power until the end of this turn. If it has a cost of 5 or less and has 0 or less power, K.O. it. | Activator onPlay is supported, but this effect has no executable actions. |
| JK02-004 | Wooden Ball | JK02-004-main | main | Main: Choose one: K.O. up to 1 of your opponent's rested Characters with a cost of 5 or less; or up to 1 of your opponent's Characters with a cost of 7 or less cannot attack this turn. | Activator activateMain is supported, but this effect has no executable actions. |
| JK02-005 | Cursed Buds | JK02-005-main | main | Main: If you have 2 or more rested Characters, set 1 of your Characters with a cost of 5 or less as active and give it Rush. | Activator activateMain is supported, but this effect has no executable actions. |
| JK02-006 | Domain Expansion!! | JK02-006-main | main | Main: You may set up to 3 of your rested Characters as active and give all of them +2000 power. | Activator activateMain is supported, but this effect has no executable actions. |
| JK02-007 | Flower Field | JK02-007-main | main | Main: If your Leader is {Hanami}, negate the effect of up to 1 of your opponent's Characters with a cost of 8 or less during this turn. Then, give 1 of your opponent's Characters -2 cost for this turn. | Activator activateMain is supported, but this effect has no executable actions. |
| JK02-008 | Finger bearer | JK02-008-on-play | onPlay | On Play: If you have 2 or more rested Characters, K.O. 1 of your opponent's Characters with a cost of 4 or less. | Activator onPlay is supported, but this effect has no executable actions. |
| JK02-009 | Cursed Roots | JK02-009-counter | counter | Counter: Give your Leader or 1 of your Characters +2000 power for this battle. | Activator counter is supported, but this effect has no executable actions. |
| JK02-009 | Cursed Roots | JK02-009-main | main | Main: If you have 4 rested Characters, you may K.O. 2 of your opponent's Characters with a cost of 5 or less. | Activator activateMain is supported, but this effect has no executable actions. |
| JK02-010 | Ropongi curse | JK02-010-activate-main | activateMain | Activate: Main Once Per Turn: Rest 1 of your opponent's Characters with a cost of 4 or less. | Activator activateMain is supported, but this effect has no executable actions. |
| JK02-011 | Curse | JK02-011-on-play | onPlay | On Play: Give 1 of your opponent's Characters -4 cost until the end of this turn. | Activator onPlay is supported, but this effect has no executable actions. |
| JK02-012 | Stingray curse | JK02-012-activate-main | activateMain | Activate: Main Once Per Turn: You may K.O. 1 of your opponent's Characters with a cost of 0. | Activator activateMain is supported, but this effect has no executable actions. |
| JK02-013 | Zomba curse | JK02-013-on-play | onPlay | On Play: Set 1 of your rested Characters with a cost of 5 or less as active. | Activator onPlay is supported, but this effect has no executable actions. |
| JK02-014 | Smallpox curse | JK02-014-on-play | onPlay | On Play: Set this Character as active. Then, if you have 3 or more rested Characters, you may K.O. 1 of your opponent's Characters with a cost of 5 or less. If you do, draw 1 card. | Activator onPlay is supported, but this effect has no executable actions. |
| JK02-014 | Smallpox curse | JK02-014-protection | continuous | If one of your Characters would be removed from the field, you may rest this Character instead. | No continuous-effect evaluator is implemented; this is not an activator. |
| JK02-015 | Mahito | JK02-015-activate-main | activateMain | Activate: Main: You may trash 1 card: One of your "Curse Spirit" Characters with a cost of 3 or less gains Blocker. | Activator activateMain is supported, but this effect has no executable actions. |
| JK02-015 | Mahito | JK02-015-on-play | onPlay | On Play: Give all of your opponent's Characters with a cost of 8 or less -5 cost until the end of this turn and K.O. 1 Character with a cost of 6 or less. | Activator onPlay is supported, but this effect has no executable actions. |
| JK02-015 | Mahito | JK02-015-protection | continuous | This Character cannot be K.O.'d by effects. | No continuous-effect evaluator is implemented; this is not an activator. |
| JK02-016 | Jogo | JK02-016-activate-main | activateMain | Activate: Main: if this character was played this turn, you may set it as active. Then, give your Leader +2000 power the start of your next turn. | Activator activateMain is supported, but this effect has no executable actions. |
| JK02-016 | Jogo | JK02-016-when-attacking | whenAttacking | When Attacking: Attach 2 rested DON!! cards to one of your active characters. | Activator whenAttacking is supported, but this effect has no executable actions. |
| JK02-017 | Dagon | JK02-017-end-of-turn | endOfTurn | End of Your Turn: If you have 1 rested Character other than this Character, set this Character as active. | Activator endOfTurn is supported, but this effect has no executable actions. |
| JK02-017 | Dagon | JK02-017-on-play | onPlay | On Play: If you have 2 rested Characters, draw 2 cards and trash 1 card. | Activator onPlay is supported, but this effect has no executable actions. |
| JK02-018 | Grasshopper curse | JK02-018-activate-main | activateMain | Activate: Main Once Per Turn: If you have 3 rested Characters, set 4 of your DON!! cards as active. | Activator activateMain is supported, but this effect has no executable actions. |
| JK02-019 | Kenjaku | JK02-019-on-play | onPlay | On Play: Choose up to 1 Character card with a cost of 4 or less and up to 1 Character card with a cost of 2 or less from your trash and play them. | Activator onPlay is supported, but this effect has no executable actions. |
| JK02-019 | Kenjaku | JK02-019-when-attacking | whenAttacking | When Attacking: You may discard 1 card: K.O. 1 Character with a cost of 4 or less. | Activator whenAttacking is supported, but this effect has no executable actions. |
| JK02-020 | kurourushi | JK02-020-activate-main | activateMain | Activate: Main: You may discard 2 cards and give -5 cost to 1 of your opponent's Characters for this turn. | Activator activateMain is supported, but this effect has no executable actions. |
| JK02-020 | kurourushi | JK02-020-cost-reduction | continuous | All of your opponent's Characters get -3 cost. | No continuous-effect evaluator is implemented; this is not an activator. |
| JK02-020 | kurourushi | JK02-020-on-play | onPlay | On Play: K.O. 1 of your opponent's Characters with a cost of 1 or less. | Activator onPlay is supported, but this effect has no executable actions. |
| JK02-021 | Dagon small | JK02-021-on-play | onPlay | On Play: Look at 5 cards from the top of your deck; reveal up to 1 <Curse Spirit> type card or 1 Event card and add it to your hand. Then, place the rest at the bottom of your deck in any order. | Activator onPlay is supported, but this effect has no executable actions. |
| KIL1-001 | Killer | KIL1-001-activate-main | activateMain | DON!! x1 Activate: Main Once Per Turn: You and your opponent each trash the top 2 cards of your deck: Give up to 2 rested DON!! cards to 1 of your Characters. | Activator activateMain is supported, but this effect has no executable actions. |
| KIL1-001 | Killer | KIL1-001-on-opponent-attack | onOpponentAttack | DON!! x1 When Opponent Attacks Once Per Turn: You and your opponent each trash the top 2 cards of your deck: Give your opponent's Leader or 1 of their Characters -2000 power during this battle. | Activator onOpponentAttack is supported, but this effect has no executable actions. |
| KIL1-002 | Dive | KIL1-002-when-trashed-from-deck | whenTrashedFromDeck | You may activate this effect when this card is placed in the trash from your deck. Play this card. | Activator whenTrashedFromDeck is supported, but this effect has no executable actions. |
| KIL1-003 | Reck | KIL1-003-activate-main | activateMain | Activate: Main: Put 1 card from your opponent's trash on the bottom of their deck: Return up to 1 card with the same cost from your trash to your hand. | Activator activateMain is supported, but this effect has no executable actions. |
| KIL1-003 | Reck | KIL1-003-trigger | trigger | Trigger: Return up to 1 Character card from your trash to your hand. | Activator trigger is supported, but this effect has no executable actions. |
| KIL1-004 | Pomp | KIL1-004-activate-main | activateMain | Activate: Main: You may rest this Character: Place any number of cards from your trash to the bottom of your deck in any order, then your opponent places cards from their trash onto the bottom of their deck in a random order for each card you placed this way. Up to 1 of your Characters gains +1000 power this turn for every 6 cards placed at the bottom of each deck. | Activator activateMain is supported, but this effect has no executable actions. |
| KIL1-005 | Boogie | KIL1-005-activate-main | activateMain | Activate: Main: Trash this card: Draw a card. Then you and your opponent trash the top 3 cards of your decks. | Activator activateMain is supported, but this effect has no executable actions. |
| KIL1-006 | UK | KIL1-006-on-play | onPlay | On Play: Place any number of cards from your trash to the bottom of your deck in any order, then your opponent places cards from their trash onto the bottom of their deck in a random order for each card you placed this way. Draw then trash a card for every 4 cards returned this way. | Activator onPlay is supported, but this effect has no executable actions. |
| KIL1-006 | UK | KIL1-006-trigger | trigger | Trigger: You and your opponent each trash the top 2 cards of your deck. | Activator trigger is supported, but this effect has no executable actions. |
| KIL1-007 | Bubblegum | KIL1-007-custom | custom | DON!! x2 When Attacking / On K.O.: Place up to 1 card from your trash to the bottom of your deck, then your opponent places cards from their trash onto the bottom of their deck in a random order for each card you placed this way: You and your opponent each trash the top 3 cards of your deck. | Effect type custom is not mapped to an executable rules model. |
| KIL1-007 | Bubblegum | KIL1-007-trigger | trigger | Trigger: If your Leader has the {Kid Pirates} type, play this card. | Activator trigger is supported, but this effect has no executable actions. |
| KIL1-008 | Gig | KIL1-008-don-two | continuous | DON!! x2 This Character gains Rush and +2000 power. | No continuous-effect evaluator is implemented; this is not an activator. |
| KIL1-008 | Gig | KIL1-008-trigger | trigger | Trigger: You and your opponent each trash the top 1 card of your decks. | Activator trigger is supported, but this effect has no executable actions. |
| KIL1-009 | Heat | KIL1-009-activate-main | activateMain | Activate: Main: Place any number of cards from your trash to the bottom of your deck in any order, then your opponent places cards from their trash onto the bottom of their deck in a random order for each card you placed this way. For every 8 cards returned this way, negate the effects of that many of your opponent's Characters until the end of the turn. | Activator activateMain is supported, but this effect has no executable actions. |
| KIL1-010 | Wire | KIL1-010-on-ko | onKO | DON!! x2 On K.O.: Activate this card's On Play effect. | Activator onKO is supported, but this effect has no executable actions. |
| KIL1-010 | Wire | KIL1-010-on-play | onPlay | On Play: K.O. up to 1 of your opponent's Characters with 6000 power or less. | Activator onPlay is supported, but this effect has no executable actions. |
| KIL1-011 | Eustass \"Captain\" Kid | KIL1-011-on-play | onPlay | On Play: If your Leader has the {Supernovas} type, this Character gains Rush. Your opponent's Characters with 6000 power or less cannot activate Blocker this turn. Then, add the top card of your Life cards to your hand. | Activator onPlay is supported, but this effect has no executable actions. |
| KIL1-012 | Killer | KIL1-012-blocker-grant | continuous | If your Leader has the {Kid Pirates} type, this Character gains Blocker. | No continuous-effect evaluator is implemented; this is not an activator. |
| KIL1-012 | Killer | KIL1-012-when-attacked | whenAttacked | When Attacked Once Per Turn: Place any number of cards from your trash to the bottom of your deck in any order, then your opponent places cards from their trash onto the bottom of their deck in a random order for each card you placed this way. For every 5 cards put back this way, your Leader gains +1000 power until the end of your opponent's next turn. | Activator whenAttacked is supported, but this effect has no executable actions. |
| KIL1-013 | Sonic Scyther | KIL1-013-counter | counter | Counter: K.O. up to 1 of your opponent's Characters with 6000 power or less. | Activator counter is supported, but this effect has no executable actions. |
| KIL1-013 | Sonic Scyther | KIL1-013-trigger | trigger | Trigger: Activate this card's Counter effect. | Activator trigger is supported, but this effect has no executable actions. |
| KIL1-014 | Kid Has No Left Arm!!! | KIL1-014-counter | counter | Counter: If your Leader is [Killer] or you control a Character with 8000 power or more, up to 1 of your Leader or Characters gets +4000 during this battle. | Activator counter is supported, but this effect has no executable actions. |
| KIL1-014 | Kid Has No Left Arm!!! | KIL1-014-main | main | Main: You may rest 1 DON!!: You and your opponent each trash the top 3 cards of your deck. | Activator activateMain is supported, but this effect has no executable actions. |
| OP06-104 | Kikunojo | OP06-104-on-ko-add-life | onKO | On K.O.: If your opponent has 3 or less Life cards, add up to 1 card from the top of your deck to the top of your Life cards. | Activator onKO is supported, but this effect has no executable actions. |
| OP06-104 | Kikunojo | OP06-104-trigger-play | trigger | Trigger: If your opponent has 3 or less Life cards, play this card. | Activator trigger is supported, but this effect has no executable actions. |
| OP06-107 | Kouzuki Momonosuke | OP06-107-on-play-life | onPlay | On Play: Add up to 1 of your {Land of Wano} type Characters other than [Kouzuki Momonosuke] to the top or bottom of the owner's Life cards face-up. | Activator onPlay is supported, but this effect has no executable actions. |
| OP13-104 | Kouzuki Hiyori | OP13-104-on-ko-add-life | onKO | On K.O.: You may trash 1 card from your hand: If your Leader is multicolored, add up to 1 card from the top of your deck to the top of your Life cards. | Activator onKO is supported, but this effect has no executable actions. |
| OP14-005 | Killer | OP14-005-activate-main | activateMain | Activate: Main Once Per Turn: Give up to 1 rested DON!! card to your Leader or 1 of your Characters. | Activator activateMain is supported, but this effect has no executable actions. |
| OP14-089 | Ryuma | OP14-089-trigger-play | trigger | Trigger: Play up to 1 {Thriller Bark Pirates} type Character card with a cost of 4 or less from your trash rested. | Activator trigger is supported, but this effect has no executable actions. |
| OP16-082 | Kin'emon | OP16-082-on-play-search | onPlay | On Play: If your Leader has the {Land of Wano} type, look at 5 cards from the top of your deck; reveal up to 1 {Land of Wano} type card and add it to your hand. Then, trash the rest. | Activator onPlay is supported, but this effect has no executable actions. |
| OP16-082 | Kin'emon | OP16-082-plus-cost | continuous | This Character gains +3 cost. | No continuous-effect evaluator is implemented; this is not an activator. |
| OP16-085 | Kouzuki Momonosuke | OP16-085-on-play-play-trash | onPlay | On Play: Play up to 1 {Land of Wano} type Character card with a cost of 6 or less other than [Kouzuki Momonosuke] from your trash. | Activator onPlay is supported, but this effect has no executable actions. |
| OP16-096 | Yamato | OP16-096-on-ko-play-yamato | onKO | On K.O.: Play up to 1 [Yamato] with a cost of 6 or less from your trash. | Activator onKO is supported, but this effect has no executable actions. |
| OP16-098 | Yamato | OP16-098-activate-main-play-yamato | activateMain | Activate: Main: You may trash this Character: Play up to 1 black [Yamato] with a cost of 8 from your trash. | Activator activateMain is supported, but this effect has no executable actions. |
| OP16-099 | I've Come Here... To Cut Those Chains!!! | OP16-099-counter | counter | Counter: Your Leader gains +3000 power during this battle. | Activator counter is supported, but this effect has no executable actions. |
| OP16-099 | I've Come Here... To Cut Those Chains!!! | OP16-099-main | main | Main: You may rest 6 of your DON!! cards: Trash 5 cards from the top of your deck. Then, play up to 1 {Land of Wano} type Character card with a cost of 6 or less from your trash. | Activator activateMain is supported, but this effect has no executable actions. |
| POG1-001 | David Taglavnovič | POG1-001-start-of-turn-search | startOfTurn | Start of Your Turn: Look at 3 cards from the top of your deck; reveal up to 1 [Parfum] and add it to your hand. Then, place the rest on the top or bottom of your deck in any order. | Activator startOfTurn is supported, but this effect has no executable actions. |
| POG1-002 | Parfum | POG1-002-leader-cannot-attack | continuous | When this Stage card is in play, your Leader cannot attack. | No continuous-effect evaluator is implemented; this is not an activator. |
| POG1-002 | Parfum | POG1-002-on-play-mark-character | onPlay | On Play: Choose up to 1 of your Opponent's Characters and place it on your field. When that Character is removed from field; trash this Stage. | Activator onPlay is supported, but this effect has no executable actions. |
| POG1-003 | Mr. JeremiÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ | POG1-003-on-play | onPlay | On Play: Declare a card name; play that card from your deck. Then shuffle the deck. | Activator onPlay is supported, but this effect has no executable actions. |
| POG1-004 | Pogajanje | POG1-004-main | main | Main: Look at 4 cards from the top of your deck; reveal up to 1 [Film] type card and add it to your hand. Then place the rest at the bottom of your deck in any order. | Activator activateMain is supported, but this effect has no executable actions. |
| POG1-004 | Pogajanje | POG1-004-trigger | trigger | Trigger: Draw 1 card. | Activator trigger is supported, but this effect has no executable actions. |
| POG1-005 | Dejan Sigma | POG1-005-on-opponent-attack | onOpponentAttack | When Opponent Attacks: Reveal 1 card from your deck. If that card is [Manifestirana ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾oga] or [Klobuk] up to 1 of your Leader or Characters gain +2000 power until the end of this turn. Then trash the revealed card. | Activator onOpponentAttack is supported, but this effect has no executable actions. |
| POG1-005 | Dejan Sigma | POG1-005-when-attacking | whenAttacking | When Attacking: Reveal 1 card from your deck. If that card is [Manifestirana ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾oga] or [Klobuk] up to 1 of your Leader or Characters gains +2000 power until the end of this turn. Then trash the revealed card. | Activator whenAttacking is supported, but this effect has no executable actions. |
| POG1-006 | David TaglavnoviÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚Â | POG1-006-activate-main | activateMain | Activate: Main: You may trash this Character: If your Leader is [David TaglavnoviÃƒÆ’Ã¢â‚¬Å¾Ãƒâ€šÃ‚Â], play up to 1 [B.R.A.N.K.O.] from your hand or Trash with a cost thats is equal or less than the number of DON!! cards on your opponent's field. | Activator activateMain is supported, but this effect has no executable actions. |
| POG1-007 | Johan JohanoviÃƒÆ’Ã¢â‚¬Å¾ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ | POG1-007-on-play | onPlay | On Play: Draw 3 cards and place 2 cards from your hand at the top or bottom of your deck. | Activator onPlay is supported, but this effect has no executable actions. |
| POG1-008 | Klobuk | POG1-008-counter | counter | Counter: Your Leader or up to one of your Characters gains +2000 power during this battle. | Activator counter is supported, but this effect has no executable actions. |
| POG1-008 | Klobuk | POG1-008-main | main | Main: You may give 1 active DON!! card to 1 of your Leader: Your Leader or up to 1 of your Characters gains +1000 power during this turn. | Activator activateMain is supported, but this effect has no executable actions. |
| POG1-009 | Bingo | POG1-009-counter | counter | Counter: Your Leader or up to one of your Characters gains +2000 power during this battle. | Activator counter is supported, but this effect has no executable actions. |
| POG1-009 | Bingo | POG1-009-main | main | Main: You may rest 2 of your DON!! cards: Declare a cost and reveal 1 card from the top of your deck. If the revealed cost is the same as the declared cost, draw 2 cards. | Activator activateMain is supported, but this effect has no executable actions. |
| POG1-010 | Manifestirana ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾oga | POG1-010-counter | counter | Counter: Your Leader or up to one of your Characters gains +2000 power during this battle. | Activator counter is supported, but this effect has no executable actions. |
| POG1-010 | Manifestirana ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¾oga | POG1-010-main | main | Main: You may rest 3 of your DON!! cards: Up to 1 of your opponent's rested Character does not become active during next refresh phase. | Activator activateMain is supported, but this effect has no executable actions. |
| POG1-011 | Banana Onemoglosti | POG1-011-counter | counter | Counter: Your Leader or up to one of your Characters gains +2000 power during this battle. | Activator counter is supported, but this effect has no executable actions. |
| POG1-011 | Banana Onemoglosti | POG1-011-main | main | Main: You may rest 3 of your DON!! cards: Negate the effects of up to 1 of opponents Leader or Characters until the end of this turn. | Activator activateMain is supported, but this effect has no executable actions. |
| POG1-012 | B.R.A.N.K.O. | POG1-012-continuous | continuous | Your opponent's replacement effects are negated. | No continuous-effect evaluator is implemented; this is not an activator. |
| POG1-012 | B.R.A.N.K.O. | POG1-012-end-of-your-turn | endOfYourTurn | End Of Your Turn: Set this Character as active. | Activator endOfTurn is supported, but this effect has no executable actions. |
| POG1-013 | Magdalena | POG1-013-activate-main | activateMain | Activate: Main Once Per Turn: Place 2 cards from your Trash at the bottom of your deck; draw 1 card. | Activator activateMain is supported, but this effect has no executable actions. |
| POG1-013 | Magdalena | POG1-013-trigger | trigger | Trigger: Draw 2 cards and trash 1. | Activator trigger is supported, but this effect has no executable actions. |
| POG1-014 | Hvala hvala hvala | POG1-014-counter | counter | Counter: Your leader or up to one of your Characters gains +2000 power. Then add up to 1 [Film] type card from your Trash to your hand. | Activator counter is supported, but this effect has no executable actions. |
| POG1-014 | Hvala hvala hvala | POG1-014-trigger | trigger | Trigger: Add 1 card from your Trash to your hand. | Activator trigger is supported, but this effect has no executable actions. |
| PRB02-016 | Otama | PRB02-016-activate-main-power | activateMain | Activate: Main: You may rest this Character and add 1 card from the top or bottom of your Life cards to your hand: Up to 1 of your Leader or Character cards gains +3000 power during this turn. | Activator activateMain is supported, but this effect has no executable actions. |
| PRB02-016 | Otama | PRB02-016-trigger-rest | trigger | Trigger: Rest up to 1 of your opponent's Characters with a cost of 4 or less. | Activator trigger is supported, but this effect has no executable actions. |
| ST28-004 | Kouzuki Momonosuke | ST28-004-activate-main-rush | activateMain | Activate: Main Once Per Turn: You may return 2 total of your currently given DON!! cards to your cost area rested: This Character gains Rush and +1000 power during this turn. | Activator activateMain is supported, but this effect has no executable actions. |
| ST28-004 | Kouzuki Momonosuke | ST28-004-your-turn-leader-power | yourTurn | Your Turn: If you have 2 or less Life cards, your Leader gains +1000 power. | No persistent turn-condition evaluator is implemented; this is not an activator. |
| ST28-005 | Yamato | ST28-005-your-turn-power | yourTurn | DON!! x2 Your Turn: This Character gains +3000 power. | No persistent turn-condition evaluator is implemented; this is not an activator. |
| SUB1-001 | Subaru Natsuki | SUB1-001-checkpoint | activateMain | Activate: Any Once Per Game: Return the game state to the last set checkpoint. | Activator activateMain is supported, but this effect has no executable actions. |
| SUB1-001 | Subaru Natsuki | SUB1-001-when-attacking-power | whenAttacking | When Attacking: You may place one of your life cards other than the top card at the top of your Life area: this Leader gains +1000 power until the end of this turn. | Activator whenAttacking is supported, but this effect has no executable actions. |
| SUB1-002 | Emilia | SUB1-002-on-play-life | onPlay | On Play: If you have 2 Life cards or less, put 1 card from your deck to the top of your Life area. | Activator onPlay is supported, but this effect has no executable actions. |
| SUB1-003 | Ram | SUB1-003-continuous-rem-buff | continuous | All Rem Characters gain +1000 power and cannot be removed from the field by effects. | No continuous-effect evaluator is implemented; this is not an activator. |
| SUB1-004 | Elsa | SUB1-004-on-play-rush | onPlay | On Play: Trash 1 card from your hand and flip the top card of your Life area; this Character gains Rush. | Activator onPlay is supported, but this effect has no executable actions. |
| SUB1-005 | Reinhard van Astrea | SUB1-005-on-play-life-rush | onPlay | On Play: Add 1 card from the top of your deck to the top of your Life. Then this card gains Character Rush. | Activator onPlay is supported, but this effect has no executable actions. |
| SUB1-005 | Reinhard van Astrea | SUB1-005-trigger-draw-trash | trigger | Trigger: Draw 2 and trash 1. | Activator trigger is supported, but this effect has no executable actions. |
| SUB1-007 | Echidna | SUB1-007-activate-main-stage-copy | activateMain | Activate: Main Once Per Turn: Flip the top card in your Life area; activate effect of the Stage on your field. Then this Character gains +1000 power. | Activator activateMain is supported, but this effect has no executable actions. |
| SUB1-007 | Echidna | SUB1-007-on-play-stage-copy | onPlay | On Play: Flip the top card in your Life area; activate effect of the Stage on your field. Then this Character gains +1000 power. | Activator onPlay is supported, but this effect has no executable actions. |
| SUB1-008 | Return by death | SUB1-008-on-play-checkpoint | onPlay | On Play: Flip any card from your and your Opponent's Life area: Set the game state as a Checkpoint. | Activator onPlay is supported, but this effect has no executable actions. |
| SUB1-009 | Elsa | SUB1-009-trigger-play | trigger | Trigger: Play this card. | Activator trigger is supported, but this effect has no executable actions. |
| SUB1-009 | Elsa | SUB1-009-when-attacking-life-power | whenAttacking | DON!! x1 When Attacking: Flip any card from your Life area; this card gains half of the revealed card's power. | Activator whenAttacking is supported, but this effect has no executable actions. |
| SUB1-011 | I will definitely save you | SUB1-011-counter | counter | Counter: You may trash 1 card from your hand: Up to 1 of your Leader or Character cards gains +3000 power during this battle. | Activator counter is supported, but this effect has no executable actions. |
| SUB1-011 | I will definitely save you | SUB1-011-trigger | trigger | Trigger: If you have 0 Life cards, you may add up to 1 card from the top of your deck to the top of your Life cards. Then, trash 1 card from your hand. | Activator trigger is supported, but this effect has no executable actions. |
| SUB1-012 | Puck | SUB1-012-on-play-search-emilia | onPlay | On Play: You may trash a card from the top of your Life area; look at top 6 cards from your deck and reveal 1 RE:ZERO type card and add it to your hand. Then, play up to 1 Emilia from your hand. | Activator onPlay is supported, but this effect has no executable actions. |
| SUB1-013 | Roswaal L. Mathers | SUB1-013-on-play-search-two | onPlay | On Play: Flip any card in your Life area; Look at 5 cards from the top of your deck and reveal up to 2 "RE:ZERO" type cards and add them to your hand. Then place the rest at the bottom of the deck in any order. | Activator onPlay is supported, but this effect has no executable actions. |
| SUB1-013 | Roswaal L. Mathers | SUB1-013-trigger-on-play | trigger | Trigger: Activate this card's On Play effect. | Activator trigger is supported, but actionId activateOnPlayEffect has no executable compiler mapping. |
| SUB1-014 | Rem | SUB1-014-on-play-play-ram | onPlay | On Play: Play up to 1 Ram from your hand or Trash. | Activator onPlay is supported, but this effect has no executable actions. |
| YAM1-001 | Ace & Yamato | YAM1-001-activate-main-life | activateMain | Activate: Main Once Per Turn: You may K.O. 2 of your {Land of Wano} type Characters: Add up to 1 card from your hand to the top of your Life cards. | Activator activateMain is supported, but this effect has no executable actions. |
| YAM1-001 | Ace & Yamato | YAM1-001-on-character-play-draw | onCharacterPlay | Once Per Turn: When you play a character, if it wasn't played from your hand, draw 2 cards, then trash 1 card. Then, this Leader gains +1000 power until the end of your opponent's next End Phase. | Activator onCharacterPlay is supported, but this effect has no executable actions. |
| YAM1-002 | Kouzuki Oden | YAM1-002-don-double-attack | continuous | DON!! x1: This Character gains Double Attack. | No continuous-effect evaluator is implemented; this is not an activator. |
| YAM1-002 | Kouzuki Oden | YAM1-002-on-ko-lock-rest | onKO | On K.O.: Up to 1 of your opponent's Characters with a cost of 6 or less can't be rested until the end of your opponent's next End Phase. | Activator onKO is supported, but this effect has no executable actions. |
| YAM1-002 | Kouzuki Oden | YAM1-002-on-play-lock-rest | onPlay | On Play: Up to 1 of your opponent's Characters with a cost of 6 or less can't be rested until the end of your opponent's next End Phase. | Activator onPlay is supported, but this effect has no executable actions. |
| YAM1-002 | Kouzuki Oden | YAM1-002-trigger-play | trigger | Trigger: You may trash 1 card from your hand: If your opponent has 3 or less Life cards, play this card. | Activator trigger is supported, but this effect has no executable actions. |
| YAM1-003 | I Want To Live As Free As Oden Did!!! | YAM1-003-counter | counter | Counter: You may turn 1 card from the top of your Life cards face-up: Up to 1 of your Characters or Leader gets +3000 power until end of turn. | Activator counter is supported, but this effect has no executable actions. |
| YAM1-003 | I Want To Live As Free As Oden Did!!! | YAM1-003-main | main | Main: Add 1 card from the top of your Life cards to your hand. Then, up to 1 of your {Land of Wano} Characters gets +2000 power and Rush until end of turn. | Activator activateMain is supported, but this effect has no executable actions. |
| YAM1-004 | Wano Country | YAM1-004-activate-main-attach-don | activateMain | Activate: Main Once Per Turn: Attach up to 1 rested DON!! to 1 of your Characters. | Activator activateMain is supported, but this effect has no executable actions. |
| YAM1-004 | Wano Country | YAM1-004-trigger-play-trash | trigger | Trigger: Play up to 1 {Land of Wano} Character with a cost of 6 or less from your trash rested. | Activator trigger is supported, but this effect has no executable actions. |
| YAM1-004 | Wano Country | YAM1-004-your-turn-power | yourTurn | Your Turn: If a card has been added to your Life cards, your {Land of Wano} Characters get +1000 power this turn. | No persistent turn-condition evaluator is implemented; this is not an activator. |
| YAM1-005 | Kouzuki Momonosuke | YAM1-005-trigger-play | trigger | Trigger: Play up to 1 {Land of Wano} Character with a cost of 4 or less from your trash. | Activator trigger is supported, but this effect has no executable actions. |

## Unsupported printed keywords

Blocker is implemented and is intentionally excluded. The following printed keywords still lack their required gameplay behavior:

| Card ID | Name | Keyword | Current missing behavior |
|---|---|---|---|
| BL01-011 | Yoruichi Shihoin | rush | Rush attack permission is not implemented; newly played Characters still cannot attack that turn. |
| BL01-012 | Kurosaki Ichigo | rush | Rush attack permission is not implemented; newly played Characters still cannot attack that turn. |
| DD01-006 | Takakura Ken | rush | Rush attack permission is not implemented; newly played Characters still cannot attack that turn. |
| DD01-007 | Unji Zuma | doubleAttack | Double Attack damage is not implemented; successful Leader attacks currently take only 1 Life. |
| DD01-010 | Evil Eye | rush | Rush attack permission is not implemented; newly played Characters still cannot attack that turn. |
| EGG1-002 | Metal Sonic | rush | Rush attack permission is not implemented; newly played Characters still cannot attack that turn. |
| EGG1-008 | Metal Sonic | rush | Rush attack permission is not implemented; newly played Characters still cannot attack that turn. |
| IMU1-004 | Harald | doubleAttack | Double Attack damage is not implemented; successful Leader attacks currently take only 1 Life. |
| IMU1-010 | Nerona Imu | rush | Rush attack permission is not implemented; newly played Characters still cannot attack that turn. |
| JK01-007 | Yuji Itadori | rush | Rush attack permission is not implemented; newly played Characters still cannot attack that turn. |
| JK01-012 | Ryomen Sukuna | rush | Rush attack permission is not implemented; newly played Characters still cannot attack that turn. |
| OP16-096 | Yamato | unblockable | Unblockable is not enforced; the defending player can still select a Blocker. |
