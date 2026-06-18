// cardDatabase.js

let cardDatabase = {};
let leaders = {};
const jsonLoadCache = new Map();
let cardDatabaseLoadPromise = null;

async function loadJson(path) {
    if (!jsonLoadCache.has(path)) {
        jsonLoadCache.set(path, (async () => {
            const response = await fetch(path);

            if (!response.ok) {
                throw new Error(`Failed to load JSON file: ${path}`);
            }

            return response.json();
        })());
    }

    return jsonLoadCache.get(path);
}

async function loadCardDatabase() {
    if (cardDatabaseLoadPromise) {
        return cardDatabaseLoadPromise;
    }

    cardDatabaseLoadPromise = (async () => {
        const [characters, stages, events, leaderCards, onePieceCards] = await Promise.all([
            loadJson("../data/cards/characters.json"),
            loadJson("../data/cards/stages.json"),
            loadJson("../data/cards/events.json"),
            loadJson("../data/cards/leaders.json"),
            loadJson("../data/cards/onepiece.json")
        ]);

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
    const card = cardDatabase[cardId];

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
