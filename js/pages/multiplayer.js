import {
    signInGuest,
    waitForUser
} from "../firebase/firebaseApp.js";

import {
    createRoom,
    joinRoom,
    subscribeToMatch,
    startMatch,
    setPlayerDeck,
    setPlayerReady
} from "../firebase/multiplayerService.js";

const connectionStatus = document.getElementById("connectionStatus");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const roomStatus = document.getElementById("roomStatus");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const deckPicker = document.getElementById("deckPicker");
const deckSelect = document.getElementById("deckSelect");
const readyBtn = document.getElementById("readyBtn");
const player1ReadyStatus = document.getElementById("player1ReadyStatus");
const player2ReadyStatus = document.getElementById("player2ReadyStatus");
const startMatchBtn = document.getElementById("startMatchBtn");

let currentUser = null;
let currentRoomCode = null;
let unsubscribeMatch = null;
let playerSlot = null;

const requiredElements = {
    connectionStatus,
    createRoomBtn,
    joinRoomBtn,
    roomCodeInput,
    roomStatus,
    roomCodeDisplay,
    deckPicker,
    deckSelect,
    readyBtn,
    player1ReadyStatus,
    player2ReadyStatus,
    startMatchBtn
};

for (const [name, element] of Object.entries(requiredElements)) {
    if (!element) {
        console.error(`Missing HTML element: ${name}`);
    } else {
        console.log(`Found HTML element: ${name}`);
    }
}

async function initMultiplayerPage() {
    try {
        setButtonsDisabled(true);
        connectionStatus.textContent = "Connecting to multiplayer server...";

        await loadCardDatabase();
        populateDeckPicker();

        await signInGuest();

        currentUser = await waitForUser();

        connectionStatus.textContent = "Connected as guest player.";
        setButtonsDisabled(false);
    } catch (error) {
        connectionStatus.textContent = "Could not connect to multiplayer.";
        roomStatus.textContent = error.message;
    }
}

function populateDeckPicker() {
    const decks = window.getAvailableDecks?.() || [];

    deckSelect.innerHTML = "";

    decks.forEach(deck => {
        const option = document.createElement("option");

        option.value = deck.id;
        option.textContent = deck.name;

        deckSelect.appendChild(option);
    });
}

function setButtonsDisabled(disabled) {
    createRoomBtn.disabled = disabled;
    joinRoomBtn.disabled = disabled;
}

createRoomBtn.addEventListener("click", async () => {
    console.log("Create room button clicked");

    try {
        setButtonsDisabled(true);

        currentRoomCode = await createRoom(currentUser);
        playerSlot = "p1";

        console.log("Room created:", currentRoomCode);

        roomStatus.textContent = "Room created. Waiting for Player 2...";
        roomCodeDisplay.textContent = currentRoomCode;
        deckPicker.classList.remove("hidden");
        readyBtn.disabled = false;

        subscribeToCurrentRoom();
    } catch (error) {
        console.error("Create room error:", error);
        roomStatus.textContent = error.message;
        setButtonsDisabled(false);
    }
});

joinRoomBtn.addEventListener("click", async () => {
    try {
        const enteredCode = roomCodeInput.value;

        if (!enteredCode.trim()) {
            roomStatus.textContent = "Enter a room code first.";
            return;
        }

        setButtonsDisabled(true);

        currentRoomCode = await joinRoom(enteredCode, currentUser);
        playerSlot = "p2";

        roomStatus.textContent = "Joined room.";
        roomCodeDisplay.textContent = currentRoomCode;
        deckPicker.classList.remove("hidden");
        readyBtn.disabled = false;

        subscribeToCurrentRoom();
    } catch (error) {
        roomStatus.textContent = error.message;
        setButtonsDisabled(false);
    }
});

function subscribeToCurrentRoom() {
    if (unsubscribeMatch) {
        unsubscribeMatch();
    }

    unsubscribeMatch = subscribeToMatch(currentRoomCode, (match) => {
        if (!match) {
            roomStatus.textContent = "Room no longer exists.";
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
    const player1Ready = Boolean(match.players?.p1?.ready);
    const player2Ready = Boolean(match.players?.p2?.ready);

    player1ReadyStatus.textContent = `Player 1: ${player1Ready ? "Ready" : "Not ready"}`;
    player2ReadyStatus.textContent = `Player 2: ${player2Ready ? "Ready" : "Not ready"}`;

    if (hasPlayer1 && !hasPlayer2) {
        roomStatus.textContent = "Waiting for Player 2...";
    }

    if (hasPlayer1 && hasPlayer2) {
        roomStatus.textContent = player1Ready && player2Ready
            ? "Both players ready. Player 1 can start."
            : "Both players connected. Choose decks and ready up.";

        if (playerSlot === "p1") {
            startMatchBtn.classList.remove("hidden");
            startMatchBtn.disabled = !(player1Ready && player2Ready);
        }
    }
}

function goToMatchPage() {
    if (!currentRoomCode || !playerSlot) {
        roomStatus.textContent = "Missing room or player data.";
        return;
    }

    window.location.href = `self.html?mode=online&room=${currentRoomCode}&player=${playerSlot}`;
}

startMatchBtn.addEventListener("click", async () => {
    try {
        if (!currentRoomCode) {
            roomStatus.textContent = "No room code found.";
            return;
        }

        roomStatus.textContent = "Starting match...";
        startMatchBtn.disabled = true;

        await startMatch(currentRoomCode);
    } catch (error) {
        console.error("Start match error:", error);
        roomStatus.textContent = error.message;
        startMatchBtn.disabled = false;
    }
});

readyBtn.addEventListener("click", async () => {
    try {
        if (!currentRoomCode || !currentUser) {
            roomStatus.textContent = "Join or create a room first.";
            return;
        }

        const selectedDeck = window.getDeckById?.(deckSelect.value);

        if (!selectedDeck) {
            roomStatus.textContent = "Choose a deck first.";
            return;
        }

        readyBtn.disabled = true;
        roomStatus.textContent = "Saving deck...";

        await setPlayerDeck(currentRoomCode, currentUser.uid, {
            id: selectedDeck.id,
            name: selectedDeck.name,
            leaderKey: selectedDeck.leaderKey,
            deckText: selectedDeck.deckText
        });
        await setPlayerReady(currentRoomCode, currentUser.uid, true);

        roomStatus.textContent = "Ready. Waiting for opponent.";
    } catch (error) {
        console.error("Ready error:", error);
        roomStatus.textContent = error.message;
        readyBtn.disabled = false;
    }
});

initMultiplayerPage();
