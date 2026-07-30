// matchShared.js

// =========================
// Image Paths
// =========================

const cardBackImage = window.resolveApplicationAsset("images/a-misc/card-back-normal.png");
const donBackImage = window.resolveApplicationAsset("images/a-misc/card-back-don.png");
const donImage = window.resolveApplicationAsset("images/a-misc/card-front-don.png");

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
        getSubaruRamPowerModifier(card) +
        getImuMaffeyPowerModifier(card) +
        getKillerGigPowerModifier(card) +
        getSt28MomonosukeLeaderPowerModifier(card, player) +
        getSt28YamatoPowerModifier(card, player) +
        getWanoCountryPowerModifier(card, player) +
        getTurboGrannyFormPowerModifier(card, player) +
        getSerpicoFarnesePowerModifier(card, player) +
        getGutsLeaderPowerModifier(card, player) +
        getHigurumaLeaderPowerModifier(card, player) +
        getJujutsuProtectionPowerModifier(card, player) +
        getKurosakiIchigoPowerModifier(card, player) +
        getOpponentTurnPowerModifier(card, player) +
        getAttachedDonPowerModifier(card, player) +
        getPersistentPowerModifier(card) +
        getTemporaryPowerModifier(card) +
        getDurationPowerModifier(card) +
        getDonAttachedPowerModifier(card) +
        getBattlePowerModifier(card);
}

function getSubaruRamPowerModifier(card) {
    return typeof hasRamBoostedRem === "function" && hasRamBoostedRem(card)
        ? 1000
        : 0;
}

function getImuMaffeyPowerModifier(card) {
    return card?.cardNumber === "IMU1-009" &&
        !areCardEffectsNegated(card) &&
        Number(card.attachedDon || 0) >= 1
        ? 1000
        : 0;
}

function getKillerGigPowerModifier(card) {
    return card?.cardNumber === "KIL1-008" &&
        !areCardEffectsNegated(card) &&
        Number(card.attachedDon || 0) >= 2
        ? 2000
        : 0;
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

function getWanoCountryPowerModifier(card, player) {
    if (!card || !player || gameState.currentPlayer !== player) {
        return 0;
    }

    if (card.cardType !== "character" || !hasTypeText(card, "Land of Wano")) {
        return 0;
    }

    if (!player.stage || player.stage.cardNumber !== "YAM1-004" || areCardEffectsNegated(player.stage)) {
        return 0;
    }

    if (typeof hasAddedLifeCardThisTurn !== "function" || !hasAddedLifeCardThisTurn(player)) {
        return 0;
    }

    return getCardAllEffects(player.stage)?.some(effect => effect.id === "YAM1-004-your-turn-power")
        ? 1000
        : 0;
}

function getSt28MomonosukeLeaderPowerModifier(card, player) {
    if (!card || !player || card.cardType !== "leader" || gameState.currentPlayer !== player) {
        return 0;
    }

    if ((player.life?.length || 0) > 2) {
        return 0;
    }

    return player.characters
        .filter(character => character?.cardNumber === "ST28-004" && !areCardEffectsNegated(character))
        .length * 1000;
}

function getSt28YamatoPowerModifier(card, player) {
    if (!card || !player || card.cardNumber !== "ST28-005" || gameState.currentPlayer !== player) {
        return 0;
    }

    return Number(card.attachedDon || 0) >= 2 ? 3000 : 0;
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

function getHigurumaLeaderPowerModifier(card, player) {
    if (!card || !player || card.cardType !== "leader" || player.stage) {
        return 0;
    }

    return player.characters
        .filter(character => character?.cardNumber === "JK01-006" && !areCardEffectsNegated(character))
        .length * 1000;
}

function getJujutsuProtectionPowerModifier(card, player) {
    if (!card || !player || card.cardType !== "character" || areCardEffectsNegated(card)) {
        return 0;
    }

    if (card.cardNumber === "JK01-008") {
        return hasJujutsuOrCullingGameLeader(player) ? 2000 : 0;
    }

    if (card.cardNumber === "JK01-009") {
        return hasTypeText(player.leader, "Culling Game Participant") ? 2000 : 0;
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

function getPersistentPowerModifier(card) {
    return Number(card?.persistentPowerBonus ?? 0);
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

function createCardDetailsButton(card) {
    const button = document.createElement("button");
    button.className = "board-action-button-on-card card-details-button";
    button.type = "button";
    button.textContent = "Details";
    button.title = `View ${card?.name || "card"} details`;
    button.addEventListener("click", (event) => {
        event.stopPropagation();
        openCardDetailsModal(card);
    });
    return button;
}

function openCardDetailsModal(card) {
    if (!card) return;

    document.querySelector(".card-details-overlay")?.remove();

    const overlay = document.createElement("div");
    overlay.className = "card-details-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", `${card.name || "Card"} details`);

    const modal = document.createElement("section");
    modal.className = "card-details-modal";

    const toolbar = document.createElement("div");
    toolbar.className = "card-details-toolbar";

    const flipButton = document.createElement("button");
    flipButton.type = "button";
    flipButton.className = "card-details-flip";
    flipButton.textContent = "Flip to details";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "card-details-close";
    closeButton.setAttribute("aria-label", "Close card details");
    closeButton.textContent = "×";

    const scene = document.createElement("div");
    scene.className = "card-details-scene";

    const flipper = document.createElement("div");
    flipper.className = "card-details-flipper";

    const imageFace = document.createElement("div");
    imageFace.className = "card-details-face card-details-image-face";
    const image = document.createElement("img");
    image.src = card.image || "";
    image.alt = card.name || "Card";
    imageFace.appendChild(image);

    const infoFace = document.createElement("article");
    infoFace.className = "card-details-face card-details-info-face";

    const title = document.createElement("h2");
    title.textContent = card.name || "Unknown card";
    const subtitle = document.createElement("p");
    subtitle.className = "card-details-subtitle";
    subtitle.textContent = [card.cardNumber || card.id, card.cardType]
        .filter(Boolean)
        .join(" · ");
    infoFace.append(title, subtitle);

    const colors = String(card.color || "").split("/").map(value => value.trim()).filter(Boolean);
    if (colors.length) {
        const colorRow = document.createElement("div");
        colorRow.className = "card-details-tags";
        colors.forEach((color) => {
            const tag = document.createElement("span");
            tag.className = `card-detail-color card-detail-color-${color.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
            tag.textContent = color;
            colorRow.appendChild(tag);
        });
        infoFace.appendChild(colorRow);
    }

    const stats = [
        ["Cost", card.cost],
        ["Power", card.power],
        ["Counter", card.counter],
        ["Life", card.life]
    ].filter(([, value]) => value !== undefined && value !== null);
    if (stats.length) {
        const statGrid = document.createElement("div");
        statGrid.className = "card-details-stats";
        stats.forEach(([label, value]) => {
            const stat = document.createElement("div");
            const statLabel = document.createElement("small");
            statLabel.textContent = label;
            const statValue = document.createElement("strong");
            statValue.textContent = value;
            stat.append(statLabel, statValue);
            statGrid.appendChild(stat);
        });
        infoFace.appendChild(statGrid);
    }

    const addTagGroup = (label, values) => {
        const cleaned = values.filter(Boolean);
        if (!cleaned.length) return;
        const group = document.createElement("div");
        group.className = "card-details-group";
        const heading = document.createElement("small");
        heading.textContent = label;
        const tags = document.createElement("div");
        tags.className = "card-details-tags";
        cleaned.forEach((value) => {
            const tag = document.createElement("span");
            tag.textContent = value;
            tags.appendChild(tag);
        });
        group.append(heading, tags);
        infoFace.appendChild(group);
    };

    addTagGroup("Type", String(card.type || "").split("/").map(value => value.trim()));
    addTagGroup("Attribute", [card.attribute]);
    addTagGroup("Keywords", Array.isArray(card.keywords) ? card.keywords : []);

    const effects = Array.isArray(card.effects) ? card.effects.filter(effect => effect?.text) : [];
    const effectGroup = document.createElement("div");
    effectGroup.className = "card-details-effects";
    const effectHeading = document.createElement("small");
    effectHeading.textContent = "Effects";
    effectGroup.appendChild(effectHeading);
    if (effects.length) {
        effects.forEach((effect) => {
            const paragraph = document.createElement("p");
            paragraph.textContent = effect.text;
            effectGroup.appendChild(paragraph);
        });
    } else {
        const paragraph = document.createElement("p");
        paragraph.textContent = "This card has no printed effects.";
        effectGroup.appendChild(paragraph);
    }
    infoFace.appendChild(effectGroup);

    flipper.append(imageFace, infoFace);
    scene.appendChild(flipper);
    toolbar.append(flipButton, closeButton);
    modal.append(toolbar, scene);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => {
        document.removeEventListener("keydown", handleKeydown);
        document.body.classList.remove("card-details-open");
        overlay.remove();
    };
    const handleKeydown = (event) => {
        if (event.key === "Escape") close();
    };

    flipButton.addEventListener("click", () => {
        const flipped = modal.classList.toggle("is-flipped");
        flipButton.textContent = flipped ? "Flip to card" : "Flip to details";
    });
    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
    });
    document.addEventListener("keydown", handleKeydown);
    document.body.classList.add("card-details-open");
    closeButton.focus();
}

// =========================
// General Helpers
// =========================

function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
}
