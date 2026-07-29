import fs from "node:fs";
import path from "node:path";
import { cardEffectDefinitions } from "../js/cards/effects/cardEffectDefinitions.js";
import { compileCardCollection } from "../js/cards/effects/effectCompiler.js";
import { getEffectActivator } from "../js/game/effects/effectActivators.js";
import { getRegisteredActions } from "../js/game/effects/actionRegistry.js";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataDirectory = path.join(projectRoot, "js", "cards", "data");
const dataFiles = ["characters.json", "stages.json", "events.json", "leaders.json", "onepiece.json"];
const rawCards = Object.assign({}, ...dataFiles.map(file => JSON.parse(fs.readFileSync(path.join(dataDirectory, file), "utf8"))));
const cards = compileCardCollection(rawCards, cardEffectDefinitions);
const registeredActions = new Set(getRegisteredActions());
const unsupportedEffects = [];
const executableEffects = [];
const cardAudits = [];
const unsupportedKeywords = [];
const unsupportedKeywordDetails = {
    rush: "Rush attack permission is not implemented; newly played Characters still cannot attack that turn.",
    doubleattack: "Double Attack damage is not implemented; successful Leader attacks currently take only 1 Life.",
    unblockable: "Unblockable is not enforced; the defending player can still select a Blocker."
};

for (const card of Object.values(cards)) {
    const cardId = card.id || card.cardNumber;
    const statuses = (card.effects || []).map((effect, index) => {
        const activator = getEffectActivator(effect);
        const actions = Array.isArray(effect.actions) ? effect.actions : [];
        const missingActions = actions.filter(action => !registeredActions.has(action?.action)).map(action => action?.action || "(missing action name)");
        const supported = Boolean(activator && actions.length && !missingActions.length);
        let status;
        if (!activator) {
            if (effect.type === "continuous") status = "No continuous-effect evaluator is implemented; this is not an activator.";
            else if (effect.type === "replacement") status = "No replacement-effect interception is implemented; this is not an activator.";
            else if (["yourTurn", "opponentsTurn"].includes(effect.type)) status = "No persistent turn-condition evaluator is implemented; this is not an activator.";
            else status = `Effect type ${effect.type || effect.trigger || "unknown"} is not mapped to an executable rules model.`;
        } else if (!actions.length) {
            status = effect.actionId
                ? `Activator ${activator} is supported, but actionId ${effect.actionId} has no executable compiler mapping.`
                : `Activator ${activator} is supported, but this effect has no executable actions.`;
        } else {
            status = `Unregistered action handler(s): ${[...new Set(missingActions)].join(", ")}.`;
        }
        const row = {
            cardId,
            name: card.name || cardId,
            effectId: effect.id || `${cardId}-effect-${index + 1}`,
            type: effect.type || effect.trigger || "unknown",
            text: effect.text || "(No effect text provided.)",
            status,
            supported,
            activator,
            actions: actions.map(action => action.action)
        };
        (supported ? executableEffects : unsupportedEffects).push(row);
        return row;
    });
    cardAudits.push({ cardId, name: card.name || cardId, effects: card.effects || [], statuses });
    for (const keyword of Array.isArray(card.keywords) ? card.keywords : []) {
        const normalized = String(keyword).toLowerCase().replace(/\s+/g, "");
        if (unsupportedKeywordDetails[normalized]) {
            unsupportedKeywords.push({ cardId, name: card.name || cardId, keyword, status: unsupportedKeywordDetails[normalized] });
        }
    }
}

const sortEffects = (a, b) => a.cardId.localeCompare(b.cardId, undefined, { numeric: true }) || a.effectId.localeCompare(b.effectId);
unsupportedEffects.sort(sortEffects);
executableEffects.sort(sortEffects);
unsupportedKeywords.sort((a, b) => a.cardId.localeCompare(b.cardId, undefined, { numeric: true }) || a.keyword.localeCompare(b.keyword));

const cardsWithUnsupported = cardAudits.filter(card => card.statuses.some(effect => !effect.supported));
const fullySupportedCards = cardAudits.filter(card => card.effects.length && card.statuses.every(effect => effect.supported));
const mixedCards = cardAudits.filter(card => card.statuses.some(effect => effect.supported) && card.statuses.some(effect => !effect.supported));
const noEffectCards = cardAudits.filter(card => !card.effects.length);
const byType = new Map();
for (const row of unsupportedEffects) byType.set(row.type, (byType.get(row.type) || 0) + 1);

const escapeCell = value => String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
const cardList = list => list
    .sort((a, b) => a.cardId.localeCompare(b.cardId, undefined, { numeric: true }))
    .map(card => `${card.cardId} - ${card.name}`)
    .join("; ");
const lines = [
    "# Unsupported Card Effects",
    "",
    "Generated from the current JSON card definitions, the card-effect registry, and the same compiler used by `js/cards/cardDatabase.js`.",
    "",
    "Regenerate this file after each activator batch with:",
    "",
    "```powershell",
    "node scripts/generateUnsupportedEffects.mjs",
    "```",
    "",
    "## Audit summary",
    "",
    `- Saved cards checked: **${cardAudits.length}**`,
    `- Saved effect records checked: **${unsupportedEffects.length + executableEffects.length}**`,
    `- Executable effect records: **${executableEffects.length}**`,
    `- Unsupported effect records: **${unsupportedEffects.length}** across **${cardsWithUnsupported.length} cards**`,
    `- Unsupported printed keyword entries: **${unsupportedKeywords.length}**`,
    `- Cards with every declared effect executable: **${fullySupportedCards.length}**`,
    `- Cards containing both working and unsupported effects: **${mixedCards.length}**`,
    `- Cards with no declared effects: **${noEffectCards.length}**`,
    "",
    "An effect is counted as executable only when its timing maps to the current activator layer, it has a non-empty compiled `actions` array, and every action name is registered. This is a static executable check, not proof that every possible rules interaction has been exhaustively tested.",
    "",
    "Continuous, replacement, and persistent turn-condition effects are included below because they require rules evaluators rather than activator buttons. Printed keywords are audited separately after the effect table.",
    "",
    "## Unsupported effects by type",
    "",
    "| Type | Count |",
    "|---|---:|",
    ...[...byType.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([type, count]) => `| ${escapeCell(type)} | ${count} |`),
    "",
    "## Cards whose declared effects are currently executable",
    "",
    cardList(fullySupportedCards) || "None.",
    "",
    "## Cards with a mixture of working and unsupported effects",
    "",
    cardList(mixedCards) || "None.",
    "",
    "## Executable effect records excluded from the unsupported table",
    "",
    "| Card ID | Name | Effect ID | Activator | Registered actions |",
    "|---|---|---|---|---|",
    ...executableEffects.map(row => `| ${escapeCell(row.cardId)} | ${escapeCell(row.name)} | ${escapeCell(row.effectId)} | ${escapeCell(row.activator)} | ${escapeCell(row.actions.join(", "))} |`),
    "",
    "## Unsupported effect records",
    "",
    "| Card ID | Name | Effect ID | Type | Effect text | Current missing behavior |",
    "|---|---|---|---|---|---|",
    ...unsupportedEffects.map(row => `| ${escapeCell(row.cardId)} | ${escapeCell(row.name)} | ${escapeCell(row.effectId)} | ${escapeCell(row.type)} | ${escapeCell(row.text)} | ${escapeCell(row.status)} |`),
    "",
    "## Unsupported printed keywords",
    "",
    "Blocker is implemented and is intentionally excluded. The following printed keywords still lack their required gameplay behavior:",
    "",
    "| Card ID | Name | Keyword | Current missing behavior |",
    "|---|---|---|---|",
    ...unsupportedKeywords.map(row => `| ${escapeCell(row.cardId)} | ${escapeCell(row.name)} | ${escapeCell(row.keyword)} | ${escapeCell(row.status)} |`),
    ""
];

fs.writeFileSync(path.join(projectRoot, "UNSUPPORTED_CARD_EFFECTS.md"), lines.join("\n"), "utf8");
console.log(`Wrote ${unsupportedEffects.length} unsupported effects and ${unsupportedKeywords.length} unsupported keywords.`);
