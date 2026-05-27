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

function getCardAllEffects(card) {
    if (areCardEffectsNegated(card)) {
        return [];
    }

    return [
        ...(Array.isArray(card?.effects) ? card.effects : []),
        ...(Array.isArray(card?.temporaryCopiedEffects) ? card.temporaryCopiedEffects : [])
    ];
}

function getCardKeywordEffects(card) {
    if (!card || !window.CardEffects?.keywords) {
        return [];
    }

    const seenKeywords = new Set();

    return Object.entries(window.CardEffects.keywords)
        .filter(([keywordKey]) => window.CardEffects.hasKeyword(card, keywordKey))
        .map(([keywordKey, definition]) => {
            const normalizedKeyword = window.CardEffects.normalizeKeyword(keywordKey);

            if (seenKeywords.has(normalizedKeyword)) {
                return null;
            }

            seenKeywords.add(normalizedKeyword);

            return {
                id: `keyword-${normalizedKeyword}`,
                type: "keyword",
                keyword: normalizedKeyword,
                text: definition?.text || definition?.name || keywordKey,
                keywordName: definition?.name || keywordKey
            };
        })
        .filter(Boolean);
}

// =========================
// Card Lookup Helpers
// =========================

function findHandCardIndexByInstanceId(player, cardInstanceId) {
    return player.hand.findIndex(card => card.instanceId === cardInstanceId);
}

function getCardPlayCost(card, player = null) {
    return Math.max(0, Number(card.cost ?? card.playCost ?? 0) + getRimuruPlayCostModifier(card, player));
}

function getCardEffectiveCost(card) {
    if (!card) {
        return 0;
    }

    const printedCost = Number(card.cost ?? card.playCost ?? 0);
    const modifier = card.costModifiers
        ?.reduce((total, entry) => total + Number(entry.amount ?? 0), 0) ?? 0;

    const owner = typeof getPlayerForBoardCard === "function"
        ? getPlayerForBoardCard(card)
        : null;

    return Math.max(0, printedCost + modifier + getRimuruBoardCostModifier(card, owner));
}

function canPlayerAffordCard(player, card) {
    const cardCost = getCardPlayCost(card, player);

    return player.don >= cardCost;
}

function getRimuruPlayCostModifier(card, player) {
    if (!card || !player || !isRimuruTempestLeader(player)) {
        return 0;
    }

    if (card.cardNumber === "RIM1-011" && playerHasLessDonThanOpponent(player)) {
        return -1;
    }

    return 0;
}

function getRimuruBoardCostModifier(card, player) {
    if (!card || !player || !isRimuruTempestLeader(player)) {
        return 0;
    }

    if (card.cardNumber === "RIM1-007") {
        return 2;
    }

    if (card.cardNumber === "RIM1-002") {
        return getTwelveGuardianLordNamesOnField(player).size;
    }

    return 0;
}

function isRimuruTempestLeader(player) {
    return Boolean(player?.leader && CardEffects.hasCardName(player.leader, "Rimuru Tempest"));
}

function isTwelveGuardianLordType(card) {
    return hasTypeText(card, "Twelve Guardian Lords") ||
        getCardAllEffects(card)?.some(effect => {
            return effect.type === "continuous" &&
                String(effect.text || "").toLowerCase().includes("also considered a {twelve guardian lords} type");
        });
}

function getTwelveGuardianLordNamesOnField(player) {
    const names = new Set();

    player?.characters?.forEach(card => {
        if (card && isTwelveGuardianLordType(card)) {
            names.add(CardEffects.normalizeCardName(card.name));
        }
    });

    return names;
}

function playerHasLessDonThanOpponent(player) {
    const opponent = typeof getOpponentPlayer === "function"
        ? getOpponentPlayer(player)
        : null;

    if (!opponent) {
        return false;
    }

    return getTotalDonInPlay(player) < getTotalDonInPlay(opponent);
}

function getFirstOpenCharacterSlotIndex(player) {
    for (let i = 0; i < 5; i++) {
        if (!player.characters[i]) {
            return i;
        }
    }

    return -1;
}

function isParfumStage(card) {
    return card?.cardType === "stage" && (
        card.cardNumber === "POG1-002" ||
        CardEffects.hasCardName(card, "Parfum")
    );
}

function doesStagePreventLeaderAttacks(player) {
    return isParfumStage(player?.stage) && !areCardEffectsNegated(player?.stage);
}

function isTemporaryStatusEntryActive(entry) {
    if (!entry) {
        return false;
    }

    const expiresAtPlayer = entry.expiresAtPlayerKey
        ? gameState?.[entry.expiresAtPlayerKey]
        : null;

    if (!expiresAtPlayer) {
        return true;
    }

    return Number(expiresAtPlayer.turns || 0) <= Number(entry.expiresAtEndOfTurns ?? 0);
}

function areCardEffectsNegated(card) {
    return Array.isArray(card?.effectNegationEntries) &&
        card.effectNegationEntries.some(isTemporaryStatusEntryActive);
}

function addTemporaryEffectNegation(card, expiresAtPlayerKey, expiresAtEndOfTurns) {
    if (!card) {
        return;
    }

    if (!Array.isArray(card.effectNegationEntries)) {
        card.effectNegationEntries = [];
    }

    card.effectNegationEntries.push({
        expiresAtPlayerKey,
        expiresAtEndOfTurns
    });
}

function lockCardForNextRefresh(card) {
    if (!card) {
        return;
    }

    card.skipNextRefresh = true;
}

function chooseTrashCard(player, sourceCard, ui, options = {}) {
    const validCards = (player?.trash || [])
        .map((card, trashIndex) => ({
            card,
            value: trashIndex
        }))
        .filter(entry => entry.card && (!options.filter || options.filter(entry.card)));

    if (validCards.length === 0) {
        return options.emptyMessage || `${sourceCard.name} found no valid cards in trash.`;
    }

    const finishSelection = (selectedValue) => {
        if (!selectedValue) {
            if (typeof options.onSkip === "function") {
                options.onSkip();
            }

            addGameLog(options.skipMessage || `${player.name} did not choose a trash card for ${sourceCard.name}.`);
            return;
        }

        const trashIndex = Number(selectedValue);

        if (!Number.isInteger(trashIndex) || trashIndex < 0 || trashIndex >= player.trash.length) {
            addGameLog(`${sourceCard.name} could not find that trash card anymore.`);
            return;
        }

        const card = player.trash[trashIndex];

        options.onSelect?.({
            card,
            trashIndex
        });
    };

    if (ui?.chooseEffectOption) {
        ui.chooseEffectOption({
            player,
            sourceCard,
            title: sourceCard.name,
            prompt: options.prompt || "Choose a card from your trash.",
            options: [
                ...validCards.map(({ card, value }) => ({
                    label: `${card.name} (${card.cardNumber})`,
                    value
                })),
                {
                    label: "Skip",
                    value: null,
                    secondary: true,
                    disabled: !options.optional
                }
            ],
            onComplete: finishSelection
        });

        return `${player.name} is choosing a card from trash for ${sourceCard.name}.`;
    }

    finishSelection(options.optional ? null : validCards[0].value);
    return `${sourceCard.name}'s effect resolved.`;
}

function addCardFromTrashToHand(player, sourceCard, ui, options = {}) {
    return chooseTrashCard(player, sourceCard, ui, {
        ...options,
        onSelect: ({ trashIndex, card }) => {
            const addedCard = player.trash.splice(trashIndex, 1)[0];
            player.hand.push(addedCard);

            if (ui?.renderTrash) {
                ui.renderTrash();
            }

            if (ui?.renderHands) {
                ui.renderHands();
            }

            addGameLog(`${player.name} added ${card.name} from trash to hand with ${sourceCard.name}.`);
        }
    });
}

function chooseLeaderOrCharacterForPower(player, sourceCard, ui, amount, options = {}) {
    return chooseOwnBoardCard(player, sourceCard, {
        prompt: options.prompt || `Choose up to 1 of your leader or characters to give +${amount} power.`,
        optional: options.optional !== false,
        includeLeader: true,
        filter: card => card.cardType === "leader" || card.cardType === "character",
        onSelect: ({ card }) => {
            if (options.duration === "battle") {
                addBattlePowerBonus(card, amount);
            } else {
                addTemporaryPowerBonus(card, amount);
            }

            ui?.renderLeaders?.();
            ui?.renderCharacters?.();
            addGameLog(`${sourceCard.name} gave ${card.name} +${amount} power ${options.duration === "battle" ? "during this battle" : "this turn"}.`);
            options.afterSelect?.(card);
        },
        skipMessage: options.skipMessage || `${player.name} did not choose a card for ${sourceCard.name}.`,
        emptyMessage: options.emptyMessage || `${sourceCard.name} found no leader or character.`
    });
}

function resolveBingoMain(player, sourceCard, ui) {
    if (!restDonForCost(player, 2, ui)) {
        return `${player.name} could not rest 2 active DON!! for ${sourceCard.name}.`;
    }

    const completeDeclaration = (declaredCost) => {
        const topCard = player.deck[0];

        if (!topCard) {
            addGameLog(`${sourceCard.name} found no card to reveal because ${player.name}'s deck is empty.`);
            return;
        }

        const revealedCost = Number(topCard.cost ?? topCard.playCost ?? 0);
        const declared = Number(declaredCost ?? 0);

        addGameLog(`${player.name} declared cost ${declared} with ${sourceCard.name} and revealed ${topCard.name} (cost ${revealedCost}).`);

        if (revealedCost !== declared) {
            return;
        }

        const drawResult = drawCards(player, 2, ui);

        addGameLog(
            drawResult?.deckOut
                ? `${sourceCard.name} matched the declared cost, but ${player.name} lost by deck out while drawing 2 cards.`
                : `${sourceCard.name} matched the declared cost, so ${player.name} drew 2 cards.`
        );
    };

    const options = Array.from({ length: 11 }, (_, value) => ({
        label: String(value),
        value
    }));

    if (ui?.chooseEffectOption) {
        ui.chooseEffectOption({
            player,
            sourceCard,
            title: sourceCard.name,
            prompt: "Declare a cost from 0 to 10.",
            options,
            onComplete: completeDeclaration
        });

        return `${player.name} rested 2 DON!! and is declaring a cost for ${sourceCard.name}.`;
    }

    completeDeclaration(0);
    return `${sourceCard.name}'s effect resolved.`;
}

function chooseHandCard(player, sourceCard, options = {}) {
    return chooseBoardCard(
        player,
        sourceCard,
        getHandCardChoices(player, options.filter),
        {
            ...options,
            filter: null
        }
    );
}

function chooseHandCardsToTopOrBottomOfDeck(player, sourceCard, ui, count, options = {}) {
    const topCards = [];
    const bottomCards = [];
    const selectedCards = [];

    const finishPlacement = () => {
        player.deck = [...topCards, ...player.deck, ...bottomCards];

        if (ui?.renderHands) {
            ui.renderHands();
        }

        if (ui?.renderDecks) {
            ui.renderDecks();
        }

        const message = `${player.name} placed ${selectedCards.length} card${selectedCards.length === 1 ? "" : "s"} from hand on the top or bottom of the deck with ${sourceCard.name}.`;
        addGameLog(message);
        options.onComplete?.();
    };

    const choosePlacementZone = (card) => {
        if (!ui?.chooseEffectOption) {
            bottomCards.push(card);
            return;
        }

        ui.chooseEffectOption({
            player,
            sourceCard,
            title: sourceCard.name,
            prompt: `Where should ${card.name} go?`,
            options: [
                { label: "Top", value: "top" },
                { label: "Bottom", value: "bottom", secondary: true }
            ],
            onComplete: (zone) => {
                if (zone === "top") {
                    topCards.push(card);
                } else {
                    bottomCards.push(card);
                }

                chooseNextCard();
            }
        });
    };

    const chooseNextCard = () => {
        if (selectedCards.length >= count) {
            finishPlacement();
            return;
        }

        const remainingChoices = getHandCardChoices(player, card => !selectedCards.includes(card));

        if (remainingChoices.length === 0) {
            finishPlacement();
            return;
        }

        const message = chooseBoardCard(player, sourceCard, remainingChoices, {
            prompt: `Choose card ${selectedCards.length + 1} of ${count} to place on the top or bottom of your deck.`,
            optional: false,
            onSelect: ({ handIndex, card }) => {
                const selectedCard = player.hand.splice(handIndex, 1)[0];

                if (!selectedCard) {
                    addGameLog(`${sourceCard.name} could not move that hand card.`);
                    chooseNextCard();
                    return;
                }

                selectedCards.push(card);

                if (!ui?.chooseEffectOption) {
                    bottomCards.push(selectedCard);
                    chooseNextCard();
                    return;
                }

                choosePlacementZone(selectedCard);
            },
            emptyMessage: `${sourceCard.name} found no cards in hand.`
        });

        if (message) {
            addGameLog(message);
        }
    };

    chooseNextCard();
    return `${player.name} is choosing cards from hand for ${sourceCard.name}.`;
}

function chooseCardsFromTrashToBottomOfDeck(player, sourceCard, ui, count, options = {}) {
    const movedCards = [];

    const finishMove = () => {
        player.deck.push(...movedCards);

        if (ui?.renderTrash) {
            ui.renderTrash();
        }

        if (ui?.renderDecks) {
            ui.renderDecks();
        }

        options.onComplete?.(movedCards);
    };

    const chooseNext = () => {
        if (movedCards.length >= count) {
            finishMove();
            return;
        }

        const message = chooseTrashCard(player, sourceCard, ui, {
            prompt: `Choose card ${movedCards.length + 1} of ${count} from your trash to place on the bottom of your deck.`,
            optional: false,
            filter: card => !movedCards.includes(card) && (!options.filter || options.filter(card)),
            onSelect: ({ trashIndex }) => {
                const movedCard = player.trash.splice(trashIndex, 1)[0];

                if (!movedCard) {
                    addGameLog(`${sourceCard.name} could not move that trash card.`);
                    chooseNext();
                    return;
                }

                movedCards.push(movedCard);
                chooseNext();
            },
            emptyMessage: options.emptyMessage || `${sourceCard.name} found no valid cards in trash.`
        });

        if (message) {
            addGameLog(message);
        }
    };

    chooseNext();
    return `${player.name} is choosing cards from trash for ${sourceCard.name}.`;
}

function controlsReplacementNegation(player) {
    return Boolean(player?.characters?.some(card => {
        return card?.cardNumber === "POG1-012" && !areCardEffectsNegated(card);
    }));
}

function areOpponentReplacementEffectsNegated(targetPlayer, actingPlayer) {
    return Boolean(targetPlayer && actingPlayer && targetPlayer !== actingPlayer && controlsReplacementNegation(actingPlayer));
}

function playCardFromDeckWithoutCost(player, sourceCard, card, ui) {
    if (!player || !card) {
        return `${sourceCard.name} could not play that card from the deck.`;
    }

    if (card.cardType === "character") {
        const slotIndex = getFirstOpenCharacterSlotIndex(player);

        if (slotIndex === -1) {
            return `${sourceCard.name} found ${card.name}, but ${player.name}'s character area is full.`;
        }

        card.state = "active";
        card.playedOnTurn = player.turns;
        card.uiAnimation = "played";
        player.characters[slotIndex] = card;

        const effectMessages = resolveOnPlayEffects(player, card, ui);

        ui?.renderCharacters?.();
        return effectMessages.length > 0
            ? `${sourceCard.name} played ${card.name} from the deck. ${effectMessages.join(" ")}`
            : `${sourceCard.name} played ${card.name} from the deck.`;
    }

    if (card.cardType === "stage") {
        const oldStage = player.stage;

        card.state = "active";
        card.uiAnimation = "played";
        player.stage = card;

        if (oldStage) {
            const returnMessage = trashStageFromField(player, oldStage, ui);

            if (returnMessage) {
                addGameLog(returnMessage);
            }
        }

        const effectMessages = resolveOnPlayEffects(player, card, ui);

        ui?.renderStages?.();
        return effectMessages.length > 0
            ? `${sourceCard.name} played ${card.name} from the deck. ${effectMessages.join(" ")}`
            : `${sourceCard.name} played ${card.name} from the deck.`;
    }

    if (card.cardType === "event") {
        const effectMessages = resolveMainEffects(player, card, ui, {
            skipActivationPrompt: true
        });

        moveCardToTrash(player, card, ui);

        return effectMessages.length > 0
            ? `${sourceCard.name} played ${card.name} from the deck. ${effectMessages.join(" ")}`
            : `${sourceCard.name} played ${card.name} from the deck.`;
    }

    return `${sourceCard.name} found ${card.name}, but that card type cannot be played from the deck.`;
}

function resolveJeremicOnPlay(player, sourceCard, ui) {
    const seenNames = new Set();
    const deckNameOptions = player.deck
        .filter(Boolean)
        .map(card => ({
            label: card.name,
            value: CardEffects.normalizeCardName(card.name)
        }))
        .filter(option => {
            if (seenNames.has(option.value)) {
                return false;
            }

            seenNames.add(option.value);
            return true;
        });

    if (deckNameOptions.length === 0) {
        shuffleDeck(player.deck);
        ui?.renderDecks?.();
        return `${sourceCard.name} found no cards in ${player.name}'s deck.`;
    }

    const finishDeclaration = (declaredName) => {
        const deckIndex = player.deck.findIndex(card => {
            return CardEffects.normalizeCardName(card.name) === declaredName;
        });

        if (deckIndex === -1) {
            shuffleDeck(player.deck);
            ui?.renderDecks?.();
            addGameLog(`${sourceCard.name} declared a card name, but no matching card was found before the shuffle.`);
            return;
        }

        const playedCard = player.deck.splice(deckIndex, 1)[0];
        const message = playCardFromDeckWithoutCost(player, sourceCard, playedCard, ui);

        shuffleDeck(player.deck);
        ui?.renderDecks?.();
        addGameLog(`${message} ${player.name} then shuffled the deck.`);
    };

    if (ui?.chooseEffectOption) {
        ui.chooseEffectOption({
            player,
            sourceCard,
            title: sourceCard.name,
            prompt: "Declare a card name to play from your deck.",
            options: deckNameOptions,
            onComplete: finishDeclaration
        });

        return `${player.name} is declaring a card name for ${sourceCard.name}.`;
    }

    finishDeclaration(deckNameOptions[0].value);
    return `${sourceCard.name}'s effect resolved.`;
}

function resolveSigmaRevealEffect(player, sourceCard, ui) {
    const revealedCard = player?.deck?.shift();

    if (!revealedCard) {
        return `${sourceCard.name} found no card to reveal because ${player.name}'s deck is empty.`;
    }

    const isHit = CardEffects.hasCardName(revealedCard, "Manifestirana žoga") ||
        CardEffects.hasCardName(revealedCard, "Klobuk");
    const finishTrash = () => {
        moveCardToTrash(player, revealedCard, ui);
        ui?.renderDecks?.();
        ui?.renderTrash?.();
    };

    if (!isHit) {
        finishTrash();
        return `${sourceCard.name} revealed ${revealedCard.name}, which did not match, then trashed it.`;
    }

    const message = chooseLeaderOrCharacterForPower(player, sourceCard, ui, 2000, {
        prompt: `Choose up to 1 of your leader or characters to give +2000 power this turn after revealing ${revealedCard.name}.`,
        duration: "turn",
        optional: true
    });

    finishTrash();
    return `${sourceCard.name} revealed ${revealedCard.name}. ${message} Then it was trashed.`;
}

function clearParfumControlState(character) {
    if (!character) {
        return;
    }

    character.parfumControl = null;
    character.ignorePlayedThisTurnCheck = false;
}

function getParfumControlledCharacter(stageOwner, stage) {
    const control = stage?.parfumControlledCharacter;

    if (!stageOwner || !control?.characterInstanceId) {
        return null;
    }

    const slotIndex = stageOwner.characters.findIndex(card => {
        return card?.instanceId === control.characterInstanceId;
    });

    if (slotIndex === -1) {
        return null;
    }

    return {
        slotIndex,
        card: stageOwner.characters[slotIndex],
        control
    };
}

function setReturnedParfumCharacterAttackLock(owner, character) {
    const ownerKey = getPlayerKey(owner);

    if (!ownerKey || !character) {
        return;
    }

    character.cannotAttackUntil = {
        expiresAtPlayerKey: ownerKey,
        expiresAtEndOfTurns: Number(owner.turns || 0)
    };
}

function returnParfumControlledCharacter(stageOwner, stage, ui) {
    if (!isParfumStage(stage || stageOwner?.stage)) {
        return "";
    }

    const controlledEntry = getParfumControlledCharacter(stageOwner, stage);

    if (!controlledEntry) {
        if (stage) {
            stage.parfumControlledCharacter = null;
        }

        return "";
    }

    const { slotIndex, card, control } = controlledEntry;
    const originalOwner = gameState?.[control.originalOwnerPlayerKey];

    if (!originalOwner) {
        clearParfumControlState(card);

        if (stage) {
            stage.parfumControlledCharacter = null;
        }

        return "";
    }

    const preferredSlotIndex = Number(control.originalOwnerSlotIndex);
    const returnSlotIndex = (
        preferredSlotIndex >= 0 &&
        preferredSlotIndex < 5 &&
        !originalOwner.characters[preferredSlotIndex]
    )
        ? preferredSlotIndex
        : getFirstOpenCharacterSlotIndex(originalOwner);

    if (returnSlotIndex === -1) {
        return `${card.name} could not return because ${originalOwner.name}'s field is full.`;
    }

    stageOwner.characters[slotIndex] = null;
    originalOwner.characters[returnSlotIndex] = card;

    clearParfumControlState(card);
    setReturnedParfumCharacterAttackLock(originalOwner, card);
    stage.parfumControlledCharacter = null;

    if (ui?.renderCharacters) {
        ui.renderCharacters();
    }

    return `${card.name} returned to ${originalOwner.name}'s field when ${stage.name} left play.`;
}

function trashStageFromField(player, stage, ui, options = {}) {
    const stageCard = stage || player?.stage;

    if (!player || !stageCard) {
        return "";
    }

    let returnMessage = "";

    if (isParfumStage(stageCard)) {
        if (options.skipParfumReturn) {
            stageCard.parfumControlledCharacter = null;
        } else {
            returnMessage = returnParfumControlledCharacter(player, stageCard, ui);
        }
    }

    if (player.stage?.instanceId === stageCard.instanceId) {
        player.stage = null;
    }

    moveCardToTrash(player, stageCard, ui);

    if (ui?.renderStages) {
        ui.renderStages();
    }

    return returnMessage;
}

function trashLinkedParfumStageForCharacter(player, character, ui) {
    const control = character?.parfumControl;
    const stageOwner = control?.stageOwnerPlayerKey
        ? gameState?.[control.stageOwnerPlayerKey]
        : null;
    const stage = stageOwner?.stage;

    clearParfumControlState(character);

    if (!stageOwner || !stage || stage.instanceId !== control?.stageInstanceId) {
        return "";
    }

    stage.parfumControlledCharacter = null;
    trashStageFromField(stageOwner, stage, ui, { skipParfumReturn: true });

    return `${stage.name} was trashed because ${character.name} left the field.`;
}

function placeOpponentCharacterWithParfum(player, sourceCard, ui) {
    if (!player || !sourceCard) {
        return "";
    }

    if (getFirstOpenCharacterSlotIndex(player) === -1) {
        return `${sourceCard.name} could not place a character because ${player.name}'s character area is full.`;
    }

    return chooseOpponentCharacter(player, sourceCard, {
        prompt: "Choose up to 1 opposing character to place on your field.",
        optional: true,
        onSelect: ({ playerKey, slotIndex, card }) => {
            const opponent = gameState?.[playerKey];
            const controllerKey = getPlayerKey(player);
            const ownerKey = getPlayerKey(opponent);
            const openSlotIndex = getFirstOpenCharacterSlotIndex(player);

            if (!opponent || !ownerKey || !controllerKey || openSlotIndex === -1) {
                addGameLog(`${sourceCard.name} could not place that character.`);
                return;
            }

            opponent.characters[slotIndex] = null;
            player.characters[openSlotIndex] = card;

            // Parfum always places the stolen character onto your field in a usable state.
            card.state = "active";
            card.uiAnimation = "played";
            card.parfumControl = {
                originalOwnerPlayerKey: ownerKey,
                originalOwnerSlotIndex: slotIndex,
                stageOwnerPlayerKey: controllerKey,
                stageInstanceId: sourceCard.instanceId
            };
            card.ignorePlayedThisTurnCheck = true;
            card.cannotAttackUntil = null;

            sourceCard.parfumControlledCharacter = {
                characterInstanceId: card.instanceId,
                originalOwnerPlayerKey: ownerKey,
                originalOwnerSlotIndex: slotIndex
            };

            if (ui?.renderCharacters) {
                ui.renderCharacters();
            }

            if (ui?.renderStages) {
                ui.renderStages();
            }

            addGameLog(`${player.name} placed ${card.name} on their field with ${sourceCard.name}.`);
        },
        skipMessage: `${player.name} did not place a character with ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no opposing characters to place.`
    });
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

function attachActiveDonToCard(player, targetCard, ui) {
    if (!player || !targetCard) {
        return {
            success: false,
            message: "No card was selected for DON!! attachment."
        };
    }

    if (targetCard.cardType !== "leader" && targetCard.cardType !== "character") {
        return {
            success: false,
            message: "DON!! can only be attached to leaders and characters."
        };
    }

    if (player.don < 1) {
        return {
            success: false,
            message: `${player.name} has no active DON!! to attach.`
        };
    }

    player.don -= 1;
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

    return {
        success: true,
        message: `${player.name} attached 1 DON!! to ${targetCard.name}.`
    };
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

            if (
                effect.actionId === "eggmanCounterPower" ||
                effect.actionId === "leaderOrCharacterCounterPower" ||
                effect.actionId === "santenKesshunCounterPower" ||
                effect.actionId === "leaderCounterPower"
            ) {
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
            const eventCounterEffects = getCardAllEffects(character)?.filter(effect => {
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

    const cost = getCardPlayCost(card, player);

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
        resolveGutsLeaderCharacterRemovedBonus(player, ui);
        const linkedStageMessage = trashLinkedParfumStageForCharacter(player, replacedCard, ui);

        if (linkedStageMessage) {
            addGameLog(linkedStageMessage);
        }
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
        const returnMessage = trashStageFromField(player, oldStage, ui);

        if (returnMessage) {
            addGameLog(returnMessage);
        }
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

    if (areCardEffectsNegated(card)) {
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
        whenAttacking: "When Attacking",
        onOpponentAttack: "On Opponent Attack",
        yourTurn: "Your Turn",
        opponentsTurn: "Opponent's Turn",
        continuous: "Continuous",
        donAttached: "DON Attached",
        main: "Main",
        activateMain: "Activate: Main",
        counter: "Counter",
        trigger: "Trigger",
        keyword: "Keyword"
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

    if (sourceCard.cardType !== "event" && areCardEffectsNegated(sourceCard)) {
        return `${sourceCard.name}'s effects are negated.`;
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
        const excludedSourceName = options.copiedFromCard?.name || sourceCard.name;

        return lookTopCardsForType(player, sourceCard, 5, "Black Swordsman Party", ui, {
            excludeNames: [excludedSourceName]
        });
    }

    if (effect.actionId === "lookTopFiveHuman") {
        return lookTopCardsForType(player, sourceCard, 5, "Human", ui);
    }

    if (effect.id === "POG1-004-main") {
        return lookTopCardsForType(player, sourceCard, 4, "Film", ui);
    }

    if (effect.id === "POG1-004-trigger") {
        const drawResult = drawCard(player, ui);

        return drawResult?.deckOut
            ? `${sourceCard.name}'s Trigger tried to draw 1 card, but ${player.name} lost by deck out.`
            : `${sourceCard.name}'s Trigger drew 1 card.`;
    }

    if (effect.id === "POG1-008-main") {
        const attachedResult = attachActiveDonToCard(player, player.leader, ui);

        if (!attachedResult.success) {
            return `${sourceCard.name} could not attach 1 active DON!! to ${player.leader.name}.`;
        }

        const powerMessage = chooseLeaderOrCharacterForPower(player, sourceCard, ui, 1000, {
            prompt: "Choose your leader or up to 1 of your characters to give +1000 power this turn.",
            duration: "turn",
            optional: true
        });

        return `${attachedResult.message} ${powerMessage}`;
    }

    if (effect.id === "POG1-008-counter") {
        return chooseLeaderOrCharacterForPower(player, sourceCard, ui, 2000, {
            prompt: "Choose your leader or up to 1 of your characters to give +2000 power during this battle.",
            duration: "battle",
            optional: true
        });
    }

    if (effect.id === "POG1-009-main") {
        return resolveBingoMain(player, sourceCard, ui);
    }

    if (effect.id === "POG1-009-counter") {
        return chooseLeaderOrCharacterForPower(player, sourceCard, ui, 2000, {
            prompt: "Choose your leader or up to 1 of your characters to give +2000 power during this battle.",
            duration: "battle",
            optional: true
        });
    }

    if (effect.id === "POG1-010-main") {
        if (!restDonForCost(player, 3, ui)) {
            return `${player.name} could not rest 3 active DON!! for ${sourceCard.name}.`;
        }

        return chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing rested character that will not become active during its next Refresh Phase.",
            optional: true,
            filter: card => card.cardType === "character" && (card.state || "active") === "rested",
            onSelect: ({ card }) => {
                lockCardForNextRefresh(card);
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} made ${card.name} stay rested during its next Refresh Phase.`);
            },
            skipMessage: `${player.name} did not choose a character for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no rested opposing characters.`
        });
    }

    if (effect.id === "POG1-010-counter") {
        return chooseLeaderOrCharacterForPower(player, sourceCard, ui, 2000, {
            prompt: "Choose your leader or up to 1 of your characters to give +2000 power during this battle.",
            duration: "battle",
            optional: true
        });
    }

    if (effect.id === "POG1-011-main") {
        if (!restDonForCost(player, 3, ui)) {
            return `${player.name} could not rest 3 active DON!! for ${sourceCard.name}.`;
        }

        return chooseBoardCard(player, sourceCard, getOpponentBoardChoices(player, {
            includeLeader: true,
            filter: card => card.cardType === "leader" || card.cardType === "character"
        }), {
            prompt: "Choose up to 1 opposing leader or character to negate its effects this turn.",
            optional: true,
            onSelect: ({ card }) => {
                addTemporaryEffectNegation(card, getPlayerKey(player), Number(player.turns || 0));
                ui?.renderLeaders?.();
                ui?.renderCharacters?.();
                ui?.renderStages?.();
                addGameLog(`${sourceCard.name} negated ${card.name}'s effects this turn.`);
            },
            skipMessage: `${player.name} did not negate a card with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing leader or character.`
        });
    }

    if (effect.id === "POG1-011-counter") {
        return chooseLeaderOrCharacterForPower(player, sourceCard, ui, 2000, {
            prompt: "Choose your leader or up to 1 of your characters to give +2000 power during this battle.",
            duration: "battle",
            optional: true
        });
    }

    if (effect.id === "POG1-014-counter") {
        const chooseTrashCardAfterPower = () => {
            const trashMessage = addCardFromTrashToHand(player, sourceCard, ui, {
                prompt: "Choose up to 1 Film card from your trash to add to your hand.",
                optional: true,
                filter: card => hasTypeText(card, "Film"),
                skipMessage: `${player.name} did not add a Film card from trash with ${sourceCard.name}.`,
                emptyMessage: `${sourceCard.name} found no Film cards in trash.`
            });

            if (trashMessage) {
                addGameLog(trashMessage);
            }
        };

        return chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose your leader or up to 1 of your characters to give +2000 power during this battle.",
            optional: true,
            includeLeader: true,
            filter: card => card.cardType === "leader" || card.cardType === "character",
            onSelect: ({ card }) => {
                addBattlePowerBonus(card, 2000);
                ui?.renderLeaders?.();
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} gave ${card.name} +2000 power during this battle.`);
                chooseTrashCardAfterPower();
            },
            onSkip: chooseTrashCardAfterPower,
            onEmpty: chooseTrashCardAfterPower,
            skipMessage: `${player.name} did not choose a card for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no leader or character.`
        });
    }

    if (effect.id === "POG1-014-trigger") {
        return addCardFromTrashToHand(player, sourceCard, ui, {
            prompt: "Choose 1 card from your trash to add to your hand.",
            optional: false,
            emptyMessage: `${sourceCard.name} found no cards in trash.`
        });
    }

    if (effect.id === "POG1-003-on-play") {
        return resolveJeremicOnPlay(player, sourceCard, ui);
    }

    if (
        effect.id === "POG1-005-when-attacking" ||
        effect.id === "POG1-005-on-opponent-attack"
    ) {
        return resolveSigmaRevealEffect(player, sourceCard, ui);
    }

    if (effect.id === "POG1-007-on-play") {
        const drawResult = drawCards(player, 3, ui);

        if (drawResult?.deckOut) {
            return `${sourceCard.name} caused ${player.name} to lose by deck out while drawing 3 cards.`;
        }

        if (player.hand.length < 2) {
            return `${sourceCard.name} drew 3 cards, but ${player.name} has fewer than 2 cards to place back.`;
        }

        return chooseHandCardsToTopOrBottomOfDeck(player, sourceCard, ui, 2);
    }

    if (effect.id === "POG1-006-activate-main") {
        return resolveDavidTaglavnovicCharacterMain(player, sourceCard, ui);
    }

    if (effect.id === "POG1-013-activate-main") {
        return resolveMagdalenaActivateMain(player, sourceCard, ui);
    }

    if (effect.id === "POG1-013-trigger") {
        return resolveMagdalenaTrigger(player, sourceCard, ui);
    }

    if (effect.id === "RIM1-004-on-play") {
        return resolveDiabloOnPlay(player, sourceCard, ui);
    }

    if (effect.id === "RIM1-008-on-play-search") {
        const returnedDon = returnDonToDeck(player, 1, ui);

        if (returnedDon < 1) {
            return `${sourceCard.name}'s On Play effect could not pay DON!! -1.`;
        }

        return lookTopCardsForType(player, sourceCard, 5, "Twelve Guardian Lords", ui, {
            excludeNames: ["Shion"],
            isSelectable: card => isTwelveGuardianLordType(card) && !CardEffects.hasCardName(card, "Shion")
        });
    }

    if (effect.id === "RIM1-003-on-play") {
        return resolveCarreraOnPlay(player, sourceCard, ui);
    }

    if (effect.id === "RIM1-009-on-play") {
        return resolveTestarosaOnPlay(player, sourceCard, ui);
    }

    if (effect.id === "RIM1-010-on-play") {
        return resolveUltimaOnPlay(player, sourceCard, ui);
    }

    if (effect.actionId === "eggmanCounterPower") {
        return chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 Eggman Empire leader or character to give +4000 power during this battle.",
            optional: true,
            includeLeader: true,
            filter: card => (card.cardType === "leader" || card.cardType === "character") && hasTypeText(card, "Eggman Empire"),
            onSelect: ({ card }) => {
                addBattlePowerBonus(card, Number(effect.powerModifier ?? 4000));
                ui.renderLeaders();
                ui.renderCharacters();
                addGameLog(`${sourceCard.name} gave ${card.name} +4000 power during this battle.`);
            },
            skipMessage: `${player.name} did not choose a card for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no Eggman Empire leader or character.`
        });
    }

    if (effect.actionId === "leaderOrCharacterCounterPower") {
        return chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose one of your leaders or characters to give +2000 power during this battle.",
            optional: false,
            includeLeader: true,
            filter: card => card.cardType === "leader" || card.cardType === "character",
            onSelect: ({ card }) => {
                addBattlePowerBonus(card, Number(effect.powerModifier ?? 2000));
                ui.renderLeaders();
                ui.renderCharacters();
                addGameLog(`${sourceCard.name} gave ${card.name} +2000 power during this battle.`);
            },
            emptyMessage: `${sourceCard.name} found no leader or character.`
        });
    }

    if (effect.actionId === "santenKesshunCounterPower") {
        const power = player.life.length <= 2 ? 4000 : 2000;

        return chooseOwnBoardCard(player, sourceCard, {
            prompt: `Choose up to 1 leader or character to give +${power} power during this battle.`,
            optional: true,
            includeLeader: true,
            filter: card => card.cardType === "leader" || card.cardType === "character",
            onSelect: ({ card }) => {
                addBattlePowerBonus(card, power);
                ui.renderLeaders();
                ui.renderCharacters();
                addGameLog(`${sourceCard.name} gave ${card.name} +${power} power during this battle.`);
            },
            skipMessage: `${player.name} did not choose a card for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no leader or character.`
        });
    }

    if (effect.actionId === "leaderCounterPower") {
        const power = Number(effect.powerModifier ?? 0);

        addBattlePowerBonus(player.leader, power);

        if (ui?.renderLeaders) {
            ui.renderLeaders();
        }

        return `${sourceCard.name} gave ${player.name}'s leader +${power} power during this battle.`;
    }

    if (effect.actionId === "leaderOrCharacterTriggerPower") {
        const power = Number(effect.powerModifier ?? 1000);

        return chooseOwnBoardCard(player, sourceCard, {
            prompt: `Choose up to 1 leader or character to give +${power} power this turn.`,
            optional: true,
            includeLeader: true,
            filter: card => card.cardType === "leader" || card.cardType === "character",
            onSelect: ({ card }) => {
                addTemporaryPowerBonus(card, power);
                ui.renderLeaders();
                ui.renderCharacters();
                addGameLog(`${sourceCard.name} gave ${card.name} +${power} power this turn.`);
            },
            skipMessage: `${player.name} did not choose a card for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no leader or character.`
        });
    }

    if (effect.id === "BL01-009-on-play-getsuga-search") {
        return searchGetsugaTenshoFromDeck(player, sourceCard, ui);
    }

    if (effect.id === "BL01-006-main") {
        return resolveGetsugaTenshoMain(player, sourceCard, ui);
    }

    if (effect.id === "BL01-017-main") {
        return resolveSotenKisshunMain(player, sourceCard, ui);
    }

    if (effect.id === "EGG1-001-when-attacking-power") {
        return giveSmallEggmanCharacterPower(player, sourceCard, ui);
    }

    if (effect.id === "EGG1-005-on-play-choice") {
        return playEggmanCharactersFromTrash(player, sourceCard, ui);
    }

    if (effect.id === "EGG1-009-on-play-bounce-ko") {
        return resolveDeathEggOnPlay(player, sourceCard, ui);
    }

    if (effect.id === "EGG1-012-main") {
        addTemporaryPowerBonus(player.leader, -5000);

        if (ui?.renderLeaders) {
            ui.renderLeaders();
        }

        const attackerData = {
            playerKey: getPlayerKey(player),
            cardType: "leader"
        };
        const results = CardEffects.resolveWhenAttackingEffects(gameState, player, attackerData, ui)
            .map(result => result.message)
            .filter(Boolean);

        return results.length > 0
            ? `${sourceCard.name} gave ${player.leader.name} -5000 power this turn and activated its When Attacking ability. ${results.join(" ")}`
            : `${sourceCard.name} gave ${player.leader.name} -5000 power this turn.`;
    }

    if (effect.id === "EGG1-014-on-play-freeze") {
        return lockOpponentCharactersFromAttacking(player, sourceCard, ui, 2, 7);
    }

    if (effect.id === "EGG1-002-activate-main-copy") {
        return copyOpponentBoardAbility(player, sourceCard, ui);
    }

    if (effect.id === "EGG1-006-activate-main-base-power") {
        return copyOpponentCharacterBasePower(player, sourceCard, ui);
    }

    if (effect.id === "EGG1-008-activate-main-trash-power") {
        return trashOwnCharacterForMetalSonicPower(player, sourceCard, ui);
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
        const chooseKOTarget = () => {
            const koMessage = chooseOpponentCharacterToKO(player, sourceCard, ui, 5);

            if (koMessage) {
                addGameLog(koMessage);
            }
        };

        const costMessage = chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character to give -2 cost this turn.",
            optional: true,
            onSelect: ({ card }) => {
                addCostModifier(card, -2);
                addGameLog(`${sourceCard.name} gave ${card.name} -2 cost this turn.`);
                chooseKOTarget();
            },
            onSkip: chooseKOTarget,
            onEmpty: chooseKOTarget,
            skipMessage: `${player.name} did not reduce a character's cost with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing characters for cost reduction.`
        });

        return `${costMessage} Then ${player.name} will choose a cost 5 or lower character to K.O.`;
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
        const chooseOpponentKOTarget = () => chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character to K.O.",
            optional: true,
            onSelect: ({ playerKey, slotIndex }) => {
                addGameLog(removeCharacterByOpponentEffect(player, gameState[playerKey], slotIndex, sourceCard, ui));
            },
            skipMessage: `${player.name} did not K.O. an opposing character with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing characters.`
        });

        return chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 of your characters to K.O.",
            optional: true,
            includeLeader: false,
            filter: card => card.cardType === "character",
            onSelect: ({ slotIndex }) => {
                const result = KOCharacter(player, slotIndex, ui);

                if (!result.success) {
                    addGameLog(`${sourceCard.name} could not K.O. one of your characters. ${result.message}`);
                    return;
                }

                addGameLog(`${sourceCard.name} K.O.'d one of your characters. ${result.message}`);
                addGameLog(chooseOpponentKOTarget());
            },
            skipMessage: `${player.name} did not K.O. one of their characters with ${sourceCard.name}, so the opposing K.O. did not resolve.`,
            emptyMessage: `${sourceCard.name} found no own characters to K.O., so its effect did not resolve.`
        });
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

function giveSmallEggmanCharacterPower(player, sourceCard, ui) {
    return chooseOwnBoardCard(player, sourceCard, {
        prompt: "Choose one of your cost 2 or lower characters to give +3000 power this turn.",
        optional: true,
        includeLeader: false,
        filter: card => card.cardType === "character" && getCardEffectiveCost(card) <= 2,
        onSelect: ({ card }) => {
            addTemporaryPowerBonus(card, 3000);
            ui.renderCharacters();
            addGameLog(`${sourceCard.name} gave ${card.name} +3000 power this turn.`);
        },
        skipMessage: `${player.name} did not choose a character for ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no cost 2 or lower characters.`
    });
}

function copyOpponentBoardAbility(player, sourceCard, ui) {
    const choices = getOpponentBoardChoices(player, {
        includeLeader: true,
        filter: card => getCopyableEffects(card).length > 0
    });

    return chooseBoardCard(player, sourceCard, choices, {
        prompt: "Choose an opposing leader or character to copy one ability from.",
        optional: true,
        onSelect: ({ card }) => {
            const effects = getCopyableEffects(card);

            if (effects.length === 0) {
                addGameLog(`${sourceCard.name} found no abilities to copy from ${card.name}.`);
                return;
            }

            const useCopiedEffect = (effectId) => {
                const copiedEffect = effects.find(effect => effect.id === effectId);

                if (!copiedEffect) {
                    addGameLog(`${sourceCard.name} could not copy that ability.`);
                    return;
                }

                const message = resolveCopiedBoardAbility(player, sourceCard, copiedEffect, ui, card);

                addGameLog(
                    message ||
                    `${sourceCard.name} copied ${card.name}'s ability, but that ability has no implemented effect yet.`
                );
            };

            if (effects.length === 1 || !ui?.chooseEffectOption) {
                useCopiedEffect(effects[0].id);
                return;
            }

            ui.chooseEffectOption({
                player,
                sourceCard,
                title: sourceCard.name,
                prompt: `Choose which ${card.name} ability to copy.`,
                options: effects.map(effect => ({
                    label: getCopiedEffectChoiceLabel(effect),
                    value: effect.id
                })),
                onComplete: useCopiedEffect
            });
        },
        skipMessage: `${player.name} did not copy an ability with ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no opposing abilities to copy.`
    });
}

function getCopiedEffectChoiceLabel(effect) {
    const effectTypeLabel = getEffectLabel(effect);
    const effectText = String(effect?.text || "").trim();

    if (!effectText) {
        return effectTypeLabel;
    }

    return `${effectTypeLabel}: ${effectText}`;
}

function resolveCopiedBoardAbility(player, sourceCard, copiedEffect, ui, copiedFromCard) {
    if (!copiedEffect) {
        return "";
    }

    if (copiedEffect.type === "whenAttacking") {
        const message = resolveImmediateCopiedWhenAttackingEffect(
            player,
            sourceCard,
            copiedEffect,
            ui,
            copiedFromCard
        );

        return message;
    }

    if (copiedEffect.type === "keyword") {
        return applyCopiedKeywordEffect(sourceCard, copiedEffect, ui, copiedFromCard);
    }

    if (copiedEffect.type === "onOpponentAttack") {
        return resolveImmediateCopiedOnOpponentAttackEffect(
            player,
            sourceCard,
            copiedEffect,
            ui,
            copiedFromCard
        );
    }

    if (
        copiedEffect.type === "continuous" ||
        copiedEffect.type === "yourTurn" ||
        copiedEffect.type === "opponentsTurn" ||
        copiedEffect.type === "donAttached"
    ) {
        return applyTemporaryCopiedBoardEffect(sourceCard, copiedEffect, ui, copiedFromCard);
    }

    if (copiedEffect.type === "onKO") {
        return resolveCopiedOnKOEffect(player, sourceCard, copiedEffect, ui, copiedFromCard);
    }

    if (copiedEffect.id === "DD01-007-when-attacking-refresh-don") {
        const refreshedDon = setRestedDonActive(player, 2, ui);

        return refreshedDon > 0
            ? `${sourceCard.name} copied ${copiedFromCard.name}'s ability and set ${refreshedDon} DON!! as active.`
            : `${sourceCard.name} copied ${copiedFromCard.name}'s ability but found no rested DON!!.`;
    }

    if (copiedEffect.id === "DD01-010-when-attacking-unblockable") {
        const returnedDon = returnDonToDeck(player, 1, ui);

        if (returnedDon < 1) {
            return `${sourceCard.name} copied ${copiedFromCard.name}'s ability but could not pay DON!! -1.`;
        }

        addTemporaryKeyword(sourceCard, "unblockable");

        return `${sourceCard.name} copied ${copiedFromCard.name}'s ability, returned 1 DON!!, and gained Unblockable this turn.`;
    }

    if (copiedEffect.id === "DD01-017-when-attacking-ko-blocker") {
        const returnedDon = returnDonToDeck(player, 1, ui);

        if (returnedDon < 1) {
            return `${sourceCard.name} copied ${copiedFromCard.name}'s ability but could not pay DON!! -1.`;
        }

        const message = chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing cost 5 or lower Blocker character to K.O.",
            optional: true,
            filter: card => getCardEffectiveCost(card) <= 5 && CardEffects.hasKeyword(card, "blocker"),
            onSelect: ({ playerKey, slotIndex }) => {
                addGameLog(removeCharacterByOpponentEffect(player, gameState[playerKey], slotIndex, sourceCard, ui));
            },
            skipMessage: `${player.name} did not K.O. a Blocker with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing cost 5 or lower Blockers.`
        });

        return `${sourceCard.name} copied ${copiedFromCard.name}'s ability and returned 1 DON!!. ${message}`;
    }

    if (copiedEffect.id === "DD01-006-when-attacking-active") {
        sourceCard.state = "active";

        if (ui?.renderCharacters) {
            ui.renderCharacters();
        }

        return `${sourceCard.name} copied ${copiedFromCard.name}'s ability and set itself active.`;
    }

    return resolveEffectAction(player, sourceCard, copiedEffect, ui, {
        skipActivationPrompt: true,
        copiedFromCard
    });
}

function resolveImmediateCopiedWhenAttackingEffect(player, sourceCard, copiedEffect, ui, copiedFromCard) {
    if (copiedEffect.id === "DD01-001-when-attacking-active") {
        sourceCard.state = "active";

        if (ui?.renderLeaders) {
            ui.renderLeaders();
        }

        if (ui?.renderCharacters) {
            ui.renderCharacters();
        }

        return `${sourceCard.name} copied ${copiedFromCard.name}'s ability and set itself active.`;
    }

    if (copiedEffect.id === "DD01-006-when-attacking-active") {
        sourceCard.state = "active";

        if (ui?.renderCharacters) {
            ui.renderCharacters();
        }

        return `${sourceCard.name} copied ${copiedFromCard.name}'s ability and set itself active.`;
    }

    if (copiedEffect.id === "EGG1-001-when-attacking-power") {
        const message = giveSmallEggmanCharacterPower(player, sourceCard, ui);
        return message || `${sourceCard.name} copied ${copiedFromCard.name}'s ability.`;
    }

    if (copiedEffect.id === "BL01-009-when-attacking-ichigo-power") {
        const message = chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 Kurosaki Ichigo to give +1000 power this turn.",
            optional: true,
            includeLeader: true,
            filter: card => CardEffects.hasCardName(card, "Kurosaki Ichigo"),
            onSelect: ({ card }) => {
                addTemporaryPowerBonus(card, 1000);
                ui.renderLeaders();
                ui.renderCharacters();
                addGameLog(`${sourceCard.name} gave ${card.name} +1000 power this turn.`);
            },
            skipMessage: `${player.name} did not choose a Kurosaki Ichigo for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no Kurosaki Ichigo cards.`
        });

        return message || `${sourceCard.name} copied ${copiedFromCard.name}'s ability.`;
    }

    if (copiedEffect.id === "BL01-011-when-attacking-don-power") {
        if (Number(sourceCard.attachedDon || 0) < 1) {
            return `${sourceCard.name} copied ${copiedFromCard.name}'s ability but had no attached DON!! to meet the condition.`;
        }

        addTemporaryPowerBonus(sourceCard, 3000);

        if (ui?.renderCharacters) {
            ui.renderCharacters();
        }

        return `${sourceCard.name} copied ${copiedFromCard.name}'s ability and gained +3000 power this turn.`;
    }

    if (copiedEffect.id === "BL01-014-when-attacking-minus-ko") {
        const chooseKOTarget = () => {
            const koMessage = chooseOpponentCharacter(player, sourceCard, {
                prompt: "Choose up to 1 opposing character with 4000 power or less to K.O.",
                optional: true,
                filter: card => getCardBattlePower(card, getPlayerForBoardCard(card)) <= 4000,
                onSelect: ({ playerKey, slotIndex }) => {
                    addGameLog(removeCharacterByOpponentEffect(player, gameState[playerKey], slotIndex, sourceCard, ui));
                },
                skipMessage: `${player.name} did not K.O. a character with ${sourceCard.name}.`,
                emptyMessage: `${sourceCard.name} found no opposing characters with 4000 power or less.`
            });

            addGameLog(koMessage);
        };

        const message = chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character to give -1000 power this turn.",
            optional: true,
            onSelect: ({ card }) => {
                addTemporaryPowerBonus(card, -1000);
                ui.renderCharacters();
                addGameLog(`${sourceCard.name} gave ${card.name} -1000 power this turn.`);
                chooseKOTarget();
            },
            onSkip: chooseKOTarget,
            onEmpty: chooseKOTarget,
            skipMessage: `${player.name} did not reduce a character's power with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing characters for power reduction.`
        });

        return message || `${sourceCard.name} copied ${copiedFromCard.name}'s ability.`;
    }

    const message = resolveEffectAction(player, sourceCard, copiedEffect, ui, {
        skipActivationPrompt: true
    });

    return message || `${sourceCard.name} copied ${copiedFromCard.name}'s ${getEffectLabel(copiedEffect)} effect.`;
}

function resolveImmediateCopiedOnOpponentAttackEffect(player, sourceCard, copiedEffect, ui, copiedFromCard) {
    if (copiedEffect.actionId === "trashThisDrawOne") {
        const sourceSlotIndex = player?.characters?.findIndex(card => {
            return card?.instanceId === sourceCard?.instanceId;
        }) ?? -1;

        if (sourceSlotIndex === -1) {
            return `${sourceCard.name} copied ${copiedFromCard.name}'s effect but could not pay its cost.`;
        }

        const trashedCard = player.characters[sourceSlotIndex];

        player.characters[sourceSlotIndex] = null;
        moveCardToTrash(player, trashedCard, ui);
        resolveGutsLeaderCharacterRemovedBonus(player, ui);
        const linkedStageMessage = trashLinkedParfumStageForCharacter(player, trashedCard, ui);
        drawCard(player, ui);

        if (ui?.renderCharacters) {
            ui.renderCharacters();
        }

        if (ui?.renderTrash) {
            ui.renderTrash();
        }

        if (ui?.renderHands) {
            ui.renderHands();
        }

        return linkedStageMessage
            ? `${sourceCard.name} copied ${copiedFromCard.name}'s effect, trashed itself, and drew 1 card. ${linkedStageMessage}`
            : `${sourceCard.name} copied ${copiedFromCard.name}'s effect, trashed itself, and drew 1 card.`;
    }

    const message = resolveEffectAction(player, sourceCard, copiedEffect, ui, {
        skipActivationPrompt: true,
        copiedFromCard
    });

    return message || `${sourceCard.name} copied ${copiedFromCard.name}'s ${getEffectLabel(copiedEffect)} effect.`;
}

function getCopyableEffects(card) {
    const excludedTypes = new Set([
        "gameStart",
        "manualReview"
    ]);

    return [
        ...getCardAllEffects(card),
        ...getCardKeywordEffects(card)
    ]
        .filter(effect => !excludedTypes.has(effect.type))
        .filter(effect => effect.id !== "EGG1-002-activate-main-copy");
}

function applyCopiedKeywordEffect(sourceCard, copiedEffect, ui, copiedFromCard) {
    const keywordKey = copiedEffect?.keyword;
    const keywordName = copiedEffect?.keywordName || keywordKey || "keyword";

    if (!sourceCard || !keywordKey) {
        return "";
    }

    addTemporaryKeyword(sourceCard, keywordKey);

    if (ui?.renderLeaders) {
        ui.renderLeaders();
    }

    if (ui?.renderCharacters) {
        ui.renderCharacters();
    }

    return `${sourceCard.name} copied ${copiedFromCard.name}'s ${keywordName} keyword until end of turn.`;
}

function applyTemporaryCopiedBoardEffect(sourceCard, copiedEffect, ui, copiedFromCard) {
    if (!sourceCard || !copiedEffect) {
        return "";
    }

    if (!Array.isArray(sourceCard.temporaryCopiedEffects)) {
        sourceCard.temporaryCopiedEffects = [];
    }

    const effectCopy = typeof structuredClone === "function"
        ? structuredClone(copiedEffect)
        : JSON.parse(JSON.stringify(copiedEffect));

    sourceCard.temporaryCopiedEffects.push(effectCopy);

    if (ui?.renderLeaders) {
        ui.renderLeaders();
    }

    if (ui?.renderCharacters) {
        ui.renderCharacters();
    }

    return `${sourceCard.name} copied ${copiedFromCard.name}'s ${getEffectLabel(copiedEffect)} effect until end of turn.`;
}

function resolveCopiedOnKOEffect(player, sourceCard, copiedEffect, ui, copiedFromCard) {
    if (copiedEffect.id === "DD01-012-on-ko-add-don") {
        const addedDon = addDon(player, 1, ui);

        return addedDon > 0
            ? `${sourceCard.name} copied ${copiedFromCard.name}'s On K.O. effect and added 1 active DON!!.`
            : `${sourceCard.name} copied ${copiedFromCard.name}'s On K.O. effect but found no DON!! cards to add.`;
    }

    const message = resolveEffectAction(player, sourceCard, copiedEffect, ui, {
        skipActivationPrompt: true
    });

    return message || `${sourceCard.name} copied ${copiedFromCard.name}'s On K.O. effect.`;
}

function copyOpponentCharacterBasePower(player, sourceCard, ui) {
    const opponent = getOpponentPlayer(player);
    const expiresAtPlayerKey = getPlayerKey(opponent);
    const expiresAtEndOfTurns = Number(opponent?.turns || 0) + 1;
    let ownTarget = null;

    const chooseOpponentPower = () => {
        const message = chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose an opposing character whose base power will be copied.",
            optional: false,
            onSelect: ({ card: opposingCard }) => {
                const basePower = typeof getPrintedPower === "function"
                    ? getPrintedPower(opposingCard)
                    : Number(opposingCard.power ?? 0);

                ownTarget.temporaryBasePower = {
                    value: basePower,
                    expiresAtPlayerKey,
                    expiresAtEndOfTurns
                };

                ui.renderCharacters();
                addGameLog(`${sourceCard.name} made ${ownTarget.name}'s base power ${basePower} until ${opponent.name}'s next end phase.`);
            },
            emptyMessage: `${sourceCard.name} found no opposing characters.`
        });

        addGameLog(message);
    };

    return chooseOwnBoardCard(player, sourceCard, {
        prompt: "Choose one of your Eggman Empire characters to change its base power.",
        optional: true,
        includeLeader: false,
        filter: card => card.cardType === "character" && hasTypeText(card, "Eggman Empire"),
        onSelect: ({ card }) => {
            ownTarget = card;
            chooseOpponentPower();
        },
        skipMessage: `${player.name} did not choose a character for ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no Eggman Empire characters.`
    });
}

function trashOwnCharacterForMetalSonicPower(player, sourceCard, ui) {
    const sourceInstanceId = sourceCard?.instanceId;

    return chooseOwnBoardCard(player, sourceCard, {
        prompt: "Choose one of your other characters to trash for Metal Sonic's power bonus.",
        optional: true,
        includeLeader: false,
        filter: card => card.cardType === "character" && card.instanceId !== sourceInstanceId,
        onSelect: ({ slotIndex, card }) => {
            const bonus = getCardEffectiveCost(card) * 1000;
            const sourceSlotIndex = player.characters.findIndex(character => {
                return character?.instanceId === sourceInstanceId;
            });
            const metalSonic = sourceSlotIndex !== -1
                ? player.characters[sourceSlotIndex]
                : sourceCard;

            player.characters[slotIndex] = null;
            moveCardToTrash(player, card, ui);
            resolveGutsLeaderCharacterRemovedBonus(player, ui);
            const linkedStageMessage = trashLinkedParfumStageForCharacter(player, card, ui);
            addTemporaryPowerBonus(metalSonic, bonus);

            ui.renderCharacters();
            ui.renderTrash();
            addGameLog(
                linkedStageMessage
                    ? `${metalSonic.name} trashed ${card.name} and gained +${bonus} power this turn. ${linkedStageMessage}`
                    : `${metalSonic.name} trashed ${card.name} and gained +${bonus} power this turn.`
            );
        },
        skipMessage: `${player.name} did not trash a character for ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no other characters to trash.`
    });
}

function playEggmanCharactersFromTrash(player, sourceCard, ui) {
    const playOneCostFive = () => playEggmanCharactersFromTrashByCost(player, sourceCard, ui, 5, 1);
    const playTwoCostTwo = () => playEggmanCharactersFromTrashByCost(player, sourceCard, ui, 2, 2);

    if (ui?.chooseEffectOption) {
        ui.chooseEffectOption({
            player,
            sourceCard,
            title: sourceCard.name,
            prompt: "Choose which Eggman characters to play from trash.",
            options: [
                {
                    label: "1 cost 5 or less",
                    value: "cost5"
                },
                {
                    label: "Up to 2 cost 2 or less",
                    value: "cost2"
                }
            ],
            onComplete: value => {
                if (value === "cost2") {
                    addGameLog(playTwoCostTwo());
                } else {
                    addGameLog(playOneCostFive());
                }
            }
        });

        return `${player.name} is choosing how to resolve ${sourceCard.name}.`;
    }

    return playOneCostFive();
}

function playEggmanCharactersFromTrashByCost(player, sourceCard, ui, maxCost, maxAmount) {
    const played = [];

    const playNext = () => {
        if (played.length >= maxAmount) {
            drawCard(player, ui);
            addGameLog(`${sourceCard.name} played ${played.length} character${played.length === 1 ? "" : "s"} from trash and drew 1 card.`);
            return;
        }

        if (getFirstOpenCharacterSlotIndex(player) === -1) {
            if (played.length > 0) {
                drawCard(player, ui);
            }

            addGameLog(`${sourceCard.name} stopped because ${player.name}'s character area is full.`);
            return;
        }

        const choices = getTrashCharacterChoices(player, card => {
            return hasTypeText(card, "Eggman Empire") &&
                getCardEffectiveCost(card) <= maxCost &&
                !played.includes(card);
        });

        if (choices.length === 0) {
            if (played.length > 0) {
                drawCard(player, ui);
            }

            addGameLog(`${sourceCard.name} found no more eligible Eggman Empire characters in trash.`);
            return;
        }

        chooseBoardCard(player, sourceCard, choices, {
            prompt: `Choose ${maxAmount === 1 ? "up to 1" : "up to 2"} Eggman Empire character${maxAmount === 1 ? "" : "s"} with cost ${maxCost} or less from trash.`,
            optional: true,
            onSelect: ({ card }) => {
                const trashIndex = player.trash.indexOf(card);
                const slotIndex = getFirstOpenCharacterSlotIndex(player);

                if (trashIndex === -1 || slotIndex === -1) {
                    return;
                }

                const playedCard = player.trash.splice(trashIndex, 1)[0];

                playedCard.state = "active";
                playedCard.playedOnTurn = player.turns;
                playedCard.uiAnimation = "played";
                player.characters[slotIndex] = playedCard;
                played.push(playedCard);

                const effectMessages = resolveOnPlayEffects(player, playedCard, ui);

                ui.renderCharacters();
                ui.renderTrash();
                effectMessages.forEach(message => addGameLog(message));

                if (played.length >= maxAmount) {
                    drawCard(player, ui);
                    addGameLog(`${sourceCard.name} played ${played.length} character${played.length === 1 ? "" : "s"} from trash and drew 1 card.`);
                    return;
                }

                playNext();
            },
            onSkip: () => {
                if (played.length > 0) {
                    drawCard(player, ui);
                    addGameLog(`${sourceCard.name} played ${played.length} character${played.length === 1 ? "" : "s"} from trash and drew 1 card.`);
                }
            },
            skipMessage: `${player.name} stopped choosing characters for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no eligible Eggman Empire characters in trash.`
        });
    };

    playNext();

    return `${player.name} is choosing Eggman Empire characters from trash for ${sourceCard.name}.`;
}

function getTrashCharacterChoices(player, filter) {
    const playerKey = getPlayerKey(player);

    return player.trash
        .map((card, trashIndex) => ({
            playerKey,
            cardType: "trash",
            trashIndex,
            card
        }))
        .filter(choice => choice.card?.cardType === "character" && (!filter || filter(choice.card, choice)));
}

function chooseCardsFromHandToTrash(player, sourceCard, ui, amount, onComplete) {
    const chosenCards = [];

    const chooseNext = () => {
        if (chosenCards.length >= amount) {
            if (typeof onComplete === "function") {
                onComplete(chosenCards);
            }

            return;
        }

        const choices = getHandCardChoices(player, card => !chosenCards.includes(card));

        if (choices.length === 0) {
            addGameLog(`${sourceCard.name} found no more cards in ${player.name}'s hand to trash.`);

            if (typeof onComplete === "function") {
                onComplete(chosenCards);
            }

            return;
        }

        const message = chooseBoardCard(player, sourceCard, choices, {
            prompt: `Choose card ${chosenCards.length + 1} of ${amount} from hand to trash for ${sourceCard.name}.`,
            optional: false,
            onSelect: ({ card }) => {
                const handIndex = player.hand.indexOf(card);

                if (handIndex !== -1) {
                    const trashedCard = player.hand.splice(handIndex, 1)[0];
                    moveCardToTrash(player, trashedCard, ui);
                    chosenCards.push(trashedCard);
                    ui.renderHands();
                    ui.renderTrash();
                    addGameLog(`${player.name} trashed ${trashedCard.name} for ${sourceCard.name}.`);
                }

                chooseNext();
            },
            emptyMessage: `${sourceCard.name} found no cards in hand to trash.`
        });

        addGameLog(message);
    };

    chooseNext();
}

function resolveDiabloOnPlay(player, sourceCard, ui) {
    if (!restDonForCost(player, 1, ui)) {
        return `${sourceCard.name}'s On Play effect could not rest 1 DON!!.`;
    }

    if (!isRimuruTempestLeader(player)) {
        return `${sourceCard.name}'s On Play effect rested 1 DON!!, but ${player.name}'s leader is not Rimuru Tempest.`;
    }

    const addLifeIfNeeded = () => {
        if (player.life.length > 1) {
            return;
        }

        const topCard = player.deck.shift();

        if (!topCard) {
            addGameLog(`${sourceCard.name} could not add life because ${player.name}'s deck is empty.`);
            return;
        }

        player.life.unshift(assignCardInstance(topCard));
        ui.renderDecks();
        ui.renderLifeCards();
        addGameLog(`${sourceCard.name} added the top card of ${player.name}'s deck to life.`);
    };

    const choices = getTrashCharacterChoices(player, card => {
        return CardEffects.hasCardName(card, "Testarosa") ||
            CardEffects.hasCardName(card, "Ultima") ||
            CardEffects.hasCardName(card, "Carrera");
    });

    if (choices.length === 0 || getFirstOpenCharacterSlotIndex(player) === -1) {
        addLifeIfNeeded();

        return choices.length === 0
            ? `${sourceCard.name} found no Testarosa, Ultima, or Carrera in trash.`
            : `${sourceCard.name} found no open character slot.`;
    }

    const message = chooseBoardCard(player, sourceCard, choices, {
        prompt: "Choose up to 1 Testarosa, Ultima, or Carrera from trash to play.",
        optional: true,
        onSelect: ({ card }) => {
            const trashIndex = player.trash.indexOf(card);
            const slotIndex = getFirstOpenCharacterSlotIndex(player);

            if (trashIndex === -1 || slotIndex === -1) {
                addLifeIfNeeded();
                return;
            }

            const playedCard = player.trash.splice(trashIndex, 1)[0];

            playedCard.state = "active";
            playedCard.playedOnTurn = player.turns;
            playedCard.uiAnimation = "played";
            player.characters[slotIndex] = playedCard;

            const effectMessages = resolveOnPlayEffects(player, playedCard, ui);

            ui.renderCharacters();
            ui.renderTrash();
            addGameLog(`${sourceCard.name} played ${playedCard.name} from trash.`);
            effectMessages.forEach(effectMessage => addGameLog(effectMessage));
            addLifeIfNeeded();
        },
        onSkip: addLifeIfNeeded,
        skipMessage: `${player.name} did not play a character from trash for ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no valid character in trash.`
    });

    return `${sourceCard.name} rested 1 DON!!. ${message}`;
}

function resolveCarreraOnPlay(player, sourceCard, ui) {
    if (player.hand.length < 2) {
        return `${sourceCard.name}'s On Play effect needs 2 cards in hand to trash.`;
    }

    const opponent = getOpponentPlayer(player);

    chooseCardsFromHandToTrash(player, sourceCard, ui, 2, () => {
        if (!opponent || opponent.hand.length < 5) {
            addGameLog(`${sourceCard.name} found no opponent hand to reduce.`);
            return;
        }

        const targetHandSize = Math.max(player.hand.length, 4);

        const trimNext = () => {
            if (opponent.hand.length <= targetHandSize) {
                addGameLog(`${sourceCard.name} reduced ${opponent.name}'s hand to ${opponent.hand.length} card${opponent.hand.length === 1 ? "" : "s"}.`);
                return;
            }

            const choices = getHandCardChoices(opponent);
            const message = chooseBoardCard(opponent, sourceCard, choices, {
                prompt: `Choose a card from ${opponent.name}'s hand to trash for ${sourceCard.name}.`,
                optional: false,
                onSelect: ({ card }) => {
                    const handIndex = opponent.hand.indexOf(card);

                    if (handIndex !== -1) {
                        moveCardToTrash(opponent, opponent.hand.splice(handIndex, 1)[0], ui);
                        ui.renderHands();
                        ui.renderTrash();
                    }

                    trimNext();
                },
                emptyMessage: `${sourceCard.name} found no cards in ${opponent.name}'s hand.`
            });

            addGameLog(message);
        };

        trimNext();
    });

    return `${player.name} is trashing 2 cards from hand for ${sourceCard.name}.`;
}

function resolveTestarosaOnPlay(player, sourceCard, ui) {
    if (player.hand.length < 2) {
        return `${sourceCard.name}'s On Play effect needs 2 cards in hand to trash.`;
    }

    chooseCardsFromHandToTrash(player, sourceCard, ui, 2, () => {
        const message = chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character with a different current cost than its base cost to K.O.",
            optional: true,
            filter: card => getCardEffectiveCost(card) !== Number(card.cost ?? 0),
            onSelect: ({ playerKey, slotIndex }) => {
                addGameLog(removeCharacterByOpponentEffect(player, gameState[playerKey], slotIndex, sourceCard, ui));
            },
            skipMessage: `${player.name} did not K.O. a character with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing characters with modified cost.`
        });

        addGameLog(message);
    });

    return `${player.name} is trashing 2 cards from hand for ${sourceCard.name}.`;
}

function resolveUltimaOnPlay(player, sourceCard, ui) {
    if (player.hand.length < 2) {
        return `${sourceCard.name}'s On Play effect needs 2 cards in hand to trash.`;
    }

    const chooseKOTarget = () => {
        const koMessage = chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing cost 1 or lower character to K.O.",
            optional: true,
            filter: card => getCardEffectiveCost(card) <= 1,
            onSelect: ({ playerKey, slotIndex }) => {
                addGameLog(removeCharacterByOpponentEffect(player, gameState[playerKey], slotIndex, sourceCard, ui));
            },
            skipMessage: `${player.name} did not K.O. a character with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no cost 1 or lower opposing characters.`
        });

        addGameLog(koMessage);
    };

    chooseCardsFromHandToTrash(player, sourceCard, ui, 2, () => {
        const costMessage = chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character to give -3 cost this turn.",
            optional: true,
            onSelect: ({ card }) => {
                addCostModifier(card, -3);
                addGameLog(`${sourceCard.name} gave ${card.name} -3 cost this turn.`);
                chooseKOTarget();
            },
            onSkip: chooseKOTarget,
            onEmpty: chooseKOTarget,
            skipMessage: `${player.name} did not reduce a character's cost with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing characters for cost reduction.`
        });

        addGameLog(costMessage);
    });

    return `${player.name} is trashing 2 cards from hand for ${sourceCard.name}.`;
}

function resolveDeathEggOnPlay(player, sourceCard, ui) {
    const ownCharacters = player.characters.filter(Boolean);

    ownCharacters.forEach(character => {
        character.state = "active";
        player.hand.push(character);
    });

    player.characters = player.characters.map(() => null);

    const opponent = getOpponentPlayer(player);
    const messages = [];

    opponent?.characters.forEach((character, slotIndex) => {
        if (!character) {
            return;
        }

        messages.push(removeCharacterByOpponentEffect(player, opponent, slotIndex, sourceCard, ui));
    });

    ui.renderHands();
    ui.renderCharacters();
    ui.renderTrash();

    return `${sourceCard.name} returned ${ownCharacters.length} character${ownCharacters.length === 1 ? "" : "s"} to ${player.name}'s hand. ${messages.filter(Boolean).join(" ")}`;
}

function lockOpponentCharactersFromAttacking(player, sourceCard, ui, maxTargets, maxCost) {
    const opponent = getOpponentPlayer(player);
    const opponentKey = getPlayerKey(opponent);
    const expiresAtEndOfTurns = Number(opponent?.turns || 0) + 1;
    const locked = [];

    const chooseNext = () => {
        if (locked.length >= maxTargets) {
            return;
        }

        const message = chooseOpponentCharacter(player, sourceCard, {
            prompt: `Choose up to ${maxTargets - locked.length} opposing cost ${maxCost} or lower character${maxTargets - locked.length === 1 ? "" : "s"} that cannot attack until opponent's next end phase.`,
            optional: true,
            filter: (card, choice) => {
                return getCardEffectiveCost(card) <= maxCost &&
                    !locked.some(entry => entry.slotIndex === choice.slotIndex);
            },
            onSelect: ({ card, slotIndex }) => {
                card.cannotAttackUntil = {
                    expiresAtPlayerKey: opponentKey,
                    expiresAtEndOfTurns
                };
                locked.push({ card, slotIndex });

                if (ui?.renderCharacters) {
                    ui.renderCharacters();
                }

                addGameLog(`${sourceCard.name} prevented ${card.name} from attacking until ${opponent.name}'s next end phase.`);
                chooseNext();
            },
            skipMessage: `${player.name} stopped choosing attack locks for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing cost ${maxCost} or lower characters.`
        });

        addGameLog(message);
    };

    chooseNext();

    return `${player.name} is choosing characters for ${sourceCard.name}.`;
}

function lookTopCardsForType(player, sourceCard, amount, typeText, ui, options = {}) {
    if (!player || !sourceCard) {
        return "";
    }

    const cardsToLookAt = player.deck.splice(0, amount);

    if (cardsToLookAt.length === 0) {
        return `${sourceCard.name}'s effect found no cards because ${player.name}'s deck is empty.`;
    }

    const isSelectable = options.isSelectable || ((card) => {
        const matchesType = String(card.type || "")
            .toLowerCase()
            .includes(String(typeText).toLowerCase());
        const isExcludedName = (options.excludeNames || [])
            .some(name => CardEffects.hasCardName(card, name));

        return matchesType && !isExcludedName;
    });

    const finishSelection = (selection) => {
        const originalCardsToLookAt = [...cardsToLookAt];
        const selectedIndex = typeof selection === "object" && selection !== null
            ? selection.selectedIndex
            : selection;
        const bottomOrder = typeof selection === "object" && selection !== null
            ? selection.bottomOrder
            : null;
        const orderedRemaining = typeof selection === "object" && selection !== null
            ? selection.orderedRemaining
            : null;
        const returnZone = typeof selection === "object" && selection !== null
            ? selection.returnZone
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

        if (Array.isArray(orderedRemaining)) {
            const finalOrderedCards = orderedRemaining
                .map(index => originalCardsToLookAt[index])
                .filter(card => cardsToLookAt.includes(card))
                .filter(Boolean);
            const orderedSet = new Set(finalOrderedCards);
            const unorderedRemainingCards = cardsToLookAt.filter(card => !orderedSet.has(card));
            const allOrderedCards = [...finalOrderedCards, ...unorderedRemainingCards];
            const placeOnTop = returnZone === "top";

            player.deck = placeOnTop
                ? [...allOrderedCards, ...player.deck]
                : [...player.deck, ...allOrderedCards];

            if (ui?.renderHands) {
                ui.renderHands();
            }

            if (ui?.renderDecks) {
                ui.renderDecks();
            }

            addGameLog(
                `${player.name} placed the remaining card${allOrderedCards.length === 1 ? "" : "s"} on the ${placeOnTop ? "top" : "bottom"} of the deck.`
            );

            options.onResolved?.();
            return;
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
        options.onResolved?.();
    };

    if (ui && typeof ui.lookTopCardsAddToHand === "function") {
        ui.lookTopCardsAddToHand({
            player,
            sourceCard,
            cards: cardsToLookAt,
            isSelectable,
            allowTopOrBottomPlacement: Boolean(options.allowTopOrBottomPlacement),
            onComplete: finishSelection
        });

        return `${player.name} is looking at the top ${cardsToLookAt.length} card${cardsToLookAt.length === 1 ? "" : "s"} of the deck.`;
    }

    const firstValidIndex = cardsToLookAt.findIndex(isSelectable);

    finishSelection(firstValidIndex === -1 ? null : firstValidIndex);

    return `${sourceCard.name}'s look top effect resolved.`;
}

function resolveRimuruTurnStartSearch(player, ui) {
    const leader = player?.leader;

    if (!leader || !isRimuruTempestLeader(player)) {
        return { activated: false, message: "" };
    }

    const effect = leader.effects?.find(cardEffect => cardEffect.id === "RIM1-001-turn-start-search");

    if (!effect) {
        return { activated: false, message: "" };
    }

    const shouldActivate = typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(`${leader.name}: use start-of-turn search and skip your draw this turn?`)
        : false;

    if (!shouldActivate) {
        return {
            activated: false,
            message: `${player.name} skipped ${leader.name}'s start-of-turn search.`
        };
    }

    const message = lookTopCardsForRimuruLeader(player, leader, 5, ui);

    return {
        activated: true,
        message
    };
}

function resolveDavidTaglavnovicTurnStartSearch(player, ui, onResolved = null) {
    const leader = player?.leader;

    if (!leader || leader.cardNumber !== "POG1-001") {
        return { activated: false, message: "" };
    }

    const effect = leader.effects?.find(cardEffect => cardEffect.id === "POG1-001-start-of-turn-search");

    if (!effect) {
        return { activated: false, message: "" };
    }

    const message = lookTopCardsForType(player, leader, 3, "", ui, {
        isSelectable: card => CardEffects.hasCardName(card, "Parfum"),
        allowTopOrBottomPlacement: true,
        onResolved
    });

    return {
        activated: true,
        message,
        pending: Boolean(ui && typeof ui.lookTopCardsAddToHand === "function")
    };
}

function lookTopCardsForRimuruLeader(player, sourceCard, amount, ui) {
    const cardsToLookAt = player.deck.splice(0, amount);

    if (cardsToLookAt.length === 0) {
        return `${sourceCard.name}'s effect found no cards because ${player.name}'s deck is empty.`;
    }

    const addedNames = Array.isArray(sourceCard.rimuruAddedNames)
        ? sourceCard.rimuruAddedNames
        : [];
    const usedNameSet = new Set(addedNames.map(name => CardEffects.normalizeCardName(name)));
    const isSelectable = card => {
        return card?.cardType === "character" &&
            isTwelveGuardianLordType(card) &&
            !usedNameSet.has(CardEffects.normalizeCardName(card.name));
    };

    const finishSelection = (selection) => {
        const selectedIndex = typeof selection === "object" && selection !== null
            ? selection.selectedIndex
            : selection;
        let selectedCard = null;

        if (
            selectedIndex !== null &&
            selectedIndex >= 0 &&
            selectedIndex < cardsToLookAt.length &&
            isSelectable(cardsToLookAt[selectedIndex])
        ) {
            selectedCard = cardsToLookAt.splice(selectedIndex, 1)[0];
            player.hand.push(assignCardInstance(selectedCard));
            sourceCard.rimuruAddedNames = [
                ...addedNames,
                selectedCard.name
            ];
            addGameLog(`${player.name} added a card to hand with ${sourceCard.name}.`);
        } else {
            addGameLog(`${player.name} did not add a card with ${sourceCard.name}'s effect.`);
        }

        cardsToLookAt.forEach(card => {
            moveCardToTrash(player, assignCardInstance(card), ui);
        });

        if (ui?.renderHands) {
            ui.renderHands();
        }

        if (ui?.renderDecks) {
            ui.renderDecks();
        }

        if (ui?.renderTrash) {
            ui.renderTrash();
        }

        addGameLog(`${player.name} trashed the remaining card${cardsToLookAt.length === 1 ? "" : "s"} from ${sourceCard.name}'s effect.`);
    };

    if (ui && typeof ui.lookTopCardsAddToHand === "function") {
        ui.lookTopCardsAddToHand({
            player,
            sourceCard,
            cards: cardsToLookAt,
            isSelectable,
            revealSelected: false,
            descriptionText: `Choose up to 1 new Twelve Guardian Lords character to add to ${player.name}'s hand. The rest go to trash.`,
            onComplete: finishSelection
        });

        return `${player.name} is resolving ${sourceCard.name}'s start-of-turn search and will skip the draw.`;
    }

    const firstValidIndex = cardsToLookAt.findIndex(isSelectable);

    finishSelection(firstValidIndex === -1 ? null : firstValidIndex);

    return `${sourceCard.name}'s start-of-turn search resolved.`;
}

function isKurosakiIchigoLeader(player) {
    return Boolean(player?.leader && CardEffects.hasCardName(player.leader, "Kurosaki Ichigo"));
}

function hasKurosakiIchigoCharacter(player) {
    return player?.characters?.some(card => {
        return card?.cardType === "character" && CardEffects.hasCardName(card, "Kurosaki Ichigo");
    });
}

function isZangetsuStage(card) {
    return card?.cardType === "stage" && (
        CardEffects.hasCardName(card, "Zangetsu: Sealed") ||
        CardEffects.hasCardName(card, "Zangetsu: Shikai") ||
        CardEffects.hasCardName(card, "Bankai: Tensa Zangetsu") ||
        CardEffects.hasCardName(card, "Tensa Zangetsu: Visored") ||
        hasTypeText(card, "Zanpakto")
    );
}

function getCurrentZangetsuStageCost(player) {
    return isZangetsuStage(player?.stage)
        ? Number(player.stage.cost ?? 0)
        : 0;
}

function findZangetsuStageForGameStart(player, targetCost) {
    const zones = [
        { name: "deck", cards: player?.deck || [] },
        { name: "hand", cards: player?.hand || [] },
        { name: "life", cards: player?.life || [] }
    ];

    for (const zone of zones) {
        const index = zone.cards.findIndex(card => {
            return isZangetsuStage(card) && Number(card.cost ?? 0) === Number(targetCost || 0);
        });

        if (index !== -1) {
            return { zone, index };
        }
    }

    return null;
}

function findZangetsuStageInDeck(player, targetCost) {
    const deck = player?.deck || [];
    const index = deck.findIndex(card => {
        return isZangetsuStage(card) && Number(card.cost ?? 0) === Number(targetCost || 0);
    });

    return index === -1
        ? null
        : {
            zone: {
                name: "deck",
                cards: deck
            },
            index
        };
}

function playZangetsuStageFromDeck(player, sourceCard, ui, targetCost) {
    if (!player) {
        return "";
    }

    const stageLocation = findZangetsuStageInDeck(player, targetCost);

    if (!stageLocation) {
        shuffleDeck(player.deck);

        if (ui?.renderDecks) {
            ui.renderDecks();
        }

        return `${sourceCard.name} found no cost ${targetCost} Zangetsu stage in ${player.name}'s deck. ${player.name} shuffled the deck.`;
    }

    const oldStage = player.stage;
    const stage = stageLocation.zone.cards.splice(stageLocation.index, 1)[0];

    if (stageLocation.zone.name === "hand" && player.deck.length) {
        player.hand.push(assignCardInstance(player.deck.shift()));
    }

    if (stageLocation.zone.name === "life" && player.deck.length) {
        player.life.push(assignCardInstance(player.deck.shift()));
    }

    stage.state = "active";
    stage.uiAnimation = "played";
    player.stage = stage;

    if (oldStage) {
        const returnMessage = trashStageFromField(player, oldStage, ui);

        if (returnMessage) {
            addGameLog(returnMessage);
        }
    }

    shuffleDeck(player.deck);

    if (ui?.renderDecks) {
        ui.renderDecks();
    }

    if (ui?.renderStages) {
        ui.renderStages();
    }

    if (ui?.renderHands) {
        ui.renderHands();
    }

    if (ui?.renderLifeCards) {
        ui.renderLifeCards();
    }

    if (ui?.renderTrash) {
        ui.renderTrash();
    }

    return oldStage
        ? `${sourceCard.name} played ${stage.name} from the deck, replacing ${oldStage.name}, then shuffled the deck.`
        : `${sourceCard.name} played ${stage.name} from the deck, then shuffled the deck.`;
}

function resolveKurosakiIchigoGameStart(player, ui) {
    if (!isKurosakiIchigoLeader(player)) {
        return "";
    }

    return playZangetsuStageFromDeck(player, player.leader, ui, 1);
}

function resolveKurosakiIchigoDamageStageUpgrade(player, ui) {
    if (!isKurosakiIchigoLeader(player)) {
        return "";
    }

    const leader = player.leader;
    const effectId = "BL01-001-damage-upgrade-zangetsu";

    if (CardEffects.hasUsedOncePerTurnEffect(leader, effectId, player.turns)) {
        return `${leader.name}'s Once Per Turn stage upgrade has already been used this turn.`;
    }

    const targetCost = getCurrentZangetsuStageCost(player) + 1;

    if (targetCost < 1 || targetCost > 4) {
        return `${leader.name}'s stage upgrade found no higher Zangetsu stage cost.`;
    }

    const finishUpgrade = () => {
        CardEffects.markOncePerTurnEffectUsed(leader, effectId, player.turns);
        addGameLog(playZangetsuStageFromDeck(player, leader, ui, targetCost));
    };

    const effect = leader.effects?.find(cardEffect => cardEffect.id === effectId) || {
        id: effectId,
        type: "onOpponentDealsDamage",
        text: "Play the next Zangetsu stage from your deck?"
    };

    if (ui?.chooseEffectActivation) {
        ui.chooseEffectActivation({
            player,
            sourceCard: leader,
            effect,
            title: leader.name,
            prompt: `Opponent dealt damage. Play a cost ${targetCost} Zangetsu stage from your deck?`,
            activateText: "Play Stage",
            skipText: "Skip",
            onComplete: (shouldActivate) => {
                if (shouldActivate) {
                    finishUpgrade();
                } else {
                    addGameLog(`${player.name} skipped ${leader.name}'s stage upgrade.`);
                }
            }
        });

        return `${player.name} is choosing whether to use ${leader.name}'s stage upgrade.`;
    }

    finishUpgrade();
    return `${leader.name}'s stage upgrade resolved.`;
}

function searchGetsugaTenshoFromDeck(player, sourceCard, ui) {
    if (!isKurosakiIchigoLeader(player)) {
        return `${sourceCard.name}'s On Play effect did not resolve because ${player.name}'s leader is not Kurosaki Ichigo.`;
    }

    const cardIndex = player.deck.findIndex(card => {
        return String(card?.cardType || "").toLowerCase() === "event" &&
            CardEffects.hasCardName(card, "Getsuga Tensho");
    });

    const fallbackIndex = cardIndex !== -1
        ? cardIndex
        : player.deck.findIndex(card => CardEffects.hasCardName(card, "Getsuga Tensho"));

    if (fallbackIndex === -1) {
        shuffleDeck(player.deck);

        if (ui?.renderDecks) {
            ui.renderDecks();
        }

        return `${sourceCard.name} found no Getsuga Tensho in the deck. ${player.name} shuffled the deck.`;
    }

    const foundCard = player.deck.splice(fallbackIndex, 1)[0];

    player.hand.push(foundCard);
    shuffleDeck(player.deck);

    if (typeof ui?.revealCards === "function") {
        ui.revealCards([foundCard]);
    }

    if (ui?.renderHands) {
        ui.renderHands();
    }

    if (ui?.renderDecks) {
        ui.renderDecks();
    }

    return `${sourceCard.name} revealed ${foundCard.name}, added it to hand, then shuffled the deck.`;
}

function resolveGetsugaTenshoMain(player, sourceCard, ui) {
    if (!isKurosakiIchigoLeader(player)) {
        return `${sourceCard.name}'s Main effect did not resolve because ${player.name}'s leader is not Kurosaki Ichigo.`;
    }

    player.characters.filter(Boolean).forEach(character => {
        addTemporaryPowerBonus(character, 5000);
    });

    addTemporaryPowerBonus(player.leader, 5000);
    addTemporaryKeyword(player.leader, "unblockable");
    player.loseAtEndOfTurnSource = sourceCard.name;

    if (ui?.renderLeaders) {
        ui.renderLeaders();
    }

    if (ui?.renderCharacters) {
        ui.renderCharacters();
    }

    return `${sourceCard.name} gave all of ${player.name}'s characters and leader +5000 power. ${player.name}'s leader gained Unblockable this turn. If ${player.name} does not win by end of turn, they lose the game.`;
}

function resolveSotenKisshunMain(player, sourceCard, ui) {
    if (!isKurosakiIchigoLeader(player)) {
        return `${sourceCard.name}'s Main effect did not resolve because ${player.name}'s leader is not Kurosaki Ichigo.`;
    }

    if (!restDonForCost(player, 7, ui)) {
        return `${player.name} could not rest 7 active DON!! for ${sourceCard.name}.`;
    }

    const topDeckCard = player.deck.shift();

    if (!topDeckCard) {
        const deckOutResult = checkDeckOut(player, `${player.name} tried to add the top deck card to life with no cards in deck.`);
        return deckOutResult?.deckOut
            ? `${sourceCard.name}'s Main effect found no card because ${player.name} lost by deck out.`
            : `${sourceCard.name}'s Main effect found no card in deck.`;
    }

    player.life.unshift(topDeckCard);

    if (ui?.renderDecks) {
        ui.renderDecks();
    }

    if (ui?.renderLifeCards) {
        ui.renderLifeCards();
    }

    return `${sourceCard.name} rested 7 DON!! and placed the top card of ${player.name}'s deck on top of their life.`;
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

function getOpponentBoardChoices(player, options = {}) {
    const opponent = getOpponentPlayer(player);

    if (!opponent) {
        return [];
    }

    return getOwnBoardChoices(opponent, options).filter(choice => {
        return !options.filter || options.filter(choice.card, choice);
    });
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

function addDurationPowerBonus(card, amount, expiresAtEndOfTurns, expiresAtPlayerKey = null) {
    if (!card) {
        return;
    }

    if (!Array.isArray(card.durationPowerBonuses)) {
        card.durationPowerBonuses = [];
    }

    card.durationPowerBonuses.push({
        amount: Number(amount || 0),
        expiresAtEndOfTurns,
        expiresAtPlayerKey
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

    if (typeof renderCharacters === "function") {
        renderCharacters();
    }
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
        onSelect: ({ playerKey, slotIndex }) => {
            addGameLog(removeCharacterByOpponentEffect(player, gameState[playerKey], slotIndex, sourceCard, ui));
        },
        skipMessage: `${player.name} did not K.O. a character with ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no opposing cost ${maxCost} or lower characters.`
    });
}

function removeCharacterByOpponentEffect(actingPlayer, targetPlayer, slotIndex, sourceCard, ui) {
    const card = targetPlayer?.characters?.[slotIndex];
    const targetPlayerKey = getPlayerKey(targetPlayer);

    if (!card) {
        return "No character was found in that slot.";
    }

    if (isProtectedFromOpponentEffects(card, targetPlayerKey, actingPlayer)) {
        return `${card.name} is protected from opponent effects.`;
    }

    const uryu = getAvailableUryuLifeFlipReplacement(targetPlayer, actingPlayer);

    if (uryu) {
        if (ui?.chooseEffectActivation) {
            ui.chooseEffectActivation({
                player: targetPlayer,
                sourceCard: uryu,
                effect: uryu.effects?.find(cardEffect => cardEffect.id === "BL01-008-life-flip-replace") || {
                    id: "BL01-008-life-flip-replace",
                    type: "replacement",
                    text: "Flip your top life face up instead?"
                },
                title: uryu.name,
                prompt: `${card.name} would be removed by ${sourceCard.name}. Flip your top life card face up instead?`,
                activateText: "Flip Life",
                skipText: "Let Remove",
                onComplete: (shouldActivate) => {
                    if (shouldActivate && useUryuLifeFlipReplacement(targetPlayer, uryu, ui)) {
                        addGameLog(`${uryu.name} kept ${card.name} on the field by flipping ${targetPlayer.name}'s top life face up.`);
                        return;
                    }

                    addGameLog(finishCharacterRemovalByOpponentEffect(actingPlayer, targetPlayer, slotIndex, sourceCard, ui));
                }
            });

            return `${targetPlayer.name} is choosing whether to use ${uryu.name}'s replacement effect.`;
        }

        if (useUryuLifeFlipReplacement(targetPlayer, uryu, ui)) {
            return `${uryu.name} kept ${card.name} on the field by flipping ${targetPlayer.name}'s top life face up.`;
        }
    }

    const sage = getAvailableSageRemovalReplacement(targetPlayer, card, actingPlayer);

    if (sage) {
        if (ui?.chooseEffectActivation) {
            ui.chooseEffectActivation({
                player: targetPlayer,
                sourceCard: sage,
                effect: sage.effects?.find(cardEffect => cardEffect.id === "EGG1-013-opponents-turn-save") || {
                    id: "EGG1-013-opponents-turn-save",
                    type: "opponentsTurn",
                    text: "Use Sage to trash 2 cards from hand instead?"
                },
                title: sage.name,
                prompt: `${card.name} would be removed by ${sourceCard.name}. Trash 2 cards from hand to keep it on the field?`,
                activateText: "Trash 2",
                skipText: "Let Remove",
                onComplete: (shouldActivate) => {
                    if (!shouldActivate) {
                        addGameLog(finishCharacterRemovalByOpponentEffect(actingPlayer, targetPlayer, slotIndex, sourceCard, ui));
                        return;
                    }

                    chooseSageReplacementTrashCards(targetPlayer, card, sage, actingPlayer, sourceCard, ui, () => {
                        addGameLog(finishCharacterRemovalByOpponentEffect(actingPlayer, targetPlayer, slotIndex, sourceCard, ui));
                    });
                }
            });

            return `${targetPlayer.name} is choosing whether to use Sage's replacement effect.`;
        }

        useSageReplacementWithCards(targetPlayer, card, sage, targetPlayer.hand.slice(0, 2), sourceCard, ui);
        return `${card.name} stayed on the field.`;
    }

    return finishCharacterRemovalByOpponentEffect(actingPlayer, targetPlayer, slotIndex, sourceCard, ui);
}

function getAvailableUryuLifeFlipReplacement(targetPlayer, actingPlayer) {
    if (!targetPlayer || !actingPlayer || targetPlayer === actingPlayer) {
        return null;
    }

    if (areOpponentReplacementEffectsNegated(targetPlayer, actingPlayer)) {
        return null;
    }

    if (gameState.currentPlayer !== actingPlayer) {
        return null;
    }

    if (!targetPlayer.life?.length) {
        return null;
    }

    if (targetPlayer.life[0]?.faceUp) {
        return null;
    }

    const effectId = "BL01-008-life-flip-replace";

    return targetPlayer.characters.find(card => {
        return card?.cardNumber === "BL01-008" &&
            !CardEffects.hasUsedOncePerTurnEffect(card, effectId, targetPlayer.turns);
    }) || null;
}

function useUryuLifeFlipReplacement(targetPlayer, uryu, ui) {
    const topLife = targetPlayer?.life?.[0];

    if (!topLife || topLife.faceUp || !uryu) {
        return false;
    }

    CardEffects.markOncePerTurnEffectUsed(uryu, "BL01-008-life-flip-replace", targetPlayer.turns);
    topLife.faceUp = true;

    if (ui?.renderLifeCards) {
        ui.renderLifeCards();
    }

    return true;
}

function finishCharacterRemovalByOpponentEffect(actingPlayer, targetPlayer, slotIndex, sourceCard, ui) {
    const card = targetPlayer?.characters?.[slotIndex];
    const targetPlayerKey = getPlayerKey(targetPlayer);

    if (!card) {
        return "No character was found in that slot.";
    }

    if (isProtectedFromOpponentEffects(card, targetPlayerKey, actingPlayer)) {
        return `${card.name} is protected from opponent effects.`;
    }

    const result = KOCharacter(targetPlayer, slotIndex, ui, {
        byEffect: true,
        actingPlayer,
        sourceCard
    });

    return `${sourceCard.name} K.O.'d ${card.name}. ${result.message}`;
}

function removeStageByOpponentEffect(actingPlayer, targetPlayer, sourceCard, ui) {
    const stage = targetPlayer?.stage;

    if (!stage) {
        return "No stage was found.";
    }

    const targetPlayerKey = getPlayerKey(targetPlayer);
    const actingPlayerKey = getPlayerKey(actingPlayer);

    if (!targetPlayerKey || !actingPlayerKey || targetPlayerKey === actingPlayerKey) {
        return "Stage removal was not caused by an opponent effect.";
    }

    const replacementEffect = areOpponentReplacementEffectsNegated(targetPlayer, actingPlayer)
        ? null
        : stage.effects?.find(effect => {
        return effect.type === "replacement" && effect.id?.includes("stage-removal-replace");
    });

    const finishRemoval = () => {
        const returnMessage = trashStageFromField(targetPlayer, stage, ui);

        return returnMessage
            ? `${sourceCard.name} removed ${stage.name}. ${returnMessage}`
            : `${sourceCard.name} removed ${stage.name}.`;
    };

    if (!replacementEffect || CardEffects.hasUsedOncePerTurnEffect(stage, replacementEffect.id, targetPlayer.turns)) {
        return finishRemoval();
    }

    const useReplacement = () => {
        CardEffects.markOncePerTurnEffectUsed(stage, replacementEffect.id, targetPlayer.turns);
        addTemporaryPowerBonus(targetPlayer.leader, -1000);

        if (ui?.renderLeaders) {
            ui.renderLeaders();
        }

        return `${stage.name} stayed in play; ${targetPlayer.name}'s leader got -1000 power this turn.`;
    };

    if (ui?.chooseEffectActivation) {
        ui.chooseEffectActivation({
            player: targetPlayer,
            sourceCard: stage,
            effect: replacementEffect,
            title: stage.name,
            prompt: `${stage.name} would be removed by ${sourceCard.name}. Give your leader -1000 power this turn instead?`,
            activateText: "Protect Stage",
            skipText: "Let Remove",
            onComplete: (shouldActivate) => {
                addGameLog(shouldActivate ? useReplacement() : finishRemoval());
            }
        });

        return `${targetPlayer.name} is choosing whether to protect ${stage.name}.`;
    }

    return useReplacement();
}

function getAvailableSageRemovalReplacement(targetPlayer, targetCard, actingPlayer) {
    if (!targetPlayer || !targetCard || !actingPlayer || targetPlayer === actingPlayer) {
        return null;
    }

    if (areOpponentReplacementEffectsNegated(targetPlayer, actingPlayer)) {
        return null;
    }

    if (!hasTypeText(targetCard, "Eggman Empire")) {
        return null;
    }

    if (gameState.currentPlayer !== actingPlayer) {
        return null;
    }

    if (targetPlayer.hand.length < 2) {
        return null;
    }

    const sage = targetPlayer.characters.find(card => card?.cardNumber === "EGG1-013");
    const effectId = "EGG1-013-opponents-turn-save";

    if (!sage || CardEffects.hasUsedOncePerTurnEffect(sage, effectId, targetPlayer.turns)) {
        return null;
    }

    return sage;
}

function chooseSageReplacementTrashCards(targetPlayer, targetCard, sage, actingPlayer, sourceCard, ui, onCancel) {
    const chosenCards = [];

    const chooseNext = () => {
        if (chosenCards.length >= 2) {
            useSageReplacementWithCards(targetPlayer, targetCard, sage, chosenCards, sourceCard, ui);
            return;
        }

        const choices = getHandCardChoices(targetPlayer, card => !chosenCards.includes(card));

        if (choices.length === 0) {
            if (typeof onCancel === "function") {
                onCancel();
            }

            return;
        }

        const message = chooseBoardCard(targetPlayer, sage, choices, {
            prompt: `Choose card ${chosenCards.length + 1} of 2 to trash for Sage.`,
            optional: true,
            onSelect: ({ card }) => {
                chosenCards.push(card);
                chooseNext();
            },
            onSkip: onCancel,
            skipMessage: `${targetPlayer.name} did not finish paying Sage's replacement cost.`,
            emptyMessage: `${sage.name} found no cards in hand to trash.`
        });

        addGameLog(message);
    };

    chooseNext();
}

function useSageReplacementWithCards(targetPlayer, targetCard, sage, cardsToTrash, sourceCard, ui) {
    const effectId = "EGG1-013-opponents-turn-save";

    if (!Array.isArray(cardsToTrash) || cardsToTrash.length < 2) {
        return false;
    }

    CardEffects.markOncePerTurnEffectUsed(sage, effectId, targetPlayer.turns);

    cardsToTrash.slice(0, 2).forEach(card => {
        const handIndex = targetPlayer.hand.indexOf(card);

        if (handIndex !== -1) {
            const trashedCard = targetPlayer.hand.splice(handIndex, 1)[0];
            moveCardToTrash(targetPlayer, trashedCard, ui);
        }
    });

    if (ui?.renderHands) {
        ui.renderHands();
    }

    if (ui?.renderTrash) {
        ui.renderTrash();
    }

    addGameLog(`${sage.name} prevented ${targetCard.name} from being removed by ${sourceCard.name}; ${targetPlayer.name} trashed 2 cards from hand.`);

    return true;
}

function getHandCardChoices(player, filter) {
    const playerKey = getPlayerKey(player);

    return player.hand
        .map((card, handIndex) => ({
            playerKey,
            cardType: "hand",
            handIndex,
            card
        }))
        .filter(choice => choice.card && (!filter || filter(choice.card, choice)));
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

    addDurationPowerBonus(
        leader,
        1000,
        Number(opponent.turns || 0) + 1,
        getPlayerKey(opponent)
    );

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
    const totalDon = getPlayerFieldDonCount(player);

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
        const returnMessage = trashStageFromField(player, oldStage, ui);

        if (returnMessage) {
            addGameLog(returnMessage);
        }
    }

    shuffleDeck(player.deck);

    ui.renderDecks();
    ui.renderStages();
    ui.renderTrash();

    return oldStage
        ? `${sourceCard.name} played ${stage.name} from the deck, replacing ${oldStage.name}, then shuffled the deck.`
        : `${sourceCard.name} played ${stage.name} from the deck, then shuffled the deck.`;
}

function getPlayerFieldDonCount(player) {
    if (!player) {
        return 0;
    }

    const attachedDon = [
        player.leader,
        ...(player.characters || []).filter(Boolean)
    ].reduce((total, card) => {
        return total + Number(card?.attachedDon || 0);
    }, 0);

    return Number(player.don || 0) + Number(player.restedDon || 0) + attachedDon;
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
            if (effect.id === "POG1-002-on-play-mark-character") {
                const message = placeOpponentCharacterWithParfum(player, card, ui);

                if (message) {
                    messages.push(message);
                }

                return;
            }

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

    if (areCardEffectsNegated(card)) {
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

function resolveOnBlockEffects(player, card, ui) {
    if (!player || !card) {
        return "";
    }

    const onBlockEffect = card.effects?.find(effect => effect.type === "onBlock");

    if (!onBlockEffect) {
        return "";
    }

    if (onBlockEffect.id === "BL01-013-on-block-minus-power") {
        return chooseOpponentCharacter(player, card, {
            prompt: "Choose up to 1 opposing character to give -1000 power this turn.",
            optional: true,
            onSelect: ({ card: targetCard }) => {
                addTemporaryPowerBonus(targetCard, -1000);
                ui.renderCharacters();
                addGameLog(`${card.name} gave ${targetCard.name} -1000 power this turn.`);
            },
            skipMessage: `${player.name} did not choose a character for ${card.name}'s On Block effect.`,
            emptyMessage: `${card.name} found no opposing characters.`
        });
    }

    return "";
}

function resolveMainEffects(player, card, ui, options = {}) {
    if (!player || !card) {
        return [];
    }

    if (card.cardType !== "event" && areCardEffectsNegated(card)) {
        return [`${card.name}'s effects are negated.`];
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

function resolveBrankoEndOfTurn(player, sourceCard, ui) {
    if (!sourceCard) {
        return "";
    }

    sourceCard.state = "active";

    if (ui?.renderCharacters) {
        ui.renderCharacters();
    }

    return `${sourceCard.name} set itself active at the end of the turn.`;
}

function resolveDavidTaglavnovicCharacterMain(player, sourceCard, ui) {
    const sourceSlotIndex = player?.characters?.findIndex(card => card?.instanceId === sourceCard?.instanceId) ?? -1;

    if (sourceSlotIndex === -1) {
        return `${sourceCard.name} is not on the field.`;
    }

    if (player.leader?.cardNumber !== "POG1-001") {
        return `${sourceCard.name}'s effect did not resolve because ${player.name}'s leader is not David Taglavnovič.`;
    }

    if (getFirstOpenCharacterSlotIndex(player) === -1) {
        return `${sourceCard.name}'s effect could not play B.R.A.N.K.O. because ${player.name}'s character area is full.`;
    }

    const opponent = getOpponentPlayer(player);
    const maxCost = getTotalDonInPlay(opponent);
    const handChoices = getHandCardChoices(player, card => card?.cardNumber === "POG1-012" && Number(card.cost ?? 0) <= maxCost);
    const trashChoices = getCharacterTrashChoices(player, card => card?.cardNumber === "POG1-012" && Number(card.cost ?? 0) <= maxCost);
    const choices = [...handChoices, ...trashChoices];

    if (choices.length === 0) {
        return `${sourceCard.name} found no B.R.A.N.K.O. in hand or trash with cost ${maxCost} or less.`;
    }

    const trashedSource = player.characters[sourceSlotIndex];
    player.characters[sourceSlotIndex] = null;
    moveCardToTrash(player, trashedSource, ui);
    resolveGutsLeaderCharacterRemovedBonus(player, ui);
    const linkedStageMessage = trashLinkedParfumStageForCharacter(player, trashedSource, ui);

    const completePlay = (choice) => {
        if (!choice) {
            addGameLog(`${player.name} trashed ${sourceCard.name} but did not choose a B.R.A.N.K.O. to play.`);
            return;
        }

        let playedCard = null;

        if (choice.cardType === "hand") {
            playedCard = player.hand.splice(choice.handIndex, 1)[0];
        } else if (choice.cardType === "trash") {
            playedCard = player.trash.splice(choice.trashIndex, 1)[0];
        }

        if (!playedCard) {
            addGameLog(`${sourceCard.name} could not find the chosen B.R.A.N.K.O..`);
            return;
        }

        const message = playCardFromDeckWithoutCost(player, sourceCard, playedCard, ui);
        addGameLog(
            linkedStageMessage
                ? `${message} ${linkedStageMessage}`
                : message
        );
    };

    if (ui?.chooseBoardCard) {
        ui.chooseBoardCard({
            player,
            sourceCard,
            prompt: `Choose up to 1 B.R.A.N.K.O. from your hand or trash with cost ${maxCost} or less to play.`,
            choices,
            optional: true,
            onComplete: completePlay
        });

        ui?.renderCharacters?.();
        ui?.renderTrash?.();
        ui?.renderHands?.();
        return `${player.name} trashed ${sourceCard.name} and is choosing a B.R.A.N.K.O. to play.`;
    }

    completePlay(choices[0]);
    return `${sourceCard.name}'s effect resolved.`;
}

function resolveMagdalenaActivateMain(player, sourceCard, ui) {
    if ((player?.trash || []).length < 2) {
        return `${sourceCard.name} needs at least 2 cards in trash.`;
    }

    return chooseCardsFromTrashToBottomOfDeck(player, sourceCard, ui, 2, {
        onComplete: () => {
            addGameLog(`${player.name} placed 2 cards from trash on the bottom of the deck with ${sourceCard.name}.`);
            const drawResult = drawCard(player, ui);

            addGameLog(
                drawResult?.deckOut
                    ? `${sourceCard.name} then caused ${player.name} to lose by deck out while drawing 1 card.`
                    : `${sourceCard.name} then drew 1 card.`
            );
        }
    });
}

function resolveMagdalenaTrigger(player, sourceCard, ui) {
    const drawResult = drawCards(player, 2, ui);

    if (drawResult?.deckOut) {
        return `${sourceCard.name}'s Trigger caused ${player.name} to lose by deck out while drawing 2 cards.`;
    }

    chooseCardsFromHandToTrash(player, sourceCard, ui, 1, () => {
        addGameLog(`${sourceCard.name}'s Trigger drew 2 cards and trashed 1 card.`);
    });

    return `${player.name} is resolving ${sourceCard.name}'s Trigger.`;
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

function KOCharacter(player, slotIndex, ui, options = {}) {
    const character = player.characters[slotIndex];

    if (!character) {
        return {
            success: false,
            message: "No character was found in that slot."
        };
    }

    if (isProtectedByDiabloRimuruEffect(character, player, options)) {
        return {
            success: false,
            message: `${character.name} is protected by its Diablo condition.`
        };
    }

    player.characters[slotIndex] = null;

    moveCardToTrash(player, character, ui);
    resolveGutsLeaderCharacterRemovedBonus(player, ui);
    const linkedStageMessage = trashLinkedParfumStageForCharacter(player, character, ui);

    const effectMessages = resolveOnKOEffects(player, character, ui);

    ui.renderLeaders();
    ui.renderCharacters();
    ui.renderTrash();

    const effectText = effectMessages.length > 0
        ? ` ${effectMessages.join(" ")}`
        : "";
    const linkedStageText = linkedStageMessage
        ? ` ${linkedStageMessage}`
        : "";

    return {
        success: true,
        message: `${character.name} was K.O.'d and placed in the trash.${linkedStageText}${effectText}`
    };
}

function isProtectedByDiabloRimuruEffect(character, player, options = {}) {
    if (!character || !player || !player.characters?.some(card => CardEffects.hasCardName(card, "Diablo"))) {
        return false;
    }

    if (options.byBattle && character.cardNumber === "RIM1-009") {
        return true;
    }

    if (options.byEffect && character.cardNumber === "RIM1-010") {
        return true;
    }

    return false;
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

        const triggerMessage = promptLifeCardTriggerChoice(
            player,
            topLifeCard,
            triggerEffects,
            ui
        );

        if (triggerMessage) {
            triggerMessages.push(triggerMessage);
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

function promptLifeCardTriggerChoice(player, card, triggerEffects, ui) {
    const hasTrigger = triggerEffects.length > 0;
    const autoSkipNoTrigger = !hasTrigger && window.isGameSettingEnabled?.("autoSkipTrigger");
    const confirmTrigger = hasTrigger && window.isGameSettingEnabled?.("confirmTrigger");
    let deferredCombatResolution = false;

    const activateTrigger = () => {
        resolveTriggerEffects(player, card, triggerEffects, ui, {
            skipChoicePrompt: true
        });
    };

    const addToHand = () => {
        player.hand.push(card);

        if (ui?.renderHands) {
            ui.renderHands();
        }

        addGameLog(`${player.name} added ${card.name} from life to hand.`);
    };

    if (autoSkipNoTrigger) {
        addToHand();
        return "";
    }

    if (ui && typeof ui.chooseEffectOption === "function") {
        if (typeof currentAttack !== "undefined" && currentAttack && typeof ui.beginDeferredCombatResolution === "function") {
            ui.beginDeferredCombatResolution();
            deferredCombatResolution = true;
        }

        ui.chooseEffectOption({
            player,
            sourceCard: card,
            title: `${card.name} Trigger`,
            prompt: hasTrigger
                ? "Choose whether to use this Trigger or add the card to your hand."
                : "This life card has no Trigger. Add it to your hand.",
            options: [
                {
                    label: "Use Trigger",
                    value: "trigger",
                    disabled: !hasTrigger,
                    requiresConfirmation: confirmTrigger,
                    confirmText: "Confirm Trigger",
                    cancelText: "Back",
                    title: hasTrigger
                        ? "Use this card's Trigger effect."
                        : "This life card has no Trigger effect."
                },
                {
                    label: "Add to Hand",
                    value: "hand",
                    secondary: true
                }
            ],
            onComplete: (choice) => {
                try {
                    if (choice === "trigger") {
                        activateTrigger();
                        return;
                    }

                    addToHand();
                } finally {
                    if (deferredCombatResolution && typeof ui.endDeferredCombatResolution === "function") {
                        ui.endDeferredCombatResolution();
                    }
                }
            }
        });

        return hasTrigger
            ? `${player.name} is choosing whether to use ${card.name}'s Trigger.`
            : `${player.name} is resolving ${card.name} from life.`;
    }

    if (hasTrigger) {
        resolveTriggerEffects(player, card, triggerEffects, ui, {
            skipChoicePrompt: true
        });
        return `${player.name} used ${card.name}'s Trigger.`;
    }

    addToHand();
    return "";
}

function resolveTriggerEffects(player, card, triggerEffects, ui, options = {}) {
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

        if (!options.skipChoicePrompt && ui && typeof ui.chooseEffectActivation === "function") {
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
            return;
        }

        activateTrigger();
    });
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
            const returnMessage = trashStageFromField(player, oldStage, ui);

            if (returnMessage) {
                addGameLog(returnMessage);
            }
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
    let returnedAttachedDon = 0;
    let refreshedLeader = 0;
    let refreshedCharacters = 0;
    let refreshedStage = 0;
    let skippedLeaderRefresh = 0;

    player.don += player.restedDon;
    player.restedDon = 0;
    returnedAttachedDon = returnAttachedDonToCostArea(player, ui, { rested: false });

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
        if (character) {
            if (character.skipNextRefresh) {
                character.skipNextRefresh = false;
            } else if (character.state === "rested") {
                character.state = "active";
                refreshedCharacters++;
            }
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
        refreshedStage,
        skippedLeaderRefresh
    };
}

function resolveEndOfTurnEffects(player, ui) {
    if (!player) {
        return [];
    }

    const results = [];

    if (player.loseAtEndOfTurnSource) {
        const sourceName = player.loseAtEndOfTurnSource;
        player.loseAtEndOfTurnSource = null;
        loseByLifeDamage(player, `${player.name} did not win before the end of the turn after resolving ${sourceName}.`);
        results.push({
            activated: true,
            message: `${player.name} lost because they did not win before the end of the turn after resolving ${sourceName}.`
        });
        return results;
    }

    const turboGrannyResult = CardEffects.resolveTurboGrannyFormEndOfTurn(player);

    if (turboGrannyResult?.message) {
        results.push(turboGrannyResult);
    }

    player.characters.forEach(character => {
        if (!character) {
            return;
        }

        getCardAllEffects(character)
            ?.filter(effect => effect.type === "endOfYourTurn")
            .forEach(effect => {
                if (effect.id === "RIM1-008-end-turn-don") {
                    const totalDon = getTotalDonInPlay(player);

                    if (totalDon === 0) {
                        const addedDon = addRestedDon(player, 2, ui);

                        results.push({
                            activated: addedDon > 0,
                            message: addedDon > 0
                                ? `${character.name}'s End of Your Turn effect added ${addedDon} rested DON!!.`
                                : `${character.name}'s End of Your Turn effect found no DON!! cards to add.`
                        });
                    }

                    return;
                }

                if (effect.id === "RIM1-011-end-turn") {
                    const otherZegion = player.characters.some(other => {
                        return other &&
                            other !== character &&
                            CardEffects.hasCardName(other, "Zegion");
                    });

                    if (otherZegion) {
                        return;
                    }

                    const finishDrawTrash = () => {
                        const drawResult = drawCards(player, 2, ui);

                        if (drawResult?.deckOut) {
                            addGameLog(`${character.name}'s End of Your Turn effect caused deck out.`);
                            return;
                        }

                        chooseCardsFromHandToTrash(player, character, ui, 1, () => {
                            addGameLog(`${character.name}'s End of Your Turn effect drew 2 cards and trashed 1 card.`);
                        });
                    };

                    const message = chooseOwnBoardCard(player, character, {
                        prompt: "Choose up to 1 of your Twelve Guardian Lords type characters to set active.",
                        optional: true,
                        includeLeader: false,
                        filter: card => card.cardType === "character" && isTwelveGuardianLordType(card),
                        onSelect: ({ card }) => {
                            card.state = "active";
                            ui.renderCharacters();
                            addGameLog(`${character.name} set ${card.name} active.`);
                            finishDrawTrash();
                        },
                        onSkip: finishDrawTrash,
                        onEmpty: finishDrawTrash,
                        skipMessage: `${player.name} did not set a character active with ${character.name}.`,
                        emptyMessage: `${character.name} found no Twelve Guardian Lords characters.`
                    });

                    results.push({
                        activated: true,
                        message
                    });

                    return;
                }

                if (effect.id === "POG1-012-end-of-your-turn") {
                    results.push({
                        activated: true,
                        message: resolveBrankoEndOfTurn(player, character, ui)
                    });
                    return;
                }

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

    clearEndOfTurnTemporaryEffects(player);

    const opponent = getOpponentOfPlayer(player);

    if (opponent) {
        clearEndOfTurnTemporaryEffects(opponent, {
            preserveDurationPower: true
        });
    }

    clearExpiredEndPhaseEffects(player);

    if (ui?.renderLeaders) {
        ui.renderLeaders();
    }

    if (ui?.renderCharacters) {
        ui.renderCharacters();
    }

    return results;
}

function clearExpiredEndPhaseEffects(expiringPlayer) {
    const expiringPlayerKey = getPlayerKey(expiringPlayer);

    if (!expiringPlayerKey) {
        return;
    }

    [gameState.player1, gameState.player2].forEach(player => {
        const cards = [
            player.leader,
            ...player.characters.filter(Boolean),
            player.stage
        ].filter(Boolean);

        cards.forEach(card => {
            if (
                card.cannotAttackUntil?.expiresAtPlayerKey === expiringPlayerKey &&
                Number(card.cannotAttackUntil.expiresAtEndOfTurns ?? 0) <= Number(expiringPlayer.turns || 0)
            ) {
                card.cannotAttackUntil = null;
            }

            if (
                card.temporaryBasePower?.expiresAtPlayerKey === expiringPlayerKey &&
                Number(card.temporaryBasePower.expiresAtEndOfTurns ?? 0) <= Number(expiringPlayer.turns || 0)
            ) {
                card.temporaryBasePower = null;
            }
        });
    });
}

function returnAttachedDonToCostArea(player, ui, options = {}) {
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

    if (options.rested === false) {
        player.don += returnedDon;
    } else {
        player.restedDon += returnedDon;
    }

    if (returnedDon > 0) {
        ui.updateDonDisplay();
        ui.renderLeaders();
        ui.renderCharacters();
    }

    return returnedDon;
}

function detachAttachedDonToCostArea(player, card, ui) {
    if (!player || !card) {
        return 0;
    }

    const returnedDon = Number(card.attachedDon || 0);

    if (returnedDon <= 0) {
        return 0;
    }

    card.attachedDon = 0;
    player.restedDon += returnedDon;

    if (ui?.updateDonDisplay) {
        ui.updateDonDisplay();
    }

    if (ui?.renderLeaders) {
        ui.renderLeaders();
    }

    if (ui?.renderCharacters) {
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
        card.temporaryCopiedEffects = [];
        card.battleKeywords = [];
        card.battlePowerBonus = 0;
        card.temporaryPowerBonus = 0;
        card.costModifiers = [];
        card.protectedFromOpponentEffects = false;

        if (!options.preserveDurationPower && Array.isArray(card.durationPowerBonuses)) {
            const expiringPlayerKey = getPlayerKey(player);

            card.durationPowerBonuses = card.durationPowerBonuses.filter(entry => {
                if (entry.expiresAtPlayerKey && entry.expiresAtPlayerKey !== expiringPlayerKey) {
                    return true;
                }

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

    const returnedDon = card.cardType === "character"
        ? detachAttachedDonToCostArea(player, card, ui)
        : 0;

    if (returnedDon > 0) {
        addGameLog(`${returnedDon} attached DON!! returned to ${player.name}'s cost area rested.`);
    }

    card.uiAnimation = card.uiAnimation || "trashed";
    player.trash.push(card);

    if (ui.renderTrash) {
        ui.renderTrash();
    }
}
