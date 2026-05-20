// gameInteractions.js

// =========================
// Card Instance Helpers
// =========================

let nextCardInstanceId = 1;

function createCardInstance(card) {
    return {
        ...card,
        aliases: card.aliases ? [...card.aliases] : [],
        keywords: card.keywords ? [...card.keywords] : [],
        effects: card.effects ? [...card.effects] : [],
        instanceId: `card-instance-${nextCardInstanceId++}`,
        state: card.state || "active"
    };
}

function assignCardInstance(card) {
    return createCardInstance(card);
}

// =========================
// Card Lookup Helpers
// =========================

function findHandCardIndexByInstanceId(player, cardInstanceId) {
    return player.hand.findIndex(card => card.instanceId === cardInstanceId);
}

function getCardPlayCost(card) {
    return Number(card.cost ?? card.playCost ?? 0);
}

function getCardEffectiveCost(card) {
    if (!card) {
        return 0;
    }

    const printedCost = Number(card.cost ?? card.playCost ?? 0);
    const modifier = card.costModifiers
        ?.reduce((total, entry) => total + Number(entry.amount ?? 0), 0) ?? 0;

    return Math.max(0, printedCost + modifier);
}

function canPlayerAffordCard(player, card) {
    const cardCost = getCardPlayCost(card);

    return player.don >= cardCost;
}

function getFirstOpenCharacterSlotIndex(player) {
    for (let i = 0; i < 5; i++) {
        if (!player.characters[i]) {
            return i;
        }
    }

    return -1;
}

function getBoardCardFromData(boardCardData) {
    if (!boardCardData) return null;

    const player = gameState[boardCardData.playerKey];

    if (!player) return null;

    if (boardCardData.cardType === "leader") {
        return player.leader;
    }

    if (boardCardData.cardType === "character") {
        return player.characters[boardCardData.slotIndex];
    }

    if (boardCardData.cardType === "stage") {
        return player.stage;
    }

    return null;
}

// =========================
// DON!! Actions
// =========================

function addDon(player, amount, ui) {
    const donToAdd = Math.min(amount, player.donDeck);

    player.don += donToAdd;
    player.donDeck -= donToAdd;

    ui.updateDonDisplay();
    ui.renderDonDecks();

    return donToAdd;
}

function addRestedDon(player, amount, ui) {
    const donToAdd = Math.min(amount, player.donDeck);

    player.restedDon += donToAdd;
    player.donDeck -= donToAdd;

    ui.updateDonDisplay();
    ui.renderDonDecks();

    return donToAdd;
}

function restDonForCost(player, cost, ui) {
    if (player.don < cost) {
        return false;
    }

    player.don -= cost;
    player.restedDon += cost;

    ui.updateDonDisplay();

    return true;
}

function returnDonToDeck(player, amount, ui) {
    const totalDon = player.don + player.restedDon;
    const donToReturn = Math.min(amount, totalDon);

    for (let i = 0; i < donToReturn; i++) {
        if (player.restedDon > 0) {
            player.restedDon--;
        } else {
            player.don--;
        }

        player.donDeck++;
    }

    ui.updateDonDisplay();
    ui.renderDonDecks();

    return donToReturn;
}

function setRestedDonActive(player, amount, ui) {
    const donToRefresh = Math.min(amount, player.restedDon);

    player.restedDon -= donToRefresh;
    player.don += donToRefresh;

    ui.updateDonDisplay();

    return donToRefresh;
}

// =========================
// Deck / Draw Actions
// =========================

function drawCard(player, uiInstance = ui) {
    const card = player.deck.shift();

    if (!card) {
        console.log(`${player.name} has no cards left in deck.`);
        return loseByDeckOut(player, `${player.name} tried to draw from an empty deck.`);
    }

    const drawnCard = assignCardInstance(card);

    drawnCard.uiAnimation = "drawn";
    player.hand.push(drawnCard);

    if (uiInstance) {
        uiInstance.renderHands();
        uiInstance.renderDecks();
    }

    return checkDeckOut(player, `${player.name} drew the last card from their deck.`);
}

function drawCards(player, amount, uiInstance = ui) {
    for (let i = 0; i < amount; i++) {
        const drawResult = drawCard(player, uiInstance);

        if (drawResult?.deckOut) {
            return drawResult;
        }
    }

    return {
        deckOut: false
    };
}

// =========================
// Counter Actions
// =========================

function getCardCounterValue(card, player = null) {
    return Number(card?.counter ?? 0) +
        getEventCounterBonusFromBoard(card, player);
}

function getCounterPowerForUse(card, player = null) {
    const counterEffectPower = getCounterEffectPower(card, player);

    return counterEffectPower > 0
        ? counterEffectPower
        : getCardCounterValue(card, player);
}

function getCounterEffectPower(card, player) {
    if (!card || !player) {
        return 0;
    }

    return card.effects
        ?.filter(effect => effect.type === "counter")
        .reduce((total, effect) => {
            if (!canUseCounterEffect(card, player, effect)) {
                return total;
            }

            return total + Number(effect.powerModifier ?? 0);
        }, 0) ?? 0;
}

function canUseCounterEffect(card, player, effect) {
    if (!card || !player || !effect) {
        return false;
    }

    if (effect.id === "DD01-013-counter") {
        if (!player.leader || (player.leader.state || "active") !== "rested") {
            return false;
        }

        if (typeof currentAttack === "undefined" || !currentAttack) {
            return false;
        }

        return true;
    }

    return Boolean(effect.actionId) || Number(effect.powerModifier ?? 0) > 0;
}

function getCounterEffects(card, player) {
    return card.effects
        ?.filter(effect => effect.type === "counter" && canUseCounterEffect(card, player, effect)) ?? [];
}

function getEventCounterBonusFromBoard(card, player) {
    if (!card || !player || card.cardType !== "event") {
        return 0;
    }

    if (!player.leader || (player.leader.state || "active") !== "rested") {
        return 0;
    }

    if (typeof gameState !== "undefined" && gameState.currentPlayer === player) {
        return 0;
    }

    return player.characters
        .filter(Boolean)
        .reduce((total, character) => {
            const eventCounterEffects = character.effects?.filter(effect => {
                return effect.type === "opponentsTurn" &&
                    effect.actionId === "eventCounterIfLeaderRested";
            }) ?? [];

            return total + eventCounterEffects.reduce((effectTotal, effect) => {
                return effectTotal + Number(effect.counterModifier ?? 0);
            }, 0);
        }, 0);
}

function canCardBeUsedAsCounter(card, player = null) {
    return getCardCounterValue(card, player) > 0 ||
        getCounterEffects(card, player).length > 0;
}

function useCounterFromHand(player, handIndex, ui) {
    const card = player.hand[handIndex];

    if (!card) {
        return {
            success: false,
            counterPower: 0,
            message: "Selected counter card could not be found."
        };
    }

    const counterPower = getCounterPowerForUse(card, player);
    const counterEffects = getCounterEffects(card, player);

    if (counterPower <= 0 && counterEffects.length === 0) {
        return {
            success: false,
            counterPower: 0,
            message: `${card.name} has no usable counter effect right now.`
        };
    }

    const counterCard = player.hand.splice(handIndex, 1)[0];

    moveCardToTrash(player, counterCard, ui);

    const effectMessages = resolveCounterEffects(player, counterCard, ui);

    ui.renderHands();
    ui.renderTrash();

    const effectText = effectMessages.length > 0
        ? ` ${effectMessages.join(" ")}`
        : "";

    return {
        success: true,
        counterPower,
        card: counterCard,
        message: counterPower > 0
            ? `${player.name} countered with ${counterCard.name} for +${counterPower} power.${effectText}`
            : `${player.name} countered with ${counterCard.name}.${effectText}`
    };
}

// =========================
// Play Card Router
// =========================

function playCard(player, handIndex, ui, options = {}) {
    if (handIndex < 0 || handIndex >= player.hand.length) {
        return {
            success: false,
            message: "Selected card could not be found."
        };
    }

    const card = player.hand[handIndex];

    if (!card) {
        return {
            success: false,
            message: "Selected card could not be found."
        };
    }

    console.log("Playing card:", card.name, card.cardType);

    if (card.cardType === "character") {
        return playCharacterCard(
            player,
            handIndex,
            ui,
            options.targetSlotIndex ?? null
        );
    }

    if (card.cardType === "stage") {
        return playStageCard(player, handIndex, ui);
    }

    if (card.cardType === "event") {
        return playEventCard(player, handIndex, ui);
    }

    return {
        success: false,
        message: `${card.name} cannot be played because its card type is unknown.`
    };
}

// =========================
// Character Play Actions
// =========================

function playCharacterCard(player, handIndex, ui, targetSlotIndex = null) {
    const card = player.hand[handIndex];

    if (!card) {
        return {
            success: false,
            message: "Selected card could not be found."
        };
    }

    if (card.cardType !== "character") {
        return {
            success: false,
            message: `${card.name} is not a character card.`
        };
    }

    const cost = getCardPlayCost(card);

    if (player.don < cost) {
        return {
            success: false,
            message: `${player.name} does not have enough active DON!! to play ${card.name}.`
        };
    }

    let slotIndex = targetSlotIndex;

    if (slotIndex === null) {
        slotIndex = getFirstOpenCharacterSlotIndex(player);
    }

    if (slotIndex === -1 || slotIndex === null || slotIndex < 0 || slotIndex >= 5) {
        return {
            success: false,
            message: `${player.name} has no valid character slot.`
        };
    }

    const replacedCard = player.characters[slotIndex] || null;

    const paidCost = restDonForCost(player, cost, ui);

    if (!paidCost) {
        return {
            success: false,
            message: `${player.name} could not pay the cost.`
        };
    }

    const playedCard = player.hand.splice(handIndex, 1)[0];

    playedCard.state = "active";
    playedCard.playedOnTurn = player.turns;
    playedCard.uiAnimation = "played";

    player.characters[slotIndex] = playedCard;

    if (replacedCard) {
        moveCardToTrash(player, replacedCard, ui);
    }

    const effectMessages = resolveOnPlayEffects(player, playedCard, ui);

    ui.renderHands();
    ui.renderLeaders();
    ui.renderCharacters();
    ui.renderTrash();

    const effectText = effectMessages.length > 0
        ? ` ${effectMessages.join(" ")}`
        : "";

    return {
        success: true,
        message: replacedCard
            ? `${player.name} replaced ${replacedCard.name} with ${playedCard.name}.${effectText}`
            : `${player.name} played ${playedCard.name} in character slot ${slotIndex + 1}.${effectText}`
    };
}

// =========================
// Stage Play Actions
// =========================

function playStageCard(player, handIndex, ui) {
    const card = player.hand[handIndex];

    if (!card) {
        return {
            success: false,
            message: "Selected stage could not be found."
        };
    }

    if (card.cardType !== "stage") {
        return {
            success: false,
            message: `${card.name} is not a stage card.`
        };
    }

    const cost = getCardPlayCost(card);

    if (player.don < cost) {
        return {
            success: false,
            message: `${player.name} does not have enough active DON!! to play ${card.name}.`
        };
    }

    const paidCost = restDonForCost(player, cost, ui);

    if (!paidCost) {
        return {
            success: false,
            message: `${player.name} could not pay the cost.`
        };
    }

    const oldStage = player.stage;
    const playedStage = player.hand.splice(handIndex, 1)[0];

    playedStage.state = "active";
    playedStage.uiAnimation = "played";
    player.stage = playedStage;

    if (oldStage) {
        moveCardToTrash(player, oldStage, ui);
    }

    const effectMessages = resolveOnPlayEffects(player, playedStage, ui);

    ui.renderHands();
    ui.renderLeaders();
    ui.renderCharacters();
    ui.renderStages();
    ui.renderTrash();

    const effectText = effectMessages.length > 0
        ? ` ${effectMessages.join(" ")}`
        : "";

    return {
        success: true,
        message: oldStage
            ? `${player.name} replaced ${oldStage.name} with ${playedStage.name}.${effectText}`
            : `${player.name} played ${playedStage.name} to the stage area.${effectText}`
    };
}

function resolveOnPlayEffects(player, card, ui) {
    if (!player || !card) {
        return [];
    }

    const messages = [];

    card.effects
        ?.filter(effect => effect.type === "onPlay")
        .forEach(effect => {
            if (effect.actionId !== "drawOneCard") {
                return;
            }

            const drawResult = drawCard(player, ui);

            messages.push(
                drawResult?.deckOut
                    ? `${card.name}'s On Play effect tried to draw 1 card, but ${player.name} lost by deck out.`
                    : `${card.name}'s On Play effect drew 1 card.`
            );
        });

    return messages;
}

// =========================
// Effect Action Helpers
// =========================

function isOptionalEffect(effect) {
    const effectText = String(effect?.text || "").toLowerCase();

    return effect?.optional === true ||
        effectText.includes("may ") ||
        effectText.includes("up to") ||
        /don!!?\s*-\s*\d+/.test(effectText) ||
        /trash\s+\d+/.test(effectText) ||
        /rest\s+\d+/.test(effectText);
}

function shouldPromptEffectActivation(effect, options = {}) {
    return !options.skipActivationPrompt && isOptionalEffect(effect);
}

function getEffectLabel(effect) {
    if (!effect) {
        return "Effect";
    }

    const typeLabels = {
        onPlay: "On Play",
        onKO: "On K.O.",
        main: "Main",
        activateMain: "Activate: Main",
        counter: "Counter",
        trigger: "Trigger"
    };

    return typeLabels[effect.type] || "Effect";
}

function getEffectPrompt(effect) {
    const label = getEffectLabel(effect);
    const text = String(effect?.text || "Activate this effect?");

    return text.toLowerCase().startsWith(label.toLowerCase())
        ? text
        : `${label}: ${text}`;
}

function resolveEffectAction(player, sourceCard, effect, ui, options = {}) {
    if (shouldPromptEffectActivation(effect, options) && ui && typeof ui.chooseEffectActivation === "function") {
        ui.chooseEffectActivation({
            player,
            sourceCard,
            effect,
            title: sourceCard?.name || "Effect",
            prompt: getEffectPrompt(effect),
            activateText: "Activate",
            skipText: "Skip",
            onComplete: (shouldActivate) => {
                if (!shouldActivate) {
                    addGameLog(`${player.name} skipped ${sourceCard.name}'s ${getEffectLabel(effect)} effect.`);
                    return;
                }

                const message = resolveEffectAction(player, sourceCard, effect, ui, {
                    ...options,
                    skipActivationPrompt: true
                });

                if (message) {
                    addGameLog(message);
                }
            }
        });

        return `${player.name} is choosing whether to activate ${sourceCard.name}'s effect.`;
    }

    if (!player || !sourceCard || !effect) {
        return "";
    }

    if (effect.actionId === "drawOneCard") {
        const drawResult = drawCard(player, ui);

        return drawResult?.deckOut
            ? `${sourceCard.name}'s effect tried to draw 1 card, but ${player.name} lost by deck out.`
            : `${sourceCard.name}'s effect drew 1 card.`;
    }

    if (effect.actionId === "lookTopFiveDandadan") {
        return lookTopCardsForType(player, sourceCard, 5, "Dandadan", ui);
    }

    if (effect.actionId === "lookTopFiveAddOne") {
        return lookTopCardsForType(player, sourceCard, 5, "", ui);
    }

    if (effect.actionId === "lookTopFiveBlackSwordsmanPartyOtherThanSelf") {
        return lookTopCardsForType(player, sourceCard, 5, "Black Swordsman Party", ui, {
            excludeNames: [sourceCard.name]
        });
    }

    if (effect.id === "DD01-008-on-play-add-don") {
        const addedDon = addRestedDon(player, 1, ui);

        return addedDon > 0
            ? `${sourceCard.name}'s On Play effect added 1 rested DON!!.`
            : `${sourceCard.name}'s On Play effect found no DON!! cards to add.`;
    }

    if (effect.id === "DD01-009-on-play-rest-character") {
        return chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing cost 4 or lower character to rest.",
            optional: true,
            filter: card => getCardEffectiveCost(card) <= 4 && (card.state || "active") === "active",
            onSelect: ({ card }) => {
                card.state = "rested";
                ui.renderCharacters();
                addGameLog(`${sourceCard.name}'s On Play effect rested ${card.name}.`);
            },
            skipMessage: `${player.name} did not rest a character with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name}'s On Play effect found no opposing cost 4 or lower characters.`
        });
    }

    if (effect.id === "DD01-012-play-choice") {
        const applyKeywordChoice = (keyword) => {
            sourceCard.keywords = sourceCard.keywords || [];

            if (!sourceCard.keywords.includes(keyword)) {
                sourceCard.keywords.push(keyword);
            }

            if (ui?.renderCharacters) {
                ui.renderCharacters();
            }

            addGameLog(`${sourceCard.name} gained ${keyword === "blocker" ? "Blocker" : "Rush"}.`);
        };

        if (ui && typeof ui.chooseEffectOption === "function") {
            ui.chooseEffectOption({
                player,
                sourceCard,
                title: sourceCard.name,
                prompt: "Choose which keyword Vamola gains.",
                options: [
                    {
                        label: "Blocker",
                        value: "blocker"
                    },
                    {
                        label: "Rush",
                        value: "rush"
                    }
                ],
                onComplete: applyKeywordChoice
            });

            return `${player.name} is choosing whether ${sourceCard.name} gains Blocker or Rush.`;
        }

        const choseBlocker = typeof window !== "undefined" && typeof window.confirm === "function"
            ? window.confirm(`${sourceCard.name}: choose OK for Blocker, or Cancel for Rush.`)
            : true;
        const keyword = choseBlocker ? "blocker" : "rush";

        sourceCard.keywords = sourceCard.keywords || [];

        if (!sourceCard.keywords.includes(keyword)) {
            sourceCard.keywords.push(keyword);
        }

        return `${sourceCard.name} gained ${choseBlocker ? "Blocker" : "Rush"}.`;
    }

    if (effect.id === "DD01-004-main") {
        return playTurboGrannyFormFromDeck(player, sourceCard, ui);
    }

    if (effect.id === "DD01-011-main") {
        const damageResult = takeLifeDamage(player, 1, ui);

        if (!damageResult.success) {
            loseByLifeDamage(player, `${player.name} took damage from ${sourceCard.name} with no life cards remaining.`);
            return `${sourceCard.name}'s Main effect dealt damage while ${player.name} had no life cards.`;
        }

        const message = setOneNamedOwnCardActive(player, sourceCard, "Okarun", ui);

        return `${player.name} took 1 damage. ${message}`;
    }

    if (effect.id === "DD01-013-main") {
        if (!restDonForCost(player, 3, ui)) {
            return `${player.name} could not rest 3 active DON!! for ${sourceCard.name}.`;
        }

        return chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose one of your Dandadan characters to give +4000 and Unblockable for its next battle.",
            optional: true,
            includeLeader: false,
            filter: card => card.cardType === "character" && hasTypeText(card, "Dandadan"),
            onSelect: ({ card }) => {
                addBattlePowerBonus(card, 4000);
                addBattleKeyword(card, "unblockable");
                ui.renderCharacters();
                addGameLog(`${sourceCard.name} gave ${card.name} +4000 power and Unblockable for its next battle.`);
            },
            skipMessage: `${player.name} paid 3 DON!! but did not choose a character for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no eligible Dandadan characters.`
        });
    }

    if (effect.id === "BK01-002-main") {
        return chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 Guts or Skull Knight character to give +5000 power and prevent blocking this turn.",
            optional: true,
            includeLeader: false,
            filter: card => {
                return card.cardType === "character" &&
                    (CardEffects.hasCardName(card, "Guts") || CardEffects.hasCardName(card, "Skull Knight"));
            },
            onSelect: ({ card }) => {
                addTemporaryPowerBonus(card, 5000);
                addTemporaryKeyword(card, "unblockable");
                takeTopLifeToHand(player, ui);
                ui.renderCharacters();
                ui.renderLifeCards();
                ui.renderHands();
                addGameLog(`${sourceCard.name} gave ${card.name} +5000 power and made its attacks unblockable this turn.`);
            },
            skipMessage: `${player.name} did not choose a character for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no Guts or Skull Knight characters.`
        });
    }

    if (effect.id === "BK01-002-trigger") {
        addTemporaryPowerBonus(player.leader, 1000);
        ui.renderLeaders();
        return `${sourceCard.name}'s Trigger gave ${player.name}'s leader +1000 power until end of turn.`;
    }

    if (effect.id === "BK01-004-on-play-minus-cost") {
        if (!player.characters.some(card => CardEffects.hasCardName(card, "Guts"))) {
            return `${sourceCard.name}'s On Play effect did not resolve because ${player.name} has no Guts character.`;
        }

        return chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character to give -1 cost for this turn.",
            optional: true,
            onSelect: ({ card }) => {
                addCostModifier(card, -1);
                addGameLog(`${sourceCard.name} gave ${card.name} -1 cost this turn.`);
            },
            skipMessage: `${player.name} did not reduce a character's cost with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing characters.`
        });
    }

    if (
        effect.id === "BK01-005-activate-main-give-don" ||
        effect.id === "BK01-007-on-play-give-don"
    ) {
        return giveRestedDonToOwnBoardCard(player, sourceCard, ui, {
            prompt: "Choose your leader or up to 1 character to receive 1 rested DON!!."
        });
    }

    if (effect.id === "BK01-006-activate-main-protect-guts") {
        return chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 Guts character to protect from opponent effects until your next turn.",
            optional: true,
            includeLeader: false,
            filter: card => card.cardType === "character" && CardEffects.hasCardName(card, "Guts"),
            onSelect: ({ card }) => {
                card.protectedFromOpponentEffects = true;
                addGameLog(`${sourceCard.name} protected ${card.name} from opponent effects.`);
            },
            skipMessage: `${player.name} did not choose a Guts character for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no Guts characters.`
        });
    }

    if (effect.id === "BK01-008-activate-main-minus-cost-rest") {
        if ((sourceCard.state || "active") === "rested") {
            return `${sourceCard.name} is already rested.`;
        }

        sourceCard.state = "rested";
        sourceCard.uiAnimation = "rested";

        if (ui?.renderCharacters) {
            ui.renderCharacters();
        }

        return chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character to give -2 cost this turn.",
            optional: true,
            onSelect: ({ card }) => {
                addCostModifier(card, -2);
                addGameLog(`${sourceCard.name} rested and gave ${card.name} -2 cost this turn.`);
            },
            skipMessage: `${player.name} rested ${sourceCard.name} but did not choose a target.`,
            emptyMessage: `${sourceCard.name} found no opposing characters.`
        });
    }

    if (effect.id === "BK01-009-on-play-ko-cost-five") {
        return chooseOpponentCharacterToKO(player, sourceCard, ui, 5);
    }

    if (effect.id === "BK01-010-on-play-rush") {
        if (!player.characters.some(card => CardEffects.hasCardName(card, "Farnese"))) {
            return `${sourceCard.name}'s On Play effect found no Farnese character.`;
        }

        addTemporaryKeyword(sourceCard, "rush");
        ui.renderCharacters();
        return `${sourceCard.name} gained Rush.`;
    }

    if (effect.id === "BK01-011-main") {
        const costMessage = chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character to give -2 cost this turn.",
            optional: true,
            onSelect: ({ card }) => {
                addCostModifier(card, -2);
                addGameLog(`${sourceCard.name} gave ${card.name} -2 cost this turn.`);
            },
            skipMessage: `${player.name} did not reduce a character's cost with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing characters for cost reduction.`
        });

        const koMessage = chooseOpponentCharacterToKO(player, sourceCard, ui, 5);

        return `${costMessage} ${koMessage}`;
    }

    if (effect.id === "BK01-012-on-play-minus-cost") {
        return chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character to give -2 cost this turn.",
            optional: true,
            onSelect: ({ card }) => {
                addCostModifier(card, -2);
                addGameLog(`${sourceCard.name} gave ${card.name} -2 cost this turn.`);
            },
            skipMessage: `${player.name} did not reduce a character's cost with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing characters.`
        });
    }

    if (
        effect.id === "BK01-013-on-play-give-don" ||
        effect.id === "BK01-016-on-play-give-don"
    ) {
        if (!CardEffects.hasCardName(player.leader, "Guts")) {
            return `${sourceCard.name}'s On Play effect did not resolve because ${player.name}'s leader is not Guts.`;
        }

        return giveRestedDonToCard(player, sourceCard, player.leader, ui);
    }

    if (effect.id === "BK01-014-on-play-ko-each") {
        const ownMessage = chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 of your characters to K.O.",
            optional: true,
            includeLeader: false,
            filter: card => card.cardType === "character",
            onSelect: ({ slotIndex }) => {
                const result = KOCharacter(player, slotIndex, ui);
                addGameLog(`${sourceCard.name} K.O.'d one of your characters. ${result.message}`);
            },
            skipMessage: `${player.name} did not K.O. one of their characters with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no own characters to K.O.`
        });
        const opponentMessage = chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character to K.O.",
            optional: true,
            onSelect: ({ playerKey, slotIndex, card }) => {
                if (isProtectedFromOpponentEffects(card, playerKey, player)) {
                    addGameLog(`${card.name} is protected from opponent effects.`);
                    return;
                }

                const result = KOCharacter(gameState[playerKey], slotIndex, ui);
                addGameLog(`${sourceCard.name} K.O.'d ${card.name}. ${result.message}`);
            },
            skipMessage: `${player.name} did not K.O. an opposing character with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing characters.`
        });

        return `${ownMessage} ${opponentMessage}`;
    }

    if (effect.id === "BK01-015-main") {
        if (!CardEffects.hasCardName(player.leader, "Guts")) {
            return `${sourceCard.name}'s Main effect did not resolve because ${player.name}'s leader is not Guts.`;
        }

        const donMessage = giveRestedDonToCard(player, sourceCard, player.leader, ui);
        const koMessage = chooseOpponentCharacterToKO(player, sourceCard, ui, 3, false);

        return `${donMessage} ${koMessage}`;
    }

    return "";
}

function lookTopCardsForType(player, sourceCard, amount, typeText, ui, options = {}) {
    if (!player || !sourceCard) {
        return "";
    }

    const cardsToLookAt = player.deck.splice(0, amount);

    if (cardsToLookAt.length === 0) {
        return `${sourceCard.name}'s effect found no cards because ${player.name}'s deck is empty.`;
    }

    const isSelectable = (card) => {
        const matchesType = String(card.type || "")
            .toLowerCase()
            .includes(String(typeText).toLowerCase());
        const isExcludedName = (options.excludeNames || [])
            .some(name => CardEffects.hasCardName(card, name));

        return matchesType && !isExcludedName;
    };

    const finishSelection = (selection) => {
        const originalCardsToLookAt = [...cardsToLookAt];
        const selectedIndex = typeof selection === "object" && selection !== null
            ? selection.selectedIndex
            : selection;
        const bottomOrder = typeof selection === "object" && selection !== null
            ? selection.bottomOrder
            : null;
        let selectedCard = null;

        if (
            selectedIndex !== null &&
            selectedIndex >= 0 &&
            selectedIndex < cardsToLookAt.length &&
            isSelectable(cardsToLookAt[selectedIndex])
        ) {
            selectedCard = cardsToLookAt.splice(selectedIndex, 1)[0];
            player.hand.push(assignCardInstance(selectedCard));

            addGameLog(`${player.name} revealed ${selectedCard.name} and added it to hand.`);
        } else {
            addGameLog(`${player.name} did not add a card with ${sourceCard.name}'s effect.`);
        }

        const orderedBottomCards = Array.isArray(bottomOrder)
            ? bottomOrder
                .map(index => originalCardsToLookAt[index])
                .filter(card => cardsToLookAt.includes(card))
                .filter(Boolean)
            : cardsToLookAt;

        const orderedSet = new Set(orderedBottomCards);
        const unorderedBottomCards = cardsToLookAt.filter(card => !orderedSet.has(card));

        player.deck.push(...orderedBottomCards, ...unorderedBottomCards);

        if (ui?.renderHands) {
            ui.renderHands();
        }

        if (ui?.renderDecks) {
            ui.renderDecks();
        }

        addGameLog(`${player.name} placed the remaining card${cardsToLookAt.length === 1 ? "" : "s"} on the bottom of the deck.`);
    };

    if (ui && typeof ui.lookTopCardsAddToHand === "function") {
        ui.lookTopCardsAddToHand({
            player,
            sourceCard,
            cards: cardsToLookAt,
            isSelectable,
            onComplete: finishSelection
        });

        return `${player.name} is looking at the top ${cardsToLookAt.length} card${cardsToLookAt.length === 1 ? "" : "s"} of the deck.`;
    }

    const firstValidIndex = cardsToLookAt.findIndex(isSelectable);

    finishSelection(firstValidIndex === -1 ? null : firstValidIndex);

    return `${sourceCard.name}'s look top effect resolved.`;
}

function getPlayerKey(player) {
    if (typeof gameState === "undefined") {
        return null;
    }

    if (player === gameState.player1) {
        return "player1";
    }

    if (player === gameState.player2) {
        return "player2";
    }

    return null;
}

function getOpponentPlayer(player) {
    const playerKey = getPlayerKey(player);

    if (!playerKey) {
        return null;
    }

    return gameState[playerKey === "player1" ? "player2" : "player1"];
}

function hasTypeText(card, typeText) {
    return String(card?.type || "")
        .toLowerCase()
        .includes(String(typeText).toLowerCase());
}

function isLeaderOrDandadanCharacter(card) {
    if (!card) {
        return false;
    }

    if (card.cardType === "leader") {
        return true;
    }

    return card.cardType === "character" && hasTypeText(card, "Dandadan");
}

function getOwnBoardChoices(player, options = {}) {
    const playerKey = getPlayerKey(player);

    if (!playerKey) {
        return [];
    }

    const choices = [];

    if (options.includeLeader !== false && player.leader) {
        choices.push({
            playerKey,
            cardType: "leader",
            card: player.leader
        });
    }

    player.characters.forEach((card, slotIndex) => {
        if (!card) {
            return;
        }

        choices.push({
            playerKey,
            cardType: "character",
            slotIndex,
            card
        });
    });

    if (options.includeStage && player.stage) {
        choices.push({
            playerKey,
            cardType: "stage",
            card: player.stage
        });
    }

    return choices;
}

function getOpponentCharacterChoices(player, filter) {
    const opponent = getOpponentPlayer(player);
    const opponentKey = getPlayerKey(opponent);

    if (!opponent || !opponentKey) {
        return [];
    }

    return opponent.characters
        .map((card, slotIndex) => ({
            playerKey: opponentKey,
            cardType: "character",
            slotIndex,
            card
        }))
        .filter(choice => choice.card && (!filter || filter(choice.card, choice)));
}

function chooseBoardCard(player, sourceCard, choices, options = {}) {
    const validChoices = choices.filter(choice => {
        return choice.card && (!options.filter || options.filter(choice.card, choice));
    });

    if (validChoices.length === 0) {
        if (typeof options.onEmpty === "function") {
            options.onEmpty();
        }

        return options.emptyMessage || `${sourceCard.name} found no eligible cards.`;
    }

    const finishSelection = (choice) => {
        if (!choice) {
            addGameLog(options.skipMessage || `${player.name} did not choose a card for ${sourceCard.name}.`);

            if (typeof options.onSkip === "function") {
                options.onSkip();
            }

            return;
        }

        options.onSelect(choice);
    };

    if (ui && typeof ui.chooseBoardCard === "function") {
        ui.chooseBoardCard({
            player,
            sourceCard,
            prompt: options.prompt || "Choose a card.",
            choices: validChoices,
            optional: options.optional !== false,
            onComplete: finishSelection
        });

        return `${player.name} is choosing a card for ${sourceCard.name}.`;
    }

    finishSelection(validChoices[0]);

    return `${sourceCard.name}'s effect resolved.`;
}

function chooseOwnBoardCard(player, sourceCard, options) {
    return chooseBoardCard(
        player,
        sourceCard,
        getOwnBoardChoices(player, options),
        options
    );
}

function chooseOpponentCharacter(player, sourceCard, options) {
    return chooseBoardCard(
        player,
        sourceCard,
        getOpponentCharacterChoices(player, options.filter),
        {
            ...options,
            filter: null
        }
    );
}

function addTemporaryKeyword(card, keyword) {
    if (!card.temporaryKeywords) {
        card.temporaryKeywords = [];
    }

    card.temporaryKeywords.push(keyword);
}

function addBattleKeyword(card, keyword) {
    if (!card.battleKeywords) {
        card.battleKeywords = [];
    }

    card.battleKeywords.push(keyword);
}

function addBattlePowerBonus(card, amount) {
    card.battlePowerBonus = Number(card.battlePowerBonus || 0) + amount;
}

function addTemporaryPowerBonus(card, amount) {
    if (!card) {
        return;
    }

    card.temporaryPowerBonus = Number(card.temporaryPowerBonus || 0) + Number(amount || 0);
}

function addDurationPowerBonus(card, amount, expiresAtEndOfTurns) {
    if (!card) {
        return;
    }

    if (!Array.isArray(card.durationPowerBonuses)) {
        card.durationPowerBonuses = [];
    }

    card.durationPowerBonuses.push({
        amount: Number(amount || 0),
        expiresAtEndOfTurns
    });
}

function addCostModifier(card, amount) {
    if (!card) {
        return;
    }

    if (!Array.isArray(card.costModifiers)) {
        card.costModifiers = [];
    }

    card.costModifiers.push({
        amount: Number(amount || 0)
    });
}

function giveRestedDonToCard(player, sourceCard, targetCard, ui) {
    if (!player || !sourceCard || !targetCard) {
        return "";
    }

    if (player.restedDon < 1) {
        return `${sourceCard.name} found no rested DON!! to give.`;
    }

    player.restedDon -= 1;
    targetCard.attachedDon = Number(targetCard.attachedDon || 0) + 1;

    if (ui?.updateDonDisplay) {
        ui.updateDonDisplay();
    }

    if (ui?.renderLeaders) {
        ui.renderLeaders();
    }

    if (ui?.renderCharacters) {
        ui.renderCharacters();
    }

    return `${sourceCard.name} gave 1 rested DON!! to ${targetCard.name}.`;
}

function giveRestedDonToOwnBoardCard(player, sourceCard, ui, options = {}) {
    if (player.restedDon < 1) {
        return `${sourceCard.name} found no rested DON!! to give.`;
    }

    return chooseOwnBoardCard(player, sourceCard, {
        prompt: options.prompt || "Choose your leader or up to 1 character to receive 1 rested DON!!.",
        optional: true,
        includeLeader: true,
        filter: card => card.cardType === "leader" || card.cardType === "character",
        onSelect: ({ card }) => {
            addGameLog(giveRestedDonToCard(player, sourceCard, card, ui));
        },
        skipMessage: `${player.name} did not give a DON!! card with ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no eligible cards to receive DON!!.`
    });
}

function chooseOpponentCharacterToKO(player, sourceCard, ui, maxCost, optional = true) {
    return chooseOpponentCharacter(player, sourceCard, {
        prompt: `Choose ${optional ? "up to 1" : "1"} opposing cost ${maxCost} or lower character to K.O.`,
        optional,
        filter: card => getCardEffectiveCost(card) <= maxCost,
        onSelect: ({ playerKey, slotIndex, card }) => {
            if (isProtectedFromOpponentEffects(card, playerKey, player)) {
                addGameLog(`${card.name} is protected from opponent effects.`);
                return;
            }

            const result = KOCharacter(gameState[playerKey], slotIndex, ui);
            addGameLog(`${sourceCard.name} K.O.'d ${card.name}. ${result.message}`);
        },
        skipMessage: `${player.name} did not K.O. a character with ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no opposing cost ${maxCost} or lower characters.`
    });
}

function takeTopLifeToHand(player, ui) {
    const card = player?.life?.shift();

    if (!card) {
        loseByLifeDamage(player, `${player.name} tried to add life to hand with no life cards remaining.`);
        return null;
    }

    player.hand.push(card);

    if (ui?.renderLifeCards) {
        ui.renderLifeCards();
    }

    if (ui?.renderHands) {
        ui.renderHands();
    }

    return card;
}

function isProtectedFromOpponentEffects(card, cardPlayerKey, actingPlayer) {
    if (!card?.protectedFromOpponentEffects) {
        return false;
    }

    const actingPlayerKey = getPlayerKey(actingPlayer);

    return actingPlayerKey && actingPlayerKey !== cardPlayerKey;
}

function resolveGutsLeaderCharacterRemovedBonus(removedCharacterPlayer, ui) {
    const opponent = getOpponentOfPlayer(removedCharacterPlayer);
    const leader = opponent?.leader;

    if (!leader || leader.cardNumber !== "BK01-001") {
        return;
    }

    if (Number(leader.attachedDon || 0) < 1) {
        return;
    }

    addDurationPowerBonus(leader, 1000, Number(opponent.turns || 0) + 1);

    if (ui?.renderLeaders) {
        ui.renderLeaders();
    }

    addGameLog(`${leader.name}'s effect gave it +1000 power until the end of ${opponent.name}'s next turn.`);
}

function setOneNamedOwnCardActive(player, sourceCard, cardName, ui) {
    return chooseOwnBoardCard(player, sourceCard, {
        prompt: `Choose one of your ${cardName} cards to set as active.`,
        optional: true,
        includeLeader: true,
        filter: card => CardEffects.hasCardName(card, cardName),
        onSelect: ({ card }) => {
            card.state = "active";
            ui.renderLeaders();
            ui.renderCharacters();
            addGameLog(`${sourceCard.name} set ${card.name} as active.`);
        },
        skipMessage: `${player.name} did not set a ${cardName} card as active with ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no ${cardName} cards to set active.`
    });
}

function playTurboGrannyFormFromDeck(player, sourceCard, ui) {
    const totalDon = player.don + player.restedDon;

    if (totalDon < 5) {
        return `${sourceCard.name}'s Main effect did not resolve because ${player.name} has fewer than 5 DON!! cards.`;
    }

    const stageIndex = player.deck.findIndex(card => CardEffects.hasCardName(card, "Turbo Granny Form"));

    if (stageIndex === -1) {
        shuffleDeck(player.deck);
        ui.renderDecks();
        return `${sourceCard.name} found no Turbo Granny Form in the deck. ${player.name} shuffled the deck.`;
    }

    const oldStage = player.stage;
    const stage = player.deck.splice(stageIndex, 1)[0];

    stage.state = "active";
    player.stage = stage;

    if (oldStage) {
        moveCardToTrash(player, oldStage, ui);
    }

    shuffleDeck(player.deck);

    ui.renderDecks();
    ui.renderStages();
    ui.renderTrash();

    return oldStage
        ? `${sourceCard.name} played ${stage.name} from the deck, replacing ${oldStage.name}, then shuffled the deck.`
        : `${sourceCard.name} played ${stage.name} from the deck, then shuffled the deck.`;
}

function resolveCounterEffects(player, card, ui) {
    const messages = [];

    getCounterEffects(card, player).forEach(effect => {
        if (effect.actionId) {
            const message = resolveEffectAction(player, card, effect, ui);

            if (message) {
                messages.push(message);
            }
        }
    });

    return messages;
}

function resolveOnPlayEffects(player, card, ui) {
    if (!player || !card) {
        return [];
    }

    const messages = [];

    card.effects
        ?.filter(effect => effect.type === "onPlay")
        .forEach(effect => {
            const message = resolveEffectAction(player, card, effect, ui);

            if (message) {
                messages.push(message);
            }
        });

    return messages;
}

function resolveOnKOEffects(player, card, ui) {
    if (!player || !card) {
        return [];
    }

    const messages = [];

    card.effects
        ?.filter(effect => effect.type === "onKO")
        .forEach(effect => {
            if (effect.id === "DD01-012-on-ko-add-don") {
                const addedDon = addDon(player, 1, ui);

                messages.push(
                    addedDon > 0
                        ? `${card.name}'s On K.O. effect added 1 active DON!!.`
                        : `${card.name}'s On K.O. effect found no DON!! cards to add.`
                );
                return;
            }

            const message = resolveEffectAction(player, card, effect, ui);

            if (message) {
                messages.push(message);
            }
        });

    return messages;
}

function resolveMainEffects(player, card, ui, options = {}) {
    if (!player || !card) {
        return [];
    }

    const messages = [];

    card.effects
        ?.filter(effect => effect.type === "main")
        .forEach(effect => {
            const message = resolveEffectAction(player, card, effect, ui, options);

            if (message) {
                messages.push(message);
            }
        });

    return messages;
}

// =========================
// Event Play Actions
// =========================

function playEventCard(player, handIndex, ui) {
    const card = player.hand[handIndex];

    if (!card) {
        return {
            success: false,
            message: "Selected event could not be found."
        };
    }

    if (card.cardType !== "event") {
        return {
            success: false,
            message: `${card.name} is not an event card.`
        };
    }

    const cost = getCardPlayCost(card);

    if (player.don < cost) {
        return {
            success: false,
            message: `${player.name} does not have enough active DON!! to play ${card.name}.`
        };
    }

    const paidCost = restDonForCost(player, cost, ui);

    if (!paidCost) {
        return {
            success: false,
            message: `${player.name} could not pay the cost.`
        };
    }

    // Remove the event from hand before resolving effects.
    // This prevents draw effects from changing the hand while the event is still in it.
    const playedEvent = player.hand.splice(handIndex, 1)[0];

    const effectMessages = resolveMainEffects(player, playedEvent, ui);

    playedEvent.uiAnimation = "played";
    moveCardToTrash(player, playedEvent, ui);

    ui.renderHands();
    ui.renderTrash();

    const effectText = effectMessages.length > 0
        ? ` ${effectMessages.join(" ")}`
        : "";

    return {
        success: true,
        message: `${player.name} played ${playedEvent.name}. It was placed in the trash.${effectText}`
    };
}

// =========================
// Board Card State Actions
// =========================

function restBoardCard(boardCardData) {
    const card = getBoardCardFromData(boardCardData);

    if (!card) return false;

    card.uiAnimation = "rested";
    card.state = "rested";

    ui.renderLeaders();
    ui.renderCharacters();
    ui.renderStages();

    return true;
}

function setBoardCardActive(boardCardData) {
    const card = getBoardCardFromData(boardCardData);

    if (!card) return false;

    card.uiAnimation = "readied";
    card.state = "active";

    ui.renderLeaders();
    ui.renderCharacters();
    ui.renderStages();

    return true;
}

function KOCharacter(player, slotIndex, ui) {
    const character = player.characters[slotIndex];

    if (!character) {
        return {
            success: false,
            message: "No character was found in that slot."
        };
    }

    player.characters[slotIndex] = null;

    moveCardToTrash(player, character, ui);
    resolveGutsLeaderCharacterRemovedBonus(player, ui);

    const effectMessages = resolveOnKOEffects(player, character, ui);

    ui.renderLeaders();
    ui.renderCharacters();
    ui.renderTrash();

    const effectText = effectMessages.length > 0
        ? ` ${effectMessages.join(" ")}`
        : "";

    return {
        success: true,
        message: `${character.name} was K.O.'d and placed in the trash.${effectText}`
    };
}

// =========================
// Life / Damage Actions
// =========================

function takeLifeDamage(player, amount, ui) {
    let lifeTaken = 0;
    const triggerMessages = [];

    for (let i = 0; i < amount; i++) {
        const topLifeCard = player.life.shift();

        if (!topLifeCard) {
            break;
        }

        const triggerEffects = topLifeCard.effects
            ?.filter(effect => effect.type === "trigger") ?? [];

        if (triggerEffects.length > 0) {
            triggerMessages.push(...resolveTriggerEffects(player, topLifeCard, triggerEffects, ui));
        } else {
            player.hand.push(topLifeCard);
        }

        lifeTaken++;
    }

    ui.renderLifeCards();
    ui.renderHands();

    const triggerText = triggerMessages.length > 0
        ? ` ${triggerMessages.join(" ")}`
        : "";

    return {
        success: lifeTaken > 0,
        lifeTaken,
        remainingLife: player.life.length,
        message: lifeTaken > 0
            ? `${player.name} took ${lifeTaken} life card${lifeTaken === 1 ? "" : "s"}.${triggerText}`
            : `${player.name} has no life cards left.`
    };
}

function resolveTriggerEffects(player, card, triggerEffects, ui) {
    const messages = [];

    triggerEffects.forEach(effect => {
        const activateTrigger = () => {
            const message = resolveSingleTriggerEffect(player, card, effect, ui);

            if (message) {
                addGameLog(message);
            }
        };

        const skipTrigger = () => {
            player.hand.push(card);

            if (ui?.renderHands) {
                ui.renderHands();
            }

            addGameLog(`${player.name} skipped ${card.name}'s Trigger and added it to hand.`);
        };

        if (ui && typeof ui.chooseEffectActivation === "function") {
            ui.chooseEffectActivation({
                player,
                sourceCard: card,
                effect,
                title: `${card.name} Trigger`,
                prompt: effect.text || "Activate this Trigger?",
                activateText: "Activate Trigger",
                skipText: "Add to Hand",
                onComplete: (shouldActivate) => {
                    if (shouldActivate) {
                        activateTrigger();
                    } else {
                        skipTrigger();
                    }
                }
            });

            messages.push(`${player.name} is choosing whether to activate ${card.name}'s Trigger.`);
            return;
        }

        activateTrigger();
    });

    return messages;
}

function resolveSingleTriggerEffect(player, card, effect, ui) {
    if (effect.actionId === "playThisCardFromTrigger") {
        return playCardFromTrigger(player, card, ui);
    }

    if (effect.actionId === "activateMainEffect") {
        const mainMessages = resolveMainEffects(player, card, ui, {
            skipActivationPrompt: true
        });

        moveCardToTrash(player, card, ui);

        if (ui?.renderTrash) {
            ui.renderTrash();
        }

        return mainMessages.length > 0
            ? `${card.name}'s Trigger activated its Main effect. ${mainMessages.join(" ")}`
            : `${card.name}'s Trigger activated, then it was placed in trash.`;
    }

    if (effect.id === "DD01-011-trigger") {
        const message = setOneNamedOwnCardActive(player, card, "Okarun", ui);
        moveCardToTrash(player, card, ui);

        if (ui?.renderTrash) {
            ui.renderTrash();
        }

        return message;
    }

    const message = resolveEffectAction(player, card, effect, ui, {
        skipActivationPrompt: true
    });

    moveCardToTrash(player, card, ui);

    if (ui?.renderTrash) {
        ui.renderTrash();
    }

    return message
        ? `${card.name}'s Trigger resolved. ${message}`
        : `${card.name}'s Trigger resolved.`;
}

function loseByLifeDamage(player, reasonText = "") {
    const winnerPlayer = getOpponentOfPlayer(player);

    if (!winnerPlayer) {
        return {
            success: false,
            winnerPlayer: null
        };
    }

    if (typeof endGame === "function") {
        endGame(
            winnerPlayer,
            "Life Damage",
            reasonText || `${player.name} took damage with no life cards remaining.`
        );
    }

    return {
        success: true,
        winnerPlayer
    };
}

function playCardFromTrigger(player, card, ui) {
    if (card.cardType === "character") {
        const slotIndex = getFirstOpenCharacterSlotIndex(player);

        if (slotIndex === -1) {
            moveCardToTrash(player, card, ui);
            return `${card.name}'s Trigger could not play it because ${player.name}'s character area is full. It was placed in trash.`;
        }

        card.state = "active";
        card.playedOnTurn = player.turns;
        player.characters[slotIndex] = card;

        const effectMessages = resolveOnPlayEffects(player, card, ui);

        ui.renderCharacters();

        return effectMessages.length > 0
            ? `${card.name}'s Trigger played it in character slot ${slotIndex + 1}. ${effectMessages.join(" ")}`
            : `${card.name}'s Trigger played it in character slot ${slotIndex + 1}.`;
    }

    if (card.cardType === "stage") {
        const oldStage = player.stage;

        card.state = "active";
        player.stage = card;

        if (oldStage) {
            moveCardToTrash(player, oldStage, ui);
        }

        const effectMessages = resolveOnPlayEffects(player, card, ui);

        ui.renderStages();

        return effectMessages.length > 0
            ? `${card.name}'s Trigger played it to the stage area. ${effectMessages.join(" ")}`
            : `${card.name}'s Trigger played it to the stage area.`;
    }

    player.hand.push(card);
    return `${card.name}'s Trigger could not play that card type, so it was added to hand.`;
}

function banishLifeDamage(player, amount, ui) {
    let lifeBanished = 0;

    for (let i = 0; i < amount; i++) {
        const topLifeCard = player.life.shift();

        if (!topLifeCard) {
            break;
        }

        moveCardToTrash(player, topLifeCard, ui);
        lifeBanished++;
    }

    ui.renderLifeCards();
    ui.renderTrash();

    return {
        success: lifeBanished > 0,
        lifeBanished,
        remainingLife: player.life.length,
        message: lifeBanished > 0
            ? `${player.name} banished ${lifeBanished} life card${lifeBanished === 1 ? "" : "s"} to trash.`
            : `${player.name} has no life cards left.`
    };
}

// =========================
// Deck Out Actions
// =========================

function getOpponentOfPlayer(player) {
    if (player === gameState.player1) {
        return gameState.player2;
    }

    if (player === gameState.player2) {
        return gameState.player1;
    }

    return null;
}

function loseByDeckOut(player, reasonText = "") {
    const winnerPlayer = getOpponentOfPlayer(player);

    if (!winnerPlayer) {
        return {
            success: false,
            deckOut: false,
            winnerPlayer: null
        };
    }

    if (typeof endGame === "function") {
        endGame(
            winnerPlayer,
            "Deck Out",
            reasonText || `${player.name} has no cards left in deck.`
        );
    }

    return {
        success: true,
        deckOut: true,
        winnerPlayer
    };
}

function checkDeckOut(player, reasonText = "") {
    if (!player) {
        return {
            deckOut: false
        };
    }

    if (player.deck.length > 0) {
        return {
            deckOut: false
        };
    }

    return loseByDeckOut(
        player,
        reasonText || `${player.name} has no cards left in deck.`
    );
}

// =========================
// Refresh Actions
// =========================

function refreshPlayerCards(player, ui) {
    const refreshedDon = player.restedDon;
    let refreshedLeader = 0;
    let refreshedCharacters = 0;
    let refreshedStage = 0;
    let skippedLeaderRefresh = 0;

    player.don += player.restedDon;
    player.restedDon = 0;

    if (player.leader && player.leader.state === "rested") {
        if (player.skipLeaderRefresh) {
            skippedLeaderRefresh = 1;
        } else {
            player.leader.state = "active";
            refreshedLeader = 1;
        }
    }

    player.skipLeaderRefresh = false;
    player.leaderAttacksThisTurn = 0;

    player.characters.forEach(character => {
        if (character && character.state === "rested") {
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
        refreshedLeader,
        refreshedCharacters,
        refreshedStage,
        skippedLeaderRefresh
    };
}

function resolveEndOfTurnEffects(player, ui) {
    if (!player) {
        return [];
    }

    const results = [];
    const turboGrannyResult = CardEffects.resolveTurboGrannyFormEndOfTurn(player);

    if (turboGrannyResult?.message) {
        results.push(turboGrannyResult);
    }

    player.characters.forEach(character => {
        if (!character) {
            return;
        }

        character.effects
            ?.filter(effect => effect.type === "endOfYourTurn")
            .forEach(effect => {
                if (effect.actionId !== "setThisCardActive") {
                    return;
                }

                character.state = "active";
                results.push({
                    activated: true,
                    message: `${character.name}'s End of Your Turn effect set it as active.`
                });
            });
    });

    returnAttachedDonToCostArea(player, ui);
    clearEndOfTurnTemporaryEffects(player);

    const opponent = getOpponentOfPlayer(player);

    if (opponent) {
        clearEndOfTurnTemporaryEffects(opponent, {
            preserveDurationPower: true
        });
    }

    if (ui?.renderLeaders) {
        ui.renderLeaders();
    }

    if (ui?.renderCharacters) {
        ui.renderCharacters();
    }

    return results;
}

function returnAttachedDonToCostArea(player, ui) {
    if (!player) {
        return 0;
    }

    const cards = [
        player.leader,
        ...player.characters.filter(Boolean)
    ].filter(Boolean);
    let returnedDon = 0;

    cards.forEach(card => {
        returnedDon += Number(card.attachedDon || 0);
        card.attachedDon = 0;
    });

    player.restedDon += returnedDon;

    if (returnedDon > 0) {
        ui.updateDonDisplay();
        ui.renderLeaders();
        ui.renderCharacters();
    }

    return returnedDon;
}

function clearEndOfTurnTemporaryEffects(player, options = {}) {
    const cards = [
        player.leader,
        ...player.characters.filter(Boolean),
        player.stage
    ].filter(Boolean);

    cards.forEach(card => {
        card.temporaryKeywords = [];
        card.battleKeywords = [];
        card.battlePowerBonus = 0;
        card.temporaryPowerBonus = 0;
        card.costModifiers = [];
        card.protectedFromOpponentEffects = false;

        if (!options.preserveDurationPower && Array.isArray(card.durationPowerBonuses)) {
            card.durationPowerBonuses = card.durationPowerBonuses.filter(entry => {
                return Number(entry.expiresAtEndOfTurns ?? 0) > Number(player.turns || 0);
            });
        }
    });
}

// =========================
// Trash Actions
// =========================

function moveCardToTrash(player, card, ui) {
    if (!card) return;

    card.uiAnimation = card.uiAnimation || "trashed";
    player.trash.push(card);

    if (ui.renderTrash) {
        ui.renderTrash();
    }
}
