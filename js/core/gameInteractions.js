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
    return Math.max(0, Number(card.cost ?? card.playCost ?? 0));
}

function getCardEffectiveCost(card) {
    if (!card) {
        return 0;
    }

    const printedCost = Number(card.cost ?? card.playCost ?? 0);
    const owner = typeof getPlayerForBoardCard === "function"
        ? getPlayerForBoardCard(card)
        : null;
    const isOnBoard = Boolean(owner && (
        owner.leader === card ||
        owner.stage === card ||
        owner.characters?.includes(card)
    ));
    let modifier = card.costModifiers
        ?.reduce((total, entry) => total + Number(entry.amount ?? 0), 0) ?? 0;

    if (card.cardNumber === "OP16-082" && !areCardEffectsNegated(card)) {
        if (isOnBoard) {
            modifier += 3;
        }
    }

    if (card.cardType === "character" && isOnBoard && owner) {
        const opponent = getOpponentOfPlayer(owner);
        const kurourushiCount = opponent?.characters?.filter(boardCard => {
            return boardCard?.cardNumber === "JK02-020" && !areCardEffectsNegated(boardCard);
        }).length ?? 0;

        if (kurourushiCount > 0) {
            modifier -= 3 * kurourushiCount;
        }
    }

    return Math.max(0, printedCost + modifier);
}

function canPlayerAffordCard(player, card) {
    const cardCost = getCardPlayCost(card, player);

    return player.don >= cardCost;
}

function doesHanamiLeaderPlayCharactersRested(player) {
    const leader = player?.leader;

    return Boolean(
        leader &&
        leader.cardNumber === "JK02-001" &&
        !areCardEffectsNegated(leader)
    );
}

function getPlayedCharacterInitialState(player, preferredState = "active") {
    if (preferredState === "rested") {
        return "rested";
    }

    return doesHanamiLeaderPlayCharactersRested(player)
        ? "rested"
        : "active";
}

function getMainPhaseEventEffects(card) {
    return card?.effects?.filter(effect => {
        return effect.type === "main" ||
            (card.cardType === "event" && effect.type === "onPlay");
    }) ?? [];
}

function canPlayEventInMainPhase(card) {
    return card?.cardType === "event" && getMainPhaseEventEffects(card).length > 0;
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

function canPlayStageToArea(player, incomingStage = null) {
    if (!player?.stage) {
        return true;
    }

    if (!incomingStage) {
        return false;
    }

    return !(isParfumStage(player.stage) && isParfumStage(incomingStage));
}

function replaceStageOnFieldIfNeeded(player, incomingStage, ui) {
    if (!player?.stage) {
        return "";
    }

    if (!canPlayStageToArea(player, incomingStage)) {
        return `${player.name} cannot play ${incomingStage?.name || "that stage"} because Parfum is already in play.`;
    }

    const replacedStage = player.stage;
    const replacementMessage = trashStageFromField(player, replacedStage, ui);

    return replacementMessage
        ? `${player.name} trashed ${replacedStage.name} to play ${incomingStage.name}. ${replacementMessage}`
        : `${player.name} trashed ${replacedStage.name} to play ${incomingStage.name}.`;
}

function lockCardForNextRefresh(card) {
    if (!card) {
        return;
    }

    card.skipNextRefresh = true;
}

function chooseTrashCard(player, sourceCard, ui, options = {}) {
    return chooseBoardCard(
        player,
        sourceCard,
        getTrashCardChoices(player, options.filter),
        {
            ...options,
            filter: null,
            prompt: options.prompt || "Choose a card from your trash.",
            optional: options.optional !== false,
            skipMessage: options.skipMessage || `${player.name} did not choose a trash card for ${sourceCard.name}.`,
            emptyMessage: options.emptyMessage || `${sourceCard.name} found no valid cards in trash.`
        }
    );
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

    if (ui?.chooseNumberValue) {
        ui.chooseNumberValue({
            player,
            sourceCard,
            title: sourceCard.name,
            prompt: "Declare a cost from 0 to 10.",
            min: 0,
            max: 10,
            initialValue: 0,
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

function resolveDrawOneTrashOne(player, sourceCard, ui, options = {}) {
    const finish = (...args) => {
        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }

        options.onComplete?.(...args);
    };

    const drawResult = drawCard(player, ui);

    if (drawResult?.deckOut) {
        finish();
        return `${sourceCard.name}'s effect tried to draw 1 card, but ${player.name} lost by deck out.`;
    }

    if (player.hand.length === 0) {
        finish();
        return `${sourceCard.name}'s effect drew 1 card, but found no card in hand to trash.`;
    }

    const chooseMessage = chooseHandCard(player, sourceCard, {
        prompt: options.prompt || `Choose 1 card from your hand to trash for ${sourceCard.name}.`,
        optional: false,
        onSelect: ({ card }) => {
            const handIndex = player.hand.indexOf(card);

            if (handIndex === -1) {
                addGameLog(`${sourceCard.name} could not find that hand card to trash.`);
                finish();
                return;
            }

            const trashedCard = player.hand.splice(handIndex, 1)[0];
            moveCardToTrash(player, trashedCard, ui);
            ui?.renderHands?.();
            ui?.renderTrash?.();
            addGameLog(`${player.name} trashed ${trashedCard.name} for ${sourceCard.name}.`);
            finish(trashedCard);
        },
        emptyMessage: `${sourceCard.name}'s effect found no cards in hand to trash.`
    });

    return chooseMessage
        ? `${sourceCard.name}'s effect drew 1 card. ${chooseMessage}`
        : `${sourceCard.name}'s effect drew 1 card.`;
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

    const chooseSharedPlacementZone = () => {
        if (!options.sameZoneForAll) {
            finishPlacement();
            return;
        }

        const placeCards = (zone) => {
            if (zone === "top") {
                topCards.push(...selectedCards);
            } else {
                bottomCards.push(...selectedCards);
            }

            finishPlacement();
        };

        if (!ui?.chooseEffectOption) {
            placeCards("bottom");
            return;
        }

        ui.chooseEffectOption({
            player,
            sourceCard,
            title: sourceCard.name,
            prompt: `Place all ${selectedCards.length} selected card${selectedCards.length === 1 ? "" : "s"} on the top or bottom of your deck?`,
            options: [
                { label: "Top", value: "top" },
                { label: "Bottom", value: "bottom", secondary: true }
            ],
            onComplete: (zone) => {
                placeCards(zone === "top" ? "top" : "bottom");
            }
        });
    };

    const choosePlacementZone = (card) => {
        if (!ui?.chooseEffectOption) {
            bottomCards.push(card);
            chooseNextCard();
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
            chooseSharedPlacementZone();
            return;
        }

        const remainingChoices = getHandCardChoices(player, card => !selectedCards.includes(card));

        if (remainingChoices.length === 0) {
            chooseSharedPlacementZone();
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

                if (options.sameZoneForAll) {
                    chooseNextCard();
                    return;
                }

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

function playCardFromDeckWithoutCost(player, sourceCard, card, ui, sourceZoneLabel = "deck") {
    if (!player || !card) {
        return `${sourceCard.name} could not play that card from the ${sourceZoneLabel}.`;
    }

    if (card.cardType === "character") {
        const slotIndex = getFirstOpenCharacterSlotIndex(player);

        if (slotIndex === -1) {
            return `${sourceCard.name} found ${card.name}, but ${player.name}'s character area is full.`;
        }

        card.state = getPlayedCharacterInitialState(player);
        card.playedOnTurn = player.turns;
        card.playedFromZone = sourceZoneLabel;
        card.uiAnimation = "played";
        player.characters[slotIndex] = card;

        const effectMessages = resolveOnPlayEffects(player, card, ui);

        ui?.renderCharacters?.();
        return effectMessages.length > 0
            ? `${sourceCard.name} played ${card.name} from the ${sourceZoneLabel}${card.state === "rested" ? " rested" : ""}. ${effectMessages.join(" ")}`
            : `${sourceCard.name} played ${card.name} from the ${sourceZoneLabel}${card.state === "rested" ? " rested" : ""}.`;
    }

    if (card.cardType === "stage") {
        if (!canPlayStageToArea(player, card)) {
            return `${sourceCard.name} could not play ${card.name} from the ${sourceZoneLabel} because Parfum is already in play.`;
        }

        const replacementMessage = replaceStageOnFieldIfNeeded(player, card, ui);

        card.state = getPlayedCharacterInitialState(player);
        card.uiAnimation = "played";
        player.stage = card;

        const effectMessages = resolveOnPlayEffects(player, card, ui);

        ui?.renderStages?.();

        const playMessage = effectMessages.length > 0
            ? `${sourceCard.name} played ${card.name} from the ${sourceZoneLabel}. ${effectMessages.join(" ")}`
            : `${sourceCard.name} played ${card.name} from the ${sourceZoneLabel}.`;

        return replacementMessage
            ? `${replacementMessage} ${playMessage}`
            : playMessage;
    }

    if (card.cardType === "event") {
        const effectMessages = resolveMainEffects(player, card, ui, {
            skipActivationPrompt: true
        });

        moveCardToTrash(player, card, ui);

        return effectMessages.length > 0
            ? `${sourceCard.name} played ${card.name} from the ${sourceZoneLabel}. ${effectMessages.join(" ")}`
            : `${sourceCard.name} played ${card.name} from the ${sourceZoneLabel}.`;
    }

    return `${sourceCard.name} found ${card.name}, but that card type cannot be played from the ${sourceZoneLabel}.`;
}

function playCharacterFromTrashWithoutCost(player, sourceCard, card, ui, options = {}) {
    if (!player || !card) {
        return `${sourceCard.name} could not play that character from the trash.`;
    }

    const slotIndex = getFirstOpenCharacterSlotIndex(player);

    if (slotIndex === -1) {
        return `${sourceCard.name} could not play ${card.name} from the trash because ${player.name}'s character area is full.`;
    }

    card.state = getPlayedCharacterInitialState(
        player,
        options.rested === true ? "rested" : "active"
    );
    card.playedOnTurn = player.turns;
    card.playedFromZone = options.sourceZoneLabel || "trash";
    card.uiAnimation = "played";
    player.characters[slotIndex] = card;

    const effectMessages = resolveOnPlayEffects(player, card, ui);

    ui?.renderCharacters?.();

    return effectMessages.length > 0
        ? `${sourceCard.name} played ${card.name} from the trash${card.state === "rested" ? " rested" : ""}. ${effectMessages.join(" ")}`
        : `${sourceCard.name} played ${card.name} from the trash${card.state === "rested" ? " rested" : ""}.`;
}

function playUpToOneNamedCharacterFromHandOrTrash(player, sourceCard, ui, cardName) {
    if (!player || !sourceCard) {
        return "";
    }

    if (getFirstOpenCharacterSlotIndex(player) === -1) {
        return `${sourceCard.name} could not play ${cardName} because ${player.name}'s character area is full.`;
    }

    const handChoices = getHandCardChoices(player, card => {
        return card.cardType === "character" && CardEffects.hasCardName(card, cardName);
    }).map(choice => ({
        ...choice,
        choiceLabel: "Hand"
    }));

    const trashChoices = getTrashCardChoices(player, card => {
        return card.cardType === "character" && CardEffects.hasCardName(card, cardName);
    }).map(choice => ({
        ...choice,
        choiceLabel: "Trash"
    }));

    const choices = [...handChoices, ...trashChoices];

    if (choices.length === 0) {
        return `${sourceCard.name} found no ${cardName} in hand or trash to play.`;
    }

    return chooseBoardCard(player, sourceCard, choices, {
        prompt: `Choose up to 1 ${cardName} from your hand or trash to play.`,
        optional: true,
        onSelect: ({ cardType, handIndex, trashIndex }) => {
            if (cardType === "hand") {
                const playedCard = player.hand.splice(handIndex, 1)[0];

                if (!playedCard) {
                    addGameLog(`${sourceCard.name} could not find that ${cardName} in hand anymore.`);
                    return;
                }

                addGameLog(playCardFromDeckWithoutCost(player, sourceCard, playedCard, ui, "hand"));
            } else {
                const playedCard = player.trash.splice(trashIndex, 1)[0];

                if (!playedCard) {
                    addGameLog(`${sourceCard.name} could not find that ${cardName} in trash anymore.`);
                    return;
                }

                addGameLog(playCharacterFromTrashWithoutCost(player, sourceCard, playedCard, ui));
            }

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }
        },
        skipMessage: `${player.name} did not play ${cardName} with ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no ${cardName} in hand or trash to play.`
    });
}

function resolveJeremicOnPlay(player, sourceCard, ui) {
    const deckCards = player.deck.filter(Boolean);

    if (deckCards.length === 0) {
        shuffleDeck(player.deck);
        ui?.renderDecks?.();
        return `${sourceCard.name} found no cards in ${player.name}'s deck.`;
    }

    const finishDeclaration = (declaredName) => {
        const normalizedDeclaredName = CardEffects.normalizeCardName(declaredName || "");

        if (!normalizedDeclaredName) {
            shuffleDeck(player.deck);
            ui?.renderDecks?.();
            addGameLog(`${player.name} did not declare a card name for ${sourceCard.name}. The deck was shuffled.`);
            return;
        }

        const deckIndex = player.deck.findIndex(card => {
            return CardEffects.hasCardName(card, normalizedDeclaredName);
        });

        if (deckIndex === -1) {
            shuffleDeck(player.deck);
            ui?.renderDecks?.();
            addGameLog(`${sourceCard.name} declared "${declaredName}", but no matching card was found before the shuffle.`);
            return;
        }

        const chosenCard = player.deck[deckIndex];

        if (chosenCard?.cardType === "stage" && !canPlayStageToArea(player, chosenCard)) {
            shuffleDeck(player.deck);
            ui?.renderDecks?.();
            addGameLog(`${sourceCard.name} found ${chosenCard.name}, but Parfum is already in play. The deck was shuffled.`);
            return;
        }

        const playedCard = player.deck.splice(deckIndex, 1)[0];
        const message = playCardFromDeckWithoutCost(player, sourceCard, playedCard, ui, "deck");

        shuffleDeck(player.deck);
        ui?.renderDecks?.();
        addGameLog(`${message} ${player.name} then shuffled the deck.`);
    };

    if (typeof window !== "undefined" && typeof window.prompt === "function") {
        const declaredName = window.prompt(
            `${sourceCard.name}: declare a card name to play from your deck.`,
            ""
        );
        finishDeclaration(declaredName);
        return `${sourceCard.name}'s effect resolved.`;
    }

    finishDeclaration(deckCards[0].name);
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

function resolveSigmaDeckChoiceEffect(player, sourceCard, ui) {
    const validDeckChoices = (player?.deck || [])
        .map((card, index) => ({ card, index }))
        .filter(entry => {
            return entry.card?.cardNumber === "POG1-008" || entry.card?.cardNumber === "POG1-010";
        });

    if (validDeckChoices.length === 0) {
        return `${sourceCard.name} found no valid Klobuk or Manifestirana žoga cards in ${player.name}'s deck.`;
    }

    const finishSelection = (selectedIndex) => {
        const choice = validDeckChoices.find(entry => entry.index === Number(selectedIndex));

        if (!choice) {
            addGameLog(`${player.name} did not choose a valid card for ${sourceCard.name}.`);
            return;
        }

        const revealedCard = player.deck.splice(choice.index, 1)[0];

        if (!revealedCard) {
            addGameLog(`${sourceCard.name} could not find the chosen card in ${player.name}'s deck.`);
            return;
        }

        const finishTrash = () => {
            moveCardToTrash(player, revealedCard, ui);
            ui?.renderDecks?.();
            ui?.renderTrash?.();
            addGameLog(`${sourceCard.name} trashed ${revealedCard.name} after revealing it.`);
        };

        const powerMessage = chooseOwnBoardCard(player, sourceCard, {
            prompt: `Choose up to 1 of your leader or characters to give +2000 power this turn after choosing ${revealedCard.name}.`,
            optional: true,
            includeLeader: true,
            filter: card => card.cardType === "leader" || card.cardType === "character",
            onSelect: ({ card }) => {
                addTemporaryPowerBonus(card, 2000);
                ui?.renderLeaders?.();
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} chose ${revealedCard.name} and gave ${card.name} +2000 power this turn.`);
                finishTrash();
            },
            onSkip: finishTrash,
            onEmpty: finishTrash,
            skipMessage: `${player.name} did not choose a card to power up with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no leader or character to give +2000 power.`
        });

        if (powerMessage) {
            addGameLog(powerMessage);
        }
    };

    if (ui?.chooseEffectOption) {
        ui.chooseEffectOption({
            player,
            sourceCard,
            title: sourceCard.name,
            prompt: "Choose a Klobuk or Manifestirana žoga from your deck.",
            options: validDeckChoices.map(entry => ({
                label: entry.card.name,
                value: entry.index
            })),
            onComplete: finishSelection
        });

        return `${player.name} is choosing a card from the deck for ${sourceCard.name}.`;
    }

    finishSelection(validDeckChoices[0].index);
    return `${sourceCard.name}'s effect resolved.`;
}

function clearParfumControlState(character) {
    if (!character) {
        return;
    }

    character.parfumControl = null;
    character.ignorePlayedThisTurnCheck = false;
}

function getParfumOriginalOwner(character) {
    const ownerKey = character?.parfumControl?.originalOwnerPlayerKey;

    return ownerKey ? gameState?.[ownerKey] || null : null;
}

function getCardZoneDestinationPlayer(player, card) {
    return getParfumOriginalOwner(card) || player;
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

    if (options.isKO) {
        resolveOnKOEffects(player, stageCard, ui).forEach(message => {
            if (message) {
                addGameLog(message);
            }
        });
    }

    return returnMessage;
}

function koStageFromField(player, stage, ui, options = {}) {
    return trashStageFromField(player, stage, ui, {
        ...options,
        isKO: true
    });
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

function trashTopCardsOfDeck(player, amount, uiInstance = ui) {
    const trashedCards = [];

    if (!player || amount <= 0) {
        return {
            success: false,
            trashedCards,
            message: "No cards were trashed from the deck."
        };
    }

    for (let index = 0; index < amount; index++) {
        const topCard = player.deck.shift();

        if (!topCard) {
            break;
        }

        const trashedCard = assignCardInstance(topCard);
        moveCardToTrash(player, trashedCard, uiInstance);
        trashedCards.push(trashedCard);

        if (typeof resolveWhenTrashedFromDeckEffects === "function") {
            resolveWhenTrashedFromDeckEffects(player, trashedCard, uiInstance);
        }
    }

    uiInstance?.renderDecks?.();
    uiInstance?.renderTrash?.();

    return {
        success: trashedCards.length > 0,
        trashedCards,
        message: trashedCards.length > 0
            ? `${player.name} trashed ${trashedCards.length} card${trashedCards.length === 1 ? "" : "s"} from the top of the deck.`
            : `${player.name} had no cards in deck to trash.`
    };
}

function resolveWhenTrashedFromDeckEffects(player, card, ui) {
    if (!player || !card || areCardEffectsNegated(card)) {
        return [];
    }

    const messages = [];

    getCardAllEffects(card)
        ?.filter(effect => effect.type === "whenTrashedFromDeck")
        .forEach(effect => {
            if (effect.id === "KIL1-002-when-trashed-from-deck") {
                const slotIndex = getFirstOpenCharacterSlotIndex(player);

                if (slotIndex === -1) {
                    messages.push(`${card.name} was trashed from deck, but ${player.name}'s character area is full.`);
                    return;
                }

                const trashIndex = player.trash.findIndex(trashCard => trashCard?.instanceId === card.instanceId);

                if (trashIndex === -1) {
                    messages.push(`${card.name} was trashed from deck, but could not be found in trash.`);
                    return;
                }

                const playedCard = player.trash.splice(trashIndex, 1)[0];
                const playMessage = playCharacterFromTrashWithoutCost(player, card, playedCard, ui, {
                    sourceZoneLabel: "deck"
                });
                messages.push(playMessage);
                addGameLog(`${card.name}'s When Trashed From Deck effect activated. ${playMessage}`);
                return;
            }

            const message = resolveEffectAction(player, card, effect, ui, {
                skipActivationPrompt: true,
                trashedFromDeck: true
            });

            if (message) {
                messages.push(message);
                addGameLog(message);
            }
        });

    return messages;
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

function drawCardFromBottom(player, uiInstance = ui) {
    const card = player.deck.pop();

    if (!card) {
        console.log(`${player.name} has no cards left in deck.`);
        return loseByDeckOut(player, `${player.name} tried to draw from the bottom of an empty deck.`);
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
                effect.actionId === "leaderCounterPower" ||
                effect.id === "IMU1-011-counter"
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

    if (effect.id === "IMU1-011-counter") {
        return player.leader?.cardNumber === "IMU1-001" &&
            (player.deck?.length || 0) >= 1 &&
            Boolean(player.leader);
    }

    if (effect.id === "SUB1-011-counter") {
        const handCardsAvailable = player.hand.some(handCard => handCard?.instanceId === card.instanceId)
            ? player.hand.length - 1
            : player.hand.length;

        return handCardsAvailable > 0;
    }

    const higurumaCounterPowerLimits = {
        "JK01-002-counter": 7000,
        "JK01-003-counter": 7000,
        "JK01-004-counter": 10000,
        "JK01-005-counter": 12000
    };
    const higurumaPowerLimit = higurumaCounterPowerLimits[effect.id];

    if (higurumaPowerLimit) {
        if (typeof currentAttack === "undefined" || !currentAttack) {
            return false;
        }

        const attackerPlayer = gameState?.[currentAttack.attackerPlayerKey];
        const attackerCard = getBoardCardFromData(currentAttack.attacker);

        if (!attackerPlayer || !attackerCard) {
            return false;
        }

        return getCardBattlePower(attackerCard, attackerPlayer) <= higurumaPowerLimit;
    }

    if (effect.id === "POG1-014-counter") {
        return true;
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

    if (effect.id === "JK02-002-counter") {
        if (typeof currentAttack === "undefined" || !currentAttack) {
            return false;
        }

        return currentAttack.target?.cardType === "leader" &&
            currentAttack.target?.playerKey === getPlayerKey(player);
    }

    return Boolean(effect.actionId) ||
        Number(effect.powerModifier ?? 0) > 0 ||
        /during\s+this\s+battle/i.test(String(effect.text || ""));
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

function getHandCounterEventCost(card, player) {
    if (!card || card.cardType !== "event") {
        return 0;
    }

    return getCardPlayCost(card, player);
}

function canCardBeUsedAsCounter(card, player = null) {
    if (card?.cardType === "event" && player && player.don < getHandCounterEventCost(card, player)) {
        return false;
    }

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

    const counterCost = getHandCounterEventCost(card, player);

    if (counterCost > 0 && !restDonForCost(player, counterCost, ui)) {
        return {
            success: false,
            counterPower: 0,
            message: `${player.name} does not have enough active DON!! to use ${card.name} as a Counter.`
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

    playedCard.state = getPlayedCharacterInitialState(player);
    playedCard.playedOnTurn = player.turns;
    playedCard.playedFromZone = "hand";
    playedCard.uiAnimation = "played";

    player.characters[slotIndex] = playedCard;

    if (replacedCard) {
        const trashResult = trashCharacterFromField(player, null, ui, {
            character: replacedCard,
            render: false
        });
        const linkedStageMessage = trashResult.linkedStageMessage;

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
            : `${player.name} played ${playedCard.name} in character slot ${slotIndex + 1}${playedCard.state === "rested" ? " rested" : ""}.${effectText}`
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

    if (!canPlayStageToArea(player, card)) {
        return {
            success: false,
            message: `${player.name} cannot play ${card.name} because Parfum is already in play.`
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

    const playedStage = player.hand.splice(handIndex, 1)[0];
    const replacementMessage = replaceStageOnFieldIfNeeded(player, playedStage, ui);

    playedStage.state = "active";
    playedStage.uiAnimation = "played";
    player.stage = playedStage;

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
        message: replacementMessage
            ? `${replacementMessage} ${player.name} played ${playedStage.name} to the stage area.${effectText}`
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
        onOpponentsAttack: "On Opponent Attack",
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

function addCardToLife(player, card, ui, options = {}) {
    if (!player || !card) {
        return false;
    }

    card.faceUp = Boolean(options.faceUp);

    if (options.position === "bottom") {
        player.life.push(card);
    } else {
        player.life.unshift(card);
    }

    markLifeCardAdded(player);

    if (options.render !== false) {
        ui?.renderLifeCards?.();
    }

    if (typeof queueMultiplayerStateSync === "function") {
        queueMultiplayerStateSync();
    }

    return true;
}

function canCardBeRested(card) {
    if (!card?.cannotBeRestedUntil) {
        return true;
    }

    const owner = getPlayerForBoardCard(card);
    const ownerKey = owner
        ? getPlayerKey(owner)
        : null;

    if (!owner || !ownerKey) {
        return true;
    }

    if (card.cannotBeRestedUntil.expiresAtPlayerKey !== ownerKey) {
        return true;
    }

    return Number(owner.turns || 0) > Number(card.cannotBeRestedUntil.expiresAtEndOfTurns ?? 0);
}

function setCardRested(card) {
    if (!card || !canCardBeRested(card)) {
        return false;
    }

    card.uiAnimation = "rested";
    card.state = "rested";

    ui?.renderLeaders?.();
    ui?.renderCharacters?.();
    ui?.renderStages?.();

    return true;
}

function applyCannotBeRestedUntil(card, expiresAtEndOfTurns, expiresAtPlayerKey) {
    if (!card) {
        return;
    }

    card.cannotBeRestedUntil = {
        expiresAtEndOfTurns: Number(expiresAtEndOfTurns ?? 0),
        expiresAtPlayerKey
    };
}

function isMulticoloredCard(card) {
    const color = card?.color;

    if (Array.isArray(color)) {
        return color.filter(Boolean).length > 1;
    }

    if (typeof color !== "string") {
        return false;
    }

    return color.split("/").map(entry => entry.trim()).filter(Boolean).length > 1;
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

    if (effect.id === "SUB1-008-on-play-checkpoint") {
        return saveSubaruCheckpointState(player, sourceCard, ui);
    }

    if (effect.id === "SUB1-002-on-play-life") {
        if ((player.life?.length || 0) > 2) {
            return `${sourceCard.name}'s On Play effect did not resolve because ${player.name} has more than 2 life cards.`;
        }

        const topDeckCard = player.deck.shift();

        if (!topDeckCard) {
            return `${sourceCard.name}'s On Play effect found no card in deck to add to life.`;
        }

        addCardToLife(player, topDeckCard, ui);
        ui?.renderDecks?.();
        return `${sourceCard.name}'s On Play effect added the top card of the deck to life.`;
    }

    if (effect.id === "SUB1-004-on-play-rush") {
        if (!player.life?.length) {
            return `${sourceCard.name}'s On Play effect found no life card to reveal.`;
        }

        if (player.hand.length === 0) {
            return `${sourceCard.name}'s On Play effect found no card in hand to trash.`;
        }

        return chooseHandCard(player, sourceCard, {
            prompt: `Choose 1 card from your hand to trash for ${sourceCard.name}.`,
            optional: false,
            onSelect: ({ handIndex, card }) => {
                const trashedCard = player.hand.splice(handIndex, 1)[0];

                if (!trashedCard) {
                    addGameLog(`${sourceCard.name} could not find that hand card to trash.`);
                    return;
                }

                moveCardToTrash(player, trashedCard, ui);
                ui?.renderHands?.();
                ui?.renderTrash?.();
                addGameLog(`${player.name} trashed ${card.name} for ${sourceCard.name}.`);

                const revealMessage = revealSubaruLifeCard(player, sourceCard, ui);

                if (revealMessage) {
                    addGameLog(revealMessage);
                }

                addTemporaryKeyword(sourceCard, "rush");
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} gained Rush this turn.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            emptyMessage: `${sourceCard.name} found no card in hand to trash.`
        });
    }

    if (effect.id === "SUB1-005-on-play-life-rush") {
        const topDeckCard = player.deck.shift();

        if (!topDeckCard) {
            return `${sourceCard.name}'s On Play effect found no card in deck to add to life.`;
        }

        addCardToLife(player, topDeckCard, ui);
        addTemporaryKeyword(sourceCard, "rushCharacters");
        ui?.renderDecks?.();
        ui?.renderCharacters?.();
        return `${sourceCard.name}'s On Play effect added the top card of the deck to life and gave it Character Rush this turn.`;
    }

    if (effect.id === "SUB1-005-trigger-draw-trash") {
        return resolveDrawTwoTrashOne(player, sourceCard, ui);
    }

    if (effect.id === "SUB1-006-on-play-search") {
        return lookTopCardsForType(player, sourceCard, 5, "RE:ZERO", ui);
    }

    if (effect.id === "SUB1-013-on-play-search-two") {
        const waitsForLifeChoice = Boolean(
            player.life?.length > 1 &&
            (ui?.chooseLifeCard || ui?.chooseBoardCard)
        );
        let searchStarted = false;
        const startSearch = (shouldLogMessage = false) => {
            if (searchStarted) {
                return "";
            }

            searchStarted = true;

            const searchMessage = lookTopCardsForTypeAddUpTo(player, sourceCard, 5, 2, "RE:ZERO", ui);

            if (shouldLogMessage && searchMessage) {
                addGameLog(searchMessage);
            }

            return searchMessage;
        };

        const revealMessage = revealSubaruLifeCard(player, sourceCard, ui, {
            allowAnyChoice: true,
            prompt: `Choose which life card to flip for ${sourceCard.name} before searching.`,
            onComplete: () => {
                if (waitsForLifeChoice) {
                    startSearch(true);
                }
            }
        });

        if (revealMessage) {
            addGameLog(revealMessage);
        }

        if (waitsForLifeChoice) {
            return revealMessage || `${player.name} is choosing a life card to flip for ${sourceCard.name}.`;
        }

        const searchMessage = startSearch();
        return `${revealMessage || ""} ${searchMessage}`.trim();
    }

    if (effect.id === "SUB1-014-on-play-play-ram") {
        return playUpToOneNamedCharacterFromHandOrTrash(player, sourceCard, ui, "Ram");
    }

    if (effect.id === "SUB1-007-on-play-stage-copy") {
        return resolveEchidnaStageCopy(player, sourceCard, ui).message;
    }

    if (effect.id === "SUB1-011-counter") {
        if (player.hand.length === 0) {
            return `${sourceCard.name}'s Counter found no card in hand to trash.`;
        }

        return chooseHandCard(player, sourceCard, {
            prompt: `Choose 1 card from your hand to trash for ${sourceCard.name}.`,
            optional: false,
            onSelect: ({ handIndex, card }) => {
                const trashedCard = player.hand.splice(handIndex, 1)[0];

                if (!trashedCard) {
                    addGameLog(`${sourceCard.name} could not find that hand card to trash.`);
                    return;
                }

                moveCardToTrash(player, trashedCard, ui);
                ui?.renderHands?.();
                ui?.renderTrash?.();
                addGameLog(`${player.name} trashed ${card.name} for ${sourceCard.name}.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            emptyMessage: `${sourceCard.name} found no card in hand to trash.`
        });
    }

    if (effect.id === "SUB1-011-trigger") {
        if ((player.life?.length || 0) !== 0) {
            return `${sourceCard.name}'s Trigger did not resolve because ${player.name} does not have 0 life cards.`;
        }

        const topDeckCard = player.deck.shift();

        if (topDeckCard) {
            addCardToLife(player, topDeckCard, ui);
            ui?.renderDecks?.();
            addGameLog(`${sourceCard.name} added the top card of the deck to life.`);
        } else {
            addGameLog(`${sourceCard.name} found no card in deck to add to life.`);
        }

        if (player.hand.length === 0) {
            return `${sourceCard.name}'s Trigger added a card to life, but found no card in hand to trash.`;
        }

        return chooseHandCard(player, sourceCard, {
            prompt: `Choose 1 card from your hand to trash for ${sourceCard.name}.`,
            optional: false,
            onSelect: ({ handIndex, card }) => {
                const trashedCard = player.hand.splice(handIndex, 1)[0];

                if (!trashedCard) {
                    addGameLog(`${sourceCard.name} could not find that hand card to trash.`);
                    return;
                }

                moveCardToTrash(player, trashedCard, ui);
                ui?.renderHands?.();
                ui?.renderTrash?.();
                addGameLog(`${player.name} trashed ${card.name} for ${sourceCard.name}.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            emptyMessage: `${sourceCard.name} found no card in hand to trash.`
        });
    }

    if (effect.id === "SUB1-012-on-play-search-emilia") {
        const trashedLifeResult = trashTopLifeCard(player, sourceCard, ui);

        if (!trashedLifeResult.success) {
            return trashedLifeResult.message;
        }

        addGameLog(trashedLifeResult.message);

        const searchMessage = lookTopCardsForType(player, sourceCard, 6, "RE:ZERO", ui, {
            onResolved: () => {
                if (getFirstOpenCharacterSlotIndex(player) === -1) {
                    addGameLog(`${sourceCard.name} could not play Emilia because ${player.name}'s character area is full.`);
                    return;
                }

                const emiliaChoices = getHandCardChoices(player, card => CardEffects.hasCardName(card, "Emilia"));

                if (emiliaChoices.length === 0) {
                    addGameLog(`${sourceCard.name} found no Emilia in hand to play.`);
                    return;
                }

                const chooseMessage = chooseHandCard(player, sourceCard, {
                    prompt: "Choose up to 1 Emilia from your hand to play.",
                    optional: true,
                    filter: card => CardEffects.hasCardName(card, "Emilia"),
                    onSelect: ({ handIndex }) => {
                        const playedCard = player.hand.splice(handIndex, 1)[0];

                        if (!playedCard) {
                            addGameLog(`${sourceCard.name} could not find that Emilia in hand.`);
                            return;
                        }

                        addGameLog(playCardFromDeckWithoutCost(player, sourceCard, playedCard, ui, "hand"));

                        if (typeof queueMultiplayerStateSync === "function") {
                            queueMultiplayerStateSync();
                        }
                    },
                    skipMessage: `${player.name} did not play Emilia with ${sourceCard.name}.`,
                    emptyMessage: `${sourceCard.name} found no Emilia in hand to play.`
                });

                if (chooseMessage) {
                    addGameLog(chooseMessage);
                }
            }
        });

        return `${trashedLifeResult.message} ${searchMessage}`.trim();
    }

    if (effect.id === "KIL1-002-on-play-search") {
        const message = lookTopCardsAddOneToHandTrashRest(player, sourceCard, 3, ui, {
            isSelectable: card => {
                return hasTypeText(card, "Kid Pirates") &&
                    !CardEffects.hasCardName(card, "Dive");
            },
            onResolved: (_selectedCard, trashedCards) => {
                trashedCards.forEach(trashedCard => {
                    resolveWhenTrashedFromDeckEffects(player, trashedCard, ui);
                });
            }
        });

        return message;
    }

    if (effect.id === "KIL1-003-activate-main") {
        const opponent = getOpponentOfPlayer(player);

        if (!opponent || (opponent.trash?.length || 0) === 0) {
            return `${sourceCard.name} found no card in the opponent's trash to return to deck.`;
        }

        return chooseBoardCard(player, sourceCard, getTrashCardChoices(opponent), {
            prompt: `Choose 1 card from ${opponent.name}'s trash to place on the bottom of their deck.`,
            optional: false,
            onSelect: ({ trashIndex, card }) => {
                const movedCard = opponent.trash.splice(trashIndex, 1)[0];

                if (!movedCard) {
                    addGameLog(`${sourceCard.name} could not find that card in ${opponent.name}'s trash anymore.`);
                    return;
                }

                opponent.deck.push(movedCard);
                ui?.renderTrash?.();
                ui?.renderDecks?.();
                addGameLog(`${player.name} placed ${card.name} from ${opponent.name}'s trash on the bottom of their deck with ${sourceCard.name}.`);

                const targetCost = getCardEffectiveCost(movedCard);
                const addMessage = addCardFromTrashToHand(player, sourceCard, ui, {
                    prompt: `Choose up to 1 card with cost ${targetCost} from your trash to add to hand.`,
                    optional: true,
                    filter: trashCard => getCardEffectiveCost(trashCard) === targetCost,
                    skipMessage: `${player.name} did not add a cost ${targetCost} card from trash with ${sourceCard.name}.`,
                    emptyMessage: `${sourceCard.name} found no cost ${targetCost} card in ${player.name}'s trash.`
                });

                if (addMessage) {
                    addGameLog(addMessage);
                }

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            }
        });
    }

    if (effect.id === "KIL1-003-trigger") {
        return addCardFromTrashToHand(player, sourceCard, ui, {
            prompt: "Choose up to 1 Character card from your trash to add to your hand.",
            optional: true,
            filter: card => card.cardType === "character",
            skipMessage: `${player.name} did not add a Character from trash with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no Character cards in trash.`
        });
    }

    if (effect.id === "KIL1-004-activate-main") {
        if (!setCardRested(sourceCard)) {
            return `${sourceCard.name} could not be rested.`;
        }

        return resolveKillerTrashBottomCycle(player, sourceCard, ui, {
            prompt: `Choose any number of cards from your trash to place on the bottom of your deck with ${sourceCard.name}.`,
            onResolved: (result) => {
                const powerGain = Math.floor(result.totalReturned / 6) * 1000;

                if (powerGain <= 0) {
                    return;
                }

                const chooseMessage = chooseOwnBoardCard(player, sourceCard, {
                    prompt: `Choose up to 1 of your Characters to give +${powerGain} power this turn.`,
                    optional: true,
                    includeLeader: false,
                    filter: card => card.cardType === "character",
                    onSelect: ({ card }) => {
                        addTemporaryPowerBonus(card, powerGain);
                        ui?.renderCharacters?.();
                        addGameLog(`${sourceCard.name} gave ${card.name} +${powerGain} power this turn.`);
                    },
                    skipMessage: `${player.name} did not choose a Character to empower with ${sourceCard.name}.`,
                    emptyMessage: `${sourceCard.name} found no Character to empower.`
                });

                if (chooseMessage) {
                    addGameLog(chooseMessage);
                }
            }
        });
    }

    if (effect.id === "KIL1-005-activate-main") {
        const slotIndex = player.characters.findIndex(card => card?.instanceId === sourceCard.instanceId);

        if (slotIndex === -1) {
            return `${sourceCard.name} is no longer on the field.`;
        }

        trashCharacterFromField(player, slotIndex, ui);
        const drawResult = drawCard(player, ui);
        const opponent = getOpponentOfPlayer(player);
        const ownMill = trashTopCardsOfDeck(player, 3, ui);
        const opponentMill = opponent
            ? trashTopCardsOfDeck(opponent, 3, ui)
            : { message: `${sourceCard.name} found no opponent deck to trash from.` };

        return [
            `${player.name} trashed ${sourceCard.name} for its effect.`,
            drawResult?.deckOut
                ? `${sourceCard.name} tried to draw 1 card, but ${player.name} lost by deck out.`
                : `${player.name} drew 1 card with ${sourceCard.name}.`,
            ownMill.message,
            opponentMill.message
        ].join(" ");
    }

    if (effect.id === "KIL1-006-on-play") {
        return resolveKillerTrashBottomCycle(player, sourceCard, ui, {
            prompt: `Choose any number of cards from your trash to place on the bottom of your deck with ${sourceCard.name}.`,
            onResolved: (result) => {
                const drawTrashCount = Math.floor(result.totalReturned / 4);

                if (drawTrashCount <= 0) {
                    return;
                }

                const message = resolveKillerDrawThenTrash(player, sourceCard, ui, drawTrashCount);

                if (message) {
                    addGameLog(message);
                }
            }
        });
    }

    if (effect.id === "KIL1-006-trigger") {
        const opponent = getOpponentOfPlayer(player);
        const ownMill = trashTopCardsOfDeck(player, 2, ui);
        const opponentMill = opponent
            ? trashTopCardsOfDeck(opponent, 2, ui)
            : { message: `${sourceCard.name} found no opponent deck to trash from.` };

        return `${ownMill.message} ${opponentMill.message}`.trim();
    }

    if (effect.id === "KIL1-008-trigger") {
        const opponent = getOpponentOfPlayer(player);
        const ownMill = trashTopCardsOfDeck(player, 1, ui);
        const opponentMill = opponent
            ? trashTopCardsOfDeck(opponent, 1, ui)
            : { message: `${sourceCard.name} found no opponent deck to trash from.` };

        return `${ownMill.message} ${opponentMill.message}`.trim();
    }

    if (effect.id === "KIL1-009-activate-main") {
        return resolveKillerTrashBottomCycle(player, sourceCard, ui, {
            prompt: `Choose any number of cards from your trash to place on the bottom of your deck with ${sourceCard.name}.`,
            onResolved: (result) => {
                const negateCount = Math.floor(result.totalReturned / 8);
                const negatedSlots = [];

                const chooseNextTarget = () => {
                    if (negatedSlots.length >= negateCount) {
                        return;
                    }

                    const chooseMessage = chooseOpponentCharacter(player, sourceCard, {
                        prompt: `Choose up to 1 opposing Character to negate its effects this turn (${negatedSlots.length + 1} of ${negateCount}).`,
                        optional: true,
                        filter: (_card, choice) => !negatedSlots.includes(choice.slotIndex),
                        onSelect: ({ card, slotIndex, playerKey }) => {
                            const targetPlayer = playerKey ? gameState?.[playerKey] : getPlayerForBoardCard(card);
                            const targetPlayerKey = getPlayerKey(targetPlayer);

                            if (isProtectedFromOpponentEffects(card, targetPlayerKey, player)) {
                                addGameLog(`${card.name} is protected from opponent effects.`);
                                return;
                            }

                            addTemporaryEffectNegation(card, getPlayerKey(player), Number(player.turns || 0));
                            negatedSlots.push(slotIndex);
                            ui?.renderCharacters?.();
                            addGameLog(`${sourceCard.name} negated ${card.name}'s effects this turn.`);
                            chooseNextTarget();
                        },
                        skipMessage: `${player.name} stopped choosing targets for ${sourceCard.name}.`,
                        emptyMessage: `${sourceCard.name} found no opposing Characters to negate.`
                    });

                    if (chooseMessage) {
                        addGameLog(chooseMessage);
                    }
                };

                if (negateCount > 0) {
                    chooseNextTarget();
                }
            }
        });
    }

    if (effect.id === "KIL1-010-on-play") {
        return resolveKillerKOUpToPower(player, sourceCard, ui, 6000);
    }

    if (effect.id === "KIL1-010-on-ko") {
        const attachedDonBeforeKO = Number(sourceCard.attachedDonBeforeKO || 0);

        if (attachedDonBeforeKO < 2) {
            return `${sourceCard.name}'s On K.O. effect did not resolve because it did not have DON!! x2.`;
        }

        return resolveKillerKOUpToPower(player, sourceCard, ui, 6000);
    }

    if (effect.id === "KIL1-011-on-play") {
        const messages = [];

        if (hasTypeText(player.leader, "Supernovas")) {
            addTemporaryKeyword(sourceCard, "rush");
            messages.push(`${sourceCard.name} gained Rush.`);
        }

        const blockerLock = {
            expiresAtPlayerKey: getPlayerKey(player),
            expiresAtEndOfTurns: Number(player.turns || 0)
        };

        getOpponentOfPlayer(player)?.characters
            ?.filter(card => card && getCardBattlePower(card, getPlayerForBoardCard(card)) <= 6000)
            .forEach(card => {
                card.cannotBlockUntil = blockerLock;
            });

        const lifeCard = player.life?.shift() || null;

        if (lifeCard) {
            player.hand.push(lifeCard);
            ui?.renderLifeCards?.();
            ui?.renderHands?.();
            messages.push(`${player.name} added the top life card to hand.`);
        } else {
            messages.push(`${sourceCard.name} found no life card to add to hand.`);
        }

        ui?.renderCharacters?.();
        return messages.join(" ");
    }

    if (effect.id === "KIL1-013-counter") {
        return resolveKillerKOUpToPower(player, sourceCard, ui, 6000);
    }

    if (effect.id === "KIL1-014-main") {
        if (!restDonForCost(player, 1, ui)) {
            return `${player.name} could not rest 1 active DON!! for ${sourceCard.name}.`;
        }

        const opponent = getOpponentOfPlayer(player);
        const ownMill = trashTopCardsOfDeck(player, 3, ui);
        const opponentMill = opponent
            ? trashTopCardsOfDeck(opponent, 3, ui)
            : { message: `${sourceCard.name} found no opponent deck to trash from.` };

        return `${ownMill.message} ${opponentMill.message}`.trim();
    }

    if (effect.id === "KIL1-014-counter") {
        if (
            player.leader?.cardNumber !== "KIL1-001" &&
            !player.characters.some(card => card && getCardBattlePower(card, player) >= 8000)
        ) {
            return `${sourceCard.name}'s Counter did not resolve because ${player.name} does not meet its condition.`;
        }

        return chooseLeaderOrCharacterForPower(player, sourceCard, ui, 4000, {
            duration: "battle",
            prompt: "Choose up to 1 of your Leader or Characters to give +4000 power during this battle.",
            skipMessage: `${player.name} did not choose a card for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no Leader or Character to empower.`
        });
    }

    if (effect.id === "IMU1-002-on-ko-in-combat") {
        if (!options.byBattle) {
            return `${sourceCard.name}'s On K.O. effect did not resolve because it was not K.O.'d in combat.`;
        }

        if ((player.deck?.length || 0) < 1) {
            return `${sourceCard.name}'s On K.O. effect found no card in deck to trash.`;
        }

        const attackerPlayer = typeof currentAttack !== "undefined" && currentAttack
            ? gameState?.[currentAttack.attackerPlayerKey]
            : null;
        const attackerCard = typeof currentAttack !== "undefined" && currentAttack
            ? getBoardCardFromData(currentAttack.attacker)
            : null;

        if (!attackerPlayer || !attackerCard) {
            return `${sourceCard.name}'s On K.O. effect could not find the attacking card.`;
        }

        const applyPenalty = () => {
            const trashResult = trashTopCardsOfDeck(player, 1, ui);
            const expiresAtPlayerKey = getPlayerKey(player);
            const expiresAtEndOfTurns = Number(player.turns || 0) + 1;

            addDurationPowerBonus(attackerCard, -2000, expiresAtEndOfTurns, expiresAtPlayerKey);
            ui?.renderCharacters?.();
            ui?.renderLeaders?.();

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }

            return `${trashResult.message} ${sourceCard.name} gave ${attackerCard.name} -2000 power until the end of ${player.name}'s next turn.`.trim();
        };

        if (ui?.chooseEffectActivation) {
            ui.chooseEffectActivation({
                player,
                sourceCard,
                effect,
                title: sourceCard.name,
                prompt: `Trash 1 card from the top of your deck for ${sourceCard.name}?`,
                activateText: "Trash 1",
                skipText: "Skip",
                onComplete: (shouldActivate) => {
                    addGameLog(
                        shouldActivate
                            ? applyPenalty()
                            : `${player.name} did not trash a card from deck for ${sourceCard.name}.`
                    );
                }
            });

            return `${player.name} is choosing whether to use ${sourceCard.name}'s On K.O. effect.`;
        }

        return applyPenalty();
    }

    if (effect.id === "IMU1-003-on-play") {
        return chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 of your {Holy Knight} type Characters to give +1000 power this turn.",
            optional: true,
            includeLeader: false,
            filter: card => card.cardType === "character" && hasTypeText(card, "Holy Knight"),
            onSelect: ({ card }) => {
                addTemporaryPowerBonus(card, 1000);
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} gave ${card.name} +1000 power this turn.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not choose a {Holy Knight} Character for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no {Holy Knight} Characters to empower.`
        });
    }

    if (effect.id === "IMU1-003-when-attacking") {
        return chooseBoardCard(player, sourceCard, getOpponentBoardChoices(player, {
            includeLeader: true,
            filter: card => card.cardType === "leader" || card.cardType === "character"
        }), {
            prompt: "Choose up to 1 of your opponent's Leaders or Characters to give -1000 power this turn.",
            optional: true,
            onSelect: ({ card }) => {
                addTemporaryPowerBonus(card, -1000);
                ui?.renderLeaders?.();
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} gave ${card.name} -1000 power this turn.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not choose a target for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing Leader or Character to weaken.`
        });
    }

    if (effect.id === "IMU1-004-when-attacking") {
        return trashTopCardsOfDeck(player, 1, ui).message;
    }

    if (effect.id === "IMU1-004-on-ko") {
        return trashTopCardsOfDeck(player, 3, ui).message;
    }

    if (effect.id === "IMU1-005-on-play") {
        const handChoices = getHandCardChoices(player, card => {
            return card.cardType === "stage" && CardEffects.hasCardName(card, "Mary Geoise");
        });
        const trashChoices = getTrashCardChoices(player, card => {
            return card.cardType === "stage" && CardEffects.hasCardName(card, "Mary Geoise");
        });
        const choices = [...handChoices, ...trashChoices];

        if (choices.length === 0) {
            return `${sourceCard.name} found no [Mary Geoise] in hand or trash to play.`;
        }

        return chooseBoardCard(player, sourceCard, choices, {
            prompt: "Choose up to 1 [Mary Geoise] from your hand or trash to play.",
            optional: true,
            onSelect: (choice) => {
                let playedCard = null;

                if (choice.cardType === "hand") {
                    playedCard = player.hand.splice(choice.handIndex, 1)[0];
                    ui?.renderHands?.();
                } else if (choice.cardType === "trash") {
                    playedCard = player.trash.splice(choice.trashIndex, 1)[0];
                    ui?.renderTrash?.();
                }

                if (!playedCard) {
                    addGameLog(`${sourceCard.name} could not find that [Mary Geoise] anymore.`);
                    return;
                }

                addGameLog(
                    playCardFromDeckWithoutCost(
                        player,
                        sourceCard,
                        playedCard,
                        ui,
                        choice.cardType === "hand" ? "hand" : "trash"
                    )
                );

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not play [Mary Geoise] with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no [Mary Geoise] in hand or trash to play.`
        });
    }

    if (effect.id === "IMU1-006-on-play") {
        return chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing Character with 8000 power or less to trash.",
            optional: true,
            filter: card => getCardBattlePower(card, getPlayerForBoardCard(card)) <= 8000,
            onSelect: ({ card, playerKey, slotIndex }) => {
                const targetPlayer = playerKey ? gameState?.[playerKey] : getPlayerForBoardCard(card);
                const targetPlayerKey = getPlayerKey(targetPlayer);

                if (isProtectedFromOpponentEffects(card, targetPlayerKey, player)) {
                    addGameLog(`${card.name} is protected from opponent effects.`);
                    return;
                }

                const trashResult = trashCharacterFromField(targetPlayer, slotIndex, ui);
                addGameLog(`${sourceCard.name} trashed ${card.name}. ${trashResult.linkedStageMessage || ""}`.trim());

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not trash a Character with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing Characters with 8000 power or less.`
        });
    }

    if (effect.id === "IMU1-008-on-play") {
        if ((player.deck?.length || 0) < 1) {
            return `${sourceCard.name}'s On Play effect found no card in deck to trash.`;
        }

        const resolveSearch = () => {
            const trashResult = trashTopCardsOfDeck(player, 1, ui);
            const addMessage = addCardFromTrashToHand(player, sourceCard, ui, {
                prompt: "Choose up to 1 {Holy Knight} or {Celestial Dragon} Character from your trash to add to your hand.",
                optional: true,
                filter: card => {
                    return card.cardType === "character" &&
                        (hasTypeText(card, "Holy Knight") || hasTypeText(card, "Celestial Dragon"));
                },
                skipMessage: `${player.name} trashed 1 card from deck for ${sourceCard.name} but did not add a card from trash.`,
                emptyMessage: `${sourceCard.name} found no {Holy Knight} or {Celestial Dragon} Characters in trash.`
            });

            return `${trashResult.message} ${addMessage || ""}`.trim();
        };

        if (ui?.chooseEffectActivation) {
            ui.chooseEffectActivation({
                player,
                sourceCard,
                effect,
                title: sourceCard.name,
                prompt: `Trash 1 card from the top of your deck for ${sourceCard.name}?`,
                activateText: "Trash 1",
                skipText: "Skip",
                onComplete: (shouldActivate) => {
                    addGameLog(
                        shouldActivate
                            ? resolveSearch()
                            : `${player.name} did not trash a card from deck for ${sourceCard.name}.`
                    );
                }
            });

            return `${player.name} is choosing whether to use ${sourceCard.name}'s On Play effect.`;
        }

        return resolveSearch();
    }

    if (effect.id === "IMU1-009-on-play") {
        return lookTopCardsForType(player, sourceCard, 4, "Holy Knight", ui);
    }

    if (effect.id === "IMU1-010-when-attacking") {
        return chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 of your {Holy Knight} type Characters to set as active.",
            optional: true,
            includeLeader: false,
            filter: card => card.cardType === "character" && hasTypeText(card, "Holy Knight"),
            onSelect: ({ card }) => {
                card.uiAnimation = "readied";
                card.state = "active";
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} set ${card.name} as active.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not choose a {Holy Knight} Character for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no {Holy Knight} Characters to set active.`
        });
    }

    if (effect.id === "IMU1-011-main") {
        if (!restDonForCost(player, 2, ui)) {
            return `${player.name} does not have enough active DON!! to use ${sourceCard.name}'s Main effect.`;
        }

        return chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing Character with 5000 power or less to trash.",
            optional: true,
            filter: card => getCardBattlePower(card, getPlayerForBoardCard(card)) <= 5000,
            onSelect: ({ card, playerKey, slotIndex }) => {
                const targetPlayer = playerKey ? gameState?.[playerKey] : getPlayerForBoardCard(card);
                const targetPlayerKey = getPlayerKey(targetPlayer);

                if (isProtectedFromOpponentEffects(card, targetPlayerKey, player)) {
                    addGameLog(`${card.name} is protected from opponent effects.`);
                    return;
                }

                const trashResult = trashCharacterFromField(targetPlayer, slotIndex, ui);
                addGameLog(`${sourceCard.name} trashed ${card.name}. ${trashResult.linkedStageMessage || ""}`.trim());

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} rested 2 DON!! for ${sourceCard.name} but did not choose a Character.`,
            emptyMessage: `${sourceCard.name} found no opposing Characters with 5000 power or less.`
        });
    }

    if (effect.id === "IMU1-011-counter") {
        if (player.leader?.cardNumber !== "IMU1-001") {
            return `${sourceCard.name}'s Counter did not resolve because ${player.name}'s leader is not Imu.`;
        }

        if ((player.deck?.length || 0) < 1) {
            return `${sourceCard.name}'s Counter found no card in deck to trash.`;
        }

        const trashResult = trashTopCardsOfDeck(player, 1, ui);
        const expiresAtPlayerKey = getPlayerKey(player);
        const expiresAtEndOfTurns = Number(player.turns || 0) + 1;

        const chooseMessage = chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 of your Leader or Characters to gain +2000 power until the end of your next End Phase.",
            optional: true,
            includeLeader: true,
            filter: card => card.cardType === "leader" || card.cardType === "character",
            onSelect: ({ card }) => {
                addDurationPowerBonus(card, 2000, expiresAtEndOfTurns, expiresAtPlayerKey);
                ui?.renderLeaders?.();
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} gave ${card.name} +2000 power until the end of ${player.name}'s next End Phase.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} trashed 1 card from deck for ${sourceCard.name} but did not choose a target.`,
            emptyMessage: `${sourceCard.name} found no Leader or Character to empower.`
        });

        return `${trashResult.message} ${chooseMessage || ""}`.trim();
    }

    if (effect.id === "IMU1-012-main") {
        if ((player.deck?.length || 0) < 1) {
            return `${sourceCard.name}'s Main effect found no card in deck to trash.`;
        }

        const trashResult = trashTopCardsOfDeck(player, 1, ui);
        const chooseMessage = chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 [IMU] Leader or {Holy Knight} Character to gain Banish this turn.",
            optional: true,
            includeLeader: true,
            filter: card => {
                return (card.cardType === "leader" && card.cardNumber === "IMU1-001") ||
                    (card.cardType === "character" && hasTypeText(card, "Holy Knight"));
            },
            onSelect: ({ card }) => {
                addTemporaryKeyword(card, "banish");
                ui?.renderLeaders?.();
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} gave ${card.name} Banish this turn.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not choose a target for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no [IMU] Leader or {Holy Knight} Character to give Banish.`
        });
        const drawResult = drawCard(player, ui);
        const drawMessage = drawResult?.deckOut
            ? `${sourceCard.name} tried to draw 1 card, but ${player.name} lost by deck out.`
            : `${sourceCard.name} drew 1 card.`;

        return `${trashResult.message} ${chooseMessage || ""} ${drawMessage}`.trim();
    }

    if (effect.id === "IMU1-012-trigger") {
        const expiresAtPlayerKey = getPlayerKey(player);
        const expiresAtEndOfTurns = Number(player.turns || 0) + 1;

        return chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 of your Leader or Characters to gain +1000 power until the end of your next turn.",
            optional: true,
            includeLeader: true,
            filter: card => card.cardType === "leader" || card.cardType === "character",
            onSelect: ({ card }) => {
                addDurationPowerBonus(card, 1000, expiresAtEndOfTurns, expiresAtPlayerKey);
                ui?.renderLeaders?.();
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} gave ${card.name} +1000 power until the end of ${player.name}'s next turn.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not choose a target for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no Leader or Character to empower.`
        });
    }

    if (effect.id === "IMU1-013-main") {
        if ((player.deck?.length || 0) < 2) {
            return `${sourceCard.name}'s Main effect requires 2 cards in deck to trash.`;
        }

        const trashResult = trashTopCardsOfDeck(player, 2, ui);
        const playMessage = getFirstOpenCharacterSlotIndex(player) === -1
            ? `${sourceCard.name} could not play a Character from trash because ${player.name}'s character area is full.`
            : chooseTrashCard(player, sourceCard, ui, {
                prompt: "Choose up to 1 {Holy Knight} type Character with a cost of 6 or less from your trash to play.",
                optional: true,
                filter: card => {
                    return card.cardType === "character" &&
                        hasTypeText(card, "Holy Knight") &&
                        getCardEffectiveCost(card) <= 6;
                },
                onSelect: ({ trashIndex }) => {
                    const playedCard = player.trash.splice(trashIndex, 1)[0];

                    if (!playedCard) {
                        addGameLog(`${sourceCard.name} could not find that trash card anymore.`);
                        return;
                    }

                    addGameLog(playCharacterFromTrashWithoutCost(player, sourceCard, playedCard, ui));

                    if (typeof queueMultiplayerStateSync === "function") {
                        queueMultiplayerStateSync();
                    }
                },
                skipMessage: `${player.name} did not play a Character from trash with ${sourceCard.name}.`,
                emptyMessage: `${sourceCard.name} found no {Holy Knight} Characters with a cost of 6 or less in trash.`
            });
        const drawResult = drawCard(player, ui);
        const drawMessage = drawResult?.deckOut
            ? `${sourceCard.name} tried to draw 1 card, but ${player.name} lost by deck out.`
            : `${sourceCard.name} drew 1 card.`;

        return `${trashResult.message} ${playMessage || ""} ${drawMessage}`.trim();
    }

    if (effect.id === "IMU1-013-trigger") {
        return addCardFromTrashToHand(player, sourceCard, ui, {
            prompt: "Choose up to 1 {Holy Knight} type card from your trash to add to your hand.",
            optional: true,
            filter: card => hasTypeText(card, "Holy Knight"),
            skipMessage: `${player.name} did not add a {Holy Knight} type card from trash with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no {Holy Knight} type cards in trash.`
        });
    }

    if (
        effect.id === "YAM1-002-on-play-lock-rest" ||
        effect.id === "YAM1-002-on-ko-lock-rest"
    ) {
        const opponent = getOpponentOfPlayer(player);
        const opponentKey = getPlayerKey(opponent);
        const expiresAtEndOfTurns = gameState?.currentPlayer === opponent
            ? Number(opponent?.turns || 0)
            : Number(opponent?.turns || 0) + 1;

        return chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character with a cost of 6 or less that can't be rested until the end of your opponent's next End Phase.",
            optional: true,
            filter: card => getCardEffectiveCost(card) <= 6,
            onSelect: ({ card, playerKey }) => {
                const targetPlayer = playerKey
                    ? gameState?.[playerKey]
                    : getPlayerForBoardCard(card);
                const targetPlayerKey = getPlayerKey(targetPlayer);

                if (isProtectedFromOpponentEffects(card, targetPlayerKey, player)) {
                    addGameLog(`${card.name} is protected from opponent effects.`);
                    return;
                }

                applyCannotBeRestedUntil(card, expiresAtEndOfTurns, opponentKey);
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} made ${card.name} unable to be rested until the end of ${opponent?.name || "the opponent"}'s next End Phase.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not choose a character for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing cost 6 or lower characters.`
        });
    }

    if (effect.id === "YAM1-003-main") {
        const addedCard = takeTopLifeToHand(player, ui);

        if (!addedCard) {
            return `${sourceCard.name}'s Main effect could not add a life card to hand.`;
        }

        const chooseMessage = chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 of your {Land of Wano} Characters to give +2000 power and Rush this turn.",
            optional: true,
            includeLeader: false,
            filter: card => card.cardType === "character" && hasTypeText(card, "Land of Wano"),
            onSelect: ({ card }) => {
                addTemporaryPowerBonus(card, 2000);
                addTemporaryKeyword(card, "rush");
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} gave ${card.name} +2000 power and Rush this turn.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} added a life card to hand with ${sourceCard.name} but did not choose a character.`,
            emptyMessage: `${sourceCard.name} found no {Land of Wano} characters to power up.`
        });

        return chooseMessage
            ? `${player.name} added ${addedCard.name} from life to hand with ${sourceCard.name}. ${chooseMessage}`
            : `${player.name} added ${addedCard.name} from life to hand with ${sourceCard.name}.`;
    }

    if (effect.id === "YAM1-003-counter") {
        const topLifeCard = player.life?.[0];

        if (!topLifeCard) {
            return `${sourceCard.name}'s Counter found no life card to turn face-up.`;
        }

        if (topLifeCard.faceUp) {
            return `${sourceCard.name}'s Counter could not be paid because ${player.name}'s top life card is already face-up.`;
        }

        const chooseTarget = () => chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 of your leader or characters to give +3000 power during this battle.",
            optional: true,
            includeLeader: true,
            filter: card => card.cardType === "leader" || card.cardType === "character",
            onSelect: ({ card }) => {
                addBattlePowerBonus(card, 3000);
                ui?.renderLeaders?.();
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} gave ${card.name} +3000 power during this battle.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} turned a life card face-up for ${sourceCard.name} but did not choose a target.`,
            emptyMessage: `${sourceCard.name} found no leader or character to empower.`
        });

        if (ui?.chooseEffectActivation) {
            ui.chooseEffectActivation({
                player,
                sourceCard,
                effect,
                title: sourceCard.name,
                prompt: `Turn the top life card face-up for ${sourceCard.name}?`,
                activateText: "Turn Face-up",
                skipText: "Skip",
                onComplete: (shouldActivate) => {
                    if (!shouldActivate) {
                        addGameLog(`${player.name} did not turn a life card face-up for ${sourceCard.name}.`);
                        return;
                    }

                    topLifeCard.faceUp = true;
                    ui?.renderLifeCards?.();
                    addGameLog(`${player.name} turned the top life card face-up for ${sourceCard.name}.`);

                    const chooseMessage = chooseTarget();

                    if (chooseMessage) {
                        addGameLog(chooseMessage);
                    }

                    if (typeof queueMultiplayerStateSync === "function") {
                        queueMultiplayerStateSync();
                    }
                }
            });

            return `${player.name} is choosing whether to turn the top life card face-up for ${sourceCard.name}.`;
        }

        topLifeCard.faceUp = true;
        ui?.renderLifeCards?.();

        const chooseMessage = chooseTarget();

        return chooseMessage
            ? `${player.name} turned the top life card face-up for ${sourceCard.name}. ${chooseMessage}`
            : `${player.name} turned the top life card face-up for ${sourceCard.name}.`;
    }

    if (effect.id === "YAM1-004-trigger-play-trash") {
        if (getFirstOpenCharacterSlotIndex(player) === -1) {
            return `${sourceCard.name}'s Trigger could not play a character from trash because ${player.name}'s character area is full.`;
        }

        return chooseTrashCard(player, sourceCard, ui, {
            prompt: "Choose up to 1 {Land of Wano} Character with a cost of 6 or less from your trash to play rested.",
            optional: true,
            filter: card => {
                return card.cardType === "character" &&
                    hasTypeText(card, "Land of Wano") &&
                    getCardEffectiveCost(card) <= 6;
            },
            onSelect: ({ trashIndex }) => {
                const playedCard = player.trash.splice(trashIndex, 1)[0];

                if (!playedCard) {
                    addGameLog(`${sourceCard.name} could not find that trash card anymore.`);
                    return;
                }

                addGameLog(playCharacterFromTrashWithoutCost(player, sourceCard, playedCard, ui, {
                    rested: true
                }));

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not play a character from trash with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no {Land of Wano} characters with a cost of 6 or less in trash.`
        });
    }

    if (effect.id === "YAM1-005-on-play-draw") {
        return chooseHandCard(player, sourceCard, {
            prompt: "Choose 1 {Land of Wano} type card from your hand to trash and draw 2 cards.",
            optional: false,
            filter: card => hasTypeText(card, "Land of Wano"),
            onSelect: ({ handIndex, card }) => {
                const trashedCard = player.hand.splice(handIndex, 1)[0];

                if (!trashedCard) {
                    addGameLog(`${sourceCard.name} could not find that hand card to trash.`);
                    return;
                }

                moveCardToTrash(player, trashedCard, ui);
                ui?.renderHands?.();
                ui?.renderTrash?.();
                addGameLog(`${player.name} trashed ${card.name} for ${sourceCard.name}.`);

                const drawResult = drawCards(player, 2, ui);

                addGameLog(
                    drawResult?.deckOut
                        ? `${sourceCard.name} tried to draw 2 cards, but ${player.name} lost by deck out.`
                        : `${sourceCard.name} drew 2 cards.`
                );

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            emptyMessage: `${sourceCard.name} found no {Land of Wano} type card in hand to trash.`
        });
    }

    if (effect.id === "YAM1-005-trigger-play") {
        if (getFirstOpenCharacterSlotIndex(player) === -1) {
            return `${sourceCard.name}'s Trigger could not play a character from trash because ${player.name}'s character area is full.`;
        }

        return chooseTrashCard(player, sourceCard, ui, {
            prompt: "Choose up to 1 {Land of Wano} Character with a cost of 4 or less from your trash to play.",
            optional: true,
            filter: card => {
                return card.cardType === "character" &&
                    hasTypeText(card, "Land of Wano") &&
                    getCardEffectiveCost(card) <= 4;
            },
            onSelect: ({ trashIndex }) => {
                const playedCard = player.trash.splice(trashIndex, 1)[0];

                if (!playedCard) {
                    addGameLog(`${sourceCard.name} could not find that trash card anymore.`);
                    return;
                }

                addGameLog(playCharacterFromTrashWithoutCost(player, sourceCard, playedCard, ui));

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not play a character from trash with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no {Land of Wano} characters with a cost of 4 or less in trash.`
        });
    }

    if (effect.id === "OP14-089-on-ko-draw-trash") {
        return resolveDrawTwoTrashTwo(player, sourceCard, ui);
    }

    if (effect.id === "OP14-089-trigger-play") {
        if (getFirstOpenCharacterSlotIndex(player) === -1) {
            return `${sourceCard.name}'s Trigger could not play a character from trash because ${player.name}'s character area is full.`;
        }

        return chooseTrashCard(player, sourceCard, ui, {
            prompt: "Choose up to 1 {Thriller Bark Pirates} Character with a cost of 4 or less from your trash to play rested.",
            optional: true,
            filter: card => {
                return card.cardType === "character" &&
                    hasTypeText(card, "Thriller Bark Pirates") &&
                    getCardEffectiveCost(card) <= 4;
            },
            onSelect: ({ trashIndex }) => {
                const playedCard = player.trash.splice(trashIndex, 1)[0];

                if (!playedCard) {
                    addGameLog(`${sourceCard.name} could not find that trash card anymore.`);
                    return;
                }

                addGameLog(playCharacterFromTrashWithoutCost(player, sourceCard, playedCard, ui, {
                    rested: true
                }));

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not play a character from trash with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no {Thriller Bark Pirates} characters with a cost of 4 or less in trash.`
        });
    }

    if (effect.id === "OP16-082-on-play-search") {
        if (!hasTypeText(player.leader, "Land of Wano")) {
            return `${sourceCard.name}'s On Play effect did not resolve because ${player.name}'s leader is not {Land of Wano}.`;
        }

        return lookTopCardsAddOneToHandTrashRest(player, sourceCard, 5, ui, {
            isSelectable: card => hasTypeText(card, "Land of Wano")
        });
    }

    if (effect.id === "OP16-085-on-play-play-trash") {
        if (getFirstOpenCharacterSlotIndex(player) === -1) {
            return `${sourceCard.name}'s On Play effect could not play a character from trash because ${player.name}'s character area is full.`;
        }

        return chooseTrashCard(player, sourceCard, ui, {
            prompt: "Choose up to 1 {Land of Wano} Character with a cost of 6 or less other than [Kouzuki Momonosuke] from your trash to play.",
            optional: true,
            filter: card => {
                return card.cardType === "character" &&
                    hasTypeText(card, "Land of Wano") &&
                    getCardEffectiveCost(card) <= 6 &&
                    !CardEffects.hasCardName(card, "Kouzuki Momonosuke");
            },
            onSelect: ({ trashIndex }) => {
                const playedCard = player.trash.splice(trashIndex, 1)[0];

                if (!playedCard) {
                    addGameLog(`${sourceCard.name} could not find that trash card anymore.`);
                    return;
                }

                addGameLog(playCharacterFromTrashWithoutCost(player, sourceCard, playedCard, ui));

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not play a character from trash with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no valid {Land of Wano} characters in trash.`
        });
    }

    if (effect.id === "OP16-096-on-ko-play-yamato") {
        if (getFirstOpenCharacterSlotIndex(player) === -1) {
            return `${sourceCard.name}'s On K.O. effect could not play a character from trash because ${player.name}'s character area is full.`;
        }

        return chooseTrashCard(player, sourceCard, ui, {
            prompt: "Choose up to 1 [Yamato] with a cost of 6 or less from your trash to play.",
            optional: true,
            filter: card => {
                return card.cardType === "character" &&
                    CardEffects.hasCardName(card, "Yamato") &&
                    getCardEffectiveCost(card) <= 6;
            },
            onSelect: ({ trashIndex }) => {
                const playedCard = player.trash.splice(trashIndex, 1)[0];

                if (!playedCard) {
                    addGameLog(`${sourceCard.name} could not find that trash card anymore.`);
                    return;
                }

                addGameLog(playCharacterFromTrashWithoutCost(player, sourceCard, playedCard, ui));

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not play a [Yamato] from trash with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no [Yamato] with a cost of 6 or less in trash.`
        });
    }

    if (effect.id === "OP16-098-on-play-draw-trash") {
        return resolveDrawOneTrashOne(player, sourceCard, ui);
    }

    if (effect.id === "OP16-099-main") {
        if (!restDonForCost(player, 6, ui)) {
            return `${player.name} could not rest 6 active DON!! for ${sourceCard.name}.`;
        }

        const trashMessage = trashTopCardsOfDeck(player, 5, ui).message;

        if (getFirstOpenCharacterSlotIndex(player) === -1) {
            return `${trashMessage} ${sourceCard.name} could not play a character from trash because ${player.name}'s character area is full.`;
        }

        const playMessage = chooseTrashCard(player, sourceCard, ui, {
            prompt: "Choose up to 1 {Land of Wano} Character with a cost of 6 or less from your trash to play.",
            optional: true,
            filter: card => {
                return card.cardType === "character" &&
                    hasTypeText(card, "Land of Wano") &&
                    getCardEffectiveCost(card) <= 6;
            },
            onSelect: ({ trashIndex }) => {
                const playedCard = player.trash.splice(trashIndex, 1)[0];

                if (!playedCard) {
                    addGameLog(`${sourceCard.name} could not find that trash card anymore.`);
                    return;
                }

                addGameLog(playCharacterFromTrashWithoutCost(player, sourceCard, playedCard, ui));

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not play a character from trash with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no {Land of Wano} characters with a cost of 6 or less in trash.`
        });

        return `${trashMessage} ${playMessage}`.trim();
    }

    if (effect.id === "OP16-099-counter") {
        addBattlePowerBonus(player.leader, 3000);
        ui?.renderLeaders?.();
        return `${sourceCard.name} gave ${player.name}'s leader +3000 power during this battle.`;
    }

    if (effect.id === "OP06-104-on-ko-add-life") {
        const opponent = getOpponentOfPlayer(player);

        if ((opponent?.life?.length || 0) > 3) {
            return `${sourceCard.name}'s On K.O. effect did not add a life card because ${opponent?.name || "the opponent"} has more than 3 life cards.`;
        }

        const topDeckCard = player.deck.shift();

        if (!topDeckCard) {
            return `${sourceCard.name}'s On K.O. effect found no card in deck to add to life.`;
        }

        addCardToLife(player, topDeckCard, ui);
        ui?.renderDecks?.();
        return `${sourceCard.name}'s On K.O. effect added the top card of the deck to life.`;
    }

    if (effect.id === "OP06-107-on-play-life") {
        return chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 of your {Land of Wano} Characters other than [Kouzuki Momonosuke] to place in life face-up.",
            optional: true,
            includeLeader: false,
            filter: card => {
                return card.cardType === "character" &&
                    hasTypeText(card, "Land of Wano") &&
                    !CardEffects.hasCardName(card, "Kouzuki Momonosuke") &&
                    card.instanceId !== sourceCard.instanceId;
            },
            onSelect: ({ slotIndex, card }) => {
                const choosePosition = (position) => {
                    const result = moveOwnCharacterToLife(player, slotIndex, ui, {
                        position,
                        faceUp: true
                    });
                    addGameLog(result.message.replace("life cards.", `the ${position} of life face-up.`));

                    if (typeof queueMultiplayerStateSync === "function") {
                        queueMultiplayerStateSync();
                    }
                };

                if (ui?.chooseEffectOption) {
                    ui.chooseEffectOption({
                        player,
                        sourceCard,
                        title: sourceCard.name,
                        prompt: `Place ${card.name} on the top or bottom of life face-up?`,
                        options: [
                            { label: "Top", value: "top" },
                            { label: "Bottom", value: "bottom" }
                        ],
                        onComplete: (value) => {
                            choosePosition(value === "bottom" ? "bottom" : "top");
                        }
                    });

                    return;
                }

                choosePosition("top");
            },
            skipMessage: `${player.name} did not move a character to life with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no valid {Land of Wano} characters to move to life.`
        });
    }

    if (effect.id === "OP13-104-on-ko-add-life") {
        if (!isMulticoloredCard(player.leader)) {
            return `${sourceCard.name}'s On K.O. effect did not resolve because ${player.name}'s leader is not multicolored.`;
        }

        if (player.hand.length === 0) {
            return `${sourceCard.name}'s On K.O. effect found no card in hand to trash.`;
        }

        return chooseHandCard(player, sourceCard, {
            prompt: `Choose 1 card from your hand to trash for ${sourceCard.name}.`,
            optional: false,
            onSelect: ({ handIndex, card }) => {
                const trashedCard = player.hand.splice(handIndex, 1)[0];

                if (!trashedCard) {
                    addGameLog(`${sourceCard.name} could not find that hand card to trash.`);
                    return;
                }

                moveCardToTrash(player, trashedCard, ui);
                ui?.renderHands?.();
                ui?.renderTrash?.();
                addGameLog(`${player.name} trashed ${card.name} for ${sourceCard.name}.`);

                const topDeckCard = player.deck.shift();

                if (!topDeckCard) {
                    addGameLog(`${sourceCard.name} found no card in deck to add to life.`);
                    return;
                }

                addCardToLife(player, topDeckCard, ui);
                ui?.renderDecks?.();
                addGameLog(`${sourceCard.name} added the top card of the deck to life.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            emptyMessage: `${sourceCard.name} found no card in hand to trash.`
        });
    }

    if (effect.id === "PRB02-016-trigger-rest") {
        return chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing cost 4 or lower character to rest.",
            optional: true,
            filter: card => getCardEffectiveCost(card) <= 4 && (card.state || "active") === "active",
            onSelect: ({ card, playerKey }) => {
                const targetPlayer = playerKey ? gameState?.[playerKey] : getPlayerForBoardCard(card);
                const targetPlayerKey = getPlayerKey(targetPlayer);

                if (isProtectedFromOpponentEffects(card, targetPlayerKey, player)) {
                    addGameLog(`${card.name} is protected from opponent effects.`);
                    return;
                }

                if (!setCardRested(card)) {
                    addGameLog(`${card.name} cannot be rested due to an effect.`);
                    return;
                }

                addGameLog(`${sourceCard.name} rested ${card.name}.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not rest a character with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing cost 4 or lower characters.`
        });
    }

    if (effect.id === "ST28-005-on-play-search") {
        return lookTopCardsForType(player, sourceCard, 5, "Land of Wano", ui, {
            isSelectable: card => hasTypeText(card, "Land of Wano") && Number(card.cost ?? card.playCost ?? 0) >= 2
        });
    }

    if (effect.id === "EB03-057-on-play-don") {
        if (!hasTypeText(player.leader, "Land of Wano")) {
            return `${sourceCard.name}'s On Play effect did not resolve because ${player.name}'s leader is not {Land of Wano}.`;
        }

        const maxAttach = Math.min(3, Number(player.restedDon || 0));

        if (maxAttach <= 0) {
            return `${sourceCard.name}'s On Play effect found no rested DON!! to give.`;
        }

        const attachCount = (count) => {
            const resolvedCount = Math.max(0, Math.min(maxAttach, Number(count || 0)));

            if (resolvedCount <= 0) {
                addGameLog(`${player.name} did not give any rested DON!! with ${sourceCard.name}.`);
                return;
            }

            player.restedDon -= resolvedCount;
            player.leader.attachedDon = Number(player.leader.attachedDon || 0) + resolvedCount;
            ui?.updateDonDisplay?.();
            ui?.renderLeaders?.();
            addGameLog(`${sourceCard.name} gave ${resolvedCount} rested DON!! to ${player.leader.name}.`);

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }
        };

        if (ui?.chooseNumberValue) {
            ui.chooseNumberValue({
                player,
                sourceCard,
                title: sourceCard.name,
                prompt: `Choose how many rested DON!! to give to ${player.leader.name}.`,
                min: 0,
                max: maxAttach,
                initialValue: maxAttach,
                valueLabel: "DON!!",
                onComplete: attachCount
            });

            return `${player.name} is choosing how many rested DON!! to give to ${player.leader.name}.`;
        }

        attachCount(maxAttach);
        return `${sourceCard.name}'s On Play effect resolved.`;
    }

    if (effect.id === "EB03-057-on-ko-trash-life") {
        const opponent = getOpponentOfPlayer(player);

        if (!opponent?.life?.length) {
            return `${sourceCard.name}'s On K.O. effect found no opponent life card to trash.`;
        }

        const banishResult = banishLifeDamage(opponent, 1, ui);

        return banishResult.success
            ? `${sourceCard.name}'s On K.O. effect trashed the top card of ${opponent.name}'s life.`
            : `${sourceCard.name}'s On K.O. effect could not trash a life card.`;
    }

    if (effect.actionId === "drawOneCard") {
        const drawResult = drawCard(player, ui);

        return drawResult?.deckOut
            ? `${sourceCard.name}'s effect tried to draw 1 card, but ${player.name} lost by deck out.`
            : `${sourceCard.name}'s effect drew 1 card.`;
    }

    if (effect.id === "JK01-002-counter") {
        return resolveEvidenceCounterEffect(player, sourceCard, ui);
    }

    if (effect.id === "JK01-003-counter") {
        return resolveConfiscationCounterEffect(player, sourceCard, ui);
    }

    if (effect.id === "JK01-004-counter") {
        return resolveDeathPenaltyCounterEffect(player, sourceCard, ui);
    }

    if (effect.id === "JK01-005-counter") {
        return resolveConfessionCounterEffect(player, sourceCard, ui);
    }

    if (effect.id === "JK01-011-on-ko") {
        return resolveDrawOneTrashOne(player, sourceCard, ui);
    }

    if (effect.id === "JK01-007-on-play") {
        if (!player.leader || !CardEffects.hasCardName(player.leader, "Hiromi Higuruma")) {
            return `${sourceCard.name}'s On Play effect did not resolve because ${player.name}'s leader is not Hiromi Higuruma.`;
        }

        return trashTopCardsOfDeck(player, 5, ui).message;
    }

    if (effect.id === "JK01-012-on-play") {
        const lifeResult = takeLifeToHandUntilCount(player, ui, 1);

        if (!lifeResult.success) {
            return `${sourceCard.name}'s On Play effect did not add any life cards to hand.`;
        }

        addPersistentPowerBonus(player.leader, 2000);
        ui?.renderLeaders?.();

        return `${lifeResult.message} ${player.leader.name} gained +2000 power for the rest of the game.`;
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

        return chooseHandCardsToTopOrBottomOfDeck(player, sourceCard, ui, 2, {
            sameZoneForAll: true
        });
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
            onSelect: ({ card, playerKey, slotIndex }) => {
                const targetPlayer = playerKey ? gameState?.[playerKey] : getPlayerForBoardCard(card);
                const targetPlayerKey = getPlayerKey(targetPlayer);

                if (isProtectedFromOpponentEffects(card, targetPlayerKey, player)) {
                    addGameLog(`${card.name} is protected from opponent effects.`);
                    return;
                }

                if (!setCardRested(card)) {
                    addGameLog(`${card.name} cannot be rested due to an effect.`);
                    return;
                }

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

        if (!setCardRested(sourceCard)) {
            return `${sourceCard.name} cannot be rested due to an effect.`;
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

    if (effect.id === "JK02-002-on-play") {
        if (!restDonForCost(player, 2, ui)) {
            return `${player.name} could not rest 2 active DON!! for ${sourceCard.name}.`;
        }

        return chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 [Hanami] card to set active and give +1000 power this turn.",
            optional: true,
            includeLeader: true,
            filter: card => CardEffects.hasCardName(card, "Hanami"),
            onSelect: ({ card }) => {
                card.uiAnimation = "readied";
                card.state = "active";
                addTemporaryPowerBonus(card, 1000);
                ui?.renderLeaders?.();
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} set ${card.name} as active and gave it +1000 power this turn.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} rested 2 DON!! for ${sourceCard.name} but did not choose a [Hanami] card.`,
            emptyMessage: `${sourceCard.name} found no [Hanami] cards to affect.`
        });
    }

    if (effect.id === "JK02-003-on-play") {
        return chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character to give -2000 power this turn. If it has cost 5 or less and 0 or less power, K.O. it.",
            optional: true,
            onSelect: ({ card, playerKey, slotIndex }) => {
                const targetPlayer = playerKey ? gameState?.[playerKey] : getPlayerForBoardCard(card);
                const targetPlayerKey = getPlayerKey(targetPlayer);

                if (isProtectedFromOpponentEffects(card, targetPlayerKey, player)) {
                    addGameLog(`${card.name} is protected from opponent effects.`);
                    return;
                }

                addTemporaryPowerBonus(card, -2000);
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} gave ${card.name} -2000 power this turn.`);

                if (getCardEffectiveCost(card) <= 5 && getCardBattlePower(card, targetPlayer) <= 0) {
                    addGameLog(removeCharacterByOpponentEffect(player, targetPlayer, slotIndex, sourceCard, ui));
                }

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not choose a character for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing characters.`
        });
    }

    if (effect.id === "JK02-004-main") {
        const chooseKoMode = () => chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing rested character with a cost of 5 or less to K.O.",
            optional: true,
            filter: card => getCardEffectiveCost(card) <= 5 && (card.state || "active") === "rested",
            onSelect: ({ playerKey, slotIndex }) => {
                addGameLog(removeCharacterByOpponentEffect(player, gameState[playerKey], slotIndex, sourceCard, ui));

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not K.O. a character with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no rested cost 5 or lower characters.`
        });

        const chooseLockMode = () => chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character with a cost of 7 or less that cannot attack this turn.",
            optional: true,
            filter: card => getCardEffectiveCost(card) <= 7,
            onSelect: ({ card, playerKey }) => {
                const targetPlayer = playerKey ? gameState?.[playerKey] : getPlayerForBoardCard(card);
                const targetPlayerKey = getPlayerKey(targetPlayer);

                if (isProtectedFromOpponentEffects(card, targetPlayerKey, player)) {
                    addGameLog(`${card.name} is protected from opponent effects.`);
                    return;
                }

                markCardCannotAttackThisTurn(card);
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} made ${card.name} unable to attack this turn.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not choose a character to lock with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no cost 7 or lower characters.`
        });

        if (ui?.chooseEffectOption) {
            ui.chooseEffectOption({
                player,
                sourceCard,
                title: sourceCard.name,
                prompt: "Choose one effect for Wooden Ball.",
                options: [
                    {
                        label: "K.O. rested",
                        value: "ko"
                    },
                    {
                        label: "Lock attack",
                        value: "lock"
                    }
                ],
                onComplete: (choice) => {
                    const message = choice === "lock"
                        ? chooseLockMode()
                        : chooseKoMode();

                    if (message) {
                        addGameLog(message);
                    }
                }
            });

            return `${player.name} is choosing ${sourceCard.name}'s mode.`;
        }

        return chooseKoMode();
    }

    if (effect.id === "JK02-005-main") {
        const restedCharacters = player.characters.filter(card => {
            return card?.cardType === "character" &&
                (card.state || "active") === "rested";
        });

        if (restedCharacters.length < 2) {
            return `${sourceCard.name}'s Main effect requires 2 or more rested Characters.`;
        }

        return chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 of your cost 5 or lower Characters to set active and give Rush this turn.",
            optional: true,
            includeLeader: false,
            filter: card => card.cardType === "character" && getCardEffectiveCost(card) <= 5,
            onSelect: ({ card }) => {
                card.uiAnimation = "readied";
                card.state = "active";
                addTemporaryKeyword(card, "rush");
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} set ${card.name} as active and gave it Rush this turn.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not choose a character for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no cost 5 or lower characters.`
        });
    }

    if (effect.id === "JK02-006-main") {
        const chosenInstanceIds = new Set();

        const chooseNextCharacter = () => {
            const availableChoices = getOwnBoardChoices(player, {
                includeLeader: false,
                filter: card => {
                    return card.cardType === "character" &&
                        (card.state || "active") === "rested" &&
                        !chosenInstanceIds.has(card.instanceId);
                }
            });

            if (availableChoices.length === 0 || chosenInstanceIds.size >= 3) {
                return;
            }

            const chooseMessage = chooseOwnBoardCard(player, sourceCard, {
                prompt: `Choose up to 1 rested Character ${chosenInstanceIds.size + 1} of 3 to set active and give +2000 power.`,
                optional: true,
                includeLeader: false,
                filter: card => {
                    return card.cardType === "character" &&
                        (card.state || "active") === "rested" &&
                        !chosenInstanceIds.has(card.instanceId);
                },
                onSelect: ({ card }) => {
                    chosenInstanceIds.add(card.instanceId);
                    card.uiAnimation = "readied";
                    card.state = "active";
                    addTemporaryPowerBonus(card, 2000);
                    ui?.renderCharacters?.();
                    addGameLog(`${sourceCard.name} set ${card.name} as active and gave it +2000 power this turn.`);

                    if (typeof queueMultiplayerStateSync === "function") {
                        queueMultiplayerStateSync();
                    }

                    chooseNextCharacter();
                },
                skipMessage: `${player.name} stopped choosing Characters for ${sourceCard.name}.`,
                emptyMessage: `${sourceCard.name} found no rested Characters.`
            });

            if (chooseMessage) {
                addGameLog(chooseMessage);
            }
        };

        chooseNextCharacter();
        return `${player.name} is choosing up to 3 rested Characters for ${sourceCard.name}.`;
    }

    if (effect.id === "JK02-007-main") {
        if (!CardEffects.hasCardName(player.leader, "Hanami")) {
            return `${sourceCard.name}'s Main effect did not resolve because ${player.name}'s leader is not Hanami.`;
        }

        const expiringPlayerKey = getPlayerKey(player);
        const expiresAtEndOfTurns = Number(player.turns || 0);
        const finishCostReduction = () => chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character to give -2 cost this turn.",
            optional: true,
            onSelect: ({ card }) => {
                addCostModifier(card, -2);
                addGameLog(`${sourceCard.name} gave ${card.name} -2 cost this turn.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not reduce a character's cost with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing characters for cost reduction.`
        });

        const negateMessage = chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing character with a cost of 8 or less to negate this turn.",
            optional: true,
            filter: card => getCardEffectiveCost(card) <= 8,
            onSelect: ({ card, playerKey }) => {
                const targetPlayer = playerKey ? gameState?.[playerKey] : getPlayerForBoardCard(card);
                const targetPlayerKey = getPlayerKey(targetPlayer);

                if (isProtectedFromOpponentEffects(card, targetPlayerKey, player)) {
                    addGameLog(`${card.name} is protected from opponent effects.`);
                    return;
                }

                addTemporaryEffectNegation(card, expiringPlayerKey, expiresAtEndOfTurns);
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} negated ${card.name}'s effects for this turn.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }

                const message = finishCostReduction();

                if (message) {
                    addGameLog(message);
                }
            },
            onSkip: () => {
                const message = finishCostReduction();

                if (message) {
                    addGameLog(message);
                }
            },
            onEmpty: () => {
                const message = finishCostReduction();

                if (message) {
                    addGameLog(message);
                }
            },
            skipMessage: `${player.name} did not negate a character with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no cost 8 or lower characters to negate.`
        });

        return `${negateMessage} Then ${player.name} will choose a character to give -2 cost.`;
    }

    if (effect.id === "JK02-009-main") {
        const restedCharacters = player.characters.filter(card => {
            return card?.cardType === "character" &&
                (card.state || "active") === "rested";
        });

        if (restedCharacters.length < 4) {
            return `${sourceCard.name}'s Main effect requires 4 rested Characters.`;
        }

        const chosenInstanceIds = new Set();

        const chooseNextKOTarget = () => {
            if (chosenInstanceIds.size >= 2) {
                return;
            }

            const chooseMessage = chooseOpponentCharacter(player, sourceCard, {
                prompt: `Choose opposing Character ${chosenInstanceIds.size + 1} of 2 with cost 5 or less to K.O.`,
                optional: true,
                filter: card => {
                    return getCardEffectiveCost(card) <= 5 &&
                        !chosenInstanceIds.has(card.instanceId);
                },
                onSelect: ({ card, playerKey, slotIndex }) => {
                    chosenInstanceIds.add(card.instanceId);
                    addGameLog(removeCharacterByOpponentEffect(player, gameState[playerKey], slotIndex, sourceCard, ui));

                    if (typeof queueMultiplayerStateSync === "function") {
                        queueMultiplayerStateSync();
                    }

                    chooseNextKOTarget();
                },
                skipMessage: `${player.name} stopped choosing K.O. targets for ${sourceCard.name}.`,
                emptyMessage: `${sourceCard.name} found no cost 5 or lower characters to K.O.`
            });

            if (chooseMessage) {
                addGameLog(chooseMessage);
            }
        };

        chooseNextKOTarget();
        return `${player.name} is choosing up to 2 characters to K.O. with ${sourceCard.name}.`;
    }

    if (effect.id === "JK02-013-on-play") {
        return chooseOwnBoardCard(player, sourceCard, {
            prompt: "Choose up to 1 of your rested Characters with a cost of 5 or less to set as active.",
            optional: true,
            includeLeader: false,
            filter: card => {
                return card.cardType === "character" &&
                    getCardEffectiveCost(card) <= 5 &&
                    (card.state || "active") === "rested";
            },
            onSelect: ({ card }) => {
                card.uiAnimation = "readied";
                card.state = "active";
                ui?.renderCharacters?.();
                addGameLog(`${sourceCard.name} set ${card.name} as active.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not choose a Character for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no rested cost 5 or lower Characters.`
        });
    }

    if (effect.id === "JK02-014-on-play") {
        sourceCard.uiAnimation = "readied";
        sourceCard.state = "active";
        ui?.renderCharacters?.();

        const restedCharacters = player.characters.filter(card => {
            return card?.cardType === "character" &&
                (card.state || "active") === "rested";
        });

        if (restedCharacters.length < 3) {
            return `${sourceCard.name} set itself as active but found fewer than 3 rested Characters.`;
        }

        return chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing Character with a cost of 5 or less to K.O. If you do, draw 1 card.",
            optional: true,
            filter: card => getCardEffectiveCost(card) <= 5,
            onSelect: ({ playerKey, slotIndex }) => {
                const message = removeCharacterByOpponentEffect(player, gameState[playerKey], slotIndex, sourceCard, ui);

                addGameLog(message);

                if (!message.includes("K.O.'d")) {
                    return;
                }

                const drawResult = drawCard(player, ui);

                addGameLog(
                    drawResult?.deckOut
                        ? `${sourceCard.name} tried to draw 1 card after the K.O., but ${player.name} lost by deck out.`
                        : `${sourceCard.name} drew 1 card after the K.O.`
                );

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not K.O. a Character with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing cost 5 or lower Characters.`
        });
    }

    if (effect.id === "JK02-017-on-play") {
        const restedCharacters = player.characters.filter(card => {
            return card?.cardType === "character" &&
                (card.state || "active") === "rested";
        });

        if (restedCharacters.length < 2) {
            return `${sourceCard.name}'s On Play effect found fewer than 2 rested Characters.`;
        }

        return resolveDrawTwoTrashOne(player, sourceCard, ui);
    }

    if (effect.id === "JK02-021-on-play") {
        return lookTopCardsForType(player, sourceCard, 5, "", ui, {
            isSelectable: card => {
                return hasTypeText(card, "Curse Spirit") ||
                    card.cardType === "event";
            }
        });
    }

    if (effect.id === "JK02-008-on-play") {
        const restedCharacters = player.characters.filter(card => {
            return card?.cardType === "character" &&
                (card.state || "active") === "rested";
        });

        if (restedCharacters.length < 2) {
            return `${sourceCard.name}'s On Play effect requires 2 or more rested Characters.`;
        }

        return chooseOpponentCharacterToKO(player, sourceCard, ui, 4, false);
    }

    if (effect.id === "JK02-011-on-play") {
        return chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose 1 opposing Character to give -4 cost this turn.",
            optional: false,
            onSelect: ({ card }) => {
                addCostModifier(card, -4);
                addGameLog(`${sourceCard.name} gave ${card.name} -4 cost this turn.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            emptyMessage: `${sourceCard.name} found no opposing Characters.`
        });
    }

    if (effect.id === "JK02-012-on-play") {
        return chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing Character to give -3 cost this turn.",
            optional: true,
            onSelect: ({ card }) => {
                addCostModifier(card, -3);
                addGameLog(`${sourceCard.name} gave ${card.name} -3 cost this turn.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not choose a Character for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no opposing Characters.`
        });
    }

    if (effect.id === "JK02-015-on-play") {
        const opponent = getOpponentOfPlayer(player);
        let reducedCount = 0;

        opponent?.characters?.forEach(card => {
            if (!card || getCardEffectiveCost(card) > 8) {
                return;
            }

            if (isProtectedFromOpponentEffects(card, getPlayerKey(opponent), player)) {
                return;
            }

            addCostModifier(card, -5);
            reducedCount += 1;
        });

        ui?.renderCharacters?.();

        const chooseMessage = chooseOpponentCharacterToKO(player, sourceCard, ui, 6, false);

        return `${sourceCard.name} gave -5 cost to ${reducedCount} opposing Character${reducedCount === 1 ? "" : "s"} this turn. ${chooseMessage}`;
    }

    if (effect.id === "JK02-019-on-play") {
        return resolveKenjakuOnPlay(player, sourceCard, ui);
    }

    if (effect.id === "JK02-020-on-play") {
        return chooseOpponentCharacterToKO(player, sourceCard, ui, 1, false);
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

    if (copiedEffect.type === "onOpponentAttack" || copiedEffect.type === "onOpponentsAttack") {
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

        const trashResult = trashCharacterFromField(player, sourceSlotIndex, ui, {
            render: false
        });
        const trashedCard = trashResult.character;
        const linkedStageMessage = trashResult.linkedStageMessage;
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

                refreshCardStatDisplay(ownTarget);
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

            const trashResult = trashCharacterFromField(player, slotIndex, ui, {
                render: false
            });
            const linkedStageMessage = trashResult.linkedStageMessage;
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

                playedCard.state = getPlayedCharacterInitialState(player);
                playedCard.playedOnTurn = player.turns;
                playedCard.playedFromZone = "trash";
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

function getTrashCardChoices(player, filter) {
    const playerKey = getPlayerKey(player);

    return player?.trash
        ?.map((card, trashIndex) => ({
            playerKey,
            cardType: "trash",
            trashIndex,
            card
        }))
        .filter(choice => choice.card && (!filter || filter(choice.card, choice))) ?? [];
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

function resolveDeathEggOnPlay(player, sourceCard, ui) {
    const ownCharacters = player.characters.filter(Boolean);
    const linkedStageMessages = [];

    ownCharacters.forEach(character => {
        character.state = "active";

        const destinationPlayer = getCardZoneDestinationPlayer(player, character);

        destinationPlayer.hand.push(character);

        const linkedStageMessage = trashLinkedParfumStageForCharacter(player, character, ui);

        if (linkedStageMessage) {
            linkedStageMessages.push(linkedStageMessage);
        }
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

    return `${sourceCard.name} returned ${ownCharacters.length} character${ownCharacters.length === 1 ? "" : "s"} from ${player.name}'s field to their owners' hands. ${[...linkedStageMessages, ...messages].filter(Boolean).join(" ")}`;
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

function lookTopCardsAddOneToHandTrashRest(player, sourceCard, amount, ui, options = {}) {
    if (!player || !sourceCard) {
        return "";
    }

    const cardsToLookAt = player.deck.splice(0, amount);

    if (cardsToLookAt.length === 0) {
        return `${sourceCard.name}'s effect found no cards because ${player.name}'s deck is empty.`;
    }

    const isSelectable = options.isSelectable || (() => true);

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
            addGameLog(`${player.name} revealed ${selectedCard.name} and added it to hand.`);
        } else {
            addGameLog(`${player.name} did not add a card with ${sourceCard.name}'s effect.`);
        }

        const trashedCards = cardsToLookAt.map(card => assignCardInstance(card));
        player.trash.push(...trashedCards);

        ui?.renderHands?.();
        ui?.renderDecks?.();
        ui?.renderTrash?.();

        addGameLog(`${player.name} trashed the remaining ${trashedCards.length} card${trashedCards.length === 1 ? "" : "s"} from the looked-at cards.`);
        options.onResolved?.(selectedCard, trashedCards);

        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }
    };

    if (ui && typeof ui.lookTopCardsAddToHand === "function") {
        ui.lookTopCardsAddToHand({
            player,
            sourceCard,
            cards: cardsToLookAt,
            isSelectable,
            allowTopOrBottomPlacement: false,
            onComplete: finishSelection
        });

        return `${player.name} is looking at the top ${cardsToLookAt.length} card${cardsToLookAt.length === 1 ? "" : "s"} of the deck.`;
    }

    const firstValidIndex = cardsToLookAt.findIndex(isSelectable);
    finishSelection(firstValidIndex === -1 ? null : firstValidIndex);

    return `${sourceCard.name}'s look top effect resolved.`;
}

function lookTopCardsForTypeAddUpTo(player, sourceCard, amount, maxAdds, typeText, ui, options = {}) {
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
        const selectedIndices = Array.isArray(selection?.selectedIndices)
            ? selection.selectedIndices
            : [];
        const fallbackSelectedIndex = typeof selection === "object" && selection !== null
            ? selection.selectedIndex
            : selection;
        const orderedBottomIndices = Array.isArray(selection?.bottomOrder)
            ? selection.bottomOrder
            : null;
        const selectedIndexSequence = (selectedIndices.length > 0
            ? selectedIndices
            : [fallbackSelectedIndex]
        ).filter((index, position, array) => (
            Number.isInteger(index) &&
            index >= 0 &&
            index < originalCardsToLookAt.length &&
            array.indexOf(index) === position
        ));
        const selectedCards = selectedIndexSequence
            .map(index => originalCardsToLookAt[index])
            .filter(card => isSelectable(card))
            .filter(Boolean);

        selectedCards.forEach(card => {
            const cardIndex = cardsToLookAt.indexOf(card);

            if (cardIndex !== -1) {
                cardsToLookAt.splice(cardIndex, 1);
            }
        });

        if (selectedCards.length > 0) {
            selectedCards.forEach(card => {
                player.hand.push(assignCardInstance(card));
                addGameLog(`${player.name} revealed ${card.name} and added it to hand.`);
            });
        } else {
            addGameLog(`${player.name} did not add a card with ${sourceCard.name}'s effect.`);
        }

        const orderedBottomCards = Array.isArray(orderedBottomIndices)
            ? orderedBottomIndices
                .map(index => originalCardsToLookAt[index])
                .filter(card => cardsToLookAt.includes(card))
                .filter(Boolean)
            : [...cardsToLookAt];
        const orderedSet = new Set(orderedBottomCards);
        const unorderedBottomCards = cardsToLookAt.filter(card => !orderedSet.has(card));

        player.deck.push(...orderedBottomCards, ...unorderedBottomCards);

        ui?.renderHands?.();
        ui?.renderDecks?.();

        if (cardsToLookAt.length > 0) {
            addGameLog(`${player.name} placed the remaining card${cardsToLookAt.length === 1 ? "" : "s"} on the bottom of the deck.`);
        }

        options.onResolved?.();
    };

    if (ui && typeof ui.lookTopCardsAddToHand === "function") {
        ui.lookTopCardsAddToHand({
            player,
            sourceCard,
            cards: cardsToLookAt,
            isSelectable,
            maxSelectable: maxAdds,
            descriptionText: `Choose up to ${maxAdds} eligible card${maxAdds === 1 ? "" : "s"} to add to ${player.name}'s hand. Return the rest to the bottom of the deck in the order you want.`,
            onComplete: finishSelection
        });

        return `${player.name} is looking at the top ${cardsToLookAt.length} card${cardsToLookAt.length === 1 ? "" : "s"} of the deck.`;
    }

    const selectedCards = [];

    const placeRemainingCards = (orderedRemainingCards) => {
        player.deck.push(...orderedRemainingCards);

        ui?.renderHands?.();
        ui?.renderDecks?.();

        if (orderedRemainingCards.length > 0) {
            addGameLog(`${player.name} placed the remaining card${orderedRemainingCards.length === 1 ? "" : "s"} on the bottom of the deck.`);
        }

        options.onResolved?.();
    };

    const finishLegacySelection = () => {
        if (selectedCards.length > 0) {
            selectedCards.forEach(card => {
                player.hand.push(assignCardInstance(card));
                addGameLog(`${player.name} revealed ${card.name} and added it to hand.`);
            });
        } else {
            addGameLog(`${player.name} did not add a card with ${sourceCard.name}'s effect.`);
        }

        if (cardsToLookAt.length <= 1 || !ui?.chooseBoardCard) {
            placeRemainingCards([...cardsToLookAt]);
            return;
        }

        const totalRemainingCount = cardsToLookAt.length;
        const orderedRemainingCards = [];

        const chooseNextRemainingCard = () => {
            if (cardsToLookAt.length === 0) {
                placeRemainingCards(orderedRemainingCards);
                return "";
            }

            return chooseBoardCard(player, sourceCard, cardsToLookAt.map((card, choiceIndex) => ({
                card,
                choiceIndex
            })), {
                prompt: `Choose remaining card ${orderedRemainingCards.length + 1} of ${totalRemainingCount} to place on the bottom of your deck next.`,
                optional: false,
                onSelect: ({ choiceIndex }) => {
                    const orderedCard = cardsToLookAt.splice(choiceIndex, 1)[0];

                    if (!orderedCard) {
                        addGameLog(`${sourceCard.name} could not order that card anymore.`);
                        placeRemainingCards([...orderedRemainingCards, ...cardsToLookAt]);
                        return;
                    }

                    orderedRemainingCards.push(orderedCard);

                    const chooseMessage = chooseNextRemainingCard();

                    if (chooseMessage) {
                        addGameLog(chooseMessage);
                    }
                },
                onEmpty: () => {
                    placeRemainingCards([...orderedRemainingCards, ...cardsToLookAt]);
                }
            });
        };

        const chooseMessage = chooseNextRemainingCard();

        if (chooseMessage) {
            addGameLog(chooseMessage);
        }
    };

    const chooseNextCard = () => {
        if (selectedCards.length >= maxAdds) {
            finishLegacySelection();
            return "";
        }

        const choices = cardsToLookAt
            .map((card, choiceIndex) => ({
                card,
                choiceIndex
            }))
            .filter(choice => isSelectable(choice.card));

        if (choices.length === 0) {
            finishLegacySelection();
            return "";
        }

        return chooseBoardCard(player, sourceCard, choices, {
            prompt: `Choose up to 1 eligible card to add to your hand (${selectedCards.length + 1} of ${maxAdds}).`,
            optional: true,
            onSelect: ({ choiceIndex }) => {
                const selectedCard = cardsToLookAt.splice(choiceIndex, 1)[0];

                if (!selectedCard) {
                    addGameLog(`${sourceCard.name} could not find that card anymore.`);
                    finishLegacySelection();
                    return;
                }

                selectedCards.push(selectedCard);

                const chooseMessage = chooseNextCard();

                if (chooseMessage) {
                    addGameLog(chooseMessage);
                }
            },
            onSkip: finishLegacySelection,
            onEmpty: finishLegacySelection,
            skipMessage: `${player.name} stopped adding cards with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no eligible cards.`
        });
    };

    const chooseMessage = chooseNextCard();

    return chooseMessage || `${sourceCard.name}'s effect resolved.`;
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

    const previewStage = stageLocation.zone.cards[stageLocation.index];

    if (!canPlayStageToArea(player, previewStage)) {
        shuffleDeck(player.deck);

        if (ui?.renderDecks) {
            ui.renderDecks();
        }

        return `${sourceCard.name} could not play a Zangetsu stage because Parfum is already in play. ${player.name} shuffled the deck.`;
    }

    const stage = stageLocation.zone.cards.splice(stageLocation.index, 1)[0];

    if (stageLocation.zone.name === "hand" && player.deck.length) {
        player.hand.push(assignCardInstance(player.deck.shift()));
    }

    if (stageLocation.zone.name === "life" && player.deck.length) {
        addCardToLife(player, assignCardInstance(player.deck.shift()), ui, {
            position: "bottom",
            render: false
        });
    }

    const replacementMessage = replaceStageOnFieldIfNeeded(player, stage, ui);

    stage.state = "active";
    stage.uiAnimation = "played";
    player.stage = stage;

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

    return replacementMessage
        ? `${replacementMessage} ${sourceCard.name} played ${stage.name} from the deck, then shuffled the deck.`
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

    addCardToLife(player, topDeckCard, ui);

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

    const shouldDeferCombatChoice = Boolean(
        typeof currentAttack !== "undefined" &&
        currentAttack &&
        gameState?.currentPhase === "attackResolving" &&
        typeof ui?.beginDeferredCombatResolution === "function" &&
        typeof ui?.endDeferredCombatResolution === "function"
    );

    const finishSelection = (choice) => {
        try {
            if (!choice) {
                addGameLog(options.skipMessage || `${player.name} did not choose a card for ${sourceCard.name}.`);

                if (typeof options.onSkip === "function") {
                    options.onSkip();
                }

                return;
            }

            options.onSelect(choice);
        } finally {
            if (shouldDeferCombatChoice) {
                ui.endDeferredCombatResolution();
            }
        }
    };

    if (ui && typeof ui.chooseBoardCard === "function") {
        if (shouldDeferCombatChoice) {
            ui.beginDeferredCombatResolution();
        }

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

function addDurationKeyword(card, keyword, expiresAtEndOfTurns, expiresAtPlayerKey = null) {
    if (!card) {
        return;
    }

    if (!Array.isArray(card.durationKeywords)) {
        card.durationKeywords = [];
    }

    card.durationKeywords.push({
        keyword,
        expiresAtEndOfTurns,
        expiresAtPlayerKey
    });

    refreshCardStatDisplay(card);
}

function addBattleKeyword(card, keyword) {
    if (!card.battleKeywords) {
        card.battleKeywords = [];
    }

    card.battleKeywords.push(keyword);
}

function refreshCardStatDisplay(card) {
    if (!card) {
        return;
    }

    if ((card.cardType === "leader" || card.cardType === "character") && typeof renderLeaders === "function") {
        renderLeaders();
    }

    if ((card.cardType === "leader" || card.cardType === "character") && typeof renderCharacters === "function") {
        renderCharacters();
    }

    if (card.cardType === "stage" && typeof renderStages === "function") {
        renderStages();
    }
}

function addBattlePowerBonus(card, amount) {
    card.battlePowerBonus = Number(card.battlePowerBonus || 0) + amount;
    refreshCardStatDisplay(card);
}

function addTemporaryPowerBonus(card, amount) {
    if (!card) {
        return;
    }

    card.temporaryPowerBonus = Number(card.temporaryPowerBonus || 0) + Number(amount || 0);
    refreshCardStatDisplay(card);
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

    refreshCardStatDisplay(card);
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
    refreshCardStatDisplay(card);
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

    const smallpoxReplacement = getAvailableSmallpoxRemovalReplacement(targetPlayer, actingPlayer);

    if (smallpoxReplacement) {
        const useReplacement = () => {
            smallpoxReplacement.uiAnimation = "rested";
            smallpoxReplacement.state = "rested";
            ui?.renderCharacters?.();

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }

            return `${smallpoxReplacement.name} rested instead, so ${card.name} stayed on the field.`;
        };

        if (ui?.chooseEffectActivation) {
            ui.chooseEffectActivation({
                player: targetPlayer,
                sourceCard: smallpoxReplacement,
                effect: smallpoxReplacement.effects?.find(cardEffect => cardEffect.id === "JK02-014-protection") || {
                    id: "JK02-014-protection",
                    type: "continuous",
                    text: "Rest this Character instead?"
                },
                title: smallpoxReplacement.name,
                prompt: `${card.name} would be removed by ${sourceCard.name}. Rest ${smallpoxReplacement.name} instead?`,
                activateText: "Rest Instead",
                skipText: "Let Remove",
                onComplete: (shouldActivate) => {
                    addGameLog(shouldActivate ? useReplacement() : finishCharacterRemovalByOpponentEffect(actingPlayer, targetPlayer, slotIndex, sourceCard, ui));
                }
            });

            return `${targetPlayer.name} is choosing whether to use ${smallpoxReplacement.name}'s replacement effect.`;
        }

        return useReplacement();
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

function getAvailableSmallpoxRemovalReplacement(targetPlayer, actingPlayer) {
    if (!targetPlayer || !actingPlayer || targetPlayer === actingPlayer) {
        return null;
    }

    if (areOpponentReplacementEffectsNegated(targetPlayer, actingPlayer)) {
        return null;
    }

    return targetPlayer.characters.find(card => {
        return card?.cardNumber === "JK02-014" &&
            !areCardEffectsNegated(card) &&
            (card.state || "active") === "active" &&
            canCardBeRested(card);
    }) || null;
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

    if (!result.success) {
        return result.message;
    }

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
        const imuReplacement = getAvailableImuStageProtectionReplacement(targetPlayer, actingPlayer);

        if (!imuReplacement) {
            return finishRemoval();
        }

        const useImuReplacement = () => {
            const imuSlotIndex = targetPlayer.characters.findIndex(card => {
                return card?.instanceId === imuReplacement.instanceId;
            });

            if (imuSlotIndex === -1) {
                return finishRemoval();
            }

            const trashResult = trashCharacterFromField(targetPlayer, imuSlotIndex, ui);

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }

            return trashResult.linkedStageMessage
                ? `${imuReplacement.name} was trashed instead, so ${stage.name} stayed in play. ${trashResult.linkedStageMessage}`
                : `${imuReplacement.name} was trashed instead, so ${stage.name} stayed in play.`;
        };

        if (ui?.chooseEffectActivation) {
            ui.chooseEffectActivation({
                player: targetPlayer,
                sourceCard: imuReplacement,
                effect: imuReplacement.effects?.find(cardEffect => cardEffect.id === "IMU1-005-stage-protection") || {
                    id: "IMU1-005-stage-protection",
                    type: "replacement",
                    text: "Trash this Character instead?"
                },
                title: imuReplacement.name,
                prompt: `${stage.name} would be removed by ${sourceCard.name}. Trash ${imuReplacement.name} instead?`,
                activateText: "Trash Instead",
                skipText: "Let Remove",
                onComplete: (shouldActivate) => {
                    addGameLog(shouldActivate ? useImuReplacement() : finishRemoval());
                }
            });

            return `${targetPlayer.name} is choosing whether to use ${imuReplacement.name}'s replacement effect.`;
        }

        return useImuReplacement();
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

    const kashimoMessage = resolveHajimeKashimoLifeTakenEffects(player, ui);

    if (kashimoMessage) {
        addGameLog(kashimoMessage);
    }

    return card;
}

function takeLifeCardToHand(player, ui, options = {}) {
    if (!player?.life?.length) {
        loseByLifeDamage(player, `${player.name} tried to add life to hand with no life cards remaining.`);
        return null;
    }

    const fromBottom = options.position === "bottom";
    const card = fromBottom
        ? player.life.pop()
        : player.life.shift();

    if (!card) {
        loseByLifeDamage(player, `${player.name} tried to add life to hand with no life cards remaining.`);
        return null;
    }

    card.faceUp = false;
    player.hand.push(card);

    ui?.renderLifeCards?.();
    ui?.renderHands?.();

    const kashimoMessage = resolveHajimeKashimoLifeTakenEffects(player, ui);

    if (kashimoMessage) {
        addGameLog(kashimoMessage);
    }

    return card;
}

function takeAllLifeToHand(player, ui) {
    if (!player) {
        return {
            success: false,
            cardsMoved: 0,
            remainingLife: 0,
            winnerPlayer: null,
            reasonTitle: "",
            reasonText: "",
            message: "No player was found."
        };
    }

    const movedCards = [];

    while (player.life.length > 0) {
        const card = player.life.shift();

        if (!card) {
            break;
        }

        card.faceUp = false;
        player.hand.push(card);
        movedCards.push(card);
    }

    ui?.renderLifeCards?.();
    ui?.renderHands?.();

    if (movedCards.length > 0) {
        const kashimoMessage = resolveHajimeKashimoLifeTakenEffects(player, ui);

        if (kashimoMessage) {
            addGameLog(kashimoMessage);
        }
    }

    const winCondition = getLifeZeroWinConditionWinner(player);

    if (winCondition && (typeof currentAttack === "undefined" || !currentAttack) && typeof endGame === "function") {
        endGame(
            winCondition.winnerPlayer,
            winCondition.reasonTitle,
            winCondition.reasonText
        );
    }

    return {
        success: movedCards.length > 0,
        cardsMoved: movedCards.length,
        remainingLife: player.life.length,
        winnerPlayer: winCondition?.winnerPlayer || null,
        reasonTitle: winCondition?.reasonTitle || "",
        reasonText: winCondition?.reasonText || "",
        message: movedCards.length > 0
            ? `${player.name} added ${movedCards.length} remaining life card${movedCards.length === 1 ? "" : "s"} to hand.`
            : `${player.name} had no remaining life cards to add to hand.`
    };
}

function takeLifeToHandUntilCount(player, ui, minimumLifeToKeep = 1) {
    if (!player) {
        return {
            success: false,
            cardsMoved: 0,
            remainingLife: 0,
            message: "No player was found."
        };
    }

    const movedCards = [];

    while (player.life.length > minimumLifeToKeep) {
        const card = player.life.shift();

        if (!card) {
            break;
        }

        card.faceUp = false;
        player.hand.push(card);
        movedCards.push(card);
    }

    ui?.renderLifeCards?.();
    ui?.renderHands?.();

    if (movedCards.length > 0) {
        const kashimoMessage = resolveHajimeKashimoLifeTakenEffects(player, ui);

        if (kashimoMessage) {
            addGameLog(kashimoMessage);
        }
    }

    return {
        success: movedCards.length > 0,
        cardsMoved: movedCards.length,
        remainingLife: player.life.length,
        message: movedCards.length > 0
            ? `${player.name} added ${movedCards.length} life card${movedCards.length === 1 ? "" : "s"} to hand and kept ${player.life.length} in life.`
            : `${player.name} already had ${player.life.length} or fewer life cards.`
    };
}

function moveOwnCharacterToLife(player, slotIndex, ui, options = {}) {
    const character = player?.characters?.[slotIndex];

    if (!player || !character) {
        return {
            success: false,
            message: "No character was found to move to life."
        };
    }

    player.characters[slotIndex] = null;

    const destinationPlayer = getCardZoneDestinationPlayer(player, character);

    clearParfumControlState(character);
    addCardToLife(destinationPlayer, character, ui, {
        position: options.position === "bottom" ? "bottom" : "top",
        faceUp: options.faceUp === true,
        render: false
    });

    resolveGutsLeaderCharacterRemovedBonus(player, ui);
    const linkedStageMessage = trashLinkedParfumStageForCharacter(player, character, ui);

    ui?.renderLeaders?.();
    ui?.renderCharacters?.();
    ui?.renderLifeCards?.();
    ui?.renderTrash?.();

    return {
        success: true,
        card: character,
        destinationPlayer,
        linkedStageMessage,
        message: linkedStageMessage
            ? `${character.name} was placed in ${destinationPlayer.name}'s life cards. ${linkedStageMessage}`
            : `${character.name} was placed in ${destinationPlayer.name}'s life cards.`
    };
}

function hasJujutsuOrCullingGameLeader(player) {
    const leader = player?.leader;

    return Boolean(leader) && (
        hasTypeText(leader, "Culling Game Participant") ||
        hasTypeText(leader, "Jujutsu High")
    );
}

function hasContinuousOpponentEffectProtection(card, actingPlayer) {
    if (!card || !actingPlayer || card.cardType !== "character") {
        return false;
    }

    const owner = getPlayerForBoardCard(card);

    if (!owner || owner === actingPlayer) {
        return false;
    }

    if (areCardEffectsNegated(card)) {
        return false;
    }

    if (card.cardNumber === "JK01-008") {
        return hasJujutsuOrCullingGameLeader(owner);
    }

    if (card.cardNumber === "JK01-009") {
        return hasTypeText(owner.leader, "Culling Game Participant");
    }

    if (hasRamBoostedRem(card)) {
        return true;
    }

    return false;
}

function isProtectedFromOpponentEffects(card, cardPlayerKey, actingPlayer) {
    if (hasContinuousOpponentEffectProtection(card, actingPlayer)) {
        return true;
    }

    if (!card?.protectedFromOpponentEffects) {
        return false;
    }

    const actingPlayerKey = getPlayerKey(actingPlayer);

    return actingPlayerKey && actingPlayerKey !== cardPlayerKey;
}

function resolveDrawTwoTrashTwo(player, sourceCard, ui, options = {}) {
    const finish = () => {
        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }

        options.onComplete?.();
    };

    const drawResult = drawCards(player, 2, ui);

    if (drawResult?.deckOut) {
        finish();
        return `${sourceCard.name}'s effect tried to draw 2 cards, but ${player.name} lost by deck out.`;
    }

    if (player.hand.length === 0) {
        finish();
        return `${sourceCard.name}'s effect drew 2 cards, but found no cards in hand to trash.`;
    }

    const trashAmount = Math.min(2, player.hand.length);

    chooseCardsFromHandToTrash(player, sourceCard, ui, trashAmount, () => {
        addGameLog(`${sourceCard.name}'s effect drew 2 cards and trashed ${trashAmount} card${trashAmount === 1 ? "" : "s"}.`);
        finish();
    });

    return `${sourceCard.name}'s effect drew 2 cards and is choosing ${trashAmount} card${trashAmount === 1 ? "" : "s"} to trash.`;
}

function resolveDrawTwoTrashOne(player, sourceCard, ui, options = {}) {
    const finish = () => {
        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }

        options.onComplete?.();
    };

    const drawResult = drawCards(player, 2, ui);

    if (drawResult?.deckOut) {
        return `${sourceCard.name}'s effect tried to draw 2 cards, but ${player.name} lost by deck out.`;
    }

    if (player.hand.length === 0) {
        return `${sourceCard.name}'s effect drew 2 cards, but found no cards in hand to trash.`;
    }

    chooseCardsFromHandToTrash(player, sourceCard, ui, 1, () => {
        addGameLog(`${sourceCard.name}'s effect drew 2 cards and trashed 1 card.`);
        finish();
    });

    return `${sourceCard.name}'s effect drew 2 cards and is choosing 1 card to trash.`;
}

function resolveHajimeKashimoLifeTakenEffects(player, ui) {
    const kashimos = player?.characters?.filter(card => {
        return card?.cardNumber === "JK01-010" && !areCardEffectsNegated(card);
    }) ?? [];

    if (kashimos.length === 0) {
        return "";
    }

    const shouldDeferCombatResolution = Boolean(
        typeof currentAttack !== "undefined" &&
        currentAttack &&
        typeof ui?.beginDeferredCombatResolution === "function" &&
        typeof ui?.endDeferredCombatResolution === "function"
    );

    if (shouldDeferCombatResolution) {
        ui.beginDeferredCombatResolution();
    }

    let effectIndex = 0;

    const finish = () => {
        if (shouldDeferCombatResolution) {
            ui.endDeferredCombatResolution();
        }
    };

    const resolveNext = () => {
        if (effectIndex >= kashimos.length) {
            finish();
            return;
        }

        const kashimo = kashimos[effectIndex++];
        const message = resolveDrawTwoTrashTwo(player, kashimo, ui, {
            onComplete: resolveNext
        });

        if (message) {
            addGameLog(message);
        }
    };

    resolveNext();

    return `${player.name} is resolving Hajime Kashimo's effect.`;
}

function addPersistentPowerBonus(card, amount) {
    if (!card) {
        return;
    }

    card.persistentPowerBonus = Number(card.persistentPowerBonus || 0) + Number(amount || 0);
    refreshCardStatDisplay(card);
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

    const previewStage = player.deck[stageIndex];

    if (!canPlayStageToArea(player, previewStage)) {
        shuffleDeck(player.deck);
        ui.renderDecks();
        return `${sourceCard.name} found Turbo Granny Form, but Parfum is already in play. ${player.name} shuffled the deck.`;
    }

    const stage = player.deck.splice(stageIndex, 1)[0];
    const replacementMessage = replaceStageOnFieldIfNeeded(player, stage, ui);

    stage.state = "active";
    player.stage = stage;

    shuffleDeck(player.deck);

    ui.renderDecks();
    ui.renderStages();
    ui.renderTrash();

    return replacementMessage
        ? `${replacementMessage} ${sourceCard.name} played ${stage.name} from the deck, then shuffled the deck.`
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

function getTotalAttachedDonCount(player) {
    if (!player) {
        return 0;
    }

    return [
        player.leader,
        ...(player.characters || []).filter(Boolean)
    ].reduce((total, card) => {
        return total + Number(card?.attachedDon || 0);
    }, 0);
}

function getTotalDonInPlay(player) {
    return getPlayerFieldDonCount(player);
}

function getPerTurnEffectUseLimit(effect) {
    const maxUsesPerTurn = Number(effect?.maxUsesPerTurn ?? 0);

    if (Number.isFinite(maxUsesPerTurn) && maxUsesPerTurn > 0) {
        return maxUsesPerTurn;
    }

    return effect?.oncePerTurn ? 1 : 0;
}

function hasReachedPerTurnEffectUseLimit(card, effect, turnNumber) {
    const limit = getPerTurnEffectUseLimit(effect);

    if (limit <= 0 || !card || !effect?.id) {
        return false;
    }

    return CardEffects.getPerTurnEffectUseCount(card, effect.id, turnNumber) >= limit;
}

function canUseOnOpponentAttackEffect(player, card, effect) {
    if (!player || !card || !effect) {
        return false;
    }

    if (effect.id === "KIL1-001-custom") {
        return card.cardNumber === "KIL1-001" &&
            Number(card.attachedDon || 0) >= 2 &&
            !CardEffects.hasUsedOncePerTurnEffect(card, effect.id, player.turns);
    }

    if (effect.id === "IMU1-007-on-opponents-attack") {
        return card.cardNumber === "IMU1-007" &&
            player.leader?.cardNumber === "IMU1-001" &&
            (player.deck?.length || 0) >= 2 &&
            Boolean(typeof currentAttack !== "undefined" && currentAttack) &&
            currentAttack.defenderPlayerKey === getPlayerKey(player) &&
            !hasReachedPerTurnEffectUseLimit(card, effect, player.turns);
    }

    if (effect.type !== "onOpponentAttack" && effect.type !== "onOpponentsAttack") {
        return false;
    }

    if (effect.id === "JK01-009-on-opponent-attack") {
        if (typeof currentAttack === "undefined" || !currentAttack) {
            return false;
        }

        return currentAttack.defenderPlayerKey === getPlayerKey(player) &&
            currentAttack.target?.cardType === "leader";
    }

    return !hasReachedPerTurnEffectUseLimit(card, effect, player.turns);
}

function canHigurumaLeaderActivateTrashEvent(player, card) {
    if (!player || !card || card.cardType !== "event") {
        return false;
    }

    const cardCost = Number(card.cost ?? card.playCost ?? 0);

    if (getTotalDonInPlay(player) <= 7 && cardCost >= 7) {
        return false;
    }

    return getCounterEffects(card, player).some(effect => {
        return effect.id === "JK01-002-counter" ||
            effect.id === "JK01-003-counter" ||
            effect.id === "JK01-004-counter" ||
            effect.id === "JK01-005-counter" ||
            effect.actionId === "eggmanCounterPower" ||
            effect.actionId === "leaderOrCharacterCounterPower" ||
            effect.actionId === "santenKesshunCounterPower" ||
            effect.actionId === "leaderCounterPower" ||
            Number(effect.powerModifier ?? 0) > 0;
    });
}

function negateCurrentAttack(sourceCard) {
    if (typeof currentAttack === "undefined" || !currentAttack) {
        return false;
    }

    currentAttack.negated = true;
    currentAttack.negatedBy = sourceCard?.name || "an effect";

    return true;
}

function queueAutoResolveNegatedAttack() {
    if (typeof currentAttack === "undefined" || !currentAttack?.negated || currentAttack.autoResolvingNegated) {
        return;
    }

    currentAttack.autoResolvingNegated = true;

    const resolveLater = () => {
        if (typeof currentAttack === "undefined" || !currentAttack?.negated) {
            return;
        }

        if (typeof resolveCurrentAttack === "function") {
            Promise.resolve(resolveCurrentAttack()).catch(error => {
                console.error("Failed to auto-resolve negated attack.", error);
            });
        }
    };

    if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
        window.setTimeout(resolveLater, 0);
        return;
    }

    resolveLater();
}

function resolveEvidenceCounterEffect(player, sourceCard, ui, options = {}) {
    const finish = (...args) => {
        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }

        options.onComplete?.(...args);

        if (options.autoResolveNegatedAttack !== false) {
            queueAutoResolveNegatedAttack();
        }
    };

    if (typeof currentAttack === "undefined" || !currentAttack) {
        finish();
        return `${sourceCard.name} could not be used because there is no current attack.`;
    }

    const attackerPlayer = gameState?.[currentAttack.attackerPlayerKey];
    const attackerCard = getBoardCardFromData(currentAttack.attacker);

    if (!attackerPlayer || !attackerCard) {
        finish();
        return `${sourceCard.name} could not find the attacking card.`;
    }

    const attackerPower = getCardBattlePower(attackerCard, attackerPlayer);

    if (attackerPower > 7000) {
        finish();
        return `${sourceCard.name} could not negate the attack because ${attackerCard.name} has ${attackerPower} power.`;
    }

    negateCurrentAttack(sourceCard);

    const topLifeCard = player.life?.[0];

    if (!topLifeCard) {
        finish();
        return `${sourceCard.name} negated the attack, but ${player.name} has no life card to reveal.`;
    }

    topLifeCard.faceUp = true;
    ui?.renderLifeCards?.();

    const resetTopLifeFaceDown = () => {
        if (player.life?.[0]?.instanceId === topLifeCard.instanceId) {
            player.life[0].faceUp = false;
            ui?.renderLifeCards?.();
        }
    };

    const completeNoBonus = () => {
        resetTopLifeFaceDown();
        finish();
    };

    const revealedTypeMatches = hasTypeText(topLifeCard, "Culling Game Participants") ||
        hasTypeText(topLifeCard, "Deadly Sentencing");

    if (!revealedTypeMatches) {
        completeNoBonus();
        return `${sourceCard.name} negated the attack and revealed ${topLifeCard.name}.`;
    }

    const completeChoice = (choice) => {
        if (choice === "hand") {
            const addedLifeCard = player.life.shift();

            if (addedLifeCard) {
                addedLifeCard.faceUp = false;
                player.hand.push(addedLifeCard);
                ui?.renderLifeCards?.();
                ui?.renderHands?.();
                addGameLog(`${player.name} added ${addedLifeCard.name} from life to hand with ${sourceCard.name}.`);

                const kashimoMessage = resolveHajimeKashimoLifeTakenEffects(player, ui);

                if (kashimoMessage) {
                    addGameLog(kashimoMessage);
                }
            }

            finish();
            return;
        }

        if (choice === "top" || choice === "bottom") {
            const drawResult = choice === "top"
                ? drawCard(player, ui)
                : drawCardFromBottom(player, ui);

            if (drawResult?.deckOut) {
                addGameLog(
                    choice === "top"
                        ? `${sourceCard.name} tried to draw from the top of the deck, but ${player.name} lost by deck out.`
                        : `${sourceCard.name} tried to draw from the bottom of the deck, but ${player.name} lost by deck out.`
                );
            } else {
                addGameLog(
                    choice === "top"
                        ? `${player.name} drew 1 card from the top of the deck with ${sourceCard.name}.`
                        : `${player.name} drew 1 card from the bottom of the deck with ${sourceCard.name}.`
                );
            }

            resetTopLifeFaceDown();
            finish();
            return;
        }

        completeNoBonus();
    };

    if (ui?.chooseEffectOption) {
        ui.chooseEffectOption({
            player,
            sourceCard,
            title: sourceCard.name,
            prompt: `Revealed ${topLifeCard.name}. Choose how to resolve ${sourceCard.name}.`,
            options: [
                {
                    label: "Add to Hand",
                    value: "hand"
                },
                {
                    label: "Draw Top",
                    value: "top"
                },
                {
                    label: "Draw Bottom",
                    value: "bottom"
                },
                {
                    label: "Skip",
                    value: null,
                    secondary: true
                }
            ],
            onComplete: completeChoice
        });

        return `${sourceCard.name} negated the attack and revealed ${topLifeCard.name}.`;
    }

    completeChoice("hand");
    return `${sourceCard.name} negated the attack and revealed ${topLifeCard.name}.`;
}

function resolveConfiscationCounterEffect(player, sourceCard, ui, options = {}) {
    const finish = (...args) => {
        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }

        options.onComplete?.(...args);

        if (options.autoResolveNegatedAttack !== false) {
            queueAutoResolveNegatedAttack();
        }
    };

    if (typeof currentAttack === "undefined" || !currentAttack) {
        finish();
        return `${sourceCard.name} could not be used because there is no current attack.`;
    }

    const attackerPlayer = gameState?.[currentAttack.attackerPlayerKey];
    const attackerCard = getBoardCardFromData(currentAttack.attacker);

    if (!attackerPlayer || !attackerCard) {
        finish();
        return `${sourceCard.name} could not find the attacking card.`;
    }

    const attackerPower = getCardBattlePower(attackerCard, attackerPlayer);

    if (attackerPower > 7000) {
        finish();
        return `${sourceCard.name} could not negate the attack because ${attackerCard.name} has ${attackerPower} power.`;
    }

    negateCurrentAttack(sourceCard);

    if (player.stage) {
        const stageReturnMessage = koStageFromField(player, player.stage, ui);

        if (stageReturnMessage) {
            addGameLog(stageReturnMessage);
        }
    } else {
        addGameLog(`${sourceCard.name} found no stage to trash.`);
    }

    const message = chooseOpponentCharacter(player, sourceCard, {
        prompt: "Choose up to 1 opposing character to negate its effects this turn.",
        optional: true,
        onSelect: ({ card }) => {
            addTemporaryEffectNegation(card, getPlayerKey(player), Number(player.turns || 0));
            ui?.renderCharacters?.();
            addGameLog(`${sourceCard.name} negated ${card.name}'s effects this turn.`);
            finish();
        },
        onSkip: finish,
        onEmpty: finish,
        skipMessage: `${player.name} did not choose a character for ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no opposing characters.`
    });

    return message
        ? `${sourceCard.name} negated the attack. ${message}`
        : `${sourceCard.name} negated the attack.`;
}

function resolveDeathPenaltyCounterEffect(player, sourceCard, ui, options = {}) {
    const finish = (...args) => {
        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }

        options.onComplete?.(...args);

        if (options.autoResolveNegatedAttack !== false) {
            queueAutoResolveNegatedAttack();
        }
    };

    if (typeof currentAttack === "undefined" || !currentAttack) {
        finish();
        return `${sourceCard.name} could not be used because there is no current attack.`;
    }

    const attackerPlayer = gameState?.[currentAttack.attackerPlayerKey];
    const attackerCard = getBoardCardFromData(currentAttack.attacker);

    if (!attackerPlayer || !attackerCard) {
        finish();
        return `${sourceCard.name} could not find the attacking card.`;
    }

    const attackerPower = getCardBattlePower(attackerCard, attackerPlayer);

    if (attackerPower > 10000) {
        finish();
        return `${sourceCard.name} could not negate the attack because ${attackerCard.name} has ${attackerPower} power.`;
    }

    negateCurrentAttack(sourceCard);

    if (!player.leader) {
        finish();
        return `${sourceCard.name} negated the attack, but ${player.name} has no leader to empower.`;
    }

    if ((player.life?.length || 0) > 3) {
        finish();
        return `${sourceCard.name} negated the attack, but ${player.name} has more than 3 life cards.`;
    }

    const expiresAtPlayerKey = getPlayerKey(player);
    const expiresAtEndOfTurns = Number(player.turns || 0) + 1;

    player.leader.temporaryBasePower = {
        value: 9000,
        expiresAtPlayerKey,
        expiresAtEndOfTurns
    };
    addDurationKeyword(player.leader, "doubleAttack", expiresAtEndOfTurns, expiresAtPlayerKey);
    refreshCardStatDisplay(player.leader);
    ui?.renderLeaders?.();

    addGameLog(`${sourceCard.name} made ${player.leader.name}'s base power 9000 and gave it Double Attack until the end of ${player.name}'s next turn.`);
    finish();
    return `${sourceCard.name} negated the attack and empowered ${player.leader.name} until the end of ${player.name}'s next turn.`;
}

function getLifeZeroWinConditionWinner(damagedPlayer) {
    if (!damagedPlayer || (damagedPlayer.life?.length || 0) !== 0) {
        return null;
    }

    const opponent = getOpponentOfPlayer(damagedPlayer);
    const leader = opponent?.leader;
    const condition = leader?.lifeZeroWinCondition;

    if (!leader || !condition || !isTemporaryStatusEntryActive(condition)) {
        return null;
    }

    return {
        winnerPlayer: opponent,
        reasonTitle: "Final Verdict",
        reasonText: `${opponent.name} won because ${leader.name}'s effect says they win if the opponent's life hits 0 this turn.`
    };
}

function resolveHiromiHigurumaCharacterLeaderDamage(attackerPlayer, attackerCard, defenderPlayer, ui) {
    if (!attackerPlayer || !attackerCard || !defenderPlayer) {
        return {
            winnerPlayer: null,
            reasonTitle: "",
            reasonText: "",
            message: ""
        };
    }

    if (attackerCard.cardNumber !== "JK01-006" || areCardEffectsNegated(attackerCard)) {
        return {
            winnerPlayer: null,
            reasonTitle: "",
            reasonText: "",
            message: ""
        };
    }

    const lifeResult = takeAllLifeToHand(defenderPlayer, ui);

    return {
        winnerPlayer: lifeResult.winnerPlayer || null,
        reasonTitle: lifeResult.reasonTitle || "",
        reasonText: lifeResult.reasonText || "",
        message: lifeResult.success
            ? `${attackerCard.name} made ${defenderPlayer.name} add all remaining life cards to hand.`
            : ""
    };
}

function resolveTakakoUroOnOpponentAttack(player, sourceCard, ui, options = {}) {
    const finish = () => {
        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }

        options.onComplete?.();
    };

    if (typeof currentAttack === "undefined" || !currentAttack) {
        finish();
        return `${sourceCard.name} could not be used because there is no current attack.`;
    }

    if (currentAttack.defenderPlayerKey !== getPlayerKey(player) || currentAttack.target?.cardType !== "leader") {
        finish();
        return `${sourceCard.name} could not be used because your leader is not being attacked.`;
    }

    const promptMessage = chooseHandCard(player, sourceCard, {
        prompt: `Choose up to 1 event card with base cost 6 or less to activate its Counter for ${sourceCard.name}.`,
        optional: true,
        filter: card => {
            return card?.cardType === "event" &&
                Number(card.cost ?? card.playCost ?? 0) <= 6 &&
                getCounterEffects(card, player).length > 0;
        },
        onSelect: ({ card }) => {
            const handIndex = player.hand.indexOf(card);

            if (handIndex === -1) {
                addGameLog(`${sourceCard.name} could not find that hand event anymore.`);
                finish();
                return;
            }

            const result = useCounterFromHand(player, handIndex, ui);

            if (result?.message) {
                addGameLog(result.message);
            }

            finish();
        },
        onSkip: finish,
        onEmpty: finish,
        skipMessage: `${player.name} did not activate a hand event with ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no event Counter cards with base cost 6 or less in hand.`
    });

    return promptMessage || `${sourceCard.name}'s effect resolved.`;
}

function resolveConfessionCounterEffect(player, sourceCard, ui, options = {}) {
    const finish = (...args) => {
        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }

        options.onComplete?.(...args);

        if (options.autoResolveNegatedAttack !== false) {
            queueAutoResolveNegatedAttack();
        }
    };

    if (typeof currentAttack === "undefined" || !currentAttack) {
        finish();
        return `${sourceCard.name} could not be used because there is no current attack.`;
    }

    const attackerPlayer = gameState?.[currentAttack.attackerPlayerKey];
    const attackerCard = getBoardCardFromData(currentAttack.attacker);

    if (!attackerPlayer || !attackerCard) {
        finish();
        return `${sourceCard.name} could not find the attacking card.`;
    }

    const attackerPower = getCardBattlePower(attackerCard, attackerPlayer);

    if (attackerPower > 12000) {
        finish();
        return `${sourceCard.name} could not negate the attack because ${attackerCard.name} has ${attackerPower} power.`;
    }

    negateCurrentAttack(sourceCard);

    if (!player.leader) {
        finish();
        return `${sourceCard.name} negated the attack, but ${player.name} has no leader to empower.`;
    }

    const completeEmpowerment = (restedDon) => {
        let summary = `${sourceCard.name} negated the attack.`;

        if (restedDon) {
            addGameLog(`${player.name} rested 10 DON!! for ${sourceCard.name}.`);
            summary += ` ${player.name} rested 10 DON!!.`;
        }

        if ((player.life?.length || 0) <= 2) {
            const expiresAtPlayerKey = getPlayerKey(player);
            const expiresAtEndOfTurns = Number(player.turns || 0) + 1;

            player.leader.temporaryBasePower = {
                value: 9000,
                expiresAtPlayerKey,
                expiresAtEndOfTurns
            };
            addDurationKeyword(player.leader, "doubleAttack", expiresAtEndOfTurns, expiresAtPlayerKey);
            addDurationKeyword(player.leader, "banish", expiresAtEndOfTurns, expiresAtPlayerKey);
            player.leader.lifeZeroWinCondition = {
                expiresAtPlayerKey,
                expiresAtEndOfTurns
            };
            refreshCardStatDisplay(player.leader);
            ui?.renderLeaders?.();

            addGameLog(`${sourceCard.name} made ${player.leader.name}'s base power 9000 and gave it Double Attack, Banish, and a life-0 win condition until the end of ${player.name}'s next turn.`);
            summary += ` ${player.leader.name} is now 9000 power with Double Attack and Banish until the end of ${player.name}'s next turn.`;
        } else {
            addGameLog(`${sourceCard.name} did not empower ${player.leader.name} because ${player.name} has more than 2 life cards.`);
            summary += ` ${player.leader.name} was not empowered because ${player.name} has more than 2 life cards.`;
        }

        finish();
        return summary;
    };

    if (player.don >= 10 && ui?.chooseEffectActivation) {
        ui.chooseEffectActivation({
            player,
            sourceCard,
            effect: {
                id: "JK01-005-rest-10-don",
                type: "counter",
                text: "Rest 10 active DON!!?"
            },
            title: sourceCard.name,
            prompt: `Rest 10 active DON!! for ${sourceCard.name}?`,
            activateText: "Rest 10 DON!!",
            skipText: "Skip",
            onComplete: (shouldActivate) => {
                const restedDon = shouldActivate && restDonForCost(player, 10, ui);
                completeEmpowerment(Boolean(restedDon));
            }
        });

        return `${player.name} is choosing whether to rest 10 DON!! for ${sourceCard.name}.`;
    }

    return completeEmpowerment(false);
}

function resolveHigurumaTrashCounterEffect(player, leader, eventCard, effect, ui, onComplete) {
    const finish = () => {
        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }

        onComplete?.();
        queueAutoResolveNegatedAttack();
    };

    const drawAndTrash = () => {
        const drawResult = drawCard(player, ui);

        if (drawResult?.deckOut) {
            addGameLog(`${leader.name}'s effect drew 1 card, but ${player.name} lost by deck out.`);
            finish();
            return;
        }

        addGameLog(`${leader.name}'s effect drew 1 card.`);

        if (player.hand.length === 0) {
            addGameLog(`${leader.name}'s effect found no card in hand to trash.`);
            finish();
            return;
        }

        const trashPromptMessage = chooseHandCard(player, leader, {
            prompt: `Choose 1 card from your hand to trash for ${leader.name}.`,
            optional: false,
            onSelect: ({ card }) => {
                const handIndex = player.hand.indexOf(card);

                if (handIndex === -1) {
                    addGameLog(`${leader.name} could not find that hand card to trash.`);
                    finish();
                    return;
                }

                const trashedCard = player.hand.splice(handIndex, 1)[0];
                moveCardToTrash(player, trashedCard, ui);
                ui?.renderHands?.();
                ui?.renderTrash?.();
                addGameLog(`${player.name} trashed ${trashedCard.name} from hand for ${leader.name}.`);
                finish();
            },
            emptyMessage: `${leader.name}'s effect found no card in hand to trash.`
        });

        if (trashPromptMessage) {
            addGameLog(trashPromptMessage);
        }
    };

    addGameLog(`${player.name} activated ${eventCard.name} from trash with ${leader.name}.`);

    if (effect.id === "JK01-002-counter") {
        const message = resolveEvidenceCounterEffect(player, eventCard, ui, {
            onComplete: drawAndTrash,
            autoResolveNegatedAttack: false
        });

        return message || `${eventCard.name} activated from trash.`;
    }

    if (effect.id === "JK01-003-counter") {
        const message = resolveConfiscationCounterEffect(player, eventCard, ui, {
            onComplete: drawAndTrash,
            autoResolveNegatedAttack: false
        });

        return message || `${eventCard.name} activated from trash.`;
    }

    if (effect.id === "JK01-004-counter") {
        const message = resolveDeathPenaltyCounterEffect(player, eventCard, ui, {
            onComplete: drawAndTrash,
            autoResolveNegatedAttack: false
        });

        return message || `${eventCard.name} activated from trash.`;
    }

    if (effect.id === "JK01-005-counter") {
        const message = resolveConfessionCounterEffect(player, eventCard, ui, {
            onComplete: drawAndTrash,
            autoResolveNegatedAttack: false
        });

        return message || `${eventCard.name} activated from trash.`;
    }

    if (effect.actionId === "eggmanCounterPower") {
        const promptMessage = chooseOwnBoardCard(player, eventCard, {
            prompt: "Choose up to 1 Eggman Empire leader or character to give +4000 power during this battle.",
            optional: true,
            includeLeader: true,
            filter: card => (card.cardType === "leader" || card.cardType === "character") && hasTypeText(card, "Eggman Empire"),
            onSelect: ({ card }) => {
                addBattlePowerBonus(card, Number(effect.powerModifier ?? 4000));
                ui?.renderLeaders?.();
                ui?.renderCharacters?.();
                addGameLog(`${eventCard.name} gave ${card.name} +4000 power during this battle.`);
                drawAndTrash();
            },
            onSkip: drawAndTrash,
            onEmpty: drawAndTrash,
            skipMessage: `${player.name} did not choose a card for ${eventCard.name}.`,
            emptyMessage: `${eventCard.name} found no Eggman Empire leader or character.`
        });

        if (promptMessage) {
            addGameLog(promptMessage);
        }

        return `${player.name} is choosing a counter target for ${eventCard.name}.`;
    }

    if (effect.actionId === "leaderOrCharacterCounterPower") {
        const promptMessage = chooseOwnBoardCard(player, eventCard, {
            prompt: "Choose one of your leaders or characters to give +2000 power during this battle.",
            optional: false,
            includeLeader: true,
            filter: card => card.cardType === "leader" || card.cardType === "character",
            onSelect: ({ card }) => {
                addBattlePowerBonus(card, Number(effect.powerModifier ?? 2000));
                ui?.renderLeaders?.();
                ui?.renderCharacters?.();
                addGameLog(`${eventCard.name} gave ${card.name} +2000 power during this battle.`);
                drawAndTrash();
            },
            emptyMessage: `${eventCard.name} found no leader or character.`
        });

        if (promptMessage) {
            addGameLog(promptMessage);
        }

        return `${player.name} is choosing a counter target for ${eventCard.name}.`;
    }

    if (effect.actionId === "santenKesshunCounterPower") {
        const power = player.life.length <= 2 ? 4000 : 2000;
        const promptMessage = chooseOwnBoardCard(player, eventCard, {
            prompt: `Choose up to 1 leader or character to give +${power} power during this battle.`,
            optional: true,
            includeLeader: true,
            filter: card => card.cardType === "leader" || card.cardType === "character",
            onSelect: ({ card }) => {
                addBattlePowerBonus(card, power);
                ui?.renderLeaders?.();
                ui?.renderCharacters?.();
                addGameLog(`${eventCard.name} gave ${card.name} +${power} power during this battle.`);
                drawAndTrash();
            },
            onSkip: drawAndTrash,
            onEmpty: drawAndTrash,
            skipMessage: `${player.name} did not choose a card for ${eventCard.name}.`,
            emptyMessage: `${eventCard.name} found no leader or character.`
        });

        if (promptMessage) {
            addGameLog(promptMessage);
        }

        return `${player.name} is choosing a counter target for ${eventCard.name}.`;
    }

    if (effect.actionId === "leaderCounterPower") {
        const power = Number(effect.powerModifier ?? 0);

        addBattlePowerBonus(player.leader, power);
        ui?.renderLeaders?.();
        addGameLog(`${eventCard.name} gave ${player.name}'s leader +${power} power during this battle.`);
        drawAndTrash();
        return `${eventCard.name} activated from trash.`;
    }

    const counterPower = Number(effect.powerModifier ?? 0);

    if (counterPower > 0) {
        if (typeof applyCounterPowerToCurrentAttack === "function") {
            applyCounterPowerToCurrentAttack(counterPower);
        } else if (typeof currentAttack !== "undefined" && currentAttack) {
            currentAttack.targetPowerBonus = Number(currentAttack.targetPowerBonus || 0) + counterPower;
        }

        addGameLog(`${eventCard.name} gave +${counterPower} counter power during this battle.`);
    }

    drawAndTrash();
    return `${eventCard.name} activated from trash.`;
}

function resolveHiromiHigurumaLeaderOnOpponentAttack(player, leader, ui, options = {}) {
    const effect = getCardAllEffects(leader)?.find(cardEffect => cardEffect.id === "JK01-001-on-opponent-attack");

    if (!player || !leader || !effect) {
        options.onComplete?.();
        return "";
    }

    if (hasReachedPerTurnEffectUseLimit(leader, effect, player.turns)) {
        options.onComplete?.();
        return `${leader.name}'s On Your Opponent's Attack effect has already been used ${getPerTurnEffectUseLimit(effect)} times this turn.`;
    }

    const validChoices = player.trash
        .map((card, trashIndex) => ({
            card,
            trashIndex
        }))
        .filter(entry => entry.card && canHigurumaLeaderActivateTrashEvent(player, entry.card));

    if (validChoices.length === 0) {
        options.onComplete?.();
        return `${leader.name} found no supported Counter events in trash to activate.`;
    }

    const chooseEvent = (selectedValue) => {
        if (selectedValue === null || selectedValue === undefined || selectedValue === "") {
            addGameLog(`${player.name} did not activate a trash event with ${leader.name}.`);
            options.onComplete?.();
            return;
        }

        const trashIndex = Number(selectedValue);

        if (!Number.isInteger(trashIndex) || trashIndex < 0 || trashIndex >= player.trash.length) {
            addGameLog(`${leader.name} could not find that trash event anymore.`);
            options.onComplete?.();
            return;
        }

        const eventCard = player.trash[trashIndex];
        const counterEffect = getCounterEffects(eventCard, player).find(counter => {
            return counter.id === "JK01-002-counter" ||
                counter.id === "JK01-003-counter" ||
                counter.id === "JK01-004-counter" ||
                counter.id === "JK01-005-counter" ||
                counter.actionId === "eggmanCounterPower" ||
                counter.actionId === "leaderOrCharacterCounterPower" ||
                counter.actionId === "santenKesshunCounterPower" ||
                counter.actionId === "leaderCounterPower" ||
                Number(counter.powerModifier ?? 0) > 0;
        });

        if (!eventCard || !counterEffect || !canHigurumaLeaderActivateTrashEvent(player, eventCard)) {
            addGameLog(`${leader.name} could not activate that event from trash.`);
            options.onComplete?.();
            return;
        }

        CardEffects.markPerTurnEffectUsed(leader, effect.id, player.turns);

        const message = resolveHigurumaTrashCounterEffect(
            player,
            leader,
            eventCard,
            counterEffect,
            ui,
            options.onComplete
        );

        if (message) {
            addGameLog(message);
        }
    };

    if (ui?.chooseBoardCard) {
        ui.chooseBoardCard({
            player,
            sourceCard: leader,
            prompt: "Choose a Counter event from your trash to activate.",
            choices: validChoices.map(({ card, trashIndex }) => ({
                playerKey: getPlayerKey(player),
                cardType: "trash",
                trashIndex,
                card
            })),
            optional: true,
            onComplete: (choice) => {
                chooseEvent(choice ? choice.trashIndex : null);
            }
        });

        return `${player.name} is choosing a Counter event from trash for ${leader.name}.`;
    }

    chooseEvent(validChoices[0]?.trashIndex ?? null);
    return `${leader.name}'s effect resolved.`;
}

function cloneGameStateValue(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

function clearTransientStateAfterCheckpointRestore() {
    selectedHandCard = null;
    selectedHandCardData = null;
    pendingReplacePlay = null;
    selectedBoardCard = null;
    selectedBoardCardData = null;
    pendingAttack = null;
    currentAttack = null;
    pendingBlock = null;
    pendingTrashChoice = null;

    if (typeof pendingOpponentAttackEffect !== "undefined") {
        pendingOpponentAttackEffect = null;
    }

    if (typeof pendingDeferredCombatChoices !== "undefined") {
        pendingDeferredCombatChoices = 0;
    }

    if (typeof deferredCombatContinuation !== "undefined") {
        deferredCombatContinuation = null;
    }

    if (typeof deferredAttackCleanup !== "undefined") {
        deferredAttackCleanup = null;
    }

    if (typeof lastAutoPhaseAdvanceKey !== "undefined") {
        lastAutoPhaseAdvanceKey = null;
    }

    if (typeof lastStartOfTurnResumeKey !== "undefined") {
        lastStartOfTurnResumeKey = null;
    }

    if (typeof gameOverState !== "undefined") {
        gameOverState = null;
    }

    if (typeof removeEffectChoiceOverlay === "function") {
        removeEffectChoiceOverlay();
    }

    if (typeof clearTrashChoiceTargets === "function") {
        clearTrashChoiceTargets();
    }

    if (typeof clearAttackTargets === "function") {
        clearAttackTargets();
    }

    if (typeof clearBlockerTargets === "function") {
        clearBlockerTargets();
    }

    if (typeof clearBattleControls === "function") {
        clearBattleControls();
    }

    if (typeof clearHandSelection === "function") {
        clearHandSelection();
    }

    if (typeof clearBoardSelection === "function") {
        clearBoardSelection();
    }

    if (typeof clearReplaceTargets === "function") {
        clearReplaceTargets();
    }

    if (typeof clearCancelAttackButton === "function") {
        clearCancelAttackButton();
    }

    if (typeof clearAttackArrow === "function") {
        clearAttackArrow();
    }
}

function getSubaruLeader(player) {
    const leader = player?.leader;

    if (!leader || leader.cardNumber !== "SUB1-001" || areCardEffectsNegated(leader)) {
        return null;
    }

    return leader;
}

function revealSubaruLifeCard(player, sourceCard, ui, options = {}) {
    if (!player?.life?.length) {
        return `${sourceCard.name} found no life card to reveal.`;
    }

    const revealAtIndex = (lifeIndex, positionLabel = "") => {
        const revealedCard = player.life[lifeIndex];

        if (!revealedCard) {
            addGameLog(`${sourceCard.name} could not reveal that life card.`);
            return;
        }

        revealedCard.faceUp = !Boolean(revealedCard.faceUp);
        ui?.renderLifeCards?.();
        addGameLog(
            `${player.name} turned ${positionLabel || "a"} life card ${revealedCard.faceUp ? "face-up" : "face-down"} for ${sourceCard.name}.`
        );
        options.onComplete?.(revealedCard, positionLabel || "selected");

        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }
    };

    if (options.allowAnyChoice && player.life.length > 1 && ui?.chooseLifeCard) {
        const choices = player.life.map((card, lifeIndex) => ({
            card,
            cardType: "life",
            lifeIndex,
            choiceLabel: lifeIndex === 0
                ? "Top"
                : lifeIndex === player.life.length - 1
                    ? "Bottom"
                    : `Life ${lifeIndex + 1}`
        }));

        ui.chooseLifeCard({
            player,
            sourceCard,
            prompt: options.prompt || `Choose which life card to flip for ${sourceCard.name}.`,
            choices,
            onComplete: (choice) => {
                if (!choice) {
                    return;
                }

                revealAtIndex(choice.lifeIndex, choice.choiceLabel || `Life ${choice.lifeIndex + 1}`);
            }
        });

        return `${player.name} is choosing a life card to flip for ${sourceCard.name}.`;
    }

    if (options.allowAnyChoice && player.life.length > 1 && ui?.chooseBoardCard) {
        const choices = player.life.map((card, lifeIndex) => ({
            card,
            cardType: "life",
            lifeIndex,
            choiceLabel: lifeIndex === 0
                ? "Top"
                : lifeIndex === player.life.length - 1
                    ? "Bottom"
                    : `Life ${lifeIndex + 1}`
        }));

        ui.chooseBoardCard({
            player,
            sourceCard,
            prompt: options.prompt || `Choose which life card to flip for ${sourceCard.name}.`,
            choices,
            optional: false,
            onComplete: (choice) => {
                if (!choice) {
                    return;
                }

                revealAtIndex(choice.lifeIndex, choice.choiceLabel || `Life ${choice.lifeIndex + 1}`);
            }
        });

        return `${player.name} is choosing a life card to flip for ${sourceCard.name}.`;
    }

    if (options.allowBottomChoice && player.life.length > 1 && ui?.chooseEffectOption) {
        ui.chooseEffectOption({
            player,
            sourceCard,
            title: options.title || sourceCard.name,
            prompt: options.prompt || `Choose which life card to reveal for ${sourceCard.name}.`,
            options: [
                { label: "Top", value: "top" },
                { label: "Bottom", value: "bottom" }
            ],
            onComplete: (value) => {
                const useBottomCard = value === "bottom" && player.life.length > 1;
                revealAtIndex(
                    useBottomCard ? player.life.length - 1 : 0,
                    useBottomCard ? "bottom" : "top"
                );
            }
        });

        return `${player.name} is choosing a life card to reveal for ${sourceCard.name}.`;
    }

    revealAtIndex(0, "top");
    return `${sourceCard.name}'s effect revealed a life card.`;
}

function trashTopLifeCard(player, sourceCard, ui) {
    const trashedCard = player?.life?.shift();

    if (!trashedCard) {
        return {
            success: false,
            card: null,
            message: `${sourceCard.name} found no top life card to trash.`
        };
    }

    moveCardToTrash(player, trashedCard, ui);
    ui?.renderLifeCards?.();
    ui?.renderTrash?.();

    return {
        success: true,
        card: trashedCard,
        message: `${player.name} trashed ${trashedCard.name} from the top of life for ${sourceCard.name}.`
    };
}

function getSubaruStageEffect(player) {
    const stage = player?.stage;

    if (!stage || areCardEffectsNegated(stage)) {
        return null;
    }

    return getCardAllEffects(stage)?.find(effect => {
        return effect.id === "SUB1-008-on-play-checkpoint" ||
            effect.type === "main" ||
            effect.type === "activateMain" ||
            effect.type === "onPlay";
    }) || null;
}

function resolveEchidnaStageCopy(player, sourceCard, ui) {
    const stage = player?.stage;
    const stageEffect = getSubaruStageEffect(player);

    if (!stage || !stageEffect) {
        return {
            success: false,
            message: `${sourceCard.name} found no Stage effect to activate.`
        };
    }

    const revealMessage = revealSubaruLifeCard(player, sourceCard, ui, {
        onComplete: () => {
            const stageMessage = resolveEffectAction(player, stage, stageEffect, ui, {
                skipActivationPrompt: true
            });

            if (stageMessage) {
                addGameLog(stageMessage);
            }

            addTemporaryPowerBonus(sourceCard, 1000);
            ui?.renderCharacters?.();
            addGameLog(`${sourceCard.name} gained +1000 power this turn.`);

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }
        }
    });

    return {
        success: true,
        message: revealMessage || `${sourceCard.name}'s effect resolved.`
    };
}

function hasRamBoostedRem(card) {
    if (!card || card.cardType !== "character" || !CardEffects.hasCardName(card, "Rem")) {
        return false;
    }

    const owner = getPlayerForBoardCard(card);

    if (!owner) {
        return false;
    }

    return owner.characters.some(boardCard => {
        return boardCard?.cardNumber === "SUB1-003" && !areCardEffectsNegated(boardCard);
    });
}

function buildSubaruCheckpointState() {
    if (!gameState) {
        return null;
    }

    const clonePlayerZones = (player) => ({
        characters: cloneGameStateValue(player?.characters || []),
        hand: cloneGameStateValue(player?.hand || []),
        life: cloneGameStateValue(player?.life || []),
        trash: cloneGameStateValue(player?.trash || []),
        deck: cloneGameStateValue(player?.deck || []),
        don: Number(player?.don || 0),
        restedDon: Number(player?.restedDon || 0),
        donDeck: Number(player?.donDeck || 0),
        turns: Number(player?.turns || 0),
        leaderAttacksThisTurn: Number(player?.leaderAttacksThisTurn || 0)
    });

    return {
        player1: clonePlayerZones(gameState.player1),
        player2: clonePlayerZones(gameState.player2),
        currentPlayerKey: getPlayerKey(gameState.currentPlayer),
        currentPhase: gameState.currentPhase || "main",
        turnNumber: Number(gameState.turnNumber || 1)
    };
}

function applySubaruCheckpointState(checkpointState, ui) {
    if (!checkpointState || !gameState?.player1 || !gameState?.player2) {
        return false;
    }

    const applyPlayerZones = (playerKey) => {
        const player = gameState[playerKey];
        const saved = checkpointState[playerKey];

        if (!player || !saved) {
            return;
        }

        player.characters = cloneGameStateValue(saved.characters || []);
        player.hand = cloneGameStateValue(saved.hand || []);
        player.life = cloneGameStateValue(saved.life || []);
        player.trash = cloneGameStateValue(saved.trash || []);
        player.deck = cloneGameStateValue(saved.deck || []);
        player.don = Number(saved.don || 0);
        player.restedDon = Number(saved.restedDon || 0);
        player.donDeck = Number(saved.donDeck || 0);
        player.turns = Number(saved.turns || 0);
        player.leaderAttacksThisTurn = Number(saved.leaderAttacksThisTurn || 0);
    };

    applyPlayerZones("player1");
    applyPlayerZones("player2");
    clearTransientStateAfterCheckpointRestore();
    gameState.currentPlayer = checkpointState.currentPlayerKey &&
        gameState[checkpointState.currentPlayerKey]
        ? gameState[checkpointState.currentPlayerKey]
        : gameState.currentPlayer;
    gameState.currentPhase = checkpointState.currentPhase || "main";
    gameState.turnNumber = Number(checkpointState.turnNumber || gameState.turnNumber || 1);
    ui?.updateDonDisplay?.();
    ui?.renderDonDecks?.();
    ui?.renderLeaders?.();
    ui?.renderStages?.();
    ui?.renderHands?.();
    ui?.renderDecks?.();
    ui?.renderLifeCards?.();
    ui?.renderCharacters?.();
    ui?.renderTrash?.();

    if (typeof showSelectedBoardActions === "function") {
        showSelectedBoardActions();
    }

    if (typeof syncPhaseButtonForCurrentState === "function") {
        syncPhaseButtonForCurrentState();
    } else {
        const phaseButton = typeof document !== "undefined"
            ? document.getElementById("phaseButton")
            : null;

        if (phaseButton && typeof setPhaseButtonState === "function") {
            if (gameState.currentPhase === "draw") {
                setPhaseButtonState(phaseButton, "Draw Card");
            } else if (gameState.currentPhase === "don") {
                const donAmount = typeof getCurrentTurnDonAmount === "function"
                    ? getCurrentTurnDonAmount(gameState.currentPlayer)
                    : 2;
                setPhaseButtonState(phaseButton, `Add ${donAmount} DON!!`);
            } else if (gameState.currentPhase === "startOfTurn") {
                setPhaseButtonState(
                    phaseButton,
                    `${gameState.currentPlayer?.name || "Current Player"}'s Start of Turn`,
                    true
                );
            } else if (gameState.currentPhase === "main") {
                const nextPlayer = typeof getNextPlayer === "function" && gameState.currentPlayer
                    ? getNextPlayer(gameState.currentPlayer)
                    : null;
                setPhaseButtonState(
                    phaseButton,
                    `Pass to ${nextPlayer?.name || "Opponent"}`
                );
            }
        }
    }

    return true;
}

function tryResolveSubaruCheckpointLoss(player, reasonText = "") {
    const leader = getSubaruLeader(player);
    const effectId = "SUB1-001-checkpoint";

    if (!leader ||
        CardEffects.hasUsedOncePerGameEffect(leader, effectId) ||
        !gameState?.subaruCheckpointState) {
        return false;
    }

    const restored = applySubaruCheckpointState(gameState.subaruCheckpointState, ui);

    if (!restored) {
        return false;
    }

    CardEffects.markOncePerGameEffectUsed(leader, effectId);
    addGameLog(`${leader.name} prevented a loss and reset the saved zones to the last checkpoint.${reasonText ? ` ${reasonText}` : ""}`);

    if (typeof removeGameOverPopup === "function") {
        removeGameOverPopup();
    }

    if (typeof queueMultiplayerStateSync === "function") {
        queueMultiplayerStateSync();
    }

    return true;
}

function saveSubaruCheckpointState(player, sourceCard, ui) {
    if (!player || !sourceCard || !gameState) {
        return `${sourceCard?.name || "This effect"} could not save a checkpoint.`;
    }

    const opponent = getOpponentOfPlayer(player);
    const ownTopLife = player.life?.[0];
    const opponentTopLife = opponent?.life?.[0];

    if (ownTopLife) {
        ownTopLife.faceUp = !ownTopLife.faceUp;
    }

    if (opponentTopLife) {
        opponentTopLife.faceUp = !opponentTopLife.faceUp;
    }

    ui?.renderLifeCards?.();

    gameState.subaruCheckpointState = buildSubaruCheckpointState();
    gameState.subaruCheckpointOwnerKey = getPlayerKey(player);

    if (typeof queueMultiplayerStateSync === "function") {
        queueMultiplayerStateSync();
    }

    return `${sourceCard.name} set the current game state as a checkpoint.`;
}

function resolveSubaruLeaderActivateMain(player, leader, ui) {
    const activeLeader = getSubaruLeader(player);

    if (!activeLeader || leader?.instanceId !== activeLeader.instanceId) {
        return {
            success: false,
            message: "Subaru Natsuki's effect could not be found."
        };
    }

    if (!gameState?.subaruCheckpointState) {
        return {
            success: false,
            message: `${leader.name} has no checkpoint to reset to.`
        };
    }

    if (!applySubaruCheckpointState(gameState.subaruCheckpointState, ui)) {
        return {
            success: false,
            message: `${leader.name} could not find a valid checkpoint state.`
        };
    }

    CardEffects.markOncePerGameEffectUsed(activeLeader, "SUB1-001-checkpoint");
    ui?.renderLeaders?.();
    ui?.renderStages?.();

    return {
        success: true,
        message: `${leader.name} reset the game to the last checkpoint.`
    };
}

function getKillerLeader(player) {
    const leader = player?.leader;

    if (!leader || leader.cardNumber !== "KIL1-001" || areCardEffectsNegated(leader)) {
        return null;
    }

    return leader;
}

function resolveKillerLeaderMill(player, sourceCard, ui) {
    const opponent = getOpponentOfPlayer(player);
    const ownMill = trashTopCardsOfDeck(player, 2, ui);
    const opponentMill = opponent
        ? trashTopCardsOfDeck(opponent, 2, ui)
        : { message: `${sourceCard.name} found no opponent deck to trash from.` };

    addGameLog(ownMill.message);
    addGameLog(opponentMill.message);

    return `${player.name} and ${opponent?.name || "the opponent"} each trashed up to 2 cards from the top of their deck for ${sourceCard.name}.`;
}

function moveRandomTrashCardsToBottom(player, count) {
    const movedCards = [];
    const moveCount = Math.max(0, Math.min(Number(count || 0), player?.trash?.length || 0));

    if (!player || moveCount <= 0) {
        return movedCards;
    }

    for (let index = 0; index < moveCount; index++) {
        const randomIndex = Math.floor(Math.random() * player.trash.length);
        const movedCard = player.trash.splice(randomIndex, 1)[0];

        if (movedCard) {
            movedCards.push(movedCard);
        }
    }

    player.deck.push(...movedCards);
    return movedCards;
}

function resolveKillerTrashBottomCycle(player, sourceCard, ui, options = {}) {
    if (!player || !sourceCard) {
        return "";
    }

    const opponent = getOpponentOfPlayer(player);
    const chosenCards = [];
    const maxOwnCards = Number.isFinite(options.maxOwnCards)
        ? Math.max(0, Number(options.maxOwnCards))
        : Number.POSITIVE_INFINITY;

    const finish = () => {
        if (chosenCards.length > 0) {
            player.deck.push(...chosenCards);
        }

        const opponentReturned = moveRandomTrashCardsToBottom(opponent, chosenCards.length);
        const result = {
            ownReturned: chosenCards.length,
            opponentReturned: opponentReturned.length,
            totalReturned: chosenCards.length + opponentReturned.length,
            ownCards: [...chosenCards],
            opponentCards: [...opponentReturned]
        };
        const summary = chosenCards.length > 0
            ? `${player.name} returned ${chosenCards.length} card${chosenCards.length === 1 ? "" : "s"} from trash to the bottom of the deck, and ${opponent?.name || "the opponent"} returned ${opponentReturned.length} random card${opponentReturned.length === 1 ? "" : "s"} from trash to the bottom of the deck.`
            : `${player.name} did not return any cards from trash with ${sourceCard.name}.`;

        ui?.renderTrash?.();
        ui?.renderDecks?.();
        addGameLog(summary);
        options.onResolved?.(result, summary);

        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }
    };

    const chooseNext = () => {
        if (chosenCards.length >= maxOwnCards) {
            finish();
            return;
        }

        const availableChoices = getTrashCardChoices(player, card => {
            return !chosenCards.some(chosenCard => chosenCard?.instanceId === card?.instanceId);
        });

        if (availableChoices.length === 0) {
            finish();
            return;
        }

        const chooseMessage = chooseBoardCard(player, sourceCard, availableChoices, {
            prompt: options.prompt || `Choose up to ${maxOwnCards === Number.POSITIVE_INFINITY ? "any number of" : maxOwnCards - chosenCards.length} card${maxOwnCards === 1 ? "" : "s"} from your trash to place on the bottom of your deck with ${sourceCard.name}.`,
            optional: true,
            onSelect: ({ trashIndex }) => {
                const movedCard = player.trash.splice(trashIndex, 1)[0];

                if (!movedCard) {
                    addGameLog(`${sourceCard.name} could not find that trash card anymore.`);
                    finish();
                    return;
                }

                chosenCards.push(movedCard);
                ui?.renderTrash?.();
                addGameLog(`${player.name} chose ${movedCard.name} for ${sourceCard.name}.`);
                chooseNext();
            },
            onSkip: finish,
            onEmpty: finish,
            skipMessage: `${player.name} finished choosing trash cards for ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no cards in trash to return.`
        });

        if (chooseMessage) {
            addGameLog(chooseMessage);
        }
    };

    chooseNext();
    return `${player.name} is choosing trash cards for ${sourceCard.name}.`;
}

function resolveKillerDrawThenTrash(player, sourceCard, ui, amount, options = {}) {
    const drawAmount = Math.max(0, Number(amount || 0));

    if (drawAmount <= 0) {
        options.onComplete?.();
        return `${sourceCard.name} found no cards to draw and trash.`;
    }

    const drawResult = drawCards(player, drawAmount, ui);

    if (drawResult?.deckOut) {
        options.onComplete?.();
        return `${sourceCard.name} tried to draw ${drawAmount} card${drawAmount === 1 ? "" : "s"}, but ${player.name} lost by deck out.`;
    }

    const trashAmount = Math.min(drawAmount, player.hand.length);

    if (trashAmount <= 0) {
        options.onComplete?.();
        return `${sourceCard.name} drew ${drawAmount} card${drawAmount === 1 ? "" : "s"}, but found no cards in hand to trash.`;
    }

    chooseCardsFromHandToTrash(player, sourceCard, ui, trashAmount, () => {
        addGameLog(`${sourceCard.name} drew ${drawAmount} card${drawAmount === 1 ? "" : "s"} and trashed ${trashAmount} card${trashAmount === 1 ? "" : "s"}.`);
        options.onComplete?.();
    });

    return `${sourceCard.name} drew ${drawAmount} card${drawAmount === 1 ? "" : "s"} and is choosing ${trashAmount} card${trashAmount === 1 ? "" : "s"} to trash.`;
}

function resolveKillerKOUpToPower(player, sourceCard, ui, maxPower) {
    return chooseOpponentCharacter(player, sourceCard, {
        prompt: `Choose up to 1 opposing Character with ${maxPower} power or less to K.O.`,
        optional: true,
        filter: card => getCardBattlePower(card, getPlayerForBoardCard(card)) <= maxPower,
        onSelect: ({ card, playerKey, slotIndex }) => {
            const targetPlayer = playerKey ? gameState?.[playerKey] : getPlayerForBoardCard(card);
            const koResult = KOCharacter(targetPlayer, slotIndex, ui, {
                byEffect: true,
                actingPlayer: player
            });

            addGameLog(`${sourceCard.name} ${koResult.success ? "K.O.'d" : "could not K.O."} ${card.name}. ${koResult.message || ""}`.trim());

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }
        },
        skipMessage: `${player.name} did not choose a Character for ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no opposing Character with ${maxPower} power or less.`
    });
}

function resolveKillerBubblegumEffect(player, sourceCard, ui, options = {}) {
    const attachedDonCount = Number(sourceCard?.attachedDonBeforeKO ?? sourceCard?.attachedDon ?? 0);

    if (attachedDonCount < 2) {
        options.onComplete?.();
        return `${sourceCard?.name || "This effect"} requires DON!! x2.`;
    }

    return resolveKillerTrashBottomCycle(player, sourceCard, ui, {
        maxOwnCards: 1,
        prompt: `Choose up to 1 card from your trash to place on the bottom of your deck with ${sourceCard.name}.`,
        onResolved: (_result, summary) => {
            const opponent = getOpponentOfPlayer(player);
            const ownMill = trashTopCardsOfDeck(player, 3, ui);
            const opponentMill = opponent
                ? trashTopCardsOfDeck(opponent, 3, ui)
                : { message: `${sourceCard.name} found no opponent deck to trash from.` };

            addGameLog(ownMill.message);
            addGameLog(opponentMill.message);
            addGameLog(`${summary} ${player.name} and ${opponent?.name || "the opponent"} then each trashed up to 3 cards from the top of their deck for ${sourceCard.name}.`.trim());
            options.onComplete?.();
        }
    });
}

function resolveKillerCharacterWhenAttacked(player, sourceCard, ui, options = {}) {
    const effect = getCardAllEffects(sourceCard)?.find(cardEffect => cardEffect.id === "KIL1-012-when-attacked");

    if (!player || !sourceCard || !effect) {
        options.onComplete?.();
        return "";
    }

    if (CardEffects.hasUsedOncePerTurnEffect(sourceCard, effect.id, player.turns)) {
        options.onComplete?.();
        return `${sourceCard.name}'s When Attacked effect has already been used this turn.`;
    }

    CardEffects.markOncePerTurnEffectUsed(sourceCard, effect.id, player.turns);

    return resolveKillerTrashBottomCycle(player, sourceCard, ui, {
        prompt: `Choose any number of cards from your trash to place on the bottom of your deck with ${sourceCard.name}.`,
        onResolved: (result, summary) => {
            const opponent = getOpponentOfPlayer(player);
            const opponentKey = getPlayerKey(opponent);
            const bonusCount = Math.floor(result.totalReturned / 5);
            const expiresAtEndOfTurns = gameState?.currentPlayer === opponent
                ? Number(opponent?.turns || 0)
                : Number(opponent?.turns || 0) + 1;

            if (bonusCount > 0 && player.leader) {
                addDurationPowerBonus(player.leader, bonusCount * 1000, expiresAtEndOfTurns, opponentKey);
                ui?.renderLeaders?.();
                addGameLog(`${sourceCard.name} gave ${player.leader.name} +${bonusCount * 1000} power until the end of ${opponent?.name || "the opponent"}'s next turn.`);
            }
            options.onComplete?.();
        }
    });
}

function resolveKillerLeaderActivateMain(player, leader, ui) {
    const activeLeader = getKillerLeader(player);

    if (!activeLeader || leader?.instanceId !== activeLeader.instanceId) {
        return {
            success: false,
            message: "Killer's effect could not be found."
        };
    }

    if (Number(activeLeader.attachedDon || 0) < 2) {
        return {
            success: false,
            message: `${leader.name} requires DON!! x2.`
        };
    }

    CardEffects.markOncePerTurnEffectUsed(activeLeader, "KIL1-001-custom", player.turns);
    const millMessage = resolveKillerLeaderMill(player, leader, ui);

    if (!player.characters.some(card => card?.cardType === "character")) {
        return {
            success: true,
            message: `${millMessage} ${leader.name} found no Characters to receive rested DON!!.`.trim()
        };
    }

    const maxAttach = Math.min(2, Number(player.restedDon || 0));

    if (maxAttach <= 0) {
        return {
            success: true,
            message: `${millMessage} ${leader.name} found no rested DON!! to give.`.trim()
        };
    }

    const chooseMessage = chooseOwnBoardCard(player, leader, {
        prompt: `Choose up to 1 of your Characters to receive up to ${maxAttach} rested DON!! with ${leader.name}.`,
        optional: true,
        includeLeader: false,
        filter: card => card.cardType === "character",
        onSelect: ({ card }) => {
            const giveDon = (count) => {
                const resolvedCount = Math.max(0, Math.min(maxAttach, Number(count || 0)));

                if (resolvedCount <= 0) {
                    addGameLog(`${player.name} did not give any rested DON!! with ${leader.name}.`);
                    return;
                }

                for (let index = 0; index < resolvedCount; index++) {
                    const attachMessage = giveRestedDonToCard(player, leader, card, ui);

                    if (attachMessage) {
                        addGameLog(attachMessage);
                    }
                }

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            };

            if (maxAttach > 1 && ui?.chooseNumberValue) {
                ui.chooseNumberValue({
                    player,
                    sourceCard: leader,
                    title: leader.name,
                    prompt: `Choose how many rested DON!! to give to ${card.name}.`,
                    min: 0,
                    max: maxAttach,
                    initialValue: maxAttach,
                    valueLabel: "DON!!",
                    onComplete: giveDon
                });
                return;
            }

            giveDon(maxAttach);
        },
        skipMessage: `${player.name} did not choose a Character for ${leader.name}.`,
        emptyMessage: `${leader.name} found no Characters to receive rested DON!!.`
    });

    return {
        success: true,
        message: `${millMessage} ${chooseMessage || `${leader.name}'s effect resolved.`}`.trim()
    };
}

function resolveKillerLeaderOnOpponentAttack(player, leader, ui, options = {}) {
    const activeLeader = getKillerLeader(player);
    const effect = getCardAllEffects(activeLeader)?.find(cardEffect => cardEffect.id === "KIL1-001-custom");

    if (!activeLeader || !leader || !effect) {
        options.onComplete?.();
        return "";
    }

    if (CardEffects.hasUsedOncePerTurnEffect(activeLeader, effect.id, player.turns)) {
        options.onComplete?.();
        return `${leader.name}'s On Your Opponent's Attack effect has already been used this turn.`;
    }

    if (Number(activeLeader.attachedDon || 0) < 2) {
        options.onComplete?.();
        return `${leader.name}'s On Your Opponent's Attack effect requires DON!! x2.`;
    }

    CardEffects.markOncePerTurnEffectUsed(activeLeader, effect.id, player.turns);

    const millMessage = resolveKillerLeaderMill(player, leader, ui);
    const chooseMessage = chooseBoardCard(player, leader, getOpponentBoardChoices(player, {
        includeLeader: true,
        filter: card => card.cardType === "leader" || card.cardType === "character"
    }), {
        prompt: `Choose up to 1 of your opponent's Leaders or Characters to give -2000 power during this battle with ${leader.name}.`,
        optional: true,
        onSelect: ({ card }) => {
            addBattlePowerBonus(card, -2000);
            ui?.renderLeaders?.();
            ui?.renderCharacters?.();
            addGameLog(`${leader.name} gave ${card.name} -2000 power during this battle.`);

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }

            options.onComplete?.();
        },
        onSkip: options.onComplete,
        onEmpty: options.onComplete,
        skipMessage: `${player.name} did not choose an opposing card for ${leader.name}.`,
        emptyMessage: `${leader.name} found no opposing leader or character.`
    });

    return `${millMessage} ${chooseMessage || `${leader.name}'s effect resolved.`}`.trim();
}

function resolveCounterEffects(player, card, ui) {
    const messages = [];

    getCounterEffects(card, player).forEach(effect => {
        const message = resolveEffectAction(player, card, effect, ui, {
            skipActivationPrompt: true
        });

        if (message) {
            messages.push(message);
        }
    });

    return messages;
}

function resolveEchidnaActivateMain(player, sourceCard, ui) {
    return resolveEchidnaStageCopy(player, sourceCard, ui);
}

function getAceYamatoLeader(player) {
    const leader = player?.leader;

    if (!leader || leader.cardNumber !== "YAM1-001" || areCardEffectsNegated(leader)) {
        return null;
    }

    return leader;
}

function getAceYamatoLeaderKOTargetChoices(player) {
    const playerKey = getPlayerKey(player);

    if (!player || !playerKey) {
        return [];
    }

    return player.characters
        .map((card, slotIndex) => ({
            playerKey,
            cardType: "character",
            slotIndex,
            card
        }))
        .filter(choice => {
            return choice.card?.cardType === "character" &&
                hasTypeText(choice.card, "Land of Wano");
        });
}

function resolveAceYamatoLeaderOnCharacterPlay(player, playedCard, ui) {
    const leader = getAceYamatoLeader(player);

    if (!leader || playedCard?.cardType !== "character") {
        return "";
    }

    if (String(playedCard.playedFromZone || "hand").toLowerCase() === "hand") {
        return "";
    }

    const effect = leader.effects?.find(cardEffect => cardEffect.id === "YAM1-001-on-character-play-draw");

    if (!effect || CardEffects.hasUsedOncePerTurnEffect(leader, effect.id, player.turns)) {
        return "";
    }

    CardEffects.markOncePerTurnEffectUsed(leader, effect.id, player.turns);

    const opponent = getOpponentOfPlayer(player);
    const opponentKey = getPlayerKey(opponent);
    const expiresAtEndOfTurns = gameState?.currentPlayer === opponent
        ? Number(opponent?.turns || 0)
        : Number(opponent?.turns || 0) + 1;
    const durationText = gameState?.currentPlayer === opponent
        ? `${opponent?.name || "the opponent"}'s current turn`
        : `${opponent?.name || "the opponent"}'s next turn`;
    const completePowerGain = () => {
        addDurationPowerBonus(
            leader,
            1000,
            expiresAtEndOfTurns,
            opponentKey
        );

        ui?.renderLeaders?.();
        addGameLog(`${leader.name} gained +1000 power until the end of ${durationText}.`);

        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }
    };

    const message = resolveDrawTwoTrashOne(player, leader, ui, {
        onComplete: completePowerGain
    });

    if (message.includes("lost by deck out")) {
        return `${leader.name}'s Once Per Turn effect tried to draw 2 cards, but ${player.name} lost by deck out.`;
    }

    if (message.includes("found no cards in hand to trash.")) {
        completePowerGain();
        return `${leader.name}'s Once Per Turn effect drew 2 cards and gained +1000 power until the end of ${durationText}.`;
    }

    return `${leader.name}'s Once Per Turn effect activated after ${playedCard.name} was played from ${playedCard.playedFromZone}. ${message}`;
}

function resolveAceYamatoLeaderActivateMain(player, leader, ui) {
    const activeLeader = getAceYamatoLeader(player);

    if (!activeLeader || leader?.instanceId !== activeLeader.instanceId) {
        return {
            success: false,
            message: "Ace & Yamato's effect could not be found."
        };
    }

    if (getAceYamatoLeaderKOTargetChoices(player).length < 2) {
        return {
            success: false,
            message: `${leader.name}'s effect requires 2 of your {Land of Wano} Characters to K.O.`
        };
    }

    const chosenInstanceIds = new Set();

    const chooseNextCharacter = () => {
        if (chosenInstanceIds.size >= 2) {
            const lifeMessage = chooseHandCard(player, leader, {
                prompt: `Choose up to 1 card from hand to place on top of your Life cards for ${leader.name}.`,
                optional: true,
                onSelect: ({ handIndex, card }) => {
                    const chosenCard = player.hand.splice(handIndex, 1)[0];

                    if (!chosenCard) {
                        addGameLog(`${leader.name} could not find that hand card.`);
                        return;
                    }

                    addCardToLife(player, chosenCard, ui);
                    ui?.renderHands?.();
                    ui?.renderLifeCards?.();
                    addGameLog(`${player.name} placed ${card.name} from hand on top of life with ${leader.name}.`);

                    if (typeof queueMultiplayerStateSync === "function") {
                        queueMultiplayerStateSync();
                    }
                },
                skipMessage: `${player.name} K.O.'d 2 {Land of Wano} Characters for ${leader.name} but did not place a card from hand on life.`,
                emptyMessage: `${leader.name} found no cards in hand to place on life.`
            });

            if (lifeMessage) {
                addGameLog(lifeMessage);
            }

            return;
        }

        const chooseMessage = chooseOwnBoardCard(player, leader, {
            prompt: `Choose {Land of Wano} Character ${chosenInstanceIds.size + 1} of 2 to K.O. for ${leader.name}.`,
            optional: false,
            filter: card => {
                return card.cardType === "character" &&
                    hasTypeText(card, "Land of Wano") &&
                    !chosenInstanceIds.has(card.instanceId);
            },
            onSelect: ({ slotIndex, card }) => {
                chosenInstanceIds.add(card.instanceId);

                // Use the normal K.O. flow here so any On K.O. effects resolve as usual.
                const koResult = KOCharacter(player, slotIndex, ui);
                addGameLog(koResult.message);

                if (!koResult.success) {
                    return;
                }

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }

                chooseNextCharacter();
            },
            emptyMessage: `${leader.name} found no more {Land of Wano} Characters to K.O.`
        });

        if (chooseMessage) {
            addGameLog(chooseMessage);
        }
    };

    chooseNextCharacter();

    return {
        success: true,
        message: `${player.name} is choosing 2 of their {Land of Wano} Characters to K.O. for ${leader.name}.`
    };
}

function getImuLeader(player) {
    const leader = player?.leader;

    if (!leader || leader.cardNumber !== "IMU1-001" || areCardEffectsNegated(leader)) {
        return null;
    }

    return leader;
}

function getAvailableImuStageProtectionReplacement(targetPlayer, actingPlayer) {
    if (!targetPlayer || !actingPlayer || targetPlayer === actingPlayer) {
        return null;
    }

    if (areOpponentReplacementEffectsNegated(targetPlayer, actingPlayer)) {
        return null;
    }

    return targetPlayer.characters.find(card => {
        return card?.cardNumber === "IMU1-005" &&
            !areCardEffectsNegated(card);
    }) || null;
}

function clearCardStateForDeck(card) {
    if (!card) {
        return;
    }

    card.state = "active";
    card.uiAnimation = "";
    card.temporaryKeywords = [];
    card.durationKeywords = [];
    card.battleKeywords = [];
    card.battlePowerBonus = 0;
    card.temporaryPowerBonus = 0;
    card.durationPowerBonuses = [];
    card.costModifiers = [];
    card.protectedFromOpponentEffects = false;
    card.cannotBeRestedUntil = null;
    card.cannotAttackUntil = null;
    card.playedOnTurn = null;
    card.playedFromZone = null;
}

function moveCharacterToBottomOfDeck(player, slotIndex, sourceCard, ui) {
    const character = player?.characters?.[slotIndex];

    if (!player || !character) {
        return `${sourceCard.name} could not find that Character anymore.`;
    }

    player.characters[slotIndex] = null;
    detachAttachedDonToCostArea(player, character, ui);
    resolveGutsLeaderCharacterRemovedBonus(player, ui);
    const linkedStageMessage = trashLinkedParfumStageForCharacter(player, character, ui);
    clearCardStateForDeck(character);
    player.deck.push(character);
    ui?.renderCharacters?.();
    ui?.renderDecks?.();

    if (typeof queueMultiplayerStateSync === "function") {
        queueMultiplayerStateSync();
    }

    return linkedStageMessage
        ? `${sourceCard.name} placed ${character.name} on the bottom of the deck. ${linkedStageMessage}`
        : `${sourceCard.name} placed ${character.name} on the bottom of the deck.`;
}

function resolveImuOnOpponentAttack(player, sourceCard, ui, options = {}) {
    const finish = () => {
        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }

        options.onComplete?.();
    };

    const activeLeader = getImuLeader(player);
    const effect = sourceCard?.effects?.find(cardEffect => cardEffect.id === "IMU1-007-on-opponents-attack");

    if (!activeLeader || !sourceCard || sourceCard.cardNumber !== "IMU1-007" || areCardEffectsNegated(sourceCard)) {
        finish();
        return `${sourceCard?.name || "This effect"} could not be used because Imu is not active.`;
    }

    if (!effect || CardEffects.hasUsedOncePerTurnEffect(sourceCard, effect.id, player.turns)) {
        finish();
        return `${sourceCard.name}'s On Your Opponent's Attack effect has already been used this turn.`;
    }

    if (typeof currentAttack === "undefined" || !currentAttack) {
        finish();
        return `${sourceCard.name} could not be used because there is no current attack.`;
    }

    if (currentAttack.defenderPlayerKey !== getPlayerKey(player)) {
        finish();
        return `${sourceCard.name} could not be used because ${player.name} is not the defending player.`;
    }

    if ((player.deck?.length || 0) < 2) {
        finish();
        return `${sourceCard.name} requires 2 cards in deck to trash.`;
    }

    const retargetChoices = getOwnBoardChoices(player, {
        includeLeader: true,
        filter: card => {
            return card.cardType === "leader" ||
                (card.cardType === "character" && hasTypeText(card, "Holy Knight"));
        }
    });

    if (retargetChoices.length === 0) {
        finish();
        return `${sourceCard.name} found no valid targets for the attack.`;
    }

    CardEffects.markOncePerTurnEffectUsed(sourceCard, effect.id, player.turns);

    const trashResult = trashTopCardsOfDeck(player, 2, ui);
    const chooseMessage = chooseBoardCard(player, sourceCard, retargetChoices, {
        prompt: "Choose your Leader or up to 1 of your {Holy Knight} Characters to become the new attack target.",
        optional: false,
        onSelect: ({ cardType, slotIndex }) => {
            currentAttack.target = {
                playerKey: getPlayerKey(player),
                cardType,
                ...(cardType === "character" ? { slotIndex } : {})
            };

            if (typeof drawAttackArrow === "function") {
                drawAttackArrow(currentAttack.attacker, currentAttack.target);
            }

            addGameLog(`${sourceCard.name} changed the attack target.`);
            finish();
        },
        onEmpty: finish,
        emptyMessage: `${sourceCard.name} found no valid targets for the attack.`
    });

    return `${trashResult.message} ${chooseMessage || ""}`.trim();
}

function resolveKouzukiOdenTriggerPlay(player, card, ui) {
    const opponent = getOpponentOfPlayer(player);

    if ((opponent?.life?.length || 0) > 3) {
        moveCardToTrash(player, card, ui);
        ui?.renderTrash?.();
        return `${card.name}'s Trigger did not play it because ${opponent?.name || "the opponent"} has more than 3 life cards. It was placed in trash.`;
    }

    const finishWithoutPlay = (message) => {
        moveCardToTrash(player, card, ui);
        ui?.renderTrash?.();
        addGameLog(message);

        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }
    };

    const chooseMessage = chooseHandCard(player, card, {
        prompt: `Choose 1 card from your hand to trash to play ${card.name}.`,
        optional: true,
        onSelect: ({ handIndex, card: discardedCard }) => {
            const trashedCard = player.hand.splice(handIndex, 1)[0];

            if (!trashedCard) {
                finishWithoutPlay(`${card.name}'s Trigger could not find that hand card to trash.`);
                return;
            }

            moveCardToTrash(player, trashedCard, ui);
            ui?.renderHands?.();
            ui?.renderTrash?.();
            addGameLog(`${player.name} trashed ${discardedCard.name} for ${card.name}'s Trigger.`);
            addGameLog(playCardFromTrigger(player, card, ui));

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }
        },
        onSkip: () => finishWithoutPlay(`${player.name} did not trash a card to play ${card.name}. It was placed in trash.`),
        onEmpty: () => finishWithoutPlay(`${card.name}'s Trigger found no cards in hand to trash, so it was placed in trash.`),
        skipMessage: `${player.name} did not trash a card to play ${card.name}.`,
        emptyMessage: `${card.name}'s Trigger found no cards in hand to trash.`
    });

    return chooseMessage || `${player.name} is choosing whether to trash a card to play ${card.name}.`;
}

function getHanamiLeader(player) {
    const leader = player?.leader;

    if (!leader || leader.cardNumber !== "JK02-001" || areCardEffectsNegated(leader)) {
        return null;
    }

    return leader;
}

function resolveHanamiLeaderActivateMain(player, leader, ui) {
    const activeLeader = getHanamiLeader(player);

    if (!activeLeader || leader?.instanceId !== activeLeader.instanceId) {
        return {
            success: false,
            message: "Hanami's effect could not be found."
        };
    }

    if (!player.characters.some(card => {
        return card?.cardType === "character" &&
            (card.state || "active") === "rested";
    })) {
        return {
            success: false,
            message: `${leader.name} found no rested Characters to give Rush.`
        };
    }

    const chooseMessage = chooseOwnBoardCard(player, leader, {
        prompt: `Choose up to 1 of your rested Characters to give Rush with ${leader.name}.`,
        optional: true,
        includeLeader: false,
        filter: card => {
            return card.cardType === "character" &&
                (card.state || "active") === "rested";
        },
        onSelect: ({ card }) => {
            addTemporaryKeyword(card, "rush");
            ui?.renderCharacters?.();
            addGameLog(`${leader.name} gave ${card.name} Rush until the end of the turn.`);

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }
        },
        skipMessage: `${player.name} did not choose a rested Character for ${leader.name}.`,
        emptyMessage: `${leader.name} found no rested Characters to give Rush.`
    });

    return {
        success: true,
        message: chooseMessage || `${leader.name}'s effect resolved.`
    };
}

function resolveRopongiCurseActivateMain(player, sourceCard, ui) {
    const validTargets = getOpponentCharacterChoices(player, card => {
        return getCardEffectiveCost(card) <= 4 &&
            (card.state || "active") === "active";
    });

    if (validTargets.length === 0) {
        return {
            success: false,
            message: `${sourceCard.name} found no active opposing Characters with a cost of 4 or less to rest.`
        };
    }

    const message = chooseOpponentCharacter(player, sourceCard, {
        prompt: "Choose up to 1 opposing active Character with a cost of 4 or less to rest.",
        optional: true,
        filter: card => getCardEffectiveCost(card) <= 4 && (card.state || "active") === "active",
        onSelect: ({ card, playerKey }) => {
            const targetPlayer = playerKey ? gameState?.[playerKey] : getPlayerForBoardCard(card);
            const targetPlayerKey = getPlayerKey(targetPlayer);

            if (isProtectedFromOpponentEffects(card, targetPlayerKey, player)) {
                addGameLog(`${card.name} is protected from opponent effects.`);
                return;
            }

            if (!setCardRested(card)) {
                addGameLog(`${card.name} cannot be rested due to an effect.`);
                return;
            }

            addGameLog(`${sourceCard.name} rested ${card.name}.`);

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }
        },
        skipMessage: `${player.name} did not choose a Character for ${sourceCard.name}.`,
        emptyMessage: `${sourceCard.name} found no active opposing Characters with a cost of 4 or less.`
    });

    return {
        success: true,
        message: message || `${sourceCard.name}'s effect resolved.`
    };
}

function resolveJogoActivateMain(player, sourceCard, ui) {
    if (Number(sourceCard?.playedOnTurn ?? -1) !== Number(player?.turns ?? -2)) {
        return {
            success: false,
            message: `${sourceCard.name} can only use this effect on the turn it was played.`
        };
    }

    sourceCard.uiAnimation = "readied";
    sourceCard.state = "active";

    const opponent = getOpponentOfPlayer(player);
    const opponentKey = getPlayerKey(opponent);

    addDurationPowerBonus(
        player.leader,
        2000,
        Number(opponent?.turns || 0),
        opponentKey
    );

    ui?.renderLeaders?.();
    ui?.renderCharacters?.();

    if (typeof queueMultiplayerStateSync === "function") {
        queueMultiplayerStateSync();
    }

    return {
        success: true,
        message: `${sourceCard.name} set itself as active and gave ${player.leader?.name || "your leader"} +2000 power until the start of ${player.name}'s next turn.`
    };
}

function resolveGrasshopperCurseActivateMain(player, sourceCard, ui) {
    const restedCharacters = player.characters.filter(card => {
        return card?.cardType === "character" &&
            (card.state || "active") === "rested";
    });

    if (restedCharacters.length < 3) {
        return {
            success: false,
            message: `${sourceCard.name} requires 3 rested Characters.`
        };
    }

    const refreshedDon = setRestedDonActive(player, 4, ui);

    return {
        success: true,
        message: refreshedDon > 0
            ? `${sourceCard.name} set ${refreshedDon} DON!! card${refreshedDon === 1 ? "" : "s"} as active.`
            : `${sourceCard.name} found no rested DON!! cards to set active.`
    };
}

function resolveMahitoActivateMain(player, sourceCard, ui) {
    if (player.hand.length < 1) {
        return {
            success: false,
            message: `${sourceCard.name} requires 1 card in hand to trash.`
        };
    }

    const validTargets = player.characters.filter(card => {
        return card?.cardType === "character" &&
            hasTypeText(card, "Curse Spirit") &&
            getCardEffectiveCost(card) <= 3;
    });

    if (validTargets.length === 0) {
        return {
            success: false,
            message: `${sourceCard.name} found no {Curse Spirit} Characters with a cost of 3 or less.`
        };
    }

    const chooseTrashMessage = chooseHandCard(player, sourceCard, {
        prompt: `Choose 1 card from your hand to trash for ${sourceCard.name}.`,
        optional: false,
        onSelect: ({ card }) => {
            const handIndex = player.hand.indexOf(card);

            if (handIndex === -1) {
                addGameLog(`${sourceCard.name} could not find that hand card to trash.`);
                return;
            }

            const trashedCard = player.hand.splice(handIndex, 1)[0];
            moveCardToTrash(player, trashedCard, ui);
            ui?.renderHands?.();
            ui?.renderTrash?.();
            addGameLog(`${player.name} trashed ${trashedCard.name} for ${sourceCard.name}.`);

            const chooseTargetMessage = chooseOwnBoardCard(player, sourceCard, {
                prompt: "Choose up to 1 of your {Curse Spirit} Characters with a cost of 3 or less to gain Blocker.",
                optional: true,
                includeLeader: false,
                filter: boardCard => {
                    return boardCard.cardType === "character" &&
                        hasTypeText(boardCard, "Curse Spirit") &&
                        getCardEffectiveCost(boardCard) <= 3;
                },
                onSelect: ({ card: targetCard }) => {
                    targetCard.keywords = Array.isArray(targetCard.keywords) ? targetCard.keywords : [];

                    if (!targetCard.keywords.includes("blocker")) {
                        targetCard.keywords.push("blocker");
                    }

                    ui?.renderCharacters?.();
                    addGameLog(`${sourceCard.name} gave ${targetCard.name} Blocker.`);

                    if (typeof queueMultiplayerStateSync === "function") {
                        queueMultiplayerStateSync();
                    }
                },
                skipMessage: `${player.name} trashed a card for ${sourceCard.name} but did not choose a Character.`,
                emptyMessage: `${sourceCard.name} found no {Curse Spirit} Characters with a cost of 3 or less.`
            });

            if (chooseTargetMessage) {
                addGameLog(chooseTargetMessage);
            }

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }
        },
        emptyMessage: `${sourceCard.name} found no cards in hand to trash.`
    });

    return {
        success: true,
        message: chooseTrashMessage || `${sourceCard.name}'s effect resolved.`
    };
}

function resolveKurourushiActivateMain(player, sourceCard, ui) {
    if (player.hand.length < 2) {
        return {
            success: false,
            message: `${sourceCard.name} requires 2 cards in hand to trash.`
        };
    }

    if (getOpponentCharacterChoices(player, () => true).length === 0) {
        return {
            success: false,
            message: `${sourceCard.name} found no opposing Characters to reduce.`
        };
    }

    chooseCardsFromHandToTrash(player, sourceCard, ui, 2, () => {
        const chooseMessage = chooseOpponentCharacter(player, sourceCard, {
            prompt: "Choose up to 1 opposing Character to give -5 cost this turn.",
            optional: true,
            onSelect: ({ card }) => {
                addCostModifier(card, -5);
                addGameLog(`${sourceCard.name} gave ${card.name} -5 cost this turn.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} trashed 2 cards for ${sourceCard.name} but did not choose a target.`,
            emptyMessage: `${sourceCard.name} found no opposing Characters.`
        });

        if (chooseMessage) {
            addGameLog(chooseMessage);
        }
    });

    return {
        success: true,
        message: `${player.name} is trashing 2 cards for ${sourceCard.name}.`
    };
}

function resolveKenjakuOnPlay(player, sourceCard, ui) {
    const chosenInstanceIds = new Set();

    const playChoiceFromTrash = (maxCost, onComplete) => {
        if (getFirstOpenCharacterSlotIndex(player) === -1) {
            addGameLog(`${sourceCard.name} stopped because ${player.name}'s character area is full.`);
            onComplete?.();
            return;
        }

        const chooseMessage = chooseTrashCard(player, sourceCard, ui, {
            prompt: `Choose up to 1 Character card with a cost of ${maxCost} or less from your trash to play.`,
            optional: true,
            filter: card => {
                return card.cardType === "character" &&
                    getCardEffectiveCost(card) <= maxCost &&
                    !chosenInstanceIds.has(card.instanceId);
            },
            onSelect: ({ trashIndex, card }) => {
                const playedCard = player.trash.splice(trashIndex, 1)[0];

                if (!playedCard) {
                    addGameLog(`${sourceCard.name} could not find that trash card anymore.`);
                    onComplete?.();
                    return;
                }

                chosenInstanceIds.add(card.instanceId);
                addGameLog(playCharacterFromTrashWithoutCost(player, sourceCard, playedCard, ui));

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }

                onComplete?.();
            },
            onSkip: onComplete,
            onEmpty: onComplete,
            skipMessage: `${player.name} did not play a Character with ${sourceCard.name}.`,
            emptyMessage: `${sourceCard.name} found no Character cards with a cost of ${maxCost} or less in trash.`
        });

        if (chooseMessage) {
            addGameLog(chooseMessage);
        }
    };

    playChoiceFromTrash(4, () => {
        playChoiceFromTrash(2);
    });

    return `${player.name} is choosing Characters from trash for ${sourceCard.name}.`;
}

function resolveWanoCountryActivateMain(player, stage, ui) {
    if (player.restedDon < 1) {
        return {
            success: false,
            message: `${stage.name} found no rested DON!! to attach.`
        };
    }

    if (!player.characters.some(card => card?.cardType === "character")) {
        return {
            success: false,
            message: `${stage.name} found no characters to receive DON!!.`
        };
    }

    const message = chooseOwnBoardCard(player, stage, {
        prompt: "Choose up to 1 of your characters to receive 1 rested DON!!.",
        optional: true,
        includeLeader: false,
        filter: card => card.cardType === "character",
        onSelect: ({ card }) => {
            addGameLog(giveRestedDonToCard(player, stage, card, ui));

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }
        },
        skipMessage: `${player.name} did not give a DON!! card with ${stage.name}.`,
        emptyMessage: `${stage.name} found no character to receive DON!!.`
    });

    return {
        success: true,
        message: message || `${stage.name}'s effect resolved.`
    };
}

function resolveBlackYamatoActivateMain(player, sourceCard, ui) {
    const sourceSlotIndex = player?.characters?.findIndex(card => card?.instanceId === sourceCard?.instanceId) ?? -1;

    if (sourceSlotIndex === -1) {
        return {
            success: false,
            message: `${sourceCard.name} is not on the field.`
        };
    }

    const validTargets = getTrashCharacterChoices(player, card => {
        return card?.color === "black" &&
            CardEffects.hasCardName(card, "Yamato") &&
            getCardEffectiveCost(card) === 8;
    });

    if (validTargets.length === 0) {
        return {
            success: false,
            message: `${sourceCard.name} found no black [Yamato] with a cost of 8 in trash.`
        };
    }

    const trashResult = trashCharacterFromField(player, sourceSlotIndex, ui, {
        render: false
    });
    const linkedStageMessage = trashResult.linkedStageMessage;

    ui?.renderLeaders?.();
    ui?.renderCharacters?.();
    ui?.renderTrash?.();

    const chooseMessage = chooseTrashCard(player, sourceCard, ui, {
        prompt: "Choose up to 1 black [Yamato] with a cost of 8 from your trash to play.",
        optional: true,
        filter: card => {
            return card.cardType === "character" &&
                card.color === "black" &&
                CardEffects.hasCardName(card, "Yamato") &&
                getCardEffectiveCost(card) === 8;
        },
        onSelect: ({ trashIndex }) => {
            const playedCard = player.trash.splice(trashIndex, 1)[0];

            if (!playedCard) {
                addGameLog(`${sourceCard.name} could not find that trash card anymore.`);
                return;
            }

            const playMessage = playCharacterFromTrashWithoutCost(player, sourceCard, playedCard, ui);
            addGameLog(
                linkedStageMessage
                    ? `${playMessage} ${linkedStageMessage}`
                    : playMessage
            );

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }
        },
        skipMessage: `${player.name} trashed ${sourceCard.name} but did not play a black [Yamato] from trash.`,
        emptyMessage: `${sourceCard.name} found no black [Yamato] with a cost of 8 in trash after paying its cost.`
    });

    return {
        success: true,
        message: linkedStageMessage
            ? `${sourceCard.name} trashed itself. ${linkedStageMessage} ${chooseMessage}`.trim()
            : `${sourceCard.name} trashed itself. ${chooseMessage}`.trim()
    };
}

function returnAttachedDonChoice(player, sourceCard, ui, amount, options = {}) {
    let returnedCount = 0;

    const finish = () => {
        options.onComplete?.(returnedCount);
    };

    const chooseNext = () => {
        if (returnedCount >= amount) {
            finish();
            return;
        }

        const message = chooseOwnBoardCard(player, sourceCard, {
            prompt: `Choose card ${returnedCount + 1} of ${amount} with attached DON!! to return to your cost area rested.`,
            optional: false,
            includeLeader: true,
            filter: card => (card.cardType === "leader" || card.cardType === "character") && Number(card.attachedDon || 0) > 0,
            onSelect: ({ card }) => {
                card.attachedDon = Math.max(0, Number(card.attachedDon || 0) - 1);
                player.restedDon += 1;
                returnedCount += 1;

                ui?.updateDonDisplay?.();
                ui?.renderLeaders?.();
                ui?.renderCharacters?.();
                addGameLog(`${player.name} returned 1 attached DON!! from ${card.name} to the cost area rested for ${sourceCard.name}.`);
                chooseNext();
            },
            emptyMessage: `${sourceCard.name} found no more attached DON!! to return.`
        });

        if (message) {
            addGameLog(message);
        }
    };

    chooseNext();
    return `${player.name} is choosing attached DON!! to return for ${sourceCard.name}.`;
}

function resolveOtamaActivateMain(player, sourceCard, ui) {
    if ((sourceCard.state || "active") === "rested") {
        return {
            success: false,
            message: `${sourceCard.name} is already rested.`
        };
    }

    if (!setCardRested(sourceCard)) {
        return {
            success: false,
            message: `${sourceCard.name} cannot be rested due to an effect.`
        };
    }

    if (!player.life?.length) {
        return {
            success: false,
            message: `${sourceCard.name} found no life card to add to hand.`
        };
    }

    const chooseLifePosition = (position) => {
        const addedCard = takeLifeCardToHand(player, ui, {
            position
        });

        if (!addedCard) {
            addGameLog(`${sourceCard.name} could not add a life card to hand.`);
            return;
        }

        const powerMessage = chooseLeaderOrCharacterForPower(player, sourceCard, ui, 3000, {
            prompt: "Choose up to 1 of your leader or characters to give +3000 power this turn.",
            duration: "turn",
            optional: true,
            afterSelect: () => {
                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            }
        });

        if (powerMessage) {
            addGameLog(powerMessage);
        }

        if (typeof queueMultiplayerStateSync === "function") {
            queueMultiplayerStateSync();
        }
    };

    if (player.life.length > 1 && ui?.chooseEffectOption) {
        ui.chooseEffectOption({
            player,
            sourceCard,
            title: sourceCard.name,
            prompt: `Add the top or bottom life card to hand for ${sourceCard.name}?`,
            options: [
                { label: "Top", value: "top" },
                { label: "Bottom", value: "bottom" }
            ],
            onComplete: (value) => {
                chooseLifePosition(value === "bottom" ? "bottom" : "top");
            }
        });

        return {
            success: true,
            message: `${player.name} rested ${sourceCard.name} and is choosing a life card to add to hand.`
        };
    }

    chooseLifePosition("top");

    return {
        success: true,
        message: `${player.name} rested ${sourceCard.name} and added a life card to hand.`
    };
}

function resolveSt28MomonosukeActivateMain(player, sourceCard, ui) {
    if (getTotalAttachedDonCount(player) < 2) {
        return {
            success: false,
            message: `${sourceCard.name} requires 2 attached DON!! cards to return to the cost area rested.`
        };
    }

    const chooseMessage = returnAttachedDonChoice(player, sourceCard, ui, 2, {
        onComplete: (returnedCount) => {
            if (returnedCount < 2) {
                addGameLog(`${sourceCard.name} did not return enough attached DON!! to resolve fully.`);
                return;
            }

            addTemporaryKeyword(sourceCard, "rush");
            addTemporaryPowerBonus(sourceCard, 1000);
            ui?.renderCharacters?.();
            addGameLog(`${sourceCard.name} gained Rush and +1000 power this turn.`);

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }
        }
    });

    return {
        success: true,
        message: chooseMessage || `${sourceCard.name}'s effect resolved.`
    };
}

function resolveOnPlayEffects(player, card, ui) {
    if (!player || !card) {
        return [];
    }

    const messages = [];

    const aceYamatoLeaderMessage = resolveAceYamatoLeaderOnCharacterPlay(player, card, ui);

    if (aceYamatoLeaderMessage) {
        messages.push(aceYamatoLeaderMessage);
    }

    card.effects
        ?.filter(effect => effect.type === "onPlay")
        .forEach(effect => {
            if (effect.id === "SUB1-008-on-play-checkpoint") {
                const message = saveSubaruCheckpointState(player, card, ui);

                if (message) {
                    messages.push(message);
                }

                return;
            }

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

function resolveOnKOEffects(player, card, ui, options = {}) {
    if (!player || !card) {
        return [];
    }

    if (areCardEffectsNegated(card)) {
        return [];
    }

    const messages = [];

    if (card.cardNumber === "KIL1-007") {
        const bubblegumMessage = resolveKillerBubblegumEffect(player, card, ui, options);

        if (bubblegumMessage) {
            messages.push(bubblegumMessage);
        }
    }

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

            const message = resolveEffectAction(player, card, effect, ui, options);

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

    getMainPhaseEventEffects(card)
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

    const openSlotIndex = getFirstOpenCharacterSlotIndex(player);

    if (openSlotIndex === -1 && player.characters[sourceSlotIndex] !== sourceCard) {
        return `${sourceCard.name}'s effect could not play B.R.A.N.K.O. because ${player.name}'s character area is full.`;
    }

    const opponent = getOpponentPlayer(player);
    const maxCost = getTotalDonInPlay(opponent);
    const handChoices = player.hand
        .map((card, handIndex) => ({
            zone: "hand",
            handIndex,
            card
        }))
        .filter(entry => {
            return entry.card?.cardNumber === "POG1-012" &&
                Number(entry.card.cost ?? 0) <= maxCost;
        });
    const trashChoices = player.trash
        .map((card, trashIndex) => ({
            zone: "trash",
            trashIndex,
            card
        }))
        .filter(entry => {
            return entry.card?.cardNumber === "POG1-012" &&
                Number(entry.card.cost ?? 0) <= maxCost;
        });
    const choices = [...handChoices, ...trashChoices];

    if (choices.length === 0) {
        return `${sourceCard.name} found no B.R.A.N.K.O. in hand or trash with cost ${maxCost} or less.`;
    }

    const trashResult = trashCharacterFromField(player, sourceSlotIndex, ui, {
        render: false
    });
    const linkedStageMessage = trashResult.linkedStageMessage;

    const completePlay = (choice) => {
        if (!choice) {
            addGameLog(`${player.name} trashed ${sourceCard.name} but did not choose a B.R.A.N.K.O. to play.`);
            return;
        }

        let playedCard = null;

        if (choice.zone === "hand") {
            playedCard = player.hand.splice(choice.handIndex, 1)[0];
        } else if (choice.zone === "trash") {
            playedCard = player.trash.splice(choice.trashIndex, 1)[0];
        }

        if (!playedCard) {
            addGameLog(`${sourceCard.name} could not find the chosen B.R.A.N.K.O..`);
            return;
        }

        const message = playCardFromDeckWithoutCost(
            player,
            sourceCard,
            playedCard,
            ui,
            choice.zone === "hand" ? "hand" : "trash"
        );
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
            prompt: `Choose a B.R.A.N.K.O. from your hand or trash with cost ${maxCost} or less to play.`,
            choices: choices.map(choice => ({
                ...choice,
                choiceLabel: choice.zone === "hand" ? "Hand" : "Trash"
            })),
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

    if (!canPlayEventInMainPhase(card)) {
        return {
            success: false,
            message: `${card.name} cannot be played during the main phase because it does not have a Main effect.`
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

    return setCardRested(card);
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

function trashCharacterFromField(player, slotIndex, ui, options = {}) {
    const providedCharacter = options.character || null;
    const slotCharacter = Number.isInteger(slotIndex)
        ? player?.characters?.[slotIndex] || null
        : null;
    const character = slotCharacter || providedCharacter;

    if (!player || !character) {
        return {
            success: false,
            message: "No character was found to trash."
        };
    }

    const resolvedSlotIndex = Number.isInteger(slotIndex)
        ? slotIndex
        : player.characters.findIndex(card => card?.instanceId === character.instanceId);

    if (resolvedSlotIndex !== -1 && player.characters[resolvedSlotIndex]?.instanceId === character.instanceId) {
        player.characters[resolvedSlotIndex] = null;
    }

    moveCardToTrash(player, character, ui);
    resolveGutsLeaderCharacterRemovedBonus(player, ui);
    const linkedStageMessage = trashLinkedParfumStageForCharacter(player, character, ui);

    if (options.render !== false) {
        ui?.renderLeaders?.();
        ui?.renderCharacters?.();
        ui?.renderTrash?.();
    }

    return {
        success: true,
        character,
        linkedStageMessage,
        message: linkedStageMessage
            ? `${character.name} was trashed and placed in the trash. ${linkedStageMessage}`
            : `${character.name} was trashed and placed in the trash.`
    };
}

function KOCharacter(player, slotIndex, ui, options = {}) {
    const character = player.characters[slotIndex];

    if (!character) {
        return {
            success: false,
            message: "No character was found in that slot."
        };
    }

    if (options.byEffect && character.cardNumber === "JK02-015" && !areCardEffectsNegated(character)) {
        return {
            success: false,
            message: `${character.name} cannot be K.O.'d by effects.`
        };
    }

    if (options.byEffect && hasRamBoostedRem(character)) {
        return {
            success: false,
            message: `${character.name} cannot be removed from the field by effects.`
        };
    }

    if (
        options.byEffect &&
        character.cardNumber === "IMU1-007" &&
        !areCardEffectsNegated(character) &&
        options.actingPlayer &&
        getPlayerForBoardCard(character) !== options.actingPlayer
    ) {
        return {
            success: false,
            message: `${character.name} cannot be K.O.'d by your opponent's effects.`
        };
    }

    if (options.byBattle && character.cardNumber === "IMU1-008" && !areCardEffectsNegated(character)) {
        if ((player.deck?.length || 0) >= 2) {
            const preventKO = () => {
                const trashResult = trashTopCardsOfDeck(player, 2, ui);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }

                return {
                    success: false,
                    message: `${trashResult.message} ${character.name} stayed on the field instead of being K.O.'d in combat.`.trim()
                };
            };

            if (ui?.chooseEffectActivation) {
                ui.chooseEffectActivation({
                    player,
                    sourceCard: character,
                    effect: character.effects?.find(effect => effect.id === "IMU1-008-battle-protection") || {
                        id: "IMU1-008-battle-protection",
                        type: "replacement",
                        text: "Trash 2 cards from the top of your deck instead?"
                    },
                    title: character.name,
                    prompt: `${character.name} would be K.O.'d in combat. Trash 2 cards from the top of your deck instead?`,
                    activateText: "Trash 2",
                    skipText: "Let K.O.",
                    onComplete: (shouldActivate) => {
                        addGameLog(
                            shouldActivate
                                ? preventKO().message
                                : KOCharacter(player, slotIndex, ui, {
                                    ...options,
                                    byBattle: false
                                }).message
                        );
                    }
                });

                return {
                    success: false,
                    message: `${player.name} is choosing whether to use ${character.name}'s battle protection effect.`
                };
            }

            return preventKO();
        }
    }

    character.attachedDonBeforeKO = Number(character.attachedDon || 0);

    const trashResult = trashCharacterFromField(player, slotIndex, ui, {
        render: false
    });
    const linkedStageMessage = trashResult.linkedStageMessage;

    const effectMessages = resolveOnKOEffects(player, character, ui, options);

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

    if (lifeTaken > 0) {
        const kashimoMessage = resolveHajimeKashimoLifeTakenEffects(player, ui);

        if (kashimoMessage) {
            addGameLog(kashimoMessage);
        }
    }

    const triggerText = triggerMessages.length > 0
        ? ` ${triggerMessages.join(" ")}`
        : "";
    const winCondition = getLifeZeroWinConditionWinner(player);

    if (winCondition && (typeof currentAttack === "undefined" || !currentAttack) && typeof endGame === "function") {
        endGame(
            winCondition.winnerPlayer,
            winCondition.reasonTitle,
            winCondition.reasonText
        );
    }

    return {
        success: lifeTaken > 0,
        lifeTaken,
        remainingLife: player.life.length,
        winnerPlayer: winCondition?.winnerPlayer || null,
        reasonTitle: winCondition?.reasonTitle || "",
        reasonText: winCondition?.reasonText || "",
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
    if (effect.id === "OP06-104-trigger-play") {
        const opponent = getOpponentOfPlayer(player);

        if ((opponent?.life?.length || 0) > 3) {
            moveCardToTrash(player, card, ui);

            if (ui?.renderTrash) {
                ui.renderTrash();
            }

            return `${card.name}'s Trigger did not play it because ${opponent?.name || "the opponent"} has more than 3 life cards. It was placed in trash.`;
        }

        return playCardFromTrigger(player, card, ui);
    }

    if (effect.id === "YAM1-002-trigger-play") {
        return resolveKouzukiOdenTriggerPlay(player, card, ui);
    }

    if (effect.id === "SUB1-009-trigger-play") {
        return playCardFromTrigger(player, card, ui);
    }

    if (effect.id === "KIL1-007-trigger") {
        if (!hasTypeText(player.leader, "Kid Pirates")) {
            moveCardToTrash(player, card, ui);

            if (ui?.renderTrash) {
                ui.renderTrash();
            }

            return `${card.name}'s Trigger did not play it because ${player.name}'s leader does not have the {Kid Pirates} type. It was placed in trash.`;
        }

        return playCardFromTrigger(player, card, ui);
    }

    if (effect.id === "KIL1-013-trigger") {
        const counterEffect = getCounterEffects(card, player)?.find(counter => counter.id === "KIL1-013-counter");
        const message = counterEffect
            ? resolveEffectAction(player, card, counterEffect, ui, {
                skipActivationPrompt: true
            })
            : "";

        moveCardToTrash(player, card, ui);

        if (ui?.renderTrash) {
            ui.renderTrash();
        }

        return message
            ? `${card.name}'s Trigger activated its Counter effect. ${message}`
            : `${card.name}'s Trigger activated, then it was placed in trash.`;
    }

    if (effect.actionId === "playThisCardFromTrigger") {
        return playCardFromTrigger(player, card, ui);
    }

    if (effect.actionId === "activateOnPlayEffect") {
        const onPlayMessages = resolveOnPlayEffects(player, card, ui);

        moveCardToTrash(player, card, ui);

        if (ui?.renderTrash) {
            ui.renderTrash();
        }

        return onPlayMessages.length > 0
            ? `${card.name}'s Trigger activated its On Play effect. ${onPlayMessages.join(" ")}`
            : `${card.name}'s Trigger activated, then it was placed in trash.`;
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
        card.playedFromZone = "life";
        player.characters[slotIndex] = card;

        const effectMessages = resolveOnPlayEffects(player, card, ui);

        ui.renderCharacters();

        return effectMessages.length > 0
            ? `${card.name}'s Trigger played it in character slot ${slotIndex + 1}${card.state === "rested" ? " rested" : ""}. ${effectMessages.join(" ")}`
            : `${card.name}'s Trigger played it in character slot ${slotIndex + 1}${card.state === "rested" ? " rested" : ""}.`;
    }

    if (card.cardType === "stage") {
        if (!canPlayStageToArea(player, card)) {
            player.hand.push(card);
            return `${card.name}'s Trigger could not play it because Parfum is already in play, so it was added to hand.`;
        }

        const replacementMessage = replaceStageOnFieldIfNeeded(player, card, ui);

        card.state = "active";
        player.stage = card;

        const effectMessages = resolveOnPlayEffects(player, card, ui);

        ui.renderStages();

        const playMessage = effectMessages.length > 0
            ? `${card.name}'s Trigger played it to the stage area. ${effectMessages.join(" ")}`
            : `${card.name}'s Trigger played it to the stage area.`;

        return replacementMessage
            ? `${replacementMessage} ${playMessage}`
            : playMessage;
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

    const winCondition = getLifeZeroWinConditionWinner(player);

    if (winCondition && (typeof currentAttack === "undefined" || !currentAttack) && typeof endGame === "function") {
        endGame(
            winCondition.winnerPlayer,
            winCondition.reasonTitle,
            winCondition.reasonText
        );
    }

    return {
        success: lifeBanished > 0,
        lifeBanished,
        remainingLife: player.life.length,
        winnerPlayer: winCondition?.winnerPlayer || null,
        reasonTitle: winCondition?.reasonTitle || "",
        reasonText: winCondition?.reasonText || "",
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

    player.characters.forEach((character, slotIndex) => {
        if (!character) {
            return;
        }

        getCardAllEffects(character)
            ?.filter(effect => effect.type === "endOfYourTurn" || effect.type === "endOfTurn")
            .forEach(effect => {
                if (effect.id === "IMU1-006-end-of-turn") {
                    results.push({
                        activated: true,
                        message: moveCharacterToBottomOfDeck(player, slotIndex, character, ui)
                    });
                    return;
                }

                if (effect.id === "IMU1-010-end-of-turn") {
                    results.push({
                        activated: true,
                        message: trashTopCardsOfDeck(player, 5, ui).message
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

                if (effect.id === "JK02-017-end-of-turn") {
                    const otherRestedCharacter = player.characters.some(card => {
                        return card &&
                            card.instanceId !== character.instanceId &&
                            card.cardType === "character" &&
                            (card.state || "active") === "rested";
                    });

                    if (!otherRestedCharacter) {
                        return;
                    }

                    character.uiAnimation = "readied";
                    character.state = "active";
                    results.push({
                        activated: true,
                        message: `${character.name}'s End of Turn effect set it as active.`
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
                card.cannotBeRestedUntil?.expiresAtPlayerKey === expiringPlayerKey &&
                Number(card.cannotBeRestedUntil.expiresAtEndOfTurns ?? 0) <= Number(expiringPlayer.turns || 0)
            ) {
                card.cannotBeRestedUntil = null;
            }

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
                refreshCardStatDisplay(card);
            }

            if (
                card.lifeZeroWinCondition?.expiresAtPlayerKey === expiringPlayerKey &&
                Number(card.lifeZeroWinCondition.expiresAtEndOfTurns ?? 0) <= Number(expiringPlayer.turns || 0)
            ) {
                card.lifeZeroWinCondition = null;
            }

            if (Array.isArray(card.durationKeywords)) {
                const beforeCount = card.durationKeywords.length;

                card.durationKeywords = card.durationKeywords.filter(entry => {
                    if (!entry?.expiresAtPlayerKey) {
                        return true;
                    }

                    if (entry.expiresAtPlayerKey !== expiringPlayerKey) {
                        return true;
                    }

                    return Number(entry.expiresAtEndOfTurns ?? 0) > Number(expiringPlayer.turns || 0);
                });

                if (card.durationKeywords.length !== beforeCount) {
                    refreshCardStatDisplay(card);
                }
            }

            if (Array.isArray(card.durationPowerBonuses)) {
                const beforeCount = card.durationPowerBonuses.length;

                card.durationPowerBonuses = card.durationPowerBonuses.filter(entry => {
                    if (!entry?.expiresAtPlayerKey) {
                        return true;
                    }

                    if (entry.expiresAtPlayerKey !== expiringPlayerKey) {
                        return true;
                    }

                    return Number(entry.expiresAtEndOfTurns ?? 0) > Number(expiringPlayer.turns || 0);
                });

                if (card.durationPowerBonuses.length !== beforeCount) {
                    refreshCardStatDisplay(card);
                }
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
    const destinationPlayer = getCardZoneDestinationPlayer(player, card);

    if (returnedDon > 0) {
        addGameLog(`${returnedDon} attached DON!! returned to ${player.name}'s cost area rested.`);
    }

    card.cannotBeRestedUntil = null;
    card.uiAnimation = card.uiAnimation || "trashed";
    destinationPlayer.trash.push(card);

    if (ui.renderTrash) {
        ui.renderTrash();
    }
}
