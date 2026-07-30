export const continuousKeywordDefinitions = Object.freeze({
    "BK01-013-guts-double-attack": { keyword: "double attack", requirements: { leaderName: "Guts" }, complete: true },
    "YAM1-002-don-double-attack": { keyword: "double attack", requirements: { sourceAttachedDonAtLeast: 1 }, complete: true },
    "KIL1-012-blocker-grant": { keyword: "blocker", requirements: { leaderTypeIncludes: "Kid Pirates" }, complete: true },
    "BK01-016-guts-rush-leader-power": { keyword: "rush", requirements: { leaderName: "Guts" }, complete: false },
    "JK01-006-continuous": { keyword: "rush", requirements: { noStage: true }, complete: false },
    "KIL1-008-don-two": { keyword: "rush", requirements: { sourceAttachedDonAtLeast: 2 }, complete: false }
});
