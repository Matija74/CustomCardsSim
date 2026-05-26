import {
    signInGuest,
    waitForUser
} from "../firebase/firebaseApp.js";

import {
    createRoom,
    joinRoom,
    subscribeToMatch,
    startMatch,
    registerRoomPresence,
    setPlayerDeck,
    setPlayerReady
} from "../firebase/multiplayerService.js";

const connectionStatus = document.getElementById("connectionStatus");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const queueDeckButton = document.getElementById("queueDeckButton");
const queueDeckSummary = document.getElementById("queueDeckSummary");
const roomCodeInput = document.getElementById("roomCodeInput");
const roomStatus = document.getElementById("roomStatus");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const player1Status = document.getElementById("player1Status");
const player2Status = document.getElementById("player2Status");
const startGameBtn = document.getElementById("startGameBtn");

let currentUser = null;
let currentRoomCode = null;
let playerSlot = null;
let unsubscribeMatch = null;

function initializeDeckPicker() {
    if (!queueDeckButton || !window.getAvailableDecks) {
        return;
    }

    const storedSelection = window.getStoredDeckSelection?.() || {};
    const defaultDeckId = window.getAvailableDecks()?.[0]?.id || "";
    const onlineSelection = storedSelection.onlineSelection || window.createPresetSelection?.(storedSelection.onlineDeckId || defaultDeckId);

    if (onlineSelection) {
        saveQueueDeckSelection(onlineSelection);
    }

    updateQueueDeckSummary();

    queueDeckButton.addEventListener("click", () => {
        window.openDeckPickerPopup?.({
            title: "Online Deck",
            initialSelection: (window.getStoredDeckSelection?.() || {}).onlineSelection,
            onConfirm: selection => {
                saveQueueDeckSelection(selection);
                updateQueueDeckSummary();
            }
        });
    });
}

function saveQueueDeckSelection(selection) {
    const currentSelection = window.getStoredDeckSelection?.() || {};
    const deck = window.resolveDeckSelection?.(selection);

    window.saveStoredDeckSelection?.({
        ...currentSelection,
        onlineSelection: selection,
        onlineDeckId: deck?.id || "",
        player1DeckId: deck?.id || currentSelection.player1DeckId || "",
        player2DeckId: deck?.id || currentSelection.player2DeckId || ""
    });
}

function updateQueueDeckSummary() {
    if (!queueDeckSummary) {
        return;
    }

    const onlineSelection = (window.getStoredDeckSelection?.() || {}).onlineSelection;
    const deck = window.resolveDeckSelection?.(onlineSelection);
    queueDeckSummary.textContent = deck
        ? `${deck.name} | Leader ${deck.leaderKey}`
        : "No deck selected";
}

function setQueueControlsDisabled(disabled) {
    createRoomBtn.disabled = disabled;
    joinRoomBtn.disabled = disabled;
    roomCodeInput.disabled = disabled;
    if (queueDeckButton) {
        queueDeckButton.disabled = disabled;
    }
}

function setRoomCode(roomCode) {
    currentRoomCode = roomCode;
    roomCodeDisplay.textContent = roomCode || "------";
}

function getSelectedQueueDeck() {
    return window.resolveDeckSelection?.((window.getStoredDeckSelection?.() || {}).onlineSelection) || null;
}

async function saveCurrentPlayerDeckAndReady(roomCode, slot) {
    if (!currentUser?.uid || !roomCode || !slot) {
        return;
    }

    const selectedDeck = getSelectedQueueDeck();

    if (!selectedDeck) {
        return;
    }

    await setPlayerDeck(roomCode, currentUser.uid, selectedDeck);
    await setPlayerReady(roomCode, currentUser.uid, true);
}

function goToMatchPage() {
    if (!currentRoomCode || !playerSlot) return;

    const params = new URLSearchParams({
        room: currentRoomCode,
        player: playerSlot
    });

    window.location.href = `multiplayer.html?${params.toString()}`;
}

function subscribeToCurrentRoom() {
    if (unsubscribeMatch) {
        unsubscribeMatch();
    }

    unsubscribeMatch = subscribeToMatch(currentRoomCode, match => {
        if (!match) {
            roomStatus.textContent = "Room no longer exists.";
            startGameBtn.disabled = true;
            return;
        }

        updateRoomUI(match);
    });
}

function updateRoomUI(match) {
    if (match.status === "started") {
        goToMatchPage();
        return;
    }

    const hasPlayer1 = Boolean(match.players?.p1);
    const hasPlayer2 = Boolean(match.players?.p2);
    const bothPlayersConnected = Boolean(match.players?.p1?.connected && match.players?.p2?.connected);

    player1Status.textContent = hasPlayer1
        ? `Player 1: ${match.players.p1.connected ? "Connected" : "Disconnected"}`
        : "Player 1: Empty";

    player2Status.textContent = hasPlayer2
        ? `Player 2: ${match.players.p2.connected ? "Connected" : "Disconnected"}`
        : "Player 2: Empty";

    if (!hasPlayer2) {
        roomStatus.textContent = "Waiting for Player 2.";
    } else if (!bothPlayersConnected) {
        roomStatus.textContent = "A player disconnected.";
    } else if (playerSlot === "p1") {
        roomStatus.textContent = "Both players connected. Host can start.";
    } else {
        roomStatus.textContent = "Both players connected. Waiting for host.";
    }

    startGameBtn.disabled = !(bothPlayersConnected && playerSlot === "p1");
}

createRoomBtn.addEventListener("click", async () => {
    try {
        setQueueControlsDisabled(true);
        roomStatus.textContent = "Creating room...";

        const roomCode = await createRoom(currentUser);

        playerSlot = "p1";
        setRoomCode(roomCode);
        await registerRoomPresence(roomCode, playerSlot, currentUser);
        await saveCurrentPlayerDeckAndReady(roomCode, playerSlot);
        subscribeToCurrentRoom();

        roomStatus.textContent = "Room created. Waiting for Player 2.";
    } catch (error) {
        roomStatus.textContent = error.message;
        setQueueControlsDisabled(false);
    }
});

joinRoomBtn.addEventListener("click", async () => {
    try {
        const roomCode = roomCodeInput.value.trim().toUpperCase();

        if (!roomCode) {
            roomStatus.textContent = "Enter a room code first.";
            return;
        }

        setQueueControlsDisabled(true);
        roomStatus.textContent = "Joining room...";

        const joinedRoomCode = await joinRoom(roomCode, currentUser);

        playerSlot = "p2";
        setRoomCode(joinedRoomCode);
        await registerRoomPresence(joinedRoomCode, playerSlot, currentUser);
        await saveCurrentPlayerDeckAndReady(joinedRoomCode, playerSlot);
        subscribeToCurrentRoom();
    } catch (error) {
        roomStatus.textContent = error.message;
        setQueueControlsDisabled(false);
    }
});

startGameBtn.addEventListener("click", async () => {
    if (!currentRoomCode || playerSlot !== "p1") return;

    try {
        startGameBtn.disabled = true;
        roomStatus.textContent = "Starting game...";

        await startMatch(currentRoomCode);
    } catch (error) {
        roomStatus.textContent = error.message;
        startGameBtn.disabled = false;
    }
});

async function initializeQueuePage() {
    try {
        setQueueControlsDisabled(true);
        startGameBtn.disabled = true;
        connectionStatus.textContent = "Loading cards...";

        await loadCardDatabase();

        initializeDeckPicker();
        connectionStatus.textContent = "Connecting...";

        await signInGuest();
        currentUser = await waitForUser();

        connectionStatus.textContent = "Connected as guest player.";
        setQueueControlsDisabled(false);
    } catch (error) {
        connectionStatus.textContent = "Could not connect.";
        roomStatus.textContent = error.message;
    }
}

initializeQueuePage();
