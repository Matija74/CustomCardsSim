import { finishGame, otherPlayerId } from "../state/gameState.js";
import { findCard, getPlayer, moveCard } from "../state/zones.js";
import { completed, failed, resolvePlayerReference, validatePositiveQuantity } from "../checks/validation.js";

export function heal(state, definitions, context, action) {
    const playerId = resolvePlayerReference(action.player, context);
    const player = getPlayer(state, playerId);
    const check = validatePositiveQuantity(action.quantity);
    if (!player || check.status === "failed") return failed(check.message || "Player was not found.");
    for (let i = 0; i < check.quantity; i += 1) {
        if (!player.deck.length) return completed({ quantity: i });
        const card = action.deckLocation === "bottom" ? player.deck.pop() : player.deck.shift();
        card.zone = "life";
        card.face = action.orientation || "down";
        if (action.position === "bottom") player.life.push(card); else player.life.unshift(card);
    }
    return completed();
}

export function damage(state, definitions, context, action) {
    const playerId = resolvePlayerReference(action.player, context);
    const player = getPlayer(state, playerId);
    const check = validatePositiveQuantity(action.quantity);
    if (!player || check.status === "failed") return failed(check.message || "Player was not found.");
    for (let i = 0; i < check.quantity; i += 1) {
        if (!player.life.length) {
            finishGame(state, otherPlayerId(playerId), playerId, action.cause || "zero-Life damage");
            return completed({ gameOver: true });
        }
        const card = player.life.shift();
        card.zone = "hand";
        card.face = "up";
        player.hand.push(card);
    }
    return completed();
}

export function flipLife(state, definitions, context, action, targets) {
    const location = findCard(state, targets[0] || action.instanceId);
    if (!location || location.zone !== "life") return failed("Selected card is not in Life.");
    location.card.face = action.orientation || (location.card.face === "up" ? "down" : "up");
    return completed();
}

export function reorderLife(state, definitions, context, action, targets) {
    const player = getPlayer(state, resolvePlayerReference(action.player, context));
    if (!player || targets.length !== player.life.length || targets.some((id, index, all) => all.indexOf(id) !== index)) return failed("A complete unique Life order is required.");
    const byId = new Map(player.life.map(card => [card.instanceId, card]));
    if (targets.some(id => !byId.has(id))) return failed("Life order contains an invalid card.");
    player.life = targets.map(id => byId.get(id));
    return completed();
}

function modifier(type, amountFactor = 1, setBase = false) {
    return (state, definitions, context, action, targets) => {
        const card = findCard(state, targets[0] || action.instanceId)?.card;
        const amount = Number(action.amount);
        if (!card || !Number.isFinite(amount)) return failed("Card and numeric amount are required.");
        const key = setBase ? (type === "power" ? "basePower" : "baseCost") : type;
        const expiresThisTurn = ["turn", "endOfTurn", "untilEndOfTurn", "battle"].includes(action.duration);
        card.modifiers[key].push({
            amount: amount * amountFactor,
            duration: action.duration,
            expiresTurn: expiresThisTurn ? state.turnNumber : undefined,
            battleId: action.duration === "battle" ? state.pendingCombat?.id : undefined
        });
        return completed();
    };
}

export const lifeModifierActionHandlers = {
    heal,
    damage,
    flipLife,
    reorderLife,
    increasePower: modifier("power"),
    decreasePower: modifier("power", -1),
    setPower: modifier("power", 1, true),
    increaseCost: modifier("cost"),
    decreaseCost: modifier("cost", -1),
    setCost: modifier("cost", 1, true)
};
