// decks.js

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
4xBK01-015
4xBK01-016
`;

const rEggmanDeckText = `
4xEGG1-002
4xEGG1-003
4xEGG1-004
4xEGG1-005
4xEGG1-006
4xEGG1-007
4xEGG1-008
4xEGG1-009
4xEGG1-010
4xEGG1-011
4xEGG1-012
2xEGG1-013
4xEGG1-014
`;

const ryIchigoDeckText = `
1xBL01-002
1xBL01-003
1xBL01-004
1xBL01-005
2xBL01-006
4xBL01-007
4xBL01-008
4xBL01-009
4xBL01-010
4xBL01-011
4xBL01-012
4xBL01-013
4xBL01-014
4xBL01-015
4xBL01-016
4xBL01-017
`;

const uTaglavnovicDeckText = `
4xPOG1-002
3xPOG1-003
4xPOG1-004
4xPOG1-005
4xPOG1-006
4xPOG1-007
4xPOG1-008
4xPOG1-009
4xPOG1-010
3xPOG1-011
4xPOG1-012
4xPOG1-013
4xPOG1-014
`;

const ubHigurumaDeckText = `
6xJK01-002
6xJK01-003
6xJK01-004
6xJK01-005
4xJK01-006
4xJK01-007
4xJK01-008
2xJK01-009
4xJK01-010
4xJK01-012
`;

const byAceYamatoDeckText = `
2xYAM1-004
4xYAM1-003
4xEB03-057
4xST28-005
4xOP16-099
4xOP16-098
2xOP16-096
4xOP16-085
2xYAM1-002
2xST28-004
2xOP16-082
2xYAM1-005
4xPRB02-016
4xOP13-104
4xOP06-104
2xOP06-107
`;

const gbHanamiDeckText = `
4xJK02-021
4xJK02-013
4xJK02-011
4xJK02-010
4xJK02-008
4xJK02-012
3xJK02-014
3xJK02-017
3xJK02-018
3xJK02-020
2xJK02-019
2xJK02-016
2xJK02-015
2xJK02-002
2xJK02-003
1xJK02-005
1xJK02-006
1xJK02-007
1xJK02-009
`;

const ySubaruDeckText = `
4xSUB1-002
4xSUB1-003
4xSUB1-004
4xSUB1-005
4xSUB1-006
4xSUB1-007
4xSUB1-008
4xSUB1-009
4xSUB1-010
4xSUB1-011
4xSUB1-012
4xSUB1-013
2xSUB1-014
`;

const rbNeronaImuDeckText = `
4xIMU1-009
2xIMU1-006
4xIMU1-008
4xIMU1-007
4xIMU1-010
2xIMU1-013
4xIMU1-002
4xIMU1-005
4xIMU1-012
4xIMU1-011
2xIMU1-003
2xIMU1-004
`;

const rbKillerDeckText = `
4xKIL1-002
2xKIL1-010
4xKIL1-011
4xKIL1-013
4xKIL1-004
4xKIL1-003
4xKIL1-005
4xKIL1-006
4xKIL1-007
4xKIL1-008
4xKIL1-009
4xKIL1-012
4xKIL1-014
`;

const availableDecks = [
    {
        id: "okarun-deck",
        name: "GP Okarun",
        leaderKey: "DD01-001",
        deckText: okarunDeckText
    },
    {
        id: "rb-guts-deck",
        name: "RB Guts",
        leaderKey: "BK01-001",
        deckText: rbGutsDeckText
    },
    {
        id: "r-eggman-deck",
        name: "R Eggman",
        leaderKey: "EGG1-001",
        deckText: rEggmanDeckText
    },
    {
        id: "ry-ichigo-deck",
        name: "RY Ichigo",
        leaderKey: "BL01-001",
        deckText: ryIchigoDeckText
    },
    {
        id: "u-taglavnovic-deck",
        name: "U Taglavnovič",
        leaderKey: "POG1-001",
        deckText: uTaglavnovicDeckText
    },
    {
        id: "ub-higuruma-deck",
        name: "UB Higuruma",
        leaderKey: "JK01-001",
        deckText: ubHigurumaDeckText
    },
    {
        id: "by-ace-yamato-deck",
        name: "BY Ace & Yamato",
        leaderKey: "YAM1-001",
        deckText: byAceYamatoDeckText
    },
    {
        id: "gb-hanami-deck",
        name: "GB Hanami",
        leaderKey: "JK02-001",
        deckText: gbHanamiDeckText
    },
    {
        id: "y-subaru-deck",
        name: "Y Subaru",
        leaderKey: "SUB1-001",
        deckText: ySubaruDeckText
    },
    {
        id: "rb-nerona-imu-deck",
        name: "RB Nerona Imu",
        leaderKey: "IMU1-001",
        deckText: rbNeronaImuDeckText
    },
    {
        id: "rb-killer-deck",
        name: "RB Killer",
        leaderKey: "KIL1-001",
        deckText: rbKillerDeckText
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
