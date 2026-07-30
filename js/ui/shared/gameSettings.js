export const DEFAULT_GAME_SETTINGS = Object.freeze({
    autoDraw: false,
    autoSkipBlock: false,
    autoSkipTrigger: false,
    autoSelectMaxValue: false,
    confirmEndTurn: true,
    confirmCounter: true,
    confirmTrigger: true,
    soundEffects: true,
    audioEnabled: true
});

const STORAGE_KEY = "gameSettings";

export function normalizeGameSettings(settings = {}) {
    return Object.fromEntries(Object.entries(DEFAULT_GAME_SETTINGS).map(([key, fallback]) => [
        key,
        typeof settings?.[key] === "boolean" ? settings[key] : fallback
    ]));
}

export function loadGameSettings(storage = globalThis.localStorage) {
    try {
        const saved = storage?.getItem?.(STORAGE_KEY);
        return normalizeGameSettings(saved ? JSON.parse(saved) : {});
    } catch (error) {
        console.warn("Saved game settings could not be loaded. Defaults will be used.", error);
        return normalizeGameSettings();
    }
}

export function saveGameSettings(settings, storage = globalThis.localStorage) {
    const normalized = normalizeGameSettings(settings);
    storage?.setItem?.(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
}
