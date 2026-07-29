// matchShared.js

// =========================
// Image Paths
// =========================

const cardBackImage = "../images/a-misc/card-back-normal.png";
const donBackImage = "../images/a-misc/card-back-normal.png";
const donImage = "../images/a-misc/card-front-don.png";

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

    const parsedDeck = parseDeckText(selectedDeck.deckText);
    const deckSizeLimit = window.getLeaderDeckSizeLimit?.(selectedDeck.leaderKey) || 50;

    if (parsedDeck.length > deckSizeLimit) {
        throw new Error(`${leader.name} can only use ${deckSizeLimit} deck cards.`);
    }

    return {
        name: playerName,
        don: 0,
        restedDon: 0,
        donDeck: 10,
        turns: 0,
        deck: shuffleDeck(parsedDeck),
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

// =========================
// Life And Phase UI
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

// =========================
// Board Helpers
// =========================

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
    return Boolean(
        player &&
        card?.cardType === "character" &&
        card.playedOnTurn === player.turns
    );
}

function getPlayerForBoardCard(card) {
    if (!card || !gameState) return null;

    return [gameState.player1, gameState.player2].find(player => {
        return player?.leader === card ||
            player?.stage === card ||
            player?.characters?.includes(card);
    }) || null;
}

function getPrintedPower(card) {
    return Math.max(0, Number(card?.power ?? 0));
}

function getPowerModifier(card) {
    return Number(card?.attachedDon || 0) * 1000;
}

function getCardBattlePower(card) {
    return getPrintedPower(card) + getPowerModifier(card);
}

function getCostModifier() {
    return 0;
}

function renderCostModifierBadge() {}

function renderPowerModifierBadge() {}

function renderBasePowerBadge(card, player, container) {
    if (!card || !player || !container || (card.cardType !== "leader" && card.cardType !== "character")) {
        return;
    }

    const badge = document.createElement("div");
    const printedPower = getPrintedPower(card);

    badge.className = "base-power-badge";
    badge.textContent = `${printedPower}`;
    badge.title = `Base power: ${printedPower}`;
    container.appendChild(badge);
}

function renderAttachedDonBadge(card, container) {
    if (!card || !container) return;

    const attachedDon = Number(card.attachedDon || 0);
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
    if (!currentAttack || !boardCardData || !isSameBoardCard(currentAttack.target, boardCardData)) {
        return 0;
    }

    return Number(currentAttack.targetPowerBonus || 0);
}

function isSameBoardCard(firstCardData, secondCardData) {
    if (!firstCardData || !secondCardData) return false;
    if (firstCardData.playerKey !== secondCardData.playerKey) return false;
    if (firstCardData.cardType !== secondCardData.cardType) return false;

    return firstCardData.cardType !== "character" ||
        Number(firstCardData.slotIndex) === Number(secondCardData.slotIndex);
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


