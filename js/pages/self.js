// self.js

// =========================
// Image Paths
// =========================

const cardBackImage = "../images/basic/card-back-normal.jpg";
const donBackImage = "../images/basic/card-back-don.webp";
const donImage = "../images/basic/card-front-don.webp";

// =========================
// Online Stuff
// =========================

const urlParams = new URLSearchParams(window.location.search);

const gameMode = urlParams.get("mode") || "local";
const roomCode = urlParams.get("room");
const playerSlot = urlParams.get("player");

const isOnlineMatch = gameMode === "online";
const onlinePlayerLabels = {
    p1: "Player 1",
    p2: "Player 2"
};

let onlineMultiplayerService = null;
let onlineFirebaseApp = null;
let onlineMatchUnsubscribe = null;
let onlinePrivateUnsubscribe = null;
let onlineUser = null;
let onlinePublicState = null;
let onlinePrivateState = null;
let lastOnlineTurnKey = null;
let onlineProcessedTurnKey = null;
let onlineLastRevealKey = null;
let onlineLastAttackKey = null;
let onlineActiveAttackId = null;

if (isOnlineMatch) {
    console.log("Online match loaded.");
    console.log("Room code:", roomCode);
    console.log("Player slot:", playerSlot);
}

const onlineMatchInfo = document.getElementById("onlineMatchInfo");

if (isOnlineMatch) {
    updateOnlineMatchInfo();
}

function getPlayerKeyFromOnlineSlot(slot) {
    if (slot === "p1") return "player1";
    if (slot === "p2") return "player2";

    return null;
}

function getOnlineSlotFromPlayerKey(playerKey) {
    if (playerKey === "player1") return "p1";
    if (playerKey === "player2") return "p2";

    return null;
}

function isCurrentOnlinePlayer() {
    return Boolean(onlinePublicState?.currentPlayer && onlinePublicState.currentPlayer === playerSlot);
}

function getOwnOnlinePlayerKey() {
    return getPlayerKeyFromOnlineSlot(playerSlot);
}

function getOnlinePublicPlayerKey(playerKey) {
    return playerKey === "player1" ? "player1" : "player2";
}

function createHiddenCards(count) {
    return Array.from({ length: Number(count || 0) }, (_, index) => ({
        instanceId: `hidden-${index}`,
        hidden: true
    }));
}

function getOnlinePlayerSnapshot(playerKey) {
    return onlinePublicState?.[getOnlinePublicPlayerKey(playerKey)] || null;
}

function applyOnlinePlayerState(playerKey) {
    const publicPlayer = getOnlinePlayerSnapshot(playerKey);
    const player = gameState?.[playerKey];

    if (!publicPlayer || !player) return;

    const isOwnPlayer = playerKey === getOwnOnlinePlayerKey();

    player.name = playerKey === "player1" ? "Player 1" : "Player 2";
    player.leader = publicPlayer.leader;
    player.characters = publicPlayer.characters || [];
    player.stage = publicPlayer.stage || null;
    player.trash = publicPlayer.trash || [];
    player.don = Number(publicPlayer.activeTokens || 0);
    player.restedDon = Number(publicPlayer.restedTokens || 0);
    player.donDeck = Number(publicPlayer.tokenDeckCount ?? 10);
    player.turns = Number(publicPlayer.turns || 0);

    if (isOwnPlayer && onlinePrivateState) {
        player.hand = onlinePrivateState.hand || [];
        player.deck = onlinePrivateState.deck || [];
        player.life = onlinePrivateState.life || [];
    } else {
        player.hand = createHiddenCards(publicPlayer.handCount);
        player.deck = createHiddenCards(publicPlayer.deckCount);
        player.life = createHiddenCards(publicPlayer.lifeCount);
    }
}

function renderOnlineGameState() {
    if (!gameState) return;

    clearHandSelection();
    clearBoardSelection();
    clearSelectedCardActions();
    clearSelectedBoardActions();

    updateDonDisplay();
    renderDecks();
    renderDonDecks();
    renderLifeCards();
    renderLeaders();
    renderHands();
    renderCharacters();
    renderTrash();
    renderStages();
}

function applyOnlineStateToGame() {
    if (!isOnlineMatch || !gameState || !onlinePublicState?.player1 || !onlinePublicState?.player2) {
        return;
    }

    const currentPlayerKey = getPlayerKeyFromOnlineSlot(onlinePublicState.currentPlayer);

    applyOnlinePlayerState("player1");
    applyOnlinePlayerState("player2");

    gameState.currentPlayer = currentPlayerKey ? gameState[currentPlayerKey] : null;
    gameState.currentPhase = onlinePublicState.phase || "main";
    gameState.turnNumber = Number(onlinePublicState.turnNumber || 1);

    renderOnlineGameState();
    updateOnlinePhaseButton();
}

function updateOnlineMatchInfo() {
    if (!onlineMatchInfo) return;

    onlineMatchInfo.classList.remove("hidden");

    const currentPlayer = onlinePublicState?.currentPlayer;
    const currentPlayerText = currentPlayer
        ? onlinePlayerLabels[currentPlayer] || currentPlayer.toUpperCase()
        : "Waiting";
    const phaseText = onlinePublicState?.phase || "Waiting";
    const turnText = onlinePublicState?.turnNumber ?? "-";
    const dice = onlinePublicState?.setup?.dice || {};
    const setupText = onlinePublicState?.phase === "diceRoll"
        ? `Rolls: P1 ${dice.p1Roll || "-"} / P2 ${dice.p2Roll || "-"}${dice.tie ? " (tie)" : ""}`
        : `Turn #: ${turnText}`;

    onlineMatchInfo.textContent = [
        `Online Room: ${roomCode || "Unknown"}`,
        `You are ${(playerSlot || "unknown").toUpperCase()}`,
        `Turn: ${currentPlayerText}`,
        `Phase: ${phaseText}`,
        setupText
    ].join(" | ");
}

function updateOnlinePhaseButton() {
    if (!isOnlineMatch) return;

    const phaseButton = document.getElementById("phaseButton");

    if (!phaseButton) return;

    const currentPlayer = onlinePublicState?.currentPlayer;
    const currentPlayerText = currentPlayer
        ? onlinePlayerLabels[currentPlayer] || currentPlayer.toUpperCase()
        : "Waiting";
    const dice = onlinePublicState?.setup?.dice || {};
    const turnChoice = onlinePublicState?.setup?.turnChoice || {};

    removeOnlineTurnChoiceButtons();
    removeOnlineMulliganButtons();

    if (onlinePublicState?.phase === "diceRoll") {
        const ownRoll = dice[`${playerSlot}Roll`];
        const canRoll = Boolean(onlineMultiplayerService && !dice.winner && (!ownRoll || dice.tie));

        phaseButton.style.display = "block";
        phaseButton.disabled = !canRoll;
        phaseButton.textContent = dice.tie
            ? "Reroll"
            : ownRoll
                ? "Waiting for roll"
                : "Roll Dice";
        phaseButton.title = dice.tie
            ? "Tie roll. Both players must reroll."
            : "Both players roll before turn order is chosen.";

        if (dice.winner === playerSlot && !turnChoice.firstPlayer) {
            phaseButton.disabled = true;
            phaseButton.textContent = "Choose Turn Order";
            createOnlineTurnChoiceButtons();
        }

        return;
    }

    if (onlinePublicState?.phase === "mulligan") {
        const mulligan = onlinePublicState.setup?.mulligan || {};
        const ownMulligan = mulligan[playerSlot] || {};

        phaseButton.style.display = "block";
        phaseButton.disabled = true;
        phaseButton.textContent = ownMulligan.done
            ? "Waiting for Mulligan"
            : "Choose Mulligan";
        phaseButton.title = "Both players must keep or mulligan before turn one starts.";

        if (!ownMulligan.done) {
            createOnlineMulliganButtons();
        }

        return;
    }

    const canPass = Boolean(
        onlineMultiplayerService &&
        roomCode &&
        onlinePrivateState &&
        isCurrentOnlinePlayer() &&
        onlinePublicState?.phase === "main"
    );

    phaseButton.style.display = "block";
    phaseButton.disabled = !canPass;
    phaseButton.textContent = canPass
        ? `End Turn (${onlinePlayerLabels[playerSlot] || playerSlot?.toUpperCase()})`
        : `Waiting for ${currentPlayerText}`;
    phaseButton.title = canPass
        ? "End your synced online turn."
        : "Only the current online player can end the turn.";
}

function applyOnlinePublicState(publicState = {}) {
    if (!isOnlineMatch) return;

    onlinePublicState = {
        phase: publicState.phase || "main",
        currentPlayer: publicState.currentPlayer || null,
        turnNumber: Number(publicState.turnNumber || 1),
        winner: publicState.winner || null,
        firstPlayer: publicState.firstPlayer || null,
        secondPlayer: publicState.secondPlayer || null,
        playerTurns: publicState.playerTurns || { p1: 0, p2: 0 },
        setup: publicState.setup || {},
        revealedCards: publicState.revealedCards || [],
        currentAttack: publicState.currentAttack || null,
        player1: publicState.player1 || null,
        player2: publicState.player2 || null
    };

    const turnKey = `${onlinePublicState.currentPlayer}:${onlinePublicState.turnNumber}:${onlinePublicState.phase}`;

    if (lastOnlineTurnKey && turnKey !== lastOnlineTurnKey) {
        addGameLog(
            `Online state updated: ${onlinePlayerLabels[onlinePublicState.currentPlayer] || "Waiting"} ` +
            `- ${onlinePublicState.phase}, turn ${onlinePublicState.turnNumber}.`
        );
    }

    lastOnlineTurnKey = turnKey;

    applyOnlineStateToGame();
    updateOnlineMatchInfo();
    updateOnlinePhaseButton();
    maybeRunOnlineTurnStart(turnKey);
    showOnlineRevealedCards();
    showOnlineAttackLog();
    applyOnlineCurrentAttack();
}

function removeOnlineTurnChoiceButtons() {
    document.getElementById("onlineTurnChoiceButtons")?.remove();
}

function removeOnlineMulliganButtons() {
    document.getElementById("onlineMulliganButtons")?.remove();
}

function createOnlineTurnChoiceButtons() {
    if (document.getElementById("onlineTurnChoiceButtons")) return;

    const controls = document.querySelector(".phase-controls");

    if (!controls) return;

    const choiceContainer = document.createElement("div");
    choiceContainer.className = "choice-buttons";
    choiceContainer.id = "onlineTurnChoiceButtons";

    const firstButton = document.createElement("button");
    firstButton.className = "phase-button";
    firstButton.textContent = "Go 1st";

    const secondButton = document.createElement("button");
    secondButton.className = "phase-button";
    secondButton.textContent = "Go 2nd";

    firstButton.addEventListener("click", () => {
        handleOnlineTurnChoice("first");
    });

    secondButton.addEventListener("click", () => {
        handleOnlineTurnChoice("second");
    });

    choiceContainer.appendChild(firstButton);
    choiceContainer.appendChild(secondButton);
    controls.appendChild(choiceContainer);
}

function createOnlineMulliganButtons() {
    if (document.getElementById("onlineMulliganButtons")) return;

    const controls = document.querySelector(".phase-controls");

    if (!controls) return;

    const choiceContainer = document.createElement("div");
    choiceContainer.className = "choice-buttons";
    choiceContainer.id = "onlineMulliganButtons";

    const keepButton = document.createElement("button");
    keepButton.className = "phase-button";
    keepButton.textContent = "Keep Hand";

    const mulliganButton = document.createElement("button");
    mulliganButton.className = "phase-button";
    mulliganButton.textContent = "Mulligan";

    keepButton.addEventListener("click", () => {
        handleOnlineMulligan(false);
    });

    mulliganButton.addEventListener("click", () => {
        handleOnlineMulligan(true);
    });

    choiceContainer.appendChild(keepButton);
    choiceContainer.appendChild(mulliganButton);
    controls.appendChild(choiceContainer);
}

function showOnlineRevealedCards() {
    const revealedCards = onlinePublicState?.revealedCards || [];

    if (!revealedCards.length) return;

    const latestReveal = revealedCards[revealedCards.length - 1];
    const cards = latestReveal.cards || [];

    const revealKey = latestReveal.id || `${latestReveal.player}:${cards.map(card => card.instanceId || card.cardNumber || card.name).join(",")}`;

    if (!cards.length || onlineLastRevealKey === revealKey) return;

    onlineLastRevealKey = revealKey;

    addGameLog(
        `${onlinePlayerLabels[latestReveal.player] || "Player"} revealed: ` +
        cards.map(card => card.name).join(", ")
    );
}

function showOnlineAttackLog() {
    const attack = onlinePublicState?.currentAttack;

    if (!attack?.id || onlineLastAttackKey === attack.id) return;

    onlineLastAttackKey = attack.id;

    addGameLog(
        `${onlinePlayerLabels[attack.attackerSlot] || "Player"} attacked ` +
        `${onlinePlayerLabels[attack.defenderSlot] || "opponent"}.`
    );
}

function applyOnlineCurrentAttack() {
    const attack = onlinePublicState?.currentAttack;

    if (!isOnlineMatch || !gameState) return;

    if (!attack) {
        onlineActiveAttackId = null;
        return;
    }

    const attackerPlayerKey = getPlayerKeyFromOnlineSlot(attack.attackerSlot);
    const defenderPlayerKey = getPlayerKeyFromOnlineSlot(attack.defenderSlot);

    if (!attackerPlayerKey || !defenderPlayerKey) return;

    if (onlineActiveAttackId === attack.id && currentAttack) {
        currentAttack.targetPowerBonus = Number(attack.targetPowerBonus || 0);
        renderLeaders();
        renderCharacters();
        return;
    }

    onlineActiveAttackId = attack.id;
    currentAttack = {
        attacker: { ...attack.attacker },
        target: { ...attack.target },
        attackerPlayerKey,
        defenderPlayerKey,
        targetPowerBonus: Number(attack.targetPowerBonus || 0)
    };
    pendingAttack = null;
    gameState.currentPhase = "attackResolving";

    clearAttackTargets();
    clearBoardSelection();
    clearHandSelection();
    drawAttackArrow(currentAttack.attacker, currentAttack.target);

    if (attack.defenderSlot === playerSlot) {
        showResolveAttackButton(defenderPlayerKey, () => resolveCurrentAttack());
    } else {
        clearBattleControls();
    }
}

async function publishOnlineReveal(cards) {
    if (!isOnlineMatch || !onlineMultiplayerService || !cards?.length) return;

    const revealedCards = onlinePublicState?.revealedCards || [];

    await onlineMultiplayerService.updatePublicState(roomCode, {
        revealedCards: [
            ...revealedCards,
            {
                id: crypto.randomUUID(),
                player: playerSlot,
                cards: cards.map(card => ({
                    name: card.name,
                    image: card.image,
                    cardNumber: card.cardNumber,
                    cardType: card.cardType,
                    type: card.type
                }))
            }
        ]
    });
}

async function syncOnlineCurrentAttack(attackState) {
    if (!isOnlineMatch || !onlineMultiplayerService) return;

    await onlineMultiplayerService.updateCurrentAttack(roomCode, attackState);
}

function applyOnlinePrivateState(privateState = {}) {
    if (!isOnlineMatch) return;

    onlinePrivateState = {
        selectedDeck: privateState.selectedDeck || null,
        hand: privateState.hand || [],
        deck: privateState.deck || [],
        life: privateState.life || []
    };

    applyOnlineStateToGame();
    updateOnlinePhaseButton();

    if (onlinePublicState) {
        maybeRunOnlineTurnStart(
            `${onlinePublicState.currentPlayer}:${onlinePublicState.turnNumber}:${onlinePublicState.phase}`
        );
    }
}

function createPublicPlayerStateFromLocal(player) {
    return {
        leader: player.leader,
        characters: player.characters || [],
        stage: player.stage || null,
        trash: player.trash || [],
        handCount: player.hand?.length || 0,
        deckCount: player.deck?.length || 0,
        lifeCount: player.life?.length || 0,
        activeTokens: Number(player.don || 0),
        restedTokens: Number(player.restedDon || 0),
        tokenDeckCount: Number(player.donDeck ?? 10),
        turns: Number(player.turns || 0)
    };
}

function createOwnPrivateStateFromLocal(player) {
    return {
        selectedDeck: onlinePrivateState?.selectedDeck || null,
        hand: player.hand || [],
        deck: player.deck || [],
        life: player.life || []
    };
}

async function syncOnlineStateFromLocal() {
    if (!isOnlineMatch || !onlineMultiplayerService || !onlineUser || !gameState) return;

    const ownPlayerKey = getOwnOnlinePlayerKey();
    const ownPlayer = ownPlayerKey ? gameState[ownPlayerKey] : null;

    if (!ownPlayer) return;

    const publicKey = getOnlinePublicPlayerKey(ownPlayerKey);

    await onlineMultiplayerService.sendMultiplayerAction(
        roomCode,
        onlineUser,
        "updateState",
        {
            publicState: {
                phase: gameState.currentPhase,
                currentPlayer: onlinePublicState?.currentPlayer || playerSlot,
                turnNumber: Number(gameState.turnNumber || onlinePublicState?.turnNumber || 1),
                winner: onlinePublicState?.winner || null,
                playerTurns: {
                    ...(onlinePublicState?.playerTurns || {}),
                    [playerSlot]: Number(ownPlayer.turns || 0)
                },
                [publicKey]: createPublicPlayerStateFromLocal(ownPlayer)
            },
            privateState: createOwnPrivateStateFromLocal(ownPlayer)
        }
    );
}

async function syncOnlinePublicBoardFromLocal(extraState = {}) {
    if (!isOnlineMatch || !onlineMultiplayerService || !gameState) return;

    await onlineMultiplayerService.updatePublicState(roomCode, {
        player1: createPublicPlayerStateFromLocal(gameState.player1),
        player2: createPublicPlayerStateFromLocal(gameState.player2),
        phase: gameState.currentPhase,
        currentPlayer: onlinePublicState?.currentPlayer || playerSlot,
        turnNumber: Number(gameState.turnNumber || onlinePublicState?.turnNumber || 1),
        winner: onlinePublicState?.winner || null,
        ...extraState
    });
}

async function maybeRunOnlineTurnStart(turnKey) {
    if (!isOnlineMatch || !onlinePrivateState || !gameState || !isCurrentOnlinePlayer()) {
        return;
    }

    const player = gameState[getOwnOnlinePlayerKey()];

    if (!player) return;

    if (!onlineProcessedTurnKey) {
        onlineProcessedTurnKey = turnKey;

        if (Number(player.turns || 0) > 0) {
            return;
        }
    } else if (onlineProcessedTurnKey === turnKey) {
        return;
    } else {
        onlineProcessedTurnKey = turnKey;
    }

    const phaseInfo = createPhaseLogProxy();

    player.turns++;
    player.leaderAttacksThisTurn = 0;

    runRefreshPhase(player, phaseInfo);
    const drawResult = runDrawPhase(player, phaseInfo);

    if (drawResult?.deckOut || gameState.currentPhase === "gameOver") {
        await syncOnlineStateFromLocal();
        return;
    }

    runDonPhase(player, 2, phaseInfo);

    gameState.currentPhase = "main";

    await syncOnlineStateFromLocal();
    updateOnlinePhaseButton();
}

async function initializeOnlineMultiplayer() {
    if (!isOnlineMatch) return;

    if (!roomCode || !playerSlot) {
        addGameLog("Online match URL is missing room or player slot.");
        updateOnlinePhaseButton();
        return;
    }

    if (playerSlot !== "p1" && playerSlot !== "p2") {
        addGameLog("Online match URL has an invalid player slot.");
        updateOnlinePhaseButton();
        return;
    }

    try {
        onlineMultiplayerService = await import("../firebase/multiplayerService.js");
        onlineFirebaseApp = await import("../firebase/firebaseApp.js");
        if (!onlineFirebaseApp.auth.currentUser) {
            await onlineFirebaseApp.signInGuest();
        }
        onlineUser = await onlineFirebaseApp.waitForUser();

        // Multiplayer code reads public board/count state plus this user's private zones only.
        onlineMatchUnsubscribe = onlineMultiplayerService.subscribeToPublicState(
            roomCode,
            (publicState) => applyOnlinePublicState(publicState || {})
        );
        onlinePrivateUnsubscribe = onlineMultiplayerService.subscribeToPrivateState(
            roomCode,
            onlineUser.uid,
            (privateState) => applyOnlinePrivateState(privateState || {})
        );

        addGameLog(`Connected to online room ${roomCode} as ${playerSlot.toUpperCase()}.`);
        updateOnlinePhaseButton();
    } catch (error) {
        console.error(error);
        addGameLog(`Failed to connect online match: ${error.message}`);
        updateOnlinePhaseButton();
    }
}

async function handleOnlineDiceRoll() {
    if (!onlineMultiplayerService || onlinePublicState?.phase !== "diceRoll") return;

    try {
        await onlineMultiplayerService.rollMultiplayerDice(roomCode, playerSlot);
    } catch (error) {
        console.error(error);
        addGameLog(`Failed to roll dice: ${error.message}`);
    }
}

async function handleOnlineTurnChoice(choice) {
    if (!onlineMultiplayerService || onlinePublicState?.setup?.dice?.winner !== playerSlot) {
        addGameLog("Only the dice winner can choose turn order.");
        return;
    }

    try {
        removeOnlineTurnChoiceButtons();
        await onlineMultiplayerService.chooseMultiplayerTurnOrder(roomCode, playerSlot, choice);
    } catch (error) {
        console.error(error);
        addGameLog(`Failed to choose turn order: ${error.message}`);
        updateOnlinePhaseButton();
    }
}

async function handleOnlineMulligan(tookMulligan) {
    if (!onlineMultiplayerService || !onlineUser || onlinePublicState?.phase !== "mulligan") {
        return;
    }

    try {
        removeOnlineMulliganButtons();
        await onlineMultiplayerService.setMultiplayerMulligan(
            roomCode,
            onlineUser,
            playerSlot,
            tookMulligan
        );
    } catch (error) {
        console.error(error);
        addGameLog(`Failed to choose mulligan: ${error.message}`);
        updateOnlinePhaseButton();
    }
}

async function handleOnlinePassTurn() {
    if (!isOnlineMatch) return;

    if (!onlineMultiplayerService || !onlinePublicState?.currentPlayer) {
        addGameLog("Online match is still connecting.");
        updateOnlinePhaseButton();
        return;
    }

    if (!isCurrentOnlinePlayer()) {
        addGameLog("Only the current online player can end the turn.");
        updateOnlinePhaseButton();
        return;
    }

    const phaseButton = document.getElementById("phaseButton");

    try {
        if (phaseButton) {
            phaseButton.disabled = true;
        }

        const ownPlayer = gameState[getOwnOnlinePlayerKey()];
        const phaseInfo = createPhaseLogProxy();

        if (ownPlayer) {
            const endOfTurnResults = resolveEndOfTurnEffects(ownPlayer, ui);

            endOfTurnResults.forEach(result => addGameLog(result.message));
            await syncOnlineStateFromLocal();
        }

        // Multiplayer turn owner writes private/public snapshot, then flips public turn pointer.
        const result = await onlineMultiplayerService.passTurn(roomCode, onlinePublicState.currentPlayer);

        if (!result?.committed) {
            addGameLog("Online turn was already updated.");
            updateOnlinePhaseButton();
        }
    } catch (error) {
        console.error(error);
        addGameLog(`Failed to end online turn: ${error.message}`);
        updateOnlinePhaseButton();
    }
}

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

const renderedBoardCardStates = new Map();

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
        renderStages,
        lookTopCardsAddToHand,
        chooseBoardCard: showBoardCardChoice,
        chooseEffectActivation,
        chooseEffectOption
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

        initializeOnlineMultiplayer();
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

    restBoardCard(blockerData);

    drawAttackArrow(currentAttack.attacker, currentAttack.target);

    clearBlockerTargets();

    pendingBlock = null;

    addGameLog(`${defenderPlayer.name} blocked the attack with ${blockerCard.name}.`);

    startCounterPhase(playerKey, () => {
        resolveCurrentAttack();
    });

    if (isOnlineMatch && onlinePublicState?.currentAttack) {
        await syncOnlineCurrentAttack({
            ...onlinePublicState.currentAttack,
            target: currentAttack.target,
            targetPowerBonus: currentAttack.targetPowerBonus || 0
        });
    }

    await syncOnlinePublicBoardFromLocal();
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

        // Multiplayer controls are driven by Firebase public phase/current-player state.
        if (isOnlineMatch) {
            if (onlinePublicState?.phase === "diceRoll") {
                handleOnlineDiceRoll();
                return;
            }

            handleOnlinePassTurn();
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
    if (isOnlineMatch) {
        renderPlayerHand(gameState.player1, "player1Hand", playerSlot !== "p1");
        renderPlayerHand(gameState.player2, "player2Hand", playerSlot !== "p2");
        return;
    }

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
    renderBasePowerBadge(player.leader, leaderArea);

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
        renderBasePowerBadge(card, slot);
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

        await syncOnlineStateFromLocal();
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
        counterButton.title = "Only the defending player can counter.";
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

            if (isOnlineMatch && onlinePublicState?.currentAttack) {
                await syncOnlineCurrentAttack({
                    ...onlinePublicState.currentAttack,
                    targetPowerBonus: currentAttack.targetPowerBonus
                });
            }
        }

        clearHandSelection();

        await syncOnlineStateFromLocal();
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

        await syncOnlineStateFromLocal();
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

    await syncOnlineStateFromLocal();
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

            await syncOnlineStateFromLocal();
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

    if (isOnlineMatch && defenderPlayerKey !== getOwnOnlinePlayerKey()) {
        const defenderName = gameState[defenderPlayerKey]?.name ?? "Defender";

        battleControls.appendChild(createBattleButton(
            `Waiting for ${defenderName}`,
            () => {},
            true,
            "counter-phase"
        ));
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

    if (isOnlineMatch) {
        syncOnlineStateFromLocal();
    }
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

    promptOnOpponentAttackCharacterEffects(defenderPlayer, () => {
        resolveWhenAttackingEffectsBeforeBattle(
            attackerPlayer,
            attackerData,
            () => {
                showResolveAttackButton(currentAttack.defenderPlayerKey, () => {
                    resolveCurrentAttack();
                });
            }
        );
    });
}

function promptOnOpponentAttackCharacterEffects(defenderPlayer, onComplete) {
    const playerKey = defenderPlayer === gameState.player1 ? "player1" : "player2";
    const effects = defenderPlayer.characters
        .map((card, slotIndex) => ({ card, slotIndex }))
        .filter(entry => entry.card?.effects?.some(effect => effect.type === "onOpponentAttack"));

    const promptNext = (index) => {
        const entry = effects[index];

        if (!entry) {
            if (typeof onComplete === "function") {
                onComplete();
            }

            return;
        }

        const currentCard = defenderPlayer.characters[entry.slotIndex];
        const effect = currentCard?.effects?.find(cardEffect => cardEffect.type === "onOpponentAttack");

        if (!currentCard || !effect) {
            promptNext(index + 1);
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

                if (effect.actionId === "trashThisDrawOne") {
                    const trashedCard = defenderPlayer.characters[entry.slotIndex];

                    defenderPlayer.characters[entry.slotIndex] = null;
                    moveCardToTrash(defenderPlayer, trashedCard, ui);
                    drawCard(defenderPlayer, ui);

                    renderCharacters();
                    renderTrash();
                    renderHands();

                    addGameLog(`${defenderPlayer.name} trashed ${trashedCard.name} and drew 1 card.`);

                    if (
                        currentAttack?.target?.playerKey === playerKey &&
                        currentAttack.target.cardType === "character" &&
                        currentAttack.target.slotIndex === entry.slotIndex
                    ) {
                        addGameLog(`${trashedCard.name} left the field, so the attack target is gone.`);
                    }
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

    await syncOnlineStateFromLocal();
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

            const shouldBanishLife = CardEffects.shouldBanishLife(attackerCard);
            const lifeResult = shouldBanishLife
                ? banishLifeDamage(defenderPlayer, damageAmount, ui)
                : takeLifeDamage(defenderPlayer, damageAmount, ui);

            battleResultText += `<br>${lifeResult.message}`;

            if (
                isOnlineMatch &&
                getOnlineSlotFromPlayerKey(currentAttack.defenderPlayerKey) !== playerSlot
            ) {
                await onlineMultiplayerService.applyMultiplayerLifeDamage(
                    roomCode,
                    getOnlineSlotFromPlayerKey(currentAttack.defenderPlayerKey),
                    getOnlineSlotFromPlayerKey(currentAttack.attackerPlayerKey),
                    damageAmount,
                    { banish: shouldBanishLife }
                );
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

    const resolvedAttackerSlot = getOnlineSlotFromPlayerKey(currentAttack.attackerPlayerKey);
    const resolvedDefenderSlot = getOnlineSlotFromPlayerKey(currentAttack.defenderPlayerKey);

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
        if (isOnlineMatch) {
            if (resolvedDefenderSlot === playerSlot) {
                await syncOnlineStateFromLocal();
            }

            await syncOnlinePublicBoardFromLocal({
                currentAttack: null,
                winner: resolvedAttackerSlot
            });
        }

        endGame(
            gameWinner,
            "Final Attack",
            `${defenderPlayer.name} had no life cards left and took a successful leader attack.`
        );
        return;
    }

    gameState.currentPhase = "main";

    if (isOnlineMatch) {
        if (resolvedDefenderSlot === playerSlot) {
            await syncOnlineStateFromLocal();
        }

        await syncOnlinePublicBoardFromLocal({
            currentAttack: null
        });
    }
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
    onComplete
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
    description.textContent = `Choose up to 1 valid card to add to ${player.name}'s hand. The rest go to the bottom of the deck.`;

    const cardGrid = document.createElement("div");
    cardGrid.className = "look-top-card-grid";

    let selectedIndex = null;

    const completeLookTopSelection = async (selection) => {
        const selectedIndex = selection?.selectedIndex;
        const selectedCard = selectedIndex !== null && selectedIndex !== undefined
            ? cards[selectedIndex]
            : null;

        if (typeof onComplete === "function") {
            onComplete(selection);
        }

        // Multiplayer search pools stay local/private; only explicitly revealed chosen cards go public.
        if (isOnlineMatch && player === gameState[getOwnOnlinePlayerKey()]) {
            if (selectedCard && isSelectable(selectedCard)) {
                await publishOnlineReveal([selectedCard]);
            }

            await syncOnlineStateFromLocal();
        }
    };

    if (isOnlineMatch) {
        syncOnlineCurrentAttack({
            id: crypto.randomUUID(),
            attackerSlot: getOnlineSlotFromPlayerKey(currentAttack.attackerPlayerKey),
            defenderSlot: getOnlineSlotFromPlayerKey(currentAttack.defenderPlayerKey),
            attacker: currentAttack.attacker,
            target: currentAttack.target,
            phase: "attackResolving"
        });
    }

    const continueToBottomOrder = () => {
        const remainingCards = cards
            .map((card, index) => ({ card, index }))
            .filter(entry => entry.index !== selectedIndex);

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

    cards.forEach((card, index) => {
        const cardButton = document.createElement("button");
        cardButton.className = "look-top-card-button";

        const validChoice = isSelectable(card);

        if (!validChoice) {
            cardButton.classList.add("disabled-choice");
            cardButton.disabled = true;
            cardButton.title = "This card is not a valid choice.";
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
            if (!validChoice) return;

            selectedIndex = index;

            document.querySelectorAll(".look-top-card-button").forEach(button => {
                button.classList.remove("selected-look-card");
            });

            cardButton.classList.add("selected-look-card");

            addButton.disabled = false;
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

function removeLookTopOverlay() {
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
            await onComplete(selectedChoice);
        }

        await syncOnlineStateFromLocal();
    });

    skipButton.addEventListener("click", async () => {
        removeBoardChoiceOverlay();

        if (typeof onComplete === "function") {
            await onComplete(null);
        }

        await syncOnlineStateFromLocal();
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

    options.forEach(option => {
        const button = document.createElement("button");
        button.className = option.secondary
            ? "look-top-action-button secondary"
            : "look-top-action-button";
        button.textContent = option.label;

        button.addEventListener("click", async () => {
            removeEffectChoiceOverlay();

            if (typeof onComplete === "function") {
                await onComplete(option.value);
            }

            await syncOnlineStateFromLocal();
        });

        buttonRow.appendChild(button);
    });

    content.appendChild(description);
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

    if (card?.cardNumber === "BK01-007") {
        const player = getPlayerForBoardCard(card);

        if (player?.characters?.some(character => CardEffects.hasCardName(character, "Guts"))) {
            return 6000;
        }
    }

    return Number(card?.power ?? 0);
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

    return getYourTurnPowerBonus(card, player) +
        getTurboGrannyFormPowerModifier(card, player) +
        getSerpicoFarnesePowerModifier(card, player) +
        getGutsLeaderPowerModifier(card, player) +
        getOpponentTurnPowerModifier(card, player) +
        getAttachedDonPowerModifier(card, player) +
        getTemporaryPowerModifier(card) +
        getDurationPowerModifier(card) +
        getTokenAttachedPowerModifier(card) +
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
        ?.reduce((total, entry) => total + Number(entry.amount ?? 0), 0) ?? 0;
}

function getBattlePowerModifier(card) {
    return Number(card?.battlePowerBonus ?? 0);
}

function getCostModifier(card) {
    return card?.costModifiers
        ?.reduce((total, entry) => total + Number(entry.amount ?? 0), 0) ?? 0;
}

function renderCostModifierBadge(card, container) {
    if (!card || !container || card.cardType !== "character") {
        return;
    }

    const modifier = getCostModifier(card);

    if (modifier === 0) {
        return;
    }

    const printedCost = Number(card.cost ?? card.playCost ?? 0);
    const sign = modifier > 0 ? "+" : "";
    const badge = document.createElement("div");

    badge.className = modifier < 0
        ? "cost-modifier-badge cost-modifier-negative"
        : "cost-modifier-badge cost-modifier-positive";
    badge.textContent = `${sign}${modifier} Cost`;
    badge.title = `Cost modifier: ${sign}${modifier} (${printedCost} printed cost)`;

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
    const printedPower = getPrintedPower(card);
    const currentPower = printedPower + modifier;

    badge.className = modifier > 0
        ? "power-modifier-badge power-modifier-positive"
        : "power-modifier-badge power-modifier-negative";

    badge.textContent = `${sign}${modifier}`;
    badge.title = `Current power: ${currentPower} (${printedPower} ${sign}${modifier})`;

    container.appendChild(badge);
}

function renderBasePowerBadge(card, container) {
    if (!card || !container || (card.cardType !== "leader" && card.cardType !== "character")) {
        return;
    }

    const basePower = getPrintedPower(card);
    const badge = document.createElement("div");

    badge.className = "base-power-badge";
    badge.textContent = `Base ${basePower}`;
    badge.title = `Base power: ${basePower}`;

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

// =========================
// General Helpers
// =========================

function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
}
