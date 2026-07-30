// Card-specific Counter Event resolutions composed only from registered staple
// actions. Counter-window validation and Event cost payment stay in the engine.
const battlePower = (amount, area = ["leader", "characterArea"], options = {}) => ({
    trigger: "counter",
    actions: [{
        action: "increasePower",
        amount,
        duration: "battle",
        selection: { controller: "self", area, amount: 1, ...options }
    }]
});

export const counterEffectDefinitions = Object.freeze({
    "BL01-017-counter": battlePower(3000, "leader"),
    "EGG1-007-counter": battlePower(4000, ["leader", "characterArea", "stage"], {
        upTo: true,
        filters: { typeIncludes: "Eggman Empire" }
    }),
    "EGG1-012-counter": battlePower(2000),
    "JK02-002-counter": battlePower(3000, "leader"),
    "JK02-009-counter": battlePower(2000),
    "KIL1-013-counter": {
        trigger: "counter",
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
    "OP16-099-counter": battlePower(3000, "leader"),
    "POG1-008-counter": battlePower(2000, ["leader", "characterArea"], { upTo: true }),
    "POG1-009-counter": battlePower(2000, ["leader", "characterArea"], { upTo: true }),
    "POG1-010-counter": battlePower(2000, ["leader", "characterArea"], { upTo: true }),
    "POG1-011-counter": battlePower(2000, ["leader", "characterArea"], { upTo: true }),
    "POG1-014-counter": {
        trigger: "counter",
        actions: [
            battlePower(2000, ["leader", "characterArea"], { upTo: true }).actions[0],
            {
                action: "returnCardToHand",
                selection: {
                    controller: "self",
                    area: "trash",
                    amount: 1,
                    upTo: true,
                    excludeSource: true,
                    filters: { typeIncludes: "Film" }
                }
            }
        ]
    },
    "SUB1-011-counter": {
        trigger: "counter",
        requirements: { otherHandCardsAtLeast: 1 },
        actions: [
            {
                action: "trashCard",
                actingPlayer: "self",
                selection: {
                    controller: "self",
                    area: "hand",
                    amount: 1,
                    excludeSource: true
                }
            },
            {
                action: "increasePower",
                amount: 3000,
                duration: "battle",
                selection: {
                    controller: "self",
                    area: ["leader", "characterArea"],
                    amount: 1,
                    upTo: true
                }
            }
        ]
    }
});
