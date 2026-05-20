// decks.js

const testDeckText = `
4xTEST-001
4xTEST-002
4xTEST-003
4xTEST-004
4xTEST-005
`;

const okarunDeckText = `
2xDD01-002
4xDD01-003
4xDD01-004
4xDD01-005
4xDD01-006
2xDD01-007
2xDD01-008
4xDD01-009
2xDD01-010
4xDD01-011
2xDD01-012
4xDD01-013
2xDD01-014
4xDD01-015
3xDD01-016
3xDD01-017
`;

const rbGutsDeckText = `
2xBK01-002
4xBK01-003
4xBK01-004
4xBK01-005
4xBK01-006
4xBK01-007
3xBK01-008
3xBK01-009
2xBK01-010
2xBK01-011
4xBK01-012
2xBK01-013
4xBK01-014
3xBK01-015
4xBK01-016
`;

const availableDecks = [
    {
        id: "test-deck",
        name: "Test Deck",
        leaderKey: "testLeader",
        deckText: testDeckText
    },
    {
        id: "okarun-deck",
        name: "Okarun Deck",
        leaderKey: "DD01-001",
        deckText: okarunDeckText
    },
    {
        id: "rb-guts-deck",
        name: "RB Guts by Mrki",
        leaderKey: "BK01-001",
        deckText: rbGutsDeckText
    }
];

function getAvailableDecks() {
    return availableDecks;
}

function getDeckById(deckId) {
    return availableDecks.find(deck => deck.id === deckId) || availableDecks[0];
}

window.availableDecks = availableDecks;
window.getAvailableDecks = getAvailableDecks;
window.getDeckById = getDeckById;
