// phases.js

// =========================
// Dice Roll Phase
// =========================

function runDiceRollPhase(phaseButton, phaseInfo) {
    let player1Roll;
    let player2Roll;

    addGameLog("Players rolled the dice...");

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
        return;
    }

    phaseInfo.innerHTML = `
        ${actionText}<br><br>
        Both players are ready.<br>
        Starting Turn 1.
    `;

    removeChoiceButtons();
    startTurnOne(phaseButton, phaseInfo);
}

function drawStartingHand(player) {
    drawCards(player, 5, ui);
}

function mulliganHand(player) {
    player.deck.push(...player.hand);
    player.hand = [];

    shuffleDeck(player.deck);

    drawCards(player, 5, ui);
}

function setupLifeCards(player) {
    player.life = [];

    const lifeAmount = player.leader.life;

    for (let i = 0; i < lifeAmount; i++) {
        const card = player.deck.shift();

        if (card) {
            player.life.push(assignCardInstance(card));
        }
    }

    renderLifeCards();
    renderDecks();
}

// =========================
// Turn Start
// =========================

function startTurnOne(phaseButton, phaseInfo) {
    gameState.currentPlayer = gameState.firstPlayer;
    gameState.turnNumber = 1;

    gameState.currentPlayer.turns++;
    gameState.currentPlayer.leaderAttacksThisTurn = 0;

    phaseInfo.innerHTML += `<br><br>`;

    runRefreshPhase(gameState.currentPlayer, phaseInfo);
    runDonPhase(gameState.currentPlayer, 1, phaseInfo);

    gameState.currentPhase = "main";

    const nextPlayer = getNextPlayer(gameState.currentPlayer);

    phaseButton.style.display = "block";
    phaseButton.disabled = false;
    phaseButton.textContent = `Pass to ${nextPlayer.name}`;
}

// =========================
// Refresh Phase
// =========================

function runRefreshPhase(player, phaseInfo) {
    const refreshResult = refreshPlayerCards(player, ui);
    const skippedLeaderText = refreshResult.skippedLeaderRefresh
        ? "1 leader stayed rested due to an effect.<br>"
        : "";

    phaseInfo.innerHTML += `
        ${player.name}'s Refresh Phase:<br>
        ${refreshResult.refreshedDon} rested DON!! became active.<br>
        ${refreshResult.refreshedLeader} leader became active.<br>
        ${skippedLeaderText}${refreshResult.refreshedCharacters} character${refreshResult.refreshedCharacters === 1 ? "" : "s"} became active.<br>
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

    phaseButton.textContent = `Pass to ${nextPlayer.name}`;
}

// =========================
// Turn Flow
// =========================

function passTurn(phaseButton, phaseInfo) {
    const previousPlayer = gameState.currentPlayer;
    const nextPlayer = getNextPlayer(previousPlayer);
    const endOfTurnResults = resolveEndOfTurnEffects(previousPlayer, ui);
    const endOfTurnText = endOfTurnResults.length > 0
        ? `<br><br>${endOfTurnResults.map(result => result.message).join("<br>")}`
        : "";

    gameState.currentPlayer = nextPlayer;
    gameState.turnNumber++;
    gameState.currentPlayer.turns++;
    gameState.currentPlayer.leaderAttacksThisTurn = 0;

    phaseInfo.innerHTML = `
        ${previousPlayer.name} ended their turn.${endOfTurnText}<br><br>
    `;

    runRefreshPhase(gameState.currentPlayer, phaseInfo);

    const drawResult = runDrawPhase(gameState.currentPlayer, phaseInfo);

    if (drawResult?.deckOut || gameState.currentPhase === "gameOver") {
        phaseButton.disabled = true;
        phaseButton.textContent = "Game Over";
        return;
    }

    runDonPhase(gameState.currentPlayer, 2, phaseInfo);
    runMainPhase(gameState.currentPlayer, phaseButton);
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
