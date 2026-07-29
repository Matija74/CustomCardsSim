import { getPlayer, findCard } from "../state/zones.js";
import { completed, failed, resolvePlayerReference, validatePositiveQuantity } from "../checks/validation.js";

export function addDon(state, definitions, context, action) {
    const player = getPlayer(state, resolvePlayerReference(action.player, context));
    const check = validatePositiveQuantity(action.quantity);
    if (!player || check.status === "failed") return failed(check.message || "Player was not found.");
    const amount = Math.min(check.quantity, player.donDeck);
    if (!amount) return { status: "skipped", message: "No DON!! remain." };
    player.donDeck -= amount;
    player[action.cardState === "rested" ? "restedDon" : "activeDon"] += amount;
    return completed({ quantity: amount });
}

export function returnDon(state, definitions, context, action) {
    const player = getPlayer(state, resolvePlayerReference(action.player, context));
    const check = validatePositiveQuantity(action.quantity);
    const stateKey = action.cardState === "active" ? "activeDon" : "restedDon";
    if (!player || check.status === "failed" || player[stateKey] < check.quantity) return failed(check.message || "Not enough DON!!.");
    player[stateKey] -= check.quantity;
    player.donDeck += check.quantity;
    return completed();
}

export function attachDon(state, definitions, context, action, targets) {
    const player = getPlayer(state, context.actingPlayerId);
    const check = validatePositiveQuantity(action.quantity);
    const card = findCard(state, targets[0] || action.instanceId)?.card;
    if (!card || card.controllerId !== context.actingPlayerId) return failed("You can only attach DON!! to your card.");
    if (check.status === "failed" || player.activeDon < check.quantity) return failed(check.message || "Not enough active DON!!.");
    player.activeDon -= check.quantity;
    card.attachedDon += check.quantity;
    return completed();
}

export function detachDon(state, definitions, context, action, targets) {
    const card = findCard(state, targets[0] || action.instanceId)?.card;
    const check = validatePositiveQuantity(action.quantity);
    if (!card || check.status === "failed" || card.attachedDon < check.quantity) return failed(check.message || "Not enough attached DON!!.");
    card.attachedDon -= check.quantity;
    getPlayer(state, card.controllerId).restedDon += check.quantity;
    return completed();
}

export function moveAttachedDon(state, definitions, context, action, targets) {
    const source = findCard(state, targets[0])?.card;
    const target = findCard(state, targets[1])?.card;
    const check = validatePositiveQuantity(action.quantity);
    if (!source || !target || source.controllerId !== context.actingPlayerId || target.controllerId !== context.actingPlayerId) return failed("Both cards must be controlled by the acting player.");
    if (check.status === "failed" || source.attachedDon < check.quantity) return failed(check.message || "Not enough attached DON!!.");
    source.attachedDon -= check.quantity;
    target.attachedDon += check.quantity;
    return completed();
}

function changeState(state, definitions, context, action, targets, nextState) {
    const card = findCard(state, targets[0] || action.instanceId)?.card;
    if (!card || card.controllerId !== context.actingPlayerId) return failed("You cannot change the opponent's card state.");
    if (card.preventions.some(entry => entry.state === nextState)) return failed(`This card cannot become ${nextState}.`);
    card.state = nextState;
    return completed();
}

export const donStateActionHandlers = {
    addDon,
    returnDon,
    attachDon,
    detachDon,
    moveAttachedDon,
    restCard: (state, definitions, context, action, targets) => changeState(state, definitions, context, action, targets, "rested"),
    restandCard: (state, definitions, context, action, targets) => changeState(state, definitions, context, action, targets, "active"),
    preventStateChange(state, definitions, context, action, targets) {
        const card = findCard(state, targets[0] || action.instanceId)?.card;
        if (!card) return failed("Card was not found.");
        card.preventions.push({ state: action.preventedState, duration: action.duration, expiresTurn: state.turnNumber });
        return completed();
    }
};
