import { activateMainEffectDefinitions } from "./activateMainEffects.js";
import { counterEffectDefinitions } from "./counterEffects.js";
import { onBlockEffectDefinitions } from "./onBlockEffects.js";
import { onKOEffectDefinitions } from "./onKOEffects.js";
import { onOpponentAttackEffectDefinitions } from "./onOpponentAttackEffects.js";
import { onPlayEffectDefinitions } from "./onPlayEffects.js";
import { turnEffectDefinitions } from "./turnEffects.js";
import { triggerEffectDefinitions } from "./triggerEffects.js";
import { whenAttackingEffectDefinitions } from "./whenAttackingEffects.js";
import { whenTrashedFromDeckEffectDefinitions } from "./whenTrashedFromDeckEffects.js";

// Add one activator module at a time. This registry is the only aggregation
// point cardDatabase needs to know about.
export const cardEffectDefinitions = Object.freeze({
    ...activateMainEffectDefinitions,
    ...counterEffectDefinitions,
    ...onBlockEffectDefinitions,
    ...onKOEffectDefinitions,
    ...onOpponentAttackEffectDefinitions,
    ...onPlayEffectDefinitions,
    ...turnEffectDefinitions,
    ...triggerEffectDefinitions,
    ...whenAttackingEffectDefinitions,
    ...whenTrashedFromDeckEffectDefinitions
});
