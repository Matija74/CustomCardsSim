import fs from "node:fs";
import path from "node:path";
import { cardEffectDefinitions } from "../js/cards/effects/cardEffectDefinitions.js";
import { compileCardCollection } from "../js/cards/effects/effectCompiler.js";
import { getEffectActivator } from "../js/game/effects/effectActivators.js";
import { getRegisteredActions } from "../js/game/effects/actionRegistry.js";
import { continuousKeywordDefinitions } from "../js/game/keywords/continuousKeywordDefinitions.js";
import { normalizeKeyword } from "../js/game/keywords/cardKeywords.js";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataDirectory = path.join(projectRoot, "js", "cards", "data");
const dataFiles = ["characters.json", "stages.json", "events.json", "leaders.json", "onepiece.json"];
const rawCards = Object.assign({}, ...dataFiles.map(file => JSON.parse(fs.readFileSync(path.join(dataDirectory, file), "utf8"))));
const cards = compileCardCollection(rawCards, cardEffectDefinitions);
const registeredActions = new Set(getRegisteredActions());
const supportedPrintedKeywords = new Set(["rush", "rush: characters", "blocker", "unblockable", "banish", "double attack"]);

// Keep this list for audited effects that can be expressed without adding new
// engine behavior but have not yet been wired to definitions.
const readyWithCurrentSystem = Object.freeze({});

function isExecutable(effect) {
    if (continuousKeywordDefinitions[effect.id]?.complete) return true;
    const actions = Array.isArray(effect.actions) ? effect.actions : [];
    return Boolean(getEffectActivator(effect) && actions.length && actions.every(action => registeredActions.has(action?.action)));
}

function primaryMissingCapability(row) {
    const text = String(row.text || "").toLowerCase();
    const type = String(row.type || "").toLowerCase();
    if (/checkpoint|under the rules|deck consists|copies of any|you (win|lose) the game|return the game state/.test(text)) {
        return "Special game, deck-building, checkpoint, or win-condition rules";
    }
    if (type === "replacement" || /would be|instead|cannot be k\.o|cannot be removed|negate|change the target|replacement effects/.test(text)) {
        return "Replacement, protection, negation, or attack redirection";
    }
    if (/activate .*('s |its |your |leader's )?(effect|ability)|use one of|choose(:| whether| one)|declare a/.test(text)) {
        return "Branching choices, copied effects, or invoking another effect";
    }
    if (/rested don!!.*(give|attach)|attach .*rested don!!|give up to .*rested don!!/.test(text)) {
        return "Attaching DON!! directly from the rested Cost Area";
    }
    if (["continuous", "yourturn", "opponentsturn", "custom"].includes(type)) {
        return "Persistent, aura, or turn-condition evaluation";
    }
    if (/reveal|shuffle|from (your|the) deck|top .*deck|bottom .*deck|top card of .*life|bottom .*life|life cards until|any card .*life/.test(text)) {
        return "Hidden-card, positional deck, or positional Life operations";
    }
    if (/for every| per 1|same as|same cost|half of|any number|all of|attacked twice|played this turn|that character|that card/.test(text)) {
        return "Dynamic values, bulk operations, or reusing a selected target";
    }
    return "Additional condition, duration, cost, or target-flow support";
}

const executable = [];
const ready = [];
const blocked = [];
const unsupportedKeywords = [];

for (const card of Object.values(cards)) {
    for (const effect of card.effects || []) {
        const row = {
            cardId: card.id || card.cardNumber,
            cardName: card.name || "Unknown card",
            effectId: effect.id,
            type: effect.type || effect.trigger || "unknown",
            text: effect.text || ""
        };
        if (isExecutable(effect)) executable.push(row);
        else if (readyWithCurrentSystem[effect.id]) ready.push({ ...row, buildingBlocks: readyWithCurrentSystem[effect.id] });
        else blocked.push({ ...row, capability: primaryMissingCapability(row) });
    }
    for (const keyword of Array.isArray(card.keywords) ? card.keywords : []) {
        if (!supportedPrintedKeywords.has(normalizeKeyword(keyword))) unsupportedKeywords.push({ cardId: card.id, keyword });
    }
}

const declaredEffectIds = new Set([...executable, ...ready, ...blocked].map(row => row.effectId));
const executableEffectIds = new Set(executable.map(row => row.effectId));
const staleReadyIds = Object.keys(readyWithCurrentSystem).filter(effectId =>
    !declaredEffectIds.has(effectId) || executableEffectIds.has(effectId)
);
if (staleReadyIds.length) {
    throw new Error(`Ready-to-wire audit contains unknown or already executable effect IDs: ${staleReadyIds.join(", ")}`);
}

const byId = (a, b) => a.cardId.localeCompare(b.cardId, undefined, { numeric: true }) || a.effectId.localeCompare(b.effectId);
executable.sort(byId);
ready.sort(byId);
blocked.sort(byId);
unsupportedKeywords.sort((a, b) => a.cardId.localeCompare(b.cardId, undefined, { numeric: true }));

const markdownCell = value => String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();

const effectTable = (rows, includeBuildingBlocks = false) => [
    includeBuildingBlocks
        ? "| Card | Effect ID | Activator | Existing building blocks |"
        : "| Card | Effect ID | Activator | Missing support |",
    includeBuildingBlocks ? "|---|---|---|---|" : "|---|---|---|---|",
    ...rows.map(row => {
        const card = `\`${markdownCell(row.cardId)}\` — ${markdownCell(row.cardName)}`;
        const details = includeBuildingBlocks ? row.buildingBlocks : row.capability;
        return `| ${card} | \`${markdownCell(row.effectId)}\` | ${markdownCell(row.type)} | ${markdownCell(details)} |`;
    })
];

const lines = [
    "# Unsupported Card Effects",
    "",
    "Compact audit generated from every saved card, the compiled card-effect registry, the activator registry, the action registry, continuous keyword rules, and supported printed keywords.",
    "",
    "Regenerate after gameplay-system changes with `node scripts/generateUnsupportedEffects.mjs`.",
    "",
    "## Summary",
    "",
    "| Audit result | Count |",
    "|---|---:|",
    `| Saved cards checked | ${Object.keys(cards).length} |`,
    `| Declared effects checked | ${executable.length + ready.length + blocked.length} |`,
    `| Currently executable | ${executable.length} |`,
    `| Ready to wire with existing activators and staples | ${ready.length} |`,
    `| Requires additional engine behavior | ${blocked.length} |`,
    `| Unsupported printed keywords | ${unsupportedKeywords.length} |`,
    "",
    '"Ready to wire" means the effect is not implemented yet, but its complete rules can be represented with the current system. It does not mean the card works today.',
    "",
    "## Ready to wire with the current system",
    "",
    ...(ready.length
        ? effectTable(ready, true)
        : ["None."]),
    "",
    "## Still blocked by missing engine behavior",
    "",
    "Each effect appears once with its primary missing capability. Some effects will require more than one new capability.",
    "",
    ...effectTable(blocked),
    ""
];

lines.push(
    "## Unsupported printed keywords",
    "",
    ...(unsupportedKeywords.length
        ? [
            "| Card | Unsupported keyword |",
            "|---|---|",
            ...unsupportedKeywords.map(row => `| \`${markdownCell(row.cardId)}\` | ${markdownCell(row.keyword)} |`)
        ]
        : ["None. Rush, Rush: Characters, Blocker, Unblockable, Banish, and Double Attack are implemented."]),
    ""
);

fs.writeFileSync(path.join(projectRoot, "UNSUPPORTED_CARD_EFFECTS.md"), lines.join("\n"), "utf8");
console.log(`Audited ${Object.keys(cards).length} cards: ${executable.length} executable, ${ready.length} ready to wire, ${blocked.length} blocked, ${unsupportedKeywords.length} unsupported keywords.`);
