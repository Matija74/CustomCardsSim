import { getPlayer } from "../state/zones.js";
import { appendLog } from "../state/gameState.js";
import { cardMatchesFilters, completed, failed, resolvePlayerReference, skipped, validatePositiveQuantity } from "../checks/validation.js";

export function search(state, definitions, context, action, targets = []) {
    const player = getPlayer(state, resolvePlayerReference(action.player, context));
    const quantityCheck = validatePositiveQuantity(action.quantity);
    if (!player || quantityCheck.status === "failed") return failed(quantityCheck.message || "Player was not found.");
    const amountTaken = Math.max(0, Number(action.amountTaken || 1));
    const resumingSearch = Boolean(context.searchBuffer);
    if (!context.searchBuffer) {
        const source = action.deckLocation === "bottom" ? player.deck.splice(-quantityCheck.quantity) : player.deck.splice(0, quantityCheck.quantity);
        context.searchBuffer = { playerId: player.id, cards: source, amountTaken, targetArea: action.targetArea || "hand", filters: action.filters || {} };
        appendLog(state, `${player.name} searched ${source.length} card(s) from the ${action.deckLocation === "bottom" ? "bottom" : "top"} of the deck.`);
    }
    const buffer = context.searchBuffer;
    const validCardIds = buffer.cards.filter(card => cardMatchesFilters(card, definitions[card.definitionId], buffer.filters, state)).map(card => card.instanceId);
    if (!targets.length) {
        if (resumingSearch && action.upTo) {
            appendLog(state, `${player.name} chose not to take a searched card.`);
            return completed({ quantity: 0 });
        }
        if (!validCardIds.length) return skipped("Search found no valid cards.", { searchBuffer: buffer });
        return {
            status: "awaitingSelection",
            selection: {
                id: `${context.executionId}:search`,
                executionId: context.executionId,
                actingPlayerId: player.id,
                targetPlayerId: player.id,
                area: "search",
                amount: Math.min(amountTaken, validCardIds.length),
                upTo: Boolean(action.upTo),
                validCardIds,
                action
            }
        };
    }
    if (targets.some(id => !validCardIds.includes(id))) return failed("A searched card is no longer valid.");
    const selected = new Set(targets);
    const taken = buffer.cards.filter(card => selected.has(card.instanceId));
    buffer.cards = buffer.cards.filter(card => !selected.has(card.instanceId));
    const target = buffer.targetArea;
    if (!Array.isArray(player[target])) return failed("Search target area is invalid.");
    for (const card of taken) {
        card.zone = target;
        card.face = target === "hand" ? "up" : card.face;
        player[target].push(card);
    }
    appendLog(state, `${player.name} added ${taken.length} searched card(s) to ${target}.`);
    return completed({ quantity: taken.length });
}

export function returnRest(state, definitions, context, action) {
    const buffer = context.searchBuffer;
    if (!buffer) return failed("There is no active search.");
    const player = getPlayer(state, buffer.playerId);
    const cards = action.order === "reverse" ? [...buffer.cards].reverse() : buffer.cards;
    for (const card of cards) {
        card.zone = "deck";
        if (action.deckLocation === "top") player.deck.unshift(card); else player.deck.push(card);
    }
    context.searchBuffer = null;
    return completed();
}

export function trashRest(state, definitions, context) {
    const buffer = context.searchBuffer;
    if (!buffer) return failed("There is no active search.");
    const player = getPlayer(state, buffer.playerId);
    for (const card of buffer.cards) {
        card.zone = "trash";
        player.trash.unshift(card);
    }
    context.searchBuffer = null;
    return completed();
}

export const searchActionHandlers = { search, returnRest, trashRest };
