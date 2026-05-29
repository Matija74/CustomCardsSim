// multiplayer.js

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
let pendingOpponentAttackEffect = null;

const renderedBoardCardStates = new Map();

// =========================
// Game State
// =========================

let gameState = null;
let syncedLogMessages = [];
let isApplyingMultiplayerState = false;
let lastAutoPhaseAdvanceKey = null;
let lastStartOfTurnResumeKey = null;
let gameOverState = null;
let pendingDeferredCombatChoices = 0;
let deferredAttackCleanup = null;

// =========================
// UI Bridge
// =========================

let ui = null;

function cloneSerializableValue(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

function getMultiplayerRuntime() {
    return window.__multiplayerRuntime || null;
}

function getMultiplayerLocalSlot() {
    return getMultiplayerRuntime()?.getLocalSlot?.() || "p1";
}

function getOpponentMultiplayerSlot(slot) {
    return slot === "p1" ? "p2" : "p1";
}

function getCanonicalSlotForLocalPlayerKey(playerKey) {
    const localSlot = getMultiplayerLocalSlot();

    return playerKey === "player1"
        ? localSlot
        : getOpponentMultiplayerSlot(localSlot);
}

function getLocalPlayerKeyForCanonicalSlot(slot) {
    const localSlot = getMultiplayerLocalSlot();

    return slot === localSlot ? "player1" : "player2";
}

function getPlayerKeyForPlayer(player) {
    if (player === gameState?.player1) {
        return "player1";
    }

    if (player === gameState?.player2) {
        return "player2";
    }

    return null;
}

function mapBoardCardDataToCanonical(boardCardData) {
    if (!boardCardData) {
        return null;
    }

    return {
        ...cloneSerializableValue(boardCardData),
        playerKey: getCanonicalSlotForLocalPlayerKey(boardCardData.playerKey)
    };
}

function mapBoardCardDataToLocal(boardCardData) {
    if (!boardCardData) {
        return null;
    }

    return {
        ...cloneSerializableValue(boardCardData),
        playerKey: getLocalPlayerKeyForCanonicalSlot(boardCardData.playerKey)
    };
}

function queueMultiplayerStateSync() {
    if (isApplyingMultiplayerState) {
        return;
    }

    getMultiplayerRuntime()?.scheduleStateSync?.();
}

function serializePlayerState(player) {
    if (!player) {
        return null;
    }

    const clone = cloneSerializableValue(player);

    delete clone.multiplayerSlot;

    return clone;
}

function hydratePlayerState(player, multiplayerSlot) {
    const hydratedPlayer = cloneSerializableValue(player || {
        hand: [],
        deck: [],
        life: [],
        trash: [],
        characters: [],
        don: 0,
        restedDon: 0,
        donDeck: 10,
        turns: 0,
        leader: null,
        stage: null,
        hasMulliganed: false,
        leaderAttacksThisTurn: 0
    });

    hydratedPlayer.hand = Array.isArray(hydratedPlayer.hand) ? hydratedPlayer.hand : [];
    hydratedPlayer.deck = Array.isArray(hydratedPlayer.deck) ? hydratedPlayer.deck : [];
    hydratedPlayer.life = Array.isArray(hydratedPlayer.life) ? hydratedPlayer.life : [];
    hydratedPlayer.trash = Array.isArray(hydratedPlayer.trash) ? hydratedPlayer.trash : [];
    hydratedPlayer.characters = Array.isArray(hydratedPlayer.characters) ? hydratedPlayer.characters : [];
    hydratedPlayer.multiplayerSlot = multiplayerSlot;

    return hydratedPlayer;
}

function renderGameLogMessages(messages) {
    const gameLogMessages = document.getElementById("gameLogMessages");

    if (!gameLogMessages) {
        return;
    }

    gameLogMessages.innerHTML = "";

    messages.forEach(message => {
        const logMessage = document.createElement("div");

        logMessage.className = "log-message";
        logMessage.innerHTML = message;
        gameLogMessages.appendChild(logMessage);
    });

    gameLogMessages.scrollTop = gameLogMessages.scrollHeight;
}

function syncPhaseButtonForCurrentState() {
    const phaseButton = document.getElementById("phaseButton");

    if (!phaseButton || !gameState) {
        return;
    }

    if (gameState.currentPhase === "gameOver") {
        phaseButton.style.display = "block";
        phaseButton.disabled = true;
        phaseButton.textContent = "Game Over";
        window.setPhaseButtonUrgency?.(phaseButton, false);
        return;
    }

    if (gameState.currentPhase === "draw" || gameState.currentPhase === "don") {
        const localPlayer = gameState.player1;
        const currentPlayer = gameState.currentPlayer;
        const isLocalTurn = currentPlayer === localPlayer;
        const isDrawPhase = gameState.currentPhase === "draw";
        const buttonText = isDrawPhase
            ? "Draw Card"
            : `Add ${gameState.turnNumber === 1 && currentPlayer === gameState.firstPlayer ? 1 : 2} DON!!`;

        phaseButton.style.display = "block";
        phaseButton.disabled = !isLocalTurn;
        phaseButton.textContent = isLocalTurn
            ? buttonText
            : `${currentPlayer?.name || "Opponent"}'s ${isDrawPhase ? "Draw" : "DON!!"} Phase`;
        window.setPhaseButtonUrgency?.(phaseButton, isLocalTurn);
        return;
    }

    if (gameState.currentPhase === "startOfTurn") {
        const localPlayer = gameState.player1;
        const currentPlayer = gameState.currentPlayer;
        const isLocalTurn = currentPlayer === localPlayer;

        phaseButton.style.display = "block";
        phaseButton.disabled = true;
        phaseButton.textContent = isLocalTurn
            ? "Resolving Start of Turn"
            : `${currentPlayer?.name || "Opponent"}'s Start of Turn`;
        window.setPhaseButtonUrgency?.(phaseButton, false);
        return;
    }

    if (gameState.currentPhase === "main") {
        const localPlayer = gameState.player1;
        const currentPlayer = gameState.currentPlayer;
        const nextPlayer = currentPlayer ? getNextPlayer(currentPlayer) : null;
        const isLocalTurn = currentPlayer === localPlayer;

        phaseButton.style.display = "block";
        phaseButton.disabled = !isLocalTurn;
        phaseButton.textContent = isLocalTurn
            ? `Pass to ${nextPlayer?.name || "Opponent"}`
            : `${currentPlayer?.name || "Opponent"}'s Turn`;
        window.setPhaseButtonUrgency?.(phaseButton, false);
        return;
    }

    if (gameState.currentPhase === "counterPhase") {
        phaseButton.style.display = "block";
        phaseButton.disabled = true;
        phaseButton.textContent = "Counter Phase";
        window.setPhaseButtonUrgency?.(phaseButton, false);
        return;
    }

    if (gameState.currentPhase === "attackResolving" || gameState.currentPhase === "choosingAttackTarget") {
        phaseButton.style.display = "block";
        phaseButton.disabled = true;
        phaseButton.textContent = "Attack In Progress";
        window.setPhaseButtonUrgency?.(phaseButton, false);
        return;
    }
}

function clearLocalSelectionsAndOverlays() {
    pendingReplacePlay = null;
    selectedHandCard = null;
    selectedHandCardData = null;
    selectedBoardCard = null;
    selectedBoardCardData = null;

    clearSelectedCardActions();
    clearSelectedBoardActions();
    clearHandSelection();
    clearBoardSelection();
    clearReplaceTargets();
    clearTrashChoiceTargets();
    clearCancelAttackButton();
    clearAttackTargets();
    clearBlockerTargets();
    clearBattleControls();
    clearAttackArrow();
    removeLookTopOverlay();
    removeBoardChoiceOverlay();
    removeEffectChoiceOverlay();
}

function restoreBattleUiFromSyncedState() {
    if (pendingTrashChoice?.playerKey) {
        highlightTrashChoiceTargets(pendingTrashChoice.playerKey);
    }

    if (pendingAttack) {
        const attackerCard = getBoardCardFromData(pendingAttack.attacker);
        const attackerPlayer = gameState[pendingAttack.attackerPlayerKey];

        if (attackerCard && attackerPlayer) {
            const attackerWasPlayedThisTurn =
                pendingAttack.attacker.cardType === "character" &&
                isCharacterPlayedThisTurn(attackerPlayer, attackerCard);
            const canTargetLeader =
                !attackerWasPlayedThisTurn ||
                CardEffects.canAttackOnTurnPlayed(attackerCard);
            const defenderKey = pendingAttack.defenderPlayerKey;
            const opponentLeader = document.querySelector(
                `.board-leader-card[data-player="${defenderKey}"]`
            );

            if (opponentLeader && canTargetLeader) {
                opponentLeader.classList.add("attack-target");
            }

            document
                .querySelectorAll(`.board-character-card[data-player="${defenderKey}"]`)
                .forEach(characterElement => {
                    const slotIndex = Number(characterElement.getAttribute("data-character-slot"));
                    const defenderPlayer = gameState[defenderKey];
                    const character = defenderPlayer?.characters?.[slotIndex];

                    if (!character || character.state !== "rested") {
                        return;
                    }

                    if (
                        attackerWasPlayedThisTurn &&
                        !CardEffects.canAttackTargetOnTurnPlayed(attackerCard, {
                            playerKey: defenderKey,
                            cardType: "character",
                            slotIndex
                        })
                    ) {
                        return;
                    }

                    characterElement.classList.add("attack-target");
                });

            showCancelAttackButton(pendingAttack.attacker);
        }
    }

    if (currentAttack) {
        drawAttackArrow(currentAttack.attacker, currentAttack.target);

        if (pendingOpponentAttackEffect) {
            const defenderName = gameState[currentAttack.defenderPlayerKey]?.name ?? "Defender";

            if (canLocalPlayerControlDefense(pendingOpponentAttackEffect.defenderPlayerKey)) {
                showPendingOpponentAttackEffectChoice();
            } else {
                clearBattleControls();
                const battleControls = document.getElementById("battleControls");

                if (battleControls) {
                    battleControls.appendChild(
                        createWaitingDefenseButton(defenderName, "Waiting for Effects")
                    );
                }
            }

            return;
        }

        if (currentAttack.resolutionStep === "attackerEffects") {
            if (isLocalMultiplayerPlayerKey(currentAttack.attackerPlayerKey)) {
                continueAttackAfterDefenderResponses();
            } else {
                clearBattleControls();
                const battleControls = document.getElementById("battleControls");
                const attackerName = gameState[currentAttack.attackerPlayerKey]?.name ?? "Attacker";

                if (battleControls) {
                    battleControls.appendChild(
                        createWaitingDefenseButton(attackerName, "Waiting for Attack Effects")
                    );
                }
            }

            return;
        }

        if (currentAttack.resolutionStep === "resolvingAttackerEffects") {
            return;
        }

        if (currentAttack.resolutionStep && currentAttack.resolutionStep !== "readyForDefense") {
            return;
        }

        if (gameState.currentPhase === "counterPhase" || currentAttack.counterPhaseStarted) {
            showCounterPhaseControls(currentAttack.defenderPlayerKey, async () => {
                await resolveCurrentAttack();
                queueMultiplayerStateSync();
            });
        } else {
            showResolveAttackButton(currentAttack.defenderPlayerKey, async () => {
                await resolveCurrentAttack();
                queueMultiplayerStateSync();
            });
        }
    }
}

function renderFullGameState() {
    if (!gameState) {
        return;
    }

    updateDonDisplay();
    renderDecks();
    renderDonDecks();
    renderLifeCards();
    renderLeaders();
    renderHands();
    renderCharacters();
    renderTrash();
    renderStages();

    setupCharacterSlotInteractions();
    setupBoardLeaderSelection();
    setupCardPreview();
    syncPhaseButtonForCurrentState();
    syncGameOverPopupForCurrentState();

    clearLocalSelectionsAndOverlays();
    restoreBattleUiFromSyncedState();
    maybeAutoAdvancePhaseFromSyncedState();
    maybeResumeStartOfTurnFromSyncedState();
}

function maybeAutoAdvancePhaseFromSyncedState() {
    const isLocalTurn = gameState?.currentPlayer === gameState?.player1;
    const phase = gameState?.currentPhase;

    if (
        !window.isGameSettingEnabled?.("autoDraw") ||
        !isLocalTurn ||
        !["draw", "don"].includes(phase)
    ) {
        lastAutoPhaseAdvanceKey = null;
        return;
    }

    const phaseKey = `${gameState.turnNumber}:${phase}:${gameState.currentPlayer?.multiplayerSlot || "local"}`;

    if (phaseKey === lastAutoPhaseAdvanceKey) {
        return;
    }

    lastAutoPhaseAdvanceKey = phaseKey;

    window.setTimeout(() => {
        if (
            isApplyingMultiplayerState ||
            !gameState ||
            gameState.currentPlayer !== gameState.player1 ||
            gameState.currentPhase !== phase
        ) {
            return;
        }

        const phaseButton = document.getElementById("phaseButton");
        const phaseInfo = createPhaseLogProxy();

        if (phase === "draw") {
            advanceDrawPhase(phaseButton, phaseInfo);
        } else if (phase === "don") {
            advanceDonPhase(phaseButton, phaseInfo);
        }

        queueMultiplayerStateSync();
    }, 0);
}

function maybeResumeStartOfTurnFromSyncedState() {
    const isLocalTurn = gameState?.currentPlayer === gameState?.player1;
    const phase = gameState?.currentPhase;

    if (phase !== "startOfTurn" || !isLocalTurn) {
        lastStartOfTurnResumeKey = null;
        return;
    }

    const phaseKey = `${gameState.turnNumber}:startOfTurn:${gameState.currentPlayer?.multiplayerSlot || "local"}`;

    if (phaseKey === lastStartOfTurnResumeKey) {
        return;
    }

    lastStartOfTurnResumeKey = phaseKey;

    window.setTimeout(() => {
        if (
            isApplyingMultiplayerState ||
            !gameState ||
            gameState.currentPhase !== "startOfTurn" ||
            gameState.currentPlayer !== gameState.player1
        ) {
            return;
        }

        const phaseButton = document.getElementById("phaseButton");
        const phaseInfo = createPhaseLogProxy();

        beginTurnFlow(gameState.currentPlayer, phaseButton, phaseInfo);
        queueMultiplayerStateSync();
    }, 0);
}

// =========================
// Game Initialization
// =========================

function getSelectedDeckDefinitions() {
    const params = new URLSearchParams(window.location.search);
    const defaultDeckId = window.getAvailableDecks?.()[0]?.id;
    const storedSelection = window.getStoredDeckSelection?.() || {};

    return {
        player1Deck: window.resolveDeckSelection?.(
            storedSelection.player1Selection,
            params.get("player1Deck") || storedSelection.player1DeckId || defaultDeckId
        ),
        player2Deck: window.resolveDeckSelection?.(
            storedSelection.player2Selection,
            params.get("player2Deck") || storedSelection.player2DeckId || defaultDeckId
        )
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
    const selectedDeckDefinitions = getSelectedDeckDefinitions();
    const player1Deck = selectedDeckDefinitions.player1Deck;
    const player2Deck = selectedDeckDefinitions.player2Deck;

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
        renderStages,
        lookTopCardsAddToHand,
        chooseBoardCard: showBoardCardChoice,
        chooseEffectActivation,
        chooseEffectOption,
        chooseNumberValue,
        beginDeferredCombatResolution: () => {
            pendingDeferredCombatChoices += 1;
        },
        endDeferredCombatResolution: () => {
            pendingDeferredCombatChoices = Math.max(0, pendingDeferredCombatChoices - 1);

            if (pendingDeferredCombatChoices === 0 && typeof deferredAttackCleanup === "function") {
                const finalizeCleanup = deferredAttackCleanup;

                deferredAttackCleanup = null;
                finalizeCleanup();
            }
        },
        hasDeferredCombatResolution: () => pendingDeferredCombatChoices > 0,
        revealCards: () => {}
    };
}

// =========================
// Animation Helpers
// =========================

function takeCardAnimationClass(card) {
    const animation = card?.uiAnimation;

    if (!animation) {
        return "";
    }

    delete card.uiAnimation;

    return `card-${animation}-animation`;
}

function getBoardCardRenderKey(playerKey, cardType, slotIndex = "") {
    return `${playerKey}:${cardType}:${slotIndex}`;
}

function getBoardStateAnimationClass(card, renderKey) {
    if (!card || !renderKey) {
        return "";
    }

    const currentState = card.state || "active";
    const previousState = renderedBoardCardStates.get(renderKey);

    renderedBoardCardStates.set(renderKey, currentState);

    if (!previousState || previousState === currentState) {
        return "";
    }

    if (previousState === "active" && currentState === "rested") {
        return "card-rest-transition";
    }

    if (previousState === "rested" && currentState === "active") {
        return "card-ready-transition";
    }

    return "";
}

function applyCardAnimationClass(element, animationClass) {
    if (!element || !animationClass) {
        return;
    }

    element.classList.add(animationClass);
}

async function initializeGamePage() {
    try {
        await loadCardDatabase();

        gameState = createInitialGameState();
        ui = createUiBridge();

        setupLifeArea("lifeArea", "lifeToggleText");
        setupLifeArea("opponentLifeArea", "opponentLifeToggleText");

        setupPhaseControls();
        renderFullGameState();

        addGameLog(`
            Card database loaded. Game ready.<br>
            Player 1: ${gameState.player1.deckName}<br>
            Player 2: ${gameState.player2.deckName}
        `);
        window.dispatchEvent(new CustomEvent("multiplayer-page-ready"));

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

    if (!canLocalPlayerControlDefense(defenderPlayerKey)) {
        addGameLog(`${defenderPlayer.name} is choosing a Blocker.`);
        return;
    }

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

    if (!canLocalPlayerControlDefense(pendingBlock.defenderPlayerKey)) {
        addGameLog("Wait for the defending player to choose a blocker.");
        return;
    }

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

    const onBlockMessage = resolveOnBlockEffects(defenderPlayer, blockerCard, ui);

    if (onBlockMessage) {
        addGameLog(onBlockMessage);
    }

    startCounterPhase(playerKey, () => {
        resolveCurrentAttack();
    });
    queueMultiplayerStateSync();

}

function skipCurrentBlockStep(defenderPlayerKey, onResolve) {
    const defenderName = gameState[defenderPlayerKey]?.name ?? "Defender";

    if (!canLocalPlayerControlDefense(defenderPlayerKey)) {
        addGameLog("Wait for the defending player to choose blockers.");
        return;
    }

    pendingBlock = null;

    clearBlockerTargets();

    addGameLog(`${defenderName} skipped the Block Phase.`);

    startCounterPhase(defenderPlayerKey, onResolve);
    queueMultiplayerStateSync();

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
    playAgainButton.id = "playAgainButton";
    playAgainButton.textContent = "Play Again";

    playAgainButton.addEventListener("click", () => {
        const runtime = getMultiplayerRuntime();

        if (runtime?.isActive?.() && typeof runtime.handlePlayAgainClick === "function") {
            runtime.handlePlayAgainClick();
            return;
        }

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

function syncGameOverPopupForCurrentState() {
    if (gameState?.currentPhase !== "gameOver" || !gameOverState?.winnerPlayerKey) {
        removeGameOverPopup();
        return;
    }

    const winnerPlayer = gameState[gameOverState.winnerPlayerKey];

    if (!winnerPlayer) {
        return;
    }

    showGameOverPopup(
        winnerPlayer,
        gameOverState.reasonTitle || "Victory",
        gameOverState.reasonText || ""
    );
}

function endGame(winnerPlayer, reasonTitle = "Victory", reasonText = "") {
    gameState.currentPhase = "gameOver";
    gameOverState = {
        winnerPlayerKey: getPlayerKeyForPlayer(winnerPlayer),
        reasonTitle,
        reasonText
    };

    pendingAttack = null;
    currentAttack = null;
    pendingBlock = null;
    pendingTrashChoice = null;
    pendingReplacePlay = null;
    pendingOpponentAttackEffect = null;

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
    queueMultiplayerStateSync();
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

        const externalPhaseHandler = getMultiplayerRuntime()?.handlePhaseButtonClick;

        if (typeof externalPhaseHandler === "function") {
            externalPhaseHandler();
            return;
        }


        if (gameState.currentPhase === "gameOver") {
            return;
        }

        if (gameState.currentPhase === "diceRoll") {
            runDiceRollPhase(phaseButton, phaseInfo);
            queueMultiplayerStateSync();
            return;
        }

        if (gameState.currentPhase === "draw") {
            advanceDrawPhase(phaseButton, phaseInfo);
            queueMultiplayerStateSync();
            return;
        }

        if (gameState.currentPhase === "don") {
            advanceDonPhase(phaseButton, phaseInfo);
            queueMultiplayerStateSync();
            return;
        }

        if (gameState.currentPhase === "main") {
            if (window.isGameSettingEnabled?.("confirmEndTurn")) {
                showEndTurnConfirmation(phaseButton, phaseInfo);
            } else {
                passTurn(phaseButton, phaseInfo);
                queueMultiplayerStateSync();
            }
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

function showDiceRollAnimation(player1Roll, player2Roll, winner) {
    const phaseControls = document.querySelector(".phase-controls");

    if (!phaseControls) return;

    removeDiceRollDisplay();

    const display = document.createElement("div");
    display.className = "dice-roll-display";
    display.id = "diceRollDisplay";

    const player1Die = createD20Die({
        playerLabel: "Player 1",
        colorClass: "blue-d20",
        finalValue: player1Roll
    });

    const player2Die = createD20Die({
        playerLabel: "Player 2",
        colorClass: "red-d20",
        finalValue: player2Roll
    });

    const center = document.createElement("div");
    center.className = "dice-roll-center";
    center.textContent = "D20";

    const result = document.createElement("div");
    result.className = "dice-roll-result";
    result.textContent = `${winner.name} wins`;

    display.appendChild(player1Die.root);
    display.appendChild(center);
    display.appendChild(player2Die.root);
    display.appendChild(result);

    phaseControls.insertBefore(display, phaseControls.querySelector(".choice-buttons"));

    animateD20(player1Die.valueElement, player1Roll);
    animateD20(player2Die.valueElement, player2Roll);
}

function createD20Die({ playerLabel, colorClass, finalValue }) {
    const root = document.createElement("div");
    root.className = `d20-roll ${colorClass}`;

    const die = document.createElement("div");
    die.className = "d20-die rolling";

    const value = document.createElement("span");
    value.className = "d20-value";
    value.textContent = finalValue;

    const label = document.createElement("span");
    label.className = "d20-label";
    label.textContent = playerLabel;

    die.appendChild(value);
    root.appendChild(die);
    root.appendChild(label);

    return {
        root,
        valueElement: value
    };
}

function animateD20(valueElement, finalValue) {
    let ticks = 0;
    const die = valueElement.closest(".d20-die");

    const intervalId = window.setInterval(() => {
        ticks++;
        valueElement.textContent = Math.floor(Math.random() * 20) + 1;

        if (ticks >= 12) {
            window.clearInterval(intervalId);
            valueElement.textContent = finalValue;
            die?.classList.remove("rolling");
            die?.classList.add("rolled");
        }
    }, 55);
}

function removeDiceRollDisplay() {
    const oldDisplay = document.getElementById("diceRollDisplay");

    if (oldDisplay) {
        oldDisplay.remove();
    }
}

window.showDiceRollAnimation = showDiceRollAnimation;
window.removeDiceRollDisplay = removeDiceRollDisplay;

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

function showEndTurnConfirmation(phaseButton, phaseInfo) {
    const controls = document.querySelector(".phase-controls");

    if (!controls || gameState.currentPlayer !== gameState.player1) {
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
        queueMultiplayerStateSync();
    });

    cancelButton.addEventListener("click", () => {
        removeChoiceButtons();
        syncPhaseButtonForCurrentState();
    });

    choiceContainer.appendChild(confirmButton);
    choiceContainer.appendChild(cancelButton);
    controls.appendChild(choiceContainer);
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
            currentText = String(newText || "");
        }
    };
}

function normalizeLogMessage(message) {
    return String(message || "")
        .replace(/^\s*(<br>\s*)+/gi, "")
        .replace(/(<br>\s*){3,}/gi, "<br><br>")
        .trim();
}

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
        /wait for the defending player to choose/i,
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

    if (!isApplyingMultiplayerState) {
        syncedLogMessages.push(cleanMessage);
    }

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
    renderDeck(gameState.player1, "player1DeckArea", false);
    renderDeck(gameState.player2, "player2DeckArea", true);
}

function renderDeck(player, deckAreaId, hidden = false) {
    const deckArea = document.getElementById(deckAreaId);

    if (!deckArea) return;

    deckArea.innerHTML = "";

    deckArea.classList.remove("deck-warning");

    if (!hidden && player.deck.length > 0 && player.deck.length <= 2) {
        deckArea.classList.add("deck-warning");
    }

    if (player.deck.length > 0) {
        const img = document.createElement("img");

        img.src = cardBackImage;
        img.alt = `${player.name} Deck`;
        img.className = "deck-card-img";

        deckArea.appendChild(img);
    } else {
        deckArea.textContent = hidden ? "Deck" : "Deck Empty";
    }

    if (!hidden) {
        const count = document.createElement("div");
        count.className = "deck-count-badge main-deck-count";
        count.textContent = player.deck.length;

        deckArea.appendChild(count);
    }
}

// =========================
// Hand Rendering
// =========================

function renderHands() {
    renderPlayerHand(gameState.player1, "player1Hand", false);
    renderPlayerHand(gameState.player2, "player2Hand", true);
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

    if (!hidden) {
        const sortButton = document.createElement("button");
        sortButton.className = "hand-sort-button";
        sortButton.type = "button";
        sortButton.textContent = "Sort";
        sortButton.title = canSortPlayerHand(player)
            ? "Sort hand by category, cost, then card ID."
            : "Finish current effect or combat step before sorting your hand.";
        sortButton.disabled = !canSortPlayerHand(player);

        sortButton.addEventListener("click", async (event) => {
            event.stopPropagation();

            await sortPlayerHand(player);
        });

        handElement.appendChild(sortButton);
    }

    if (!hidden) {
        const count = document.createElement("div");

        count.className = "hand-count";
        count.textContent = player.hand.length;

        handElement.appendChild(count);
    }

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

function canSortPlayerHand(player) {
    if (!player || player !== gameState?.player1) {
        return false;
    }

    if (
        pendingReplacePlay ||
        pendingAttack ||
        currentAttack ||
        pendingBlock ||
        pendingTrashChoice ||
        pendingOpponentAttackEffect
    ) {
        return false;
    }

    return !document.getElementById("effectChoiceOverlay") &&
        !document.getElementById("lookTopOverlay") &&
        !document.getElementById("boardChoiceOverlay");
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
    renderPlayerLife(gameState.player2, "lifeArea", true);
    renderPlayerLife(gameState.player1, "opponentLifeArea", false);
}

function renderPlayerLife(player, lifeAreaId, hidden = false) {
    const lifeArea = document.getElementById(lifeAreaId);

    if (!lifeArea) return;

    lifeArea.querySelectorAll(".life-card").forEach(card => card.remove());
    lifeArea.querySelectorAll(".life-count").forEach(counter => counter.remove());

    player.life.forEach(lifeCard => {
        const cardElement = document.createElement("div");
        cardElement.className = "life-card";

        const img = document.createElement("img");

        img.src = hidden
            ? cardBackImage
            : lifeCard?.faceUp && lifeCard.image
            ? lifeCard.image
            : cardBackImage;
        img.alt = !hidden && lifeCard?.faceUp && lifeCard.name
            ? lifeCard.name
            : "Life Card";
        img.className = "life-card-img";

        cardElement.appendChild(img);
        lifeArea.appendChild(cardElement);
    });

    if (!hidden) {
        const count = document.createElement("div");

        count.className = "life-count";
        count.textContent = player.life.length;

        lifeArea.appendChild(count);
    }

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
        queueMultiplayerStateSync();

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

    const counterButton = document.createElement("button");

    counterButton.className = "card-action-button-on-card";

    if (!isDefender) {
        counterButton.disabled = true;
        counterButton.textContent = "Not Def.";
        counterButton.title = "Only the defending player can counter with their own hand.";
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
        queueMultiplayerStateSync();
    });

    selectedHandCard.appendChild(counterButton);
}

function applyCounterPowerToCurrentAttack(counterPower) {
    if (!currentAttack) return;

    currentAttack.targetPowerBonus =
        (currentAttack.targetPowerBonus || 0) + counterPower;

    renderLeaders();
    renderCharacters();
    queueMultiplayerStateSync();
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
    if (!isLocalMultiplayerPlayerKey(selectedBoardCardData.playerKey)) return;

    const actionButtons = [];
    const attackButton = document.createElement("button");
    const activateMainEffect = getActivateMainEffect(card);

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

    if (!isLocalMultiplayerPlayerKey(getPlayerKeyForPlayer(player))) {
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

        queueMultiplayerStateSync();
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
    return card?.effects?.find(effect => effect.type === "activateMain") || null;
}

function canUseActivateMainEffect(player, card, effect) {
    if (!player || !card || !effect) {
        return false;
    }

    if (!isLocalMultiplayerPlayerKey(getPlayerKeyForPlayer(player))) {
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

    activateMainButton.addEventListener("click", async (event) => {
        event.stopPropagation();

        if (activateMainButton.disabled) return;

        await activateMainBoardEffect(player, card, effect);
    });

    return activateMainButton;
}

async function activateMainBoardEffect(player, card, effect) {
    if (!canUseActivateMainEffect(player, card, effect)) {
        addGameLog(`${card.name}'s Activate: Main effect cannot be used right now.`);
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
                    addGameLog(`${player.name} skipped ${card.name}'s Activate: Main effect.`);
                    showSelectedBoardActions();
                    return;
                }

                await resolveActivateMainBoardEffect(player, card, effect);
            }
        });

        return;
    }

    await resolveActivateMainBoardEffect(player, card, effect);
}

async function resolveActivateMainBoardEffect(player, card, effect) {
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
    queueMultiplayerStateSync();
}

function resolveBoardActionEffect(player, card, effect) {
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

        card.state = "rested";
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

function isLocalMultiplayerPlayerKey(playerKey) {
    return playerKey === "player1";
}

function canLocalPlayerControlDefense(defenderPlayerKey) {
    return isLocalMultiplayerPlayerKey(defenderPlayerKey);
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

function createWaitingDefenseButton(defenderName, phaseLabel = "Waiting") {
    return createBattleButton(
        `${phaseLabel}: ${defenderName}`,
        () => {},
        true,
        "counter-phase"
    );
}

function showResolveAttackButton(defenderPlayerKey, onResolve) {
    const battleControls = document.getElementById("battleControls");

    if (!battleControls) return;

    clearBattleControls();

    if (currentAttack?.resolutionStep && currentAttack.resolutionStep !== "readyForDefense") {
        const waitingOn = currentAttack.resolutionStep === "attackerEffects"
            ? gameState[currentAttack.attackerPlayerKey]?.name ?? "Attacker"
            : gameState[defenderPlayerKey]?.name ?? "Defender";

        battleControls.appendChild(
            createWaitingDefenseButton(waitingOn, "Waiting")
        );
        return;
    }

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

    const defenderName = gameState[defenderPlayerKey]?.name ?? "Defender";

    if (!canLocalPlayerControlDefense(defenderPlayerKey)) {
        battleControls.appendChild(
            createWaitingDefenseButton(defenderName, "Waiting for Block")
        );
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

    if (currentAttack?.resolutionStep && currentAttack.resolutionStep !== "readyForDefense") {
        clearBattleControls();
        battleControls.appendChild(
            createWaitingDefenseButton(
                gameState[currentAttack.attackerPlayerKey]?.name ?? "Attacker",
                "Waiting"
            )
        );
        return;
    }

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
    const localPlayerControlsDefense = canLocalPlayerControlDefense(defenderPlayerKey);

    const resolveButton = createBattleButton(
        localPlayerControlsDefense
            ? `${defenderName}: Resolve Attack`
            : `Waiting for ${defenderName}`,
        async () => {
            if (typeof onResolve === "function") {
                await onResolve();
            }

            clearBattleControls();
        },
        !localPlayerControlsDefense,
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
    const localPlayerControlsDefense = canLocalPlayerControlDefense(defenderPlayerKey);

    const resolveButton = createBattleButton(
        localPlayerControlsDefense
            ? `${defenderName}: Resolve Attack`
            : `Waiting for ${defenderName}`,
        async () => {
            if (typeof onResolve === "function") {
                await onResolve();
            }

            clearBattleControls();
        },
        !localPlayerControlsDefense,
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
        targetPowerBonus: 0,
        resolutionStep: "defenderResponses"
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

    promptOnOpponentAttackCharacterEffects(defenderPlayer);
    queueMultiplayerStateSync();
}

function continueAttackAfterDefenderResponses() {
    if (
        !currentAttack ||
        currentAttack.resolutionStep === "readyForDefense" ||
        currentAttack.resolutionStep === "resolvingAttackerEffects"
    ) {
        return;
    }

    currentAttack.resolutionStep = "resolvingAttackerEffects";

    const attackerPlayer = gameState[currentAttack.attackerPlayerKey];
    const attackerData = currentAttack.attacker
        ? { ...currentAttack.attacker }
        : null;

    if (!attackerPlayer || !attackerData) {
        return;
    }

    resolveWhenAttackingEffectsBeforeBattle(
        attackerPlayer,
        attackerData,
        () => {
            if (!currentAttack) {
                return;
            }

            currentAttack.resolutionStep = "readyForDefense";
            showResolveAttackButton(currentAttack.defenderPlayerKey, () => {
                resolveCurrentAttack();
            });
            queueMultiplayerStateSync();
        }
    );
}

function promptOnOpponentAttackCharacterEffects(defenderPlayer) {
    const defenderPlayerKey = getPlayerKeyForPlayer(defenderPlayer);

    if (!defenderPlayerKey) {
        continueAttackAfterDefenderResponses();
        return;
    }

    const entries = defenderPlayer.characters
        .map((card, slotIndex) => ({
            slotIndex,
            hasEffect: getCardAllEffects(card)?.some(effect => effect.type === "onOpponentAttack")
        }))
        .filter(entry => entry.hasEffect)
        .map(entry => ({ slotIndex: entry.slotIndex }));

    if (entries.length === 0) {
        continueAttackAfterDefenderResponses();
        return;
    }

    pendingOpponentAttackEffect = {
        defenderPlayerKey,
        entries,
        currentIndex: 0
    };

    showPendingOpponentAttackEffectChoice();
    queueMultiplayerStateSync();
}

function getCurrentPendingOnOpponentAttackEffect() {
    if (!pendingOpponentAttackEffect) {
        return null;
    }

    const defenderPlayer = gameState?.[pendingOpponentAttackEffect.defenderPlayerKey];
    const entry = pendingOpponentAttackEffect.entries[pendingOpponentAttackEffect.currentIndex];

    if (!defenderPlayer || !entry) {
        return null;
    }

    const currentCard = defenderPlayer.characters?.[entry.slotIndex];
    const effect = getCardAllEffects(currentCard)?.find(cardEffect => cardEffect.type === "onOpponentAttack");

    if (!currentCard || !effect) {
        return null;
    }

    return {
        defenderPlayer,
        entry,
        currentCard,
        effect
    };
}

function currentAttackHasPendingWhenAttackingEffects() {
    if (!currentAttack) {
        return false;
    }

    const attackerCard = getBoardCardFromData(currentAttack.attacker);

    return Boolean(
        getCardAllEffects(attackerCard)?.some(effect => effect.type === "whenAttacking")
    );
}

function finishPendingOnOpponentAttackEffects() {
    pendingOpponentAttackEffect = null;
    removeEffectChoiceOverlay();

    if (!currentAttack) {
        clearBattleControls();
        queueMultiplayerStateSync();
        return;
    }

    if (!currentAttackHasPendingWhenAttackingEffects()) {
        currentAttack.resolutionStep = "readyForDefense";
        clearBattleControls();
        showResolveAttackButton(currentAttack.defenderPlayerKey, async () => {
            await resolveCurrentAttack();
            queueMultiplayerStateSync();
        });
        queueMultiplayerStateSync();
        return;
    }

    currentAttack.resolutionStep = "attackerEffects";

    if (currentAttack.attackerPlayerKey === "player1") {
        continueAttackAfterDefenderResponses();
        return;
    }

    clearBattleControls();

    const battleControls = document.getElementById("battleControls");
    const attackerName = gameState[currentAttack.attackerPlayerKey]?.name ?? "Attacker";

    if (battleControls) {
        battleControls.appendChild(
            createWaitingDefenseButton(attackerName, "Waiting for Attack Effects")
        );
    }

    queueMultiplayerStateSync();
}

function advancePendingOnOpponentAttackEffect() {
    if (!pendingOpponentAttackEffect) {
        return;
    }

    pendingOpponentAttackEffect.currentIndex += 1;

    while (pendingOpponentAttackEffect) {
        if (getCurrentPendingOnOpponentAttackEffect()) {
            showPendingOpponentAttackEffectChoice();
            queueMultiplayerStateSync();
            return;
        }

        if (pendingOpponentAttackEffect.currentIndex >= pendingOpponentAttackEffect.entries.length - 1) {
            break;
        }

        pendingOpponentAttackEffect.currentIndex += 1;
    }

    finishPendingOnOpponentAttackEffects();
}

function showPendingOpponentAttackEffectChoice() {
    if (!pendingOpponentAttackEffect) {
        return;
    }

    if (!canLocalPlayerControlDefense(pendingOpponentAttackEffect.defenderPlayerKey)) {
        removeEffectChoiceOverlay();
        return;
    }

    const effectState = getCurrentPendingOnOpponentAttackEffect();

    if (!effectState) {
        advancePendingOnOpponentAttackEffect();
        return;
    }

    const {
        defenderPlayer,
        entry,
        currentCard,
        effect
    } = effectState;
    const defenderPlayerKey = pendingOpponentAttackEffect.defenderPlayerKey;
    const endAttackBecauseTargetLeftField = (cardName) => {
        pendingOpponentAttackEffect = null;
        removeEffectChoiceOverlay();
        addGameLog(`${cardName} left the field, so the attack ends.`);

        currentAttack = null;
        pendingAttack = null;
        pendingBlock = null;

        clearAttackTargets();
        clearBlockerTargets();
        clearBattleControls();
        clearAttackArrow();

        gameState.currentPhase = "main";
        queueMultiplayerStateSync();
    };

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
                advancePendingOnOpponentAttackEffect();
                return;
            }

            if (effect.actionId === "trashThisDrawOne") {
                const trashedCard = defenderPlayer.characters[entry.slotIndex];

                if (trashedCard) {
                    defenderPlayer.characters[entry.slotIndex] = null;
                    moveCardToTrash(defenderPlayer, trashedCard, ui);
                    resolveGutsLeaderCharacterRemovedBonus(defenderPlayer, ui);
                    const linkedStageMessage = trashLinkedParfumStageForCharacter(defenderPlayer, trashedCard, ui);
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
                        currentAttack?.target?.playerKey === defenderPlayerKey &&
                        currentAttack.target.cardType === "character" &&
                        currentAttack.target.slotIndex === entry.slotIndex
                    ) {
                        endAttackBecauseTargetLeftField(trashedCard.name);
                        return;
                    }

                    advancePendingOnOpponentAttackEffect();
                    return;
                }
            }

            const message = resolveEffectAction(defenderPlayer, currentCard, effect, ui, {
                skipActivationPrompt: true
            });

            if (message) {
                addGameLog(message);
            }

            advancePendingOnOpponentAttackEffect();
        }
    });
}

function resolveWhenAttackingEffectsBeforeBattle(attackerPlayer, attackerData, onComplete) {
    const attackerCard = getBoardCardFromData(attackerData);

    promptOptionalWhenAttackingEffects(attackerPlayer, attackerCard, () => {
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

        if (trashEffect && !isAttackEffectSkipped(attackerCard, trashEffect.id)) {
            promptTrashOneCardForAttack(attackerPlayer, attackerCard, trashEffect, onComplete);
            return;
        }

        if (typeof onComplete === "function") {
            onComplete();
        }
    });
}

function promptOptionalWhenAttackingEffects(player, sourceCard, onComplete) {
    const optionalEffects = sourceCard?.effects
        ?.filter(effect => effect.type === "whenAttacking" && typeof isOptionalEffect === "function" && isOptionalEffect(effect)) ?? [];

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
    queueMultiplayerStateSync();
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
    queueMultiplayerStateSync();
}

async function resolveCurrentAttack() {
    if (!currentAttack) {
        clearBattleControls();
        gameState.currentPhase = "main";
        queueMultiplayerStateSync();
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
        queueMultiplayerStateSync();

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
            ui,
            { byBattle: true }
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

            const shouldBanishLife = CardEffects.shouldBanishLife(attackerCard);
            const lifeResult = shouldBanishLife
                ? banishLifeDamage(defenderPlayer, damageAmount, ui)
                : takeLifeDamage(defenderPlayer, damageAmount, ui);

            battleResultText += `<br>${lifeResult.message}`;

            if (lifeResult.success) {
                const upgradeMessage = resolveKurosakiIchigoDamageStageUpgrade(defenderPlayer, ui);

                if (upgradeMessage) {
                    battleResultText += `<br>${upgradeMessage}`;
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

    const finalizeAttackResolution = () => {
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
                "Final Attack",
                `${defenderPlayer.name} had no life cards left and took a successful leader attack.`
            );
            queueMultiplayerStateSync();
            return;
        }

        gameState.currentPhase = "main";
        queueMultiplayerStateSync();
    };

    if (ui?.hasDeferredCombatResolution?.()) {
        deferredAttackCleanup = finalizeAttackResolution;
        return;
    }

    finalizeAttackResolution();
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
    queueMultiplayerStateSync();
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
    allowTopOrBottomPlacement = false
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
        `Choose up to 1 valid card to add to ${player.name}'s hand. The rest go to the bottom of the deck.`;

    const cardGrid = document.createElement("div");
    cardGrid.className = "look-top-card-grid";

    let selectedIndex = null;

    const completeLookTopSelection = (selection) => {
        if (typeof onComplete === "function") {
            onComplete(selection);
        }

        queueMultiplayerStateSync();
    };

    const continueToBottomOrder = () => {
        const remainingCards = cards
            .map((card, index) => ({ card, index }))
            .filter(entry => entry.index !== selectedIndex);

        if (allowTopOrBottomPlacement) {
            if (remainingCards.length === 0) {
                removeLookTopOverlay();

                completeLookTopSelection({
                    selectedIndex,
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
                onComplete: completeLookTopSelection
            });
            return;
        }

        if (remainingCards.length <= 1) {
            removeLookTopOverlay();

            completeLookTopSelection({
                selectedIndex,
                bottomOrder: remainingCards.map(entry => entry.index)
            });

            return;
        }

        renderBottomOrderStep({
            player,
            sourceCard,
            remainingCards,
            selectedIndex,
            onComplete: completeLookTopSelection
        });
    };

    const selectCard = (cardButton, index, validChoice) => {
        if (!validChoice) return;

        selectedIndex = index;

        document.querySelectorAll(".look-top-card-button").forEach(button => {
            button.classList.remove("selected-look-card");
        });

        cardButton.classList.add("selected-look-card");

        addButton.disabled = false;
    };

    cards.forEach((card, index) => {
        const cardButton = document.createElement("button");
        cardButton.className = "look-top-card-button";

        const validChoice = isSelectable(card);

        if (!validChoice) {
            cardButton.classList.add("disabled-choice");
            cardButton.title = "This card is not a valid choice, but you can inspect it.";
        } else {
            cardButton.title = "Click to inspect. Use Select Card to add it.";
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
            selectCard(cardButton, index, validChoice);
            showSearchCardImagePopup(card, {
                canSelect: validChoice,
                onSelect: () => {
                    selectCard(cardButton, index, validChoice);
                    continueToBottomOrder();
                }
            });
        });

        cardGrid.appendChild(cardButton);
    });

    const buttonRow = document.createElement("div");
    buttonRow.className = "look-top-buttons";

    const addButton = document.createElement("button");
    addButton.className = "look-top-action-button";
    addButton.textContent = "Add Selected";
    addButton.disabled = true;

    const skipButton = document.createElement("button");
    skipButton.className = "look-top-action-button secondary";
    skipButton.textContent = "Add Nothing";

    addButton.addEventListener("click", () => {
        if (selectedIndex === null) return;

        continueToBottomOrder();
    });

    skipButton.addEventListener("click", () => {
        selectedIndex = null;

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
}

function renderTopBottomOrderStep({
    player,
    sourceCard,
    remainingCards,
    selectedIndex,
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

    remainingCards.forEach(entry => {
        const cardButton = document.createElement("button");
        cardButton.className = "look-top-card-button bottom-order-card-button";

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
            if (selectedOrder.includes(entry.index)) return;

            selectedOrder.push(entry.index);
            orderBadge.textContent = selectedOrder.length;
            cardButton.classList.add("selected-look-card", "bottom-order-selected");
            updateDoneState();
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

        cardGrid.querySelectorAll(".bottom-order-card-button").forEach(cardButton => {
            cardButton.classList.remove("selected-look-card", "bottom-order-selected");
            const orderBadge = cardButton.querySelector(".bottom-order-badge");

            if (orderBadge) {
                orderBadge.textContent = "";
            }
        });

        updateDoneState();
    });

    buttonRow.appendChild(resetButton);

    popup.appendChild(title);
    popup.appendChild(description);
    popup.appendChild(cardGrid);
    popup.appendChild(buttonRow);
    popup.appendChild(confirmRow);
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
        selectButton.textContent = "Select Card";
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
        name.textContent = choice.card.name;

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

        queueMultiplayerStateSync();
    });

    skipButton.addEventListener("click", async () => {
        removeBoardChoiceOverlay();

        if (typeof onComplete === "function") {
            await onComplete(null);
        }

        queueMultiplayerStateSync();
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

    const selectedOrder = [];
    const doneButton = document.createElement("button");

    const updateDoneState = () => {
        doneButton.disabled = selectedOrder.length !== remainingCards.length;
    };

    remainingCards.forEach(entry => {
        const cardButton = document.createElement("button");
        cardButton.className = "look-top-card-button bottom-order-card-button";

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
            if (selectedOrder.includes(entry.index)) return;

            selectedOrder.push(entry.index);
            orderBadge.textContent = selectedOrder.length;
            cardButton.classList.add("selected-look-card", "bottom-order-selected");
            updateDoneState();
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
                bottomOrder: selectedOrder
            });
        }

        queueMultiplayerStateSync();
    });

    resetButton.addEventListener("click", () => {
        selectedOrder.splice(0, selectedOrder.length);

        cardGrid.querySelectorAll(".bottom-order-card-button").forEach(cardButton => {
            cardButton.classList.remove("selected-look-card", "bottom-order-selected");
            const orderBadge = cardButton.querySelector(".bottom-order-badge");

            if (orderBadge) {
                orderBadge.textContent = "";
            }
        });

        updateDoneState();
    });

    buttonRow.appendChild(doneButton);
    buttonRow.appendChild(resetButton);

    popup.appendChild(title);
    popup.appendChild(description);
    popup.appendChild(cardGrid);
    popup.appendChild(buttonRow);
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
    const autoSelectedOption = window.getAutoSelectMaxValueOption?.(options);

    if (autoSelectedOption) {
        Promise.resolve().then(async () => {
            if (typeof onComplete === "function") {
                await onComplete(autoSelectedOption.value);
            }

            queueMultiplayerStateSync();
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

                if (typeof onComplete === "function") {
                    await onComplete(option.value);
                }

                queueMultiplayerStateSync();
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
        currentValue.textContent = `${value} cost`;
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

        queueMultiplayerStateSync();
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

    if (!isLocalMultiplayerPlayerKey(selectedBoardCardData.playerKey)) {
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

    return true;
}

function isCharacterAttackLocked(card, player) {
    if (!card?.cannotAttackUntil || !player) {
        return false;
    }

    const playerKey = getPlayerKey(player);

    if (card.cannotAttackUntil.expiresAtPlayerKey !== playerKey) {
        return false;
    }

    return Number(player.turns || 0) <= Number(card.cannotAttackUntil.expiresAtEndOfTurns ?? 0);
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

    if (card.ignorePlayedThisTurnCheck) {
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
    if (card?.temporaryBasePower && !isTemporaryBasePowerExpired(card.temporaryBasePower)) {
        return Number(card.temporaryBasePower.value ?? card.power ?? 0);
    }

    const owner = getPlayerForBoardCard(card);
    const copiedBasePower = getCopiedEffectBasePower(card, owner);

    if (copiedBasePower !== null) {
        return copiedBasePower;
    }

    const zangetsuBasePower = getZangetsuLeaderBasePower(card, owner);

    if (zangetsuBasePower !== null) {
        return zangetsuBasePower;
    }

    if (card?.cardNumber === "BK01-007") {
        const player = owner;

        if (player?.characters?.some(character => CardEffects.hasCardName(character, "Guts"))) {
            return 6000;
        }
    }

    return Number(card?.power ?? 0);
}

function getZangetsuLeaderBasePower(card, player) {
    if (!card || !player || card.cardType !== "leader") {
        return null;
    }

    if (!CardEffects.hasCardName(card, "Kurosaki Ichigo")) {
        return null;
    }

    const basePower = player.stage?.effects
        ?.filter(effect => effect.type === "continuous" && Number(effect.basePower || 0) > 0)
        .reduce((current, effect) => Number(effect.basePower || current || 0), 0) ?? 0;

    return basePower > 0 ? basePower : null;
}

function isTemporaryBasePowerExpired(basePowerEntry) {
    const playerKey = basePowerEntry?.expiresAtPlayerKey;
    const player = playerKey ? gameState?.[playerKey] : null;

    return Boolean(player && Number(player.turns || 0) > Number(basePowerEntry.expiresAtEndOfTurns ?? 0));
}

function getPowerModifier(card, player = null) {
    if (!card) {
        return 0;
    }

    return getCopiedEffectPowerModifier(card, player) +
        getYourTurnPowerBonus(card, player) +
        getTurboGrannyFormPowerModifier(card, player) +
        getSerpicoFarnesePowerModifier(card, player) +
        getGutsLeaderPowerModifier(card, player) +
        getKurosakiIchigoPowerModifier(card, player) +
        getRimuruTempestPowerModifier(card, player) +
        getOpponentTurnPowerModifier(card, player) +
        getAttachedDonPowerModifier(card, player) +
        getTemporaryPowerModifier(card) +
        getDurationPowerModifier(card) +
        getDonAttachedPowerModifier(card) +
        getBattlePowerModifier(card);
}

function getPlayerForBoardCard(card) {
    if (!card || !gameState) {
        return null;
    }

    return [gameState.player1, gameState.player2].find(player => {
        return player.leader === card || player.stage === card || player.characters.includes(card);
    }) || null;
}

function getYourTurnPowerBonus(card, player) {
    if (!card || !player) {
        return 0;
    }

    if (gameState.currentPlayer !== player) {
        return 0;
    }

    const leaderPowerEffect = getCardAllEffects(card)?.find(effect => {
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

    return getCardAllEffects(card)
        ?.filter(effect => effect.type === "opponentsTurn")
        .reduce((total, effect) => {
            return total + Number(effect.powerModifier ?? 0);
        }, 0) ?? 0;
}

function getDonAttachedPowerModifier(card) {
    if (!card) {
        return 0;
    }

    const attachedDon = Number(card.attachedDon ?? 0);

    return getCardAllEffects(card)
        ?.filter(effect => effect.type === "donAttached")
        .reduce((total, effect) => {
            const requiredDon = Number(effect.requiredDon ?? 0);

            if (attachedDon < requiredDon) {
                return total;
            }

            return total + Number(effect.powerModifier ?? 0);
        }, 0) ?? 0;
}

function getSerpicoFarnesePowerModifier(card, player) {
    if (!card || !player || card.cardType !== "character") {
        return 0;
    }

    if (!CardEffects.hasCardName(card, "Farnese")) {
        return 0;
    }

    return player.characters
        .filter(character => character?.cardNumber === "BK01-010")
        .reduce((total, character) => {
            const effect = character.effects?.find(cardEffect => cardEffect.id === "BK01-010-farnese-power");
            return total + Number(effect?.powerModifier ?? 0);
        }, 0);
}

function getGutsLeaderPowerModifier(card, player) {
    if (!card || !player || card.cardType !== "leader") {
        return 0;
    }

    if (!CardEffects.hasCardName(card, "Guts")) {
        return 0;
    }

    return player.characters
        .filter(character => character?.cardNumber === "BK01-016")
        .reduce((total, character) => {
            const effect = character.effects?.find(cardEffect => cardEffect.id === "BK01-016-guts-rush-leader-power");
            return total + Number(effect?.leaderPowerModifier ?? 0);
        }, 0);
}

function getRimuruTempestPowerModifier(card, player) {
    if (!card || !player || !player.leader || !CardEffects.hasCardName(player.leader, "Rimuru Tempest")) {
        return 0;
    }

    if (card.cardNumber === "RIM1-004") {
        return 1000;
    }

    return 0;
}

function getKurosakiIchigoPowerModifier(card, player) {
    if (!card || !player) {
        return 0;
    }

    let modifier = 0;

    if (card.cardNumber === "BL01-012") {
        modifier += Number(player.stage?.cost || 0) * 1000;
    }

    if (
        card.cardNumber === "BL01-014" &&
        player.characters.some(character => {
            return character?.cardType === "character" &&
                CardEffects.hasCardName(character, "Kurosaki Ichigo");
        })
    ) {
        modifier += 1000;
    }

    return modifier;
}

function getAttachedDonPowerModifier(card, player) {
    if (gameState.currentPlayer !== player) {
        return 0;
    }

    return Number(card?.attachedDon ?? 0) * 1000;
}

function getTemporaryPowerModifier(card) {
    return Number(card?.temporaryPowerBonus ?? 0);
}

function getDurationPowerModifier(card) {
    return card?.durationPowerBonuses
        ?.filter(entry => !isDurationPowerBonusExpired(card, entry))
        .reduce((total, entry) => total + Number(entry.amount ?? 0), 0) ?? 0;
}

function isDurationPowerBonusExpired(card, entry) {
    const fallbackPlayer = getPlayerForBoardCard(card);
    const expiringPlayer = entry?.expiresAtPlayerKey
        ? gameState?.[entry.expiresAtPlayerKey]
        : fallbackPlayer;

    if (!expiringPlayer) {
        return false;
    }

    return Number(expiringPlayer.turns || 0) > Number(entry.expiresAtEndOfTurns ?? 0);
}

function getBattlePowerModifier(card) {
    return Number(card?.battlePowerBonus ?? 0);
}

function getCopiedEffectBasePower(card, player) {
    if (!card || !player) {
        return null;
    }

    return card.temporaryCopiedEffects
        ?.reduce((currentBasePower, effect) => {
            if (currentBasePower !== null) {
                return currentBasePower;
            }

            if (
                effect.id === "BK01-007-guts-base-power" &&
                player.characters?.some(character => CardEffects.hasCardName(character, "Guts"))
            ) {
                return Number(effect.conditionalBasePower ?? 6000);
            }

            return null;
        }, null) ?? null;
}

function getCopiedEffectPowerModifier(card, player) {
    if (!card || !player) {
        return 0;
    }

    return card.temporaryCopiedEffects
        ?.reduce((total, effect) => {
            if (effect.id === "BL01-012-stage-cost-power") {
                return total + Number(player.stage?.cost ?? 0) * 1000;
            }

            if (effect.id === "BL01-014-ichigo-character-power") {
                return player.characters?.some(character => {
                    return character?.cardType === "character" &&
                        CardEffects.hasCardName(character, "Kurosaki Ichigo");
                })
                    ? total + 1000
                    : total;
            }

            if (
                effect.id === "RIM1-004-rimuru-power" &&
                player.leader &&
                CardEffects.hasCardName(player.leader, "Rimuru Tempest")
            ) {
                return total + 1000;
            }

            if (
                effect.type === "continuous" &&
                Number(effect.powerModifier ?? 0) !== 0 &&
                copiedEffectTargetsThisCard(effect)
            ) {
                return total + Number(effect.powerModifier ?? 0);
            }

            return total;
        }, 0) ?? 0;
}

function copiedEffectTargetsThisCard(effect) {
    const text = String(effect?.text || "").toLowerCase();

    return text.includes("this card") ||
        text.includes("this character") ||
        text.includes("this leader");
}

function getCostModifier(card) {
    return card?.costModifiers
        ?.reduce((total, entry) => total + Number(entry.amount ?? 0), 0) ?? 0;
}

function renderCostModifierBadge(card, container) {
    if (!card || !container || (card.cardType !== "character" && card.cardType !== "stage")) {
        return;
    }

    const printedCost = Number(card.cost ?? card.playCost ?? 0);
    const modifier = getCostModifier(card);
    const currentCost = Math.max(0, printedCost + modifier);
    const sign = modifier > 0 ? "+" : "";
    const badge = document.createElement("div");

    badge.className = modifier < 0
        ? "cost-modifier-badge cost-modifier-negative"
        : modifier > 0
            ? "cost-modifier-badge cost-modifier-positive"
            : "cost-modifier-badge cost-modifier-neutral";
    badge.textContent = `${currentCost}`;
    badge.title = modifier === 0
        ? `Printed cost: ${printedCost}`
        : `Printed cost: ${printedCost}. Modifier: ${sign}${modifier}. Current cost: ${currentCost}.`;

    container.appendChild(badge);
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
    const currentBasePower = getPrintedPower(card);
    const currentPower = currentBasePower + modifier;

    badge.className = modifier > 0
        ? "power-modifier-badge power-modifier-positive"
        : "power-modifier-badge power-modifier-negative";

    badge.textContent = `${sign}${modifier}`;
    badge.title = `Current power: ${currentPower} (${currentBasePower} ${sign}${modifier})`;

    container.appendChild(badge);
}

function renderBasePowerBadge(card, player, container, boardCardData = null) {
    if (!card || !player || !container || (card.cardType !== "leader" && card.cardType !== "character")) {
        return;
    }

    const printedBasePower = Number(card?.power ?? 0);
    const currentBasePower = getPrintedPower(card);
    const badge = document.createElement("div");

    badge.className = "base-power-badge";
    badge.textContent = `${currentBasePower}`;
    badge.title = currentBasePower !== printedBasePower
        ? `Printed base power: ${printedBasePower}. Current base power: ${currentBasePower}.`
        : `Base power: ${currentBasePower}`;

    container.appendChild(badge);
}

function renderAttachedDonBadge(card, container) {
    if (!card || !container) {
        return;
    }

    const attachedDon = Number(card.attachedDon ?? 0);

    const badge = document.createElement("div");
    badge.className = attachedDon > 0
        ? "attached-don-badge"
        : "attached-don-badge attached-don-empty";
    badge.textContent = `DON!! x${attachedDon}`;
    badge.title = attachedDon > 0
        ? `${attachedDon} attached DON!!: +${attachedDon * 1000} power`
        : "No attached DON!!";

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

function exportMultiplayerSharedState() {
    if (!gameState) {
        return null;
    }

    return {
        players: {
            p1: serializePlayerState(
                gameState[getLocalPlayerKeyForCanonicalSlot("p1")]
            ),
            p2: serializePlayerState(
                gameState[getLocalPlayerKeyForCanonicalSlot("p2")]
            )
        },
        diceWinnerSlot: gameState.diceWinner?.multiplayerSlot || null,
        firstPlayerSlot: gameState.firstPlayer?.multiplayerSlot || null,
        secondPlayerSlot: gameState.secondPlayer?.multiplayerSlot || null,
        currentPlayerSlot: gameState.currentPlayer?.multiplayerSlot || null,
        turnNumber: Number(gameState.turnNumber || 1),
        currentPhase: gameState.currentPhase || "diceRoll",
        gameOver: gameOverState
            ? cloneSerializableValue(gameOverState)
            : null,
        battle: {
            pendingAttack: pendingAttack
                ? {
                    ...cloneSerializableValue(pendingAttack),
                    attacker: mapBoardCardDataToCanonical(pendingAttack.attacker),
                    attackerPlayerKey: getCanonicalSlotForLocalPlayerKey(pendingAttack.attackerPlayerKey),
                    defenderPlayerKey: getCanonicalSlotForLocalPlayerKey(pendingAttack.defenderPlayerKey)
                }
                : null,
            currentAttack: currentAttack
                ? {
                    ...cloneSerializableValue(currentAttack),
                    attacker: mapBoardCardDataToCanonical(currentAttack.attacker),
                    target: mapBoardCardDataToCanonical(currentAttack.target),
                    attackerPlayerKey: getCanonicalSlotForLocalPlayerKey(currentAttack.attackerPlayerKey),
                    defenderPlayerKey: getCanonicalSlotForLocalPlayerKey(currentAttack.defenderPlayerKey)
                }
                : null,
            pendingBlock: pendingBlock
                ? {
                    defenderPlayerKey: getCanonicalSlotForLocalPlayerKey(pendingBlock.defenderPlayerKey)
                }
                : null,
            pendingTrashChoice: pendingTrashChoice
                ? {
                    ...cloneSerializableValue(pendingTrashChoice),
                    playerKey: getCanonicalSlotForLocalPlayerKey(pendingTrashChoice.playerKey),
                    onComplete: null
                }
                : null,
            pendingOpponentAttackEffect: pendingOpponentAttackEffect
                ? {
                    ...cloneSerializableValue(pendingOpponentAttackEffect),
                    defenderPlayerKey: getCanonicalSlotForLocalPlayerKey(pendingOpponentAttackEffect.defenderPlayerKey)
                }
                : null
        },
        logs: cloneSerializableValue(syncedLogMessages)
    };
}

function applyMultiplayerSharedState(snapshot) {
    if (!snapshot) {
        return;
    }

    const localSlot = getMultiplayerLocalSlot();
    const opponentSlot = getOpponentMultiplayerSlot(localSlot);
    const localPlayer1 = hydratePlayerState(snapshot.players?.[localSlot], localSlot);
    const localPlayer2 = hydratePlayerState(snapshot.players?.[opponentSlot], opponentSlot);
    const localState = {
        player1: localPlayer1,
        player2: localPlayer2,
        diceWinner: null,
        firstPlayer: null,
        secondPlayer: null,
        currentPlayer: null,
        turnNumber: Number(snapshot.turnNumber || 1),
        currentPhase: snapshot.currentPhase || "diceRoll"
    };

    const localPlayerBySlot = {
        [localSlot]: localPlayer1,
        [opponentSlot]: localPlayer2
    };

    localState.diceWinner = snapshot.diceWinnerSlot
        ? localPlayerBySlot[snapshot.diceWinnerSlot] || null
        : null;
    localState.firstPlayer = snapshot.firstPlayerSlot
        ? localPlayerBySlot[snapshot.firstPlayerSlot] || null
        : null;
    localState.secondPlayer = snapshot.secondPlayerSlot
        ? localPlayerBySlot[snapshot.secondPlayerSlot] || null
        : null;
    localState.currentPlayer = snapshot.currentPlayerSlot
        ? localPlayerBySlot[snapshot.currentPlayerSlot] || null
        : null;

    isApplyingMultiplayerState = true;

    try {
        gameState = localState;
        pendingAttack = snapshot.battle?.pendingAttack
            ? {
                ...cloneSerializableValue(snapshot.battle.pendingAttack),
                attacker: mapBoardCardDataToLocal(snapshot.battle.pendingAttack.attacker),
                attackerPlayerKey: getLocalPlayerKeyForCanonicalSlot(snapshot.battle.pendingAttack.attackerPlayerKey),
                defenderPlayerKey: getLocalPlayerKeyForCanonicalSlot(snapshot.battle.pendingAttack.defenderPlayerKey)
            }
            : null;
        currentAttack = snapshot.battle?.currentAttack
            ? {
                ...cloneSerializableValue(snapshot.battle.currentAttack),
                attacker: mapBoardCardDataToLocal(snapshot.battle.currentAttack.attacker),
                target: mapBoardCardDataToLocal(snapshot.battle.currentAttack.target),
                attackerPlayerKey: getLocalPlayerKeyForCanonicalSlot(snapshot.battle.currentAttack.attackerPlayerKey),
                defenderPlayerKey: getLocalPlayerKeyForCanonicalSlot(snapshot.battle.currentAttack.defenderPlayerKey)
            }
            : null;
        pendingBlock = snapshot.battle?.pendingBlock
            ? {
                defenderPlayerKey: getLocalPlayerKeyForCanonicalSlot(snapshot.battle.pendingBlock.defenderPlayerKey),
                onResolve: () => {
                    resolveCurrentAttack();
                    queueMultiplayerStateSync();
                }
            }
            : null;
        pendingTrashChoice = snapshot.battle?.pendingTrashChoice
            ? {
                ...cloneSerializableValue(snapshot.battle.pendingTrashChoice),
                playerKey: getLocalPlayerKeyForCanonicalSlot(snapshot.battle.pendingTrashChoice.playerKey),
                onComplete: null
            }
            : null;
        pendingOpponentAttackEffect = snapshot.battle?.pendingOpponentAttackEffect
            ? {
                ...cloneSerializableValue(snapshot.battle.pendingOpponentAttackEffect),
                defenderPlayerKey: getLocalPlayerKeyForCanonicalSlot(snapshot.battle.pendingOpponentAttackEffect.defenderPlayerKey)
            }
            : null;
        gameOverState = snapshot.gameOver
            ? cloneSerializableValue(snapshot.gameOver)
            : null;
        syncedLogMessages = Array.isArray(snapshot.logs)
            ? cloneSerializableValue(snapshot.logs)
            : [];

        renderGameLogMessages(syncedLogMessages);
        renderFullGameState();
    } finally {
        isApplyingMultiplayerState = false;
    }
}

window.queueMultiplayerStateSync = queueMultiplayerStateSync;
window.multiplayerPageApi = {
    applySharedState: applyMultiplayerSharedState,
    exportSharedState: exportMultiplayerSharedState,
    renderState: renderFullGameState,
    normalizeLogMessage
};

// =========================
// General Helpers
// =========================

function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
}
