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

        this.cardSearch = document.getElementById("cardSearch");
        this.typeFilter = document.getElementById("typeFilter");
        this.colorFilter = document.getElementById("colorFilter");
        this.costFilter = document.getElementById("costFilter");

        this.clearDeckButton = document.getElementById("clearDeckButton");

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
        this.setupEvents();
        this.renderLeaderSelection();
        this.renderDeck();
    }

    setupEvents() {
        this.cardSearch.addEventListener("input", () => this.renderCardLibrary());
        this.typeFilter.addEventListener("change", () => this.renderCardLibrary());
        this.colorFilter.addEventListener("change", () => this.renderCardLibrary());
        this.costFilter.addEventListener("change", () => this.renderCardLibrary());

        this.clearDeckButton.addEventListener("click", () => this.clearDeck());

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

        const message = document.createElement("div");
        message.classList.add("library-message");
        message.textContent = "Choose a Leader before adding cards to your deck.";
        this.cardLibraryGrid.appendChild(message);

        Object.values(this.leaders).forEach(leader => {
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
            const cardElement = this.createLibraryCard(card, false);
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

    getFilteredCards() {
        const searchValue = this.cardSearch.value.toLowerCase().trim();
        const selectedType = this.typeFilter.value;
        const selectedColor = this.colorFilter.value;
        const selectedCost = this.costFilter.value;

        return Object.values(this.cardDatabase).filter(card => {
            const cardName = card.name.toLowerCase();

            const cardColors = Array.isArray(card.color)
                ? card.color.map(color => color.toLowerCase())
                : [String(card.color || "").toLowerCase()];

            const matchesSearch =
                searchValue === "" || cardName.includes(searchValue);

            const matchesType =
                selectedType === "all" ||
                String(card.cardType || "").toLowerCase() === selectedType.toLowerCase();

            const matchesColor =
                selectedColor === "all" ||
                cardColors.includes(selectedColor.toLowerCase());

            const matchesCost =
                selectedCost === "all" ||
                this.matchesCostFilter(card.cost, selectedCost);

            return matchesSearch && matchesType && matchesColor && matchesCost;
        });
    }

    matchesCostFilter(cardCost, selectedCost) {
        const cost = Number(cardCost);

        if (selectedCost === "5") {
            return cost >= 5;
        }

        return cost === Number(selectedCost);
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

    // =========================
    // Deck Rendering
    // =========================

    renderDeck() {
        this.deckDisplay.innerHTML = "";

        if (this.selectedLeader) {
            const leaderElement = this.createDeckLeaderElement(this.selectedLeader);
            this.deckDisplay.appendChild(leaderElement);
        } else {
            const noLeaderMessage = document.createElement("div");
            noLeaderMessage.classList.add("empty-deck-message");
            noLeaderMessage.textContent = "Choose a Leader first.";
            this.deckDisplay.appendChild(noLeaderMessage);
        }

        if (this.deckCards.length === 0) {
            const emptyDeckMessage = document.createElement("div");
            emptyDeckMessage.classList.add("empty-deck-message");

            emptyDeckMessage.textContent = this.selectedLeader
                ? "Add cards from the card library to build your deck."
                : "After choosing a Leader, your available cards will appear here.";

            this.deckDisplay.appendChild(emptyDeckMessage);
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
