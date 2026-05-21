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

    const privateState = {
        selectedDeck,
        hand,
        deck,
        life,
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
        handCount: privateState.hand.length,
        deckCount: privateState.deck.length,
        lifeCount: privateState.life.length,
        faceUpLifeCards: privateState.life
            .map((card, index) => card?.faceUp ? { index, card: createPublicCardSnapshot(card) } : null)
            .filter(Boolean),
        activeTokens: 0,
        restedTokens: 0,
        tokenDeckCount: 10,
        turns: 0
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
        "public/gameOverReasonTitle": null,
        "public/gameOverReasonText": null,
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

    const publicRef = ref(database, `matches/${cleanRoomCode(roomCode)}/public`);

    return runTransaction(publicRef, (publicState) => {
        const diceWinner = publicState?.setup?.dice?.winner;

        if (!publicState || publicState.phase !== "diceRoll" || diceWinner !== chooserSlot) {
            return;
        }

        const otherSlot = chooserSlot === "p1" ? "p2" : "p1";
        const firstPlayer = choice === "first" ? chooserSlot : otherSlot;
        const secondPlayer = firstPlayer === "p1" ? "p2" : "p1";
        return {
            ...publicState,
            phase: "mulligan",
            currentPlayer: null,
            turnNumber: 0,
            firstPlayer,
            secondPlayer,
            playerTurns: {
                p1: 0,
                p2: 0
            },
            setup: {
                ...publicState.setup,
                turnChoice: {
                    chooser: chooserSlot,
                    firstPlayer,
                    secondPlayer
                }
            }
        };
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
        [`private/${user.uid}/hand`]: hand,
        [`private/${user.uid}/deck`]: deck,
        [`public/${publicPlayerKey}/handCount`]: hand.length,
        [`public/${publicPlayerKey}/deckCount`]: deck.length,
        [`public/setup/mulligan/${playerSlot}`]: mulliganState[playerSlot]
    };

    if (bothDone) {
        const firstPlayer = publicState.firstPlayer || publicState.setup?.turnChoice?.firstPlayer || "p1";
        const firstPublicKey = firstPlayer === "p1" ? "player1" : "player2";
        const firstPlayerState = publicState[firstPublicKey] || {};

        updates["public/phase"] = "main";
        updates["public/currentPlayer"] = firstPlayer;
        updates["public/turnNumber"] = 1;
        updates[`public/playerTurns/${firstPlayer}`] = 1;
        updates[`public/${firstPublicKey}/activeTokens`] = 1;
        updates[`public/${firstPublicKey}/tokenDeckCount`] =
            Math.max(0, Number(firstPlayerState.tokenDeckCount ?? 10) - 1);
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
