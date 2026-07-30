// Card-specific resolutions for cards placed in the Trash from the deck.
// Deck transition detection stays in the effect resolver.
export const whenTrashedFromDeckEffectDefinitions = Object.freeze({
    "KIL1-002-when-trashed-from-deck": {
        trigger: "whenTrashedFromDeck",
        optional: true,
        actions: [{ action: "playCard", target: "source", destination: "characterArea", cause: "effect" }]
    }
});
