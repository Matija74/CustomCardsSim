// Card-specific On Play resolutions composed only from registered staple actions.
// Keep this file declarative: activator timing belongs to the game engine and
// reusable state mutations belong to js/game/actions/.
export const onPlayEffectDefinitions = Object.freeze({
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
    }
});
