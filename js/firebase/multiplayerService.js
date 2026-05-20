import {
    ref,
    set,
    get,
    update,
    onValue,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { database } from "./firebaseApp.js";

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function cleanRoomCode(roomCode) {
    return String(roomCode || "").trim().toUpperCase();
}

function cloneData(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

function createMultiplayerCard(card) {
    return {
        ...cloneData(card),
        aliases: card.aliases ? [...card.aliases] : [],
        keywords: card.keywords ? [...card.keywords] : [],
        effects: card.effects ? cloneData(card.effects) : [],
        instanceId: crypto.randomUUID(),
        state: card.state || "active",
        attachedDon: Number(card.attachedDon || 0)
    };
}

function requireDeckTools() {
    if (
        typeof globalThis.getCardById !== "function" ||
        typeof globalThis.parseDeckText !== "function" ||
        typeof globalThis.shuffleDeck !== "function" ||
        !globalThis.leaders
    ) {
        throw new Error("Card database and deck parser must be loaded before initializing multiplayer.");
    }
}

function createInitialPrivateState(selectedDeck) {
    requireDeckTools();

    const leaderDefinition = globalThis.leaders[selectedDeck.leaderKey];

    if (!leaderDefinition) {
        throw new Error(`Leader not found for deck: ${selectedDeck.name}`);
    }

    const deck = globalThis.shuffleDeck(globalThis.parseDeckText(selectedDeck.deckText))
        .map(card => createMultiplayerCard(card));
    const hand = deck.splice(0, 5);
    const leader = createMultiplayerCard(leaderDefinition);
    const life = [];
    const lifeAmount = Number(leader.life || 0);

    for (let i = 0; i < lifeAmount; i++) {
        const lifeCard = deck.shift();

        if (lifeCard) {
            life.push(lifeCard);
        }
    }

    return {
        selectedDeck,
        hand,
        deck,
        life,
        leader
    };
}

function createInitialPublicPlayerState(privateState) {
    return {
        leader: privateState.leader,
        characters: [],
        stage: null,
        trash: [],
        handCount: privateState.hand.length,
        deckCount: privateState.deck.length,
        lifeCount: privateState.life.length,
        activeTokens: 0,
        restedTokens: 0,
        tokenDeckCount: 10,
        turns: 0
    };
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
                connected: true,
                ready: false
            }
        },

        public: {
            phase: "waiting",
            currentPlayer: null,
            turnNumber: 0,
            winner: null,
            player1: null,
            player2: null
        },

        private: {
            [user.uid]: {
                selectedDeck: null,
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
            connected: true,
            ready: false
        },

        [`private/${user.uid}`]: {
            selectedDeck: null,
            hand: [],
            deck: [],
            life: []
        }
    });

    return cleanRoomCode;
}

export function subscribeToMatch(roomCode, callback) {
    const matchRef = ref(database, `matches/${cleanRoomCode(roomCode)}`);

    return onValue(matchRef, (snapshot) => {
        const match = snapshot.val();

        if (!match) {
            callback(null);
            return;
        }

        const { private: _private, ...publicMatch } = match;

        callback(publicMatch);
    });
}

export function subscribeToPublicState(roomCode, callback) {
    const publicRef = ref(database, `matches/${cleanRoomCode(roomCode)}/public`);

    return onValue(publicRef, (snapshot) => {
        callback(snapshot.val());
    });
}

export function subscribeToPrivateState(roomCode, uid, callback) {
    const privateRef = ref(database, `matches/${cleanRoomCode(roomCode)}/private/${uid}`);

    return onValue(privateRef, (snapshot) => {
        callback(snapshot.val());
    });
}

export async function getMatch(roomCode) {
    const matchRef = ref(database, `matches/${cleanRoomCode(roomCode)}`);
    const snapshot = await get(matchRef);

    return snapshot.val();
}

export async function updatePublicState(roomCode, partialState) {
    const publicRef = ref(database, `matches/${cleanRoomCode(roomCode)}/public`);

    await update(publicRef, partialState);
}

export async function updatePrivateState(roomCode, uid, partialState) {
    const privateRef = ref(database, `matches/${cleanRoomCode(roomCode)}/private/${uid}`);

    await update(privateRef, partialState);
}

export async function setPlayerDeck(roomCode, uid, deckData) {
    await updatePrivateState(roomCode, uid, {
        selectedDeck: deckData
    });
}

export async function setPlayerReady(roomCode, uid, ready) {
    const match = await getMatch(roomCode);
    const playerEntry = Object.entries(match?.players || {})
        .find(([, player]) => player.uid === uid);

    if (!playerEntry) {
        throw new Error("Player is not in this room.");
    }

    await update(ref(database, `matches/${cleanRoomCode(roomCode)}`), {
        [`players/${playerEntry[0]}/ready`]: Boolean(ready)
    });
}

export async function initializeMultiplayerGame(roomCode) {
    const matchRef = ref(database, `matches/${cleanRoomCode(roomCode)}`);
    const snapshot = await get(matchRef);

    if (!snapshot.exists()) {
        throw new Error("Room does not exist.");
    }

    const match = snapshot.val();
    const player1 = match.players?.p1;
    const player2 = match.players?.p2;

    if (!player1 || !player2) {
        throw new Error("Both players must be connected.");
    }

    if (!player1.ready || !player2.ready) {
        throw new Error("Both players must be ready before starting.");
    }

    const player1Deck = match.private?.[player1.uid]?.selectedDeck;
    const player2Deck = match.private?.[player2.uid]?.selectedDeck;

    if (!player1Deck || !player2Deck) {
        throw new Error("Both players must choose decks before starting.");
    }

    const p1Private = createInitialPrivateState(player1Deck);
    const p2Private = createInitialPrivateState(player2Deck);

    await update(matchRef, {
        status: "started",
        "public/phase": "diceRoll",
        "public/currentPlayer": null,
        "public/turnNumber": 0,
        "public/winner": null,
        "public/firstPlayer": null,
        "public/secondPlayer": null,
        "public/playerTurns": {
            p1: 0,
            p2: 0
        },
        "public/revealedCards": [],
        "public/setup": {
            dice: {
                p1Roll: null,
                p2Roll: null,
                winner: null,
                tie: false
            },
            turnChoice: {
                chooser: null,
                firstPlayer: null,
                secondPlayer: null
            }
        },
        "public/player1": {
            ...createInitialPublicPlayerState(p1Private)
        },
        "public/player2": createInitialPublicPlayerState(p2Private),
        [`private/${player1.uid}`]: p1Private,
        [`private/${player2.uid}`]: p2Private
    });
}

export async function rollMultiplayerDice(roomCode, playerSlot) {
    if (playerSlot !== "p1" && playerSlot !== "p2") {
        throw new Error("Invalid player slot.");
    }

    const diceRef = ref(database, `matches/${cleanRoomCode(roomCode)}/public/setup/dice`);
    const roll = Math.floor(Math.random() * 20) + 1;

    return runTransaction(diceRef, (dice = {}) => {
        const ownKey = `${playerSlot}Roll`;
        const otherKey = playerSlot === "p1" ? "p2Roll" : "p1Roll";

        if (dice.winner && !dice.tie) {
            return;
        }

        if (dice[ownKey] && !dice.tie) {
            return;
        }

        const nextDice = dice.tie
            ? { p1Roll: null, p2Roll: null, winner: null, tie: false }
            : { ...dice };

        nextDice[ownKey] = roll;

        if (nextDice[otherKey]) {
            if (nextDice.p1Roll === nextDice.p2Roll) {
                nextDice.tie = true;
                nextDice.winner = null;
            } else {
                nextDice.tie = false;
                nextDice.winner = nextDice.p1Roll > nextDice.p2Roll ? "p1" : "p2";
            }
        }

        return nextDice;
    });
}

export async function chooseMultiplayerTurnOrder(roomCode, chooserSlot, choice) {
    if (chooserSlot !== "p1" && chooserSlot !== "p2") {
        throw new Error("Invalid player slot.");
    }

    if (choice !== "first" && choice !== "second") {
        throw new Error("Invalid turn choice.");
    }

    const publicRef = ref(database, `matches/${cleanRoomCode(roomCode)}/public`);

    return runTransaction(publicRef, (publicState) => {
        const diceWinner = publicState?.setup?.dice?.winner;

        if (!publicState || publicState.phase !== "diceRoll" || diceWinner !== chooserSlot) {
            return;
        }

        const otherSlot = chooserSlot === "p1" ? "p2" : "p1";
        const firstPlayer = choice === "first" ? chooserSlot : otherSlot;
        const secondPlayer = firstPlayer === "p1" ? "p2" : "p1";
        const firstPublicKey = firstPlayer === "p1" ? "player1" : "player2";

        return {
            ...publicState,
            phase: "main",
            currentPlayer: firstPlayer,
            turnNumber: 1,
            firstPlayer,
            secondPlayer,
            playerTurns: {
                p1: firstPlayer === "p1" ? 1 : 0,
                p2: firstPlayer === "p2" ? 1 : 0
            },
            setup: {
                ...publicState.setup,
                turnChoice: {
                    chooser: chooserSlot,
                    firstPlayer,
                    secondPlayer
                }
            },
            [firstPublicKey]: {
                ...publicState[firstPublicKey],
                activeTokens: 1,
                tokenDeckCount: Math.max(0, Number(publicState[firstPublicKey]?.tokenDeckCount ?? 10) - 1),
                turns: 1
            }
        };
    });
}

export async function sendMultiplayerAction(roomCode, user, actionType, payload) {
    if (!user?.uid) {
        throw new Error("User is required for multiplayer actions.");
    }

    return applyMultiplayerAction(roomCode, user, actionType, payload);
}

export async function applyMultiplayerAction(roomCode, user, actionType, payload) {
    if (!user?.uid) {
        throw new Error("User is required for multiplayer actions.");
    }

    if (actionType === "updateState") {
        await Promise.all([
            updatePublicState(roomCode, payload.publicState),
            updatePrivateState(roomCode, user.uid, payload.privateState)
        ]);

        return;
    }

    if (actionType === "passTurn") {
        return passTurn(roomCode, payload.currentPlayer);
    }

    throw new Error(`Unsupported multiplayer action: ${actionType}`);
}

export async function passTurn(roomCode, currentPlayer) {
    if (currentPlayer !== "p1" && currentPlayer !== "p2") {
        throw new Error("Invalid current player.");
    }

    const publicRef = ref(database, `matches/${cleanRoomCode(roomCode)}/public`);

    return runTransaction(publicRef, (publicState) => {
        if (!publicState || publicState.currentPlayer !== currentPlayer) {
            return;
        }

        const nextPlayer = currentPlayer === "p1" ? "p2" : "p1";
        const currentTurnNumber = Number(publicState.turnNumber || 1);
        const secondPlayer = publicState.secondPlayer || "p2";

        return {
            ...publicState,
            currentPlayer: nextPlayer,
            phase: "main",
            turnNumber: currentPlayer === secondPlayer
                ? currentTurnNumber + 1
                : currentTurnNumber
        };
    });
}

export async function startMatch(roomCode) {
    await initializeMultiplayerGame(roomCode);
}
