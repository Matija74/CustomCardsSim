import { findCard } from "../state/zones.js";
import { completed, failed } from "../checks/validation.js";
import { normalizeKeyword } from "../keywords/cardKeywords.js";

export function grantKeyword(state, definitions, context, action, targets) {
    const keyword = normalizeKeyword(action.keyword);
    if (!keyword || !targets.length) return failed("A keyword and target card are required.");
    for (const instanceId of targets) {
        const card = findCard(state, instanceId)?.card;
        if (!card) return failed("Keyword target was not found.");
        if (card.controllerId !== context.controllerId && action.allowOpponent !== true) return failed("You cannot grant a keyword to the opponent's card.");
        card.keywordModifiers ||= [];
        const expiresTurn = ["turn", "untilEndOfTurn"].includes(action.duration) ? state.turnNumber : undefined;
        card.keywordModifiers.push({ keyword, duration: action.duration || "permanent", expiresTurn, battleId: action.duration === "battle" ? state.pendingCombat?.id : undefined });
    }
    return completed();
}

export const keywordActionHandlers = { grantKeyword };
