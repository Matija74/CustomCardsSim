import { createId } from "../state/gameState.js";
import { findCard, getAllCards, getBoardCards, getPlayer } from "../state/zones.js";
import { createSelection, validateSelectionResponse } from "../checks/selections.js";
import { failed, skipped } from "../checks/validation.js";
import { getActionHandler } from "./actionRegistry.js";
import { canUseEffect, getActivatorEffects, getSupportedActivators, markEffectUsed, normalizeActivator, requiresActivationChoice } from "./effectActivators.js";

const SUPPORTED_TRIGGERS = new Set(getSupportedActivators());

function createContext(state, entry, source, definitions) {
    return {
        state,
        executionId: entry.executionId,
        sourceInstanceId: entry.sourceInstanceId,
        source,
        ownerId: source?.ownerId || entry.actingPlayerId,
        controllerId: source?.controllerId || entry.actingPlayerId,
        actingPlayerId: entry.actingPlayerId,
        opponentId: entry.actingPlayerId === "p1" ? "p2" : "p1",
        cause: entry.cause,
        searchBuffer: entry.searchBuffer || null,
        emit: (trigger, instanceId, actingPlayerId, cause) => queueTrigger(state, definitions, trigger, instanceId, actingPlayerId, cause)
    };
}

export function queueTrigger(state, definitions, trigger, sourceInstanceId, actingPlayerId, cause = trigger, options = {}) {
    const activator = normalizeActivator(trigger) || trigger;
    if (!SUPPORTED_TRIGGERS.has(activator)) return failed(`Unsupported trigger: ${trigger}`);
    const source = findCard(state, sourceInstanceId)?.card;
    if (!source) return skipped("Trigger source is no longer in game state.");
    const definition = definitions[source.definitionId];
    const effects = getActivatorEffects(definition, activator, { executableOnly: true })
        .filter(descriptor => !options.effectId || descriptor.effectId === options.effectId);
    let queued = 0;
    for (const descriptor of effects) {
        const reservedUses = state.effectQueue.filter(entry => entry.sourceInstanceId === sourceInstanceId && entry.usageKey === descriptor.usageKey).length;
        if (!canUseEffect(source, descriptor.effect, descriptor.usageKey, state.turnNumber, reservedUses)) continue;
        state.effectQueue.push({
            executionId: createId("effect"),
            sourceInstanceId,
            actingPlayerId,
            cause,
            trigger: activator,
            effectId: descriptor.effectId,
            effectText: descriptor.effect.text || "",
            optional: Boolean(descriptor.effect.optional),
            activationConfirmed: Boolean(options.confirmed || activator === "trigger"),
            actions: descriptor.effect.actions,
            actionIndex: 0,
            usageKey: descriptor.usageKey,
            useLimit: descriptor.effect.oncePerTurn || descriptor.effect.maxUsesPerTurn ? true : false
        });
        queued += 1;
    }
    return { status: "completed", queued };
}

export function queuePlayerBoardTriggers(state, definitions, trigger, playerId, cause = trigger, options = {}) {
    let queued = 0;
    for (const card of getBoardCards(getPlayer(state, playerId))) {
        const result = queueTrigger(state, definitions, trigger, card.instanceId, playerId, cause, options);
        queued += result.queued || 0;
    }
    return { status: "completed", queued };
}

export function queueCharacterPlayedTriggers(state, definitions, playedCardId, playerId, cause = "characterPlay") {
    const first = queuePlayerBoardTriggers(state, definitions, "onCharacterPlay", playerId, cause);
    const opponentId = playerId === "p1" ? "p2" : "p1";
    const second = queuePlayerBoardTriggers(state, definitions, "onCharacterPlay", opponentId, cause);
    return { status: "completed", queued: (first.queued || 0) + (second.queued || 0), playedCardId };
}

function snapshotZones(state, entry) {
    const cards = [...getAllCards(state), ...(entry.searchBuffer?.cards || [])];
    return new Map(cards.map(card => [card.instanceId, card.zone]));
}

function queueTransitionTriggers(state, definitions, beforeZones) {
    for (const [instanceId, previousZone] of beforeZones) {
        const location = findCard(state, instanceId);
        if (!location) continue;
        if (previousZone === "deck" && location.zone === "trash") {
            queueTrigger(state, definitions, "whenTrashedFromDeck", instanceId, location.card.controllerId, "deckTrash");
        }
        if (previousZone !== "characterArea" && location.zone === "characterArea") {
            queueCharacterPlayedTriggers(state, definitions, instanceId, location.card.controllerId, "effectPlay");
        }
    }
}

function runAction(state, definitions, entry, action, selectedCardIds = null) {
    const handler = getActionHandler(action.action);
    if (!handler) return failed(`Action is not registered: ${action.action}`);
    const source = findCard(state, entry.sourceInstanceId)?.card || entry.sourceSnapshot;
    const context = createContext(state, entry, source, definitions);
    const beforeZones = snapshotZones(state, entry);
    const targets = selectedCardIds || (action.target === "source" ? [entry.sourceInstanceId] : (action.target === "battleTarget" ? [state.pendingCombat?.targetId].filter(Boolean) : (action.targetInstanceId ? [action.targetInstanceId] : [])));
    const result = handler(state, definitions, context, action, targets);
    entry.searchBuffer = context.searchBuffer;
    if (result.status !== "failed" && result.status !== "awaitingSelection") queueTransitionTriggers(state, definitions, beforeZones);
    return result;
}

export function resolveEffectQueue(state, definitions) {
    if (state.pendingSelection || state.pendingActivation || (state.pendingCombat?.window && !["effects", "counterEffects"].includes(state.pendingCombat.window)) || state.pendingTrigger) return { status: "paused" };
    while (state.effectQueue.length) {
        const entry = state.effectQueue[0];
        if (requiresActivationChoice({ optional: entry.optional }, entry.trigger, entry.activationConfirmed)) {
            state.pendingActivation = {
                id: createId("activation"),
                executionId: entry.executionId,
                playerId: entry.actingPlayerId,
                sourceInstanceId: entry.sourceInstanceId,
                trigger: entry.trigger,
                effectId: entry.effectId,
                text: entry.effectText
            };
            return { status: "awaitingActivation", activation: state.pendingActivation };
        }
        if (entry.useLimit && !entry.usageMarked) {
            const source = findCard(state, entry.sourceInstanceId)?.card;
            if (source) markEffectUsed(source, entry.usageKey, state.turnNumber);
            entry.usageMarked = true;
        }
        if (entry.actionIndex >= entry.actions.length) {
            state.effectQueue.shift();
            continue;
        }
        const stepId = `${entry.executionId}:${entry.actionIndex}`;
        if (state.resolvedStepIds.includes(stepId)) {
            entry.actionIndex += 1;
            continue;
        }
        const action = entry.actions[entry.actionIndex];
        if (action.selection) {
            const context = createContext(state, entry, findCard(state, entry.sourceInstanceId)?.card || entry.sourceSnapshot, definitions);
            const selection = createSelection(state, definitions, context, action, entry.actionIndex);
            if (!selection.validCardIds.length && selection.upTo) {
                state.resolvedStepIds.push(stepId);
                entry.actionIndex += 1;
                continue;
            }
            if (selection.validCardIds.length < (selection.upTo ? 0 : selection.amount)) return failed("A required effect has no valid targets.");
            state.pendingSelection = selection;
            return { status: "awaitingSelection", selection };
        }
        const result = runAction(state, definitions, entry, action);
        if (result.status === "failed") return result;
        if (result.status === "awaitingSelection") {
            const returnAction = entry.actions[entry.actionIndex + 1];
            state.pendingSelection = {
                ...result.selection,
                actionIndex: entry.actionIndex,
                action,
                returnRest: returnAction?.action === "returnRest"
                    ? { deckLocation: returnAction.deckLocation || "bottom", order: returnAction.order || null }
                    : null
            };
            return { status: "awaitingSelection", selection: state.pendingSelection };
        }
        state.resolvedStepIds.push(stepId);
        entry.actionIndex += 1;
        if (state.phase === "gameOver") return result;
    }
    return { status: "completed" };
}

export function submitActivationChoice(state, definitions, playerId, activate) {
    const pending = state.pendingActivation;
    if (!pending || pending.playerId !== playerId) return failed("There is no optional effect choice for this player.");
    const entryIndex = state.effectQueue.findIndex(entry => entry.executionId === pending.executionId);
    if (entryIndex < 0) return failed("The pending effect is no longer available.");
    state.pendingActivation = null;
    if (!activate) {
        state.effectQueue.splice(entryIndex, 1);
        return resolveEffectQueue(state, definitions);
    }
    state.effectQueue[entryIndex].activationConfirmed = true;
    return resolveEffectQueue(state, definitions);
}

export function submitEffectSelection(state, definitions, playerId, cardIds, options = {}) {
    const validation = validateSelectionResponse(state, playerId, cardIds);
    if (validation.status === "failed") return validation;
    const pending = state.pendingSelection;
    const entry = state.effectQueue.find(item => item.executionId === pending.executionId);
    if (!entry || entry.actionIndex !== pending.actionIndex) return failed("The pending effect is no longer current.");
    const stepId = `${entry.executionId}:${entry.actionIndex}`;
    if (state.resolvedStepIds.includes(stepId)) return failed("This effect step already resolved.");
    let requestedReturnOrder = null;
    if (pending.area === "search" && Array.isArray(options.returnOrder) && entry.searchBuffer) {
        const selectedIds = new Set(validation.selectedCardIds);
        const expectedRemaining = entry.searchBuffer.cards.filter(card => !selectedIds.has(card.instanceId));
        requestedReturnOrder = [...new Set(options.returnOrder)];
        if (requestedReturnOrder.length !== expectedRemaining.length || requestedReturnOrder.some(id => !expectedRemaining.some(card => card.instanceId === id))) {
            return failed("The searched cards require a complete unique return order.");
        }
    }
    const result = runAction(state, definitions, entry, pending.action, validation.selectedCardIds);
    if (result.status === "failed") return result;
    if (requestedReturnOrder && entry.searchBuffer) {
        const remaining = entry.searchBuffer.cards;
        const byId = new Map(remaining.map(card => [card.instanceId, card]));
        entry.searchBuffer.cards = requestedReturnOrder.map(id => byId.get(id));
        entry.searchBuffer.userOrdered = true;
    }
    state.pendingSelection = null;
    state.resolvedStepIds.push(stepId);
    entry.actionIndex += 1;
    return resolveEffectQueue(state, definitions);
}

export function getSupportedTriggers() {
    return [...SUPPORTED_TRIGGERS];
}
