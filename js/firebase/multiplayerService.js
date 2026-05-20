import {
    ref,
    set,
    get,
    update,
    onValue,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { database } from "./firebaseApp.js";

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createRoom(user) {
    console.log("createRoom() called with user:", user);

    if (!user) {
        throw new Error("No user found. Guest login did not finish.");
    }

    const roomCode = generateRoomCode();
    console.log("Generated room code:", roomCode);

    const matchRef = ref(database, `matches/${roomCode}`);
    console.log("Firebase match ref created:", matchRef);

    await set(matchRef, {
        status: "waiting",
        createdAt: serverTimestamp(),
        hostUid: user.uid,

        players: {
            p1: {
                uid: user.uid,
                name: "Player 1",
                connected: true
            }
        },

        public: {
            phase: "waiting",
            currentPlayer: null,
            turnNumber: 0,
            winner: null
        },

        private: {
            [user.uid]: {
                hand: [],
                deck: [],
                life: []
            }
        }
    });

    console.log("Firebase set() finished.");

    return roomCode;
}

export async function joinRoom(roomCode, user) {
    const cleanRoomCode = roomCode.trim().toUpperCase();
    const matchRef = ref(database, `matches/${cleanRoomCode}`);

    const snapshot = await get(matchRef);

    if (!snapshot.exists()) {
        throw new Error("Room does not exist.");
    }

    const match = snapshot.val();

    if (match.players?.p2 && match.players.p2.uid !== user.uid) {
        throw new Error("Room is already full.");
    }

    await update(matchRef, {
        status: "ready",

        "players/p2": {
            uid: user.uid,
            name: "Player 2",
            connected: true
        },

        [`private/${user.uid}`]: {
            hand: [],
            deck: [],
            life: []
        }
    });

    return cleanRoomCode;
}

export function subscribeToMatch(roomCode, callback) {
    const matchRef = ref(database, `matches/${roomCode}`);

    return onValue(matchRef, (snapshot) => {
        callback(snapshot.val());
    });
}

export async function startMatch(roomCode) {
    const matchRef = ref(database, `matches/${roomCode}`);

    await update(matchRef, {
        status: "started",
        "public/phase": "setup",
        "public/currentPlayer": "p1",
        "public/turnNumber": 1
    });
}