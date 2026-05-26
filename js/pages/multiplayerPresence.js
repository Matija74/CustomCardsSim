import {
    signInGuest,
    waitForUser
} from "../firebase/firebaseApp.js";

import {
    registerRoomPresence
} from "../firebase/multiplayerService.js";

async function initializeMultiplayerPresence() {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get("room");
    const playerSlot = params.get("player");

    if (!roomCode || (playerSlot !== "p1" && playerSlot !== "p2")) {
        return;
    }

    try {
        await signInGuest();
        const currentUser = await waitForUser();
        await registerRoomPresence(roomCode, playerSlot, currentUser);
    } catch (error) {
        console.error("Failed to register multiplayer presence:", error);
    }
}

initializeMultiplayerPresence();
