import {
    ref,
    set,
    get,
    update,
    onValue,
    serverTimestamp,
    onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { database } from "./firebaseApp.js";
import { firebaseConfig } from "./firebaseConfig.js";

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function cleanRoomCode(roomCode) {
    return String(roomCode || "").trim().toUpperCase();
}

function getRoomRef(roomCode) {
    return ref(database, `matches/${cleanRoomCode(roomCode)}`);
}

function normalizePlayerSlot(playerSlot) {
    if (playerSlot !== "p1" && playerSlot !== "p2") {
        throw new Error("Invalid player slot.");
    }

    return playerSlot;
}

function cloneData(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

async function touchRoom(roomCode, extra = {}) {
    await update(getRoomRef(roomCode), {
        updatedAt: serverTimestamp(),
        ...extra
    });
}

export async function createRoom(user) {
    if (!user?.uid) {
        throw new Error("No user found. Guest login did not finish.");
    }

    const roomCode = generateRoomCode();

    await set(getRoomRef(roomCode), {
        status: "waiting",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        hostUid: user.uid,
        players: {
            p1: {
                uid: user.uid,
                name: "Player 1",
                connected: false,
                disconnectedAt: null,
                lastSeenAt: serverTimestamp(),
                ready: false
            }
        },
        public: {
            phase: "viewOnly"
        },
        private: {
            [user.uid]: {
                selectedDeck: null
            }
        }
    });

    return roomCode;
}

export async function joinRoom(roomCode, user) {
    if (!user?.uid) {
        throw new Error("No user found. Guest login did not finish.");
    }

    const normalizedRoomCode = cleanRoomCode(roomCode);
    const matchRef = getRoomRef(normalizedRoomCode);
    const snapshot = await get(matchRef);

    if (!snapshot.exists()) {
        throw new Error("Room does not exist.");
    }

    const match = snapshot.val();

    if (match.players?.p2 && match.players.p2.uid !== user.uid && match.players.p2.connected) {
        throw new Error("Room is already full.");
    }

    await update(matchRef, {
        status: "ready",
        updatedAt: serverTimestamp(),
        "players/p2": {
            uid: user.uid,
            name: "Player 2",
            connected: false,
            disconnectedAt: null,
            lastSeenAt: serverTimestamp(),
            ready: false
        },
        [`private/${user.uid}`]: {
            selectedDeck: null
        }
    });

    return normalizedRoomCode;
}

export function subscribeToMatch(roomCode, callback) {
    return onValue(getRoomRef(roomCode), snapshot => {
        const match = snapshot.val();

        if (!match) {
            callback(null);
            return;
        }

        const { private: _private, ...publicMatch } = match;
        callback(publicMatch);
    });
}

export function subscribeToFullMatch(roomCode, callback) {
    return onValue(getRoomRef(roomCode), snapshot => callback(snapshot.val() || null));
}

export function subscribeToPrivateGameState(roomCode, uid, callback) {
    return onValue(ref(database, `matches/${cleanRoomCode(roomCode)}/private/${uid}/gameState`), snapshot => callback(snapshot.val() || null));
}

export async function submitGameplayCommand(roomCode, user, playerSlot, command) {
    normalizePlayerSlot(playerSlot);
    if (!user?.uid || command?.playerId !== playerSlot || !/^[A-Za-z0-9_-]{1,100}$/.test(command?.id || "") || !command?.type) throw new Error("Invalid gameplay command.");
    const match = await getMatch(roomCode);
    if (match?.players?.[playerSlot]?.uid !== user.uid) throw new Error("This player slot belongs to another user.");
    await set(ref(database, `matches/${cleanRoomCode(roomCode)}/commands/${command.id}`), {
        uid: user.uid,
        playerId: playerSlot,
        createdAt: serverTimestamp(),
        command: cloneData(command)
    });
}

export async function publishGameplayState(roomCode, hostUid, playerUids, authoritativeState, stateByPlayer, publicSummary, processedCommandIds) {
    const match = await getMatch(roomCode);
    if (match?.hostUid !== hostUid) throw new Error("Only the room host can publish gameplay state.");
    const updates = {
        status: publicSummary.phase === "gameOver" ? "finished" : "started",
        updatedAt: serverTimestamp(),
        "public/game": cloneData(publicSummary),
        [`private/${hostUid}/authoritativeGame`]: cloneData(authoritativeState),
        [`private/${playerUids.p1}/gameState`]: cloneData(stateByPlayer.p1),
        [`private/${playerUids.p2}/gameState`]: cloneData(stateByPlayer.p2),
        "processedCommands": Object.fromEntries(processedCommandIds.map(id => [id, true]))
    };
    for (const id of processedCommandIds) updates[`commands/${id}`] = null;
    await update(getRoomRef(roomCode), updates);
}

export async function getMatch(roomCode) {
    const snapshot = await get(getRoomRef(roomCode));
    return snapshot.val();
}

export async function setPlayerDeck(roomCode, uid, deckData) {
    if (!uid) {
        throw new Error("A player is required to save a deck selection.");
    }

    if (!deckData?.leaderKey || !deckData?.deckText) {
        throw new Error("Choose a valid deck before continuing.");
    }

    await update(ref(database, `matches/${cleanRoomCode(roomCode)}/private/${uid}`), {
        selectedDeck: cloneData(deckData)
    });
    await touchRoom(roomCode);
}

export async function setPlayerReady(roomCode, uid, ready) {
    const match = await getMatch(roomCode);
    const playerEntry = Object.entries(match?.players || {})
        .find(([, player]) => player.uid === uid);

    if (!playerEntry) {
        throw new Error("Player is not in this room.");
    }

    await update(getRoomRef(roomCode), {
        updatedAt: serverTimestamp(),
        [`players/${playerEntry[0]}/ready`]: Boolean(ready)
    });
}

export async function openPlayArea(roomCode) {
    const matchRef = getRoomRef(roomCode);
    const snapshot = await get(matchRef);

    if (!snapshot.exists()) {
        throw new Error("Room does not exist.");
    }

    const match = snapshot.val();
    const players = match.players || {};

    if (!players.p1?.connected || !players.p2?.connected) {
        throw new Error("Both players must be connected.");
    }

    if (!players.p1?.ready || !players.p2?.ready) {
        throw new Error("Both players must be ready.");
    }

    await update(matchRef, {
        status: "started",
        updatedAt: serverTimestamp(),
        "public/phase": "diceRoll"
    });
}

export async function registerRoomPresence(roomCode, playerSlot, user) {
    normalizePlayerSlot(playerSlot);

    if (!user?.uid) {
        throw new Error("User is required to register room presence.");
    }

    const room = cleanRoomCode(roomCode);
    const match = await getMatch(room);
    const player = match?.players?.[playerSlot];

    if (!player) {
        throw new Error("Room player slot does not exist.");
    }

    if (player.uid && player.uid !== user.uid) {
        throw new Error("This room slot belongs to a different player.");
    }

    const playerRef = ref(database, `matches/${room}/players/${playerSlot}`);
    const disconnectHandler = onDisconnect(playerRef);

    await disconnectHandler.cancel();
    await update(playerRef, {
        uid: user.uid,
        connected: true,
        disconnectedAt: null,
        lastSeenAt: serverTimestamp()
    });
    await disconnectHandler.update({
        connected: false,
        disconnectedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp()
    });
    await touchRoom(room);
}

export async function createImmediateDisconnectRequest(roomCode, playerSlot, user) {
    normalizePlayerSlot(playerSlot);

    if (!user?.uid) {
        throw new Error("User is required to prepare room disconnect handling.");
    }

    const room = cleanRoomCode(roomCode);
    const idToken = await user.getIdToken();
    const url = new URL(`matches/${room}/players/${playerSlot}.json`, firebaseConfig.databaseURL);

    url.searchParams.set("auth", idToken);

    return {
        url: url.toString(),
        body: JSON.stringify({
            connected: false,
            disconnectedAt: { ".sv": "timestamp" },
            lastSeenAt: { ".sv": "timestamp" }
        })
    };
}

export function sendImmediateDisconnectRequest(request) {
    if (!request?.url || !request?.body) {
        return;
    }

    fetch(request.url, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: request.body,
        keepalive: true
    }).catch(error => {
        console.error("Failed to send immediate disconnect request:", error);
    });
}
