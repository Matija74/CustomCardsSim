import { appendLog, createId, finishGame, otherPlayerId } from "../state/gameState.js";
import { findCard, getPlayer } from "../state/zones.js";
import { getEffectivePower } from "../checks/validation.js";
import { getActivatorEffects } from "../effects/effectActivators.js";
import { queuePlayerBoardTriggers } from "../effects/effectResolver.js";

function hasBlocker(definition) {
    const keywords = Array.isArray(definition?.keywords) ? definition.keywords.join(" ") : String(definition?.keywords || "");
    return /\bblocker\b/i.test(keywords) || (definition?.effects || []).some(effect => /^\s*\[?blocker\]?/i.test(effect.text || ""));
}

function legalAttacker(state, definitions, playerId, instanceId) {
    const location = findCard(state, instanceId);
    const type = String(definitions[location?.card.definitionId]?.cardType || "").toLowerCase();
    return location && location.card.controllerId === playerId && ["leader", "characterArea"].includes(location.zone) && ["leader", "character"].includes(type) && location.card.state === "active" && location.card.playedOnTurn !== state.turnNumber;
}

function legalTarget(state, playerId, instanceId) {
    const location = findCard(state, instanceId);
    return location && location.card.controllerId === otherPlayerId(playerId) && (location.zone === "leader" || (location.zone === "characterArea" && location.card.state === "rested"));
}

export function declareAttack(state, definitions, queueTrigger, playerId, attackerId, targetId) {
    if (state.phase !== "main" || state.activePlayerId !== playerId || state.pendingCombat || state.effectQueue.length) return { status: "failed", message: "An attack cannot start now." };
    if (!legalAttacker(state, definitions, playerId, attackerId)) return { status: "failed", message: "That card cannot attack." };
    if (!legalTarget(state, playerId, targetId)) return { status: "failed", message: "That is not a valid attack target." };
    const attacker = findCard(state, attackerId).card;
    attacker.state = "rested";
    state.pendingCombat = { id: createId("combat"), attackerId, targetId, originalTargetId: targetId, attackerPlayerId: playerId, defenderPlayerId: otherPlayerId(playerId), window: "effects", counterPower: 0, passed: [] };
    appendLog(state, `${definitions[attacker.definitionId]?.name || attacker.definitionId} attacked.`);
    queueTrigger(state, definitions, "whenAttacking", attackerId, playerId, "attack");
    queuePlayerBoardTriggers(state, definitions, "onOpponentAttack", otherPlayerId(playerId), "attack");
    queueTrigger(state, definitions, "whenAttacked", targetId, otherPlayerId(playerId), "attack");
    return { status: "completed" };
}

export function continueCombat(state, definitions) {
    const combat = state.pendingCombat;
    if (!combat || state.pendingSelection || state.pendingActivation || state.effectQueue.length) return { status: "paused" };
    if (combat.window === "effects") {
        const defender = getPlayer(state, combat.defenderPlayerId);
        combat.validBlockerIds = defender.characters.filter(card => card?.state === "active" && hasBlocker(definitions[card.definitionId])).map(card => card.instanceId);
        combat.window = combat.validBlockerIds.length ? "blocker" : "counter";
        return { status: "awaitingResponse", playerId: combat.defenderPlayerId, window: combat.window };
    }
    if (combat.window === "counterEffects") {
        combat.window = "counter";
        return { status: "awaitingResponse", playerId: combat.defenderPlayerId, window: "counter" };
    }
    return { status: "paused" };
}

export function chooseBlocker(state, definitions, queueTrigger, playerId, blockerId) {
    const combat = state.pendingCombat;
    if (!combat || combat.window !== "blocker" || combat.defenderPlayerId !== playerId) return { status: "failed", message: "There is no Blocker choice for this player." };
    if (blockerId) {
        if (!combat.validBlockerIds.includes(blockerId)) return { status: "failed", message: "That card is not a valid Blocker." };
        const blocker = findCard(state, blockerId)?.card;
        if (!blocker || blocker.state !== "active") return { status: "failed", message: "Blocker is no longer valid." };
        blocker.state = "rested";
        combat.targetId = blockerId;
        const queued = queueTrigger(state, definitions, "onBlock", blockerId, playerId, "block").queued || 0;
        combat.window = queued ? "counterEffects" : "counter";
        return { status: "completed" };
    }
    combat.window = "counter";
    return { status: "awaitingResponse", playerId, window: "counter" };
}

export function useCounter(state, definitions, playerId, cardId) {
    const combat = state.pendingCombat;
    if (!combat || combat.window !== "counter" || combat.defenderPlayerId !== playerId) return { status: "failed", message: "There is no Counter window for this player." };
    const location = findCard(state, cardId);
    const amount = Number(definitions[location?.card.definitionId]?.counter || 0);
    if (!location || location.zone !== "hand" || location.card.controllerId !== playerId || amount <= 0) return { status: "failed", message: "That card cannot be used as a Counter." };
    const [card] = location.player.hand.splice(location.index, 1);
    card.zone = "trash";
    location.player.trash.unshift(card);
    combat.counterPower += amount;
    appendLog(state, `${location.player.name} countered for ${amount}.`);
    return { status: "completed" };
}

export function resolveBattle(state, definitions, queueTrigger) {
    const combat = state.pendingCombat;
    if (!combat || combat.window !== "counter") return { status: "failed", message: "Battle is not ready to resolve." };
    const attackerLocation = findCard(state, combat.attackerId);
    const targetLocation = findCard(state, combat.targetId);
    if (!attackerLocation || !targetLocation) {
        state.pendingCombat = null;
        return { status: "completed" };
    }
    const attackPower = getEffectivePower(attackerLocation.card, definitions[attackerLocation.card.definitionId], state);
    const targetPower = getEffectivePower(targetLocation.card, definitions[targetLocation.card.definitionId], state) + combat.counterPower;
    state.pendingCombat = null;
    if (attackPower < targetPower) {
        appendLog(state, `Attack failed (${attackPower} vs ${targetPower}).`);
        return { status: "completed" };
    }
    if (targetLocation.zone === "characterArea") {
        const card = targetLocation.card;
        targetLocation.player.characters[targetLocation.index] = null;
        if (card.attachedDon) targetLocation.player.restedDon += card.attachedDon;
        card.attachedDon = 0;
        card.zone = "trash";
        card.controllerId = card.ownerId;
        getPlayer(state, card.ownerId).trash.unshift(card);
        queueTrigger(state, definitions, "onKO", card.instanceId, card.ownerId, "battle");
        appendLog(state, `${definitions[card.definitionId]?.name || card.definitionId} was K.O.'d in battle.`);
        return { status: "completed" };
    }
    const defender = targetLocation.player;
    if (!defender.life.length) {
        finishGame(state, combat.attackerPlayerId, combat.defenderPlayerId, "zero-Life damage");
        return { status: "completed", gameOver: true };
    }
    const lifeCard = defender.life.shift();
    const definition = definitions[lifeCard.definitionId];
    const triggerEffects = getActivatorEffects(definition, "trigger", { executableOnly: true });
    if (triggerEffects.length) {
        lifeCard.zone = "pendingTrigger";
        state.pendingTrigger = { id: createId("trigger"), playerId: defender.id, card: lifeCard, damageActivatorPlayerId: defender.id };
        return { status: "awaitingTrigger", playerId: defender.id };
    }
    lifeCard.zone = "hand";
    lifeCard.face = "up";
    defender.hand.push(lifeCard);
    queuePlayerBoardTriggers(state, definitions, "onOpponentDealsDamage", defender.id, "battleDamage");
    return { status: "completed" };
}

export function resolveLifeTriggerChoice(state, definitions, queueTrigger, playerId, activate) {
    const pending = state.pendingTrigger;
    if (!pending || pending.playerId !== playerId) return { status: "failed", message: "There is no Trigger choice for this player." };
    state.pendingTrigger = null;
    const player = getPlayer(state, playerId);
    if (activate) {
        pending.card.zone = "trash";
        player.trash.unshift(pending.card);
        queueTrigger(state, definitions, "trigger", pending.card.instanceId, playerId, "life");
    } else {
        pending.card.zone = "hand";
        pending.card.face = "up";
        player.hand.push(pending.card);
    }
    if (pending.damageActivatorPlayerId) queuePlayerBoardTriggers(state, definitions, "onOpponentDealsDamage", pending.damageActivatorPlayerId, "battleDamage");
    return { status: "completed" };
}
