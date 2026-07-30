import { appendLog, finishGame, otherPlayerId } from "../state/gameState.js";
import { findCard, getPlayer, insertCard, moveCard, removeCard } from "../state/zones.js";
import { canPlayerControlCard, completed, failed, resolvePlayerReference, validatePositiveQuantity } from "../checks/validation.js";

export function drawCard(state, definitions, context, action) {
    const playerId = resolvePlayerReference(action.player, context);
    const player = getPlayer(state, playerId);
    const check = validatePositiveQuantity(action.quantity);
    if (!player || check.status === "failed") return failed(check.message || "Player was not found.");
    for (let i = 0; i < check.quantity; i += 1) {
        if (!player.deck.length) {
            finishGame(state, otherPlayerId(playerId), playerId, "deck out");
            return completed({ gameOver: true });
        }
        const card = player.deck.shift();
        card.zone = "hand";
        card.face = "up";
        player.hand.push(card);
    }
    appendLog(state, `${player.name} drew ${check.quantity} card(s).`);
    return completed();
}

export function trashCard(state, definitions, context, action, targets) {
    for (const instanceId of targets) {
        const location = findCard(state, instanceId);
        if (!location) return failed("Selected card was not found.");
        const card = removeCard(state, instanceId);
        if (card.attachedDon) getPlayer(state, card.controllerId).restedDon += card.attachedDon;
        card.attachedDon = 0;
        card.state = "active";
        insertCard(state, card, card.ownerId, "trash", { position: "top" });
    }
    return completed();
}

export function cardKO(state, definitions, context, action, targets) {
    for (const instanceId of targets) {
        const location = findCard(state, instanceId);
        if (!location || location.zone !== "characterArea") return failed("Only a Character in play can be K.O.'d.");
        const card = removeCard(state, instanceId);
        const returnedDon = card.attachedDon;
        if (returnedDon) getPlayer(state, card.controllerId).restedDon += returnedDon;
        card.attachedDon = 0;
        insertCard(state, card, card.ownerId, "trash");
        appendLog(state, `${definitions[card.definitionId]?.name || card.definitionId} was K.O.'d.`);
        context.emit?.("onKO", card.instanceId, card.controllerId, action.cause || "effect");
    }
    return completed();
}

export function returnCardToHand(state, definitions, context, action, targets) {
    for (const instanceId of targets) {
        const location = findCard(state, instanceId);
        if (!location || ["deck", "life", "leader"].includes(location.zone)) return failed("Card cannot be returned from this area.");
        if (location.card.attachedDon) getPlayer(state, location.card.controllerId).restedDon += location.card.attachedDon;
        location.card.attachedDon = 0;
        if (!moveCard(state, instanceId, location.card.ownerId, "hand")) return failed("Card could not be returned to hand.");
    }
    return completed();
}

export function returnCardToDeck(state, definitions, context, action, targets) {
    const position = action.position === "bottom" ? "bottom" : "top";
    for (const instanceId of targets) {
        const location = findCard(state, instanceId);
        if (!location || location.zone === "leader") return failed("Card cannot be returned to the deck.");
        if (location.card.attachedDon) getPlayer(state, location.card.controllerId).restedDon += location.card.attachedDon;
        location.card.attachedDon = 0;
        if (!moveCard(state, instanceId, location.card.ownerId, "deck", { position })) return failed("Card could not be returned to deck.");
    }
    return completed();
}

export function moveCardToLife(state, definitions, context, action, targets) {
    const playerId = resolvePlayerReference(action.player || "owner", context);
    for (const instanceId of targets) {
        const location = findCard(state, instanceId);
        if (!location || location.zone === "leader") return failed("Card cannot be moved to Life.");
        if (location.card.attachedDon) getPlayer(state, location.card.controllerId).restedDon += location.card.attachedDon;
        location.card.attachedDon = 0;
        if (!moveCard(state, instanceId, playerId, "life", { position: action.position === "bottom" ? "bottom" : "top" })) return failed("Card could not be moved to Life.");
        findCard(state, instanceId).card.face = action.face || "down";
    }
    return completed();
}

function changeState(state, definitions, context, action, targets, nextState) {
    const card = findCard(state, targets[0] || action.instanceId)?.card;
    if (!canPlayerControlCard(context.actingPlayerId, card, action.allowOpponent === true)) return failed("You cannot change the opponent's card state.");
    if (card.preventions.some(entry => entry.state === nextState)) return failed(`This card cannot become ${nextState}.`);
    card.state = nextState;
    return completed();
}

export function restCard(state, definitions, context, action, targets) {
    return changeState(state, definitions, context, action, targets, "rested");
}

export function restandCard(state, definitions, context, action, targets) {
    return changeState(state, definitions, context, action, targets, "active");
}

export function preventStateChange(state, definitions, context, action, targets) {
    const card = findCard(state, targets[0] || action.instanceId)?.card;
    if (!card) return failed("Card was not found.");
    card.preventions.push({ state: action.preventedState, duration: action.duration, expiresTurn: state.turnNumber });
    return completed();
}

export function playCard(state, definitions, context, action, targets) {
    const instanceId = targets[0] || action.instanceId;
    const location = findCard(state, instanceId);
    if (!location) return failed("Card was not found.");
    const definition = definitions[location.card.definitionId];
    const type = String(definition?.cardType || "").toLowerCase();
    const destination = action.destination || (type === "stage" ? "stage" : "characterArea");
    if (destination === "characterArea" && !getPlayer(state, location.card.controllerId).characters.includes(null)) {
        return failed("Choose a Character to replace first.");
    }
    if (destination === "stage" && getPlayer(state, location.card.controllerId).stage) return failed("Choose the current Stage to replace first.");
    if (!moveCard(state, instanceId, location.card.controllerId, destination, { slotIndex: action.slotIndex })) return failed("Card could not be played.");
    const card = findCard(state, instanceId).card;
    card.state = action.cardState || "active";
    card.face = "up";
    card.playedOnTurn = state.turnNumber;
    context.emit?.("onPlay", instanceId, card.controllerId, action.cause || "play");
    return completed();
}

export function replaceCharacter(state, definitions, context, action, targets) {
    if (targets.length !== 2) return failed("A new card and replaced Character are required.");
    const replaced = findCard(state, targets[1]);
    if (!replaced || replaced.zone !== "characterArea") return failed("Replacement target is not a Character in play.");
    const slotIndex = replaced.index;
    trashCard(state, definitions, context, action, [targets[1]]);
    return playCard(state, definitions, context, { ...action, slotIndex }, [targets[0]]);
}

export function useEventCard(state, definitions, context, action, targets) {
    const location = findCard(state, targets[0] || action.instanceId);
    if (!location || String(definitions[location.card.definitionId]?.cardType).toLowerCase() !== "event") return failed("Selected card is not an Event.");
    const instanceId = location.card.instanceId;
    context.emit?.("activateMain", instanceId, location.card.controllerId, "event");
    return trashCard(state, definitions, context, action, [instanceId]);
}

export const cardActionHandlers = {
    drawCard,
    trashCard,
    cardKO,
    returnCardToHand,
    returnCardToDeck,
    moveCardToLife,
    playCard,
    replaceCharacter,
    useEventCard,
    restCard,
    restandCard,
    preventStateChange
};
