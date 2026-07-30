import { cardActionHandlers } from "../actions/cardActions.js";
import { donStateActionHandlers } from "../actions/donStateActions.js";
import { lifeModifierActionHandlers } from "../actions/lifeModifierActions.js";
import { keywordActionHandlers } from "../actions/keywordActions.js";
import { searchActionHandlers } from "../actions/searchActions.js";

const handlers = new Map(Object.entries({
    ...cardActionHandlers,
    ...donStateActionHandlers,
    ...lifeModifierActionHandlers,
    ...keywordActionHandlers,
    ...searchActionHandlers
}));

export function registerAction(name, handler) {
    if (!name || typeof handler !== "function") throw new Error("A registered action requires a name and handler.");
    handlers.set(name, handler);
}

export function getActionHandler(name) {
    return handlers.get(name) || null;
}

export function getRegisteredActions() {
    return [...handlers.keys()].sort();
}
