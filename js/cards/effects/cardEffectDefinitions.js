import { onPlayEffectDefinitions } from "./onPlayEffects.js";

// Add one activator module at a time. This registry is the only aggregation
// point cardDatabase needs to know about.
export const cardEffectDefinitions = Object.freeze({
    ...onPlayEffectDefinitions
});
