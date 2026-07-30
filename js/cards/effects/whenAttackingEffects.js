// Card-specific When Attacking resolutions composed only from registered
// staple actions. Attack declaration and combat-window timing stay in the
// battle system.
export const whenAttackingEffectDefinitions = Object.freeze({
    "DD01-001-when-attacking-active": {
        trigger: "whenAttacking",
        oncePerTurn: true,
        requirements: { stageName: "Turbo Granny Form" },
        actions: [{ action: "restandCard", target: "source" }]
    },
    "DD01-006-when-attacking-active": {
        trigger: "whenAttacking",
        oncePerTurn: true,
        requirements: { stageName: "Turbo Granny Form" },
        actions: [{ action: "restandCard", target: "source" }]
    },
    "BL01-009-when-attacking-ichigo-power": {
        trigger: "whenAttacking",
        actions: [{
            action: "increasePower",
            amount: 1000,
            duration: "turn",
            selection: {
                controller: "self",
                area: ["leader", "characterArea"],
                amount: 1,
                upTo: true,
                filters: { name: "Kurosaki Ichigo" }
            }
        }]
    },
    "BL01-014-when-attacking-minus-ko": {
        trigger: "whenAttacking",
        actions: [
            {
                action: "decreasePower",
                amount: 1000,
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
                    filters: { maximumPower: 4000 }
                },
                cause: "effect"
            }
        ]
    },
    "BL01-011-when-attacking-don-power": {
        trigger: "whenAttacking",
        requirements: { sourceAttachedDonAtLeast: 1 },
        actions: [{ action: "increasePower", target: "source", amount: 3000, duration: "turn" }]
    },
    "EGG1-001-when-attacking-power": {
        trigger: "whenAttacking",
        actions: [{
            action: "increasePower",
            amount: 3000,
            duration: "turn",
            selection: {
                controller: "self",
                area: "characterArea",
                amount: 1,
                filters: { maximumCost: 2 }
            }
        }]
    },
    "IMU1-003-when-attacking": {
        trigger: "whenAttacking",
        actions: [{
            action: "decreasePower",
            amount: 1000,
            duration: "turn",
            selection: {
                controller: "opponent",
                area: ["leader", "characterArea"],
                amount: 1,
                upTo: true
            }
        }]
    },
    "IMU1-010-when-attacking": {
        trigger: "whenAttacking",
        actions: [{
            action: "restandCard",
            selection: {
                controller: "self",
                area: "characterArea",
                amount: 1,
                upTo: true,
                filters: { typeIncludes: "Holy Knight", state: "rested" }
            }
        }]
    },
    "JK01-007-when-attacking": {
        trigger: "whenAttacking",
        oncePerTurn: true,
        actions: [{
            action: "returnCardToHand",
            selection: {
                controller: "self",
                area: "trash",
                amount: 1,
                filters: { name: "Hiromi Higuruma" }
            }
        }]
    },
    "JK02-001-when-attacking": {
        trigger: "whenAttacking",
        optional: true,
        actions: [
            { action: "restDon", player: "self", quantity: 4 },
            {
                action: "restandCard",
                selection: {
                    controller: "self",
                    area: "characterArea",
                    amount: 1,
                    upTo: true,
                    filters: { maximumCost: 6, state: "rested" }
                }
            }
        ]
    },
    "DD01-010-when-attacking-unblockable": {
        trigger: "whenAttacking",
        optional: true,
        requirements: { totalDonAtLeast: 1 },
        actions: [
            { action: "returnDon", player: "self", quantity: 1, source: "any" },
            { action: "grantKeyword", target: "source", keyword: "unblockable", duration: "turn" }
        ]
    },
    "JK02-019-when-attacking": {
        trigger: "whenAttacking",
        optional: true,
        requirements: { handAtLeast: 1 },
        actions: [
            {
                action: "trashCard",
                actingPlayer: "self",
                selection: { controller: "self", area: "hand", amount: 1 }
            },
            {
                action: "cardKO",
                selection: {
                    controller: "opponent",
                    area: "characterArea",
                    amount: 1,
                    filters: { maximumCost: 4 }
                },
                cause: "effect"
            }
        ]
    }
});
