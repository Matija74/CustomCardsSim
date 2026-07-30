import { meetsEffectRequirements } from "../effects/effectRequirements.js";
import { continuousKeywordDefinitions } from "./continuousKeywordDefinitions.js";

export function normalizeKeyword(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    if (["character rush", "rush characters", "rush: character", "rush: characters"].includes(normalized)) return "rush: characters";
    if (normalized === "doubleattack") return "double attack";
    return normalized;
}

function modifierIsActive(modifier, state) {
    if (modifier.duration === "battle") return Boolean(state.pendingCombat && modifier.battleId === state.pendingCombat.id);
    return modifier.expiresTurn === undefined || modifier.expiresTurn >= state.turnNumber;
}

export function getCardKeywords(state, definitions, card) {
    const definition = definitions[card?.definitionId] || {};
    const keywords = new Set((Array.isArray(definition.keywords) ? definition.keywords : [definition.keywords]).map(normalizeKeyword).filter(Boolean));
    for (const modifier of card?.keywordModifiers || []) {
        if (modifierIsActive(modifier, state)) keywords.add(normalizeKeyword(modifier.keyword));
    }
    for (const effect of definition.effects || []) {
        const rule = continuousKeywordDefinitions[effect.id];
        if (rule && meetsEffectRequirements(state, definitions, card, rule.requirements)) keywords.add(normalizeKeyword(rule.keyword));
    }
    return keywords;
}

export function hasKeyword(state, definitions, card, keyword) {
    return getCardKeywords(state, definitions, card).has(normalizeKeyword(keyword));
}
