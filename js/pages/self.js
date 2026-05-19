// self.js

// =========================
// Image Paths
// =========================

const cardBackImage = "../images/basic/card-back-normal.jpg";
const donBackImage = "../images/basic/card-back-don.webp";
const donImage = "../images/basic/card-front-don.webp";

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

// =========================
// Game State
// =========================

let gameState = null;

// =========================
// UI Bridge
// =========================

let ui = null;

// =========================
// Game Initialization
// =========================

function getSelectedDeckIds() {
    const params = new URLSearchParams(window.location.search);
    const defaultDeckId = window.getAvailableDecks?.()[0]?.id;

    return {
        player1DeckId: params.get("player1Deck") || defaultDeckId,
        player2DeckId: params.get("player2Deck") || defaultDeckId
    };
}

function createInitialPlayerState(playerName, deckDefinition) {
    const selectedDeck = deckDefinition || window.getAvailableDecks?.()[0];
    const leader = window.leaders[selectedDeck.leaderKey];

    if (!leader) {
        throw new Error(`Leader not found for deck: ${selectedDeck.name}`);
    }

    return {
        name: playerName,
        don: 0,
        restedDon: 0,
        donDeck: 10,
        turns: 0,
        deck: shuffleDeck(parseDeckText(selectedDeck.deckText)),
        deckName: selectedDeck.name,
        hasMulliganed: false,
        hand: [],
        life: [],
        trash: [],
        leader: createCardInstance(leader),
        characters: [],
        stage: null
    };
}

function createInitialGameState() {
    const selectedDeckIds = getSelectedDeckIds();
    const player1Deck = window.getDeckById(selectedDeckIds.player1DeckId);
    const player2Deck = window.getDeckById(selectedDeckIds.player2DeckId);

    return {
        player1: createInitialPlayerState("Player 1", player1Deck),
        player2: createInitialPlayerState("Player 2", player2Deck),

        diceWinner: null,
        firstPlayer: null,
        secondPlayer: null,
        currentPlayer: null,
        turnNumber: 1,
        currentPhase: "diceRoll"
    };
}

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
// Blocker Target UI
// =========================

function clearBlockerTargets() {
    document.querySelectorAll(".blocker-target").forEach(target => {
        target.classList.remove("blocker-target");
    });
}

function enterBlockerStep(defenderPlayerKey, onResolve) {
    const defenderPlayer = gameState[defenderPlayerKey];

    if (!defenderPlayer || !currentAttack) {
        startCounterPhase(defenderPlayerKey, onResolve);
        return;
    }

    const availableBlockers = CardEffects.getAvailableBlockers(defenderPlayer);

    pendingBlock = {
        defenderPlayerKey,
        onResolve
    };

    clearBlockerTargets();

    availableBlockers.forEach(({ slotIndex }) => {
        const blockerElement = document.querySelector(
            `.board-character-card[data-player="${defenderPlayerKey}"][data-character-slot="${slotIndex}"]`
        );

        if (blockerElement) {
            blockerElement.classList.add("blocker-target");
        }
    });

    if (availableBlockers.length > 0) {
        addGameLog(`${defenderPlayer.name} may choose a Blocker or skip blocking.`);
    } else {
        addGameLog(`${defenderPlayer.name} has no available Blockers.`);
    }
}

function handleBlockerSelection(playerKey, slotIndex) {
    if (!pendingBlock || !currentAttack) return;

    if (playerKey !== pendingBlock.defenderPlayerKey) {
        addGameLog("Only the defending player can block this attack.");
        return;
    }

    const defenderPlayer = gameState[playerKey];

    if (!defenderPlayer) return;

    const blockerCard = defenderPlayer.characters[slotIndex];

    if (!CardEffects.canBlock(blockerCard)) {
        addGameLog(`${blockerCard?.name ?? "That card"} cannot block.`);
        return;
    }

    const blockerData = {
        playerKey,
        cardType: "character",
        slotIndex
    };

    currentAttack.target = blockerData;

    restBoardCard(blockerData);

    drawAttackArrow(currentAttack.attacker, currentAttack.target);

    clearBlockerTargets();

    pendingBlock = null;

    addGameLog(`${defenderPlayer.name} blocked the attack with ${blockerCard.name}.`);

    startCounterPhase(playerKey, () => {
        resolveCurrentAttack();
    });
}

function skipCurrentBlockStep(defenderPlayerKey, onResolve) {
    const defenderName = gameState[defenderPlayerKey]?.name ?? "Defender";

    pendingBlock = null;

    clearBlockerTargets();

    addGameLog(`${defenderName} skipped the Block Phase.`);

    startCounterPhase(defenderPlayerKey, onResolve);
}

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
    pendingTrashChoice = null;
    pendingReplacePlay = null;

    clearAttackTargets();
    clearBlockerTargets();
    clearBattleControls();
    clearHandSelection();
    clearBoardSelection();
    clearReplaceTargets();
    clearTrashChoiceTargets();
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

function setupLifeArea(areaId, textId) {
    const lifeArea = document.getElementById(areaId);
    const lifeToggleText = document.getElementById(textId);

    if (!lifeArea || !lifeToggleText) return;

    lifeToggleText.textContent = "View Life Cards";

    lifeArea.addEventListener("mouseenter", () => {
        if (!lifeArea.classList.contains("open")) {
            lifeToggleText.textContent = "Life Cards";
        }
    });

    lifeArea.addEventListener("mouseleave", () => {
        if (!lifeArea.classList.contains("open")) {
            lifeToggleText.textContent = "View Life Cards";
        }
    });

    lifeArea.addEventListener("click", () => {
        lifeArea.classList.toggle("open");

        if (lifeArea.classList.contains("open")) {
            lifeToggleText.textContent = "Life Cards View Locked";
        } else {
            lifeToggleText.textContent = "View Life Cards";
        }
    });
}

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

        if (gameState.currentPhase === "main") {
            passTurn(phaseButton, phaseInfo);
            return;
        }
    });
}

function createTurnOrderButtons(phaseButton, phaseInfo) {
    removeChoiceButtons();

    const choiceContainer = document.createElement("div");
    choiceContainer.className = "choice-buttons";

    const firstButton = document.createElement("button");
    firstButton.className = "phase-button";
    firstButton.textContent = "Go 1st";

    const secondButton = document.createElement("button");
    secondButton.className = "phase-button";
    secondButton.textContent = "Go 2nd";

    choiceContainer.appendChild(firstButton);
    choiceContainer.appendChild(secondButton);

    document.querySelector(".phase-controls").appendChild(choiceContainer);

    firstButton.addEventListener("click", () => {
        selectTurnOrder("first", phaseButton, phaseInfo);
    });

    secondButton.addEventListener("click", () => {
        selectTurnOrder("second", phaseButton, phaseInfo);
    });
}

function createMulliganButtons(player, phaseButton, phaseInfo) {
    removeChoiceButtons();

    const choiceContainer = document.createElement("div");
    choiceContainer.className = "choice-buttons";

    const keepButton = document.createElement("button");
    keepButton.className = "phase-button";
    keepButton.textContent = "Keep Hand";

    const mulliganButton = document.createElement("button");
    mulliganButton.className = "phase-button";
    mulliganButton.textContent = "Mulligan";

    choiceContainer.appendChild(keepButton);
    choiceContainer.appendChild(mulliganButton);

    document.querySelector(".phase-controls").appendChild(choiceContainer);

    keepButton.addEventListener("click", () => {
        handleMulliganChoice(player, false, phaseButton, phaseInfo);
    });

    mulliganButton.addEventListener("click", () => {
        handleMulliganChoice(player, true, phaseButton, phaseInfo);
    });
}

function removeChoiceButtons() {
    const oldButtons = document.querySelector(".choice-buttons");

    if (oldButtons) {
        oldButtons.remove();
    }
}

// =========================
// Game Log
// =========================

function createPhaseLogProxy() {
    let currentText = "";

    return {
        get innerHTML() {
            return currentText;
        },

        set innerHTML(newText) {
            const addedText = newText.startsWith(currentText)
                ? newText.replace(currentText, "")
                : newText;

            currentText = newText;

            if (addedText.trim() !== "") {
                addGameLog(addedText);
            }
        }
    };
}

function addGameLog(message) {
    const gameLogMessages = document.getElementById("gameLogMessages");

    if (!gameLogMessages) return;

    const cleanMessage = message
        .replace(/^\s*(<br>\s*)+/gi, "")
        .replace(/(<br>\s*){3,}/gi, "<br><br>")
        .trim();

    if (!cleanMessage) return;

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

    player.life.forEach(() => {
        const cardElement = document.createElement("div");
        cardElement.className = "life-card";

        const img = document.createElement("img");

        img.src = cardBackImage;
        img.alt = "Life Card";
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

    leaderArea.appendChild(img);
    renderPowerModifierBadge(
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
            return;
        }

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

        slot.appendChild(img);
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
        return;
    }

    stageArea.dataset.state = "occupied";

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

    stageArea.appendChild(img);

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

    if (player.trash.length > 0) {
        const topCard = player.trash[player.trash.length - 1];

        const img = document.createElement("img");

        img.src = topCard.image;
        img.alt = topCard.name;
        img.className = "deck-card-img board-card-img";
        img.setAttribute("data-card-image", topCard.image);

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
            if (pendingTrashChoice) {
                handlePendingTrashChoice(
                    cardElement.getAttribute("data-player"),
                    cardElement.getAttribute("data-card-instance-id")
                );
                return;
            }

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

    const cardCost = getCardPlayCost(card);
    const canAfford = canPlayerAffordCard(player, card);
    const openSlotIndex = getFirstOpenCharacterSlotIndex(player);
    const canPlayNow = canPlayerPlayCards(player);

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

    playButton.addEventListener("click", (event) => {
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
    const counterValue = getCardCounterValue(card, player);

    const counterButton = document.createElement("button");

    counterButton.className = "card-action-button-on-card";

    if (!isDefender) {
        counterButton.disabled = true;
        counterButton.textContent = "Not Def.";
        counterButton.title = "Only the defending player can counter.";
    } else if (!canCardBeUsedAsCounter(card, player)) {
        counterButton.disabled = true;
        counterButton.textContent = "No Counter";
        counterButton.title = `${card.name} has no counter value.`;
    } else {
        counterButton.textContent = `Counter +${counterValue}`;
        counterButton.title = `Use ${card.name} as counter.`;
    }

    counterButton.addEventListener("click", (event) => {
        event.stopPropagation();

        if (counterButton.disabled) return;

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

        applyCounterPowerToCurrentAttack(result.counterPower);

        addGameLog(
            `${player.name}'s attack target has +${currentAttack.targetPowerBonus} counter power this battle.`
        );

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

            if (pendingBlock) {
                handleBlockerSelection(playerKey, slotIndex);
                return;
            }

            if (pendingReplacePlay || pendingAttack) {
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

    const attackButton = document.createElement("button");
    const activateMainEffect = getActivateMainEffect(card);

    attackButton.className = activateMainEffect
        ? "board-action-button-on-card attack-action-button has-activate-main"
        : "board-action-button-on-card attack-action-button";
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
        } else if (selectedBoardCardData.cardType === "character" && isCharacterPlayedThisTurn(player, card) && !CardEffects.canAttackOnTurnPlayed(card) && !CardEffects.canAttackCharactersOnTurnPlayed(card)) {
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

    const buttonContainer = getBoardActionButtonContainer();

    if (!buttonContainer) return;

    buttonContainer.appendChild(attackButton);

    if (activateMainEffect) {
        const activateMainButton = createActivateMainButton(
            player,
            card,
            activateMainEffect
        );

        buttonContainer.appendChild(activateMainButton);
    }
}

function getActivateMainEffect(card) {
    return card?.effects?.find(effect => effect.type === "activateMain") || null;
}

function canUseActivateMainEffect(player, card, effect) {
    if (!player || !card || !effect) {
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

    if (
        effect.oncePerTurn &&
        CardEffects.hasUsedOncePerTurnEffect(card, effect.id, player.turns)
    ) {
        return false;
    }

    return true;
}

function createActivateMainButton(player, card, effect) {
    const activateMainButton = document.createElement("button");

    activateMainButton.className = "board-action-button-on-card activate-main-button";
    activateMainButton.textContent = "Activate: Main";

    if (!canUseActivateMainEffect(player, card, effect)) {
        activateMainButton.disabled = true;

        if (gameState.currentPhase !== "main") {
            activateMainButton.title = "Activate: Main effects can only be used during the Main Phase.";
        } else if (gameState.currentPlayer !== player) {
            activateMainButton.title = `It is currently ${gameState.currentPlayer?.name ?? "another player"}'s turn.`;
        } else if (effect.oncePerTurn && CardEffects.hasUsedOncePerTurnEffect(card, effect.id, player.turns)) {
            activateMainButton.title = "This Once Per Turn effect has already been used this turn.";
        } else {
            activateMainButton.title = "This effect cannot be activated right now.";
        }
    }

    activateMainButton.addEventListener("click", (event) => {
        event.stopPropagation();

        if (activateMainButton.disabled) return;

        activateMainBoardEffect(player, card, effect);
    });

    return activateMainButton;
}

function activateMainBoardEffect(player, card, effect) {
    if (!canUseActivateMainEffect(player, card, effect)) {
        addGameLog(`${card.name}'s Activate: Main effect cannot be used right now.`);
        return;
    }

    const result = resolveBoardActionEffect(player, card, effect);

    if (!result.success) {
        addGameLog(result.message);
        return;
    }

    if (effect.oncePerTurn) {
        CardEffects.markOncePerTurnEffectUsed(card, effect.id, player.turns);
    }

    addGameLog(`${player.name} activated ${card.name}'s Activate: Main effect. ${result.message}`);

    showSelectedBoardActions();
}

function resolveBoardActionEffect(player, card, effect) {
    if (effect.actionId === "drawOneCard") {
        const drawResult = drawCard(player, ui);

        return {
            success: !drawResult?.deckOut,
            message: drawResult?.deckOut
                ? `${player.name} could not draw a card.`
                : `${player.name} drew 1 card.`
        };
    }

    return {
        success: false,
        message: `${card.name}'s effect is not implemented yet.`
    };
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
        slot.onclick = () => {
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

function createSkipBlockButton(onSkipBlock) {
    return createBattleButton(
        "Skip Block",
        () => {
            if (typeof onSkipBlock === "function") {
                onSkipBlock();
            }
        },
        false,
        "skip-block"
    );
}

function showResolveAttackButton(defenderPlayerKey, onResolve) {
    const battleControls = document.getElementById("battleControls");

    if (!battleControls) return;

    clearBattleControls();

    const attackerCard = currentAttack
        ? getBoardCardFromData(currentAttack.attacker)
        : null;

    if (CardEffects.isUnblockable(attackerCard)) {
        const attackerName = attackerCard?.name ?? "This card";

        pendingBlock = null;
        clearBlockerTargets();

        addGameLog(`${attackerName} is Unblockable. The Block Phase was skipped.`);

        startCounterPhase(defenderPlayerKey, onResolve);
        return;
    }

    enterBlockerStep(defenderPlayerKey, onResolve);

    const skipBlockButton = createSkipBlockButton(() => {
        skipCurrentBlockStep(defenderPlayerKey, onResolve);
    });

    battleControls.appendChild(skipBlockButton);
}

function showCounterPhaseControls(defenderPlayerKey, onResolve) {
    const battleControls = document.getElementById("battleControls");

    if (!battleControls) return;

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
        () => {
            if (typeof onResolve === "function") {
                onResolve();
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
        () => {
            if (typeof onResolve === "function") {
                onResolve();
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

    pendingAttack = {
        attacker: { ...attackerData },
        attackerPlayerKey: attackerData.playerKey,
        defenderPlayerKey: opponentKey
    };

    restBoardCard(attackerData);

    clearAttackTargets();
    clearBoardSelection();
    clearHandSelection();
    clearCancelAttackButton();

    const attackerWasPlayedThisTurn =
        attackerData.cardType === "character" &&
        isCharacterPlayedThisTurn(attackerPlayer, attackerCard);

    const canTargetLeader =
        !attackerWasPlayedThisTurn ||
        CardEffects.canAttackOnTurnPlayed(attackerCard);

    const opponentLeader = document.querySelector(
        `.board-leader-card[data-player="${opponentKey}"]`
    );

    if (opponentLeader && canTargetLeader) {
        opponentLeader.classList.add("attack-target");
    }

    document
        .querySelectorAll(`.board-character-card[data-player="${opponentKey}"]`)
        .forEach(characterElement => {
            const slotIndex = Number(characterElement.getAttribute("data-character-slot"));
            const character = opponent.characters[slotIndex];

            if (!character) return;

            if (character.state !== "rested") return;

            if (
                attackerWasPlayedThisTurn &&
                !CardEffects.canAttackTargetOnTurnPlayed(attackerCard, {
                    playerKey: opponentKey,
                    cardType: "character",
                    slotIndex
                })
            ) {
                return;
            }

            characterElement.classList.add("attack-target");
        });

    gameState.currentPhase = "choosingAttackTarget";

    showCancelAttackButton(attackerData);

    addGameLog(`${attackerPlayer.name} is attacking with ${attackerCard.name}. Choose a target.`);
}

function setupAttackTargetSelection() {
    document.querySelectorAll(".board-leader-card, .board-character-card").forEach(cardElement => {
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
        attacker: { ...attackerData },
        target: { ...targetData },
        attackerPlayerKey: pendingAttack.attackerPlayerKey,
        defenderPlayerKey: pendingAttack.defenderPlayerKey,
        targetPowerBonus: 0
    };

    if (attackerData.cardType === "leader") {
        attackerPlayer.leaderAttacksThisTurn =
            Number(attackerPlayer.leaderAttacksThisTurn || 0) + 1;
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

    CardEffects.resolveWhenOpponentAttacksStageEffects(
        gameState,
        defenderPlayer,
        ui
    ).forEach(result => {
        addGameLog(result.message);
    });

    resolveWhenAttackingEffectsBeforeBattle(
        attackerPlayer,
        attackerData,
        () => {
            showResolveAttackButton(currentAttack.defenderPlayerKey, () => {
                resolveCurrentAttack();
            });
        }
    );
}

function resolveWhenAttackingEffectsBeforeBattle(attackerPlayer, attackerData, onComplete) {
    const attackerCard = getBoardCardFromData(attackerData);

    CardEffects.resolveWhenAttackingEffects(
        gameState,
        attackerPlayer,
        attackerData,
        ui
    ).forEach(result => {
        addGameLog(result.message);
    });

    const trashEffect = attackerCard?.effects?.find(effect => {
        return effect.type === "whenAttacking" && effect.actionId === "trashOneCard";
    });

    if (trashEffect) {
        promptTrashOneCardForAttack(attackerPlayer, attackerCard, trashEffect, onComplete);
        return;
    }

    if (typeof onComplete === "function") {
        onComplete();
    }
}

function promptTrashOneCardForAttack(player, sourceCard, effect, onComplete) {
    if (!player || !sourceCard || !effect) {
        if (typeof onComplete === "function") {
            onComplete();
        }

        return;
    }

    if (player.hand.length === 0) {
        addGameLog(`${player.name} has no cards in hand to trash for ${sourceCard.name}'s When Attacking effect.`);

        if (typeof onComplete === "function") {
            onComplete();
        }

        return;
    }

    const playerKey = player === gameState.player1 ? "player1" : "player2";

    pendingTrashChoice = {
        playerKey,
        sourceCardName: sourceCard.name,
        effectId: effect.id,
        onComplete
    };

    highlightTrashChoiceTargets(playerKey);

    addGameLog(`${player.name}: choose 1 card from hand to trash for ${sourceCard.name}'s When Attacking effect.`);
}

function highlightTrashChoiceTargets(playerKey) {
    clearTrashChoiceTargets();

    document
        .querySelectorAll(`.hand-card.selectable-card[data-player="${playerKey}"]`)
        .forEach(cardElement => {
            cardElement.classList.add("trash-choice-card");
        });
}

function clearTrashChoiceTargets() {
    document.querySelectorAll(".trash-choice-card").forEach(cardElement => {
        cardElement.classList.remove("trash-choice-card");
    });
}

function handlePendingTrashChoice(playerKey, cardInstanceId) {
    if (!pendingTrashChoice) return;

    if (playerKey !== pendingTrashChoice.playerKey) {
        addGameLog("Choose a card from the attacking player's hand.");
        return;
    }

    const player = gameState[playerKey];

    if (!player) return;

    const handIndex = findHandCardIndexByInstanceId(player, cardInstanceId);

    if (handIndex === -1) {
        addGameLog("Selected card could not be found.");
        return;
    }

    const trashedCard = player.hand.splice(handIndex, 1)[0];
    const onComplete = pendingTrashChoice.onComplete;
    const sourceCardName = pendingTrashChoice.sourceCardName;

    moveCardToTrash(player, trashedCard, ui);

    pendingTrashChoice = null;
    clearTrashChoiceTargets();
    clearHandSelection();

    ui.renderHands();
    ui.renderTrash();

    addGameLog(`${player.name} trashed ${trashedCard.name} for ${sourceCardName}'s When Attacking effect.`);

    if (typeof onComplete === "function") {
        onComplete();
    }

    ui.renderHands();
}

function resolveCurrentAttack() {
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
        clearBlockerTargets();
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

    let battleResultText = attackerWins
        ? `${attackerCard.name} wins the battle.`
        : `${attackerCard.name} loses the battle.`;

    if (attackerWins && currentAttack.target.cardType === "character") {
        const koResult = KOCharacter(
            defenderPlayer,
            currentAttack.target.slotIndex,
            ui
        );

        battleResultText += `<br>${koResult.message}`;
    }

    if (attackerWins && currentAttack.target.cardType === "leader") {
        if (defenderPlayer.life.length === 0) {
            gameWinner = attackerPlayer;
            battleResultText += `<br>${defenderPlayer.name} has no life cards left.`;
            battleResultText += `<br>${attackerPlayer.name} wins the game.`;
        } else {
            const damageAmount = CardEffects.getLeaderDamageAmount(attackerCard);

            const lifeResult = CardEffects.shouldBanishLife(attackerCard)
                ? banishLifeDamage(defenderPlayer, damageAmount, ui)
                : takeLifeDamage(defenderPlayer, damageAmount, ui);

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
    clearBlockerTargets();
    clearBattleControls();
    clearAttackArrow();

    renderLeaders();
    renderCharacters();

    if (gameWinner) {
        endGame(
            gameWinner,
            "Final Attack",
            `${defenderPlayer.name} had no life cards left and took a successful leader attack.`
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
        isCharacterPlayedThisTurn(player, card) &&
        !CardEffects.canAttackOnTurnPlayed(card) &&
        !CardEffects.canAttackCharactersOnTurnPlayed(card)
    ) {
        return false;
    }

    const cardState = card.state || "active";

    if (cardState !== "active") {
        return false;
    }

    return true;
}

function getBoardActionButtonContainer() {
    if (!selectedBoardCard || !selectedBoardCardData) return null;

    if (selectedBoardCardData.cardType === "leader") {
        return selectedBoardCard.closest(".leader-area");
    }

    if (selectedBoardCardData.cardType === "character") {
        return selectedBoardCard.closest(".character-slot");
    }

    return null;
}

function getOpponentPlayerKey(playerKey) {
    return playerKey === "player1" ? "player2" : "player1";
}

function isCharacterPlayedThisTurn(player, card) {
    if (!player || !card) {
        return false;
    }

    return card.cardType === "character" && card.playedOnTurn === player.turns;
}

function getCardBattlePower(card, player = null) {
    if (!card) {
        return 0;
    }

    return getPrintedPower(card) + getPowerModifier(card, player);
}

function getPrintedPower(card) {
    return Number(card?.power ?? 0);
}

function getPowerModifier(card, player = null) {
    if (!card) {
        return 0;
    }

    return getYourTurnPowerBonus(card, player) +
        getTurboGrannyFormPowerModifier(card, player) +
        getOpponentTurnPowerModifier(card, player) +
        getTokenAttachedPowerModifier(card);
}

function getYourTurnPowerBonus(card, player) {
    if (!card || !player) {
        return 0;
    }

    if (gameState.currentPlayer !== player) {
        return 0;
    }

    const leaderPowerEffect = card.effects?.find(effect => {
        return effect.type === "yourTurn" && effect.actionId === "leaderPowerPerCharacter";
    });

    if (!leaderPowerEffect) {
        return 0;
    }

    return player.characters.filter(Boolean).length * 1000;
}

function getTurboGrannyFormPowerModifier(card, player) {
    if (!card || !player || !player.stage) {
        return 0;
    }

    if (card.cardType !== "leader" && card.cardType !== "character") {
        return 0;
    }

    if (!CardEffects.hasCardName(player.stage, "Turbo Granny Form")) {
        return 0;
    }

    if (!CardEffects.hasCardName(card, "Okarun")) {
        return 0;
    }

    return player.stage.effects
        ?.filter(effect => {
            return effect.type === "continuous" &&
                effect.id === "DD01-002-your-turn-power";
        })
        .reduce((total, effect) => {
            return total + Number(effect.powerModifier ?? 0);
        }, 0) ?? 0;
}

function getOpponentTurnPowerModifier(card, player) {
    if (!card || !player) {
        return 0;
    }

    if (gameState.currentPlayer === player) {
        return 0;
    }

    return card.effects
        ?.filter(effect => effect.type === "opponentsTurn")
        .reduce((total, effect) => {
            return total + Number(effect.powerModifier ?? 0);
        }, 0) ?? 0;
}

function getTokenAttachedPowerModifier(card) {
    if (!card) {
        return 0;
    }

    const attachedDon = Number(card.attachedDon ?? 0);

    return card.effects
        ?.filter(effect => effect.type === "tokenAttached")
        .reduce((total, effect) => {
            const requiredTokens = Number(effect.requiredTokens ?? 0);

            if (attachedDon < requiredTokens) {
                return total;
            }

            return total + Number(effect.powerModifier ?? 0);
        }, 0) ?? 0;
}

function renderPowerModifierBadge(card, player, container, boardCardData = null) {
    if (!card || !container) {
        return;
    }

    const modifier = getPowerModifier(card, player) +
        getCurrentAttackTargetPowerBonus(boardCardData);

    if (modifier === 0) {
        return;
    }

    const badge = document.createElement("div");
    const sign = modifier > 0 ? "+" : "";
    const printedPower = getPrintedPower(card);
    const currentPower = printedPower + modifier;

    badge.className = modifier > 0
        ? "power-modifier-badge power-modifier-positive"
        : "power-modifier-badge power-modifier-negative";

    badge.textContent = `${sign}${modifier}`;
    badge.title = `Current power: ${currentPower} (${printedPower} ${sign}${modifier})`;

    container.appendChild(badge);
}

function getCurrentAttackTargetPowerBonus(boardCardData) {
    if (!currentAttack || !boardCardData) {
        return 0;
    }

    if (!isSameBoardCard(currentAttack.target, boardCardData)) {
        return 0;
    }

    return Number(currentAttack.targetPowerBonus || 0);
}

function isSameBoardCard(firstCardData, secondCardData) {
    if (!firstCardData || !secondCardData) {
        return false;
    }

    if (firstCardData.playerKey !== secondCardData.playerKey) {
        return false;
    }

    if (firstCardData.cardType !== secondCardData.cardType) {
        return false;
    }

    if (firstCardData.cardType === "character") {
        return Number(firstCardData.slotIndex) === Number(secondCardData.slotIndex);
    }

    return true;
}

function getBoardActionButtonContainerFromData(boardCardData) {
    if (!boardCardData) return null;

    if (boardCardData.cardType === "leader") {
        const leaderElement = document.querySelector(
            `.board-leader-card[data-player="${boardCardData.playerKey}"]`
        );

        return leaderElement?.closest(".leader-area") ?? null;
    }

    if (boardCardData.cardType === "character") {
        const characterElement = document.querySelector(
            `.board-character-card[data-player="${boardCardData.playerKey}"][data-character-slot="${boardCardData.slotIndex}"]`
        );

        return characterElement?.closest(".character-slot") ?? null;
    }

    return null;
}

// =========================
// General Helpers
// =========================

function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
}
