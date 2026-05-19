// cardDatabase.js

let cardDatabase = {};
let leaders = {};

async function loadJson(path) {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`Failed to load JSON file: ${path}`);
    }

    return response.json();
}

async function loadCardDatabase() {
    const [characters, stages, events, leaderCards] = await Promise.all([
        loadJson("../data/cards/characters.json"),
        loadJson("../data/cards/stages.json"),
        loadJson("../data/cards/events.json"),
        loadJson("../data/cards/leaders.json")
    ]);

    cardDatabase = {
        ...characters,
        ...stages,
        ...events
    };

    leaders = leaderCards;

    window.cardDatabase = cardDatabase;
    window.leaders = leaders;
    window.getCardById = getCardById;

    console.log("Card database loaded:", cardDatabase);
    console.log("Leaders loaded:", leaders);
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