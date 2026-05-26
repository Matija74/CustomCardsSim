// play.js

function updateDeckSummary(summaryElement, selection, fallbackLabel) {
    if (!summaryElement) {
        return;
    }

    const deck = window.resolveDeckSelection?.(selection);
    summaryElement.textContent = deck
        ? `${deck.name} | Leader ${deck.leaderKey}`
        : fallbackLabel;
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
    const player1DeckSummary = document.getElementById("player1DeckSummary");
    const player2DeckSummary = document.getElementById("player2DeckSummary");
    const defaultDeck = window.getAvailableDecks?.()[0] || null;

    if (!player1DeckButton || !player2DeckButton || !defaultDeck) {
        return;
    }

    const storedSelection = window.getStoredDeckSelection?.() || {};
    const player1Selection = storedSelection.player1Selection || window.createPresetSelection?.(storedSelection.player1DeckId || defaultDeck.id);
    const player2Selection = storedSelection.player2Selection || window.createPresetSelection?.(storedSelection.player2DeckId || defaultDeck.id);

    savePlayDeckSelection("player1Selection", player1Selection);
    savePlayDeckSelection("player2Selection", player2Selection);

    updateDeckSummary(player1DeckSummary, player1Selection, "No deck selected");
    updateDeckSummary(player2DeckSummary, player2Selection, "No deck selected");
    updateSingleplayerPlayLink();

    player1DeckButton.addEventListener("click", () => {
        window.openDeckPickerPopup?.({
            title: "Player 1 Deck",
            initialSelection: (window.getStoredDeckSelection?.() || {}).player1Selection,
            onConfirm: selection => {
                savePlayDeckSelection("player1Selection", selection);
                updateDeckSummary(player1DeckSummary, selection, "No deck selected");
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
                updateDeckSummary(player2DeckSummary, selection, "No deck selected");
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
