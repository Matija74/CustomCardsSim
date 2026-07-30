// Card-specific phase activators composed from staple actions. Phase timing
// remains in turnSystem; this module only describes resolutions.
export const turnEffectDefinitions = Object.freeze({
    "IMU1-006-end-of-turn": {
        trigger: "endOfTurn",
        actions: [{ action: "returnCardToDeck", target: "source", position: "bottom" }]
    },
    "JK02-017-end-of-turn": {
        trigger: "endOfTurn",
        requirements: { restedCharactersAtLeast: 1, excludeSource: true },
        actions: [{ action: "restandCard", target: "source" }]
    },
    "POG1-012-end-of-your-turn": {
        trigger: "endOfTurn",
        actions: [{ action: "restandCard", target: "source" }]
    }
});
