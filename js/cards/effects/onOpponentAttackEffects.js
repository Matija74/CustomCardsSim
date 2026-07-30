// Card-specific On Opponent Attack resolutions. Attack declaration and effect
// window ordering remain in the battle system.
export const onOpponentAttackEffectDefinitions = Object.freeze({
    "BK01-003-on-opponent-attack-draw": {
        trigger: "onOpponentAttack",
        optional: true,
        actions: [
            { action: "trashCard", target: "source" },
            { action: "drawCard", player: "self", quantity: 1 }
        ]
    }
});
