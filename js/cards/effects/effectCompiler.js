const legacyTriggerNames = {
    onPlay: "onPlay",
    onKO: "onKO",
    whenAttacking: "whenAttacking",
    activateMain: "activateMain",
    main: "activateMain",
    counter: "counter",
    trigger: "trigger",
    startOfTurn: "startOfTurn",
    endOfTurn: "endOfTurn"
};

function legacyActions(actionId) {
    const search = (quantity, typeIncludes, excludeName) => [
        {
            action: "search",
            player: "self",
            deckLocation: "top",
            quantity,
            amountTaken: 1,
            targetArea: "hand",
            upTo: true,
            filters: { typeIncludes, ...(excludeName ? { excludeName } : {}) }
        },
        { action: "returnRest", deckLocation: "bottom" }
    ];

    if (actionId === "drawOneCard") return [{ action: "drawCard", player: "self", quantity: 1 }];
    if (actionId === "lookTopFiveDandadan") return search(5, "Dandadan");
    if (actionId === "lookTopFiveHuman") return search(5, "Human");
    if (actionId === "lookTopFiveBlackSwordsmanPartyOtherThanSelf") return search(5, "Black Swordsman Party", "Isma");
    return null;
}

export function compileCardEffects(card, effectDefinitions = {}) {
    if (!Array.isArray(card?.effects)) return card;

    const effects = card.effects.map(effect => {
        const implementation = effectDefinitions[effect?.id];
        if (implementation) return { ...effect, ...structuredClone(implementation) };
        if (effect?.trigger && Array.isArray(effect.actions)) return effect;
        const trigger = legacyTriggerNames[effect?.type];
        const actions = legacyActions(effect?.actionId);
        return trigger && actions ? { ...effect, trigger, actions } : effect;
    });

    const compiled = effects.map(effect => {
        const copiedTrigger = effect?.actionId === "activateMainEffect"
            ? "activateMain"
            : effect?.actionId === "activateOnPlayEffect" ? "onPlay" : null;
        if (!copiedTrigger || (effect.trigger && Array.isArray(effect.actions))) return effect;
        const sourceEffect = effects.find(candidate => candidate.trigger === copiedTrigger && Array.isArray(candidate.actions));
        return sourceEffect ? { ...effect, trigger: legacyTriggerNames[effect.type], actions: structuredClone(sourceEffect.actions) } : effect;
    });

    return { ...card, effects: compiled };
}

export function compileCardCollection(cards, effectDefinitions) {
    return Object.fromEntries(Object.entries(cards).map(([cardId, card]) => [cardId, compileCardEffects(card, effectDefinitions)]));
}
