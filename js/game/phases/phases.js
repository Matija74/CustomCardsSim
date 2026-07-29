// phases.js

// =========================
// Dice Roll Phase
// =========================

function setPhaseButtonUrgency(phaseButton, enabled) {
    if (!phaseButton) {
        return;
    }

    phaseButton.classList.toggle("phase-button-required", Boolean(enabled));
}

function shouldHighlightManualPhaseButton(text, disabled) {
    if (disabled) {
        return false;
    }

    return text === "Draw Card" || /^Add \d+ DON!!$/.test(String(text || ""));
}

function runDiceRollPhase(phaseButton, phaseInfo) {
    let player1Roll;
    let player2Roll;

    do {
        player1Roll = rollD20();
        player2Roll = rollD20();

        phaseInfo.innerHTML = `
            Player 1 rolled: ${player1Roll}<br>
            Player 2 rolled: ${player2Roll}
        `;

        if (player1Roll === player2Roll) {
            phaseInfo.innerHTML += `<br><br>Tie! Rolling again...`;
        }
    } while (player1Roll === player2Roll);

    gameState.diceWinner = player1Roll > player2Roll
        ? gameState.player1
        : gameState.player2;

    phaseInfo.innerHTML += `
        <br><br>
        ${gameState.diceWinner.name} wins the dice roll.<br>
        Choose turn order:
    `;

    if (typeof window.showDiceRollAnimation === "function") {
        window.showDiceRollAnimation(player1Roll, player2Roll, gameState.diceWinner);
    }

    setPhaseButtonUrgency(phaseButton, false);
    phaseButton.style.display = "none";
    phaseButton.disabled = true;

    createTurnOrderButtons(phaseButton, phaseInfo);
}

function selectTurnOrder(choice, phaseButton, phaseInfo) {
    const winner = gameState.diceWinner;
    const loser = winner === gameState.player1
        ? gameState.player2
        : gameState.player1;

    if (choice === "first") {
        gameState.firstPlayer = winner;
        gameState.secondPlayer = loser;
    } else {
        gameState.firstPlayer = loser;
        gameState.secondPlayer = winner;
    }

    gameState.currentPlayer = gameState.firstPlayer;
    gameState.currentPhase = "mulligan";

    drawStartingHand(gameState.player1);
    drawStartingHand(gameState.player2);

    removeChoiceButtons();

    if (typeof window.removeDiceRollDisplay === "function") {
        window.removeDiceRollDisplay();
    }

    phaseInfo.innerHTML = `
        ${winner.name} chose to go ${choice}.<br><br>
        ${gameState.firstPlayer.name} will go first.<br>
        ${gameState.secondPlayer.name} will go second.<br><br>
        ${gameState.player1.name}: Keep hand or mulligan?
    `;

    phaseButton.style.display = "none";

    createMulliganButtons(gameState.player1, phaseButton, phaseInfo);
    window.queueMultiplayerStateSync?.();
}

// =========================
// Mulligan Phase
// =========================

function handleMulliganChoice(player, tookMulligan, phaseButton, phaseInfo) {
    player.hasMulliganed = tookMulligan;

    if (tookMulligan) {
        mulliganHand(player);
    }

    setupLifeCards(player);

    const actionText = tookMulligan
        ? `${player.name} took a mulligan and placed life cards.`
        : `${player.name} kept their starting hand and placed life cards.`;

    if (player === gameState.player1) {
        phaseInfo.innerHTML = `
            ${actionText}<br><br>
            ${gameState.player2.name}: Keep hand or mulligan?
        `;

        createMulliganButtons(gameState.player2, phaseButton, phaseInfo);
        window.queueMultiplayerStateSync?.();
        return;
    }

    phaseInfo.innerHTML = `
        ${actionText}<br><br>
        Both players are ready.<br>
        Starting Turn 1.
    `;

    removeChoiceButtons();
    startTurnOne(phaseButton, phaseInfo);
    window.queueMultiplayerStateSync?.();
}

function drawStartingHand(player) {
    drawCards(player, 5, ui, { playSound: false });
}

function mulliganHand(player) {
    player.deck.push(...player.hand);
    player.hand = [];

    shuffleDeck(player.deck);

    drawCards(player, 5, ui, { playSound: false });
}

function setupLifeCards(player) {
    player.life = [];

    const lifeAmount = player.leader.life;
    player.startingLife = lifeAmount;

    for (let i = 0; i < lifeAmount; i++) {
        const card = player.deck.shift();

        if (card) {
            player.life.push(assignCardInstance(card));
        }
    }

    renderLifeCards();
    renderDecks();
}

function shouldSkipCurrentTurnDraw(player = gameState?.currentPlayer) {
    return Boolean(
        player &&
        gameState?.firstPlayer &&
        gameState.turnNumber === 1 &&
        player === gameState.firstPlayer
    );
}

function getCurrentTurnDonAmount(player = gameState?.currentPlayer) {
    return shouldSkipCurrentTurnDraw(player)
        ? 1
        : 2;
}

function setPhaseButtonState(phaseButton, text, disabled = false) {
    if (!phaseButton) {
        return;
    }

    phaseButton.style.display = "block";
    phaseButton.disabled = disabled;
    phaseButton.textContent = text;
    setPhaseButtonUrgency(phaseButton, shouldHighlightManualPhaseButton(text, disabled));
}

function canCurrentClientAdvanceTurnPhases() {
    if (window.__multiplayerRuntime?.isActive?.()) {
        return gameState?.currentPlayer === gameState?.player1;
    }

    return true;
}

function maybeAutoAdvanceTurnPhases(phaseButton, phaseInfo) {
    if (!window.isGameSettingEnabled?.("autoDraw")) {
        return;
    }

    if (!canCurrentClientAdvanceTurnPhases()) {
        return;
    }

    window.setTimeout(() => {
        if (!gameState || !canCurrentClientAdvanceTurnPhases()) {
            return;
        }

        if (gameState.currentPhase === "draw") {
            advanceDrawPhase(phaseButton, phaseInfo);
            return;
        }

        if (gameState.currentPhase === "don") {
            advanceDonPhase(phaseButton, phaseInfo);
        }
    }, 0);
}

function canCurrentClientResolveStartOfTurn(player) {
    if (!window.__multiplayerRuntime?.isActive?.()) {
        return true;
    }

    return player === gameState?.player1;
}

function beginTurnFlow(player, phaseButton, phaseInfo) {
    phaseInfo.innerHTML += `<br><br>`;

    if (!canCurrentClientResolveStartOfTurn(player)) {
        gameState.currentPhase = "startOfTurn";
        setPhaseButtonState(phaseButton, `${player.name}'s Start of Turn`, true);
        window.queueMultiplayerStateSync?.();
        return;
    }

    runRefreshPhase(player, phaseInfo);

    if (shouldSkipCurrentTurnDraw(player)) {
        phaseInfo.innerHTML += `
            <br><br>
            ${player.name}'s Draw Phase:<br>
            ${player.name} goes first and skips the draw on Turn 1.
        `;

        gameState.currentPhase = "don";
        setPhaseButtonState(phaseButton, `Add ${getCurrentTurnDonAmount(player)} DON!!`);
        window.queueMultiplayerStateSync?.();
        maybeAutoAdvanceTurnPhases(phaseButton, phaseInfo);
        return;
    }

    gameState.currentPhase = "draw";
    setPhaseButtonState(phaseButton, "Draw Card");
    window.queueMultiplayerStateSync?.();
    maybeAutoAdvanceTurnPhases(phaseButton, phaseInfo);
}

function advanceDrawPhase(phaseButton, phaseInfo) {
    const drawResult = runDrawPhase(gameState.currentPlayer, phaseInfo);

    if (drawResult?.deckOut || gameState.currentPhase === "gameOver") {
        setPhaseButtonState(phaseButton, "Game Over", true);
        return;
    }

    gameState.currentPhase = "don";
    setPhaseButtonState(
        phaseButton,
        `Add ${getCurrentTurnDonAmount(gameState.currentPlayer)} DON!!`
    );
    window.queueMultiplayerStateSync?.();
    maybeAutoAdvanceTurnPhases(phaseButton, phaseInfo);
}

function advanceDonPhase(phaseButton, phaseInfo) {
    runDonPhase(gameState.currentPlayer, getCurrentTurnDonAmount(gameState.currentPlayer), phaseInfo);
    runMainPhase(gameState.currentPlayer, phaseButton);
    window.queueMultiplayerStateSync?.();
}

// =========================
// Turn Start
// =========================

function startTurnOne(phaseButton, phaseInfo) {
    gameState.currentPlayer = gameState.firstPlayer;
    gameState.turnNumber = 1;

    gameState.currentPlayer.turns++;
    gameState.currentPlayer.leaderAttacksThisTurn = 0;

    beginTurnFlow(gameState.currentPlayer, phaseButton, phaseInfo);
}

// =========================
// Turn Status Helpers
// =========================

function getCurrentTurnStatusKey() {
    const currentPlayer = gameState?.currentPlayer;
    const currentPlayerKey = currentPlayer
        ? getPlayerKey(currentPlayer)
        : null;

    if (!currentPlayerKey) {
        return null;
    }

    return `${Number(gameState?.turnNumber || 0)}:${currentPlayerKey}`;
}

function markCardCannotAttackThisTurn(card) {
    if (!card) {
        return;
    }

    card.cannotAttackThisTurnKey = getCurrentTurnStatusKey();
}

function markLifeCardAdded(player) {
    if (!player) {
        return;
    }

    const turnStatusKey = getCurrentTurnStatusKey();

    if (!turnStatusKey) {
        return;
    }

    player.lastLifeCardAddedTurnKey = turnStatusKey;
}

function hasAddedLifeCardThisTurn(player) {
    if (!player) {
        return false;
    }

    const turnStatusKey = getCurrentTurnStatusKey();

    return Boolean(turnStatusKey && player.lastLifeCardAddedTurnKey === turnStatusKey);
}

function lockCardForNextRefresh(card) {
    if (!card) {
        return;
    }

    card.skipNextRefresh = true;
}

// =========================
// Refresh Helpers
// =========================

function refreshPlayerCards(player, ui) {
    const refreshedDon = player.restedDon;
    let returnedAttachedDon = 0;
    let refreshedLeader = 0;
    let refreshedCharacters = 0;
    let refreshedStage = 0;

    player.don += player.restedDon;
    player.restedDon = 0;
    returnedAttachedDon = returnAttachedDonToCostArea(player, ui, { rested: false });

    if (player.leader && player.leader.state === "rested") {
        player.leader.state = "active";
        refreshedLeader = 1;
    }

    player.leaderAttacksThisTurn = 0;

    player.characters.forEach(character => {
        if (character?.state === "rested") {
            character.state = "active";
            refreshedCharacters++;
        }
    });

    if (player.stage && player.stage.state === "rested") {
        player.stage.state = "active";
        refreshedStage = 1;
    }

    ui.updateDonDisplay();

    if (ui.renderLeaders) {
        ui.renderLeaders();
    }

    if (ui.renderCharacters) {
        ui.renderCharacters();
    }

    if (ui.renderStages) {
        ui.renderStages();
    }

    return {
        refreshedDon,
        returnedAttachedDon,
        refreshedLeader,
        refreshedCharacters,
        refreshedStage
    };
}

// =========================
// Refresh Phase
// =========================

function runRefreshPhase(player, phaseInfo) {
    const refreshResult = refreshPlayerCards(player, ui);
    phaseInfo.innerHTML += `
        ${player.name}'s Refresh Phase:<br>
        ${refreshResult.refreshedDon} rested DON!! became active.<br>
        ${refreshResult.returnedAttachedDon || 0} attached DON!! returned to the cost area.<br>
        ${refreshResult.refreshedLeader} leader became active.<br>
        ${refreshResult.refreshedCharacters} character${refreshResult.refreshedCharacters === 1 ? "" : "s"} became active.<br>
        ${refreshResult.refreshedStage} stage became active.
    `;

    return refreshResult;
}

// =========================
// Draw Phase
// =========================

function runDrawPhase(player, phaseInfo) {
    const drawResult = drawCard(player, ui);

    if (drawResult?.deckOut) {
        phaseInfo.innerHTML += `
            <br><br>
            ${player.name}'s Draw Phase:<br>
            ${player.name} lost by deck out.
        `;

        return drawResult;
    }

    phaseInfo.innerHTML += `
        <br><br>
        ${player.name}'s Draw Phase:<br>
        ${player.name} drew 1 card.
    `;

    return drawResult;
}

// =========================
// DON!! Phase
// =========================

function runDonPhase(player, amount, phaseInfo) {
    const beforeDon = player.don;

    addDon(player, amount, ui);

    const gainedDon = player.don - beforeDon;

    phaseInfo.innerHTML += `
        <br><br>
        ${player.name}'s DON!! Phase:<br>
        ${player.name} gained ${gainedDon} DON!!.
    `;

    return gainedDon;
}

// =========================
// Main Phase
// =========================

function runMainPhase(player, phaseButton) {
    gameState.currentPhase = "main";

    const nextPlayer = getNextPlayer(player);

    setPhaseButtonState(phaseButton, `Pass to ${nextPlayer.name}`);
}

// =========================
// Turn Flow
// =========================

function passTurn(phaseButton, phaseInfo) {
    const previousPlayer = gameState.currentPlayer;
    const nextPlayer = getNextPlayer(previousPlayer);

    gameState.currentPlayer = nextPlayer;
    gameState.turnNumber++;
    gameState.currentPlayer.turns++;
    gameState.currentPlayer.leaderAttacksThisTurn = 0;

    phaseInfo.innerHTML = `
        ${previousPlayer.name} ended their turn.<br><br>
    `;

    beginTurnFlow(gameState.currentPlayer, phaseButton, phaseInfo);
}

// =========================
// Counter Phase
// =========================

function startCounterPhase(defenderPlayerKey, onResolve) {
    const defenderPlayer = gameState[defenderPlayerKey];

    if (!defenderPlayer || !currentAttack) {
        if (typeof showResolveOnlyButton === "function") {
            showResolveOnlyButton(defenderPlayerKey, onResolve);
        }

        return;
    }

    gameState.currentPhase = "counterPhase";

    if (typeof currentAttack.targetPowerBonus !== "number") {
        currentAttack.targetPowerBonus = 0;
    }

    addGameLog(`${defenderPlayer.name} may use Counter cards or resolve the attack.`);

    if (typeof showCounterPhaseControls === "function") {
        showCounterPhaseControls(defenderPlayerKey, onResolve);
    }

    window.queueMultiplayerStateSync?.();
}

// =========================
// Phase Helpers
// =========================

function getNextPlayer(player) {
    return player === gameState.player1
        ? gameState.player2
        : gameState.player1;
}

function canPlayerPlayCards(player) {
    if (gameState.currentPhase !== "main") {
        return false;
    }

    if (gameState.currentPlayer !== player) {
        return false;
    }

    return true;
}

window.setPhaseButtonUrgency = setPhaseButtonUrgency;


