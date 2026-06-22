// gameAudio.js

const gameSoundEffectRegistry = {
    cardDraw: "../sfx/cardDraw.mp3"
};

const gameSoundEffectTemplates = new Map();

function areSoundEffectsEnabled() {
    if (typeof window.loadGameSettings === "function") {
        const settings = window.loadGameSettings();

        return Boolean(settings.audioEnabled && settings.soundEffects);
    }

    return true;
}

function registerGameSoundEffect(key, path) {
    if (!key || !path) {
        return;
    }

    gameSoundEffectRegistry[key] = path;
    gameSoundEffectTemplates.delete(key);
}

function getGameSoundEffectTemplate(key) {
    if (typeof Audio !== "function") {
        return null;
    }

    const existingTemplate = gameSoundEffectTemplates.get(key);

    if (existingTemplate) {
        return existingTemplate;
    }

    const soundPath = gameSoundEffectRegistry[key];

    if (!soundPath) {
        return null;
    }

    const template = new Audio(soundPath);
    template.preload = "auto";
    gameSoundEffectTemplates.set(key, template);

    return template;
}

function playGameSoundEffect(key) {
    if (!areSoundEffectsEnabled()) {
        return;
    }

    const audioTemplate = getGameSoundEffectTemplate(key);

    if (!audioTemplate) {
        return;
    }

    const playbackAudio = audioTemplate.cloneNode();
    const playPromise = playbackAudio.play();

    if (playPromise?.catch) {
        playPromise.catch(() => {});
    }
}

window.areSoundEffectsEnabled = areSoundEffectsEnabled;
window.registerGameSoundEffect = registerGameSoundEffect;
window.playGameSoundEffect = playGameSoundEffect;
