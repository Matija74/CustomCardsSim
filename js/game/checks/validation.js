import { findCard, getPlayer } from "../state/zones.js";
import { otherPlayerId } from "../state/gameState.js";

export function completed(data = {}) {
    return { status: "completed", ...data };
}

export function failed(message, data = {}) {
    return { status: "failed", message, ...data };
}

export function skipped(message = "", data = {}) {
    return { status: "skipped", message, ...data };
}

export function awaitingSelection(selection) {
    return { status: "awaitingSelection", selection };
}

export function resolvePlayerReference(reference, context) {
    if (!reference || reference === "self" || reference === "controller") {
        return context.controllerId;
    }

    if (reference === "owner") return context.ownerId;
    if (reference === "actingPlayer") return context.actingPlayerId;
    if (reference === "opponent") return otherPlayerId(context.controllerId);
    if (reference === "p1" || reference === "p2") return reference;

    return null;
}

export function validatePositiveQuantity(quantity, label = "Quantity") {
    const value = Number(quantity);

    if (!Number.isInteger(value) || value <= 0) {
        return failed(`${label} must be a positive whole number.`);
    }

    return completed({ quantity: value });
}

export function validateCardInstance(state, instanceId, definitions) {
    const location = findCard(state, instanceId);

    if (!location) return failed("Card instance was not found.");

    const definition = definitions[location.card.definitionId];

    if (!definition) return failed(`Card definition ${location.card.definitionId} was not found.`);

    return completed({ ...location, definition });
}

export function validateActingPlayer(state, actingPlayerId, options = {}) {
    if (!getPlayer(state, actingPlayerId)) return failed("Acting player was not found.");
    if (state.phase === "gameOver") return failed("The game is already over.");

    if (options.requireTurn && state.activePlayerId !== actingPlayerId) {
        return failed("This action may only be taken by the current player.");
    }

    if (options.phase && state.phase !== options.phase) {
        return failed(`This action requires the ${options.phase} phase.`);
    }

    return completed();
}

export function getPrintedCost(definition) {
    return Math.max(0, Number(definition?.cost ?? definition?.playCost ?? 0));
}

export function getPrintedPower(definition) {
    return Math.max(0, Number(definition?.power ?? 0));
}

function isModifierActive(modifier, state) {
    if (!modifier?.duration) return true;
    if (modifier.duration === "battle") return Boolean(state.pendingCombat);
    if (modifier.expiresTurn === undefined) return true;

    return state.turnNumber <= modifier.expiresTurn;
}

export function getEffectiveCost(card, definition, state) {
    const setValues = (card.modifiers?.baseCost || [])
        .filter(modifier => isModifierActive(modifier, state));
    const base = setValues.length
        ? Number(setValues[setValues.length - 1].amount)
        : getPrintedCost(definition);
    const additive = (card.modifiers?.cost || [])
        .filter(modifier => isModifierActive(modifier, state))
        .reduce((sum, modifier) => sum + Number(modifier.amount || 0), 0);

    return Math.max(0, base + additive);
}

export function getEffectivePower(card, definition, state) {
    const setValues = (card.modifiers?.basePower || [])
        .filter(modifier => isModifierActive(modifier, state));
    const base = setValues.length
        ? Number(setValues[setValues.length - 1].amount)
        : getPrintedPower(definition);
    const additive = (card.modifiers?.power || [])
        .filter(modifier => isModifierActive(modifier, state))
        .reduce((sum, modifier) => sum + Number(modifier.amount || 0), 0);

    return Math.max(0, base + additive + (Number(card.attachedDon || 0) * 1000));
}

export function cardMatchesFilters(card, definition, filters = {}, state) {
    const cost = getEffectiveCost(card, definition, state);

    if (filters.maximumCost !== undefined && cost > Number(filters.maximumCost)) return false;
    if (filters.minimumCost !== undefined && cost < Number(filters.minimumCost)) return false;
    if (filters.cardType && String(definition.cardType).toLowerCase() !== String(filters.cardType).toLowerCase()) return false;
    if (filters.state && card.state !== filters.state) return false;
    if (filters.name && definition.name !== filters.name) return false;
    if (filters.excludeName && definition.name === filters.excludeName) return false;
    if (filters.typeIncludes && !String(definition.type || "").includes(filters.typeIncludes)) return false;
    if (filters.color && String(definition.color || "").toLowerCase() !== String(filters.color).toLowerCase()) return false;

    return true;
}

export function canPlayerControlCard(playerId, card, explicitPermission = false) {
    return Boolean(card && (card.controllerId === playerId || explicitPermission));
}
