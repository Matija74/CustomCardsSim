import {
    signInGuest,
    waitForUser
} from "../firebase/firebaseApp.js";

import {
    createImmediateDisconnectRequest,
    registerRoomPresence,
    sendImmediateDisconnectRequest,
    subscribeToMatch
} from "../firebase/multiplayerService.js";

let currentUser = null;
let roomCode = null;
let localSlot = null;
let unsubscribeMatch = null;
let immediateDisconnectRequest = null;
let didSendImmediateDisconnect = false;
let restoringPresence = false;

window.__multiplayerRuntime = {
    getLocalSlot: () => localSlot,
    isActive: () => Boolean(roomCode && localSlot && currentUser)
};

function setConnectionState(state, title) {
    document.body.dataset.multiplayerConnection = state;

    const phaseButton = document.getElementById("phaseButton");

    if (phaseButton) {
        phaseButton.disabled = true;
        phaseButton.textContent = "Gameplay Disabled";
        phaseButton.title = title || "This page is a view-only play area.";
    }
}

function sendImmediateDisconnectOnExit() {
    if (didSendImmediateDisconnect || !immediateDisconnectRequest) {
        return;
    }

    didSendImmediateDisconnect = true;
    sendImmediateDisconnectRequest(immediateDisconnectRequest);
}

async function restorePresenceIfNeeded(match) {
    const ownPlayer = match?.players?.[localSlot];

    if (
        restoringPresence ||
        !ownPlayer ||
        ownPlayer.uid !== currentUser?.uid ||
        ownPlayer.connected !== false
    ) {
        return;
    }

    restoringPresence = true;

    try {
        await registerRoomPresence(roomCode, localSlot, currentUser);
    } finally {
        restoringPresence = false;
    }
}

async function initializeConnection() {
    const params = new URLSearchParams(window.location.search);

    roomCode = params.get("room");
    localSlot = params.get("player");

    setConnectionState("view-only", "This page is a view-only play area.");

    if (!roomCode || (localSlot !== "p1" && localSlot !== "p2")) {
        return;
    }

    setConnectionState("connecting", `Connecting to room ${roomCode}...`);

    await signInGuest();
    currentUser = await waitForUser();
    immediateDisconnectRequest = await createImmediateDisconnectRequest(
        roomCode,
        localSlot,
        currentUser
    );
    await registerRoomPresence(roomCode, localSlot, currentUser);

    window.addEventListener("pagehide", sendImmediateDisconnectOnExit);
    window.addEventListener("beforeunload", sendImmediateDisconnectOnExit);

    unsubscribeMatch = subscribeToMatch(roomCode, match => {
        if (!match) {
            setConnectionState("closed", "The multiplayer room is closed.");
            return;
        }

        restorePresenceIfNeeded(match).catch(error => {
            console.error("Failed to restore multiplayer presence:", error);
        });

        const opponentSlot = localSlot === "p1" ? "p2" : "p1";
        const opponentConnected = Boolean(match.players?.[opponentSlot]?.connected);
        const connectionTitle = opponentConnected
            ? `Connected to room ${roomCode}.`
            : `Connected to room ${roomCode}; waiting for the other player.`;

        setConnectionState("connected", connectionTitle);
    });
}

initializeConnection().catch(error => {
    console.error("Failed to initialize multiplayer connection:", error);
    setConnectionState("error", "Multiplayer connection failed.");
});
