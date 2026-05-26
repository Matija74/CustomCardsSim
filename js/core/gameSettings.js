// gameSettings.js

const defaultGameSettings = {
    autoDraw: false,
    autoSkipBlock: false,
    autoSkipTrigger: false,
    autoSelectMaxValue: false,
    confirmEndTurn: true,
    confirmCounter: true,
    confirmTrigger: true,
    soundEffects: true,
    audioEnabled: true
};

function loadGameSettings() {
    try {
        const savedSettings = JSON.parse(localStorage.getItem("gameSettings") || "{}");

        return {
            ...defaultGameSettings,
            ...savedSettings
        };
    } catch (error) {
        return { ...defaultGameSettings };
    }
}

function getGameSetting(key) {
    const settings = loadGameSettings();

    return Object.prototype.hasOwnProperty.call(settings, key)
        ? settings[key]
        : null;
}

function isGameSettingEnabled(key) {
    return Boolean(getGameSetting(key));
}

function getOptionAutoSelectScore(option) {
    if (!option || option.disabled) {
        return null;
    }

    if (typeof option.autoSelectValue === "number" && Number.isFinite(option.autoSelectValue)) {
        return option.autoSelectValue;
    }

    if (typeof option.value === "number" && Number.isFinite(option.value)) {
        return option.value;
    }

    const labelNumbers = String(option.label || "")
        .match(/-?\d+(?:\.\d+)?/g)
        ?.map(Number)
        .filter(Number.isFinite);

    if (!labelNumbers || labelNumbers.length === 0) {
        return null;
    }

    return Math.max(...labelNumbers);
}

function getAutoSelectMaxValueOption(options = []) {
    if (!isGameSettingEnabled("autoSelectMaxValue")) {
        return null;
    }

    let bestOption = null;
    let bestScore = null;

    options.forEach(option => {
        const score = getOptionAutoSelectScore(option);

        if (score === null) {
            return;
        }

        if (bestOption === null || score > bestScore) {
            bestOption = option;
            bestScore = score;
        }
    });

    return bestOption;
}

window.loadGameSettings = loadGameSettings;
window.getGameSetting = getGameSetting;
window.isGameSettingEnabled = isGameSettingEnabled;
window.getAutoSelectMaxValueOption = getAutoSelectMaxValueOption;
