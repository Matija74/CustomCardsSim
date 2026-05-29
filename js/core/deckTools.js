// deckTools.js

const savedDeckStorageKey = "customCardsSavedDecks";
const deckSelectionStorageKey = "customCardsDeckSelection";

function getDefaultPresetDeck() {
    return window.getAvailableDecks?.()[0] || null;
}

function normalizeDeckEntries(entries = []) {
    return entries
        .map(entry => ({
            cardId: String(entry.cardId || entry.id || "").trim(),
            quantity: Number(entry.quantity ?? entry.amount ?? 0)
        }))
        .filter(entry => entry.cardId && Number.isFinite(entry.quantity) && entry.quantity > 0);
}

function buildDeckTextFromEntries(entries = []) {
    const lines = normalizeDeckEntries(entries)
        .map(entry => `${entry.quantity}x${entry.cardId}`);

    return lines.length > 0
        ? `${lines.join("\n")}\n`
        : "";
}

function buildDeckTextWithLeader(leaderKey, entries = []) {
    const leaderLine = String(leaderKey || "").trim()
        ? `1x${String(leaderKey).trim()}`
        : "";
    const deckText = buildDeckTextFromEntries(entries).trimEnd();

    if (leaderLine && deckText) {
        return `${leaderLine}\n${deckText}\n`;
    }

    if (leaderLine) {
        return `${leaderLine}\n`;
    }

    return deckText ? `${deckText}\n` : "";
}

function parseDeckEntriesFromText(deckText) {
    const entries = [];
    const errors = [];
    const lines = String(deckText || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    lines.forEach((line, index) => {
        const match = line.match(/^(\d+)x([A-Za-z0-9-]+)$/);

        if (!match) {
            errors.push(`Line ${index + 1} is invalid: ${line}`);
            return;
        }

        entries.push({
            cardId: match[2].trim(),
            quantity: Number(match[1])
        });
    });

    return {
        success: errors.length === 0,
        entries,
        errors
    };
}

function isLeaderCardId(cardId) {
    const normalizedCardId = String(cardId || "").trim();

    if (!normalizedCardId) {
        return false;
    }

    if (window.leaders?.[normalizedCardId]) {
        return true;
    }

    return String(window.cardDatabase?.[normalizedCardId]?.cardType || "").toLowerCase() === "leader";
}

function parseDeckListData(deckText) {
    const parsedDeck = parseDeckEntriesFromText(deckText);

    if (!parsedDeck.success) {
        return {
            success: false,
            leaderKey: "",
            entries: [],
            errors: parsedDeck.errors || []
        };
    }

    const entries = [];
    const errors = [];
    let leaderKey = "";

    parsedDeck.entries.forEach(entry => {
        if (!isLeaderCardId(entry.cardId)) {
            entries.push(entry);
            return;
        }

        if (entry.quantity !== 1) {
            errors.push(`Leader line must use 1x${entry.cardId}.`);
            return;
        }

        if (leaderKey && leaderKey !== entry.cardId) {
            errors.push("Deck text can only include one leader line.");
            return;
        }

        leaderKey = entry.cardId;
    });

    return {
        success: errors.length === 0,
        leaderKey,
        entries,
        errors
    };
}

function validateDeckEntries(entries = []) {
    const errors = [];

    normalizeDeckEntries(entries).forEach(entry => {
        if (!window.cardDatabase?.[entry.cardId]) {
            errors.push(`Unknown card id: ${entry.cardId}`);
        }
    });

    return {
        success: errors.length === 0,
        errors
    };
}

function createDeckDefinition({
    id = `custom-deck-${Date.now()}`,
    name = "Custom Deck",
    leaderKey,
    entries = [],
    source = "local",
    updatedAt = Date.now()
}) {
    const normalizedEntries = normalizeDeckEntries(entries);

    return {
        id,
        name: String(name || "Custom Deck").trim() || "Custom Deck",
        leaderKey: String(leaderKey || "").trim(),
        deckText: buildDeckTextFromEntries(normalizedEntries),
        cards: normalizedEntries,
        source,
        updatedAt
    };
}

function cloneDeckDefinition(deck) {
    if (!deck) {
        return null;
    }

    return createDeckDefinition({
        id: deck.id,
        name: deck.name,
        leaderKey: deck.leaderKey,
        entries: deck.cards || parseDeckEntriesFromText(deck.deckText).entries,
        source: deck.source || "local",
        updatedAt: deck.updatedAt || Date.now()
    });
}

function getLocalSavedDecks() {
    try {
        const savedDecks = JSON.parse(localStorage.getItem(savedDeckStorageKey) || "[]");

        return Array.isArray(savedDecks)
            ? savedDecks.map(cloneDeckDefinition).filter(Boolean)
            : [];
    } catch (error) {
        return [];
    }
}

function getLocalSavedDeckById(deckId) {
    return getLocalSavedDecks().find(deck => deck.id === deckId) || null;
}

function saveLocalDeck(deck) {
    const savedDecks = getLocalSavedDecks().filter(entry => entry.id !== deck.id);
    const normalizedDeck = cloneDeckDefinition(deck);

    savedDecks.unshift(normalizedDeck);
    localStorage.setItem(savedDeckStorageKey, JSON.stringify(savedDecks));

    return normalizedDeck;
}

function deleteLocalSavedDeck(deckId) {
    const savedDecks = getLocalSavedDecks().filter(deck => deck.id !== deckId);
    localStorage.setItem(savedDeckStorageKey, JSON.stringify(savedDecks));
}

function getStoredDeckSelection() {
    try {
        return JSON.parse(localStorage.getItem(deckSelectionStorageKey) || "{}") || {};
    } catch (error) {
        return {};
    }
}

function saveStoredDeckSelection(selection) {
    localStorage.setItem(deckSelectionStorageKey, JSON.stringify(selection));
}

function createPresetSelection(deckId) {
    const presetDeck = window.getDeckById?.(deckId) || getDefaultPresetDeck();

    return presetDeck
        ? {
            source: "preset",
            deckData: {
                ...presetDeck
            }
        }
        : null;
}

function resolveDeckSelection(selection, fallbackDeckId = "") {
    if (selection?.deckData?.leaderKey && selection?.deckData?.deckText !== undefined) {
        return cloneDeckDefinition(selection.deckData) || {
            ...selection.deckData
        };
    }

    if (selection?.source === "preset" && selection?.deckId) {
        const presetDeck = window.getDeckById?.(selection.deckId);

        if (presetDeck) {
            return {
                ...presetDeck
            };
        }
    }

    const presetDeck = window.getDeckById?.(fallbackDeckId) || getDefaultPresetDeck();

    return presetDeck
        ? {
            ...presetDeck
        }
        : null;
}

function getDeckSummaryText(selection, fallbackLabel = "Choose Deck") {
    const deck = resolveDeckSelection(selection);

    return deck?.name || fallbackLabel;
}

function createPasteDeckSelection({ deckName, leaderKey, deckText }) {
    const parsedDeck = parseDeckListData(deckText);

    if (!parsedDeck.success) {
        throw new Error(parsedDeck.errors[0] || "Invalid deck text.");
    }

    if (parsedDeck.entries.length === 0) {
        throw new Error("Paste at least one deck line.");
    }

    const validation = validateDeckEntries(parsedDeck.entries);

    if (!validation.success) {
        throw new Error(validation.errors[0] || "Deck contains unknown cards.");
    }

    const resolvedLeaderKey = parsedDeck.leaderKey || String(leaderKey || "").trim();

    if (!window.leaders?.[resolvedLeaderKey]) {
        throw new Error("Choose a valid leader.");
    }

    return {
        source: "paste",
        deckData: createDeckDefinition({
            id: `pasted-deck-${Date.now()}`,
            name: deckName,
            leaderKey: resolvedLeaderKey,
            entries: parsedDeck.entries,
            source: "paste"
        })
    };
}

function openDeckPickerPopup({
    title = "Choose Deck",
    initialSelection = null,
    onConfirm
}) {
    const existingOverlay = document.getElementById("deckPickerOverlay");

    if (existingOverlay) {
        existingOverlay.remove();
    }

    const localDecks = getLocalSavedDecks();
    const presetDecks = window.getAvailableDecks?.() || [];
    const resolvedSelection = resolveDeckSelection(initialSelection) || getDefaultPresetDeck();
    const defaultLeaderKey = resolvedSelection?.leaderKey || Object.keys(window.leaders || {})[0] || "";

    const overlay = document.createElement("div");
    overlay.className = "deck-picker-overlay";
    overlay.id = "deckPickerOverlay";

    const modal = document.createElement("div");
    modal.className = "deck-picker-modal";

    const heading = document.createElement("h2");
    heading.textContent = title;

    const tabs = document.createElement("div");
    tabs.className = "deck-picker-tabs";

    const content = document.createElement("div");
    content.className = "deck-picker-content";

    const footer = document.createElement("div");
    footer.className = "deck-picker-footer";

    const cancelButton = document.createElement("button");
    cancelButton.className = "btn btn-secondary";
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";

    const useButton = document.createElement("button");
    useButton.className = "btn btn-primary";
    useButton.type = "button";
    useButton.textContent = "Use Deck";

    const tabConfig = [
        { key: "paste", label: "Paste Deck" },
        { key: "preset", label: "Select Preset Deck" },
        { key: "local", label: "Select Locally Saved Deck" }
    ];

    const pasteNameInput = document.createElement("input");
    pasteNameInput.type = "text";
    pasteNameInput.value = resolvedSelection?.name || "";
    pasteNameInput.placeholder = "Deck name";
    pasteNameInput.className = "deck-picker-input";

    const pasteLeaderSelect = document.createElement("select");
    pasteLeaderSelect.className = "deck-picker-select";
    Object.values(window.leaders || {}).forEach(leader => {
        const option = document.createElement("option");
        option.value = leader.id;
        option.textContent = `${leader.name} (${leader.id})`;
        option.selected = leader.id === defaultLeaderKey;
        pasteLeaderSelect.appendChild(option);
    });

    const pasteTextarea = document.createElement("textarea");
    pasteTextarea.className = "deck-picker-textarea";
    pasteTextarea.placeholder = "1xDD01-001\n2xDD01-002\n4xDD01-003";
    pasteTextarea.value = resolvedSelection?.deckText || "";

    const presetSelect = document.createElement("select");
    presetSelect.className = "deck-picker-select";
    presetDecks.forEach(deck => {
        const option = document.createElement("option");
        option.value = deck.id;
        option.textContent = deck.name;
        option.selected = deck.id === resolvedSelection?.id;
        presetSelect.appendChild(option);
    });

    const localSelect = document.createElement("select");
    localSelect.className = "deck-picker-select";
    localDecks.forEach(deck => {
        const option = document.createElement("option");
        option.value = deck.id;
        option.textContent = deck.name;
        localSelect.appendChild(option);
    });

    const localEmpty = document.createElement("p");
    localEmpty.className = "deck-picker-help";
    localEmpty.textContent = localDecks.length > 0
        ? "Choose one of your locally saved decks."
        : "No locally saved decks found.";

    const panels = {
        paste: document.createElement("div"),
        preset: document.createElement("div"),
        local: document.createElement("div")
    };

    Object.values(panels).forEach(panel => {
        panel.className = "deck-picker-panel";
    });

    panels.paste.appendChild(createDeckPickerField("Deck Name", pasteNameInput));
    panels.paste.appendChild(createDeckPickerField("Leader", pasteLeaderSelect));
    panels.paste.appendChild(createDeckPickerField("Deck Text", pasteTextarea));

    panels.preset.appendChild(createDeckPickerField("Preset Deck", presetSelect));
    panels.preset.appendChild(createDeckPickerHelp("Uses the current preset deck system."));

    panels.local.appendChild(createDeckPickerField("Saved Deck", localSelect));
    panels.local.appendChild(localEmpty);

    let activeTab = "preset";

    if (initialSelection?.source === "paste") {
        activeTab = "paste";
    } else if (initialSelection?.source === "local") {
        activeTab = "local";
        if (resolvedSelection?.id) {
            localSelect.value = resolvedSelection.id;
        }
    }

    tabConfig.forEach(tab => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "deck-picker-tab";
        button.textContent = tab.label;
        button.addEventListener("click", () => {
            activeTab = tab.key;
            renderActiveTab();
        });
        tabs.appendChild(button);
    });

    cancelButton.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", event => {
        if (event.target === overlay) {
            overlay.remove();
        }
    });

    useButton.addEventListener("click", () => {
        try {
            let selection = null;

            if (activeTab === "paste") {
                selection = createPasteDeckSelection({
                    deckName: pasteNameInput.value.trim() || "Pasted Deck",
                    leaderKey: pasteLeaderSelect.value,
                    deckText: pasteTextarea.value
                });
            } else if (activeTab === "local") {
                const localDeck = getLocalSavedDeckById(localSelect.value);

                if (!localDeck) {
                    throw new Error("Choose a locally saved deck.");
                }

                selection = {
                    source: "local",
                    deckData: localDeck
                };
            } else {
                const presetDeck = window.getDeckById?.(presetSelect.value);

                if (!presetDeck) {
                    throw new Error("Choose a preset deck.");
                }

                selection = {
                    source: "preset",
                    deckData: {
                        ...presetDeck
                    }
                };
            }

            if (typeof onConfirm === "function") {
                onConfirm(selection);
            }

            overlay.remove();
        } catch (error) {
            window.alert(error.message || String(error));
        }
    });

    footer.appendChild(cancelButton);
    footer.appendChild(useButton);

    modal.appendChild(heading);
    modal.appendChild(tabs);
    modal.appendChild(content);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    function renderActiveTab() {
        [...tabs.children].forEach((button, index) => {
            button.classList.toggle("active", tabConfig[index].key === activeTab);
        });

        content.innerHTML = "";
        content.appendChild(panels[activeTab]);
        useButton.disabled = activeTab === "local" && localDecks.length === 0;
    }

    renderActiveTab();
}

function createDeckPickerField(labelText, inputElement) {
    const field = document.createElement("label");
    field.className = "deck-picker-popup-field";

    const label = document.createElement("span");
    label.textContent = labelText;

    field.appendChild(label);
    field.appendChild(inputElement);

    return field;
}

function createDeckPickerHelp(text) {
    const paragraph = document.createElement("p");
    paragraph.className = "deck-picker-help";
    paragraph.textContent = text;
    return paragraph;
}

window.savedDeckStorageKey = savedDeckStorageKey;
window.deckSelectionStorageKey = deckSelectionStorageKey;
window.buildDeckTextFromEntries = buildDeckTextFromEntries;
window.buildDeckTextWithLeader = buildDeckTextWithLeader;
window.parseDeckEntriesFromText = parseDeckEntriesFromText;
window.parseDeckListData = parseDeckListData;
window.validateDeckEntries = validateDeckEntries;
window.createDeckDefinition = createDeckDefinition;
window.cloneDeckDefinition = cloneDeckDefinition;
window.getLocalSavedDecks = getLocalSavedDecks;
window.getLocalSavedDeckById = getLocalSavedDeckById;
window.saveLocalDeck = saveLocalDeck;
window.deleteLocalSavedDeck = deleteLocalSavedDeck;
window.getStoredDeckSelection = getStoredDeckSelection;
window.saveStoredDeckSelection = saveStoredDeckSelection;
window.createPresetSelection = createPresetSelection;
window.resolveDeckSelection = resolveDeckSelection;
window.getDeckSummaryText = getDeckSummaryText;
window.openDeckPickerPopup = openDeckPickerPopup;
