// Card-specific On Play resolutions composed only from registered staple actions.
// Keep this file declarative: activator timing belongs to the game engine and
// reusable state mutations belong to js/game/actions/.
export const onPlayEffectDefinitions = Object.freeze({
    "BK01-004-on-play-minus-cost": {
        trigger: "onPlay",
        requirements: { characterName: "Guts" },
        actions: [{
            action: "decreaseCost",
            amount: 1,
            duration: "turn",
            selection: { controller: "opponent", area: "characterArea", amount: 1, upTo: true }
        }]
    },
    "BK01-009-on-play-ko-cost-five": {
        trigger: "onPlay",
        actions: [{
            action: "cardKO",
            selection: {
                controller: "opponent",
                area: "characterArea",
                amount: 1,
                upTo: true,
                filters: { maximumCost: 5 }
            },
            cause: "effect"
        }]
    },
    "BK01-010-on-play-rush": {
        trigger: "onPlay",
        requirements: { characterName: "Farnese de Vandimion" },
        actions: [{ action: "grantKeyword", target: "source", keyword: "rush", duration: "whileInPlay" }]
    },
    "BK01-012-on-play-minus-cost": {
        trigger: "onPlay",
        actions: [{
            action: "decreaseCost",
            amount: 2,
            duration: "turn",
            selection: {
                controller: "opponent",
                area: "characterArea",
                amount: 1,
                upTo: true
            }
        }]
    },
    "BK01-014-on-play-ko-each": {
        trigger: "onPlay",
        actions: [
            {
                action: "cardKO",
                selection: {
                    controller: "self",
                    area: "characterArea",
                    amount: 1,
                    upTo: true
                },
                cause: "effect"
            },
            {
                action: "cardKO",
                selection: {
                    controller: "opponent",
                    area: "characterArea",
                    amount: 1,
                    upTo: true
                },
                cause: "effect"
            }
        ]
    },
    "DD01-008-on-play-add-don": {
        trigger: "onPlay",
        optional: true,
        actions: [{ action: "addDon", player: "self", quantity: 1, cardState: "rested" }]
    },
    "DD01-009-on-play-rest-character": {
        trigger: "onPlay",
        actions: [{
            action: "restCard",
            allowOpponent: true,
            selection: {
                controller: "opponent",
                area: "characterArea",
                amount: 1,
                upTo: true,
                filters: { maximumCost: 4, state: "active" }
            }
        }]
    },
    "IMU1-003-on-play": {
        trigger: "onPlay",
        actions: [{
            action: "increasePower",
            amount: 1000,
            duration: "turn",
            selection: {
                controller: "self",
                area: "characterArea",
                amount: 1,
                upTo: true,
                filters: { typeIncludes: "Holy Knight" }
            }
        }]
    },
    "IMU1-009-on-play": {
        trigger: "onPlay",
        actions: [
            {
                action: "search",
                player: "self",
                deckLocation: "top",
                quantity: 4,
                amountTaken: 1,
                targetArea: "hand",
                upTo: true,
                filters: { typeIncludes: "Holy Knight" }
            },
            { action: "returnRest", deckLocation: "bottom" }
        ]
    },
    "JK02-012-on-play": {
        trigger: "onPlay",
        actions: [{
            action: "decreaseCost",
            amount: 3,
            duration: "turn",
            selection: {
                controller: "opponent",
                area: "characterArea",
                amount: 1,
                upTo: true
            }
        }]
    },
    "JK02-011-on-play": {
        trigger: "onPlay",
        actions: [{
            action: "decreaseCost",
            amount: 4,
            duration: "turn",
            selection: {
                controller: "opponent",
                area: "characterArea",
                amount: 1
            }
        }]
    },
    "JK02-008-on-play": {
        trigger: "onPlay",
        requirements: { restedCharactersAtLeast: 2 },
        actions: [{
            action: "cardKO",
            selection: { controller: "opponent", area: "characterArea", amount: 1, filters: { maximumCost: 4 } },
            cause: "effect"
        }]
    },
    "JK02-013-on-play": {
        trigger: "onPlay",
        actions: [{
            action: "restandCard",
            selection: {
                controller: "self",
                area: "characterArea",
                amount: 1,
                filters: { maximumCost: 5, state: "rested" }
            }
        }]
    },
    "JK02-020-on-play": {
        trigger: "onPlay",
        actions: [{
            action: "cardKO",
            selection: {
                controller: "opponent",
                area: "characterArea",
                amount: 1,
                filters: { maximumCost: 1 }
            },
            cause: "effect"
        }]
    },
    "JK02-017-on-play": {
        trigger: "onPlay",
        requirements: { restedCharactersAtLeast: 2 },
        actions: [
            { action: "drawCard", player: "self", quantity: 2 },
            { action: "trashCard", selection: { controller: "self", area: "hand", amount: 1 } }
        ]
    },
    "KIL1-010-on-play": {
        trigger: "onPlay",
        actions: [{
            action: "cardKO",
            selection: {
                controller: "opponent",
                area: "characterArea",
                amount: 1,
                upTo: true,
                filters: { maximumPower: 6000 }
            },
            cause: "effect"
        }]
    },
    "IMU1-006-on-play": {
        trigger: "onPlay",
        actions: [{
            action: "trashCard",
            selection: {
                controller: "opponent",
                area: "characterArea",
                amount: 1,
                upTo: true,
                filters: { maximumPower: 8000 }
            }
        }]
    },
    "KIL1-002-on-play-search": {
        trigger: "onPlay",
        actions: [
            {
                action: "search",
                player: "self",
                deckLocation: "top",
                quantity: 3,
                amountTaken: 1,
                targetArea: "hand",
                upTo: true,
                filters: { typeIncludes: "Kid Pirates", excludeName: "Dive" }
            },
            { action: "trashRest" }
        ]
    },
    "ST28-005-on-play-search": {
        trigger: "onPlay",
        actions: [
            {
                action: "search",
                player: "self",
                deckLocation: "top",
                quantity: 5,
                amountTaken: 1,
                targetArea: "hand",
                upTo: true,
                filters: { typeIncludes: "Land of Wano", minimumCost: 2 }
            },
            { action: "returnRest", deckLocation: "bottom" }
        ]
    },
    "SUB1-006-on-play-search": {
        trigger: "onPlay",
        actions: [
            {
                action: "search",
                player: "self",
                deckLocation: "top",
                quantity: 5,
                amountTaken: 1,
                targetArea: "hand",
                upTo: true,
                filters: { typeIncludes: "RE:ZERO" }
            },
            { action: "returnRest", deckLocation: "bottom" }
        ]
    },
    "SUB1-002-on-play-life": {
        trigger: "onPlay",
        requirements: { lifeAtMost: 2 },
        actions: [{ action: "heal", player: "self", quantity: 1, deckLocation: "top", position: "top", orientation: "down" }]
    },
    "SUB1-005-on-play-life-rush": {
        trigger: "onPlay",
        actions: [
            { action: "heal", player: "self", quantity: 1, deckLocation: "top", position: "top", orientation: "down" },
            { action: "grantKeyword", target: "source", keyword: "rush: characters", duration: "whileInPlay" }
        ]
    },
    "OP16-082-on-play-search": {
        trigger: "onPlay",
        requirements: { leaderTypeIncludes: "Land of Wano" },
        actions: [
            {
                action: "search",
                player: "self",
                deckLocation: "top",
                quantity: 5,
                amountTaken: 1,
                targetArea: "hand",
                upTo: true,
                filters: { typeIncludes: "Land of Wano" }
            },
            { action: "trashRest" }
        ]
    },
    "YAM1-005-on-play-draw": {
        trigger: "onPlay",
        optional: true,
        actions: [
            {
                action: "trashCard",
                actingPlayer: "self",
                selection: {
                    controller: "self",
                    area: "hand",
                    amount: 1,
                    filters: { typeIncludes: "Land of Wano" }
                }
            },
            { action: "drawCard", player: "self", quantity: 2 }
        ]
    },
    "EGG1-014-on-play-freeze": {
        trigger: "onPlay",
        actions: [{
            action: "preventStateChange",
            prevention: "cannotAttack",
            duration: "untilEndOfOpponentTurn",
            selection: {
                controller: "opponent",
                area: "characterArea",
                amount: 2,
                upTo: true,
                filters: { maximumCost: 7 }
            }
        }]
    },
    "YAM1-002-on-play-lock-rest": {
        trigger: "onPlay",
        actions: [{
            action: "preventStateChange",
            prevention: "cannotBeRested",
            duration: "untilEndOfOpponentTurn",
            selection: {
                controller: "opponent",
                area: "characterArea",
                amount: 1,
                upTo: true,
                filters: { maximumCost: 6 }
            }
        }]
    },
    "JK02-019-on-play": {
        trigger: "onPlay",
        actions: [
            {
                action: "playCard",
                destination: "characterArea",
                cause: "effect",
                selection: {
                    controller: "self",
                    area: "trash",
                    amount: 1,
                    upTo: true,
                    filters: { cardType: "character", maximumCost: 4 }
                }
            },
            {
                action: "playCard",
                destination: "characterArea",
                cause: "effect",
                selection: {
                    controller: "self",
                    area: "trash",
                    amount: 1,
                    upTo: true,
                    filters: { cardType: "character", maximumCost: 2 }
                }
            }
        ]
    },
    "SUB1-013-on-play-search-two": {
        trigger: "onPlay",
        actions: [
            {
                action: "flipLife",
                selection: { controller: "self", area: "life", amount: 1 }
            },
            {
                action: "search",
                player: "self",
                deckLocation: "top",
                quantity: 5,
                amountTaken: 2,
                targetArea: "hand",
                upTo: true,
                filters: { typeIncludes: "RE:ZERO" }
            },
            { action: "returnRest", deckLocation: "bottom" }
        ]
    },
    "SUB1-014-on-play-play-ram": {
        trigger: "onPlay",
        actions: [{
            action: "playCard",
            destination: "characterArea",
            cause: "effect",
            selection: {
                controller: "self",
                area: ["hand", "trash"],
                amount: 1,
                upTo: true,
                filters: { name: "Ram", cardType: "character" }
            }
        }]
    },
    "IMU1-005-on-play": {
        trigger: "onPlay",
        actions: [{
            action: "playCard",
            destination: "stage",
            cause: "effect",
            selection: {
                controller: "self",
                area: ["hand", "trash"],
                amount: 1,
                upTo: true,
                filters: { name: "Mary Geoise", cardType: "stage" }
            }
        }]
    },
    "OP16-085-on-play-play-trash": {
        trigger: "onPlay",
        actions: [{
            action: "playCard",
            destination: "characterArea",
            cause: "effect",
            selection: {
                controller: "self",
                area: "trash",
                amount: 1,
                upTo: true,
                filters: {
                    typeIncludes: "Land of Wano",
                    cardType: "character",
                    maximumCost: 6,
                    excludeName: "Kouzuki Momonosuke"
                }
            }
        }]
    },
    "POG1-002-leader-cannot-attack": {
        trigger: "onPlay",
        actions: [{
            action: "preventStateChange",
            prevention: "cannotAttack",
            duration: "whileInPlay",
            selection: { controller: "self", area: "leader", amount: 1 }
        }]
    }
});
