// Card-specific On K.O. resolutions composed only from registered staple
// actions. K.O. detection remains in the battle system and card actions.
export const onKOEffectDefinitions = Object.freeze({
    "DD01-008-on-ko-draw": {
        trigger: "onKO",
        actions: [{ action: "drawCard", player: "self", quantity: 1 }]
    },
    "DD01-012-on-ko-add-don": {
        trigger: "onKO",
        optional: true,
        actions: [{ action: "addDon", player: "self", quantity: 1, cardState: "active" }]
    },
    "OP14-089-on-ko-draw-trash": {
        trigger: "onKO",
        actions: [
            { action: "drawCard", player: "self", quantity: 2 },
            {
                action: "trashCard",
                actingPlayer: "self",
                selection: {
                    controller: "self",
                    area: "hand",
                    amount: 2
                }
            }
        ]
    },
    "OP06-104-on-ko-add-life": {
        trigger: "onKO",
        requirements: { opponentLifeAtMost: 3 },
        actions: [{ action: "heal", player: "self", quantity: 1, deckLocation: "top", position: "top", orientation: "down" }]
    },
    "OP16-096-on-ko-play-yamato": {
        trigger: "onKO",
        actions: [{
            action: "playCard",
            destination: "characterArea",
            cardState: "active",
            cause: "effect",
            selection: {
                controller: "self",
                area: "trash",
                amount: 1,
                upTo: true,
                excludeSource: true,
                filters: {
                    name: "Yamato",
                    cardType: "character",
                    maximumCost: 6
                }
            }
        }]
    },
    "YAM1-002-on-ko-lock-rest": {
        trigger: "onKO",
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
    "KIL1-010-on-ko": {
        trigger: "onKO",
        requirements: { sourceAttachedDonAtLeast: 2 },
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
    }
});
