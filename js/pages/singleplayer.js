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
        renderStages,
        lookTopCardsAddToHand,
        chooseLifeCard: showLifeCardChoice,
        chooseBoardCard: showBoardCardChoice,
        chooseEffectActivation,
        chooseEffectOption,
        chooseNumberValue,
        beginDeferredCombatResolution: () => {
            pendingDeferredCombatChoices += 1;
        },
        endDeferredCombatResolution: () => {
            pendingDeferredCombatChoices = Math.max(0, pendingDeferredCombatChoices - 1);

            if (pendingDeferredCombatChoices === 0 && typeof deferredCombatContinuation === "function") {
                const continueCombat = deferredCombatContinuation;

                deferredCombatContinuation = null;
                continueCombat();
            }
        },
        hasDeferredCombatResolution: () => pendingDeferredCombatChoices > 0,
        deferCombatContinuation: (continuation) => {
            if (pendingDeferredCombatChoices > 0) {
                deferredCombatContinuation = continuation;
                return true;
            }

            return false;
        },
        revealCards: () => {}
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

    if (availableBlockers.length === 0 && window.isGameSettingEnabled?.("autoSkipBlock")) {
        skipCurrentBlockStep(defenderPlayerKey, onResolve);
        return;
    }

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

async function handleBlockerSelection(playerKey, slotIndex) {
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

    if (!restBoardCard(blockerData)) {
        addGameLog(`${blockerCard.name} cannot be rested and cannot block.`);
        return;
    }

    drawAttackArrow(currentAttack.attacker, currentAttack.target);

    clearBlockerTargets();

    pendingBlock = null;

    addGameLog(`${defenderPlayer.name} blocked the attack with ${blockerCard.name}.`);

    const onBlockMessage = resolveOnBlockEffects(defenderPlayer, blockerCard, ui);

    if (onBlockMessage) {
        addGameLog(onBlockMessage);
    }

    const whenAttackedEffect = getWhenAttackedEffect(blockerCard);

    if (whenAttackedEffect) {
        const whenAttackedMessage = resolveKillerCharacterWhenAttacked(defenderPlayer, blockerCard, ui, {
            onComplete: () => {
                startCounterPhase(playerKey, () => {
                    resolveCurrentAttack();
                });
            }
        });

        if (whenAttackedMessage) {
            addGameLog(whenAttackedMessage);
        }

        return;
    }

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

function showSubaruResetOverlay(message = "Game being reset...") {
    removeSubaruResetOverlay();

    const overlay = document.createElement("div");
    overlay.className = "look-top-overlay";
    overlay.id = "subaruResetOverlay";

    const popup = document.createElement("div");
    popup.className = "look-top-popup effect-choice-popup";

    const heading = document.createElement("h2");
    heading.textContent = "Checkpoint Reset";

    const text = document.createElement("p");
    text.textContent = message;

    popup.appendChild(heading);
    popup.appendChild(text);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

function removeSubaruResetOverlay() {
    const oldOverlay = document.getElementById("subaruResetOverlay");

    if (oldOverlay) {
        oldOverlay.remove();
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
        /is choosing a blocker\./i,
        /may choose a blocker or skip blocking\./i,
        /has no available blockers\./i,
        /may use counter cards or resolve the attack\./i,
        /cannot attach don!! right now\./i,
        /is attacking with .+ choose a target\./i,
        /^choose a card from the attacking player's hand\.$/i,
        /skipped .+ effect\./i
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
        : "Finish current effect or combat step before sorting this hand.";
}

function canSortPlayerHand(player) {
    if (!player) {
        return false;
    }

    if (
        pendingReplacePlay ||
        pendingAttack ||
        currentAttack ||
        pendingBlock ||
        pendingTrashChoice
    ) {
        return false;
    }

    return !document.getElementById("lookTopOverlay") &&
        !document.getElementById("boardChoiceOverlay") &&
        !document.getElementById("effectChoiceOverlay");
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
    previewImage.hidden = false;
    previewImage.style.display = "block";
    previewPlaceholder.style.display = "none";
}

function clearCardPreview() {
    const previewImage = document.getElementById("previewImage");
    const previewPlaceholder = document.getElementById("previewPlaceholder");

    if (!previewImage || !previewPlaceholder) return;

    previewImage.src = "";
    previewImage.hidden = true;
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

    const cardCost = getCardPlayCost(card, player);
    const canAfford = canPlayerAffordCard(player, card);
    const openSlotIndex = getFirstOpenCharacterSlotIndex(player);
    const canPlayNow = canPlayerPlayCards(player);
    const canPlayEventMain = card.cardType !== "event" || canPlayEventInMainPhase(card);

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
        playButton.title = `${card.name} does not have a Main effect, so it cannot be played during the main phase.`;
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

            if (pendingBlock) {
                handleBlockerSelection(playerKey, slotIndex);
                return;
            }

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
    const activateMainEffect = getActivateMainEffect(card);
    const activateAnyEffect = getActivateAnyEffect(card);

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
        } else if (selectedBoardCardData.cardType === "leader" && doesStagePreventLeaderAttacks(player)) {
            attackButton.textContent = "Locked";
            attackButton.title = `${player.stage.name} prevents ${player.name}'s leader from attacking.`;
        } else if (selectedBoardCardData.cardType === "character" && isCharacterPlayedThisTurn(player, card) && !CardEffects.canAttackOnTurnPlayed(card) && !CardEffects.canAttackCharactersOnTurnPlayed(card)) {
            attackButton.textContent = "New";
            attackButton.title = `${card.name} cannot attack on the turn it was played.`;
        } else if ((selectedBoardCardData.cardType === "leader" || selectedBoardCardData.cardType === "character") && typeof canCardBeRested === "function" && !canCardBeRested(card)) {
            attackButton.textContent = "Locked";
            attackButton.title = `${card.name} cannot be rested due to an effect.`;
        } else if (selectedBoardCardData.cardType === "character" && isCharacterAttackLocked(card, player)) {
            attackButton.textContent = "Locked";
            attackButton.title = `${card.name} cannot attack due to an effect.`;
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

    if (activateMainEffect) {
        const activateMainButton = createActivateMainButton(
            player,
            card,
            activateMainEffect
        );

        actionButtons.push(activateMainButton);
    }

    if (activateAnyEffect) {
        actionButtons.push(createActivateAnyButton(player, card, activateAnyEffect));
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

function getActivateMainEffect(card) {
    return card?.effects?.find(effect => {
        if (effect.id === "SUB1-001-checkpoint") {
            return false;
        }

        return effect.type === "activateMain";
    }) || null;
}

function getActivateAnyEffect(card) {
    return getCardAllEffects(card)?.find(effect => effect.id === "SUB1-001-checkpoint") || null;
}

function getOnOpponentAttackEffect(card) {
    return getCardAllEffects(card)?.find(effect => {
        return effect.type === "onOpponentAttack" ||
            effect.type === "onOpponentsAttack";
    }) || null;
}

function getWhenAttackedEffect(card) {
    return getCardAllEffects(card)?.find(effect => effect.type === "whenAttacked") || null;
}

function isWanoCountryAttachDonEffect(card, effect) {
    const effectText = String(effect?.text || "");

    return effect?.id === "YAM1-004-activate-main-attach-don" || (
        effect?.type === "activateMain" &&
        String(card?.name || "").trim().toLowerCase() === "wano country" &&
        effectText.includes("Attach up to 1 rested DON!! to 1 of your Characters.")
    );
}

function isBoardEffectResolutionInProgress() {
    return Boolean(
        pendingReplacePlay ||
        pendingAttack ||
        currentAttack ||
        pendingBlock ||
        pendingTrashChoice ||
        document.getElementById("subaruResetOverlay") ||
        document.getElementById("lookTopOverlay") ||
        document.getElementById("boardChoiceOverlay") ||
        document.getElementById("effectChoiceOverlay")
    );
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

    if (
        effect.oncePerGame &&
        CardEffects.hasUsedOncePerGameEffect(card, effect.id)
    ) {
        return false;
    }

    if (effect.id === "JK01-011-activate-main") {
        if ((card.state || "active") === "rested") {
            return false;
        }

        if (player.leader?.cardNumber !== "JK01-001") {
            return false;
        }
    }

    if (effect.id === "YAM1-001-activate-main-life") {
        return typeof getAceYamatoLeaderKOTargetChoices === "function" &&
            getAceYamatoLeaderKOTargetChoices(player).length >= 2;
    }

    if (effect.id === "SUB1-007-activate-main-stage-copy") {
        return Boolean(player.life?.length) &&
            Boolean(player.stage) &&
            typeof getSubaruStageEffect === "function" &&
            Boolean(getSubaruStageEffect(player));
    }

    if (effect.id === "KIL1-001-activate-main") {
        return Number(card?.attachedDon || 0) >= 1;
    }

    if (isWanoCountryAttachDonEffect(card, effect)) {
        return player.restedDon >= 1 &&
            player.characters.some(card => card?.cardType === "character");
    }

    if (effect.id === "OP16-098-activate-main-play-yamato") {
        return player.trash.some(card => {
            return card?.cardType === "character" &&
                card.color === "black" &&
                CardEffects.hasCardName(card, "Yamato") &&
                getCardEffectiveCost(card) === 8;
        });
    }

    if (effect.id === "PRB02-016-activate-main-power") {
        return (card.state || "active") === "active" &&
            typeof canCardBeRested === "function" &&
            canCardBeRested(card) &&
            (player.life?.length || 0) > 0;
    }

    if (effect.id === "ST28-004-activate-main-rush") {
        return getTotalAttachedDonCount(player) >= 2;
    }

    if (effect.id === "JK02-001-activate-main") {
        return player.characters.some(card => {
            return card?.cardType === "character" &&
                (card.state || "active") === "rested";
        });
    }

    if (effect.id === "JK02-010-activate-main") {
        return getOpponentCharacterChoices(player, card => {
            return getCardEffectiveCost(card) <= 4 &&
                (card.state || "active") === "active";
        }).length > 0;
    }

    if (effect.id === "JK02-016-activate-main") {
        return Number(card?.playedOnTurn ?? -1) === Number(player?.turns ?? -2);
    }

    if (effect.id === "JK02-018-activate-main") {
        const restedCharacters = player.characters.filter(card => {
            return card?.cardType === "character" &&
                (card.state || "active") === "rested";
        });

        return restedCharacters.length >= 3 && Number(player.restedDon || 0) > 0;
    }

    if (effect.id === "JK02-012-activate-main") {
        return getOpponentCharacterChoices(player, card => getCardEffectiveCost(card) <= 0).length > 0;
    }

    if (effect.id === "JK02-015-activate-main") {
        return player.hand.length > 0 &&
            player.characters.some(card => {
                return card?.cardType === "character" &&
                    hasTypeText(card, "Curse Spirit") &&
                    getCardEffectiveCost(card) <= 3;
            });
    }

    if (effect.id === "JK02-020-activate-main") {
        return player.hand.length >= 2 &&
            getOpponentCharacterChoices(player, () => true).length > 0;
    }

    return true;
}

function canUseActivateAnyEffect(player, card, effect) {
    if (!player || !card || !effect) {
        return false;
    }

    if (effect.id !== "SUB1-001-checkpoint") {
        return false;
    }

    if (gameState.currentPhase === "gameOver" || gameState.currentPhase === "diceRoll" || gameState.currentPhase === "mulligan") {
        return false;
    }

    if (isBoardEffectResolutionInProgress()) {
        return false;
    }

    if (effect.oncePerGame && CardEffects.hasUsedOncePerGameEffect(card, effect.id)) {
        return false;
    }

    return Boolean(gameState?.subaruCheckpointState);
}

function createBoardEffectButton(player, card, effect, options = {}) {
    const actionButton = document.createElement("button");
    const activationLabel = options.activationLabel || "Activate: Main";
    const canUseEffect = typeof options.canUseEffect === "function"
        ? options.canUseEffect
        : canUseActivateMainEffect;

    actionButton.className = "board-action-button-on-card activate-main-button";
    actionButton.textContent = activationLabel;

    if (!canUseEffect(player, card, effect)) {
        actionButton.disabled = true;

        if (effect.id === "SUB1-001-checkpoint") {
            if (effect.oncePerGame && CardEffects.hasUsedOncePerGameEffect(card, effect.id)) {
                actionButton.title = "This Once Per Game effect has already been used.";
            } else if (!gameState?.subaruCheckpointState) {
                actionButton.title = "No checkpoint has been set yet.";
            } else if (isBoardEffectResolutionInProgress()) {
                actionButton.title = "This effect cannot be activated while another effect is resolving.";
            } else {
                actionButton.title = "This effect cannot be activated right now.";
            }
        } else if (gameState.currentPhase !== "main") {
            actionButton.title = "Activate: Main effects can only be used during the Main Phase.";
        } else if (gameState.currentPlayer !== player) {
            actionButton.title = `It is currently ${gameState.currentPlayer?.name ?? "another player"}'s turn.`;
        } else if (effect.oncePerTurn && CardEffects.hasUsedOncePerTurnEffect(card, effect.id, player.turns)) {
            actionButton.title = "This Once Per Turn effect has already been used this turn.";
        } else if (effect.oncePerGame && CardEffects.hasUsedOncePerGameEffect(card, effect.id)) {
            actionButton.title = "This Once Per Game effect has already been used.";
        } else {
            actionButton.title = "This effect cannot be activated right now.";
        }
    }

    actionButton.addEventListener("click", async (event) => {
        event.stopPropagation();

        if (actionButton.disabled) return;

        await activateBoardEffect(player, card, effect, {
            activationLabel,
            canUseEffect
        });
    });

    return actionButton;
}

function createActivateMainButton(player, card, effect) {
    const activateMainButton = createBoardEffectButton(player, card, effect, {
        activationLabel: "Activate: Main",
        canUseEffect: canUseActivateMainEffect
    });

    return activateMainButton;
}

function createActivateAnyButton(player, card, effect) {
    return createBoardEffectButton(player, card, effect, {
        activationLabel: "Activate: Any",
        canUseEffect: canUseActivateAnyEffect
    });
}

async function activateBoardEffect(player, card, effect, options = {}) {
    const activationLabel = options.activationLabel || "Activate: Main";
    const canUseEffect = typeof options.canUseEffect === "function"
        ? options.canUseEffect
        : canUseActivateMainEffect;

    if (!canUseEffect(player, card, effect)) {
        addGameLog(`${card.name}'s ${activationLabel} effect cannot be used right now.`);
        return;
    }

    if (typeof isOptionalEffect === "function" && isOptionalEffect(effect)) {
        chooseEffectActivation({
            player,
            sourceCard: card,
            effect,
            title: card.name,
            prompt: `${effect.text || "Activate this effect?"}`,
            activateText: "Activate",
            skipText: "Skip",
            onComplete: async (shouldActivate) => {
                if (!shouldActivate) {
                    addGameLog(`${player.name} skipped ${card.name}'s ${activationLabel} effect.`);
                    showSelectedBoardActions();
                    return;
                }

                await resolveBoardEffectActivation(player, card, effect, options);
            }
        });

        return;
    }

    await resolveBoardEffectActivation(player, card, effect, options);
}

async function resolveBoardEffectActivation(player, card, effect, options = {}) {
    const activationLabel = options.activationLabel || "Activate: Main";
    let result = null;

    if (effect.id === "SUB1-001-checkpoint") {
        showSubaruResetOverlay();
        await new Promise(resolve => window.setTimeout(resolve, 3000));
    }

    try {
        result = resolveBoardActionEffect(player, card, effect);
    } finally {
        if (effect.id === "SUB1-001-checkpoint") {
            removeSubaruResetOverlay();
        }
    }

    if (!result.success) {
        addGameLog(result.message);
        return;
    }

    if (effect.oncePerTurn) {
        CardEffects.markOncePerTurnEffectUsed(card, effect.id, player.turns);
    }

    if (effect.oncePerGame) {
        CardEffects.markOncePerGameEffectUsed(card, effect.id);
    }

    addGameLog(`${player.name} activated ${card.name}'s ${activationLabel} effect. ${result.message}`);

    showSelectedBoardActions();
}

function resolveBoardActionEffect(player, card, effect) {
    if (effect.id === "YAM1-001-activate-main-life") {
        return resolveAceYamatoLeaderActivateMain(player, card, ui);
    }

    if (effect.id === "SUB1-001-checkpoint") {
        return resolveSubaruLeaderActivateMain(player, card, ui);
    }

    if (effect.id === "SUB1-007-activate-main-stage-copy") {
        return resolveEchidnaActivateMain(player, card, ui);
    }

    if (effect.id === "KIL1-001-activate-main") {
        return resolveKillerLeaderActivateMain(player, card, ui);
    }

    if (isWanoCountryAttachDonEffect(card, effect)) {
        return resolveWanoCountryActivateMain(player, card, ui);
    }

    if (effect.id === "OP16-098-activate-main-play-yamato") {
        return resolveBlackYamatoActivateMain(player, card, ui);
    }

    if (effect.id === "PRB02-016-activate-main-power") {
        return resolveOtamaActivateMain(player, card, ui);
    }

    if (effect.id === "ST28-004-activate-main-rush") {
        return resolveSt28MomonosukeActivateMain(player, card, ui);
    }

    if (effect.id === "JK02-001-activate-main") {
        return resolveHanamiLeaderActivateMain(player, card, ui);
    }

    if (effect.id === "JK02-010-activate-main") {
        return resolveRopongiCurseActivateMain(player, card, ui);
    }

    if (effect.id === "JK02-016-activate-main") {
        return resolveJogoActivateMain(player, card, ui);
    }

    if (effect.id === "JK02-018-activate-main") {
        return resolveGrasshopperCurseActivateMain(player, card, ui);
    }

    if (effect.id === "JK02-012-activate-main") {
        return {
            success: true,
            message: chooseOpponentCharacter(player, card, {
                prompt: "Choose up to 1 opposing Character with a cost of 0 to K.O.",
                optional: true,
                filter: targetCard => getCardEffectiveCost(targetCard) <= 0,
                onSelect: ({ playerKey, slotIndex }) => {
                    addGameLog(removeCharacterByOpponentEffect(player, gameState[playerKey], slotIndex, card, ui));
                },
                skipMessage: `${player.name} did not K.O. a Character with ${card.name}.`,
                emptyMessage: `${card.name} found no opposing Characters with a cost of 0.`
            }) || `${card.name}'s effect resolved.`
        };
    }

    if (effect.id === "JK02-015-activate-main") {
        return resolveMahitoActivateMain(player, card, ui);
    }

    if (effect.id === "JK02-020-activate-main") {
        return resolveKurourushiActivateMain(player, card, ui);
    }

    if (effect.id === "POG1-006-activate-main") {
        if (player.leader?.cardNumber !== "POG1-001") {
            return {
                success: false,
                message: `${card.name}'s effect requires David Taglavnovič as your leader.`
            };
        }

        const sourceSlotIndex = player.characters.findIndex(character => character?.instanceId === card.instanceId);
        const openSlotIndex = getFirstOpenCharacterSlotIndex(player);

        if (openSlotIndex === -1 && sourceSlotIndex === -1) {
            return {
                success: false,
                message: `${player.name}'s character area is full.`
            };
        }
    }

    if (effect.id === "POG1-013-activate-main" && player.trash.length < 2) {
        return {
            success: false,
            message: `${card.name} needs at least 2 cards in trash.`
        };
    }

    if (effect.id === "JK01-011-activate-main") {
        if ((card.state || "active") === "rested") {
            return {
                success: false,
                message: `${card.name} is already rested.`
            };
        }

        if (player.leader?.cardNumber !== "JK01-001") {
            return {
                success: false,
                message: `${card.name}'s effect requires Hiromi Higuruma as your leader.`
            };
        }

        if (!setCardRested(card)) {
            return {
                success: false,
                message: `${card.name} cannot be rested due to an effect.`
            };
        }

        const milledCards = [];

        for (let index = 0; index < 2; index++) {
            const topCard = player.deck.shift();

            if (!topCard) {
                break;
            }

            const trashedCard = assignCardInstance(topCard);
            moveCardToTrash(player, trashedCard, ui);
            milledCards.push(trashedCard);
        }

        renderStages();
        renderDecks();
        renderTrash();

        const drawTrashMessage = resolveDrawOneTrashOne(player, card, ui);
        const millMessage = milledCards.length > 0
            ? `${player.name} trashed ${milledCards.length} card${milledCards.length === 1 ? "" : "s"} from the top of the deck.`
            : `${player.name} had no cards in deck to trash.`;

        return {
            success: true,
            message: `${millMessage} ${drawTrashMessage}`.trim()
        };
    }

    if (effect.actionId === "drawOneCard") {
        const drawResult = drawCard(player, ui);

        return {
            success: !drawResult?.deckOut,
            message: drawResult?.deckOut
                ? `${player.name} could not draw a card.`
                : `${player.name} drew 1 card.`
        };
    }

    if (effect.id === "DD01-015-activate-main-power") {
        if ((card.state || "active") === "rested") {
            return {
                success: false,
                message: `${card.name} is already rested.`
            };
        }

        if (!setCardRested(card)) {
            return {
                success: false,
                message: `${card.name} cannot be rested due to an effect.`
            };
        }
        renderCharacters();

        const message = chooseOwnBoardCard(player, card, {
            prompt: "Choose up to 1 Ayase Seiko or Okarun to give +3000 power for its next battle.",
            optional: true,
            includeLeader: true,
            filter: targetCard => {
                return CardEffects.hasCardName(targetCard, "Ayase Seiko") ||
                    CardEffects.hasCardName(targetCard, "Okarun");
            },
            onSelect: ({ card: targetCard }) => {
                addBattlePowerBonus(targetCard, Number(effect.powerModifier ?? 3000));
                renderLeaders();
                renderCharacters();
                addGameLog(`${card.name} gave ${targetCard.name} +3000 power for its next battle.`);
            },
            skipMessage: `${player.name} rested ${card.name} but did not choose a target.`,
            emptyMessage: `${card.name} found no Ayase Seiko or Okarun cards.`
        });

        renderCharacters();

        return {
            success: true,
            message
        };
    }

    if (
        effect.id === "EGG1-002-activate-main-copy" ||
        effect.id === "EGG1-006-activate-main-base-power" ||
        effect.id === "EGG1-008-activate-main-trash-power"
    ) {
        if (effect.id === "EGG1-002-activate-main-copy") {
            const copyChoices = getOpponentBoardChoices(player, {
                includeLeader: true,
                filter: targetCard => getCopyableEffects(targetCard).length > 0
            });

            if (copyChoices.length === 0) {
                return {
                    success: false,
                    message: `${card.name} found no opposing leader or character abilities to copy.`
                };
            }
        }

        if (effect.id === "EGG1-006-activate-main-base-power") {
            const ownEggmanCharacters = getOwnBoardChoices(player, {
                includeLeader: false,
                filter: targetCard => targetCard.cardType === "character" && hasTypeText(targetCard, "Eggman Empire")
            });
            const opponentCharacters = getOpponentCharacterChoices(player);

            if (ownEggmanCharacters.length === 0 || opponentCharacters.length === 0) {
                return {
                    success: false,
                    message: `${card.name} needs one of your Eggman Empire characters and one opposing character.`
                };
            }
        }

        if (effect.id === "EGG1-008-activate-main-trash-power") {
            const otherCharacters = getOwnBoardChoices(player, {
                includeLeader: false,
                filter: targetCard => targetCard.cardType === "character" && targetCard.instanceId !== card.instanceId
            });

            if (otherCharacters.length === 0) {
                return {
                    success: false,
                    message: `${card.name} needs another character to trash.`
                };
            }
        }
        const message = resolveEffectAction(player, card, effect, ui, {
            skipActivationPrompt: true
        });

        return {
            success: Boolean(message),
            message: message || `${card.name}'s effect is not implemented yet.`
        };
    }

    const message = resolveEffectAction(player, card, effect, ui, {
        skipActivationPrompt: true
    });

    if (message) {
        return {
            success: true,
            message
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

    if (gameState.currentPhase === "counterPhase" || !pendingBlock) {
        return;
    }

    const skipBlockButton = createSkipBlockButton(() => {
        skipCurrentBlockStep(defenderPlayerKey, onResolve);
    });

    battleControls.appendChild(skipBlockButton);
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

    const continueAfterDefenderResponses = () => {
        resolveWhenAttackingEffectsBeforeBattle(
            attackerPlayer,
            attackerData,
            () => {
                showResolveAttackButton(currentAttack.defenderPlayerKey, () => {
                    resolveCurrentAttack();
                });
            }
        );
    };

    CardEffects.resolveWhenOpponentAttacksStageEffects(
        gameState,
        defenderPlayer,
        ui
    ).forEach(result => {
        addGameLog(result.message);
    });

    promptOnOpponentAttackCharacterEffects(defenderPlayer, continueAfterDefenderResponses);
}

function promptOnOpponentAttackCharacterEffects(defenderPlayer, onComplete) {
    const playerKey = defenderPlayer === gameState.player1 ? "player1" : "player2";

    const endAttackBecauseTargetLeftField = (cardName) => {
        addGameLog(`${cardName} left the field, so the attack ends.`);

        currentAttack = null;
        pendingAttack = null;
        pendingBlock = null;

        clearAttackTargets();
        clearBlockerTargets();
        clearBattleControls();
        clearAttackArrow();

        gameState.currentPhase = "main";
    };

    const effects = [];
    const targetSlotIndex = currentAttack?.target?.cardType === "character" &&
        currentAttack?.target?.playerKey === playerKey
        ? currentAttack.target.slotIndex
        : -1;
    const attackedCharacter = targetSlotIndex >= 0
        ? defenderPlayer.characters[targetSlotIndex]
        : null;
    const whenAttackedEffect = getWhenAttackedEffect(attackedCharacter);

    if (
        attackedCharacter &&
        whenAttackedEffect &&
        !CardEffects.hasUsedOncePerTurnEffect(attackedCharacter, whenAttackedEffect.id, defenderPlayer.turns)
    ) {
        effects.push({
            cardType: "character",
            slotIndex: targetSlotIndex,
            responseType: "whenAttacked"
        });
    }

    const leaderEffect = getOnOpponentAttackEffect(defenderPlayer.leader);

    if (defenderPlayer.leader && leaderEffect &&
            (!canUseOnOpponentAttackEffect || canUseOnOpponentAttackEffect(defenderPlayer, defenderPlayer.leader, leaderEffect))) {
        effects.push({
            cardType: "leader"
        });
    }

    defenderPlayer.characters
        .map((card, slotIndex) => ({ card, slotIndex }))
        .filter(entry => {
            const effect = getOnOpponentAttackEffect(entry.card);
            return effect &&
                (!canUseOnOpponentAttackEffect || canUseOnOpponentAttackEffect(defenderPlayer, entry.card, effect));
        })
        .forEach(entry => {
            effects.push({
                cardType: "character",
                slotIndex: entry.slotIndex
            });
        });

    const promptNext = (index) => {
        const entry = effects[index];

        if (!entry) {
            if (typeof onComplete === "function") {
                onComplete();
            }

            return;
        }

        const currentCard = entry.cardType === "leader"
            ? defenderPlayer.leader
            : defenderPlayer.characters[entry.slotIndex];
        const effect = entry.responseType === "whenAttacked"
            ? getWhenAttackedEffect(currentCard)
            : getOnOpponentAttackEffect(currentCard);

        if (!currentCard || !effect) {
            promptNext(index + 1);
            return;
        }

        if (entry.responseType === "whenAttacked") {
            const message = resolveKillerCharacterWhenAttacked(defenderPlayer, currentCard, ui, {
                onComplete: () => promptNext(index + 1)
            });

            if (message) {
                addGameLog(message);
            }

            return;
        }

        chooseEffectActivation({
            player: defenderPlayer,
            sourceCard: currentCard,
            effect,
            title: currentCard.name,
            prompt: effect.text || "Activate this On Your Opponent's Attack effect?",
            activateText: "Activate",
            skipText: "Skip",
            onComplete: (shouldActivate) => {
                if (!shouldActivate) {
                    addGameLog(`${defenderPlayer.name} skipped ${currentCard.name}'s On Your Opponent's Attack effect.`);
                    promptNext(index + 1);
                    return;
                }

                if (effect.id === "JK01-001-on-opponent-attack") {
                    const message = resolveHiromiHigurumaLeaderOnOpponentAttack(defenderPlayer, currentCard, ui, {
                        onComplete: () => promptNext(index + 1)
                    });

                    if (message) {
                        addGameLog(message);
                    }

                    return;
                }

                if (effect.id === "KIL1-001-on-opponent-attack") {
                    const message = resolveKillerLeaderOnOpponentAttack(defenderPlayer, currentCard, ui, {
                        onComplete: () => promptNext(index + 1)
                    });

                    if (message) {
                        addGameLog(message);
                    }

                    return;
                }

                if (effect.id === "JK01-009-on-opponent-attack") {
                    const message = resolveTakakoUroOnOpponentAttack(defenderPlayer, currentCard, ui, {
                        onComplete: () => promptNext(index + 1)
                    });

                    if (message) {
                        addGameLog(message);
                    }

                    return;
                }

                if (effect.id === "IMU1-007-on-opponents-attack") {
                    const message = resolveImuOnOpponentAttack(defenderPlayer, currentCard, ui, {
                        onComplete: () => promptNext(index + 1)
                    });

                    if (message) {
                        addGameLog(message);
                    }

                    return;
                }

                if (effect.actionId === "trashThisDrawOne" && entry.cardType === "character") {
                    const trashResult = trashCharacterFromField(defenderPlayer, entry.slotIndex, ui, {
                        render: false
                    });
                    const trashedCard = trashResult.character;
                    const linkedStageMessage = trashResult.linkedStageMessage;

                    if (!trashedCard) {
                        addGameLog("That character could not be trashed.");
                        return;
                    }

                    drawCard(defenderPlayer, ui);

                    renderCharacters();
                    renderTrash();
                    renderHands();

                    addGameLog(
                        linkedStageMessage
                            ? `${defenderPlayer.name} trashed ${trashedCard.name} and drew 1 card. ${linkedStageMessage}`
                            : `${defenderPlayer.name} trashed ${trashedCard.name} and drew 1 card.`
                    );

                    if (
                        currentAttack?.target?.playerKey === playerKey &&
                        currentAttack.target.cardType === "character" &&
                        currentAttack.target.slotIndex === entry.slotIndex
                    ) {
                        endAttackBecauseTargetLeftField(trashedCard.name);
                        return;
                    }

                    promptNext(index + 1);
                    return;
                }

                const message = resolveEffectAction(defenderPlayer, currentCard, effect, ui, {
                    skipActivationPrompt: true
                });

                if (message) {
                    addGameLog(message);
                }

                promptNext(index + 1);
            }
        });
    };

    promptNext(0);
}

function resolveWhenAttackingEffectsBeforeBattle(attackerPlayer, attackerData, onComplete) {
    const attackerCard = getBoardCardFromData(attackerData);

    promptOptionalWhenAttackingEffects(attackerPlayer, attackerCard, () => {
        const continueAfterAttackEffects = () => {
            const trashEffect = attackerCard?.effects?.find(effect => {
                return effect.type === "whenAttacking" && effect.actionId === "trashOneCard";
            });

            if (trashEffect && !isAttackEffectSkipped(attackerCard, trashEffect.id)) {
                promptTrashOneCardForAttack(attackerPlayer, attackerCard, trashEffect, onComplete);
                return;
            }

            if (typeof onComplete === "function") {
                onComplete();
            }
        };

        CardEffects.resolveWhenAttackingEffects(
            gameState,
            attackerPlayer,
            attackerData,
            ui
        ).forEach(result => {
            addGameLog(result.message);
        });

        if (ui?.deferCombatContinuation?.(continueAfterAttackEffects)) {
            return;
        }

        continueAfterAttackEffects();
    });
}

function promptOptionalWhenAttackingEffects(player, sourceCard, onComplete) {
    const optionalEffects = getCardAllEffects(sourceCard)
        ?.filter(effect => {
            const isAttackPromptEffect = effect.type === "whenAttacking" || effect.id === "KIL1-007-custom";
            return isAttackPromptEffect && typeof isOptionalEffect === "function" && isOptionalEffect(effect);
        }) ?? [];

    const promptNext = (index) => {
        const effect = optionalEffects[index];

        if (!effect) {
            if (typeof onComplete === "function") {
                onComplete();
            }

            return;
        }

        chooseEffectActivation({
            player,
            sourceCard,
            effect,
            title: sourceCard.name,
            prompt: effect.text || "Activate this When Attacking effect?",
            activateText: "Activate",
            skipText: "Skip",
            onComplete: (shouldActivate) => {
                if (!shouldActivate) {
                    markAttackEffectSkipped(sourceCard, effect.id);
                    addGameLog(`${player.name} skipped ${sourceCard.name}'s When Attacking effect.`);
                }

                promptNext(index + 1);
            }
        });
    };

    promptNext(0);
}

function markAttackEffectSkipped(card, effectId) {
    if (!card || !effectId) return;

    if (!Array.isArray(card.skippedEffectIdsThisAttack)) {
        card.skippedEffectIdsThisAttack = [];
    }

    if (!card.skippedEffectIdsThisAttack.includes(effectId)) {
        card.skippedEffectIdsThisAttack.push(effectId);
    }
}

function isAttackEffectSkipped(card, effectId) {
    return Array.isArray(card?.skippedEffectIdsThisAttack) &&
        card.skippedEffectIdsThisAttack.includes(effectId);
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

async function handlePendingTrashChoice(playerKey, cardInstanceId) {
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
        clearBlockerTargets();
        clearBattleControls();
        clearAttackArrow();

        gameState.currentPhase = "main";

        return;
    }

    if (currentAttack.negated) {
        addGameLog(`
            ${defenderPlayer.name} resolved the attack.<br>
            ${attackerPlayer.name}'s attack with ${attackerCard.name} was negated by ${currentAttack.negatedBy || "a counter effect"}.
        `);

        clearBattleOnlyEffectsForCurrentAttack(attackerCard, targetCard);

        currentAttack = null;
        pendingAttack = null;
        pendingBlock = null;

        clearAttackTargets();
        clearBlockerTargets();
        clearBattleControls();
        clearAttackArrow();

        renderLeaders();
        renderCharacters();

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
            const lifeLossResult = loseByLifeDamage(
                defenderPlayer,
                `${defenderPlayer.name} took a direct attack with no life cards remaining.`
            );

            if (lifeLossResult.restoredByCheckpoint) {
                battleResultText += `<br>${defenderPlayer.name} would lose the game, but Subaru's checkpoint restored the saved zones.`;
            } else {
                gameWinner = attackerPlayer;
                battleResultText += `<br>${defenderPlayer.name} has no life cards left.`;
                battleResultText += `<br>${attackerPlayer.name} wins the game.`;
            }
        } else {
            const damageAmount = CardEffects.getLeaderDamageAmount(attackerCard);

            const shouldBanishLife = CardEffects.shouldBanishLife(attackerCard);
            const lifeResult = shouldBanishLife
                ? banishLifeDamage(defenderPlayer, damageAmount, ui)
                : takeLifeDamage(defenderPlayer, damageAmount, ui);

            battleResultText += `<br>${lifeResult.message}`;

            if (lifeResult.winnerPlayer) {
                gameWinner = lifeResult.winnerPlayer;
                gameOverTitle = lifeResult.reasonTitle || "Victory";
                gameOverText = lifeResult.reasonText || `${gameWinner.name} won after ${defenderPlayer.name}'s life hit 0.`;
                battleResultText += `<br>${gameWinner.name} wins the game.`;
            }

            if (lifeResult.success) {
                const upgradeMessage = resolveKurosakiIchigoDamageStageUpgrade(defenderPlayer, ui);

                if (upgradeMessage) {
                    battleResultText += `<br>${upgradeMessage}`;
                }

                const higurumaDamageResult = resolveHiromiHigurumaCharacterLeaderDamage(
                    attackerPlayer,
                    attackerCard,
                    defenderPlayer,
                    ui
                );

                if (higurumaDamageResult.message) {
                    battleResultText += `<br>${higurumaDamageResult.message}`;
                }

                if (higurumaDamageResult.winnerPlayer) {
                    gameWinner = higurumaDamageResult.winnerPlayer;
                    gameOverTitle = higurumaDamageResult.reasonTitle || "Victory";
                    gameOverText = higurumaDamageResult.reasonText || `${gameWinner.name} won after ${defenderPlayer.name}'s life hit 0.`;
                    battleResultText += `<br>${gameWinner.name} wins the game.`;
                }
            }
        }
    }

    addGameLog(`
        ${defenderPlayer.name} resolved the attack.<br>
        ${attackerPlayer.name}'s ${attackerCard.name}: ${attackerPower} power<br>
        ${defenderPlayer.name}'s ${targetCard.name}: ${targetPower} power${targetCounterBonus > 0 ? ` (${targetBasePower} + ${targetCounterBonus})` : ""}<br><br>
        ${battleResultText}
    `);

    clearBattleOnlyEffectsForCurrentAttack(attackerCard, targetCard);

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
            gameOverTitle,
            gameOverText
        );
        return;
    }

    gameState.currentPhase = "main";
}

function clearBattleOnlyEffectsForCurrentAttack(attackerCard, targetCard) {
    [
        gameState.player1.leader,
        ...gameState.player1.characters.filter(Boolean),
        gameState.player2.leader,
        ...gameState.player2.characters.filter(Boolean),
        attackerCard,
        targetCard
    ].filter(Boolean).forEach(card => {
        card.battlePowerBonus = 0;
        card.battleKeywords = [];
        card.skippedEffectIdsThisAttack = [];
    });
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
// Look Top Cards UI
// =========================

function lookTopCardsAddToHand({
    player,
    sourceCard,
    cards,
    isSelectable,
    onComplete,
    revealSelected = true,
    descriptionText = null,
    allowTopOrBottomPlacement = false,
    maxSelectable = 1
}) {
    removeLookTopOverlay();

    const overlay = document.createElement("div");
    overlay.className = "look-top-overlay";
    overlay.id = "lookTopOverlay";

    const popup = document.createElement("div");
    popup.className = "look-top-popup";

    const title = document.createElement("h2");
    title.textContent = sourceCard
        ? `${sourceCard.name}`
        : "Look at cards";

    const description = document.createElement("p");
    description.textContent = descriptionText ||
        `Choose up to ${maxSelectable} valid card${maxSelectable === 1 ? "" : "s"} to add to ${player.name}'s hand. The rest go to the bottom of the deck.`;

    const cardGrid = document.createElement("div");
    cardGrid.className = "look-top-card-grid";

    const selectedIndices = [];

    const completeLookTopSelection = (selection) => {
        if (typeof onComplete === "function") {
            onComplete(selection);
        }
    };

    const continueToBottomOrder = () => {
        const selectedIndex = selectedIndices.length > 0
            ? selectedIndices[0]
            : null;
        const remainingCards = cards
            .map((card, index) => ({ card, index }))
            .filter(entry => !selectedIndices.includes(entry.index));

        if (allowTopOrBottomPlacement) {
            if (remainingCards.length === 0) {
                removeLookTopOverlay();

                completeLookTopSelection({
                    selectedIndex,
                    selectedIndices: [...selectedIndices],
                    orderedRemaining: [],
                    topCount: 0
                });

                return;
            }

            renderTopBottomOrderStep({
                player,
                sourceCard,
                remainingCards,
                selectedIndex,
                selectedIndices: [...selectedIndices],
                onComplete: completeLookTopSelection
            });
            return;
        }

        if (remainingCards.length <= 1) {
            removeLookTopOverlay();

            completeLookTopSelection({
                selectedIndex,
                selectedIndices: [...selectedIndices],
                bottomOrder: remainingCards.map(entry => entry.index)
            });

            return;
        }

        renderBottomOrderStep({
            player,
            sourceCard,
            remainingCards,
            selectedIndex,
            selectedIndices: [...selectedIndices],
            onComplete: completeLookTopSelection
        });
    };

    const updateActionButtons = () => {
        addButton.disabled = selectedIndices.length === 0;
        addButton.textContent = maxSelectable === 1
            ? "Add Selected"
            : `Continue With Selected (${selectedIndices.length}/${maxSelectable})`;
    };

    const toggleSelectedCard = (cardButton, index, validChoice) => {
        if (!validChoice) return;

        const existingSelectionIndex = selectedIndices.indexOf(index);

        if (existingSelectionIndex !== -1) {
            selectedIndices.splice(existingSelectionIndex, 1);
            cardButton.classList.remove("selected-look-card");
            updateActionButtons();
            return;
        }

        if (selectedIndices.length >= maxSelectable) {
            return;
        }

        selectedIndices.push(index);
        cardButton.classList.add("selected-look-card");
        updateActionButtons();
    };

    cards.forEach((card, index) => {
        const cardButton = document.createElement("button");
        cardButton.className = "look-top-card-button";

        const validChoice = isSelectable(card);

        if (!validChoice) {
            cardButton.classList.add("disabled-choice");
            cardButton.title = "This card is not a valid choice, but you can inspect it.";
        } else {
            cardButton.title = "Click to inspect. Use Select Card to mark it for adding.";
        }

        const img = document.createElement("img");
        img.src = card.image;
        img.alt = card.name;
        img.className = "look-top-card-img";

        const name = document.createElement("span");
        name.className = "look-top-card-name";
        name.textContent = card.name;

        cardButton.appendChild(img);
        cardButton.appendChild(name);

        cardButton.addEventListener("click", () => {
            showSearchCardImagePopup(card, {
                canSelect: validChoice,
                selectButtonLabel: selectedIndices.includes(index)
                    ? "Remove Card"
                    : "Select Card",
                onSelect: () => {
                    toggleSelectedCard(cardButton, index, validChoice);
                }
            });
        });

        cardGrid.appendChild(cardButton);
    });

    const buttonRow = document.createElement("div");
    buttonRow.className = "look-top-buttons";

    const addButton = document.createElement("button");
    addButton.className = "look-top-action-button";
    addButton.textContent = maxSelectable === 1
        ? "Add Selected"
        : `Continue With Selected (0/${maxSelectable})`;
    addButton.disabled = true;

    const skipButton = document.createElement("button");
    skipButton.className = "look-top-action-button secondary";
    skipButton.textContent = "Add Nothing";

    addButton.addEventListener("click", () => {
        if (selectedIndices.length === 0) return;

        continueToBottomOrder();
    });

    skipButton.addEventListener("click", () => {
        selectedIndices.splice(0, selectedIndices.length);

        continueToBottomOrder();
    });

    buttonRow.appendChild(addButton);
    buttonRow.appendChild(skipButton);

    popup.appendChild(title);
    popup.appendChild(description);
    popup.appendChild(cardGrid);
    popup.appendChild(buttonRow);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    updateActionButtons();
}

function renderTopBottomOrderStep({
    player,
    sourceCard,
    remainingCards,
    selectedIndex,
    selectedIndices = [],
    onComplete
}) {
    const overlay = document.getElementById("lookTopOverlay");
    const popup = overlay?.querySelector(".look-top-popup");

    if (!overlay || !popup) return;

    popup.innerHTML = "";

    const title = document.createElement("h2");
    title.textContent = sourceCard
        ? `${sourceCard.name}`
        : "Order cards";

    const description = document.createElement("p");
    description.textContent = "Click the remaining cards in the exact order you want to return them. Card 1 will be the top-most returned card.";

    const cardGrid = document.createElement("div");
    cardGrid.className = "look-top-card-grid";

    const defaultOrder = remainingCards.map(entry => entry.index);
    const selectedOrder = [];
    const confirmRow = document.createElement("div");
    confirmRow.className = "look-top-buttons";
    confirmRow.style.display = "none";

    const updateConfirmButtons = () => {
        confirmRow.innerHTML = "";

        const topButton = document.createElement("button");
        topButton.className = "look-top-action-button";
        topButton.textContent = "Place on Top";
        topButton.addEventListener("click", () => {
            removeLookTopOverlay();
            onComplete?.({
                selectedIndex,
                selectedIndices: [...selectedIndices],
                orderedRemaining: [...selectedOrder],
                returnZone: "top"
            });
        });

        const bottomButton = document.createElement("button");
        bottomButton.className = "look-top-action-button secondary";
        bottomButton.textContent = "Place on Bottom";
        bottomButton.addEventListener("click", () => {
            removeLookTopOverlay();
            onComplete?.({
                selectedIndex,
                selectedIndices: [...selectedIndices],
                orderedRemaining: [...selectedOrder],
                returnZone: "bottom"
            });
        });

        confirmRow.appendChild(topButton);
        confirmRow.appendChild(bottomButton);
    };

    const updateDoneState = () => {
        const isComplete = selectedOrder.length === remainingCards.length;

        confirmRow.style.display = isComplete ? "flex" : "none";

        if (isComplete) {
            updateConfirmButtons();
        }
    };

    const syncSelectedOrderUi = () => {
        const orderLookup = new Map(selectedOrder.map((index, orderIndex) => [index, orderIndex + 1]));

        cardGrid.querySelectorAll(".bottom-order-card-button").forEach(cardButton => {
            const entryIndex = Number(cardButton.dataset.entryIndex);
            const orderBadge = cardButton.querySelector(".bottom-order-badge");
            const orderNumber = orderLookup.get(entryIndex);

            cardButton.classList.toggle("selected-look-card", Boolean(orderNumber));
            cardButton.classList.toggle("bottom-order-selected", Boolean(orderNumber));

            if (orderBadge) {
                orderBadge.textContent = orderNumber || "";
            }
        });

        updateDoneState();
    };

    remainingCards.forEach(entry => {
        const cardButton = document.createElement("button");
        cardButton.className = "look-top-card-button bottom-order-card-button";
        cardButton.dataset.entryIndex = String(entry.index);

        const orderBadge = document.createElement("span");
        orderBadge.className = "bottom-order-badge";

        const img = document.createElement("img");
        img.src = entry.card.image;
        img.alt = entry.card.name;
        img.className = "look-top-card-img";

        const name = document.createElement("span");
        name.className = "look-top-card-name";
        name.textContent = entry.card.name;

        cardButton.appendChild(orderBadge);
        cardButton.appendChild(img);
        cardButton.appendChild(name);

        cardButton.addEventListener("click", () => {
            const existingIndex = selectedOrder.indexOf(entry.index);

            if (existingIndex !== -1) {
                selectedOrder.splice(existingIndex, selectedOrder.length - existingIndex);
                syncSelectedOrderUi();
                return;
            }

            selectedOrder.push(entry.index);
            syncSelectedOrderUi();
        });

        cardGrid.appendChild(cardButton);
    });

    const buttonRow = document.createElement("div");
    buttonRow.className = "look-top-buttons";

    const resetButton = document.createElement("button");
    resetButton.className = "look-top-action-button secondary";
    resetButton.textContent = "Reset Order";
    resetButton.addEventListener("click", () => {
        selectedOrder.splice(0, selectedOrder.length);
        syncSelectedOrderUi();
    });

    buttonRow.appendChild(resetButton);

    popup.appendChild(title);
    popup.appendChild(description);
    popup.appendChild(cardGrid);
    popup.appendChild(buttonRow);
    popup.appendChild(confirmRow);

    selectedOrder.push(...defaultOrder);
    syncSelectedOrderUi();
}

function showSearchCardImagePopup(card, options = {}) {
    if (!card?.image) return;

    removeSearchCardImagePopup();

    const overlay = document.createElement("div");
    overlay.className = "search-card-image-overlay";
    overlay.id = "searchCardImageOverlay";

    const popup = document.createElement("div");
    popup.className = "search-card-image-popup";

    const image = document.createElement("img");
    image.src = card.image;
    image.alt = card.name;
    image.className = "search-card-image-large";

    const name = document.createElement("h3");
    name.textContent = card.name;

    const buttons = document.createElement("div");
    buttons.className = "search-card-image-buttons";

    if (options.canSelect) {
        const selectButton = document.createElement("button");
        selectButton.className = "look-top-action-button";
        selectButton.textContent = options.selectButtonLabel || "Select Card";
        selectButton.addEventListener("click", () => {
            if (typeof options.onSelect === "function") {
                options.onSelect();
            }

            removeSearchCardImagePopup();
        });

        buttons.appendChild(selectButton);
    }

    const closeButton = document.createElement("button");
    closeButton.className = "look-top-action-button secondary";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", removeSearchCardImagePopup);

    buttons.appendChild(closeButton);

    popup.appendChild(image);
    popup.appendChild(name);
    popup.appendChild(buttons);
    overlay.appendChild(popup);

    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            removeSearchCardImagePopup();
        }
    });

    document.body.appendChild(overlay);
}

function removeSearchCardImagePopup() {
    const oldOverlay = document.getElementById("searchCardImageOverlay");

    if (oldOverlay) {
        oldOverlay.remove();
    }
}

function removeLookTopOverlay() {
    removeSearchCardImagePopup();

    const oldOverlay = document.getElementById("lookTopOverlay");

    if (oldOverlay) {
        oldOverlay.remove();
    }
}

function showLifeCardChoice({
    player,
    sourceCard,
    prompt,
    choices,
    onComplete
}) {
    removeLifeCardChoiceOverlay();

    const overlay = document.createElement("div");
    overlay.className = "look-top-overlay";
    overlay.id = "lifeChoiceOverlay";

    const popup = document.createElement("div");
    popup.className = "look-top-popup";

    const title = document.createElement("h2");
    title.textContent = sourceCard ? sourceCard.name : "Choose a life card";

    const description = document.createElement("p");
    description.textContent = prompt || `Choose a life card for ${player.name}.`;

    const cardGrid = document.createElement("div");
    cardGrid.className = "look-top-card-grid";

    choices.forEach(choice => {
        const cardButton = document.createElement("button");
        cardButton.className = "look-top-card-button";

        const img = document.createElement("img");
        img.src = choice.card?.faceUp && choice.card.image
            ? choice.card.image
            : cardBackImage;
        img.alt = choice.card?.faceUp && choice.card.name
            ? choice.card.name
            : "Life Card";
        img.className = "look-top-card-img";

        const name = document.createElement("span");
        name.className = "look-top-card-name";
        name.textContent = choice.choiceLabel || `Life ${Number(choice.lifeIndex || 0) + 1}`;

        cardButton.appendChild(img);
        cardButton.appendChild(name);
        cardButton.addEventListener("click", async () => {
            removeLifeCardChoiceOverlay();

            if (typeof onComplete === "function") {
                await onComplete(choice);
            }
        });

        cardGrid.appendChild(cardButton);
    });

    popup.appendChild(title);
    popup.appendChild(description);
    popup.appendChild(cardGrid);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

function removeLifeCardChoiceOverlay() {
    const oldOverlay = document.getElementById("lifeChoiceOverlay");

    if (oldOverlay) {
        oldOverlay.remove();
    }
}

// =========================
// Board Choice UI
// =========================

function showBoardCardChoice({
    player,
    sourceCard,
    prompt,
    choices,
    optional,
    onComplete
}) {
    removeBoardChoiceOverlay();

    const overlay = document.createElement("div");
    overlay.className = "look-top-overlay";
    overlay.id = "boardChoiceOverlay";

    const popup = document.createElement("div");
    popup.className = "look-top-popup";

    const title = document.createElement("h2");
    title.textContent = sourceCard ? sourceCard.name : "Choose a card";

    const description = document.createElement("p");
    description.textContent = prompt || `Choose a card for ${player.name}.`;

    const cardGrid = document.createElement("div");
    cardGrid.className = "look-top-card-grid";

    let selectedChoice = null;

    const getFreshChoice = (choice) => {
        if (!choice) return null;

        const freshCard = getBoardCardFromData(choice);

        return freshCard
            ? { ...choice, card: freshCard }
            : choice;
    };

    choices.forEach(choice => {
        const cardButton = document.createElement("button");
        cardButton.className = "look-top-card-button";

        const img = document.createElement("img");
        img.src = choice.card.image;
        img.alt = choice.card.name;
        img.className = "look-top-card-img";

        const name = document.createElement("span");
        name.className = "look-top-card-name";
        name.textContent = choice.choiceLabel
            ? `${choice.card.name} (${choice.choiceLabel})`
            : choice.card.name;

        cardButton.appendChild(img);
        cardButton.appendChild(name);

        cardButton.addEventListener("click", () => {
            selectedChoice = choice;

            document.querySelectorAll("#boardChoiceOverlay .look-top-card-button").forEach(button => {
                button.classList.remove("selected-look-card");
            });

            cardButton.classList.add("selected-look-card");

            chooseButton.disabled = false;
        });

        cardGrid.appendChild(cardButton);
    });

    const buttonRow = document.createElement("div");
    buttonRow.className = "look-top-buttons";

    const chooseButton = document.createElement("button");
    chooseButton.className = "look-top-action-button";
    chooseButton.textContent = "Choose";
    chooseButton.disabled = true;

    const skipButton = document.createElement("button");
    skipButton.className = "look-top-action-button secondary";
    skipButton.textContent = "Skip";
    skipButton.disabled = !optional;

    chooseButton.addEventListener("click", async () => {
        if (!selectedChoice) return;

        removeBoardChoiceOverlay();

        if (typeof onComplete === "function") {
            await onComplete(getFreshChoice(selectedChoice));
        }
    });

    skipButton.addEventListener("click", async () => {
        removeBoardChoiceOverlay();

        if (typeof onComplete === "function") {
            await onComplete(null);
        }
    });

    buttonRow.appendChild(chooseButton);
    buttonRow.appendChild(skipButton);

    popup.appendChild(title);
    popup.appendChild(description);
    popup.appendChild(cardGrid);
    popup.appendChild(buttonRow);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

function renderBottomOrderStep({
    player,
    sourceCard,
    remainingCards,
    selectedIndex,
    selectedIndices = [],
    onComplete
}) {
    const overlay = document.getElementById("lookTopOverlay");
    const popup = overlay?.querySelector(".look-top-popup");

    if (!overlay || !popup) return;

    popup.innerHTML = "";

    const title = document.createElement("h2");
    title.textContent = sourceCard
        ? `${sourceCard.name}`
        : "Order cards";

    const description = document.createElement("p");
    description.textContent = `Click the remaining cards in the order ${player.name} wants to place them on the bottom of the deck.`;

    const cardGrid = document.createElement("div");
    cardGrid.className = "look-top-card-grid";

    const defaultOrder = remainingCards.map(entry => entry.index);
    const selectedOrder = [];
    const doneButton = document.createElement("button");

    const updateDoneState = () => {
        doneButton.disabled = selectedOrder.length !== remainingCards.length;
    };

    const syncSelectedOrderUi = () => {
        const orderLookup = new Map(selectedOrder.map((index, orderIndex) => [index, orderIndex + 1]));

        cardGrid.querySelectorAll(".bottom-order-card-button").forEach(cardButton => {
            const entryIndex = Number(cardButton.dataset.entryIndex);
            const orderBadge = cardButton.querySelector(".bottom-order-badge");
            const orderNumber = orderLookup.get(entryIndex);

            cardButton.classList.toggle("selected-look-card", Boolean(orderNumber));
            cardButton.classList.toggle("bottom-order-selected", Boolean(orderNumber));

            if (orderBadge) {
                orderBadge.textContent = orderNumber || "";
            }
        });

        updateDoneState();
    };

    remainingCards.forEach(entry => {
        const cardButton = document.createElement("button");
        cardButton.className = "look-top-card-button bottom-order-card-button";
        cardButton.dataset.entryIndex = String(entry.index);

        const orderBadge = document.createElement("span");
        orderBadge.className = "bottom-order-badge";

        const img = document.createElement("img");
        img.src = entry.card.image;
        img.alt = entry.card.name;
        img.className = "look-top-card-img";

        const name = document.createElement("span");
        name.className = "look-top-card-name";
        name.textContent = entry.card.name;

        cardButton.appendChild(orderBadge);
        cardButton.appendChild(img);
        cardButton.appendChild(name);

        cardButton.addEventListener("click", () => {
            const existingIndex = selectedOrder.indexOf(entry.index);

            if (existingIndex !== -1) {
                selectedOrder.splice(existingIndex, selectedOrder.length - existingIndex);
                syncSelectedOrderUi();
                return;
            }

            selectedOrder.push(entry.index);
            syncSelectedOrderUi();
        });

        cardGrid.appendChild(cardButton);
    });

    const buttonRow = document.createElement("div");
    buttonRow.className = "look-top-buttons";

    doneButton.className = "look-top-action-button";
    doneButton.textContent = "Place on Bottom";
    doneButton.disabled = true;

    const resetButton = document.createElement("button");
    resetButton.className = "look-top-action-button secondary";
    resetButton.textContent = "Reset Order";

    doneButton.addEventListener("click", () => {
        if (selectedOrder.length !== remainingCards.length) return;

        removeLookTopOverlay();

        if (typeof onComplete === "function") {
            onComplete({
                selectedIndex,
                selectedIndices: [...selectedIndices],
                bottomOrder: selectedOrder
            });
        }
    });

    resetButton.addEventListener("click", () => {
        selectedOrder.splice(0, selectedOrder.length);
        syncSelectedOrderUi();
    });

    buttonRow.appendChild(doneButton);
    buttonRow.appendChild(resetButton);

    popup.appendChild(title);
    popup.appendChild(description);
    popup.appendChild(cardGrid);
    popup.appendChild(buttonRow);

    selectedOrder.push(...defaultOrder);
    syncSelectedOrderUi();
}

function removeBoardChoiceOverlay() {
    const oldOverlay = document.getElementById("boardChoiceOverlay");

    if (oldOverlay) {
        oldOverlay.remove();
    }
}

// =========================
// Effect Choice UI
// =========================

function chooseEffectActivation({
    player,
    sourceCard,
    effect,
    title,
    prompt,
    activateText = "Activate",
    skipText = "Skip",
    onComplete
}) {
    chooseEffectOption({
        player,
        sourceCard,
        effect,
        title,
        prompt,
        options: [
            {
                label: activateText,
                value: true
            },
            {
                label: skipText,
                value: false,
                secondary: true
            }
        ],
        onComplete
    });
}

function chooseEffectOption({
    sourceCard,
    title,
    prompt,
    options,
    onComplete
}) {
    const shouldDeferCombatChoice = Boolean(
        currentAttack &&
        gameState?.currentPhase === "attackResolving" &&
        typeof ui?.beginDeferredCombatResolution === "function" &&
        typeof ui?.endDeferredCombatResolution === "function"
    );
    const autoSelectedOption = window.getAutoSelectMaxValueOption?.(options);

    if (autoSelectedOption) {
        Promise.resolve().then(async () => {
            if (shouldDeferCombatChoice) {
                ui.beginDeferredCombatResolution();
            }

            try {
                if (typeof onComplete === "function") {
                    await onComplete(autoSelectedOption.value);
                }
            } finally {
                if (shouldDeferCombatChoice) {
                    ui.endDeferredCombatResolution();
                }
            }
        });
        return;
    }

    removeEffectChoiceOverlay();

    const overlay = document.createElement("div");
    overlay.className = "look-top-overlay";
    overlay.id = "effectChoiceOverlay";

    const popup = document.createElement("div");
    popup.className = "look-top-popup effect-choice-popup";

    const heading = document.createElement("h2");
    heading.textContent = title || sourceCard?.name || "Choose Effect";

    const body = document.createElement("div");
    body.className = "effect-choice-body";

    if (sourceCard?.image) {
        const image = document.createElement("img");
        image.src = sourceCard.image;
        image.alt = sourceCard.name;
        image.className = "effect-choice-card-img";
        body.appendChild(image);
    }

    const content = document.createElement("div");
    content.className = "effect-choice-content";

    const description = document.createElement("p");
    description.textContent = prompt || "Choose how to resolve this effect.";

    const buttonRow = document.createElement("div");
    buttonRow.className = "look-top-buttons effect-choice-buttons";

    content.appendChild(description);
    content.appendChild(buttonRow);
    body.appendChild(content);

    popup.appendChild(heading);
    popup.appendChild(body);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    function renderEffectChoiceButtons(buttonOptions) {
        buttonRow.innerHTML = "";

        buttonOptions.forEach(option => {
            const button = document.createElement("button");
            button.className = option.secondary
                ? "look-top-action-button secondary"
                : "look-top-action-button";
            button.textContent = option.label;
            button.disabled = Boolean(option.disabled);

            if (option.title) {
                button.title = option.title;
            }

            button.addEventListener("click", async () => {
                if (option.disabled) {
                    return;
                }

                if (option.requiresConfirmation) {
                    renderEffectChoiceButtons([
                        {
                            label: option.confirmText || "Confirm",
                            value: option.value
                        },
                        {
                            label: option.cancelText || "Back",
                            value: null,
                            secondary: true
                        }
                    ]);
                    return;
                }

                if (option.value === null) {
                    renderEffectChoiceButtons(options);
                    return;
                }

                removeEffectChoiceOverlay();

                if (shouldDeferCombatChoice) {
                    ui.beginDeferredCombatResolution();
                }

                try {
                    if (typeof onComplete === "function") {
                        await onComplete(option.value);
                    }
                } finally {
                    if (shouldDeferCombatChoice) {
                        ui.endDeferredCombatResolution();
                    }
                }
            });

            buttonRow.appendChild(button);
        });
    }

    renderEffectChoiceButtons(options);
}

function chooseNumberValue({
    sourceCard,
    title,
    prompt,
    min = 0,
    max = 10,
    initialValue = 0,
    valueLabel = "cost",
    onComplete
}) {
    removeEffectChoiceOverlay();

    const overlay = document.createElement("div");
    overlay.className = "look-top-overlay";
    overlay.id = "effectChoiceOverlay";

    const popup = document.createElement("div");
    popup.className = "look-top-popup effect-choice-popup";

    const heading = document.createElement("h2");
    heading.textContent = title || sourceCard?.name || "Choose Value";

    const body = document.createElement("div");
    body.className = "effect-choice-body";

    if (sourceCard?.image) {
        const image = document.createElement("img");
        image.src = sourceCard.image;
        image.alt = sourceCard.name;
        image.className = "effect-choice-card-img";
        body.appendChild(image);
    }

    const content = document.createElement("div");
    content.className = "effect-choice-content";

    const description = document.createElement("p");
    description.textContent = prompt || "Choose a value.";

    const pickerRow = document.createElement("div");
    pickerRow.className = "look-top-buttons effect-choice-buttons";

    const currentValue = document.createElement("span");
    currentValue.className = "look-top-action-button secondary";

    let value = Math.min(max, Math.max(min, Number(initialValue || 0)));

    const updateValue = () => {
        currentValue.textContent = `${value} ${valueLabel}`;
        minusButton.disabled = value <= min;
        plusButton.disabled = value >= max;
    };

    const minusButton = document.createElement("button");
    minusButton.className = "look-top-action-button secondary";
    minusButton.textContent = "-";
    minusButton.addEventListener("click", () => {
        if (value > min) {
            value -= 1;
            updateValue();
        }
    });

    const plusButton = document.createElement("button");
    plusButton.className = "look-top-action-button secondary";
    plusButton.textContent = "+";
    plusButton.addEventListener("click", () => {
        if (value < max) {
            value += 1;
            updateValue();
        }
    });

    pickerRow.appendChild(minusButton);
    pickerRow.appendChild(currentValue);
    pickerRow.appendChild(plusButton);

    const buttonRow = document.createElement("div");
    buttonRow.className = "look-top-buttons effect-choice-buttons";

    const confirmButton = document.createElement("button");
    confirmButton.className = "look-top-action-button";
    confirmButton.textContent = "Confirm";
    confirmButton.addEventListener("click", async () => {
        removeEffectChoiceOverlay();

        if (typeof onComplete === "function") {
            await onComplete(value);
        }
    });

    buttonRow.appendChild(confirmButton);

    updateValue();

    content.appendChild(description);
    content.appendChild(pickerRow);
    content.appendChild(buttonRow);
    body.appendChild(content);
    popup.appendChild(heading);
    popup.appendChild(body);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

function removeEffectChoiceOverlay() {
    const oldOverlay = document.getElementById("effectChoiceOverlay");

    if (oldOverlay) {
        oldOverlay.remove();
    }
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
        selectedBoardCardData.cardType === "leader" &&
        doesStagePreventLeaderAttacks(player)
    ) {
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

    if (selectedBoardCardData.cardType === "character" && isCharacterAttackLocked(card, player)) {
        return false;
    }

    if (
        (selectedBoardCardData.cardType === "leader" || selectedBoardCardData.cardType === "character") &&
        typeof canCardBeRested === "function" &&
        !canCardBeRested(card)
    ) {
        return false;
    }

    return true;
}

function isCharacterAttackLocked(card, player) {
    const currentPlayer = gameState?.currentPlayer;
    const currentPlayerKey = currentPlayer
        ? getPlayerKey(currentPlayer)
        : null;
    const currentTurnStatusKey = currentPlayerKey
        ? `${Number(gameState?.turnNumber || 0)}:${currentPlayerKey}`
        : null;

    if (card?.cannotAttackThisTurnKey && currentTurnStatusKey && card.cannotAttackThisTurnKey === currentTurnStatusKey) {
        return true;
    }

    if (!card?.cannotAttackUntil || !player) {
        return false;
    }

    const playerKey = getPlayerKey(player);

    if (card.cannotAttackUntil.expiresAtPlayerKey !== playerKey) {
        return false;
    }

    return Number(player.turns || 0) <= Number(card.cannotAttackUntil.expiresAtEndOfTurns ?? 0);
}

