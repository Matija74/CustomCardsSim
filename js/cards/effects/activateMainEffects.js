// Card-specific Activate: Main and Event Main resolutions composed only from
// registered staple actions. Timing and activation validation stay in the game
// engine; this module only describes each card's ordered resolution steps.
export const activateMainEffectDefinitions = Object.freeze({
    "BK01-008-activate-main-minus-cost-rest": {
        trigger: "activateMain",
        actions: [
            {
                action: "decreaseCost",
                amount: 2,
                duration: "turn",
                selection: {
                    controller: "opponent",
                    area: "characterArea",
                    amount: 1,
                    upTo: true
                }
            },
            { action: "restCard", target: "source" }
        ]
    },
    "BK01-011-main": {
        trigger: "activateMain",
        actions: [
            {
                action: "decreaseCost",
                amount: 2,
                duration: "turn",
                selection: {
                    controller: "opponent",
                    area: "characterArea",
                    amount: 1,
                    upTo: true
                }
            },
            {
                action: "cardKO",
                selection: {
                    controller: "opponent",
                    area: "characterArea",
                    amount: 1,
                    upTo: true,
                    filters: { maximumCost: 5 }
                },
                cause: "effect"
            }
        ]
    },
    "DD01-005-main": {
        trigger: "activateMain",
        actions: [
            {
                action: "search",
                player: "self",
                deckLocation: "top",
                quantity: 5,
                amountTaken: 1,
                targetArea: "hand",
                upTo: true,
                filters: { typeIncludes: "Dandadan" }
            },
            { action: "returnRest", deckLocation: "bottom" }
        ]
    },
    "IMU1-011-main": {
        trigger: "activateMain",
        actions: [
            { action: "restDon", player: "self", quantity: 2 },
            {
                action: "trashCard",
                selection: {
                    controller: "opponent",
                    area: "characterArea",
                    amount: 1,
                    upTo: true,
                    filters: { maximumPower: 5000 }
                }
            }
        ]
    },
    "JK02-010-activate-main": {
        trigger: "activateMain",
        oncePerTurn: true,
        actions: [{
            action: "restCard",
            allowOpponent: true,
            selection: {
                controller: "opponent",
                area: "characterArea",
                amount: 1,
                filters: { maximumCost: 4, state: "active" }
            }
        }]
    },
    "JK02-001-activate-main": {
        trigger: "activateMain",
        oncePerTurn: true,
        actions: [{
            action: "grantKeyword",
            keyword: "rush",
            duration: "turn",
            selection: {
                controller: "self",
                area: "characterArea",
                amount: 1,
                filters: { state: "rested" }
            }
        }]
    },
    "JK02-012-activate-main": {
        trigger: "activateMain",
        oncePerTurn: true,
        actions: [{
            action: "cardKO",
            selection: {
                controller: "opponent",
                area: "characterArea",
                amount: 1,
                upTo: true,
                filters: { maximumCost: 0 }
            },
            cause: "effect"
        }]
    },
    "OP16-098-activate-main-play-yamato": {
        trigger: "activateMain",
        actions: [
            { action: "trashCard", target: "source" },
            {
                action: "playCard",
                destination: "characterArea",
                cause: "effect",
                selection: {
                    controller: "self",
                    area: "trash",
                    amount: 1,
                    upTo: true,
                    filters: {
                        name: "Yamato",
                        cardType: "character",
                        color: "black",
                        minimumCost: 8,
                        maximumCost: 8
                    }
                }
            }
        ]
    },
    "POG1-004-main": {
        trigger: "activateMain",
        actions: [
            {
                action: "search",
                player: "self",
                deckLocation: "top",
                quantity: 4,
                amountTaken: 1,
                targetArea: "hand",
                upTo: true,
                filters: { typeIncludes: "Film" }
            },
            { action: "returnRest", deckLocation: "bottom" }
        ]
    },
    "POG1-008-main": {
        trigger: "activateMain",
        actions: [
            {
                action: "attachDon",
                quantity: 1,
                selection: { controller: "self", area: "leader", amount: 1 }
            },
            {
                action: "increasePower",
                amount: 1000,
                duration: "turn",
                selection: {
                    controller: "self",
                    area: ["leader", "characterArea"],
                    amount: 1,
                    upTo: true
                }
            }
        ]
    },
    "POG1-013-activate-main": {
        trigger: "activateMain",
        oncePerTurn: true,
        actions: [
            {
                action: "returnCardToDeck",
                position: "bottom",
                selection: {
                    controller: "self",
                    area: "trash",
                    amount: 2
                }
            },
            { action: "drawCard", player: "self", quantity: 1 }
        ]
    },
    "ST28-004-activate-main-rush": {
        trigger: "activateMain",
        oncePerTurn: true,
        actions: [
            { action: "detachDon", target: "source", quantity: 2 },
            { action: "grantKeyword", target: "source", keyword: "rush", duration: "turn" },
            { action: "increasePower", target: "source", amount: 1000, duration: "turn" }
        ]
    },
    "YAM1-001-activate-main-life": {
        trigger: "activateMain",
        oncePerTurn: true,
        actions: [
            {
                action: "cardKO",
                selection: {
                    controller: "self",
                    area: "characterArea",
                    amount: 2,
                    filters: { typeIncludes: "Land of Wano" }
                },
                cause: "effect"
            },
            {
                action: "moveCardToLife",
                player: "self",
                position: "top",
                face: "down",
                selection: {
                    controller: "self",
                    area: "hand",
                    amount: 1,
                    upTo: true
                }
            }
        ]
    },
    "JK02-015-activate-main": {
        trigger: "activateMain",
        requirements: { handAtLeast: 1 },
        actions: [
            {
                action: "trashCard",
                actingPlayer: "self",
                selection: { controller: "self", area: "hand", amount: 1 }
            },
            {
                action: "grantKeyword",
                keyword: "blocker",
                duration: "permanent",
                selection: {
                    controller: "self",
                    area: "characterArea",
                    amount: 1,
                    filters: { typeIncludes: "Curse Spirit", maximumCost: 3 }
                }
            }
        ]
    },
    "JK02-020-activate-main": {
        trigger: "activateMain",
        requirements: { handAtLeast: 2 },
        actions: [
            {
                action: "trashCard",
                actingPlayer: "self",
                selection: { controller: "self", area: "hand", amount: 2 }
            },
            {
                action: "decreaseCost",
                amount: 5,
                duration: "turn",
                selection: { controller: "opponent", area: "characterArea", amount: 1 }
            }
        ]
    },
    "DD01-011-main": {
        trigger: "activateMain",
        requirements: { lifeAtLeast: 1 },
        actions: [
            { action: "damage", player: "self", quantity: 1, cause: "effect cost" },
            {
                action: "restandCard",
                selection: {
                    controller: "self",
                    area: ["leader", "characterArea", "stage"],
                    amount: 1,
                    filters: { name: "Okarun", state: "rested" }
                }
            }
        ]
    },
    "BL01-017-main": {
        trigger: "activateMain",
        requirements: { leaderName: "Kurosaki Ichigo", activeDonAtLeast: 7 },
        actions: [
            { action: "restDon", player: "self", quantity: 7 },
            { action: "heal", player: "self", quantity: 1, deckLocation: "top", position: "top", orientation: "down" }
        ]
    },
    "POG1-010-main": {
        trigger: "activateMain",
        requirements: { activeDonAtLeast: 3 },
        actions: [
            { action: "restDon", player: "self", quantity: 3 },
            {
                action: "preventStateChange",
                prevention: "skipRefreshActivation",
                duration: "nextRefresh",
                selection: {
                    controller: "opponent",
                    area: "characterArea",
                    amount: 1,
                    upTo: true,
                    filters: { state: "rested" }
                }
            }
        ]
    },
    "JK02-009-main": {
        trigger: "activateMain",
        requirements: { restedCharactersAtLeast: 4 },
        actions: [{
            action: "cardKO",
            selection: {
                controller: "opponent",
                area: "characterArea",
                amount: 2,
                filters: { maximumCost: 5 }
            },
            cause: "effect"
        }]
    }
});
