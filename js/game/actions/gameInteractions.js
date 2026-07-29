// gameInteractions.js

// This file contains only the base game actions. Card effects and keywords are
// intentionally disabled while the effect system is being rebuilt.

let nextCardInstanceId = 1;

function createCardInstance(card) {
    return {
        ...card,
        effects: [],
        keywords: [],
        instanceId: `card-instance-${nextCardInstanceId++}`,
        state: card?.state || "active",
        attachedDon: Number(card?.attachedDon || 0)
    };
}

function assignCardInstance(card) {
    return createCardInstance(card);
}

function findHandCardIndexByInstanceId(player, cardInstanceId) {
    return player.hand.findIndex(card => card.instanceId === cardInstanceId);
}

function getCardPlayCost(card) {
    return Math.max(0, Number(card?.cost ?? card?.playCost ?? 0));
}

function canPlayerAffordCard(player, card) {
    return Boolean(player && player.don >= getCardPlayCost(card));
}

function getFirstOpenCharacterSlotIndex(player) {
    for (let slotIndex = 0; slotIndex < 5; slotIndex++) {
        if (!player.characters[slotIndex]) {
            return slotIndex;
        }
    }

    return -1;
}

function getBoardCardFromData(boardCardData) {
    if (!boardCardData) return null;

    const player = gameState?.[boardCardData.playerKey];

    if (!player) return null;

    if (boardCardData.cardType === "leader") {
        return player.leader;
    }

    if (boardCardData.cardType === "character") {
        return player.characters[boardCardData.slotIndex] || null;
    }

    if (boardCardData.cardType === "stage") {
        return player.stage;
    }

    return null;
}

function getPlayerKey(player) {
    if (player === gameState?.player1) return "player1";
    if (player === gameState?.player2) return "player2";
    return null;
}

function getOpponentOfPlayer(player) {
    if (player === gameState?.player1) return gameState.player2;
    if (player === gameState?.player2) return gameState.player1;
    return null;
}

function getPlayedCharacterInitialState() {
    return "active";
}

function addDon(player, amount, uiInstance = ui) {
    const donToAdd = Math.min(Math.max(0, Number(amount || 0)), player.donDeck);

    player.don += donToAdd;
    player.donDeck -= donToAdd;
    uiInstance?.updateDonDisplay?.();
    uiInstance?.renderDonDecks?.();

    return donToAdd;
}

function addRestedDon(player, amount, uiInstance = ui) {
    const donToAdd = Math.min(Math.max(0, Number(amount || 0)), player.donDeck);

    player.restedDon += donToAdd;
    player.donDeck -= donToAdd;
    uiInstance?.updateDonDisplay?.();
    uiInstance?.renderDonDecks?.();

    return donToAdd;
}

function restDonForCost(player, cost, uiInstance = ui) {
    const resolvedCost = Math.max(0, Number(cost || 0));

    if (player.don < resolvedCost) {
        return false;
    }

    player.don -= resolvedCost;
    player.restedDon += resolvedCost;
    uiInstance?.updateDonDisplay?.();

    return true;
}

function setRestedDonActive(player, amount, uiInstance = ui) {
    const donToRefresh = Math.min(Math.max(0, Number(amount || 0)), player.restedDon);

    player.restedDon -= donToRefresh;
    player.don += donToRefresh;
    uiInstance?.updateDonDisplay?.();

    return donToRefresh;
}

function returnDonToDeck(player, amount, uiInstance = ui) {
    const donToReturn = Math.min(
        Math.max(0, Number(amount || 0)),
        player.don + player.restedDon
    );

    for (let index = 0; index < donToReturn; index++) {
        if (player.restedDon > 0) {
            player.restedDon--;
        } else {
            player.don--;
        }

        player.donDeck++;
    }

    uiInstance?.updateDonDisplay?.();
    uiInstance?.renderDonDecks?.();

    return donToReturn;
}

function attachActiveDonToCard(player, targetCard, uiInstance = ui) {
    if (!player || !targetCard) {
        return { success: false, message: "No card was selected for DON!! attachment." };
    }

    if (targetCard.cardType !== "leader" && targetCard.cardType !== "character") {
        return { success: false, message: "DON!! can only be attached to leaders and characters." };
    }

    if (player.don < 1) {
        return { success: false, message: `${player.name} has no active DON!! to attach.` };
    }

    player.don--;
    targetCard.attachedDon = Number(targetCard.attachedDon || 0) + 1;
    uiInstance?.updateDonDisplay?.();
    uiInstance?.renderLeaders?.();
    uiInstance?.renderCharacters?.();

    return {
        success: true,
        message: `${player.name} attached 1 DON!! to ${targetCard.name}.`
    };
}

function getTotalAttachedDonCount(player) {
    if (!player) return 0;

    return [player.leader, ...player.characters.filter(Boolean)]
        .reduce((total, card) => total + Number(card.attachedDon || 0), 0);
}

function returnAttachedDonToCostArea(player, uiInstance = ui, options = {}) {
    if (!player) return 0;

    const cards = [player.leader, ...player.characters.filter(Boolean)].filter(Boolean);
    let returnedDon = 0;

    cards.forEach(card => {
        returnedDon += Number(card.attachedDon || 0);
        card.attachedDon = 0;
    });

    if (options.rested === false) {
        player.don += returnedDon;
    } else {
        player.restedDon += returnedDon;
    }

    if (returnedDon > 0) {
        uiInstance?.updateDonDisplay?.();
        uiInstance?.renderLeaders?.();
        uiInstance?.renderCharacters?.();
    }

    return returnedDon;
}

function detachAttachedDonToCostArea(player, card, uiInstance = ui) {
    const returnedDon = Number(card?.attachedDon || 0);

    if (!player || !card || returnedDon <= 0) return 0;

    card.attachedDon = 0;
    player.restedDon += returnedDon;
    uiInstance?.updateDonDisplay?.();

    return returnedDon;
}

function drawCard(player, uiInstance = ui) {
    const card = player.deck.shift();

    if (!card) {
        return loseByDeckOut(player, `${player.name} tried to draw from an empty deck.`);
    }

    const drawnCard = assignCardInstance(card);
    drawnCard.uiAnimation = "drawn";
    player.hand.push(drawnCard);
    uiInstance?.renderHands?.();
    uiInstance?.renderDecks?.();

    return checkDeckOut(player, `${player.name} drew the last card from their deck.`);
}

function drawCards(player, amount, uiInstance = ui) {
    for (let index = 0; index < amount; index++) {
        const result = drawCard(player, uiInstance);

        if (result?.deckOut) {
            return result;
        }
    }

    return { deckOut: false };
}

function getCardCounterValue(card) {
    return Math.max(0, Number(card?.counter ?? 0));
}

function getCounterPowerForUse(card) {
    return getCardCounterValue(card);
}

function getHandCounterEventCost() {
    return 0;
}

function canCardBeUsedAsCounter(card) {
    return card?.cardType !== "event" && getCardCounterValue(card) > 0;
}

function useCounterFromHand(player, handIndex, uiInstance = ui) {
    const card = player.hand[handIndex];
    const counterPower = getCardCounterValue(card);

    if (!card || card.cardType === "event" || counterPower <= 0) {
        return {
            success: false,
            counterPower: 0,
            message: `${card?.name || "That card"} has no printed counter value.`
        };
    }

    const counterCard = player.hand.splice(handIndex, 1)[0];
    moveCardToTrash(player, counterCard, uiInstance);
    uiInstance?.renderHands?.();
    uiInstance?.renderTrash?.();

    return {
        success: true,
        counterPower,
        card: counterCard,
        message: `${player.name} countered with ${counterCard.name} for +${counterPower} power.`
    };
}

function playCard(player, handIndex, uiInstance = ui, options = {}) {
    const card = player.hand[handIndex];

    if (!card) {
        return { success: false, message: "Selected card could not be found." };
    }

    if (card.cardType === "character") {
        return playCharacterCard(player, handIndex, uiInstance, options.targetSlotIndex ?? null);
    }

    if (card.cardType === "stage") {
        return playStageCard(player, handIndex, uiInstance);
    }

    if (card.cardType === "event") {
        return {
            success: false,
            message: `${card.name} cannot be played while card effects are disabled.`
        };
    }

    return { success: false, message: `${card.name} cannot be played.` };
}

function playCharacterCard(player, handIndex, uiInstance = ui, targetSlotIndex = null) {
    const card = player.hand[handIndex];

    if (!card || card.cardType !== "character") {
        return { success: false, message: "Selected card is not a character." };
    }

    const cost = getCardPlayCost(card);

    if (!restDonForCost(player, cost, uiInstance)) {
        return { success: false, message: `${player.name} does not have enough active DON!!.` };
    }

    let slotIndex = targetSlotIndex;

    if (slotIndex === null) {
        slotIndex = getFirstOpenCharacterSlotIndex(player);
    }

    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= 5) {
        player.don += cost;
        player.restedDon -= cost;
        uiInstance?.updateDonDisplay?.();
        return { success: false, message: `${player.name} has no valid character slot.` };
    }

    const replacedCard = player.characters[slotIndex] || null;
    const playedCard = player.hand.splice(handIndex, 1)[0];

    if (replacedCard) {
        detachAttachedDonToCostArea(player, replacedCard, uiInstance);
        replacedCard.uiAnimation = "trashed";
        player.trash.push(replacedCard);
    }

    playedCard.effects = [];
    playedCard.keywords = [];
    playedCard.state = "active";
    playedCard.playedOnTurn = player.turns;
    playedCard.playedFromZone = "hand";
    playedCard.uiAnimation = "played";
    player.characters[slotIndex] = playedCard;

    uiInstance?.renderHands?.();
    uiInstance?.renderCharacters?.();
    uiInstance?.renderTrash?.();

    return {
        success: true,
        message: replacedCard
            ? `${player.name} replaced ${replacedCard.name} with ${playedCard.name}.`
            : `${player.name} played ${playedCard.name} in character slot ${slotIndex + 1}.`
    };
}

function replaceStageOnFieldIfNeeded(player, incomingStage, uiInstance = ui) {
    if (!player.stage || player.stage === incomingStage) return "";

    const previousStage = player.stage;
    previousStage.uiAnimation = "trashed";
    player.trash.push(previousStage);
    player.stage = null;
    uiInstance?.renderTrash?.();

    return `${player.name} replaced ${previousStage.name}.`;
}

function playStageCard(player, handIndex, uiInstance = ui) {
    const card = player.hand[handIndex];

    if (!card || card.cardType !== "stage") {
        return { success: false, message: "Selected card is not a stage." };
    }

    const cost = getCardPlayCost(card);

    if (!restDonForCost(player, cost, uiInstance)) {
        return { success: false, message: `${player.name} does not have enough active DON!!.` };
    }

    const playedStage = player.hand.splice(handIndex, 1)[0];
    const replacementMessage = replaceStageOnFieldIfNeeded(player, playedStage, uiInstance);

    playedStage.effects = [];
    playedStage.keywords = [];
    playedStage.state = "active";
    playedStage.uiAnimation = "played";
    player.stage = playedStage;

    uiInstance?.renderHands?.();
    uiInstance?.renderStages?.();
    uiInstance?.renderTrash?.();

    return {
        success: true,
        message: replacementMessage
            ? `${replacementMessage} ${player.name} played ${playedStage.name} to the stage area.`
            : `${player.name} played ${playedStage.name} to the stage area.`
    };
}

function setCardRested(card) {
    if (!card || (card.state || "active") !== "active") return false;

    card.state = "rested";
    return true;
}

function restBoardCard(boardCardData) {
    return setCardRested(getBoardCardFromData(boardCardData));
}

function setBoardCardActive(boardCardData) {
    const card = getBoardCardFromData(boardCardData);

    if (!card) return false;

    card.state = "active";
    card.uiAnimation = "readied";
    ui?.renderLeaders?.();
    ui?.renderCharacters?.();
    ui?.renderStages?.();

    return true;
}

function trashCharacterFromField(player, slotIndex, uiInstance = ui, options = {}) {
    const character = Number.isInteger(slotIndex)
        ? player?.characters?.[slotIndex]
        : options.character;

    if (!player || !character) {
        return { success: false, message: "No character was found to trash." };
    }

    const resolvedSlotIndex = Number.isInteger(slotIndex)
        ? slotIndex
        : player.characters.findIndex(card => card?.instanceId === character.instanceId);

    if (resolvedSlotIndex !== -1 && player.characters[resolvedSlotIndex]?.instanceId === character.instanceId) {
        player.characters[resolvedSlotIndex] = null;
    }

    moveCardToTrash(player, character, uiInstance);

    if (options.render !== false) {
        uiInstance?.renderCharacters?.();
        uiInstance?.renderTrash?.();
    }

    return {
        success: true,
        character,
        message: `${character.name} was trashed and placed in the trash.`
    };
}

function KOCharacter(player, slotIndex, uiInstance = ui) {
    const character = player?.characters?.[slotIndex];

    if (!character) {
        return { success: false, message: "No character was found in that slot." };
    }

    player.characters[slotIndex] = null;
    moveCardToTrash(player, character, uiInstance);
    uiInstance?.renderCharacters?.();
    uiInstance?.renderTrash?.();

    return {
        success: true,
        character,
        message: `${character.name} was K.O.'d and placed in the trash.`
    };
}

function takeLifeDamage(player, amount, uiInstance = ui) {
    let lifeTaken = 0;

    for (let index = 0; index < amount; index++) {
        const lifeCard = player.life.shift();

        if (!lifeCard) break;

        lifeCard.effects = [];
        lifeCard.keywords = [];
        player.hand.push(lifeCard);
        lifeTaken++;
    }

    uiInstance?.renderLifeCards?.();
    uiInstance?.renderHands?.();

    return {
        success: lifeTaken > 0,
        lifeTaken,
        remainingLife: player.life.length,
        winnerPlayer: null,
        reasonTitle: "",
        reasonText: "",
        message: lifeTaken > 0
            ? `${player.name} took ${lifeTaken} life card${lifeTaken === 1 ? "" : "s"}.`
            : `${player.name} has no life cards left.`
    };
}

function banishLifeDamage(player, amount, uiInstance = ui) {
    return takeLifeDamage(player, amount, uiInstance);
}

function loseByLifeDamage(player, reasonText = "") {
    const winnerPlayer = getOpponentOfPlayer(player);

    if (winnerPlayer && typeof endGame === "function") {
        endGame(
            winnerPlayer,
            "Life Damage",
            reasonText || `${player.name} took damage with no life cards remaining.`
        );
    }

    return { success: Boolean(winnerPlayer), winnerPlayer };
}

function loseByDeckOut(player, reasonText = "") {
    const winnerPlayer = getOpponentOfPlayer(player);

    if (winnerPlayer && typeof endGame === "function") {
        endGame(
            winnerPlayer,
            "Deck Out",
            reasonText || `${player.name} has no cards left in deck.`
        );
    }

    return {
        success: Boolean(winnerPlayer),
        deckOut: Boolean(winnerPlayer),
        winnerPlayer
    };
}

function checkDeckOut(player, reasonText = "") {
    return player?.deck?.length > 0
        ? { deckOut: false }
        : loseByDeckOut(player, reasonText);
}

function moveCardToTrash(player, card, uiInstance = ui) {
    if (!player || !card) return;

    detachAttachedDonToCostArea(player, card, uiInstance);
    card.effects = [];
    card.keywords = [];
    card.uiAnimation = card.uiAnimation || "trashed";
    player.trash.push(card);
    uiInstance?.renderTrash?.();
}
