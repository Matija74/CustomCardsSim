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
    const [characters, stages, events, leaderCards, onePieceCards] = await Promise.all([
        loadJson("../data/cards/characters.json"),
        loadJson("../data/cards/stages.json"),
        loadJson("../data/cards/events.json"),
        loadJson("../data/cards/leaders.json"),
        loadJson("../data/cards/onepiece.json")
    ]);

    const onePieceEntries = Object.entries(onePieceCards || {});
    const onePieceLeaders = Object.fromEntries(
        onePieceEntries.filter(([, card]) => String(card?.cardType || "").toLowerCase() === "leader")
    );
    const onePieceMainDeckCards = Object.fromEntries(
        onePieceEntries.filter(([, card]) => String(card?.cardType || "").toLowerCase() !== "leader")
    );

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
