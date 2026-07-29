import { getPlayer } from "../state/zones.js";
import { cardMatchesFilters, resolvePlayerReference } from "./validation.js";

function cardsInArea(player, area) {
    if (!player) return [];
    if (area === "characterArea") return player.characters.filter(Boolean);
    if (area === "leader") return player.leader ? [player.leader] : [];
    if (area === "stage") return player.stage ? [player.stage] : [];
    return Array.isArray(player[area]) ? player[area] : [];
}

export function createSelection(state, definitions, context, action, actionIndex) {
    const spec = action.selection || {};
    const playerId = resolvePlayerReference(spec.controller || action.player || "self", context);
    const player = getPlayer(state, playerId);
    const amount = Math.max(1, Number(spec.amount || 1));
    const validCardIds = cardsInArea(player, spec.area)
        .filter(card => cardMatchesFilters(card, definitions[card.definitionId], spec.filters, state))
        .map(card => card.instanceId);

    return {
        id: `${context.executionId}:${actionIndex}`,
        executionId: context.executionId,
        actionIndex,
        actingPlayerId: resolvePlayerReference(action.actingPlayer || "actingPlayer", context),
        targetPlayerId: playerId,
        area: spec.area,
        amount,
        upTo: Boolean(spec.upTo),
        validCardIds,
        action
    };
}

export function validateSelectionResponse(state, playerId, cardIds) {
    const pending = state.pendingSelection;
    if (!pending) return { status: "failed", message: "There is no pending selection." };
    if (pending.actingPlayerId !== playerId) return { status: "failed", message: "Another player must make this choice." };

    const selected = [...new Set(Array.isArray(cardIds) ? cardIds : [])];
    const minimum = pending.upTo ? 0 : pending.amount;
    if (selected.length < minimum || selected.length > pending.amount) {
        return { status: "failed", message: `Choose ${pending.upTo ? "up to " : ""}${pending.amount} card(s).` };
    }
    if (selected.some(id => !pending.validCardIds.includes(id))) {
        return { status: "failed", message: "A selected card is no longer a valid target." };
    }
    return { status: "completed", selectedCardIds: selected };
}
