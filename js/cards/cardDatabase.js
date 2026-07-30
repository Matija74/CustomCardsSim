// cardDatabase.js

let cardDatabase = {};
let leaders = {};
const jsonLoadCache = new Map();
let cardDatabaseLoadPromise = null;
const cardDatabaseScriptUrl = document.currentScript?.src || "";
const applicationRootUrl = cardDatabaseScriptUrl
    ? new URL("../../", cardDatabaseScriptUrl)
    : new URL("../", window.location.href);

function resolveApplicationAsset(path) {
    if (typeof path !== "string" || !path.trim()) {
        return path;
    }

    const normalizedPath = path.trim().replaceAll("\\", "/");

    if (/^(?:https?:|data:|blob:)/i.test(normalizedPath)) {
        return normalizedPath;
    }

    const knownAssetPath = normalizedPath.match(/(?:^|\/)((?:images|data)\/.+)$/i);

    if (knownAssetPath) {
        return new URL(knownAssetPath[1], applicationRootUrl).href;
    }

    return new URL(normalizedPath, applicationRootUrl).href;
}

function normalizeCardAssets(cards) {
    Object.values(cards || {}).forEach(card => {
        if (card?.image) {
            card.image = resolveApplicationAsset(card.image);
        }
    });

    return cards;
}

async function loadJson(path) {
    const resolvedPath = resolveApplicationAsset(path);
    const fileName = resolvedPath.split("/").pop();
    const bundledData = window.CARD_DATA_BUNDLE?.[fileName];

    if (bundledData) {
        return typeof structuredClone === "function"
            ? structuredClone(bundledData)
            : JSON.parse(JSON.stringify(bundledData));
    }

    if (!jsonLoadCache.has(resolvedPath)) {
        jsonLoadCache.set(resolvedPath, (async () => {
            const response = await fetch(resolvedPath);

            if (!response.ok) {
                throw new Error(`Failed to load JSON file: ${resolvedPath}`);
            }

            return response.json();
        })());
    }

    return jsonLoadCache.get(resolvedPath);
}

async function loadCardDatabase() {
    if (cardDatabaseLoadPromise) {
        return cardDatabaseLoadPromise;
    }

    cardDatabaseLoadPromise = (async () => {
        const [characters, stages, events, leaderCards, onePieceCards] = await Promise.all([
            loadJson("data/cards/characters.json"),
            loadJson("data/cards/stages.json"),
            loadJson("data/cards/events.json"),
            loadJson("data/cards/leaders.json"),
            loadJson("data/cards/onepiece.json")
        ]);

        [
            characters,
            stages,
            events,
            leaderCards,
            onePieceCards
        ].forEach(normalizeCardAssets);

        const onePieceLeaders = {};
        const onePieceMainDeckCards = {};

        Object.entries(onePieceCards || {}).forEach(([cardId, card]) => {
            if (String(card?.cardType || "").toLowerCase() === "leader") {
                onePieceLeaders[cardId] = card;
                return;
            }

            onePieceMainDeckCards[cardId] = card;
        });

        cardDatabase = {
            ...characters,
            ...stages,
            ...events,
            ...onePieceMainDeckCards
        };

        leaders = {
            ...leaderCards,
            ...onePieceLeaders
        };

        window.cardDatabase = cardDatabase;
        window.leaders = leaders;
        window.getCardById = getCardById;
        window.resolveApplicationAsset = resolveApplicationAsset;
    })();

    return cardDatabaseLoadPromise;
}

function cloneCard(card) {
    if (typeof structuredClone === "function") {
        return structuredClone(card);
    }

    return JSON.parse(JSON.stringify(card));
}

function getCardById(cardId) {
    const card = cardDatabase[cardId] || leaders[cardId];

    if (!card) {
        console.error(`Card not found in database: ${cardId}`);
        return null;
    }

    return {
        ...cloneCard(card),
        instanceId: crypto.randomUUID(),
        state: "active",
        rested: false,
        attachedDon: 0
    };
}

window.loadCardDatabase = loadCardDatabase;
window.cardDatabase = cardDatabase;
window.leaders = leaders;
window.getCardById = getCardById;
window.resolveApplicationAsset = resolveApplicationAsset;
