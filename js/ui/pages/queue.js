import {
    signInGuest,
    waitForUser
} from "../../multiplayer/firebase/firebaseApp.js";

import {
    createRoom,
    getMatch,
    joinRoom,
    subscribeToMatch,
    openPlayArea,
    registerRoomPresence,
    setPlayerDeck,
    setPlayerReady
} from "../../multiplayer/firebase/multiplayerService.js";

const connectionStatus = document.getElementById("connectionStatus");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const queueDeckButton = document.getElementById("queueDeckButton");
const queueDeckHelp = document.getElementById("queueDeckHelp");
const roomCodeInput = document.getElementById("roomCodeInput");
const roomStatus = document.getElementById("roomStatus");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const player1Status = document.getElementById("player1Status");
const player2Status = document.getElementById("player2Status");
const readyUpBtn = document.getElementById("readyUpBtn");
const openPlayAreaBtn = document.getElementById("startGameBtn");

let currentUser = null;
let currentRoomCode = null;
let playerSlot = null;
let unsubscribeMatch = null;
let currentMatch = null;
let queueBusy = true;

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

    updateQueueDeckButtonLabel();

    queueDeckButton.addEventListener("click", () => {
        if (isQueueDeckLocked()) {
            return;
        }

        window.openDeckPickerPopup?.({
            title: "Online Deck",
            initialSelection: (window.getStoredDeckSelection?.() || {}).onlineSelection,
            onConfirm: async (selection) => {
                if (isQueueDeckLocked()) {
                    updateQueueDeckButtonLabel();
                    return;
                }

                saveQueueDeckSelection(selection);
                updateQueueDeckButtonLabel();

                if (currentRoomCode && currentUser?.uid) {
                    try {
                        await saveCurrentPlayerDeck(currentRoomCode);
                        await setCurrentPlayerReady(false);
                    } catch (error) {
                        roomStatus.textContent = error.message;
                    }
                }
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

function updateQueueDeckButtonLabel() {
    if (!queueDeckButton) {
        return;
    }

    const onlineSelection = (window.getStoredDeckSelection?.() || {}).onlineSelection;
    const deck = window.resolveDeckSelection?.(onlineSelection);
    queueDeckButton.textContent = deck?.name || "Choose Deck";
    updateQueueDeckHelpText();
}

function hasActiveRoom() {
    return Boolean(currentRoomCode && playerSlot);
}

function isQueueDeckLocked(match = currentMatch) {
    if (queueBusy) {
        return true;
    }

    if (!hasActiveRoom()) {
        return false;
    }

    const ownPlayer = playerSlot ? match?.players?.[playerSlot] : null;
    return Boolean(ownPlayer?.ready);
}

function updateQueueDeckHelpText(match = currentMatch) {
    if (!queueDeckHelp) {
        return;
    }

    if (queueBusy) {
        queueDeckHelp.textContent = hasActiveRoom()
            ? "Updating room state..."
            : "Pick the deck you want to use in this room.";
        return;
    }

    if (isQueueDeckLocked(match)) {
        queueDeckHelp.textContent = "Deck is locked while you are ready. Cancel Ready to change it.";
        return;
    }

    if (hasActiveRoom()) {
        queueDeckHelp.textContent = "You can change decks until you ready up.";
        return;
    }

    queueDeckHelp.textContent = "Pick the deck you want to use in this room.";
}

function refreshQueueControlStates(match = currentMatch) {
    const ownPlayer = playerSlot ? match?.players?.[playerSlot] : null;
    const selectedDeck = getSelectedQueueDeck();
    const inRoom = hasActiveRoom();
    const canReady = Boolean(
        currentRoomCode &&
        playerSlot &&
        selectedDeck &&
        ownPlayer?.connected
    );

    createRoomBtn.disabled = queueBusy || inRoom;
    joinRoomBtn.disabled = queueBusy || inRoom;
    roomCodeInput.disabled = queueBusy || inRoom;

    if (queueDeckButton) {
        queueDeckButton.disabled = isQueueDeckLocked(match);
        queueDeckButton.title = ownPlayer?.ready ? "Cancel Ready to change decks." : "";
    }

    if (readyUpBtn) {
        readyUpBtn.disabled = queueBusy || !canReady;
    }

    updateQueueDeckHelpText(match);
}

function setRoomCode(roomCode) {
    currentRoomCode = roomCode;
    roomCodeDisplay.textContent = roomCode || "------";
    refreshQueueControlStates();
}

function getSelectedQueueDeck() {
    return window.resolveDeckSelection?.((window.getStoredDeckSelection?.() || {}).onlineSelection) || null;
}

async function saveCurrentPlayerDeck(roomCode) {
    if (!currentUser?.uid || !roomCode) {
        return;
    }

    const selectedDeck = getSelectedQueueDeck();

    if (!selectedDeck) {
        return;
    }

    await setPlayerDeck(roomCode, currentUser.uid, selectedDeck);
}

async function setCurrentPlayerReady(ready) {
    if (!currentRoomCode || !currentUser?.uid) {
        return;
    }

    await setPlayerReady(currentRoomCode, currentUser.uid, ready);
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
            currentMatch = null;
            currentRoomCode = null;
            playerSlot = null;
            roomCodeDisplay.textContent = "------";
            roomStatus.textContent = "Room no longer exists.";
            player1Status.textContent = "Player 1: Empty";
            player2Status.textContent = "Player 2: Empty";
            openPlayAreaBtn.disabled = true;
            refreshQueueControlStates();
            return;
        }

        updateRoomUI(match);
    });
}

function updateRoomUI(match) {
    currentMatch = match;

    if (match.status === "viewing" || match.status === "started") {
        goToMatchPage();
        return;
    }

    const hasPlayer1 = Boolean(match.players?.p1);
    const hasPlayer2 = Boolean(match.players?.p2);
    const bothPlayersConnected = Boolean(match.players?.p1?.connected && match.players?.p2?.connected);
    const bothPlayersReady = Boolean(match.players?.p1?.ready && match.players?.p2?.ready);
    const ownPlayer = playerSlot ? match.players?.[playerSlot] : null;

    player1Status.textContent = hasPlayer1
        ? `Player 1: ${match.players.p1.connected ? "Connected" : "Disconnected"}${match.players.p1.ready ? " • Ready" : ""}`
        : "Player 1: Empty";

    player2Status.textContent = hasPlayer2
        ? `Player 2: ${match.players.p2.connected ? "Connected" : "Disconnected"}${match.players.p2.ready ? " • Ready" : ""}`
        : "Player 2: Empty";

    if (!hasPlayer2) {
        roomStatus.textContent = "Waiting for Player 2.";
    } else if (!bothPlayersConnected) {
        roomStatus.textContent = "A player disconnected.";
    } else if (!bothPlayersReady) {
        roomStatus.textContent = "Both players connected. Ready up before opening the play area.";
    } else if (playerSlot === "p1") {
        roomStatus.textContent = "Both players are ready. Host can open the play area.";
    } else {
        roomStatus.textContent = "Both players are ready. Waiting for the host to open the play area.";
    }

    if (readyUpBtn) {
        readyUpBtn.textContent = ownPlayer?.ready ? "Cancel Ready" : "Ready Up";
    }

    openPlayAreaBtn.disabled = !(bothPlayersConnected && bothPlayersReady && playerSlot === "p1");
    refreshQueueControlStates(match);
}

createRoomBtn.addEventListener("click", async () => {
    try {
        queueBusy = true;
        refreshQueueControlStates();
        roomStatus.textContent = "Creating room...";

        const roomCode = await createRoom(currentUser);

        playerSlot = "p1";
        setRoomCode(roomCode);
        await registerRoomPresence(roomCode, playerSlot, currentUser);
        await saveCurrentPlayerDeck(roomCode);
        subscribeToCurrentRoom();

        roomStatus.textContent = "Room created. Waiting for Player 2.";
        queueBusy = false;
        refreshQueueControlStates();
    } catch (error) {
        roomStatus.textContent = error.message;
        queueBusy = false;
        refreshQueueControlStates();
    }
});

joinRoomBtn.addEventListener("click", async () => {
    try {
        const roomCode = roomCodeInput.value.trim().toUpperCase();

        if (!roomCode) {
            roomStatus.textContent = "Enter a room code first.";
            return;
        }

        queueBusy = true;
        refreshQueueControlStates();
        roomStatus.textContent = "Joining room...";

        const joinedRoomCode = await joinRoom(roomCode, currentUser);

        playerSlot = "p2";
        setRoomCode(joinedRoomCode);
        await registerRoomPresence(joinedRoomCode, playerSlot, currentUser);
        await saveCurrentPlayerDeck(joinedRoomCode);
        subscribeToCurrentRoom();
        queueBusy = false;
        refreshQueueControlStates();
    } catch (error) {
        roomStatus.textContent = error.message;
        queueBusy = false;
        refreshQueueControlStates();
    }
});

openPlayAreaBtn.addEventListener("click", async () => {
    if (!currentRoomCode || playerSlot !== "p1") return;

    try {
        openPlayAreaBtn.disabled = true;
        roomStatus.textContent = "Opening play area...";

        await openPlayArea(currentRoomCode);
    } catch (error) {
        roomStatus.textContent = error.message;
        openPlayAreaBtn.disabled = false;
    }
});

readyUpBtn?.addEventListener("click", async () => {
    if (!currentRoomCode || !playerSlot) {
        return;
    }

    try {
        const selectedDeck = getSelectedQueueDeck();

        if (!selectedDeck) {
            roomStatus.textContent = "Choose a deck before readying up.";
            return;
        }

        queueBusy = true;
        refreshQueueControlStates();
        roomStatus.textContent = "Updating ready status...";

        const currentMatch = await getMatch(currentRoomCode);
        const ownPlayer = currentMatch?.players?.[playerSlot];
        const nextReadyState = !ownPlayer?.ready;

        await saveCurrentPlayerDeck(currentRoomCode);
        await setCurrentPlayerReady(nextReadyState);
    } catch (error) {
        roomStatus.textContent = error.message;
    } finally {
        queueBusy = false;
        refreshQueueControlStates();
    }
});

async function initializeQueuePage() {
    try {
        queueBusy = true;
        refreshQueueControlStates();
        openPlayAreaBtn.disabled = true;
        connectionStatus.textContent = "Loading cards...";

        await loadCardDatabase();

        initializeDeckPicker();
        connectionStatus.textContent = "Connecting...";

        await signInGuest();
        currentUser = await waitForUser();

        connectionStatus.textContent = "Connected as guest player.";
        queueBusy = false;
        refreshQueueControlStates();
    } catch (error) {
        connectionStatus.textContent = "Could not connect.";
        roomStatus.textContent = error.message;
        queueBusy = false;
        refreshQueueControlStates();
    }
}

initializeQueuePage();
