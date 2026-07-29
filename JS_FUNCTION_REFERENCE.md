# JavaScript Function Reference

This inventory covers every `.js` file under `js/`. The card data `.json` files are intentionally excluded because they are JSON, not JavaScript.

## `js/cards/cardDatabase.js`
Loads card JSON, creates effectless runtime copies, and exposes card lookup helpers.

- `loadJson`: Loads Json.
- `createVanillaCardDatabase`: Creates Vanilla Card Database.
- `loadCardDatabase`: Loads Card Database.
- `cloneCard`: Handles clone card.
- `getCardById`: Returns Card By Id.

## `js/cards/decks.js`
Defines preset deck lists and deck selection helpers used by the UI.

- `getAvailableDecks`: Returns available decks.
- `getDeckById`: Returns deck by ID.

## `js/decks/deckParser.js`
Parses deck text and shuffles deck arrays for match setup.

- `parseDeckText`: Parses deck text.
- `shuffleDeck`: Provides helper logic for shuffle deck.

## `js/decks/deckTools.js`
Handles saved-deck storage, deck text conversion, validation, and selection helpers.

- `getDefaultPresetDeck`: Returns default preset deck.
- `normalizeDeckEntries`: Normalizes deck entries.
- `buildDeckTextFromEntries`: Builds deck text from entries.
- `buildDeckTextWithLeader`: Builds deck text with leader.
- `getDeckEntriesFromDefinition`: Returns deck entries from definition.
- `getDeckLeaderKey`: Returns deck leader key.
- `parseDeckEntriesFromText`: Parses deck entries from text.
- `isLeaderCardId`: Checks whether leader card ID.
- `parseDeckListData`: Parses deck list data.
- `validateDeckEntries`: Validates deck entries.
- `getLeaderDeckSizeLimit`: Returns leader deck size limit.
- `getDeckEntryTotal`: Returns deck entry total.
- `validateDeckSizeLimit`: Validates deck size limit.
- `createDeckDefinition`: Creates deck definition.
- `cloneDeckDefinition`: Clones deck definition.
- `getLocalSavedDecks`: Returns local saved decks.
- `getLocalSavedDeckById`: Returns local saved deck by ID.
- `saveLocalDeck`: Saves local deck.
- `deleteLocalSavedDeck`: Provides helper logic for delete local saved deck.
- `getStoredDeckSelection`: Returns stored deck selection.
- `saveStoredDeckSelection`: Saves stored deck selection.
- `createPresetSelection`: Creates preset selection.
- `resolveDeckSelection`: Resolves deck selection.
- `getDeckSummaryText`: Returns deck summary text.
- `createPasteDeckSelection`: Creates paste deck selection.
- `openDeckPickerPopup`: Provides helper logic for open deck picker popup.
- `createDeckPickerField`: Creates deck picker field.
- `createDeckPickerHelp`: Creates deck picker help.

## `js/game/actions/gameInteractions.js`
Implements base card and match actions without card effects or keyword behavior.

- `createCardInstance`: Creates Card Instance.
- `assignCardInstance`: Assigns Card Instance.
- `findHandCardIndexByInstanceId`: Finds Hand Card Index By Instance Id.
- `getCardPlayCost`: Returns Card Play Cost.
- `canPlayerAffordCard`: Checks Player Afford Card.
- `getFirstOpenCharacterSlotIndex`: Returns First Open Character Slot Index.
- `getBoardCardFromData`: Returns Board Card From Data.
- `getPlayerKey`: Returns Player Key.
- `getOpponentOfPlayer`: Returns Opponent Of Player.
- `getPlayedCharacterInitialState`: Returns Played Character Initial State.
- `addDon`: Adds DON!!.
- `addRestedDon`: Adds Rested DON!!.
- `restDonForCost`: Rests DON!! For Cost.
- `setRestedDonActive`: Sets Rested DON!! Active.
- `returnDonToDeck`: Returns DON!! To Deck.
- `attachActiveDonToCard`: Attaches Active DON!! To Card.
- `getTotalAttachedDonCount`: Returns Total Attached DON!! Count.
- `returnAttachedDonToCostArea`: Returns Attached DON!! To Cost Area.
- `detachAttachedDonToCostArea`: Detaches Attached DON!! To Cost Area.
- `drawCard`: Draws Card.
- `drawCards`: Draws Cards.
- `getCardCounterValue`: Returns Card Counter Value.
- `getCounterPowerForUse`: Returns Counter Power For Use.
- `getHandCounterEventCost`: Returns Hand Counter Event Cost.
- `canCardBeUsedAsCounter`: Checks Card Be Used As Counter.
- `useCounterFromHand`: Handles use counter from hand.
- `playCard`: Plays Card.
- `playCharacterCard`: Plays Character Card.
- `replaceStageOnFieldIfNeeded`: Handles replace stage on field if needed.
- `playStageCard`: Plays Stage Card.
- `setCardRested`: Sets Card Rested.
- `restBoardCard`: Rests Board Card.
- `setBoardCardActive`: Sets Board Card Active.
- `trashCharacterFromField`: Handles trash character from field.
- `KOCharacter`: K.O.s Character.
- `takeLifeDamage`: Takes Life Damage.
- `banishLifeDamage`: Handles banish life damage.
- `loseByLifeDamage`: Handles By Life Damage.
- `loseByDeckOut`: Handles By Deck Out.
- `checkDeckOut`: Checks Deck Out.
- `moveCardToTrash`: Moves Card To Trash.

## `js/game/settings/gameSettings.js`
Loads and exposes gameplay settings from local storage.

- `loadGameSettings`: Loads game settings.
- `getGameSetting`: Returns game setting.
- `isGameSettingEnabled`: Checks whether game setting enabled.
- `getOptionAutoSelectScore`: Returns option auto select score.
- `getAutoSelectMaxValueOption`: Returns auto select max value option.

## `js/game/phases/phases.js`
Controls mulligan, turn order, phase changes, refresh, draw, DON!!, and counter flow.

- `setPhaseButtonUrgency`: Sets Phase Button Urgency.
- `shouldHighlightManualPhaseButton`: Checks Highlight Manual Phase Button.
- `runDiceRollPhase`: Handles run dice roll phase.
- `selectTurnOrder`: Handles select turn order.
- `handleMulliganChoice`: Handles Mulligan Choice.
- `drawStartingHand`: Draws Starting Hand.
- `mulliganHand`: Handles mulligan hand.
- `setupLifeCards`: Sets up Life Cards.
- `shouldSkipCurrentTurnDraw`: Checks Skip Current Turn Draw.
- `getCurrentTurnDonAmount`: Returns Current Turn DON!! Amount.
- `setPhaseButtonState`: Sets Phase Button State.
- `canCurrentClientAdvanceTurnPhases`: Checks Current Client Advance Turn Phases.
- `maybeAutoAdvanceTurnPhases`: Handles maybe auto advance turn phases.
- `canCurrentClientResolveStartOfTurn`: Checks Current Client Resolve Start Of Turn.
- `beginTurnFlow`: Starts Turn Flow.
- `advanceDrawPhase`: Handles advance draw phase.
- `advanceDonPhase`: Handles advance don!! phase.
- `startTurnOne`: Starts Turn One.
- `getCurrentTurnStatusKey`: Returns Current Turn Status Key.
- `markCardCannotAttackThisTurn`: Handles mark card cannot attack this turn.
- `markLifeCardAdded`: Handles mark life card added.
- `hasAddedLifeCardThisTurn`: Checks Added Life Card This Turn.
- `lockCardForNextRefresh`: Handles lock card for next refresh.
- `refreshPlayerCards`: Handles refresh player cards.
- `runRefreshPhase`: Handles run refresh phase.
- `runDrawPhase`: Handles run draw phase.
- `runDonPhase`: Handles run don!! phase.
- `runMainPhase`: Handles run main phase.
- `passTurn`: Handles pass turn.
- `startCounterPhase`: Starts Counter Phase.
- `getNextPlayer`: Returns Next Player.
- `canPlayerPlayCards`: Checks Player Play Cards.

## `js/multiplayer/firebase/firebaseApp.js`
Initializes Firebase app services and guest authentication helpers.

- `signInGuest`: Provides helper logic for sign in guest.
- `waitForUser`: Provides helper logic for wait for user.

## `js/multiplayer/firebase/firebaseConfig.js`
Stores the Firebase project configuration constants.

- No named functions are declared in this file.

## `js/multiplayer/firebase/multiplayerService.js`
Provides Firebase room, match, state-sync, and presence operations for multiplayer.

- `generateRoomCode`: Provides helper logic for generate room code.
- `cleanRoomCode`: Provides helper logic for clean room code.
- `cloneData`: Clones data.
- `createMultiplayerCard`: Creates multiplayer card.
- `requireDeckTools`: Provides helper logic for require deck tools.
- `validateSelectedDeckForMatch`: Validates selected deck for match.
- `createInitialPrivateState`: Creates initial private state.
- `applyStartingZangetsuStage`: Applies starting zangetsu stage.
- `createPublicCardSnapshot`: Creates public card snapshot.
- `createInitialPublicPlayerState`: Creates initial public player state.
- `drawStartingHand`: Draws starting hand.
- `setupLifeCards`: Sets up life cards.
- `createPublicPlayerState`: Creates public player state.
- `shuffleCards`: Provides helper logic for shuffle cards.
- `getRoomRef`: Returns room ref.
- `normalizePlayerSlot`: Normalizes player slot.
- `getNumericTimestamp`: Returns numeric timestamp.
- `getRoomActivityTimestamp`: Returns room activity timestamp.
- `touchRoom`: Touches room.
- `createRoom`: Creates room.
- `joinRoom`: Provides helper logic for join room.
- `subscribeToMatch`: Subscribes to to match.
- `startQueuedMatch`: Starts queued match.
- `subscribeToPublicState`: Subscribes to to public state.
- `subscribeToPrivateState`: Subscribes to to private state.
- `getMatch`: Returns match.
- `updatePublicState`: Updates public state.
- `updatePrivateState`: Updates private state.
- `setPlayerDeck`: Sets player deck.
- `setPlayerReady`: Sets player ready.
- `initializeMultiplayerGame`: Initializes multiplayer game.
- `updateCurrentAttack`: Updates current attack.
- `applyMultiplayerLifeDamage`: Applies multiplayer life damage.
- `rollMultiplayerDice`: Rolls multiplayer dice.
- `chooseMultiplayerTurnOrder`: Prompts for multiplayer turn order.
- `setMultiplayerMulligan`: Sets multiplayer mulligan.
- `sendMultiplayerAction`: Provides helper logic for send multiplayer action.
- `applyMultiplayerAction`: Applies multiplayer action.
- `passTurn`: Passes turn.
- `startMatch`: Starts match.
- `requestRematch`: Requests rematch.
- `deleteRoom`: Provides helper logic for delete room.
- `registerRoomPresence`: Provides helper logic for register room presence.
- `createImmediateDisconnectRequest`: Creates immediate disconnect request.
- `sendImmediateDisconnectRequest`: Provides helper logic for send immediate disconnect request.
- `cleanupInactiveRooms`: Provides helper logic for cleanup inactive rooms.

## `js/ui/pages/deck-editor.js`
Runs the deck editor page UI, filtering, previews, import/export, and saved deck actions.

- `DeckEditor.constructor`: Initializes the class instance and caches its starting state or DOM references.
- `DeckEditor.init`: Initializes this module or class setup sequence.
- `DeckEditor.setupEvents`: Sets up events.
- `DeckEditor.buildCardCaches`: Builds card caches.
- `DeckEditor.buildCardRecord`: Builds card record.
- `DeckEditor.scheduleLibraryRender`: Schedules library render.
- `DeckEditor.renderLeaderSelection`: Renders leader selection.
- `DeckEditor.chooseLeader`: Prompts for leader.
- `DeckEditor.removeLeader`: Removes leader.
- `DeckEditor.renderCardLibrary`: Renders card library.
- `DeckEditor.createLibraryCard`: Creates library card.
- `DeckEditor.populateFilterOptions`: Provides DeckEditor logic for populate filter options.
- `DeckEditor.populateSelect`: Provides DeckEditor logic for populate select.
- `DeckEditor.getUniqueSortedTextValues`: Returns unique sorted text values.
- `DeckEditor.getUniqueSortedNumberValues`: Returns unique sorted number values.
- `DeckEditor.getAllCards`: Returns all cards.
- `DeckEditor.getFilteredCards`: Returns filtered cards.
- `DeckEditor.getCardColors`: Returns card colors.
- `DeckEditor.getCardTypeValues`: Returns card type values.
- `DeckEditor.getCardSetCode`: Returns card set code.
- `DeckEditor.matchesNumberFilter`: Provides DeckEditor logic for matches number filter.
- `DeckEditor.compareCardsForLibrary`: Provides DeckEditor logic for compare cards for library.
- `DeckEditor.compareColorGroups`: Provides DeckEditor logic for compare color groups.
- `DeckEditor.getCategorySortValue`: Returns category sort value.
- `DeckEditor.isCopyLimitEnabled`: Checks whether copy limit enabled.
- `DeckEditor.getCurrentDeckSizeLimit`: Returns current deck size limit.
- `DeckEditor.isDeckAtSizeLimit`: Checks whether deck at size limit.
- `DeckEditor.canAddAnotherCopy`: Checks whether add another copy.
- `DeckEditor.handleCopyLimitToggleChange`: Handles copy limit toggle change.
- `DeckEditor.addCardToDeck`: Adds card to deck.
- `DeckEditor.increaseCardAmount`: Provides DeckEditor logic for increase card amount.
- `DeckEditor.removeCardFromDeck`: Removes card from deck.
- `DeckEditor.clearDeck`: Clears deck.
- `DeckEditor.getCurrentDeckEntries`: Returns current deck entries.
- `DeckEditor.getCurrentDeckDefinition`: Returns current deck definition.
- `DeckEditor.renderSavedDeckOptions`: Renders saved deck options.
- `DeckEditor.loadDeckDefinition`: Loads deck definition.
- `DeckEditor.saveCurrentDeck`: Saves current deck.
- `DeckEditor.copyDeckCode`: Provides DeckEditor logic for copy deck code.
- `DeckEditor.loadSelectedSavedDeck`: Loads selected saved deck.
- `DeckEditor.deleteSelectedSavedDeck`: Provides DeckEditor logic for delete selected saved deck.
- `DeckEditor.importDeckFromText`: Provides DeckEditor logic for import deck from text.
- `DeckEditor.renderDeck`: Renders deck.
- `DeckEditor.createDeckLeaderElement`: Creates deck leader element.
- `DeckEditor.createDeckCardElement`: Creates deck card element.
- `DeckEditor.getDeckCardTotal`: Returns deck card total.
- `DeckEditor.updateDeckCount`: Updates deck count.
- `DeckEditor.getCardAmountInDeck`: Returns card amount in deck.
- `DeckEditor.getDeckCardAmountMap`: Returns deck card amount map.
- `DeckEditor.openCardPreview`: Provides DeckEditor logic for open card preview.
- `DeckEditor.closeCardPreview`: Provides DeckEditor logic for close card preview.
- `DeckEditor.getCardDetails`: Returns card details.

## `js/ui/shared/galaxy-theme.js`
Renders the animated galaxy background used on non-match pages.

- No named functions are declared in this file.

## `js/game/shared/matchShared.js`
Defines shared match state, printed card power calculation, and board rendering helpers.

- `getSelectedDeckDefinitions`: Returns Selected Deck Definitions.
- `createInitialPlayerState`: Creates Initial Player State.
- `createInitialGameState`: Creates Initial Game State.
- `takeCardAnimationClass`: Takes Card Animation Class.
- `getBoardCardRenderKey`: Returns Board Card Render Key.
- `getBoardStateAnimationClass`: Returns Board State Animation Class.
- `applyCardAnimationClass`: Applies Card Animation Class.
- `setupLifeArea`: Sets up Life Area.
- `createTurnOrderButtons`: Creates Turn Order Buttons.
- `showDiceRollAnimation`: Shows Dice Roll Animation.
- `createD20Die`: Creates D20 Die.
- `animateD20`: Handles animate d20.
- `removeDiceRollDisplay`: Removes Dice Roll Display.
- `createMulliganButtons`: Creates Mulligan Buttons.
- `removeChoiceButtons`: Removes Choice Buttons.
- `createPhaseLogProxy`: Creates Phase Log Proxy.
- `normalizeLogMessage`: Handles normalize log message.
- `getBoardActionButtonContainer`: Returns Board Action Button Container.
- `getOpponentPlayerKey`: Returns Opponent Player Key.
- `isCharacterPlayedThisTurn`: Checks Character Played This Turn.
- `getPlayerForBoardCard`: Returns Player For Board Card.
- `getPrintedPower`: Returns Printed Power.
- `getPowerModifier`: Returns Power Modifier.
- `getCardBattlePower`: Returns Card Battle Power.
- `getCostModifier`: Returns Cost Modifier.
- `renderCostModifierBadge`: Renders Cost Modifier Badge.
- `renderPowerModifierBadge`: Renders Power Modifier Badge.
- `renderBasePowerBadge`: Renders Base Power Badge.
- `renderAttachedDonBadge`: Renders Attached DON!! Badge.
- `getCurrentAttackTargetPowerBonus`: Returns Current Attack Target Power Bonus.
- `isSameBoardCard`: Checks Same Board Card.
- `getBoardActionButtonContainerFromData`: Returns Board Action Button Container From Data.
- `rollD20`: Handles roll d20.

## `js/ui/multiplayer/multiplayer.js`
Runs the effectless multiplayer match interface and synchronizes player-owned actions.

- `cloneSerializableValue`: Handles clone serializable value.
- `getMultiplayerRuntime`: Returns Multiplayer Runtime.
- `getMultiplayerLocalSlot`: Returns Multiplayer Local Slot.
- `getOpponentMultiplayerSlot`: Returns Opponent Multiplayer Slot.
- `getCanonicalSlotForLocalPlayerKey`: Returns Canonical Slot For Local Player Key.
- `getLocalPlayerKeyForCanonicalSlot`: Returns Local Player Key For Canonical Slot.
- `getPlayerKeyForPlayer`: Returns Player Key For Player.
- `mapBoardCardDataToCanonical`: Maps Board Card Data To Canonical.
- `mapBoardCardDataToLocal`: Maps Board Card Data To Local.
- `queueMultiplayerStateSync`: Queues Multiplayer State Sync.
- `serializePlayerState`: Serializes Player State.
- `hydratePlayerState`: Hydrates Player State.
- `transformStatusExpiryPlayerKeys`: Handles transform status expiry player keys.
- `mapLocalStatusKeysToCanonical`: Maps Local Status Keys To Canonical.
- `mapCanonicalStatusKeysToLocal`: Maps Canonical Status Keys To Local.
- `renderGameLogMessages`: Renders Game Log Messages.
- `syncPhaseButtonForCurrentState`: Synchronizes Phase Button For Current State.
- `clearLocalSelectionsAndOverlays`: Clears Local Selections And Overlays.
- `restoreBattleUiFromSyncedState`: Restores Battle UI From Synced State.
- `renderFullGameState`: Renders Full Game State.
- `maybeAutoAdvancePhaseFromSyncedState`: Handles maybe auto advance phase from synced state.
- `maybeResumeStartOfTurnFromSyncedState`: Handles maybe resume start of turn from synced state.
- `createUiBridge`: Creates UI Bridge.
- `initializeGamePage`: Initializes Game Page.
- `createVanillaCardState`: Creates Vanilla Card State.
- `showGameOverPopup`: Shows Game Over Popup.
- `removeGameOverPopup`: Removes Game Over Popup.
- `removeSurrenderConfirmPopup`: Removes Surrender Confirm Popup.
- `showSurrenderConfirmPopup`: Shows Surrender Confirm Popup.
- `syncGameOverPopupForCurrentState`: Synchronizes Game Over Popup For Current State.
- `endGame`: Handles end game.
- `clearAttackArrow`: Clears Attack Arrow.
- `drawAttackArrow`: Draws Attack Arrow.
- `getBoardElementFromData`: Returns Board Element From Data.
- `setupPhaseControls`: Sets up Phase Controls.
- `showEndTurnConfirmation`: Shows End Turn Confirmation.
- `shouldAddGameLog`: Checks Add Game Log.
- `addGameLog`: Adds Game Log.
- `updateDonDisplay`: Updates DON!! Display.
- `renderDonArea`: Renders DON!! Area.
- `renderDonDecks`: Renders DON!! Decks.
- `renderDonDeck`: Renders DON!! Deck.
- `renderDecks`: Renders Decks.
- `renderDeck`: Renders Deck.
- `renderHands`: Renders Hands.
- `renderPlayerHand`: Renders Player Hand.
- `sortPlayerHand`: Handles sort player hand.
- `setupSidebarControls`: Sets up Sidebar Controls.
- `updateSidebarControls`: Updates Sidebar Controls.
- `canSortPlayerHand`: Checks Sort Player Hand.
- `getHandSortKey`: Returns Hand Sort Key.
- `renderLifeCards`: Renders Life Cards.
- `renderPlayerLife`: Renders Player Life.
- `renderLeaders`: Renders Leaders.
- `renderLeader`: Renders Leader.
- `renderCharacters`: Renders Characters.
- `renderPlayerCharacters`: Renders Player Characters.
- `renderStages`: Renders Stages.
- `renderPlayerStage`: Renders Player Stage.
- `renderTrash`: Renders Trash.
- `renderPlayerTrash`: Renders Player Trash.
- `showTrashViewer`: Shows Trash Viewer.
- `removeTrashViewer`: Removes Trash Viewer.
- `setupCardPreview`: Sets up Card Preview.
- `showCardPreview`: Shows Card Preview.
- `clearCardPreview`: Clears Card Preview.
- `setupHandCardSelection`: Sets up Hand Card Selection.
- `showSelectedCardActions`: Shows Selected Card Actions.
- `showSelectedCounterActions`: Shows Selected Counter Actions.
- `applyCounterPowerToCurrentAttack`: Applies Counter Power To Current Attack.
- `clearSelectedCardActions`: Clears Selected Card Actions.
- `setupBoardCharacterSelection`: Sets up Board Character Selection.
- `setupBoardLeaderSelection`: Sets up Board Leader Selection.
- `showSelectedBoardActions`: Shows Selected Board Actions.
- `canAttachDonToBoardCard`: Checks Attach DON!! To Board Card.
- `createAttachDonButton`: Creates Attach DON!! Button.
- `refreshSelectedBoardCardElement`: Handles refresh selected board card element.
- `clearSelectedBoardActions`: Clears Selected Board Actions.
- `clearHandSelection`: Clears Hand Selection.
- `clearBoardSelection`: Clears Board Selection.
- `clearReplaceTargets`: Clears Replace Targets.
- `enterReplaceMode`: Starts Replace Mode.
- `setupCharacterSlotInteractions`: Sets up Character Slot Interactions.
- `clearBattleControls`: Clears Battle Controls.
- `isLocalMultiplayerPlayerKey`: Checks Local Multiplayer Player Key.
- `canLocalPlayerControlDefense`: Checks Local Player Control Defense.
- `createBattleButton`: Creates Battle Button.
- `createWaitingDefenseButton`: Creates Waiting Defense Button.
- `showResolveAttackButton`: Shows Resolve Attack Button.
- `showCounterPhaseControls`: Shows Counter Phase Controls.
- `showResolveOnlyButton`: Shows Resolve Only Button.
- `enterAttackTargetSelection`: Starts Attack Target Selection.
- `setupAttackTargetSelection`: Sets up Attack Target Selection.
- `clearAttackTargets`: Clears Attack Targets.
- `beginAttack`: Starts Attack.
- `resolveCurrentAttack`: Resolves Current Attack.
- `clearCancelAttackButton`: Clears Cancel Attack Button.
- `showCancelAttackButton`: Shows Cancel Attack Button.
- `cancelPendingAttack`: Checks Pending Attack.
- `getSelectedBoardCardObject`: Returns Selected Board Card Object.
- `canCurrentPlayerAttack`: Checks Current Player Attack.
- `canSelectedBoardCardAttack`: Checks Selected Board Card Attack.
- `exportMultiplayerSharedState`: Exports Multiplayer Shared State.
- `applyMultiplayerSharedState`: Applies Multiplayer Shared State.

## `js/multiplayer/sync/multiplayerPresence.js`
Registers multiplayer room presence when the match page opens.

- `initializeMultiplayerPresence`: Initializes multiplayer room presence for the active match page.

## `js/multiplayer/sync/multiplayerRuntime.js`
Coordinates multiplayer page state with Firebase match data and room lifecycle events.

- `cloneValue`: Clones value.
- `getOpponentSlot`: Returns opponent slot.
- `clearPendingOpponentDisconnect`: Clears pending opponent disconnect.
- `sendImmediateDisconnectOnExit`: Provides helper logic for send immediate disconnect on exit.
- `ensureOwnPresence`: Provides helper logic for ensure own presence.
- `scheduleOpponentDisconnectCheck`: Schedules opponent disconnect check.
- `getPageApi`: Returns page api.
- `addRuntimeLog`: Adds runtime log.
- `reportRuntimeError`: Provides helper logic for report runtime error.
- `runPregameAction`: Runs pregame action.
- `getSavedDeckDefinition`: Returns saved deck definition.
- `createHiddenCards`: Creates hidden cards.
- `buildPlayerState`: Builds player state.
- `buildSnapshotFromRoom`: Builds snapshot from room.
- `buildSharedSnapshotFromFullMatch`: Builds shared snapshot from full match.
- `syncRematchButtonState`: Syncs rematch button state.
- `buildPregameLogs`: Builds pregame logs.
- `removeChoiceButtons`: Removes choice buttons.
- `getPhaseButton`: Returns phase button.
- `setPhaseButtonState`: Sets phase button state.
- `showTurnOrderButtons`: Provides helper logic for show turn order buttons.
- `showMulliganButtons`: Provides helper logic for show mulligan buttons.
- `renderPregameControls`: Renders pregame controls.
- `ensureDeckSelection`: Provides helper logic for ensure deck selection.
- `maybeInitializeServiceMatch`: Provides helper logic for maybe initialize service match.
- `maybeCreateSharedState`: Provides helper logic for maybe create shared state.
- `syncSharedStateNow`: Syncs shared state now.
- `scheduleStateSync`: Schedules state sync.
- `applySharedStateIfNeeded`: Applies shared state if needed.
- `applyPregameSnapshot`: Applies pregame snapshot.
- `handlePublicMatchUpdate`: Handles public match update.
- `waitForPageApi`: Provides helper logic for wait for page api.
- `initializeRuntime`: Initializes runtime.
- `__multiplayerRuntime.getLocalSlot`: Returns local slot.
- `__multiplayerRuntime.isActive`: Checks whether active.
- `__multiplayerRuntime.handlePlayAgainClick`: Handles play again click.
- `__multiplayerRuntime.handleSurrenderClick`: Handles surrender click.

## `js/ui/pages/play.js`
Runs the play menu deck selection flow and singleplayer launch link setup.

- `updateDeckButtonLabel`: Updates deck button label.
- `updateSingleplayerPlayLink`: Updates singleplayer play link.
- `savePlayDeckSelection`: Saves play deck selection.
- `initializePlayPage`: Initializes the play page controls and stored deck selections.

## `js/ui/pages/presetDecks.js`
Renders the preset deck browser, search, and deck preview modal.

- `initializePresetDecksPage`: Initializes the preset decks page and loads the required card data.
- `getAvailableDecksSafe`: Returns available decks safe.
- `renderPresetDecks`: Renders preset decks.
- `createCompactDeckCard`: Creates compact deck card.
- `createDeckCard`: Creates deck card.
- `createMetaItem`: Creates meta item.
- `openDeckImageModal`: Provides helper logic for open deck image modal.
- `closeDeckImageModal`: Provides helper logic for close deck image modal.
- `setupModalCloseEvents`: Sets up modal close events.
- `createImageSection`: Creates image section.
- `createDeckImageCard`: Creates deck image card.
- `openDeckCardPreview`: Provides helper logic for open deck card preview.
- `closeDeckCardPreview`: Provides helper logic for close deck card preview.
- `setupDeckSearch`: Sets up deck search.
- `parseDeckLines`: Parses deck lines.
- `getTotalCardCount`: Returns total card count.
- `getDeckCardEntries`: Returns deck card entries.
- `getLeaderCard`: Returns leader card.
- `getFirstExistingCard`: Returns first existing card.
- `getCardDataById`: Returns card data by ID.
- `useDeckInVsSelf`: Provides helper logic for use deck in vs self.
- `escapeHtml`: Provides helper logic for escape html.

## `js/ui/pages/queue.js`
Runs the multiplayer lobby, room creation/join flow, deck locking, and ready/start controls.

- `initializeDeckPicker`: Initializes the deck picker controls for the current page.
- `saveQueueDeckSelection`: Saves queue deck selection.
- `updateQueueDeckButtonLabel`: Updates queue deck button label.
- `hasActiveRoom`: Checks whether active room.
- `isQueueDeckLocked`: Checks whether queue deck locked.
- `updateQueueDeckHelpText`: Updates queue deck help text.
- `refreshQueueControlStates`: Provides helper logic for refresh queue control states.
- `setRoomCode`: Sets room code.
- `getSelectedQueueDeck`: Returns selected queue deck.
- `saveCurrentPlayerDeck`: Saves current player deck.
- `setCurrentPlayerReady`: Sets current player ready.
- `goToMatchPage`: Provides helper logic for go to match page.
- `subscribeToCurrentRoom`: Subscribes to to current room.
- `updateRoomUI`: Updates room UI.
- `initializeQueuePage`: Initializes queue page.

## `js/ui/pages/settings.js`
Runs the settings page tabs, persistence, and save feedback UI.

- `SettingsManager.constructor`: Initializes the class instance and caches its starting state or DOM references.
- `SettingsManager.init`: Initializes this module or class setup sequence.
- `SettingsManager.loadSettings`: Loads settings.
- `SettingsManager.getDefaultSettings`: Returns default settings.
- `SettingsManager.saveSettings`: Saves settings.
- `SettingsManager.getSettings`: Returns settings.
- `SettingsManager.getSetting`: Returns setting.
- `SettingsManager.updateSetting`: Updates setting.
- `SettingsManager.resetToDefaults`: Provides SettingsManager logic for reset to defaults.
- `SettingsManager.setupTabNavigation`: Sets up tab navigation.
- `SettingsManager.loadCheckboxStates`: Loads checkbox states.
- `SettingsManager.setupEventListeners`: Sets up event listeners.
- `SettingsManager.showSaveNotification`: Provides SettingsManager logic for show save notification.

## `js/ui/singleplayer/singleplayer.js`
Runs the effectless local match interface for both players.

- `createUiBridge`: Creates UI Bridge.
- `initializeGamePage`: Initializes Game Page.
- `showGameOverPopup`: Shows Game Over Popup.
- `removeGameOverPopup`: Removes Game Over Popup.
- `endGame`: Handles end game.
- `clearAttackArrow`: Clears Attack Arrow.
- `drawAttackArrow`: Draws Attack Arrow.
- `getBoardElementFromData`: Returns Board Element From Data.
- `setupPhaseControls`: Sets up Phase Controls.
- `showEndTurnConfirmation`: Shows End Turn Confirmation.
- `shouldAddGameLog`: Checks Add Game Log.
- `addGameLog`: Adds Game Log.
- `updateDonDisplay`: Updates DON!! Display.
- `renderDonArea`: Renders DON!! Area.
- `renderDonDecks`: Renders DON!! Decks.
- `renderDonDeck`: Renders DON!! Deck.
- `renderDecks`: Renders Decks.
- `renderDeck`: Renders Deck.
- `renderHands`: Renders Hands.
- `renderPlayerHand`: Renders Player Hand.
- `sortPlayerHand`: Handles sort player hand.
- `setupSidebarControls`: Sets up Sidebar Controls.
- `updateSidebarSortButtonState`: Updates Sidebar Sort Button State.
- `canSortPlayerHand`: Checks Sort Player Hand.
- `getHandSortKey`: Returns Hand Sort Key.
- `renderLifeCards`: Renders Life Cards.
- `renderPlayerLife`: Renders Player Life.
- `renderLeaders`: Renders Leaders.
- `renderLeader`: Renders Leader.
- `renderCharacters`: Renders Characters.
- `renderPlayerCharacters`: Renders Player Characters.
- `renderStages`: Renders Stages.
- `renderPlayerStage`: Renders Player Stage.
- `renderTrash`: Renders Trash.
- `renderPlayerTrash`: Renders Player Trash.
- `showTrashViewer`: Shows Trash Viewer.
- `removeTrashViewer`: Removes Trash Viewer.
- `setupCardPreview`: Sets up Card Preview.
- `showCardPreview`: Shows Card Preview.
- `clearCardPreview`: Clears Card Preview.
- `setupHandCardSelection`: Sets up Hand Card Selection.
- `showSelectedCardActions`: Shows Selected Card Actions.
- `showSelectedCounterActions`: Shows Selected Counter Actions.
- `applyCounterPowerToCurrentAttack`: Applies Counter Power To Current Attack.
- `clearSelectedCardActions`: Clears Selected Card Actions.
- `setupBoardCharacterSelection`: Sets up Board Character Selection.
- `setupBoardLeaderSelection`: Sets up Board Leader Selection.
- `showSelectedBoardActions`: Shows Selected Board Actions.
- `canAttachDonToBoardCard`: Checks Attach DON!! To Board Card.
- `createAttachDonButton`: Creates Attach DON!! Button.
- `refreshSelectedBoardCardElement`: Handles refresh selected board card element.
- `clearSelectedBoardActions`: Clears Selected Board Actions.
- `clearHandSelection`: Clears Hand Selection.
- `clearBoardSelection`: Clears Board Selection.
- `clearReplaceTargets`: Clears Replace Targets.
- `enterReplaceMode`: Starts Replace Mode.
- `setupCharacterSlotInteractions`: Sets up Character Slot Interactions.
- `clearBattleControls`: Clears Battle Controls.
- `createBattleButton`: Creates Battle Button.
- `showResolveAttackButton`: Shows Resolve Attack Button.
- `showCounterPhaseControls`: Shows Counter Phase Controls.
- `showResolveOnlyButton`: Shows Resolve Only Button.
- `enterAttackTargetSelection`: Starts Attack Target Selection.
- `setupAttackTargetSelection`: Sets up Attack Target Selection.
- `clearAttackTargets`: Clears Attack Targets.
- `beginAttack`: Starts Attack.
- `resolveCurrentAttack`: Resolves Current Attack.
- `clearCancelAttackButton`: Clears Cancel Attack Button.
- `showCancelAttackButton`: Shows Cancel Attack Button.
- `cancelPendingAttack`: Checks Pending Attack.
- `getSelectedBoardCardObject`: Returns Selected Board Card Object.
- `canCurrentPlayerAttack`: Checks Current Player Attack.
- `canSelectedBoardCardAttack`: Checks Selected Board Card Attack.
