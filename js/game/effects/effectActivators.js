const ACTIVATOR_ALIASES = Object.freeze({
    onPlay: "onPlay",
    onKO: "onKO",
    whenAttacking: "whenAttacking",
    onOpponentAttack: "onOpponentAttack",
    onOpponentsAttack: "onOpponentAttack",
    whenAttacked: "whenAttacked",
    onBlock: "onBlock",
    activateMain: "activateMain",
    main: "activateMain",
    counter: "counter",
    trigger: "trigger",
    gameStart: "gameStart",
    startOfTurn: "startOfTurn",
    endOfTurn: "endOfTurn",
    endOfYourTurn: "endOfTurn",
    endOfOpponentTurn: "endOfOpponentTurn",
    endOfOpponentsTurn: "endOfOpponentTurn",
    onOpponentDealsDamage: "onOpponentDealsDamage",
    onCharacterPlay: "onCharacterPlay",
    whenTrashedFromDeck: "whenTrashedFromDeck"
});

export const MANUAL_ACTIVATORS = Object.freeze(["activateMain", "counter", "trigger"]);
export const AUTOMATIC_ACTIVATORS = Object.freeze([
    "onPlay",
    "onKO",
    "whenAttacking",
    "onOpponentAttack",
    "whenAttacked",
    "onBlock",
    "gameStart",
    "startOfTurn",
    "endOfTurn",
    "endOfOpponentTurn",
    "onOpponentDealsDamage",
    "onCharacterPlay",
    "whenTrashedFromDeck"
]);

const SUPPORTED_ACTIVATORS = new Set([...MANUAL_ACTIVATORS, ...AUTOMATIC_ACTIVATORS]);

export function normalizeActivator(value) {
    return ACTIVATOR_ALIASES[value] || null;
}

export function getEffectActivator(effect) {
    return normalizeActivator(effect?.trigger || effect?.type);
}

export function hasExecutableActions(effect) {
    return Array.isArray(effect?.actions) && effect.actions.length > 0;
}

export function getEffectId(effect, index, activator = getEffectActivator(effect)) {
    return effect?.id || `${activator || "effect"}:${index}`;
}

export function getActivatorEffects(definition, activator, { executableOnly = false } = {}) {
    const normalized = normalizeActivator(activator) || activator;
    if (!SUPPORTED_ACTIVATORS.has(normalized)) return [];
    return (definition?.effects || []).flatMap((effect, index) => {
        if (getEffectActivator(effect) !== normalized || (executableOnly && !hasExecutableActions(effect))) return [];
        return [{
            effect,
            index,
            effectId: getEffectId(effect, index, normalized),
            usageKey: getEffectId(effect, index, normalized),
            executable: hasExecutableActions(effect)
        }];
    });
}

export function getEffectUseLimit(effect) {
    const maximum = Number(effect?.maxUsesPerTurn);
    if (Number.isInteger(maximum) && maximum > 0) return maximum;
    return effect?.oncePerTurn ? 1 : Infinity;
}

export function getEffectUseCount(card, usageKey, turnNumber) {
    const usage = card?.oncePerTurn?.[usageKey];
    if (typeof usage === "number") return usage === turnNumber ? 1 : 0;
    return usage?.turnNumber === turnNumber ? Number(usage.count || 0) : 0;
}

export function canUseEffect(card, effect, usageKey, turnNumber, reservedUses = 0) {
    return getEffectUseCount(card, usageKey, turnNumber) + reservedUses < getEffectUseLimit(effect);
}

export function markEffectUsed(card, usageKey, turnNumber) {
    if (!card) return;
    card.oncePerTurn ||= {};
    const count = getEffectUseCount(card, usageKey, turnNumber) + 1;
    card.oncePerTurn[usageKey] = { turnNumber, count };
}

export function requiresActivationChoice(effect, activator, confirmed = false) {
    return !confirmed && Boolean(effect?.optional) && AUTOMATIC_ACTIVATORS.includes(activator);
}

export function validateMainActivation(state, location, playerId, descriptor) {
    if (state.phase !== "main" || state.activePlayerId !== playerId) return { status: "failed", message: "Main effects can only be activated during your Main Phase." };
    if (state.pendingCombat || state.pendingSelection || state.pendingTrigger || state.pendingActivation || state.effectQueue.length) return { status: "failed", message: "Finish the pending interaction first." };
    if (!location || location.playerId !== playerId || location.card.controllerId !== playerId || !["leader", "characterArea", "stage"].includes(location.zone)) return { status: "failed", message: "You cannot activate that card." };
    if (!descriptor?.executable) return { status: "failed", message: "That Main effect is not implemented yet." };
    if (!canUseEffect(location.card, descriptor.effect, descriptor.usageKey, state.turnNumber)) return { status: "failed", message: "That effect has already reached its use limit this turn." };
    return { status: "completed" };
}

export function validateCounterEventActivation(state, definitions, location, playerId, descriptor) {
    const combat = state.pendingCombat;
    if (!combat || combat.window !== "counter" || combat.defenderPlayerId !== playerId) return { status: "failed", message: "Counter effects can only be activated in your Counter Step." };
    if (state.pendingSelection || state.pendingTrigger || state.pendingActivation || state.effectQueue.length) return { status: "failed", message: "Finish the pending interaction first." };
    const definition = definitions[location?.card.definitionId];
    if (!location || location.zone !== "hand" || location.playerId !== playerId || location.card.controllerId !== playerId || String(definition?.cardType || "").toLowerCase() !== "event") return { status: "failed", message: "You may only activate your own Event from your hand." };
    if (!descriptor?.executable) return { status: "failed", message: "That Counter effect is not implemented yet." };
    if (!canUseEffect(location.card, descriptor.effect, descriptor.usageKey, state.turnNumber)) return { status: "failed", message: "That effect has already reached its use limit this turn." };
    return { status: "completed" };
}

export function getSupportedActivators() {
    return [...SUPPORTED_ACTIVATORS];
}
