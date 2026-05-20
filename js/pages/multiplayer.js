import {
    signInGuest,
    waitForUser
} from "../firebase/firebaseApp.js";

import {
    createRoom,
    joinRoom,
    subscribeToMatch,
    startMatch
} from "../firebase/multiplayerService.js";

const connectionStatus = document.getElementById("connectionStatus");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const roomStatus = document.getElementById("roomStatus");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
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

        await signInGuest();

        currentUser = await waitForUser();

        connectionStatus.textContent = "Connected as guest player.";
        setButtonsDisabled(false);
    } catch (error) {
        connectionStatus.textContent = "Could not connect to multiplayer.";
        roomStatus.textContent = error.message;
    }
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

    if (hasPlayer1 && !hasPlayer2) {
        roomStatus.textContent = "Waiting for Player 2...";
    }

    if (hasPlayer1 && hasPlayer2) {
        roomStatus.textContent = "Both players connected. Ready to start.";

        if (playerSlot === "p1") {
            startMatchBtn.classList.remove("hidden");
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

initMultiplayerPage();