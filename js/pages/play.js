// play.js

const TESTING_DISABLED_LEADER_KEYS = new Set(["YAM1-001"]);

function isTestingDeckSelectionAllowed(selection) {
    const deck = window.resolveDeckSelection?.(selection);

    return Boolean(deck && !TESTING_DISABLED_LEADER_KEYS.has(deck.leaderKey));
}

function getTestingDefaultDeck() {
    return (window.getAvailableDecks?.() || []).find(deck =>
        !TESTING_DISABLED_LEADER_KEYS.has(deck.leaderKey)
    ) || null;
}

function confirmTestingDeckSelection({
    key,
    selection,
    button
}) {
    if (!isTestingDeckSelectionAllowed(selection)) {
        window.alert("Ace & Yamato is temporarily disabled in the testing area.");
        return;
    }

    savePlayDeckSelection(key, selection);
    updateDeckButtonLabel(button, selection, "Choose Deck");
    updateSingleplayerPlayLink();
}

function updateDeckButtonLabel(buttonElement, selection, fallbackLabel) {
    if (!buttonElement) {
        return;
    }

    const deck = window.resolveDeckSelection?.(selection);
    buttonElement.textContent = deck?.name || fallbackLabel;
}

function updateSingleplayerPlayLink() {
    const singleplayerPlayLink = document.getElementById("singleplayerPlayLink");
    const experimentalBoardLink = document.getElementById("experimentalBoardLink");
    const storedSelection = window.getStoredDeckSelection?.() || {};
    const player1Deck = window.resolveDeckSelection?.(storedSelection.player1Selection);
    const player2Deck = window.resolveDeckSelection?.(storedSelection.player2Selection);

    if (!singleplayerPlayLink || !experimentalBoardLink || !player1Deck || !player2Deck) {
        return;
    }

    const params = new URLSearchParams({
        player1Deck: player1Deck.id,
        player2Deck: player2Deck.id
    });

    const destination = `singleplayer.html?${params.toString()}`;
    singleplayerPlayLink.href = window.addInterfacePreferencesToUrl?.(destination) || destination;

    params.set("boardUI", "next");
    const experimentalDestination = `singleplayer.html?${params.toString()}`;
    experimentalBoardLink.href = window.addInterfacePreferencesToUrl?.(experimentalDestination) || experimentalDestination;
}

function savePlayDeckSelection(key, selection) {
    const storedSelection = window.getStoredDeckSelection?.() || {};
    const nextSelection = {
        ...storedSelection,
        [key]: selection
    };
    const deck = window.resolveDeckSelection?.(selection);

    if (key === "player1Selection") {
        nextSelection.player1DeckId = deck?.id || "";
    }

    if (key === "player2Selection") {
        nextSelection.player2DeckId = deck?.id || "";
    }

    if (key === "onlineSelection") {
        nextSelection.onlineDeckId = deck?.id || "";
    }

    window.saveStoredDeckSelection?.(nextSelection);
}

function initializePlayPage() {
    const player1DeckButton = document.getElementById("player1DeckButton");
    const player2DeckButton = document.getElementById("player2DeckButton");
    const defaultDeck = getTestingDefaultDeck();

    if (!player1DeckButton || !player2DeckButton || !defaultDeck) {
        return;
    }

    const storedSelection = window.getStoredDeckSelection?.() || {};
    const storedPlayer1Selection = storedSelection.player1Selection || window.createPresetSelection?.(storedSelection.player1DeckId || defaultDeck.id);
    const storedPlayer2Selection = storedSelection.player2Selection || window.createPresetSelection?.(storedSelection.player2DeckId || defaultDeck.id);
    const player1Selection = isTestingDeckSelectionAllowed(storedPlayer1Selection)
        ? storedPlayer1Selection
        : window.createPresetSelection?.(defaultDeck.id);
    const player2Selection = isTestingDeckSelectionAllowed(storedPlayer2Selection)
        ? storedPlayer2Selection
        : window.createPresetSelection?.(defaultDeck.id);

    savePlayDeckSelection("player1Selection", player1Selection);
    savePlayDeckSelection("player2Selection", player2Selection);

    updateDeckButtonLabel(player1DeckButton, player1Selection, "Choose Deck");
    updateDeckButtonLabel(player2DeckButton, player2Selection, "Choose Deck");
    updateSingleplayerPlayLink();

    player1DeckButton.addEventListener("click", () => {
        window.openDeckPickerPopup?.({
            title: "Player 1 Deck",
            initialSelection: (window.getStoredDeckSelection?.() || {}).player1Selection,
            presetFilter: deck => !TESTING_DISABLED_LEADER_KEYS.has(deck.leaderKey),
            onConfirm: selection => {
                confirmTestingDeckSelection({
                    key: "player1Selection",
                    selection,
                    button: player1DeckButton
                });
            }
        });
    });

    player2DeckButton.addEventListener("click", () => {
        window.openDeckPickerPopup?.({
            title: "Player 2 Deck",
            initialSelection: (window.getStoredDeckSelection?.() || {}).player2Selection,
            presetFilter: deck => !TESTING_DISABLED_LEADER_KEYS.has(deck.leaderKey),
            onConfirm: selection => {
                confirmTestingDeckSelection({
                    key: "player2Selection",
                    selection,
                    button: player2DeckButton
                });
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        if (window.loadCardDatabase) {
            await window.loadCardDatabase();
        }
    } catch (error) {
        console.error("Failed to load card database for play page:", error);
    }

    initializePlayPage();
});
