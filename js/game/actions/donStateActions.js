import { getPlayer, findCard, getBoardCards } from "../state/zones.js";
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

export function returnDon(state, definitions, context, action, targets = []) {
    const player = getPlayer(state, resolvePlayerReference(action.player, context));
    const check = validatePositiveQuantity(action.quantity);
    if (!player || check.status === "failed") return failed(check.message || "Player was not found.");

    const sourceKey = String(action.source || action.cardState || "any").trim().toLowerCase().replace(/[^a-z]/g, "");
    const sourceMap = {
        active: ["active"],
        activedon: ["active"],
        rested: ["rested"],
        resteddon: ["rested"],
        attached: ["attached"],
        attacheddon: ["attached"],
        costarea: ["rested", "active"],
        any: ["rested", "active", "attached"],
        all: ["rested", "active", "attached"]
    };
    const sources = sourceMap[sourceKey];
    if (!sources) return failed("DON!! return source must be active, rested, attached, Cost Area, or any.");

    const targetIds = new Set(targets);
    const attachedCards = getBoardCards(player).filter(card => !targetIds.size || targetIds.has(card.instanceId));
    let remaining = check.quantity;
    let returned = 0;
    for (const source of sources) {
        if (!remaining) break;
        if (source === "attached") {
            for (const card of attachedCards) {
                if (!remaining) break;
                const amount = Math.min(remaining, Number(card.attachedDon || 0));
                if (!amount) continue;
                card.attachedDon = Number(card.attachedDon || 0) - amount;
                remaining -= amount;
                returned += amount;
            }
            continue;
        }
        const stateKey = source === "active" ? "activeDon" : "restedDon";
        const amount = Math.min(remaining, player[stateKey]);
        player[stateKey] -= amount;
        remaining -= amount;
        returned += amount;
    }
    player.donDeck += returned;
    return completed({ quantity: returned, requestedQuantity: check.quantity });
}

function changeDonState(state, context, action, sourceState, destinationState) {
    const player = getPlayer(state, resolvePlayerReference(action.player, context));
    const check = validatePositiveQuantity(action.quantity);
    if (!player || check.status === "failed") return failed(check.message || "Player was not found.");
    if (player[sourceState] < check.quantity) return failed(`Not enough ${sourceState === "activeDon" ? "active" : "rested"} DON!!.`);
    player[sourceState] -= check.quantity;
    player[destinationState] += check.quantity;
    return completed();
}

export function restDon(state, definitions, context, action) {
    return changeDonState(state, context, action, "activeDon", "restedDon");
}

export function restandDon(state, definitions, context, action) {
    return changeDonState(state, context, action, "restedDon", "activeDon");
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

export const donStateActionHandlers = {
    addDon,
    returnDon,
    restDon,
    restandDon,
    attachDon,
    detachDon,
    moveAttachedDon
};
