import {
    signInGuest,
    waitForUser
} from "../firebase/firebaseApp.js";

import {
    createRoom,
    joinRoom,
    subscribeToMatch,
    startQueuedMatch
} from "../firebase/multiplayerService.js";

const connectionStatus = document.getElementById("connectionStatus");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
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

function setQueueControlsDisabled(disabled) {
    createRoomBtn.disabled = disabled;
    joinRoomBtn.disabled = disabled;
    roomCodeInput.disabled = disabled;
}

function setRoomCode(roomCode) {
    currentRoomCode = roomCode;
    roomCodeDisplay.textContent = roomCode || "------";
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
    const bothPlayersConnected = hasPlayer1 && hasPlayer2;

    player1Status.textContent = hasPlayer1
        ? "Player 1: Connected"
        : "Player 1: Empty";

    player2Status.textContent = hasPlayer2
        ? "Player 2: Connected"
        : "Player 2: Empty";

    if (!hasPlayer2) {
        roomStatus.textContent = "Waiting for Player 2.";
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

        await startQueuedMatch(currentRoomCode);
    } catch (error) {
        roomStatus.textContent = error.message;
        startGameBtn.disabled = false;
    }
});

async function initializeQueuePage() {
    try {
        setQueueControlsDisabled(true);
        startGameBtn.disabled = true;
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
