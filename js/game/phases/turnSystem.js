import { appendLog, otherPlayerId } from "../state/gameState.js";
import { getAllCards, getBoardCards, getPlayer } from "../state/zones.js";
import { drawCard } from "../actions/cardActions.js";
import { addDon } from "../actions/donStateActions.js";

function cleanupExpired(state) {
    for (const card of getAllCards(state)) {
        for (const key of ["power", "cost", "basePower", "baseCost"]) {
            card.modifiers[key] = card.modifiers[key].filter(modifier => modifier.expiresTurn === undefined || modifier.expiresTurn > state.turnNumber);
        }
        card.preventions = card.preventions.filter(item => item.expiresTurn === undefined || item.expiresTurn > state.turnNumber);
    }
}

export function refreshPlayer(player) {
    for (const card of getBoardCards(player)) {
        player.restedDon += Number(card.attachedDon || 0);
        card.attachedDon = 0;
        card.state = "active";
    }
    player.activeDon += player.restedDon;
    player.restedDon = 0;
}

export function beginTurn(state, definitions, queueTrigger) {
    state.turnNumber += 1;
    const player = getPlayer(state, state.activePlayerId);
    player.turns += 1;
    state.phase = "refresh";
    refreshPlayer(player);
    appendLog(state, `${player.name}'s turn ${player.turns} began.`);
    for (const card of getBoardCards(player)) queueTrigger(state, definitions, "startOfTurn", card.instanceId, player.id, "phase");
    return { status: "completed" };
}

export function advancePhase(state, definitions, queueTrigger) {
    const player = getPlayer(state, state.activePlayerId);
    if (!player || state.pendingSelection || state.pendingCombat || state.pendingTrigger || state.pendingActivation || state.effectQueue.length) {
        return { status: "failed", message: "Finish the pending interaction first." };
    }
    if (state.phase === "refresh") {
        state.phase = "draw";
        if (player.id === state.firstPlayerId && player.turns === 1) {
            appendLog(state, `${player.name} skips the first-turn draw.`);
        } else {
            drawCard(state, definitions, { controllerId: player.id, actingPlayerId: player.id }, { player: "self", quantity: 1 });
        }
    } else if (state.phase === "draw") {
        state.phase = "don";
        const firstTurnDon = player.id === state.firstPlayerId && player.turns === 1 ? 1 : 2;
        addDon(state, definitions, { controllerId: player.id, actingPlayerId: player.id }, { player: "self", quantity: firstTurnDon, cardState: "active" });
    } else if (state.phase === "don") {
        state.phase = "main";
    } else if (state.phase === "main") {
        state.phase = "end";
        for (const card of getBoardCards(player)) queueTrigger(state, definitions, "endOfTurn", card.instanceId, player.id, "phase");
        const opponent = getPlayer(state, otherPlayerId(player.id));
        for (const card of getBoardCards(opponent)) queueTrigger(state, definitions, "endOfOpponentTurn", card.instanceId, opponent.id, "phase");
    } else if (state.phase === "end") {
        cleanupExpired(state);
        state.activePlayerId = otherPlayerId(state.activePlayerId);
        return beginTurn(state, definitions, queueTrigger);
    } else {
        return { status: "failed", message: "The current phase cannot be advanced." };
    }
    appendLog(state, `${state.phase.toUpperCase()} phase.`);
    return { status: "completed" };
}
