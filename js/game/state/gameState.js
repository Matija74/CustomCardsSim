export const PLAYER_IDS = ["p1", "p2"];

export function otherPlayerId(playerId) {
    return playerId === "p1" ? "p2" : "p1";
}

export function cloneValue(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

export function createId(prefix = "id") {
    const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${suffix}`;
}

export function createCardInstance(definition, ownerId, zone = "deck") {
    if (!definition?.id && !definition?.cardNumber) {
        throw new Error("Card definition requires an ID.");
    }

    return {
        instanceId: createId("card"),
        definitionId: definition.id || definition.cardNumber,
        ownerId,
        controllerId: ownerId,
        zone,
        state: "active",
        face: "down",
        attachedDon: 0,
        playedOnTurn: null,
        modifiers: {
            power: [],
            cost: [],
            basePower: [],
            baseCost: []
        },
        preventions: [],
        oncePerTurn: {}
    };
}

export function shuffleCards(cards, random = Math.random) {
    const shuffled = [...cards];

    for (let index = shuffled.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    return shuffled;
}

export function createPlayerState({ id, name, leader, deck }, random = Math.random) {
    const deckInstances = shuffleCards(
        deck.map(definition => createCardInstance(definition, id, "deck")),
        random
    );
    const leaderInstance = createCardInstance(leader, id, "leader");

    leaderInstance.face = "up";

    return {
        id,
        name,
        leader: leaderInstance,
        deck: deckInstances,
        hand: [],
        life: [],
        trash: [],
        characters: [null, null, null, null, null],
        stage: null,
        activeDon: 0,
        restedDon: 0,
        donDeck: 10,
        turns: 0,
        mulliganComplete: false
    };
}

export function createGameState({ p1, p2, random = Math.random }) {
    return {
        schemaVersion: 1,
        gameId: createId("game"),
        revision: 0,
        players: {
            p1: createPlayerState({ id: "p1", name: p1.name || "Player 1", leader: p1.leader, deck: p1.deck }, random),
            p2: createPlayerState({ id: "p2", name: p2.name || "Player 2", leader: p2.leader, deck: p2.deck }, random)
        },
        phase: "diceRoll",
        turnNumber: 0,
        activePlayerId: null,
        firstPlayerId: null,
        winnerId: null,
        loserId: null,
        winReason: null,
        setup: {
            dice: { p1: null, p2: null, winnerId: null },
            mulligan: { p1: null, p2: null }
        },
        pendingCombat: null,
        pendingSelection: null,
        pendingTrigger: null,
        pendingActivation: null,
        effectQueue: [],
        resolvedStepIds: [],
        processedCommandIds: [],
        logs: []
    };
}

export function appendLog(state, message) {
    if (!message) return;

    state.logs.push({
        id: createId("log"),
        message: String(message),
        revision: state.revision
    });

    if (state.logs.length > 200) {
        state.logs.splice(0, state.logs.length - 200);
    }
}

export function finishGame(state, winnerId, loserId, reason) {
    state.phase = "gameOver";
    state.winnerId = winnerId;
    state.loserId = loserId;
    state.winReason = reason;
    state.pendingCombat = null;
    state.pendingSelection = null;
    state.pendingTrigger = null;
    state.pendingActivation = null;
    state.effectQueue = [];
    appendLog(state, `${state.players[winnerId]?.name || "A player"} wins: ${reason}`);
}
