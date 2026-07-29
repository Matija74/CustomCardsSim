// play.js

function updateDeckButtonLabel(buttonElement, selection, fallbackLabel) {
    if (!buttonElement) {
        return;
    }

    const deck = window.resolveDeckSelection?.(selection);
    buttonElement.textContent = deck?.name || fallbackLabel;
}

function updateSingleplayerPlayLink() {
    const singleplayerPlayLink = document.getElementById("singleplayerPlayLink");
    const storedSelection = window.getStoredDeckSelection?.() || {};
    const player1Deck = window.resolveDeckSelection?.(storedSelection.player1Selection);
    const player2Deck = window.resolveDeckSelection?.(storedSelection.player2Selection);

    if (!singleplayerPlayLink || !player1Deck || !player2Deck) {
        return;
    }

    const params = new URLSearchParams({
        player1Deck: player1Deck.id,
        player2Deck: player2Deck.id
    });

    singleplayerPlayLink.href = `singleplayer.html?${params.toString()}`;
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
    const defaultDeck = window.getAvailableDecks?.()[0] || null;

    if (!player1DeckButton || !player2DeckButton || !defaultDeck) {
        return;
    }

    const storedSelection = window.getStoredDeckSelection?.() || {};
    const player1Selection = storedSelection.player1Selection || window.createPresetSelection?.(storedSelection.player1DeckId || defaultDeck.id);
    const player2Selection = storedSelection.player2Selection || window.createPresetSelection?.(storedSelection.player2DeckId || defaultDeck.id);

    savePlayDeckSelection("player1Selection", player1Selection);
    savePlayDeckSelection("player2Selection", player2Selection);

    updateDeckButtonLabel(player1DeckButton, player1Selection, "Choose Deck");
    updateDeckButtonLabel(player2DeckButton, player2Selection, "Choose Deck");
    updateSingleplayerPlayLink();

    player1DeckButton.addEventListener("click", () => {
        window.openDeckPickerPopup?.({
            title: "Player 1 Deck",
            initialSelection: (window.getStoredDeckSelection?.() || {}).player1Selection,
            onConfirm: selection => {
                savePlayDeckSelection("player1Selection", selection);
                updateDeckButtonLabel(player1DeckButton, selection, "Choose Deck");
                updateSingleplayerPlayLink();
            }
        });
    });

    player2DeckButton.addEventListener("click", () => {
        window.openDeckPickerPopup?.({
            title: "Player 2 Deck",
            initialSelection: (window.getStoredDeckSelection?.() || {}).player2Selection,
            onConfirm: selection => {
                savePlayDeckSelection("player2Selection", selection);
                updateDeckButtonLabel(player2DeckButton, selection, "Choose Deck");
                updateSingleplayerPlayLink();
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
