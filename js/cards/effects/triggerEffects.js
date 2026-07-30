// Card-specific Trigger resolutions composed only from registered staple
// actions. Life damage timing and the Trigger choice remain in the battle
// system; this module only describes the chosen Trigger's resolution steps.
export const triggerEffectDefinitions = Object.freeze({
    "BK01-002-trigger": {
        trigger: "trigger",
        actions: [{
            action: "increasePower",
            amount: 1000,
            duration: "turn",
            selection: {
                controller: "self",
                area: "leader",
                amount: 1
            }
        }]
    },
    "BL01-016-trigger": {
        trigger: "trigger",
        actions: [{
            action: "increasePower",
            amount: 1000,
            duration: "turn",
            selection: {
                controller: "self",
                area: ["leader", "characterArea"],
                amount: 1,
                upTo: true
            }
        }]
    },
    "IMU1-013-trigger": {
        trigger: "trigger",
        actions: [{
            action: "returnCardToHand",
            selection: {
                controller: "self",
                area: "trash",
                amount: 1,
                upTo: true,
                excludeSource: true,
                filters: { typeIncludes: "Holy Knight" }
            }
        }]
    },
    "KIL1-003-trigger": {
        trigger: "trigger",
        actions: [{
            action: "returnCardToHand",
            selection: {
                controller: "self",
                area: "trash",
                amount: 1,
                upTo: true,
                excludeSource: true,
                filters: { cardType: "character" }
            }
        }]
    },
    "POG1-004-trigger": {
        trigger: "trigger",
        actions: [{ action: "drawCard", player: "self", quantity: 1 }]
    },
    "POG1-013-trigger": {
        trigger: "trigger",
        actions: [
            { action: "drawCard", player: "self", quantity: 2 },
            {
                action: "trashCard",
                actingPlayer: "self",
                selection: {
                    controller: "self",
                    area: "hand",
                    amount: 1
                }
            }
        ]
    },
    "POG1-014-trigger": {
        trigger: "trigger",
        actions: [{
            action: "returnCardToHand",
            selection: {
                controller: "self",
                area: "trash",
                amount: 1,
                excludeSource: true
            }
        }]
    },
    "PRB02-016-trigger-rest": {
        trigger: "trigger",
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
    "SUB1-005-trigger-draw-trash": {
        trigger: "trigger",
        actions: [
            { action: "drawCard", player: "self", quantity: 2 },
            {
                action: "trashCard",
                actingPlayer: "self",
                selection: {
                    controller: "self",
                    area: "hand",
                    amount: 1
                }
            }
        ]
    },
    "BL01-010-trigger": {
        trigger: "trigger",
        actions: [{ action: "playCard", target: "source", destination: "characterArea", cause: "effect" }]
    },
    "SUB1-009-trigger-play": {
        trigger: "trigger",
        actions: [{ action: "playCard", target: "source", destination: "characterArea", cause: "effect" }]
    },
    "YAM1-002-trigger-play": {
        trigger: "trigger",
        requirements: { opponentLifeAtMost: 3, handAtLeast: 1 },
        actions: [
            {
                action: "trashCard",
                actingPlayer: "self",
                selection: { controller: "self", area: "hand", amount: 1 }
            },
            { action: "playCard", target: "source", destination: "characterArea", cause: "effect" }
        ]
    },
    "YAM1-005-trigger-play": {
        trigger: "trigger",
        actions: [{
            action: "playCard",
            destination: "characterArea",
            cause: "effect",
            selection: {
                controller: "self",
                area: "trash",
                amount: 1,
                upTo: true,
                filters: { typeIncludes: "Land of Wano", cardType: "character", maximumCost: 4 }
            }
        }]
    },
    "KIL1-007-trigger": {
        trigger: "trigger",
        requirements: { leaderTypeIncludes: "Kid Pirates" },
        actions: [{ action: "playCard", target: "source", destination: "characterArea", cause: "effect" }]
    },
    "KIL1-013-trigger": {
        trigger: "trigger",
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
    "DD01-011-trigger": {
        trigger: "trigger",
        actions: [{
            action: "restandCard",
            selection: {
                controller: "self",
                area: ["leader", "characterArea", "stage"],
                amount: 1,
                filters: { name: "Okarun", state: "rested" }
            }
        }]
    },
    "SUB1-011-trigger": {
        trigger: "trigger",
        requirements: { lifeAtMost: 0 },
        actions: [
            { action: "heal", player: "self", quantity: 1, deckLocation: "top", position: "top", orientation: "down" },
            {
                action: "trashCard",
                actingPlayer: "self",
                selection: { controller: "self", area: "hand", amount: 1 }
            }
        ]
    },
    "OP06-104-trigger-play": {
        trigger: "trigger",
        requirements: { opponentLifeAtMost: 3 },
        actions: [{ action: "playCard", target: "source", destination: "characterArea", cause: "effect" }]
    },
    "OP14-089-trigger-play": {
        trigger: "trigger",
        actions: [{
            action: "playCard",
            destination: "characterArea",
            cardState: "rested",
            cause: "effect",
            selection: {
                controller: "self",
                area: "trash",
                amount: 1,
                upTo: true,
                filters: { typeIncludes: "Thriller Bark Pirates", cardType: "character", maximumCost: 4 }
            }
        }]
    },
    "YAM1-004-trigger-play-trash": {
        trigger: "trigger",
        actions: [{
            action: "playCard",
            destination: "characterArea",
            cardState: "rested",
            cause: "effect",
            selection: {
                controller: "self",
                area: "trash",
                amount: 1,
                upTo: true,
                filters: { typeIncludes: "Land of Wano", cardType: "character", maximumCost: 6 }
            }
        }]
    }
});
