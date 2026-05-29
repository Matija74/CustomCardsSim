// deck-editor.js

// =========================
// Deck Editor
// =========================

class DeckEditor {
    constructor() {
        this.selectedLeader = null;
        this.deckCards = [];

        this.maxDeckSize = 50;
        this.maxCopiesPerCard = 4;

        this.leaders = window.leaders || {};
        this.cardDatabase = window.cardDatabase || {};

        this.deckDisplay = document.getElementById("deckDisplay");
        this.cardLibraryGrid = document.getElementById("cardLibraryGrid");
        this.deckCardCount = document.getElementById("deckCardCount");
        this.deckNameInput = document.getElementById("deckName");

        this.cardSearch = document.getElementById("cardSearch");
        this.categoryFilter = document.getElementById("categoryFilter");
        this.typeFilter = document.getElementById("typeFilter");
        this.colorFilter = document.getElementById("colorFilter");
        this.costFilter = document.getElementById("costFilter");
        this.powerFilter = document.getElementById("powerFilter");
        this.attributeFilter = document.getElementById("attributeFilter");
        this.counterFilter = document.getElementById("counterFilter");
        this.leaderColorFilterToggle = document.getElementById("leaderColorFilterToggle");
        this.leaderTypeFilterToggle = document.getElementById("leaderTypeFilterToggle");

        this.saveDeckButton = document.getElementById("saveDeckButton");
        this.copyDeckCodeButton = document.getElementById("copyDeckCodeButton");
        this.clearDeckButton = document.getElementById("clearDeckButton");
        this.savedDeckSelect = document.getElementById("savedDeckSelect");
        this.loadSavedDeckButton = document.getElementById("loadSavedDeckButton");
        this.deleteSavedDeckButton = document.getElementById("deleteSavedDeckButton");
        this.importDeckText = document.getElementById("importDeckText");
        this.importDeckButton = document.getElementById("importDeckButton");

        this.cardPreviewModal = document.getElementById("cardPreviewModal");
        this.cardPreviewBackdrop = document.getElementById("cardPreviewBackdrop");
        this.cardPreviewClose = document.getElementById("cardPreviewClose");
        this.cardPreviewImage = document.getElementById("cardPreviewImage");
        this.cardPreviewName = document.getElementById("cardPreviewName");

        this.init();
    }

    // =========================
    // Initialization
    // =========================

    init() {
        this.populateFilterOptions();
        this.setupEvents();
        this.renderSavedDeckOptions();
        this.renderLeaderSelection();
        this.renderDeck();
    }

    setupEvents() {
        this.cardSearch.addEventListener("input", () => this.renderCardLibrary());
        this.categoryFilter.addEventListener("change", () => this.renderCardLibrary());
        this.typeFilter.addEventListener("change", () => this.renderCardLibrary());
        this.colorFilter.addEventListener("change", () => this.renderCardLibrary());
        this.costFilter.addEventListener("change", () => this.renderCardLibrary());
        this.powerFilter.addEventListener("change", () => this.renderCardLibrary());
        this.attributeFilter.addEventListener("change", () => this.renderCardLibrary());
        this.counterFilter.addEventListener("change", () => this.renderCardLibrary());
        this.leaderColorFilterToggle.addEventListener("change", () => this.renderCardLibrary());
        this.leaderTypeFilterToggle.addEventListener("change", () => this.renderCardLibrary());

        this.saveDeckButton?.addEventListener("click", () => this.saveCurrentDeck());
        this.copyDeckCodeButton?.addEventListener("click", () => this.copyDeckCode());
        this.clearDeckButton.addEventListener("click", () => this.clearDeck());
        this.loadSavedDeckButton?.addEventListener("click", () => this.loadSelectedSavedDeck());
        this.deleteSavedDeckButton?.addEventListener("click", () => this.deleteSelectedSavedDeck());
        this.importDeckButton?.addEventListener("click", () => this.importDeckFromText());

        this.cardPreviewBackdrop.addEventListener("click", () => this.closeCardPreview());
        this.cardPreviewClose.addEventListener("click", () => this.closeCardPreview());

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                this.closeCardPreview();
            }
        });
    }

    // =========================
    // Leader Selection
    // =========================

    renderLeaderSelection() {
        this.cardLibraryGrid.innerHTML = "";

        const filteredLeaders = this.getFilteredCards({
            leadersOnly: true
        });

        filteredLeaders.forEach(leader => {
            const leaderCard = this.createLibraryCard(leader, true);
            this.cardLibraryGrid.appendChild(leaderCard);
        });
    }

    chooseLeader(leader) {
        this.selectedLeader = leader;
        this.deckCards = [];

        this.renderDeck();
        this.renderCardLibrary();
    }

    removeLeader() {
        const confirmRemove = confirm(
            "Removing your Leader will also clear your deck. Continue?"
        );

        if (!confirmRemove) {
            return;
        }

        this.selectedLeader = null;
        this.deckCards = [];

        this.renderDeck();
        this.renderLeaderSelection();
    }

    // =========================
    // Card Library Rendering
    // =========================

    renderCardLibrary() {
        this.cardLibraryGrid.innerHTML = "";

        if (!this.selectedLeader) {
            this.renderLeaderSelection();
            return;
        }

        const filteredCards = this.getFilteredCards();

        if (filteredCards.length === 0) {
            const emptyMessage = document.createElement("div");
            emptyMessage.classList.add("library-message");
            emptyMessage.textContent = "No cards match the current filters.";
            this.cardLibraryGrid.appendChild(emptyMessage);
            return;
        }

        filteredCards.forEach(card => {
            const isLeaderCard = card.cardType === "leader";
            const cardElement = this.createLibraryCard(card, isLeaderCard);
            this.cardLibraryGrid.appendChild(cardElement);
        });
    }

    createLibraryCard(card, isLeaderCard) {
        const article = document.createElement("article");
        article.classList.add("library-card");

        const imageBox = document.createElement("div");
        imageBox.classList.add("library-card-image");

        if (card.image) {
            const image = document.createElement("img");
            image.src = card.image;
            image.alt = card.name;
            imageBox.appendChild(image);
        } else {
            const noImage = document.createElement("span");
            noImage.textContent = "No Image";
            imageBox.appendChild(noImage);
        }

        imageBox.addEventListener("click", () => this.openCardPreview(card));

        const info = document.createElement("div");
        info.classList.add("library-card-info");

        const title = document.createElement("h3");
        title.textContent = card.name;

        info.appendChild(title);

        const button = document.createElement("button");
        button.classList.add("add-card-button");

        if (isLeaderCard) {
            button.textContent = "Choose Leader";
            button.addEventListener("click", () => this.chooseLeader(card));
        } else {
            const currentAmount = this.getCardAmountInDeck(card.id);
            const isAtLimit = currentAmount >= this.maxCopiesPerCard;

            button.textContent = isAtLimit ? "Max" : "Add";
            button.disabled = isAtLimit;

            if (isAtLimit) {
                button.classList.add("disabled-button");
            }

            button.addEventListener("click", () => this.addCardToDeck(card));
        }

        article.appendChild(imageBox);
        article.appendChild(info);
        article.appendChild(button);

        return article;
    }

    // =========================
    // Filters
    // =========================

    populateFilterOptions() {
        const allCards = this.getAllCards();

        this.populateSelect(
            this.typeFilter,
            "All Types",
            this.getUniqueSortedTextValues(
                allCards.flatMap(card => this.getCardTypeValues(card))
            )
        );

        this.populateSelect(
            this.costFilter,
            "All Costs",
            this.getUniqueSortedNumberValues(
                allCards.map(card => card.cost)
            )
        );

        this.populateSelect(
            this.powerFilter,
            "All Power",
            this.getUniqueSortedNumberValues(
                allCards.map(card => card.power)
            )
        );

        this.populateSelect(
            this.attributeFilter,
            "All Attributes",
            this.getUniqueSortedTextValues(
                allCards.map(card => card.attribute)
            )
        );

        this.populateSelect(
            this.counterFilter,
            "All Counters",
            this.getUniqueSortedNumberValues(
                allCards.map(card => card.counter)
            )
        );
    }

    populateSelect(selectElement, allLabel, values) {
        if (!selectElement) {
            return;
        }

        selectElement.innerHTML = "";

        const allOption = document.createElement("option");
        allOption.value = "all";
        allOption.textContent = allLabel;
        selectElement.appendChild(allOption);

        values.forEach(value => {
            const option = document.createElement("option");
            option.value = String(value).toLowerCase();
            option.textContent = value;
            selectElement.appendChild(option);
        });
    }

    getUniqueSortedTextValues(values) {
        return [...new Set(
            values
                .filter(value => value !== undefined && value !== null)
                .map(value => String(value).trim())
                .filter(Boolean)
        )].sort((firstValue, secondValue) => {
            return firstValue.localeCompare(secondValue);
        });
    }

    getUniqueSortedNumberValues(values) {
        return [...new Set(
            values
                .filter(value => value !== undefined && value !== null && value !== "")
                .map(value => Number(value))
                .filter(value => Number.isFinite(value))
        )].sort((firstValue, secondValue) => firstValue - secondValue);
    }

    getAllCards() {
        return [
            ...Object.values(this.leaders),
            ...Object.values(this.cardDatabase)
        ];
    }

    getFilteredCards(options = {}) {
        const searchValue = this.cardSearch.value.toLowerCase().trim();
        const selectedCategory = this.categoryFilter.value;
        const selectedType = this.typeFilter.value;
        const selectedColor = this.colorFilter.value;
        const selectedCost = this.costFilter.value;
        const selectedPower = this.powerFilter.value;
        const selectedAttribute = this.attributeFilter.value;
        const selectedCounter = this.counterFilter.value;
        const matchLeaderColors = !options.leadersOnly &&
            Boolean(this.selectedLeader) &&
            Boolean(this.leaderColorFilterToggle?.checked);
        const matchLeaderTypes = !options.leadersOnly &&
            Boolean(this.selectedLeader) &&
            Boolean(this.leaderTypeFilterToggle?.checked);

        const cards = options.leadersOnly
            ? Object.values(this.leaders)
            : this.getAllCards();

        return cards.filter(card => {
            const cardName = card.name.toLowerCase();
            const excludesLeadersAfterSelection =
                !options.leadersOnly &&
                Boolean(this.selectedLeader) &&
                String(card.cardType || "").toLowerCase() === "leader";

            const cardColors = this.getCardColors(card);
            const cardTypes = this.getCardTypeValues(card)
                .map(type => type.toLowerCase());
            const leaderColors = matchLeaderColors
                ? this.getCardColors(this.selectedLeader)
                : [];
            const leaderTypes = matchLeaderTypes
                ? this.getCardTypeValues(this.selectedLeader).map(type => type.toLowerCase())
                : [];

            const matchesSearch =
                searchValue === "" || cardName.includes(searchValue);

            const matchesCategory =
                selectedCategory === "all" ||
                String(card.cardType || "").toLowerCase() === selectedCategory.toLowerCase();

            const matchesType =
                selectedType === "all" ||
                cardTypes.includes(selectedType.toLowerCase());

            const matchesColor =
                selectedColor === "all" ||
                cardColors.includes(selectedColor.toLowerCase());

            const matchesCost =
                selectedCost === "all" ||
                this.matchesNumberFilter(card.cost, selectedCost);

            const matchesPower =
                selectedPower === "all" ||
                this.matchesNumberFilter(card.power, selectedPower);

            const matchesAttribute =
                selectedAttribute === "all" ||
                String(card.attribute || "").toLowerCase() === selectedAttribute.toLowerCase();

            const matchesCounter =
                selectedCounter === "all" ||
                this.matchesNumberFilter(card.counter, selectedCounter);
            const matchesLeaderColors =
                !matchLeaderColors ||
                leaderColors.some(color => cardColors.includes(color));
            const matchesLeaderTypes =
                !matchLeaderTypes ||
                leaderTypes.some(type => cardTypes.includes(type));

            return !excludesLeadersAfterSelection &&
                matchesSearch &&
                matchesCategory &&
                matchesType &&
                matchesColor &&
                matchesCost &&
                matchesPower &&
                matchesAttribute &&
                matchesCounter &&
                matchesLeaderColors &&
                matchesLeaderTypes;
        }).sort((firstCard, secondCard) => {
            return this.compareCardsForLibrary(firstCard, secondCard);
        });
    }

    getCardColors(card) {
        const colors = Array.isArray(card.color)
            ? card.color
            : String(card.color || "").split("/");

        return colors
            .map(color => String(color).trim().toLowerCase())
            .filter(Boolean);
    }

    getCardTypeValues(card) {
        return String(card.type || "")
            .split("/")
            .map(type => type.trim())
            .filter(Boolean);
    }

    matchesNumberFilter(cardValue, selectedValue) {
        if (cardValue === undefined || cardValue === null || cardValue === "") {
            return false;
        }

        return Number(cardValue) === Number(selectedValue);
    }

    compareCardsForLibrary(firstCard, secondCard) {
        const colorDifference = this.compareColorGroups(firstCard, secondCard);

        if (colorDifference !== 0) {
            return colorDifference;
        }

        const categoryDifference =
            this.getCategorySortValue(firstCard) - this.getCategorySortValue(secondCard);

        if (categoryDifference !== 0) {
            return categoryDifference;
        }

        const costDifference = Number(firstCard.cost ?? -1) - Number(secondCard.cost ?? -1);

        if (costDifference !== 0) {
            return costDifference;
        }

        return String(firstCard.name || "").localeCompare(String(secondCard.name || ""));
    }

    compareColorGroups(firstCard, secondCard) {
        const firstColors = this.getCardColors(firstCard);
        const secondColors = this.getCardColors(secondCard);
        const colorOrder = ["red", "green", "blue", "purple", "black", "yellow"];
        const maxLength = Math.max(firstColors.length, secondColors.length);

        for (let index = 0; index < maxLength; index++) {
            const firstValue = colorOrder.indexOf(firstColors[index]);
            const secondValue = colorOrder.indexOf(secondColors[index]);
            const normalizedFirst = firstValue === -1 ? colorOrder.length : firstValue;
            const normalizedSecond = secondValue === -1 ? colorOrder.length : secondValue;

            if (normalizedFirst !== normalizedSecond) {
                return normalizedFirst - normalizedSecond;
            }
        }

        return firstColors.length - secondColors.length;
    }

    getCategorySortValue(card) {
        const categoryOrder = {
            leader: 0,
            character: 1,
            stage: 2,
            event: 3
        };

        return categoryOrder[String(card.cardType || "").toLowerCase()] ?? 99;
    }

    // =========================
    // Deck Actions
    // =========================

    addCardToDeck(card) {
        if (!this.selectedLeader) {
            alert("You must choose a Leader before adding cards.");
            return;
        }

        const existingCard = this.deckCards.find(deckCard => deckCard.id === card.id);

        if (existingCard) {
            if (existingCard.amount >= this.maxCopiesPerCard) {
                alert(`You can only have ${this.maxCopiesPerCard} copies of this card.`);
                return;
            }

            existingCard.amount++;
        } else {
            this.deckCards.push({
                ...card,
                amount: 1
            });
        }

        this.renderDeck();
        this.renderCardLibrary();
    }

    increaseCardAmount(cardId) {
        const existingCard = this.deckCards.find(deckCard => deckCard.id === cardId);

        if (!existingCard) {
            return;
        }

        if (existingCard.amount >= this.maxCopiesPerCard) {
            alert(`You can only have ${this.maxCopiesPerCard} copies of this card.`);
            return;
        }

        existingCard.amount++;
        this.renderDeck();
        this.renderCardLibrary();
    }

    removeCardFromDeck(cardId) {
        const existingCard = this.deckCards.find(deckCard => deckCard.id === cardId);

        if (!existingCard) {
            return;
        }

        existingCard.amount--;

        if (existingCard.amount <= 0) {
            this.deckCards = this.deckCards.filter(deckCard => deckCard.id !== cardId);
        }

        this.renderDeck();
        this.renderCardLibrary();
    }

    clearDeck() {
        if (!this.selectedLeader) {
            alert("Choose a Leader first.");
            return;
        }

        if (this.deckCards.length === 0) {
            alert("The deck is already empty.");
            return;
        }

        const confirmClear = confirm(
            "Clear all cards from this deck? Your Leader will stay selected."
        );

        if (!confirmClear) {
            return;
        }

        this.deckCards = [];

        this.renderDeck();
        this.renderCardLibrary();
    }

    getCurrentDeckEntries() {
        return this.deckCards.map(card => ({
            cardId: card.id,
            quantity: Number(card.amount || 0)
        }));
    }

    getCurrentDeckDefinition() {
        if (!this.selectedLeader) {
            return null;
        }

        return window.createDeckDefinition?.({
            id: `local-deck-${Date.now()}`,
            name: this.deckNameInput?.value?.trim() || `${this.selectedLeader.name} Deck`,
            leaderKey: this.selectedLeader.id,
            entries: this.getCurrentDeckEntries(),
            source: "local"
        }) || null;
    }

    renderSavedDeckOptions() {
        if (!this.savedDeckSelect) {
            return;
        }

        const savedDecks = window.getLocalSavedDecks?.() || [];

        this.savedDeckSelect.innerHTML = "";

        if (savedDecks.length === 0) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "No saved decks";
            this.savedDeckSelect.appendChild(option);
            this.loadSavedDeckButton.disabled = true;
            this.deleteSavedDeckButton.disabled = true;
            return;
        }

        savedDecks.forEach(deck => {
            const option = document.createElement("option");
            option.value = deck.id;
            option.textContent = deck.name;
            this.savedDeckSelect.appendChild(option);
        });

        this.loadSavedDeckButton.disabled = false;
        this.deleteSavedDeckButton.disabled = false;
    }

    loadDeckDefinition(deckDefinition) {
        if (!deckDefinition) {
            return;
        }

        const leader = this.leaders?.[deckDefinition.leaderKey];

        if (!leader) {
            alert(`Leader not found: ${deckDefinition.leaderKey}`);
            return;
        }

        const entries = Array.isArray(deckDefinition.cards)
            ? deckDefinition.cards
            : window.parseDeckEntriesFromText?.(deckDefinition.deckText || "").entries || [];
        const nextDeckCards = [];

        for (const entry of entries) {
            const card = this.cardDatabase?.[entry.cardId];

            if (!card) {
                continue;
            }

            nextDeckCards.push({
                ...card,
                amount: Number(entry.quantity || 0)
            });
        }

        this.selectedLeader = leader;
        this.deckCards = nextDeckCards;

        if (this.deckNameInput) {
            this.deckNameInput.value = deckDefinition.name || "";
        }

        this.renderDeck();
        this.renderCardLibrary();
    }

    saveCurrentDeck() {
        const deckDefinition = this.getCurrentDeckDefinition();

        if (!deckDefinition) {
            alert("Choose a Leader before saving.");
            return;
        }

        const savedDeck = window.saveLocalDeck?.(deckDefinition);

        this.renderSavedDeckOptions();

        if (savedDeck && this.savedDeckSelect) {
            this.savedDeckSelect.value = savedDeck.id;
        }

        alert(`Saved ${deckDefinition.name}.`);
    }

    async copyDeckCode() {
        const deckDefinition = this.getCurrentDeckDefinition();

        if (!deckDefinition) {
            alert("Choose a Leader before copying deck text.");
            return;
        }

        const deckText = window.buildDeckTextWithLeader?.(
            this.selectedLeader?.id,
            deckDefinition.cards || this.getCurrentDeckEntries()
        ) || deckDefinition.deckText;

        if (!deckText.trim()) {
            alert("Add cards to the deck before copying.");
            return;
        }

        try {
            await navigator.clipboard.writeText(deckText);
            alert("Deck text copied.");
        } catch (error) {
            alert("Could not copy deck text.");
        }
    }

    loadSelectedSavedDeck() {
        const savedDeck = window.getLocalSavedDeckById?.(this.savedDeckSelect?.value);

        if (!savedDeck) {
            alert("Choose a saved deck first.");
            return;
        }

        this.loadDeckDefinition(savedDeck);
    }

    deleteSelectedSavedDeck() {
        const deckId = this.savedDeckSelect?.value;

        if (!deckId) {
            return;
        }

        const savedDeck = window.getLocalSavedDeckById?.(deckId);

        if (!savedDeck) {
            return;
        }

        if (!confirm(`Delete ${savedDeck.name}?`)) {
            return;
        }

        window.deleteLocalSavedDeck?.(deckId);
        this.renderSavedDeckOptions();
    }

    importDeckFromText() {
        const parsedDeck = window.parseDeckListData?.(this.importDeckText?.value || "");

        if (!parsedDeck?.success) {
            alert(parsedDeck?.errors?.[0] || "Invalid deck text.");
            return;
        }

        const validation = window.validateDeckEntries?.(parsedDeck.entries);

        if (!validation?.success) {
            alert(validation.errors[0] || "Deck contains unknown cards.");
            return;
        }

        const leaderKey = parsedDeck.leaderKey || this.selectedLeader?.id || "";

        if (!leaderKey) {
            alert("Include a leader line in the deck text or choose a leader first.");
            return;
        }

        const leader = this.leaders?.[leaderKey];

        this.loadDeckDefinition({
            name: this.deckNameInput?.value?.trim() || `${leader?.name || "Imported"} Deck`,
            leaderKey,
            cards: parsedDeck.entries
        });
    }

    // =========================
    // Deck Rendering
    // =========================

    renderDeck() {
        this.deckDisplay.innerHTML = "";

        if (this.selectedLeader) {
            const leaderElement = this.createDeckLeaderElement(this.selectedLeader);
            this.deckDisplay.appendChild(leaderElement);
        }

        this.deckCards.forEach(card => {
            const cardElement = this.createDeckCardElement(card);
            this.deckDisplay.appendChild(cardElement);
        });

        this.updateDeckCount();
    }

    createDeckLeaderElement(leader) {
        const item = document.createElement("div");
        item.classList.add("deck-card-item", "deck-leader-item");

        const imageBox = document.createElement("div");
        imageBox.classList.add("deck-card-image");

        if (leader.image) {
            const image = document.createElement("img");
            image.src = leader.image;
            image.alt = leader.name;
            imageBox.appendChild(image);
        } else {
            const noImage = document.createElement("span");
            noImage.textContent = "No Image";
            imageBox.appendChild(noImage);
        }

        imageBox.addEventListener("click", () => this.openCardPreview(leader));

        const info = document.createElement("div");
        info.classList.add("deck-card-info");

        const title = document.createElement("h3");
        title.textContent = leader.name;

        info.appendChild(title);

        const removeButton = document.createElement("button");
        removeButton.classList.add("small-remove-button");
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", () => this.removeLeader());

        item.appendChild(imageBox);
        item.appendChild(info);
        item.appendChild(removeButton);

        return item;
    }

    createDeckCardElement(card) {
        const item = document.createElement("div");
        item.classList.add("deck-card-item");

        const imageBox = document.createElement("div");
        imageBox.classList.add("deck-card-image");

        if (card.image) {
            const image = document.createElement("img");
            image.src = card.image;
            image.alt = card.name;
            imageBox.appendChild(image);
        } else {
            const noImage = document.createElement("span");
            noImage.textContent = "No Image";
            imageBox.appendChild(noImage);
        }

        imageBox.addEventListener("click", () => this.openCardPreview(card));

        const info = document.createElement("div");
        info.classList.add("deck-card-info");

        const title = document.createElement("h3");
        title.textContent = card.name;

        info.appendChild(title);

        const controls = document.createElement("div");
        controls.classList.add("deck-card-controls");

        const decreaseButton = document.createElement("button");
        decreaseButton.classList.add("quantity-button");
        decreaseButton.textContent = "-";
        decreaseButton.addEventListener("click", () => this.removeCardFromDeck(card.id));

        const amount = document.createElement("div");
        amount.classList.add("deck-card-amount");
        amount.textContent = `x${card.amount}`;

        const increaseButton = document.createElement("button");
        increaseButton.classList.add("quantity-button");
        increaseButton.textContent = "+";

        const isAtLimit = card.amount >= this.maxCopiesPerCard;

        increaseButton.disabled = isAtLimit;

        if (isAtLimit) {
            increaseButton.classList.add("disabled-button");
        }

        increaseButton.addEventListener("click", () => this.increaseCardAmount(card.id));

        controls.appendChild(decreaseButton);
        controls.appendChild(amount);
        controls.appendChild(increaseButton);

        item.appendChild(imageBox);
        item.appendChild(info);
        item.appendChild(controls);

        return item;
    }

    // =========================
    // Deck Count
    // =========================

    getDeckCardTotal() {
        return this.deckCards.reduce((total, card) => {
            return total + card.amount;
        }, 0);
    }

    updateDeckCount() {
        this.deckCardCount.textContent = this.getDeckCardTotal();
    }

    getCardAmountInDeck(cardId) {
        const existingCard = this.deckCards.find(deckCard => deckCard.id === cardId);

        return existingCard ? existingCard.amount : 0;
    }

    // =========================
    // Card Preview Modal
    // =========================

    openCardPreview(card) {
        if (!card.image) {
            return;
        }

        this.cardPreviewImage.src = card.image;
        this.cardPreviewImage.alt = card.name;

        this.cardPreviewName.textContent = card.name;

        this.cardPreviewModal.classList.add("open");
    }

    closeCardPreview() {
        this.cardPreviewModal.classList.remove("open");

        this.cardPreviewImage.src = "";
        this.cardPreviewImage.alt = "Card Preview";
    }

    // =========================
    // Card Helpers
    // =========================

    getCardDetails(card) {
        const colorText = Array.isArray(card.color)
            ? card.color.join("/")
            : card.color || "No Color";

        if (card.type.toLowerCase() === "leader") {
            return `${card.type} • ${colorText} • ${card.life ?? "?"} Life`;
        }

        return `${card.type} • ${colorText} • Cost ${card.cost ?? "?"}`;
    }
}

// =========================
// Page Load
// =========================

document.addEventListener("DOMContentLoaded", async () => {
    try {
        if (window.loadCardDatabase) {
            await window.loadCardDatabase();
        }

        new DeckEditor();
    } catch (error) {
        console.error("Failed to initialize deck editor:", error);

        const cardLibraryGrid = document.getElementById("cardLibraryGrid");

        if (cardLibraryGrid) {
            cardLibraryGrid.innerHTML = "";

            const message = document.createElement("div");
            message.classList.add("library-message");
            message.textContent = "Unable to load card data.";

            cardLibraryGrid.appendChild(message);
        }
    }
});
