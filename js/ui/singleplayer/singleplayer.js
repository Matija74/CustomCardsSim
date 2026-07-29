// singleplayer.js

// =========================
// Selected Card State
// =========================

let selectedHandCard = null;
let selectedHandCardData = null;
let pendingReplacePlay = null;

let selectedBoardCard = null;
let selectedBoardCardData = null;

let pendingAttack = null;
let currentAttack = null;
let pendingBlock = null;
let pendingTrashChoice = null;
let pendingDeferredCombatChoices = 0;
let deferredCombatContinuation = null;

const renderedBoardCardStates = new Map();

// =========================
// Game State
// =========================

let gameState = null;

// =========================
// UI Bridge
// =========================

let ui = null;

function createUiBridge() {
    return {
        updateDonDisplay,
        renderDonDecks,
        renderHands,
        renderDecks,
        renderLifeCards,
        renderLeaders,
        renderCharacters,
        renderTrash,
        renderStages
    };
}

async function initializeGamePage() {
    try {
        await loadCardDatabase();

        gameState = createInitialGameState();
        ui = createUiBridge();

        setupLifeArea("lifeArea", "lifeToggleText");
        setupLifeArea("opponentLifeArea", "opponentLifeToggleText");

        setupPhaseControls();
        setupSidebarControls();

        updateDonDisplay();
        renderDecks();
        renderDonDecks();
        renderLeaders();
        renderHands();
        renderCharacters();
        renderTrash();
        renderStages();

        setupCharacterSlotInteractions();
        setupBoardLeaderSelection();
        setupCardPreview();

        addGameLog(`
            Card database loaded. Game ready.<br>
            Player 1: ${gameState.player1.deckName}<br>
            Player 2: ${gameState.player2.deckName}
        `);

    } catch (error) {
        console.error(error);
        addGameLog(`Failed to load card database: ${error.message}`);
    }
}

document.addEventListener("DOMContentLoaded", initializeGamePage);

// =========================
// Defense Setup
// =========================

// =========================
// Game Over UI
// =========================

function showGameOverPopup(winnerPlayer, reasonTitle = "Victory", reasonText = "") {
    removeGameOverPopup();

    const overlay = document.createElement("div");
    overlay.className = "game-over-overlay";
    overlay.id = "gameOverOverlay";

    const popup = document.createElement("div");
    popup.className = "game-over-popup";

    const title = document.createElement("h2");
    title.textContent = "Game Over";

    const message = document.createElement("p");
    message.textContent = `${winnerPlayer.name} wins!`;

    const reasonHeading = document.createElement("h3");
    reasonHeading.className = "game-over-reason-title";
    reasonHeading.textContent = reasonTitle;

    const reasonMessage = document.createElement("p");
    reasonMessage.className = "game-over-reason-text";
    reasonMessage.textContent = reasonText;

    const buttons = document.createElement("div");
    buttons.className = "game-over-buttons";

    const mainMenuButton = document.createElement("a");
    mainMenuButton.className = "game-over-button main-menu";
    mainMenuButton.href = "../index.html";
    mainMenuButton.textContent = "Main Menu";

    const playAgainButton = document.createElement("button");
    playAgainButton.className = "game-over-button play-again";
    playAgainButton.textContent = "Play Again";

    playAgainButton.addEventListener("click", () => {
        window.location.reload();
    });

    buttons.appendChild(mainMenuButton);
    buttons.appendChild(playAgainButton);

    popup.appendChild(title);
    popup.appendChild(message);
    popup.appendChild(reasonHeading);
    popup.appendChild(reasonMessage);
    popup.appendChild(buttons);

    overlay.appendChild(popup);

    document.body.appendChild(overlay);
}

function removeGameOverPopup() {
    const oldPopup = document.getElementById("gameOverOverlay");

    if (oldPopup) {
        oldPopup.remove();
    }
}

function endGame(winnerPlayer, reasonTitle = "Victory", reasonText = "") {
    gameState.currentPhase = "gameOver";

    pendingAttack = null;
    currentAttack = null;
    pendingBlock = null;
    pendingReplacePlay = null;

    clearAttackTargets();
    clearBattleControls();
    clearHandSelection();
    clearBoardSelection();
    clearReplaceTargets();
    clearCancelAttackButton();
    clearAttackArrow();

    addGameLog(`${winnerPlayer.name} wins the game! ${reasonTitle}: ${reasonText}`);

    showGameOverPopup(winnerPlayer, reasonTitle, reasonText);

}

// =========================
// Attack Arrow UI
// =========================

function clearAttackArrow() {
    const overlay = document.getElementById("attackArrowOverlay");

    if (!overlay) return;

    overlay.innerHTML = "";
}

function drawAttackArrow(attackerData, targetData) {
    const overlay = document.getElementById("attackArrowOverlay");

    if (!overlay) return;

    clearAttackArrow();

    const attackerElement = getBoardElementFromData(attackerData);
    const targetElement = getBoardElementFromData(targetData);

    if (!attackerElement || !targetElement) return;

    const overlayRect = overlay.getBoundingClientRect();
    const attackerRect = attackerElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    const startX = attackerRect.left + attackerRect.width / 2 - overlayRect.left;
    const startY = attackerRect.top + attackerRect.height / 2 - overlayRect.top;

    const endX = targetRect.left + targetRect.width / 2 - overlayRect.left;
    const endY = targetRect.top + targetRect.height / 2 - overlayRect.top;

    overlay.setAttribute("viewBox", `0 0 ${overlayRect.width} ${overlayRect.height}`);

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "attackArrowHead");
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "10");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "3");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("markerUnits", "strokeWidth");

    const arrowHead = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arrowHead.setAttribute("d", "M0,0 L0,6 L9,3 z");
    arrowHead.setAttribute("class", "attack-arrow-head");

    marker.appendChild(arrowHead);
    defs.appendChild(marker);
    overlay.appendChild(defs);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

    line.setAttribute("x1", startX);
    line.setAttribute("y1", startY);
    line.setAttribute("x2", endX);
    line.setAttribute("y2", endY);
    line.setAttribute("class", "attack-arrow-line");
    line.setAttribute("marker-end", "url(#attackArrowHead)");

    overlay.appendChild(line);
}

function getBoardElementFromData(boardCardData) {
    if (!boardCardData) return null;

    if (boardCardData.cardType === "leader") {
        return document.querySelector(
            `.board-leader-card[data-player="${boardCardData.playerKey}"]`
        );
    }

    if (boardCardData.cardType === "character") {
        return document.querySelector(
            `.board-character-card[data-player="${boardCardData.playerKey}"][data-character-slot="${boardCardData.slotIndex}"]`
        );
    }

    return null;
}

// =========================
// Life Area Setup
// =========================

// =========================
// Phase Controls UI
// =========================

function setupPhaseControls() {
    const phaseButton = document.getElementById("phaseButton");

    if (!phaseButton) return;

    if (phaseButton.dataset.listenerAttached === "true") {
        return;
    }

    phaseButton.dataset.listenerAttached = "true";

    const phaseInfo = createPhaseLogProxy();

    phaseButton.addEventListener("click", () => {
        if (!gameState) {
            return;
        }

        if (gameState.currentPhase === "gameOver") {
            return;
        }

        if (gameState.currentPhase === "diceRoll") {
            runDiceRollPhase(phaseButton, phaseInfo);
            return;
        }

        if (gameState.currentPhase === "draw") {
            advanceDrawPhase(phaseButton, phaseInfo);
            return;
        }

        if (gameState.currentPhase === "don") {
            advanceDonPhase(phaseButton, phaseInfo);
            return;
        }

        if (gameState.currentPhase === "main") {
            if (window.isGameSettingEnabled?.("confirmEndTurn")) {
                showEndTurnConfirmation(phaseButton, phaseInfo);
            } else {
                passTurn(phaseButton, phaseInfo);
            }
            return;
        }
    });
}

function showEndTurnConfirmation(phaseButton, phaseInfo) {
    const controls = document.querySelector(".phase-controls");

    if (!controls || !gameState?.currentPlayer) {
        return;
    }

    removeChoiceButtons();
    phaseButton.style.display = "none";

    const choiceContainer = document.createElement("div");
    choiceContainer.className = "choice-buttons";

    const confirmButton = document.createElement("button");
    confirmButton.className = "phase-button";
    confirmButton.textContent = "Confirm End Turn";

    const cancelButton = document.createElement("button");
    cancelButton.className = "phase-button";
    cancelButton.textContent = "Cancel";

    confirmButton.addEventListener("click", () => {
        removeChoiceButtons();
        phaseButton.style.display = "block";
        passTurn(phaseButton, phaseInfo);
    });

    cancelButton.addEventListener("click", () => {
        removeChoiceButtons();
        runMainPhase(gameState.currentPlayer, phaseButton);
    });

    choiceContainer.appendChild(confirmButton);
    choiceContainer.appendChild(cancelButton);
    controls.appendChild(choiceContainer);
}

// =========================
// Game Log
// =========================

function shouldAddGameLog(cleanMessage) {
    if (!cleanMessage) {
        return false;
    }

    const plainText = cleanMessage
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    const suppressedPatterns = [
        /card database loaded\. game ready\./i,
        /players rolled the dice/i,
        /chose to go (first|second)\./i,
        /will go first\./i,
        /will go second\./i,
        /keep hand or mulligan/i,
        /both players are ready\./i,
        /starting turn \d+\./i,
        /refresh phase:/i,
        /draw phase:/i,
        /don!! phase:/i,
        /drew 1 card\./i,
        /gained \d+ don!!\./i,
        /selected .+\.$/i,
        /may use counter cards or resolve the attack\./i,
        /cannot attach don!! right now\./i,
        /is attacking with .+ choose a target\./i,
        /^choose a card from the attacking player's hand\.$/i,
    ];

    return !suppressedPatterns.some(pattern => pattern.test(plainText));
}

function addGameLog(message) {
    const gameLogMessages = document.getElementById("gameLogMessages");

    if (!gameLogMessages) return;

    const cleanMessage = normalizeLogMessage(message);

    if (!shouldAddGameLog(cleanMessage)) return;

    const logMessage = document.createElement("div");

    logMessage.className = "log-message";
    logMessage.innerHTML = cleanMessage;

    gameLogMessages.appendChild(logMessage);

    gameLogMessages.scrollTop = gameLogMessages.scrollHeight;
}

// =========================
// DON!! Rendering
// =========================

function updateDonDisplay() {
    renderDonArea(gameState.player1, "player1DonArea");
    renderDonArea(gameState.player2, "player2DonArea");
}

function renderDonArea(player, areaId) {
    const donArea = document.getElementById(areaId);

    if (!donArea) return;

    donArea.innerHTML = "";

    for (let i = 0; i < player.don; i++) {
        const img = document.createElement("img");

        img.src = donImage;
        img.alt = "Active DON!!";
        img.className = "don-card-img";

        donArea.appendChild(img);
    }

    for (let i = 0; i < player.restedDon; i++) {
        const img = document.createElement("img");

        img.src = donImage;
        img.alt = "Rested DON!!";
        img.className = "don-card-img rested-don";

        donArea.appendChild(img);
    }
}

function renderDonDecks() {
    renderDonDeck(gameState.player1, "player1DonDeckArea");
    renderDonDeck(gameState.player2, "player2DonDeckArea");
}

function renderDonDeck(player, areaId) {
    const donDeckArea = document.getElementById(areaId);

    if (!donDeckArea) return;

    donDeckArea.innerHTML = "";

    if (player.donDeck > 0) {
        const img = document.createElement("img");

        img.src = donBackImage;
        img.alt = "DON!! Deck";
        img.className = "deck-card-img";

        donDeckArea.appendChild(img);
    } else {
        donDeckArea.textContent = "DON!! Empty";
    }

    const count = document.createElement("div");
    count.className = "deck-count-badge don-deck-count";
    count.textContent = player.donDeck;

    donDeckArea.appendChild(count);
}

// =========================
// Deck Rendering
// =========================

function renderDecks() {
    renderDeck(gameState.player1, "player1DeckArea");
    renderDeck(gameState.player2, "player2DeckArea");
}

function renderDeck(player, deckAreaId) {
    const deckArea = document.getElementById(deckAreaId);

    if (!deckArea) return;

    deckArea.innerHTML = "";

    deckArea.classList.remove("deck-warning");

    if (player.deck.length > 0 && player.deck.length <= 2) {
        deckArea.classList.add("deck-warning");
    }

    if (player.deck.length > 0) {
        const img = document.createElement("img");

        img.src = cardBackImage;
        img.alt = `${player.name} Deck`;
        img.className = "deck-card-img";

        deckArea.appendChild(img);
    } else {
        deckArea.textContent = "Deck Empty";
    }

    const count = document.createElement("div");
    count.className = "deck-count-badge main-deck-count";
    count.textContent = player.deck.length;

    deckArea.appendChild(count);
}

// =========================
// Hand Rendering
// =========================

function renderHands() {
    renderPlayerHand(gameState.player1, "player1Hand", false);
    renderPlayerHand(gameState.player2, "player2Hand", false);
    updateSidebarSortButtonState();
}

function renderPlayerHand(player, handElementId, hidden) {
    const handElement = document.getElementById(handElementId);

    if (!handElement) return;

    handElement.innerHTML = "";

    player.hand.forEach((card) => {
        const cardElement = document.createElement("div");
        cardElement.className = hidden ? "hand-card hidden-card" : "hand-card";

        if (hidden) {
            const img = document.createElement("img");

            img.src = cardBackImage;
            img.alt = "Hidden Card";
            img.className = "hand-card-img";

            cardElement.appendChild(img);
        } else {
            cardElement.setAttribute("data-card-image", card.image);
            cardElement.setAttribute("data-player", player === gameState.player1 ? "player1" : "player2");
            cardElement.setAttribute("data-card-instance-id", card.instanceId);
            cardElement.classList.add("selectable-card");
            applyCardAnimationClass(cardElement, takeCardAnimationClass(card));

            const img = document.createElement("img");

            img.src = card.image;
            img.alt = card.name;
            img.className = "hand-card-img";

            cardElement.appendChild(img);
        }

        handElement.appendChild(cardElement);
    });

    const count = document.createElement("div");

    count.className = "hand-count";
    count.textContent = player.hand.length;

    handElement.appendChild(count);

    setupCardPreview();
    setupHandCardSelection();
}

async function sortPlayerHand(player) {
    if (!player || !Array.isArray(player.hand)) {
        return;
    }

    if (!canSortPlayerHand(player)) {
        return;
    }

    const indexedHand = player.hand.map((card, index) => ({ card, index }));

    indexedHand.sort((left, right) => {
        const leftKey = getHandSortKey(left.card);
        const rightKey = getHandSortKey(right.card);

        return leftKey.category - rightKey.category ||
            leftKey.cost - rightKey.cost ||
            leftKey.cardId.localeCompare(rightKey.cardId) ||
            left.index - right.index;
    });

    player.hand = indexedHand.map(entry => entry.card);

    clearHandSelection();
    renderHands();
}

function setupSidebarControls() {
    const sortButton = document.getElementById("sidebarSortButton");

    if (sortButton && sortButton.dataset.listenerAttached !== "true") {
        sortButton.dataset.listenerAttached = "true";
        sortButton.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();

            await sortPlayerHand(gameState?.player1);
        });
    }

    updateSidebarSortButtonState();
}

function updateSidebarSortButtonState() {
    const sortButton = document.getElementById("sidebarSortButton");

    if (!sortButton) {
        return;
    }

    const canSort = canSortPlayerHand(gameState?.player1);

    sortButton.disabled = !canSort;
    sortButton.title = canSort
        ? "Sort hand by category, cost, then card ID."
        : "Finish the current combat or card-play step before sorting this hand.";
}

function canSortPlayerHand(player) {
    if (!player) {
        return false;
    }

    if (
        pendingReplacePlay ||
        pendingAttack ||
        currentAttack ||
        pendingBlock
    ) {
        return false;
    }

    return true;
}

function getHandSortKey(card) {
    const categoryOrder = {
        stage: 0,
        event: 1,
        character: 2
    };
    const cardType = String(card?.cardType || "").toLowerCase();

    return {
        category: categoryOrder[cardType] ?? 3,
        cost: Number(card?.cost ?? card?.playCost ?? 0),
        cardId: String(card?.cardNumber || card?.id || card?.name || "")
    };
}

// =========================
// Life Rendering
// =========================

function renderLifeCards() {
    renderPlayerLife(gameState.player2, "lifeArea");
    renderPlayerLife(gameState.player1, "opponentLifeArea");
}

function renderPlayerLife(player, lifeAreaId) {
    const lifeArea = document.getElementById(lifeAreaId);

    if (!lifeArea) return;

    lifeArea.querySelectorAll(".life-card").forEach(card => card.remove());
    lifeArea.querySelectorAll(".life-count").forEach(counter => counter.remove());

    player.life.forEach(lifeCard => {
        const cardElement = document.createElement("div");
        cardElement.className = "life-card";

        const img = document.createElement("img");

        img.src = lifeCard?.faceUp && lifeCard.image
            ? lifeCard.image
            : cardBackImage;
        img.alt = lifeCard?.faceUp && lifeCard.name
            ? lifeCard.name
            : "Life Card";
        img.className = "life-card-img";

        cardElement.appendChild(img);
        lifeArea.appendChild(cardElement);
    });

    const count = document.createElement("div");

    count.className = "life-count";
    count.textContent = player.life.length;

    lifeArea.appendChild(count);

    setupCardPreview();
}

// =========================
// Leader Rendering
// =========================

function renderLeaders() {
    renderLeader(gameState.player1, "player1LeaderArea");
    renderLeader(gameState.player2, "player2LeaderArea");
}

function renderLeader(player, areaId) {
    const leaderArea = document.getElementById(areaId);

    if (!leaderArea) return;

    leaderArea.innerHTML = "";

    if (!player.leader.state) {
        player.leader.state = "active";
    }

    const playerKey = player === gameState.player1 ? "player1" : "player2";
    const renderKey = getBoardCardRenderKey(playerKey, "leader");

    const img = document.createElement("img");

    img.src = player.leader.image;
    img.alt = player.leader.name;
    img.className = "leader-card-img board-leader-card";

    img.setAttribute("data-card-image", player.leader.image);
    img.setAttribute("data-player", playerKey);
    img.setAttribute("data-board-card-type", "leader");

    const leaderState = player.leader.state || "active";

    img.dataset.cardState = leaderState;

    if (leaderState === "rested") {
        img.classList.add("board-card-rested");
    }

    applyCardAnimationClass(img, takeCardAnimationClass(player.leader));
    applyCardAnimationClass(img, getBoardStateAnimationClass(player.leader, renderKey));

    leaderArea.appendChild(img);
    renderAttachedDonBadge(player.leader, leaderArea);
    renderPowerModifierBadge(
        player.leader,
        player,
        leaderArea,
        {
            playerKey,
            cardType: "leader"
        }
    );
    renderBasePowerBadge(
        player.leader,
        player,
        leaderArea,
        {
            playerKey,
            cardType: "leader"
        }
    );

    setupCardPreview();
    setupBoardLeaderSelection();
    setupAttackTargetSelection();
}

// =========================
// Character Rendering
// =========================

function renderCharacters() {
    renderPlayerCharacters(gameState.player1, "player1");
    renderPlayerCharacters(gameState.player2, "player2");
}

function renderPlayerCharacters(player, playerKey) {
    const slots = document.querySelectorAll(`.character-slot[data-player="${playerKey}"]`);

    slots.forEach((slot, index) => {
        slot.innerHTML = "";

        const card = player.characters[index];

        if (!card) {
            slot.dataset.state = "empty";
            slot.classList.remove("occupied-slot");
            renderedBoardCardStates.delete(getBoardCardRenderKey(playerKey, "character", index));
            return;
        }

        const renderKey = getBoardCardRenderKey(playerKey, "character", index);
        slot.dataset.state = "occupied";
        slot.classList.add("occupied-slot");

        const img = document.createElement("img");

        img.src = card.image;
        img.alt = card.name;
        img.className = "hand-card-img board-card-img board-character-card";

        img.setAttribute("data-card-image", card.image);
        img.setAttribute("data-player", playerKey);
        img.setAttribute("data-character-slot", index);

        const cardState = card.state || "active";

        img.dataset.cardState = cardState;

        if (cardState === "rested") {
            img.classList.add("board-card-rested");
        }

        applyCardAnimationClass(img, takeCardAnimationClass(card));
        applyCardAnimationClass(img, getBoardStateAnimationClass(card, renderKey));

        slot.appendChild(img);
        renderCostModifierBadge(card, slot);
        renderAttachedDonBadge(card, slot);
        renderPowerModifierBadge(
            card,
            player,
            slot,
            {
                playerKey,
                cardType: "character",
                slotIndex: index
            }
        );
        renderBasePowerBadge(
            card,
            player,
            slot,
            {
                playerKey,
                cardType: "character",
                slotIndex: index
            }
        );
    });

    setupCardPreview();
    setupBoardCharacterSelection();
    setupAttackTargetSelection();
}

// =========================
// Stage Rendering
// =========================

function renderStages() {
    renderPlayerStage(gameState.player1, "player1StageArea");
    renderPlayerStage(gameState.player2, "player2StageArea");
}

function renderPlayerStage(player, stageAreaId) {
    const stageArea = document.getElementById(stageAreaId);

    if (!stageArea) return;

    stageArea.innerHTML = "";

    if (!player.stage) {
        stageArea.textContent = "Stage Card";
        stageArea.dataset.state = "empty";
        renderedBoardCardStates.delete(getBoardCardRenderKey(
            player === gameState.player1 ? "player1" : "player2",
            "stage"
        ));
        return;
    }

    stageArea.dataset.state = "occupied";
    const playerKey = player === gameState.player1 ? "player1" : "player2";
    const renderKey = getBoardCardRenderKey(playerKey, "stage");

    const img = document.createElement("img");

    img.src = player.stage.image;
    img.alt = player.stage.name;
    img.className = "deck-card-img board-card-img";

    img.setAttribute("data-card-image", player.stage.image);

    const stageState = player.stage.state || "active";

    img.dataset.cardState = stageState;

    if (stageState === "rested") {
        img.classList.add("board-card-rested");
    }

    applyCardAnimationClass(img, takeCardAnimationClass(player.stage));
    applyCardAnimationClass(img, getBoardStateAnimationClass(player.stage, renderKey));

    stageArea.appendChild(img);
    renderCostModifierBadge(player.stage, stageArea);

    setupCardPreview();
}

// =========================
// Trash Rendering
// =========================

function renderTrash() {
    renderPlayerTrash(gameState.player1, "player1TrashArea");
    renderPlayerTrash(gameState.player2, "player2TrashArea");
}

function renderPlayerTrash(player, trashAreaId) {
    const trashArea = document.getElementById(trashAreaId);

    if (!trashArea) return;

    trashArea.innerHTML = "";
    trashArea.classList.toggle("clickable-trash", player.trash.length > 0);
    trashArea.onclick = () => {
        if (player.trash.length === 0) return;

        showTrashViewer(player);
    };

    if (player.trash.length > 0) {
        const topCard = player.trash[player.trash.length - 1];

        const img = document.createElement("img");

        img.src = topCard.image;
        img.alt = topCard.name;
        img.className = "deck-card-img board-card-img";
        img.setAttribute("data-card-image", topCard.image);
        applyCardAnimationClass(img, takeCardAnimationClass(topCard));

        trashArea.appendChild(img);
    } else {
        const emptyText = document.createElement("span");

        emptyText.textContent = "Trash";
        emptyText.className = "trash-empty-text";

        trashArea.appendChild(emptyText);
    }

    const count = document.createElement("div");

    count.className = "trash-count";
    count.textContent = player.trash.length;

    trashArea.appendChild(count);

    setupCardPreview();
}

function showTrashViewer(player) {
    removeTrashViewer();

    const overlay = document.createElement("div");
    overlay.className = "look-top-overlay";
    overlay.id = "trashViewerOverlay";

    const popup = document.createElement("div");
    popup.className = "look-top-popup trash-viewer-popup";

    const title = document.createElement("h2");
    title.textContent = `${player.name}'s Trash`;

    const description = document.createElement("p");
    description.textContent = player.trash.length > 0
        ? "Cards are shown from newest to oldest."
        : "Trash is empty.";

    const cardGrid = document.createElement("div");
    cardGrid.className = "look-top-card-grid trash-viewer-grid";

    [...player.trash].reverse().forEach(card => {
        const cardFrame = document.createElement("div");
        cardFrame.className = "look-top-card-button trash-viewer-card";

        const img = document.createElement("img");
        img.src = card.image;
        img.alt = card.name;
        img.className = "look-top-card-img";
        img.setAttribute("data-card-image", card.image);

        const name = document.createElement("span");
        name.className = "look-top-card-name";
        name.textContent = card.name;

        cardFrame.appendChild(img);
        cardFrame.appendChild(name);
        cardGrid.appendChild(cardFrame);
    });

    const buttonRow = document.createElement("div");
    buttonRow.className = "look-top-buttons";

    const closeButton = document.createElement("button");
    closeButton.className = "look-top-action-button secondary";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", removeTrashViewer);

    buttonRow.appendChild(closeButton);

    popup.appendChild(title);
    popup.appendChild(description);
    popup.appendChild(cardGrid);
    popup.appendChild(buttonRow);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    setupCardPreview();
}

function removeTrashViewer() {
    const oldOverlay = document.getElementById("trashViewerOverlay");

    if (oldOverlay) {
        oldOverlay.remove();
    }
}

// =========================
// Card Preview
// =========================

function setupCardPreview() {
    document.querySelectorAll("[data-card-image]").forEach(cardElement => {
        cardElement.onmouseenter = () => {
            if (selectedHandCard || selectedBoardCard) return;

            const imageSrc = cardElement.getAttribute("data-card-image");

            showCardPreview(imageSrc);
        };

        cardElement.onmouseleave = () => {
            if (selectedHandCard || selectedBoardCard) return;

            clearCardPreview();
        };
    });
}

function showCardPreview(imageSrc) {
    const previewImage = document.getElementById("previewImage");
    const previewPlaceholder = document.getElementById("previewPlaceholder");

    if (!previewImage || !previewPlaceholder || !imageSrc) return;

    previewImage.src = imageSrc;
    previewImage.style.display = "block";
    previewPlaceholder.style.display = "none";
}

function clearCardPreview() {
    const previewImage = document.getElementById("previewImage");
    const previewPlaceholder = document.getElementById("previewPlaceholder");

    if (!previewImage || !previewPlaceholder) return;

    previewImage.src = "";
    previewImage.style.display = "none";
    previewPlaceholder.style.display = "block";
}

// =========================
// Hand Card Selection
// =========================

function setupHandCardSelection() {
    const previewImage = document.getElementById("previewImage");
    const previewPlaceholder = document.getElementById("previewPlaceholder");

    if (!previewImage || !previewPlaceholder) return;

    document.querySelectorAll(".hand-card.selectable-card[data-card-instance-id]").forEach(cardElement => {
        cardElement.onclick = () => {

            if (gameState.currentPhase === "counterPhase") {
                if (!currentAttack) {
                    return;
                }
            } else if (pendingReplacePlay || pendingAttack || pendingBlock || currentAttack) {
                return;
            }

            const imageSrc = cardElement.getAttribute("data-card-image");
            const playerKey = cardElement.getAttribute("data-player");
            const cardInstanceId = cardElement.getAttribute("data-card-instance-id");

            if (selectedHandCard === cardElement) {
                clearHandSelection();
                return;
            }

            clearHandSelection();
            clearBoardSelection();

            pendingReplacePlay = null;
            clearReplaceTargets();

            selectedHandCard = cardElement;

            selectedHandCardData = playerKey && cardInstanceId
                ? {
                    playerKey,
                    cardInstanceId
                }
                : null;

            cardElement.classList.add("selected-card");

            showCardPreview(imageSrc);

            if (gameState.currentPhase === "counterPhase") {
                showSelectedCounterActions();
            } else {
                showSelectedCardActions();
            }
        };
    });
}

function showSelectedCardActions() {
    clearSelectedCardActions();

    if (!selectedHandCard || !selectedHandCardData) return;

    const player = gameState[selectedHandCardData.playerKey];

    if (!player) return;

    const handIndex = findHandCardIndexByInstanceId(
        player,
        selectedHandCardData.cardInstanceId
    );

    if (handIndex === -1) return;

    const card = player.hand[handIndex];

    if (!card) return;

    const playButton = document.createElement("button");

    playButton.className = "card-action-button-on-card";
    playButton.textContent = "Play";

    const cardCost = getCardPlayCost(card, player);
    const canAfford = canPlayerAffordCard(player, card);
    const openSlotIndex = getFirstOpenCharacterSlotIndex(player);
    const canPlayNow = canPlayerPlayCards(player);
    const canPlayEventMain = card.cardType !== "event";

    if (!canPlayNow) {
        playButton.disabled = true;

        if (gameState.currentPhase === "mulligan") {
            playButton.textContent = "Wait";
            playButton.title = "Cards cannot be played during the mulligan phase.";
        } else if (!gameState.currentPlayer) {
            playButton.textContent = "Wait";
            playButton.title = "Cards cannot be played before the first turn starts.";
        } else if (gameState.currentPlayer !== player) {
            playButton.textContent = "Not Turn";
            playButton.title = `It is currently ${gameState.currentPlayer.name}'s turn.`;
        } else {
            playButton.textContent = "Wait";
            playButton.title = "Cards cannot be played right now.";
        }
    } else if (!canAfford) {
        playButton.disabled = true;
        playButton.textContent = `Need ${cardCost}`;
        playButton.title = `${player.name} does not have enough active DON!! to play this card.`;
    } else if (!canPlayEventMain) {
        playButton.disabled = true;
        playButton.textContent = "Counter Only";
        playButton.title = "Event cards are disabled while card effects are turned off.";
    } else if (card.cardType === "character" && openSlotIndex === -1) {
        playButton.textContent = `Replace ${cardCost}`;
        playButton.title = `${player.name}'s board is full. Click to choose a character to replace.`;
    } else if (card.cardType === "stage") {
        playButton.textContent = `Stage ${cardCost}`;
        playButton.title = `Play ${card.name} to the stage area.`;
    } else if (card.cardType === "event") {
        playButton.textContent = `Event ${cardCost}`;
        playButton.title = `Play ${card.name}, then place it in trash.`;
    } else {
        playButton.textContent = `Play ${cardCost}`;
    }

    playButton.addEventListener("click", async (event) => {
        event.stopPropagation();

        if (playButton.disabled) return;

        if (!canPlayerPlayCards(player)) {
            addGameLog("Cards cannot be played right now.");
            return;
        }

        const latestHandIndex = findHandCardIndexByInstanceId(
            player,
            selectedHandCardData.cardInstanceId
        );

        if (latestHandIndex === -1) {
            addGameLog("Selected card could not be found.");
            return;
        }

        const currentCard = player.hand[latestHandIndex];

        if (!currentCard) {
            addGameLog("Selected card could not be found.");
            return;
        }

        const currentOpenSlotIndex = getFirstOpenCharacterSlotIndex(player);

        if (currentCard.cardType === "character" && currentOpenSlotIndex === -1) {
            enterReplaceMode(
                selectedHandCardData.playerKey,
                selectedHandCardData.cardInstanceId
            );
            return;
        }

        const result = playCard(player, latestHandIndex, ui);

        addGameLog(result.message);

        if (!result.success) return;

        clearHandSelection();
        clearReplaceTargets();

        pendingReplacePlay = null;

    });

    selectedHandCard.appendChild(playButton);
}

function showSelectedCounterActions() {
    clearSelectedCardActions();

    if (!selectedHandCard || !selectedHandCardData || !currentAttack) return;

    const player = gameState[selectedHandCardData.playerKey];

    if (!player) return;

    const handIndex = findHandCardIndexByInstanceId(
        player,
        selectedHandCardData.cardInstanceId
    );

    if (handIndex === -1) return;

    const card = player.hand[handIndex];

    if (!card) return;

    const defenderPlayerKey = currentAttack.defenderPlayerKey;
    const isDefender = selectedHandCardData.playerKey === defenderPlayerKey;
    const counterValue = typeof getCounterPowerForUse === "function"
        ? getCounterPowerForUse(card, player)
        : getCardCounterValue(card, player);
    const handCounterCost = typeof getHandCounterEventCost === "function"
        ? getHandCounterEventCost(card, player)
        : 0;

    const counterButton = document.createElement("button");

    counterButton.className = "card-action-button-on-card";

    if (!isDefender) {
        counterButton.disabled = true;
        counterButton.textContent = "Not Def.";
        counterButton.title = "Only the defending player can counter with their own hand.";
    } else if (card.cardType === "event" && player.don < handCounterCost) {
        counterButton.disabled = true;
        counterButton.textContent = `Need ${handCounterCost}`;
        counterButton.title = `${card.name} needs ${handCounterCost} active DON!! to be used as a Counter from hand.`;
    } else if (!canCardBeUsedAsCounter(card, player)) {
        counterButton.disabled = true;
        counterButton.textContent = "No Counter";
        counterButton.title = `${card.name} has no counter value.`;
    } else {
        counterButton.textContent = counterValue > 0
            ? `Counter +${counterValue}`
            : "Counter";
        counterButton.title = `Use ${card.name} as counter.`;
    }

    counterButton.addEventListener("click", async (event) => {
        event.stopPropagation();

        if (counterButton.disabled) return;

        if (
            window.isGameSettingEnabled?.("confirmCounter") &&
            !window.confirm(`Use ${card.name} as counter?`)
        ) {
            return;
        }

        const latestHandIndex = findHandCardIndexByInstanceId(
            player,
            selectedHandCardData.cardInstanceId
        );

        if (latestHandIndex === -1) {
            addGameLog("Selected counter card could not be found.");
            return;
        }

        const result = useCounterFromHand(player, latestHandIndex, ui);

        addGameLog(result.message);

        if (!result.success) return;

        if (result.counterPower > 0) {
            applyCounterPowerToCurrentAttack(result.counterPower);

            addGameLog(
                `${player.name}'s attack target has +${currentAttack.targetPowerBonus} counter power this battle.`
            );
        }

        clearHandSelection();
    });

    selectedHandCard.appendChild(counterButton);
}

function applyCounterPowerToCurrentAttack(counterPower) {
    if (!currentAttack) return;

    currentAttack.targetPowerBonus =
        (currentAttack.targetPowerBonus || 0) + counterPower;

    renderLeaders();
    renderCharacters();
}

function clearSelectedCardActions() {
    document.querySelectorAll(".card-action-button-on-card").forEach(button => {
        button.remove();
    });
}

// =========================
// Board Card Selection
// =========================

function setupBoardCharacterSelection() {
    document.querySelectorAll(".board-character-card").forEach(cardElement => {
        cardElement.onclick = (event) => {
            event.stopPropagation();

            const playerKey = cardElement.getAttribute("data-player");
            const slotIndex = Number(cardElement.getAttribute("data-character-slot"));

            if (pendingReplacePlay) {
                const parentSlot = cardElement.closest(".character-slot");

                if (typeof parentSlot?.onclick === "function") {
                    parentSlot.onclick();
                }

                return;
            }

            if (pendingAttack) {
                return;
            }

            const player = gameState[playerKey];

            if (!player) return;

            const card = player.characters[slotIndex];

            if (!card) return;

            if (selectedBoardCard === cardElement) {
                clearBoardSelection();
                return;
            }

            clearBoardSelection();
            clearHandSelection();

            selectedBoardCard = cardElement;
            selectedBoardCardData = {
                playerKey,
                cardType: "character",
                slotIndex
            };

            cardElement.classList.add("selected-board-card");

            showCardPreview(cardElement.getAttribute("data-card-image"));

            showSelectedBoardActions();

            addGameLog(`${player.name} selected ${card.name}.`);
        };
    });
}

function setupBoardLeaderSelection() {
    document.querySelectorAll(".board-leader-card").forEach(leaderElement => {
        leaderElement.onclick = (event) => {
            event.stopPropagation();

            if (pendingReplacePlay || pendingAttack) {
                return;
            }

            const playerKey = leaderElement.getAttribute("data-player");
            const player = gameState[playerKey];

            if (!player || !player.leader) return;

            if (selectedBoardCard === leaderElement) {
                clearBoardSelection();
                return;
            }

            clearBoardSelection();
            clearHandSelection();

            selectedBoardCard = leaderElement;
            selectedBoardCardData = {
                playerKey,
                cardType: "leader"
            };

            leaderElement.classList.add("selected-board-card");

            showCardPreview(leaderElement.getAttribute("data-card-image"));

            showSelectedBoardActions();

            addGameLog(`${player.name} selected ${player.leader.name}.`);
        };
    });
}

function showSelectedBoardActions() {
    clearSelectedBoardActions();

    if (!selectedBoardCard || !selectedBoardCardData) return;

    const player = gameState[selectedBoardCardData.playerKey];
    const card = getSelectedBoardCardObject();

    if (!player || !card) return;

    const actionButtons = [];
    const attackButton = document.createElement("button");

    attackButton.className = "board-action-button-on-card attack-action-button";
    attackButton.textContent = "Attack";

    if (!canSelectedBoardCardAttack()) {
        attackButton.disabled = true;

        if (gameState.currentPhase !== "main") {
            attackButton.textContent = "Wait";
            attackButton.title = "Attacks can only be declared during the Main Phase.";
        } else if (gameState.currentPlayer !== player) {
            attackButton.textContent = "Not Turn";
            attackButton.title = `It is currently ${gameState.currentPlayer.name}'s turn.`;
        } else if (!canCurrentPlayerAttack()) {
            attackButton.textContent = "No Attack";
            attackButton.title = `${player.name} cannot attack on their first turn.`;
        } else if (selectedBoardCardData.cardType === "character" && isCharacterPlayedThisTurn(player, card)) {
            attackButton.textContent = "New";
            attackButton.title = `${card.name} cannot attack on the turn it was played.`;
        } else {
            attackButton.textContent = "Rested";
            attackButton.title = `${card.name} is not active and cannot attack.`;
        }
    }

    attackButton.addEventListener("click", (event) => {
        event.stopPropagation();

        if (attackButton.disabled) return;

        if (!selectedBoardCardData) return;

        enterAttackTargetSelection({ ...selectedBoardCardData });
    });

    actionButtons.push(attackButton);

    if (canAttachDonToBoardCard(player, card)) {
        actionButtons.push(createAttachDonButton(player, card));
    }

    const buttonContainer = getBoardActionButtonContainer();

    if (!buttonContainer) return;

    actionButtons.forEach((button, index) => {
        button.style.bottom = `${8 + (index * 35)}px`;
        buttonContainer.appendChild(button);
    });
}

function canAttachDonToBoardCard(player, card) {
    if (!player || !card) {
        return false;
    }

    if (pendingAttack || currentAttack) {
        return false;
    }

    if (gameState.currentPhase !== "main") {
        return false;
    }

    if (gameState.currentPlayer !== player) {
        return false;
    }

    if (card.cardType !== "leader" && card.cardType !== "character") {
        return false;
    }

    return player.don > 0;
}

function createAttachDonButton(player, card) {
    const attachDonButton = document.createElement("button");

    attachDonButton.className = "board-action-button-on-card attach-don-button";
    attachDonButton.textContent = "Attach DON";
    attachDonButton.title = `Attach 1 active DON!! to ${card.name}.`;

    attachDonButton.addEventListener("click", async (event) => {
        event.stopPropagation();

        if (!canAttachDonToBoardCard(player, card)) {
            addGameLog(`${player.name} cannot attach DON!! right now.`);
            return;
        }

        const result = attachActiveDonToCard(player, card, ui);

        addGameLog(result.message);

        if (!result.success) return;

        if (refreshSelectedBoardCardElement()) {
            showSelectedBoardActions();
        } else {
            clearBoardSelection();
        }
    });

    return attachDonButton;
}

function refreshSelectedBoardCardElement() {
    if (!selectedBoardCardData) {
        return false;
    }

    let cardElement = null;

    if (selectedBoardCardData.cardType === "leader") {
        cardElement = document.querySelector(
            `.board-leader-card[data-player="${selectedBoardCardData.playerKey}"]`
        );
    }

    if (selectedBoardCardData.cardType === "character") {
        cardElement = document.querySelector(
            `.board-character-card[data-player="${selectedBoardCardData.playerKey}"][data-character-slot="${selectedBoardCardData.slotIndex}"]`
        );
    }

    if (!cardElement) {
        return false;
    }

    selectedBoardCard = cardElement;
    selectedBoardCard.classList.add("selected-board-card");

    return true;
}

function clearSelectedBoardActions() {
    document.querySelectorAll(".board-action-button-on-card").forEach(button => {
        button.remove();
    });
}

// =========================
// Selection Clearing
// =========================

function clearHandSelection() {
    document.querySelectorAll(".selected-card").forEach(card => {
        card.classList.remove("selected-card");
    });

    selectedHandCard = null;
    selectedHandCardData = null;

    clearSelectedCardActions();

    clearCardPreview();
}

function clearBoardSelection() {
    document.querySelectorAll(".selected-board-card").forEach(card => {
        card.classList.remove("selected-board-card");
    });

    clearSelectedBoardActions();

    selectedBoardCard = null;
    selectedBoardCardData = null;

    clearCardPreview();
}

// =========================
// Replace Mode UI
// =========================

function clearReplaceTargets() {
    document.querySelectorAll(".character-slot.replace-target").forEach(slot => {
        slot.classList.remove("replace-target");
    });
}

function enterReplaceMode(playerKey, cardInstanceId) {
    const player = gameState[playerKey];

    if (!player) return;

    const handIndex = findHandCardIndexByInstanceId(player, cardInstanceId);
    const card = player.hand[handIndex];

    if (!card || handIndex === -1) return;

    pendingReplacePlay = {
        playerKey,
        cardInstanceId
    };

    clearReplaceTargets();

    document
        .querySelectorAll(`.character-slot[data-player="${playerKey}"]`)
        .forEach(slot => {
            const slotIndex = Number(slot.getAttribute("data-slot"));

            if (player.characters[slotIndex]) {
                slot.classList.add("replace-target");
            }
        });

    addGameLog(`${player.name}'s board is full. Choose a character to replace with ${card.name}.`);
}

function setupCharacterSlotInteractions() {
    document.querySelectorAll(".character-slot").forEach(slot => {
        slot.onclick = async () => {
            if (!pendingReplacePlay) return;

            const slotPlayerKey = slot.getAttribute("data-player");
            const slotIndex = Number(slot.getAttribute("data-slot"));

            if (slotPlayerKey !== pendingReplacePlay.playerKey) {
                addGameLog("You can only replace that player's own characters.");
                return;
            }

            const player = gameState[slotPlayerKey];

            if (!canPlayerPlayCards(player)) {
                addGameLog("Cards cannot be played right now.");
                return;
            }

            if (!player.characters[slotIndex]) {
                addGameLog("Choose an occupied character slot to replace.");
                return;
            }

            const handIndex = findHandCardIndexByInstanceId(
                player,
                pendingReplacePlay.cardInstanceId
            );

            if (handIndex === -1) {
                addGameLog("Selected card could not be found.");

                pendingReplacePlay = null;
                clearReplaceTargets();

                return;
            }

            const result = playCard(
                player,
                handIndex,
                ui,
                { targetSlotIndex: slotIndex }
            );

            addGameLog(result.message);

            if (!result.success) return;

            pendingReplacePlay = null;

            clearReplaceTargets();
            clearHandSelection();
        };
    });
}

// =========================
// Battle Controls UI
// =========================

function clearBattleControls() {
    const battleControls = document.getElementById("battleControls");

    if (!battleControls) return;

    battleControls.innerHTML = "";
}

function createBattleButton(text, onClick, disabled = false, extraClass = "") {
    const button = document.createElement("button");

    button.className = extraClass
        ? `battle-button ${extraClass}`
        : "battle-button";

    button.textContent = text;
    button.disabled = disabled;

    button.addEventListener("click", onClick);

    return button;
}

function showResolveAttackButton(defenderPlayerKey, onResolve) {
    const battleControls = document.getElementById("battleControls");

    if (!battleControls) return;

    clearBattleControls();

    pendingBlock = null;
    startCounterPhase(defenderPlayerKey, onResolve);
}

function showCounterPhaseControls(defenderPlayerKey, onResolve) {
    const battleControls = document.getElementById("battleControls");

    if (!battleControls) return;

    if (currentAttack) {
        currentAttack.counterPhaseStarted = true;
    }

    gameState.currentPhase = "counterPhase";

    clearBattleControls();

    const counterLabel = createBattleButton(
        "Counter Phase",
        () => {},
        true,
        "counter-phase"
    );

    const colorClass = defenderPlayerKey === "player1"
        ? "player1-resolve"
        : "player2-resolve";

    const defenderName = gameState[defenderPlayerKey]?.name ?? "Defender";

    const resolveButton = createBattleButton(
        `${defenderName}: Resolve Attack`,
        async () => {
            if (typeof onResolve === "function") {
                await onResolve();
            }

            clearBattleControls();
        },
        false,
        colorClass
    );

    battleControls.appendChild(counterLabel);
    battleControls.appendChild(resolveButton);
}

function showResolveOnlyButton(defenderPlayerKey, onResolve) {
    const battleControls = document.getElementById("battleControls");

    if (!battleControls) return;

    clearBattleControls();

    const colorClass = defenderPlayerKey === "player1"
        ? "player1-resolve"
        : "player2-resolve";

    const defenderName = gameState[defenderPlayerKey]?.name ?? "Defender";

    const resolveButton = createBattleButton(
        `${defenderName}: Resolve Attack`,
        async () => {
            if (typeof onResolve === "function") {
                await onResolve();
            }

            clearBattleControls();
        },
        false,
        colorClass
    );

    battleControls.appendChild(resolveButton);
}

// =========================
// Attack Target UI
// =========================

function enterAttackTargetSelection(attackerData) {
    const attackerPlayer = gameState[attackerData.playerKey];
    const attackerCard = getBoardCardFromData(attackerData);

    if (!attackerPlayer || !attackerCard) return;

    const opponentKey = getOpponentPlayerKey(attackerData.playerKey);
    const opponent = gameState[opponentKey];

    if (!opponent) return;

    if (!restBoardCard(attackerData)) {
        addGameLog(`${attackerCard.name} cannot be rested and cannot attack right now.`);
        return;
    }

    pendingAttack = {
        attacker: { ...attackerData },
        attackerPlayerKey: attackerData.playerKey,
        defenderPlayerKey: opponentKey
    };

    clearAttackTargets();
    clearBoardSelection();
    clearHandSelection();
    clearCancelAttackButton();

    const opponentLeader = document.querySelector(
        `.board-leader-card[data-player="${opponentKey}"]`
    );

    if (opponentLeader) {
        opponentLeader.classList.add("attack-target");
    }

    document
        .querySelectorAll(`.board-character-card[data-player="${opponentKey}"]`)
        .forEach(characterElement => {
            const slotIndex = Number(characterElement.getAttribute("data-character-slot"));
            const character = opponent.characters[slotIndex];

            if (!character) return;

            if (character.state !== "rested") return;

            characterElement.classList.add("attack-target");
        });

    gameState.currentPhase = "choosingAttackTarget";

    showCancelAttackButton(attackerData);

    addGameLog(`${attackerPlayer.name} is attacking with ${attackerCard.name}. Choose a target.`);
}

function setupAttackTargetSelection() {
    document.querySelectorAll(".board-leader-card, .board-character-card").forEach(cardElement => {
        if (cardElement.dataset.attackTargetListenerAttached === "true") return;

        cardElement.dataset.attackTargetListenerAttached = "true";

        cardElement.addEventListener("click", (event) => {
            if (!pendingAttack) return;

            if (!cardElement.classList.contains("attack-target")) return;

            event.stopPropagation();

            const targetPlayerKey = cardElement.getAttribute("data-player");

            let targetData;

            if (cardElement.classList.contains("board-leader-card")) {
                targetData = {
                    playerKey: targetPlayerKey,
                    cardType: "leader"
                };
            } else {
                targetData = {
                    playerKey: targetPlayerKey,
                    cardType: "character",
                    slotIndex: Number(cardElement.getAttribute("data-character-slot"))
                };
            }

            beginAttack(targetData);
        });
    });
}

function clearAttackTargets() {
    document.querySelectorAll(".attack-target").forEach(target => {
        target.classList.remove("attack-target");
    });
}

// =========================
// Attack Flow UI
// =========================

function beginAttack(targetData) {
    if (!pendingAttack) return;

    const attackerData = { ...pendingAttack.attacker };
    const attackerPlayer = gameState[pendingAttack.attackerPlayerKey];
    const defenderPlayer = gameState[pendingAttack.defenderPlayerKey];
    const attackerCard = getBoardCardFromData(attackerData);
    const targetCard = getBoardCardFromData(targetData);

    if (!attackerPlayer || !defenderPlayer || !attackerCard || !targetCard) {
        addGameLog("Attack could not begin.");
        setBoardCardActive(attackerData);
        pendingAttack = null;
        clearAttackTargets();
        gameState.currentPhase = "main";
        return;
    }

    currentAttack = {
        id: null,
        attacker: { ...attackerData },
        target: { ...targetData },
        attackerPlayerKey: pendingAttack.attackerPlayerKey,
        defenderPlayerKey: pendingAttack.defenderPlayerKey,
        targetPowerBonus: 0
    };

    if (attackerData.cardType === "leader") {
        attackerPlayer.leaderAttacksThisTurn = Number(attackerPlayer.leaderAttacksThisTurn || 0) + 1;
    }

    pendingAttack = null;
    clearCancelAttackButton();
    drawAttackArrow(currentAttack.attacker, currentAttack.target);
    clearAttackTargets();
    clearBoardSelection();
    clearHandSelection();
    gameState.currentPhase = "attackResolving";

    addGameLog(
        `${attackerPlayer.name}'s ${attackerCard.name} attacks ${defenderPlayer.name}'s ${targetCard.name}.`
    );

    showResolveAttackButton(currentAttack.defenderPlayerKey, resolveCurrentAttack);
}

async function resolveCurrentAttack() {
    if (!currentAttack) {
        clearBattleControls();
        gameState.currentPhase = "main";
        return;
    }

    const attackerPlayer = gameState[currentAttack.attackerPlayerKey];
    const defenderPlayer = gameState[currentAttack.defenderPlayerKey];

    const attackerCard = getBoardCardFromData(currentAttack.attacker);
    const targetCard = getBoardCardFromData(currentAttack.target);

    if (!attackerCard || !targetCard) {
        addGameLog("Attack could not be resolved.");

        currentAttack = null;
        pendingAttack = null;
        pendingBlock = null;

        clearAttackTargets();
        clearBattleControls();
        clearAttackArrow();

        gameState.currentPhase = "main";

        return;
    }

    const attackerPower = getCardBattlePower(attackerCard, attackerPlayer);
    const targetBasePower = getCardBattlePower(targetCard, defenderPlayer);
    const targetCounterBonus = currentAttack.targetPowerBonus || 0;
    const targetPower = targetBasePower + targetCounterBonus;

    const attackerWins = attackerPower >= targetPower;

    let gameWinner = null;
    let gameOverTitle = "Final Attack";
    let gameOverText = `${defenderPlayer.name} had no life cards left and took a successful leader attack.`;

    let battleResultText = attackerWins
        ? `${attackerCard.name} wins the battle.`
        : `${attackerCard.name} loses the battle.`;

    if (attackerWins && currentAttack.target.cardType === "character") {
        const koResult = KOCharacter(
            defenderPlayer,
            currentAttack.target.slotIndex,
            ui,
            { byBattle: true }
        );

        battleResultText += `<br>${koResult.message}`;
    }

    if (attackerWins && currentAttack.target.cardType === "leader") {
        if (defenderPlayer.life.length === 0) {
            loseByLifeDamage(
                defenderPlayer,
                `${defenderPlayer.name} took a direct attack with no life cards remaining.`
            );

            gameWinner = attackerPlayer;
            battleResultText += `<br>${defenderPlayer.name} has no life cards left.`;
            battleResultText += `<br>${attackerPlayer.name} wins the game.`;
        } else {
            const lifeResult = takeLifeDamage(defenderPlayer, 1, ui);
            battleResultText += `<br>${lifeResult.message}`;
        }
    }

    addGameLog(`
        ${defenderPlayer.name} resolved the attack.<br>
        ${attackerPlayer.name}'s ${attackerCard.name}: ${attackerPower} power<br>
        ${defenderPlayer.name}'s ${targetCard.name}: ${targetPower} power${targetCounterBonus > 0 ? ` (${targetBasePower} + ${targetCounterBonus})` : ""}<br><br>
        ${battleResultText}
    `);

    currentAttack = null;
    pendingAttack = null;
    pendingBlock = null;

    clearAttackTargets();
    clearBattleControls();
    clearAttackArrow();

    renderLeaders();
    renderCharacters();

    if (gameWinner) {
        endGame(
            gameWinner,
            gameOverTitle,
            gameOverText
        );
        return;
    }

    gameState.currentPhase = "main";
}

function clearCancelAttackButton() {
    document.querySelectorAll(".cancel-attack-button-on-card").forEach(button => {
        button.remove();
    });
}

function showCancelAttackButton(attackerData) {
    clearCancelAttackButton();

    const buttonContainer = getBoardActionButtonContainerFromData(attackerData);

    if (!buttonContainer) return;

    const cancelButton = document.createElement("button");

    cancelButton.className = "board-action-button-on-card cancel-attack-button-on-card";
    cancelButton.textContent = "Cancel Attack";

    cancelButton.addEventListener("click", (event) => {
        event.stopPropagation();

        cancelPendingAttack();
    });

    buttonContainer.appendChild(cancelButton);
}

function cancelPendingAttack() {
    if (!pendingAttack) return;

    const attackerPlayer = gameState[pendingAttack.attackerPlayerKey];
    const attackerCard = getBoardCardFromData(pendingAttack.attacker);
    const attackerData = { ...pendingAttack.attacker };

    setBoardCardActive(attackerData);

    addGameLog(`${attackerPlayer.name} cancelled the attack with ${attackerCard.name}.`);

    pendingAttack = null;
    currentAttack = null;

    clearAttackTargets();
    clearBattleControls();
    clearAttackArrow();
    clearCancelAttackButton();

    gameState.currentPhase = "main";
}

// =========================
// Board Helpers
// =========================

function getSelectedBoardCardObject() {
    if (!selectedBoardCardData) return null;

    return getBoardCardFromData(selectedBoardCardData);
}

function canCurrentPlayerAttack() {
    if (!gameState.currentPlayer) {
        return false;
    }

    return gameState.currentPlayer.turns > 1;
}

function canSelectedBoardCardAttack() {
    if (pendingAttack || currentAttack) {
        return false;
    }

    if (!selectedBoardCardData) {
        return false;
    }

    const player = gameState[selectedBoardCardData.playerKey];

    if (!player) {
        return false;
    }

    if (gameState.currentPhase !== "main") {
        return false;
    }

    if (gameState.currentPlayer !== player) {
        return false;
    }

    if (!canCurrentPlayerAttack()) {
        return false;
    }

    const card = getSelectedBoardCardObject();

    if (!card) {
        return false;
    }
    if (
        selectedBoardCardData.cardType === "character" &&
        isCharacterPlayedThisTurn(player, card)
    ) {
        return false;
    }

    const cardState = card.state || "active";

    if (cardState !== "active") {
        return false;
    }

    return true;
}
