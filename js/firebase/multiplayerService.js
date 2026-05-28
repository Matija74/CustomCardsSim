import {
    ref,
    set,
    get,
    update,
    onValue,
    runTransaction,
    serverTimestamp,
    remove,
    onDisconnect
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
    const leader = createMultiplayerCard(leaderDefinition);

    const privateState = {
        selectedDeck,
        hand: [],
        deck,
        life: [],
        leader,
        stage: null
    };

    applyStartingZangetsuStage(privateState);

    return privateState;
}

function applyStartingZangetsuStage(privateState) {
    if (privateState?.leader?.cardNumber !== "BL01-001") {
        return;
    }

    const zones = [
        { name: "deck", cards: privateState.deck || [] },
        { name: "hand", cards: privateState.hand || [] },
        { name: "life", cards: privateState.life || [] }
    ];
    let stageLocation = null;

    for (const zone of zones) {
        const index = zone.cards.findIndex(card => {
            return card.cardType === "stage" &&
                Number(card.cost || 0) === 1 &&
                (String(card.name || "").includes("Zangetsu") || String(card.type || "").includes("Zanpakto"));
        });

        if (index !== -1) {
            stageLocation = { zone, index };
            break;
        }
    }

    if (!stageLocation) {
        return;
    }

    const stage = stageLocation.zone.cards.splice(stageLocation.index, 1)[0];

    if (stageLocation.zone.name === "hand" && privateState.deck.length) {
        privateState.hand.push(privateState.deck.shift());
    }

    if (stageLocation.zone.name === "life" && privateState.deck.length) {
        privateState.life.push(privateState.deck.shift());
    }

    stage.state = "active";
    privateState.stage = stage;
}

function createPublicCardSnapshot(card) {
    if (!card) return null;

    return {
        name: card.name,
        image: card.image,
        cardNumber: card.cardNumber,
        cardType: card.cardType,
        type: card.type,
        color: card.color,
        cost: card.cost,
        power: card.power,
        counter: card.counter,
        attribute: card.attribute,
        keywords: card.keywords || [],
        effects: card.effects || [],
        instanceId: card.instanceId,
        state: card.state || "active",
        faceUp: Boolean(card.faceUp)
    };
}

function createInitialPublicPlayerState(privateState) {
    return {
        leader: privateState.leader,
        characters: [],
        stage: privateState.stage || null,
        trash: [],
        handCount: 0,
        deckCount: privateState.deck.length,
        lifeCount: 0,
        faceUpLifeCards: [],
        activeDon: 0,
        restedDon: 0,
        donDeckCount: 10,
        turns: 0
    };
}

function drawStartingHand(privateState) {
    if (!privateState) {
        return privateState;
    }

    const hand = [...(privateState.hand || [])];
    const deck = [...(privateState.deck || [])];

    while (hand.length < 5 && deck.length > 0) {
        hand.push(deck.shift());
    }

    return {
        ...privateState,
        hand,
        deck
    };
}

function setupLifeCards(privateState) {
    if (!privateState?.leader) {
        return privateState;
    }

    const deck = [...(privateState.deck || [])];
    const life = [];
    const lifeAmount = Number(privateState.leader.life || 0);

    for (let i = 0; i < lifeAmount; i++) {
        const lifeCard = deck.shift();

        if (lifeCard) {
            life.push(lifeCard);
        }
    }

    return {
        ...privateState,
        deck,
        life
    };
}

function createPublicPlayerState(privateState, publicPlayerState = {}) {
    const hand = Array.isArray(privateState?.hand) ? privateState.hand : [];
    const deck = Array.isArray(privateState?.deck) ? privateState.deck : [];
    const life = Array.isArray(privateState?.life) ? privateState.life : [];

    return {
        ...publicPlayerState,
        leader: privateState?.leader || publicPlayerState.leader || null,
        stage: privateState?.stage || null,
        handCount: hand.length,
        deckCount: deck.length,
        lifeCount: life.length,
        faceUpLifeCards: life
            .map((card, index) => card?.faceUp ? { index, card: createPublicCardSnapshot(card) } : null)
            .filter(Boolean)
    };
}

function shuffleCards(cards) {
    const shuffled = [...cards];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const randomIndex = Math.floor(Math.random() * (i + 1));

        [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
    }

    return shuffled;
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

function getNumericTimestamp(value) {
    return typeof value === "number" ? value : 0;
}

function getRoomActivityTimestamp(match) {
    return getNumericTimestamp(match?.updatedAt) || getNumericTimestamp(match?.createdAt);
}

async function touchRoom(roomCode, extra = {}) {
    await update(getRoomRef(roomCode), {
        updatedAt: serverTimestamp(),
        ...extra
    });
}

export async function createRoom(user) {
    console.log("createRoom() called with user:", user);

    if (!user) {
        throw new Error("No user found. Guest login did not finish.");
    }

    const roomCode = generateRoomCode();
    console.log("Generated room code:", roomCode);

    const matchRef = getRoomRef(roomCode);
    console.log("Firebase match ref created:", matchRef);

    await set(matchRef, {
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
            selectedDeck: null,
            hand: [],
            deck: [],
            life: []
        }
    });

    return normalizedRoomCode;
}

export function subscribeToMatch(roomCode, callback) {
    const matchRef = getRoomRef(roomCode);

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

export async function startQueuedMatch(roomCode) {
    const matchRef = getRoomRef(roomCode);
    const snapshot = await get(matchRef);

    if (!snapshot.exists()) {
        throw new Error("Room does not exist.");
    }

    const match = snapshot.val();

    if (!match.players?.p1 || !match.players?.p2) {
        throw new Error("Both players must be connected.");
    }

    await update(matchRef, {
        status: "started",
        updatedAt: serverTimestamp(),
        "public/phase": "starting"
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
    const matchRef = getRoomRef(roomCode);
    const snapshot = await get(matchRef);

    return snapshot.val();
}

export async function updatePublicState(roomCode, partialState) {
    const publicRef = ref(database, `matches/${cleanRoomCode(roomCode)}/public`);

    await update(publicRef, partialState);
    await touchRoom(roomCode);
}

export async function updatePrivateState(roomCode, uid, partialState) {
    const privateRef = ref(database, `matches/${cleanRoomCode(roomCode)}/private/${uid}`);

    await update(privateRef, partialState);
    await touchRoom(roomCode);
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
        updatedAt: serverTimestamp(),
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
        updatedAt: serverTimestamp(),
        "public/phase": "diceRoll",
        "public/sharedState": null,
        "public/currentPlayer": null,
        "public/turnNumber": 0,
        "public/winner": null,
        "public/gameOverReasonTitle": null,
        "public/gameOverReasonText": null,
        "public/rematch": {
            p1: false,
            p2: false
        },
        "public/firstPlayer": null,
        "public/secondPlayer": null,
        "public/playerTurns": {
            p1: 0,
            p2: 0
        },
        "public/revealedCards": [],
        "public/currentAttack": null,
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
            },
            mulligan: {
                p1: {
                    done: false,
                    took: false
                },
                p2: {
                    done: false,
                    took: false
                }
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

export async function updateCurrentAttack(roomCode, attackState) {
    await updatePublicState(roomCode, attackState
        ? {
            currentAttack: attackState,
            phase: "attackResolving"
        }
        : {
            currentAttack: null
        });
}

export async function applyMultiplayerLifeDamage(roomCode, defenderSlot, attackerSlot, amount, options = {}) {
    if (defenderSlot !== "p1" && defenderSlot !== "p2") {
        throw new Error("Invalid defender slot.");
    }

    const matchRef = ref(database, `matches/${cleanRoomCode(roomCode)}`);
    const snapshot = await get(matchRef);

    if (!snapshot.exists()) {
        throw new Error("Room does not exist.");
    }

    const match = snapshot.val();
    const defender = match.players?.[defenderSlot];

    if (!defender?.uid) {
        throw new Error("Defender was not found.");
    }

    const privateState = match.private?.[defender.uid] || {};
    const publicKey = defenderSlot === "p1" ? "player1" : "player2";
    const life = [...(privateState.life || [])];
    const hand = [...(privateState.hand || [])];
    const publicPlayer = match.public?.[publicKey] || {};
    const trash = [...(publicPlayer.trash || [])];
    let moved = 0;

    for (let i = 0; i < Number(amount || 0); i++) {
        const lifeCard = life.shift();

        if (!lifeCard) break;

        if (options.banish) {
            trash.push(lifeCard);
        } else {
            hand.push(lifeCard);
        }

        moved++;
    }

    const updates = {
        updatedAt: serverTimestamp(),
        [`private/${defender.uid}/life`]: life,
        [`private/${defender.uid}/hand`]: hand,
        [`public/${publicKey}/lifeCount`]: life.length,
        [`public/${publicKey}/faceUpLifeCards`]: life
            .map((card, index) => card?.faceUp ? { index, card: createPublicCardSnapshot(card) } : null)
            .filter(Boolean),
        [`public/${publicKey}/handCount`]: hand.length,
        "public/currentAttack": null
    };

    if (options.banish) {
        updates[`public/${publicKey}/trash`] = trash;
    }

    if (moved === 0 && attackerSlot) {
        updates["public/winner"] = attackerSlot;
        updates["public/phase"] = "gameOver";
        updates["public/gameOverReasonTitle"] = "Final Attack";
        updates["public/gameOverReasonText"] = "A player had no life cards left and took a successful leader attack.";
    }

    await update(matchRef, updates);

    return {
        moved,
        remainingLife: life.length
    };
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

    const room = cleanRoomCode(roomCode);
    const matchRef = getRoomRef(room);
    const snapshot = await get(matchRef);

    if (!snapshot.exists()) {
        throw new Error("Room does not exist.");
    }

    const match = snapshot.val();
    const publicState = match.public || {};
    const diceWinner = publicState.setup?.dice?.winner;

    if (publicState.phase !== "diceRoll" || diceWinner !== chooserSlot) {
        throw new Error("Turn order cannot be chosen right now.");
    }

    const otherSlot = chooserSlot === "p1" ? "p2" : "p1";
    const firstPlayer = choice === "first" ? chooserSlot : otherSlot;
    const secondPlayer = firstPlayer === "p1" ? "p2" : "p1";
    const player1Uid = match.players?.p1?.uid;
    const player2Uid = match.players?.p2?.uid;

    if (!player1Uid || !player2Uid) {
        throw new Error("Both players must be in the room.");
    }

    const p1Private = drawStartingHand(match.private?.[player1Uid] || {});
    const p2Private = drawStartingHand(match.private?.[player2Uid] || {});

    await update(matchRef, {
        updatedAt: serverTimestamp(),
        "public/phase": "mulligan",
        "public/currentPlayer": null,
        "public/turnNumber": 0,
        "public/firstPlayer": firstPlayer,
        "public/secondPlayer": secondPlayer,
        "public/playerTurns": {
            p1: 0,
            p2: 0
        },
        "public/setup/turnChoice": {
            chooser: chooserSlot,
            firstPlayer,
            secondPlayer
        },
        "public/player1": createPublicPlayerState(
            p1Private,
            publicState.player1 || {}
        ),
        "public/player2": createPublicPlayerState(
            p2Private,
            publicState.player2 || {}
        ),
        [`private/${player1Uid}`]: p1Private,
        [`private/${player2Uid}`]: p2Private
    });
}

export async function setMultiplayerMulligan(roomCode, user, playerSlot, tookMulligan) {
    if (!user?.uid) {
        throw new Error("User is required for mulligan.");
    }

    if (playerSlot !== "p1" && playerSlot !== "p2") {
        throw new Error("Invalid player slot.");
    }

    const matchRef = ref(database, `matches/${cleanRoomCode(roomCode)}`);
    const snapshot = await get(matchRef);

    if (!snapshot.exists()) {
        throw new Error("Room does not exist.");
    }

    const match = snapshot.val();
    const publicState = match.public || {};
    const player = match.players?.[playerSlot];

    if (publicState.phase !== "mulligan") {
        throw new Error("Mulligan is not available right now.");
    }

    if (player?.uid !== user.uid) {
        throw new Error("Only your player slot can mulligan.");
    }

    if (publicState.setup?.mulligan?.[playerSlot]?.done) {
        throw new Error("Mulligan was already chosen.");
    }

    const privateState = match.private?.[user.uid] || {};
    let hand = privateState.hand || [];
    let deck = privateState.deck || [];

    if (tookMulligan) {
        deck = shuffleCards([...deck, ...hand]);
        hand = deck.splice(0, 5);
    }

    const nextPrivateState = setupLifeCards({
        ...privateState,
        hand,
        deck,
        life: []
    });
    hand = nextPrivateState.hand;
    deck = nextPrivateState.deck;
    const life = nextPrivateState.life;

    const publicPlayerKey = playerSlot === "p1" ? "player1" : "player2";
    const mulliganState = {
        ...(publicState.setup?.mulligan || {}),
        [playerSlot]: {
            done: true,
            took: Boolean(tookMulligan)
        }
    };
    const bothDone = Boolean(mulliganState.p1?.done && mulliganState.p2?.done);
    const updates = {
        updatedAt: serverTimestamp(),
        [`private/${user.uid}/hand`]: hand,
        [`private/${user.uid}/deck`]: deck,
        [`private/${user.uid}/life`]: life,
        [`public/${publicPlayerKey}/handCount`]: hand.length,
        [`public/${publicPlayerKey}/deckCount`]: deck.length,
        [`public/${publicPlayerKey}/lifeCount`]: life.length,
        [`public/${publicPlayerKey}/faceUpLifeCards`]: [],
        [`public/setup/mulligan/${playerSlot}`]: mulliganState[playerSlot]
    };

    if (bothDone) {
        const firstPlayer = publicState.firstPlayer || publicState.setup?.turnChoice?.firstPlayer || "p1";
        const firstPublicKey = firstPlayer === "p1" ? "player1" : "player2";

        updates["public/phase"] = "startOfTurn";
        updates["public/currentPlayer"] = firstPlayer;
        updates["public/turnNumber"] = 1;
        updates[`public/playerTurns/${firstPlayer}`] = 1;
        updates[`public/${firstPublicKey}/turns`] = 1;
    }

    await update(matchRef, updates);
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
        if (
            !publicState ||
            publicState.currentPlayer !== currentPlayer ||
            publicState.phase !== "main" ||
            publicState.currentAttack
        ) {
            return;
        }

        const nextPlayer = currentPlayer === "p1" ? "p2" : "p1";
        const currentTurnNumber = Number(publicState.turnNumber || 1);
        const secondPlayer = publicState.secondPlayer || "p2";
        const nextTurnNumber = currentPlayer === secondPlayer
            ? currentTurnNumber + 1
            : currentTurnNumber;

        return {
            ...publicState,
            currentPlayer: nextPlayer,
            phase: "main",
            currentAttack: null,
            turnNumber: nextTurnNumber,
            playerTurns: {
                ...(publicState.playerTurns || {})
            }
        };
    });
}

export async function startMatch(roomCode) {
    await initializeMultiplayerGame(roomCode);
}

export async function requestRematch(roomCode, playerSlot) {
    if (playerSlot !== "p1" && playerSlot !== "p2") {
        throw new Error("Invalid player slot.");
    }

    const matchRef = ref(database, `matches/${cleanRoomCode(roomCode)}`);

    await update(matchRef, {
        updatedAt: serverTimestamp(),
        [`public/rematch/${playerSlot}`]: true
    });

    const snapshot = await get(matchRef);

    if (!snapshot.exists()) {
        throw new Error("Room does not exist.");
    }

    const match = snapshot.val();
    const rematch = match.public?.rematch || {};

    if (rematch.p1 && rematch.p2) {
        await initializeMultiplayerGame(roomCode);
    }
}

export async function deleteRoom(roomCode) {
    await remove(getRoomRef(roomCode));
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

export async function cleanupInactiveRooms(options = {}) {
    const {
        emptyGraceMs = 5 * 60 * 1000,
        abandonedLobbyMs = 60 * 60 * 1000,
        startedRoomMs = 6 * 60 * 60 * 1000
    } = options;

    const matchesRef = ref(database, "matches");
    const snapshot = await get(matchesRef);

    if (!snapshot.exists()) {
        return 0;
    }

    const now = Date.now();
    const matches = snapshot.val() || {};
    const deleteTasks = [];

    for (const [roomCode, match] of Object.entries(matches)) {
        const players = match?.players || {};
        const p1 = players.p1 || null;
        const p2 = players.p2 || null;
        const status = String(match?.status || "waiting");
        const activityTimestamp = getRoomActivityTimestamp(match);
        const ageMs = activityTimestamp ? now - activityTimestamp : Number.POSITIVE_INFINITY;
        const isLegacyRoom = !getNumericTimestamp(match?.updatedAt);
        const p1Connected = Boolean(p1?.connected);
        const p2Connected = Boolean(p2?.connected);
        const hasHost = Boolean(p1);
        const bothDisconnected = hasHost && !p1Connected && !p2Connected;

        const shouldDelete =
            !hasHost ||
            ((status === "waiting" || status === "ready") && !p1Connected && ageMs >= emptyGraceMs) ||
            ((status === "waiting" || status === "ready") && ageMs >= abandonedLobbyMs) ||
            (bothDisconnected && ageMs >= emptyGraceMs) ||
            (status === "started" && ageMs >= startedRoomMs && (bothDisconnected || isLegacyRoom));

        if (shouldDelete) {
            deleteTasks.push(remove(ref(database, `matches/${roomCode}`)));
        }
    }

    await Promise.all(deleteTasks);

    return deleteTasks.length;
}
