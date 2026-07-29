# JavaScript Function Reference

This inventory covers the card, gameplay, multiplayer, and page JavaScript. Card JSON is intentionally excluded because it is data, not JavaScript.

## `js/game/`
The rebuilt gameplay modules create card instances and centralized state, validate selections and permissions, execute registered action staples sequentially, manage phases and turns, resolve attacks/Blockers/Counters/Life Triggers, and expose the authoritative command processor. The browser UI only renders state and sends commands.

- `engine/gameEngine.js`: Creates the engine, processes stable command IDs, rejects invalid ownership/timing, and redacts private zones.
- `effects/actionRegistry.js`: Maps declarative action names to handlers.
- `effects/effectResolver.js`: Queues triggers, resolves actions in order, pauses for selections, and prevents repeated steps.
- `battle/battleSystem.js`: Resolves attack targets, Blocker and Counter windows, K.O., Life damage, and Trigger choices.
- `phases/turnSystem.js`: Advances Refresh, Draw, DON!!, Main, and End phases and expires turn modifiers.
- `actions/`: Implements card, DON!!, state, Life, search, power, and cost staples.
- `checks/`: Validates quantities, instances, filters, permissions, and selections.
- `state/`: Creates game/player/card-instance state and moves cards between zones.

## `js/cards/cardDatabase.js`
Loads the complete card JSON datasets and exposes card lookup helpers.

- `loadJson`: Loads json.
- `loadCardDatabase`: Loads card database.
- `cloneCard`: Handles clone card.
- `getCardById`: Returns card by id.

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

## `js/multiplayer/firebase/firebaseApp.js`
Initializes Firebase app services and guest authentication helpers.

- `signInGuest`: Provides helper logic for sign in guest.
- `waitForUser`: Provides helper logic for wait for user.

## `js/multiplayer/firebase/firebaseConfig.js`
Stores the Firebase project configuration constants.

- No named functions are declared in this file.

## `js/multiplayer/firebase/multiplayerService.js`
Provides Firebase room, deck-selection, ready-state, presence, gameplay-command, private-state, and disconnect operations.

- `generateRoomCode`: Creates room code.
- `cleanRoomCode`: Normalizes room code.
- `getRoomRef`: Returns room ref.
- `normalizePlayerSlot`: Normalizes player slot.
- `cloneData`: Handles clone data.
- `touchRoom`: Handles touch room.
- `createRoom`: Creates room.
- `joinRoom`: Joins room.
- `subscribeToMatch`: Subscribes to match.
- `subscribeToFullMatch`: Subscribes the host to authoritative room data.
- `subscribeToPrivateGameState`: Subscribes a player to their redacted game view.
- `submitGameplayCommand`: Authenticates and submits a stable gameplay command.
- `publishGameplayState`: Publishes host-authoritative and player-redacted state.
- `getMatch`: Returns match.
- `setPlayerDeck`: Updates player deck.
- `setPlayerReady`: Updates player ready.
- `openPlayArea`: Opens play area.
- `registerRoomPresence`: Registers room presence.
- `createImmediateDisconnectRequest`: Creates immediate disconnect request.
- `sendImmediateDisconnectRequest`: Sends immediate disconnect request.

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

## `js/multiplayer/sync/multiplayerRuntime.js`
Maintains presence, initializes the host engine, processes authenticated commands once, and renders each player's private synchronized view.

- `setConnectionState`: Updates connection state.
- `sendImmediateDisconnectOnExit`: Sends immediate disconnect on exit.
- `restorePresenceIfNeeded`: Handles restore presence if needed.
- `initializeConnection`: Loads connection.

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
Controls room creation, joining, deck selection, ready state, and opening the multiplayer match.

- `initializeDeckPicker`: Loads deck picker.
- `saveQueueDeckSelection`: Saves queue deck selection.
- `updateQueueDeckButtonLabel`: Updates queue deck button label.
- `hasActiveRoom`: Handles has active room.
- `isQueueDeckLocked`: Handles is queue deck locked.
- `updateQueueDeckHelpText`: Updates queue deck help text.
- `refreshQueueControlStates`: Handles refresh queue control states.
- `setRoomCode`: Updates room code.
- `getSelectedQueueDeck`: Returns selected queue deck.
- `saveCurrentPlayerDeck`: Saves current player deck.
- `setCurrentPlayerReady`: Updates current player ready.
- `goToMatchPage`: Handles go to match page.
- `subscribeToCurrentRoom`: Subscribes to current room.
- `updateRoomUI`: Updates room ui.
- `initializeQueuePage`: Loads queue page.

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
