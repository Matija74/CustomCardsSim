// effects.js

// =========================
// Card Effects / Keyword System
// =========================

window.CardEffects = {
    // =========================
    // Keyword Definitions
    // =========================

    keywords: {
        rush: {
            name: "Rush",
            text: "This card can attack on the turn it is played."
        },

        blocker: {
            name: "Blocker",
            text: "This card may rest to block an opponent's attack."
        },

        banish: {
            name: "Banish",
            text: "When this card deals damage to a leader, trash that life card instead of adding it to hand."
        },

        doubleattack: {
            name: "Double Attack",
            text: "When this card deals damage to a leader, the target takes 2 damage instead of 1."
        },

        unblockable: {
            name: "Unblockable",
            text: "When this card attacks, the opponent cannot block the attack."
        },

        rushcharacters: {
            name: "Rush: Characters",
            text: "This card can attack characters on the turn it is played."
        }
    },

    // =========================
    // Keyword Helpers
    // =========================

    normalizeKeyword(keyword) {
        return String(keyword)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "");
    },

    hasKeyword(card, keywordName) {
        if (!card) {
            return false;
        }

        const wantedKeyword = this.normalizeKeyword(keywordName);

        if (typeof areCardEffectsNegated === "function" && areCardEffectsNegated(card)) {
            return false;
        }

        if (card.cardNumber === "BK01-013" && wantedKeyword === "doubleattack") {
            const owner = typeof getPlayerForBoardCard === "function"
                ? getPlayerForBoardCard(card)
                : null;

            if (owner?.leader && this.hasCardName(owner.leader, "Guts")) {
                return true;
            }
        }

        if (card.cardNumber === "BK01-016" && wantedKeyword === "rush") {
            const owner = typeof getPlayerForBoardCard === "function"
                ? getPlayerForBoardCard(card)
                : null;

            if (owner?.leader && this.hasCardName(owner.leader, "Guts")) {
                return true;
            }
        }

        if (card.cardNumber === "JK01-006" && wantedKeyword === "rush") {
            const owner = typeof getPlayerForBoardCard === "function"
                ? getPlayerForBoardCard(card)
                : null;

            if (owner && !owner.stage) {
                return true;
            }
        }

        if (card.cardNumber === "YAM1-002" && wantedKeyword === "doubleattack" && Number(card.attachedDon || 0) >= 1) {
            return true;
        }

        const allKeywords = [
            ...(Array.isArray(card.keywords) ? card.keywords : []),
            ...(Array.isArray(card.durationKeywords)
                ? card.durationKeywords
                    .filter(entry => !entry || !entry.expiresAtPlayerKey || (
                        typeof gameState !== "undefined" &&
                        typeof isTemporaryStatusEntryActive === "function" &&
                        isTemporaryStatusEntryActive(entry)
                    ))
                    .map(entry => entry?.keyword)
                : []),
            ...(Array.isArray(card.temporaryKeywords) ? card.temporaryKeywords : []),
            ...(Array.isArray(card.battleKeywords) ? card.battleKeywords : [])
        ];

        return allKeywords.some(keyword => {
            if (typeof keyword === "string") {
                return this.normalizeKeyword(keyword) === wantedKeyword;
            }

            if (keyword && typeof keyword === "object") {
                return this.normalizeKeyword(keyword.type || keyword.name) === wantedKeyword;
            }

            return false;
        });
    },

    // =========================
    // Rush
    // =========================

    canAttackOnTurnPlayed(card) {
        return this.hasKeyword(card, "rush");
    },

    // =========================
    // Blocker
    // =========================

    canBlock(card) {
        if (!card) return false;

        if (typeof canCardBeRested === "function" && !canCardBeRested(card)) {
            return false;
        }

        return this.hasKeyword(card, "blocker") &&
            (card.state || "active") === "active";
    },

    getAvailableBlockers(player) {
        if (!player || !Array.isArray(player.characters)) {
            return [];
        }

        return player.characters
            .map((card, slotIndex) => ({ card, slotIndex }))
            .filter(entry => this.canBlock(entry.card));
    },

    // =========================
    // Banish
    // =========================

    shouldBanishLife(card) {
        return this.hasKeyword(card, "banish");
    },

    // =========================
    // Double Attack
    // =========================

    getLeaderDamageAmount(card) {
        if (this.hasKeyword(card, "doubleAttack")) {
            return 2;
        }

        return 1;
    },

    // =========================
    // Unblockable
    // =========================

    isUnblockable(card) {
        return this.hasKeyword(card, "unblockable");
    },

    // =========================
    // Rush: Characters
    // =========================

    canAttackCharactersOnTurnPlayed(card) {
        return this.hasKeyword(card, "rushCharacters");
    },

    canAttackTargetOnTurnPlayed(card, targetData) {
        if (!card || !targetData) {
            return false;
        }

        if (this.canAttackOnTurnPlayed(card)) {
            return true;
        }

        if (
            this.canAttackCharactersOnTurnPlayed(card) &&
            targetData.cardType === "character"
        ) {
            return true;
        }

        return false;
    },

    // =========================
    // Name / Alias Helpers
    // =========================

    normalizeCardName(name) {
        return String(name)
            .trim()
            .toLowerCase()
            .replace(/[\[\]{}]/g, "");
    },

    hasCardName(card, name) {
        if (!card) {
            return false;
        }

        const wantedName = this.normalizeCardName(name);
        const printedName = this.normalizeCardName(card.name || "");

        if (printedName === wantedName) {
            return true;
        }

        return this.getCardNameAliases(card).some(alias => {
            return this.normalizeCardName(alias) === wantedName;
        });
    },

    getCardNameAliases(card) {
        if (!card) {
            return [];
        }

        const aliases = Array.isArray(card.aliases)
            ? [...card.aliases]
            : [];

        const effects = typeof getCardAllEffects === "function"
            ? getCardAllEffects(card)
            : card.effects;

        effects
            ?.filter(effect => effect.type === "continuous")
            .forEach(effect => {
                const text = effect.text || "";
                const nameMatches = text.matchAll(/also treat this card's name as\s*\[([^\]]+)\]/gi);

                for (const match of nameMatches) {
                    aliases.push(match[1]);
                }
            });

        return aliases;
    },

    hasTurboGrannyFormStage(player) {
        return this.hasCardName(player?.stage, "Turbo Granny Form");
    },

    getOncePerTurnUsageKey(turnNumber) {
        if (typeof getCurrentTurnStatusKey === "function") {
            const currentTurnKey = getCurrentTurnStatusKey();

            if (currentTurnKey) {
                return currentTurnKey;
            }
        }

        return turnNumber;
    },

    hasUsedOncePerTurnEffect(card, effectId, turnNumber) {
        return card?.oncePerTurnEffectsUsed?.[effectId] === this.getOncePerTurnUsageKey(turnNumber);
    },

    markOncePerTurnEffectUsed(card, effectId, turnNumber) {
        if (!card) {
            return;
        }

        if (!card.oncePerTurnEffectsUsed) {
            card.oncePerTurnEffectsUsed = {};
        }

        card.oncePerTurnEffectsUsed[effectId] = this.getOncePerTurnUsageKey(turnNumber);
    },

    hasUsedOncePerGameEffect(card, effectId) {
        return Array.isArray(card?.oncePerGameEffectsUsed) &&
            card.oncePerGameEffectsUsed.includes(effectId);
    },

    markOncePerGameEffectUsed(card, effectId) {
        if (!card || !effectId) {
            return;
        }

        if (!Array.isArray(card.oncePerGameEffectsUsed)) {
            card.oncePerGameEffectsUsed = [];
        }

        if (!card.oncePerGameEffectsUsed.includes(effectId)) {
            card.oncePerGameEffectsUsed.push(effectId);
        }
    },

    getPerTurnEffectUseCount(card, effectId, turnNumber) {
        const usage = card?.perTurnEffectUses?.[effectId];

        if (!usage || usage.turnNumber !== turnNumber) {
            return 0;
        }

        return Number(usage.count || 0);
    },

    markPerTurnEffectUsed(card, effectId, turnNumber, amount = 1) {
        if (!card || !effectId) {
            return;
        }

        if (!card.perTurnEffectUses) {
            card.perTurnEffectUses = {};
        }

        const currentCount = this.getPerTurnEffectUseCount(card, effectId, turnNumber);

        card.perTurnEffectUses[effectId] = {
            turnNumber,
            count: currentCount + Math.max(1, Number(amount || 1))
        };
    },

    wasEffectSkippedForAttack(card, effectId) {
        return Array.isArray(card?.skippedEffectIdsThisAttack) &&
            card.skippedEffectIdsThisAttack.includes(effectId);
    },

    // =========================
    // DD01-001 Takakura Ken
    // =========================

    resolveTakakuraKenLeaderWhenAttacking(gameState, player, attackerData, ui) {
        const leader = player?.leader;

        if (!leader || !attackerData) {
            return {
                activated: false,
                message: ""
            };
        }

        if (attackerData.cardType !== "leader") {
            return {
                activated: false,
                message: ""
            };
        }

        if (leader.cardNumber !== "DD01-001") {
            return {
                activated: false,
                message: ""
            };
        }

        const effectId = "DD01-001-when-attacking-active";
        const turnNumber = player.turns;

        if (this.hasUsedOncePerTurnEffect(leader, effectId, turnNumber)) {
            return {
                activated: false,
                message: `${leader.name}'s Once Per Turn effect has already been used this turn.`
            };
        }

        if (!this.hasTurboGrannyFormStage(player)) {
            return {
                activated: false,
                message: `${leader.name}'s When Attacking effect did not activate because Turbo Granny Form is not in play.`
            };
        }

        leader.state = "active";
        this.markOncePerTurnEffectUsed(leader, effectId, turnNumber);

        if (ui?.renderLeaders) {
            ui.renderLeaders();
        }

        return {
            activated: true,
            message: `${leader.name}'s When Attacking effect set the leader as active.`
        };
    },

    resolveTakakuraKenCharacterWhenAttacking(gameState, player, attackerData, ui) {
        const character = attackerData?.cardType === "character"
            ? player?.characters?.[attackerData.slotIndex]
            : null;

        if (!character || character.cardNumber !== "DD01-006") {
            return {
                activated: false,
                message: ""
            };
        }

        const effectId = "DD01-006-when-attacking-active";
        const turnNumber = player.turns;

        if (this.hasUsedOncePerTurnEffect(character, effectId, turnNumber)) {
            return {
                activated: false,
                message: `${character.name}'s Once Per Turn effect has already been used this turn.`
            };
        }

        if (!this.hasTurboGrannyFormStage(player)) {
            return {
                activated: false,
                message: `${character.name}'s When Attacking effect did not activate because Turbo Granny Form is not in play.`
            };
        }

        character.state = "active";
        this.markOncePerTurnEffectUsed(character, effectId, turnNumber);

        if (ui?.renderCharacters) {
            ui.renderCharacters();
        }

        return {
            activated: true,
            message: `${character.name}'s When Attacking effect set it as active.`
        };
    },

    resolveRefreshDonWhenAttacking(player, attackerData, ui) {
        const character = attackerData?.cardType === "character"
            ? player?.characters?.[attackerData.slotIndex]
            : null;

        if (!character || character.cardNumber !== "DD01-007") {
            return {
                activated: false,
                message: ""
            };
        }

        if (this.wasEffectSkippedForAttack(character, "DD01-007-when-attacking-refresh-don")) {
            return {
                activated: false,
                message: ""
            };
        }

        const refreshedDon = setRestedDonActive(player, 2, ui);

        return {
            activated: refreshedDon > 0,
            message: refreshedDon > 0
                ? `${character.name}'s When Attacking effect set ${refreshedDon} DON!! as active.`
                : `${character.name}'s When Attacking effect found no rested DON!! cards.`
        };
    },

    resolveEvilEyeWhenAttacking(player, attackerData, ui) {
        const character = attackerData?.cardType === "character"
            ? player?.characters?.[attackerData.slotIndex]
            : null;

        if (!character || character.cardNumber !== "DD01-010") {
            return {
                activated: false,
                message: ""
            };
        }

        if (this.wasEffectSkippedForAttack(character, "DD01-010-when-attacking-unblockable")) {
            return {
                activated: false,
                message: ""
            };
        }

        const returnedDon = returnDonToDeck(player, 1, ui);

        if (returnedDon < 1) {
            return {
                activated: false,
                message: `${character.name}'s When Attacking effect could not pay DON!! -1.`
            };
        }

        addTemporaryKeyword(character, "unblockable");

        return {
            activated: true,
            message: `${character.name}'s When Attacking effect returned 1 DON!! and gained Unblockable until end of turn.`
        };
    },

    resolveAiraWhenAttacking(player, attackerData, ui) {
        const character = attackerData?.cardType === "character"
            ? player?.characters?.[attackerData.slotIndex]
            : null;

        if (!character || character.cardNumber !== "DD01-017") {
            return {
                activated: false,
                message: ""
            };
        }

        const effectId = "DD01-017-when-attacking-ko-blocker";
        const turnNumber = player.turns;

        if (this.wasEffectSkippedForAttack(character, effectId)) {
            return {
                activated: false,
                message: ""
            };
        }

        if (this.hasUsedOncePerTurnEffect(character, effectId, turnNumber)) {
            return {
                activated: false,
                message: `${character.name}'s Once Per Turn effect has already been used this turn.`
            };
        }

        const returnedDon = returnDonToDeck(player, 1, ui);

        if (returnedDon < 1) {
            return {
                activated: false,
                message: `${character.name}'s When Attacking effect could not pay DON!! -1.`
            };
        }

        this.markOncePerTurnEffectUsed(character, effectId, turnNumber);

        const blockerChoices = getOpponentCharacterChoices(player, card => {
            const cardCost = typeof getCardEffectiveCost === "function"
                ? getCardEffectiveCost(card)
                : Number(card.cost ?? 0);

            return cardCost <= 5 && this.hasKeyword(card, "blocker");
        });

        if (blockerChoices.length === 0) {
            return {
                activated: true,
                message: `${character.name}'s When Attacking effect returned 1 DON!! but found no opposing cost 5 or lower Blockers.`
            };
        }

        const blockerChoice = blockerChoices[0];
        const defender = gameState[blockerChoice.playerKey];
        const message = typeof removeCharacterByOpponentEffect === "function"
            ? removeCharacterByOpponentEffect(player, defender, blockerChoice.slotIndex, character, ui)
            : KOCharacter(defender, blockerChoice.slotIndex, ui).message;

        return {
            activated: true,
            message: `${character.name}'s When Attacking effect returned 1 DON!!. ${message}`
        };
    },

    resolveEggmanLeaderWhenAttacking(player, attackerData, ui) {
        const leader = attackerData?.cardType === "leader"
            ? player?.leader
            : null;

        if (!leader || leader.cardNumber !== "EGG1-001") {
            return {
                activated: false,
                message: ""
            };
        }

        if (this.wasEffectSkippedForAttack(leader, "EGG1-001-when-attacking-power")) {
            return {
                activated: false,
                message: ""
            };
        }

        const effect = leader.effects?.find(cardEffect => cardEffect.id === "EGG1-001-when-attacking-power");

        if (typeof resolveEffectAction === "function" && effect) {
            const message = resolveEffectAction(player, leader, effect, ui, {
                skipActivationPrompt: true
            });

            return {
                activated: true,
                message
            };
        }

        return {
            activated: false,
            message: ""
        };
    },

    resolveHanamiLeaderWhenAttacking(player, attackerData, ui) {
        const leader = attackerData?.cardType === "leader"
            ? player?.leader
            : null;

        if (!leader || leader.cardNumber !== "JK02-001") {
            return {
                activated: false,
                message: ""
            };
        }

        const effectId = "JK02-001-when-attacking";

        if (this.wasEffectSkippedForAttack(leader, effectId)) {
            return {
                activated: false,
                message: ""
            };
        }

        if (Number(player?.don || 0) < 4) {
            return {
                activated: false,
                message: `${leader.name}'s When Attacking effect could not activate because ${player.name} does not have 4 active DON!! cards.`
            };
        }

        const validTargets = player.characters.filter(card => {
            return card?.cardType === "character" &&
                getCardEffectiveCost(card) <= 6 &&
                (card.state || "active") !== "active";
        });

        if (validTargets.length === 0) {
            return {
                activated: false,
                message: `${leader.name}'s When Attacking effect found no cost 6 or lower rested Characters to set active.`
            };
        }

        if (!restDonForCost(player, 4, ui)) {
            return {
                activated: false,
                message: `${leader.name}'s When Attacking effect could not rest 4 active DON!! cards.`
            };
        }

        const chooseMessage = chooseOwnBoardCard(player, leader, {
            prompt: `Choose up to 1 of your cost 6 or lower rested Characters to set as active with ${leader.name}.`,
            optional: true,
            includeLeader: false,
            filter: card => {
                return card.cardType === "character" &&
                    getCardEffectiveCost(card) <= 6 &&
                    (card.state || "active") !== "active";
            },
            onSelect: ({ card }) => {
                card.state = "active";
                ui?.renderCharacters?.();
                addGameLog(`${leader.name} set ${card.name} as active.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} rested 4 DON!! for ${leader.name} but did not choose a Character to set active.`,
            emptyMessage: `${leader.name} found no cost 6 or lower rested Characters to set active.`
        });

        return {
            activated: true,
            message: chooseMessage
                ? `${leader.name}'s When Attacking effect rested 4 DON!!. ${chooseMessage}`
                : `${leader.name}'s When Attacking effect rested 4 DON!! and resolved.`
        };
    },

    resolveSubaruLeaderWhenAttacking(player, attackerData, ui) {
        const leader = attackerData?.cardType === "leader"
            ? player?.leader
            : null;

        if (!leader || leader.cardNumber !== "SUB1-001") {
            return {
                activated: false,
                message: ""
            };
        }

        const effectId = "SUB1-001-when-attacking-power";

        if (this.wasEffectSkippedForAttack(leader, effectId)) {
            return {
                activated: false,
                message: ""
            };
        }

        if (!Array.isArray(player?.life) || player.life.length === 0) {
            return {
                activated: false,
                message: `${leader.name}'s When Attacking effect found no life cards to move.`
            };
        }

        const placeLifeCardOnTop = (position) => {
            if (position === "bottom" && player.life.length > 1) {
                const movedCard = player.life.pop();

                if (movedCard) {
                    player.life.unshift(movedCard);
                }
            }

            addTemporaryPowerBonus(leader, 1000);
            ui?.renderLifeCards?.();
            ui?.renderLeaders?.();
            addGameLog(`${leader.name} placed a life card on top and gained +1000 power this turn.`);

            if (typeof queueMultiplayerStateSync === "function") {
                queueMultiplayerStateSync();
            }
        };

        if (player.life.length > 1 && ui?.chooseEffectOption) {
            ui.chooseEffectOption({
                player,
                sourceCard: leader,
                title: leader.name,
                prompt: `Choose which life card to place on top for ${leader.name}.`,
                options: [
                    { label: "Current Top", value: "top" },
                    { label: "Current Bottom", value: "bottom" }
                ],
                onComplete: (value) => {
                    placeLifeCardOnTop(value === "bottom" ? "bottom" : "top");
                }
            });

            return {
                activated: true,
                message: `${player.name} is choosing which life card to place on top for ${leader.name}.`
            };
        }

        placeLifeCardOnTop("top");

        return {
            activated: true,
            message: `${leader.name}'s When Attacking effect placed a life card on top and gave it +1000 power this turn.`
        };
    },

    resolveSubaruElsaWhenAttacking(player, attackerData, ui) {
        const character = attackerData?.cardType === "character"
            ? player?.characters?.[attackerData.slotIndex]
            : null;

        if (!character || character.cardNumber !== "SUB1-009") {
            return {
                activated: false,
                message: ""
            };
        }

        if (Number(character.attachedDon || 0) < 1) {
            return {
                activated: false,
                message: `${character.name}'s When Attacking effect did not activate because it has no attached DON!!`
            };
        }

        const revealMessage = typeof revealSubaruLifeCard === "function"
            ? revealSubaruLifeCard(player, character, ui, {
                allowAnyChoice: true,
                onComplete: (revealedCard) => {
                    const revealedPower = Number(revealedCard?.power || 0);
                    const powerGain = Math.floor(revealedPower / 2);

                    if (powerGain <= 0) {
                        addGameLog(`${character.name} revealed ${revealedCard?.name || "a life card"}, but gained no power.`);
                        return;
                    }

                    addTemporaryPowerBonus(character, powerGain);
                    ui?.renderCharacters?.();
                    addGameLog(`${character.name} gained +${powerGain} power this turn from the revealed life card.`);

                    if (typeof queueMultiplayerStateSync === "function") {
                        queueMultiplayerStateSync();
                    }
                }
            })
            : `${character.name} could not reveal a life card.`;

        return {
            activated: true,
            message: revealMessage || `${character.name}'s When Attacking effect resolved.`
        };
    },

    resolveSaintGermainLeaderWhenAttacking(player, attackerData, ui) {
        const leader = attackerData?.cardType === "leader"
            ? player?.leader
            : null;

        if (!leader || leader.cardNumber !== "DD02-001") {
            return {
                activated: false,
                message: ""
            };
        }

        const effectId = "DD02-001-when-attacking";

        if (this.wasEffectSkippedForAttack(leader, effectId)) {
            return {
                activated: false,
                message: ""
            };
        }

        if (typeof getSaintGermainTrashEffectChoices !== "function" ||
            getSaintGermainTrashEffectChoices(player).length === 0) {
            return {
                activated: false,
                message: `${leader.name}'s When Attacking effect found no activatable [Curse] or [The Cursed] card effects in trash.`
            };
        }

        const returnedDon = returnDonToDeck(player, 1, ui);

        if (returnedDon < 1) {
            return {
                activated: false,
                message: `${leader.name}'s When Attacking effect could not pay DON!! -1.`
            };
        }

        const activationMessage = typeof activateSaintGermainTrashEffect === "function"
            ? activateSaintGermainTrashEffect(player, leader, ui)
            : "";

        return {
            activated: true,
            message: activationMessage
                ? `${leader.name}'s When Attacking effect returned 1 DON!!. ${activationMessage}`
                : `${leader.name}'s When Attacking effect returned 1 DON!! and resolved.`
        };
    },

    resolveImuLeaderWhenAttacking(player, attackerData, ui) {
        const leader = attackerData?.cardType === "leader"
            ? player?.leader
            : null;

        if (!leader || leader.cardNumber !== "IMU1-001") {
            return {
                activated: false,
                message: ""
            };
        }

        const effectId = "IMU1-001-when-attacking";

        if (this.wasEffectSkippedForAttack(leader, effectId)) {
            return {
                activated: false,
                message: ""
            };
        }

        const trashResult = trashTopCardsOfDeck(player, 1, ui);

        if (!trashResult.success || trashResult.trashedCards.length < 1) {
            return {
                activated: false,
                message: `${leader.name}'s When Attacking effect found no card in deck to trash.`
            };
        }

        const holyKnightCharacters = player.characters.filter(card => {
            return card?.cardType === "character" &&
                hasTypeText(card, "Holy Knight");
        });

        if (holyKnightCharacters.length === 0) {
            return {
                activated: true,
                message: `${leader.name}'s When Attacking effect trashed 1 card from the top of the deck but found no {Holy Knight} Characters to empower.`
            };
        }

        const opponent = getOpponentOfPlayer(player);
        const opponentKey = getPlayerKey(opponent);
        const expiresAtEndOfTurns = Number(opponent?.turns || 0) + 1;
        const chooseMessage = chooseOwnBoardCard(player, leader, {
            prompt: `Choose up to 1 of your {Holy Knight} Characters to give Rush and +1000 power with ${leader.name}.`,
            optional: true,
            includeLeader: false,
            filter: card => card.cardType === "character" && hasTypeText(card, "Holy Knight"),
            onSelect: ({ card }) => {
                addDurationKeyword(card, "rush", expiresAtEndOfTurns, opponentKey);
                addDurationPowerBonus(card, 1000, expiresAtEndOfTurns, opponentKey);
                ui?.renderCharacters?.();
                addGameLog(`${leader.name} gave ${card.name} Rush and +1000 power until the end of ${opponent?.name || "the opponent"}'s next End Phase.`);

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} trashed 1 card from deck for ${leader.name} but did not choose a {Holy Knight} Character.`,
            emptyMessage: `${leader.name} found no {Holy Knight} Characters to empower.`
        });

        return {
            activated: true,
            message: chooseMessage
                ? `${leader.name}'s When Attacking effect trashed 1 card from the top of the deck. ${chooseMessage}`
                : `${leader.name}'s When Attacking effect trashed 1 card from the top of the deck and resolved.`
        };
    },

    resolveImuCharacterWhenAttacking(player, attackerData, ui) {
        const character = attackerData?.cardType === "character"
            ? player?.characters?.[attackerData.slotIndex]
            : null;

        if (!character) {
            return {
                activated: false,
                message: ""
            };
        }

        const effectIdByCard = {
            "IMU1-003": "IMU1-003-when-attacking",
            "IMU1-004": "IMU1-004-when-attacking",
            "IMU1-010": "IMU1-010-when-attacking"
        };
        const effectId = effectIdByCard[character.cardNumber];

        if (!effectId) {
            return {
                activated: false,
                message: ""
            };
        }

        const effect = getCardAllEffects(character)?.find(cardEffect => cardEffect.id === effectId);

        if (!effect || typeof resolveEffectAction !== "function") {
            return {
                activated: false,
                message: ""
            };
        }

        return {
            activated: true,
            message: resolveEffectAction(player, character, effect, ui, {
                skipActivationPrompt: true
            })
        };
    },

    resolveJogoWhenAttacking(player, attackerData, ui) {
        const character = attackerData?.cardType === "character"
            ? player?.characters?.[attackerData.slotIndex]
            : null;

        if (!character || character.cardNumber !== "JK02-016") {
            return {
                activated: false,
                message: ""
            };
        }

        if (Number(player?.restedDon || 0) < 2) {
            return {
                activated: false,
                message: `${character.name}'s When Attacking effect found fewer than 2 rested DON!! cards.`
            };
        }

        const validTargets = player.characters.filter(card => {
            return card?.cardType === "character" &&
                (card.state || "active") === "active";
        });

        if (validTargets.length === 0) {
            return {
                activated: false,
                message: `${character.name}'s When Attacking effect found no active Characters to receive DON!! cards.`
            };
        }

        const message = chooseOwnBoardCard(player, character, {
            prompt: "Choose up to 1 of your active Characters to receive 2 rested DON!! cards.",
            optional: true,
            includeLeader: false,
            filter: card => card.cardType === "character" && (card.state || "active") === "active",
            onSelect: ({ card }) => {
                const firstMessage = giveRestedDonToCard(player, character, card, ui);
                const secondMessage = giveRestedDonToCard(player, character, card, ui);

                if (firstMessage) {
                    addGameLog(firstMessage);
                }

                if (secondMessage) {
                    addGameLog(secondMessage);
                }

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            skipMessage: `${player.name} did not choose a Character for ${character.name}.`,
            emptyMessage: `${character.name} found no active Characters to receive DON!! cards.`
        });

        return {
            activated: true,
            message: message || `${character.name}'s When Attacking effect resolved.`
        };
    },

    resolveKenjakuWhenAttacking(player, attackerData, ui) {
        const character = attackerData?.cardType === "character"
            ? player?.characters?.[attackerData.slotIndex]
            : null;

        if (!character || character.cardNumber !== "JK02-019") {
            return {
                activated: false,
                message: ""
            };
        }

        const effectId = "JK02-019-when-attacking";

        if (this.wasEffectSkippedForAttack(character, effectId)) {
            return {
                activated: false,
                message: ""
            };
        }

        if (player.hand.length < 1) {
            return {
                activated: false,
                message: `${character.name}'s When Attacking effect requires 1 card in hand to discard.`
            };
        }

        const chooseMessage = chooseHandCard(player, character, {
            prompt: `Choose 1 card from your hand to trash for ${character.name}.`,
            optional: false,
            onSelect: ({ card }) => {
                const handIndex = player.hand.indexOf(card);

                if (handIndex === -1) {
                    addGameLog(`${character.name} could not find that hand card to trash.`);
                    return;
                }

                const trashedCard = player.hand.splice(handIndex, 1)[0];
                moveCardToTrash(player, trashedCard, ui);
                ui?.renderHands?.();
                ui?.renderTrash?.();
                addGameLog(`${player.name} trashed ${trashedCard.name} for ${character.name}.`);

                const koMessage = chooseOpponentCharacterToKO(player, character, ui, 4, false);

                if (koMessage) {
                    addGameLog(koMessage);
                }

                if (typeof queueMultiplayerStateSync === "function") {
                    queueMultiplayerStateSync();
                }
            },
            emptyMessage: `${character.name} found no card in hand to trash.`
        });

        return {
            activated: true,
            message: chooseMessage || `${character.name}'s When Attacking effect resolved.`
        };
    },

    resolveKisukeWhenAttacking(player, attackerData, ui) {
        const character = attackerData?.cardType === "character"
            ? player?.characters?.[attackerData.slotIndex]
            : null;

        if (!character || character.cardNumber !== "BL01-009") {
            return {
                activated: false,
                message: ""
            };
        }

        const effectId = "BL01-009-when-attacking-ichigo-power";

        if (this.wasEffectSkippedForAttack(character, effectId)) {
            return {
                activated: false,
                message: ""
            };
        }

        const message = chooseOwnBoardCard(player, character, {
            prompt: "Choose up to 1 Kurosaki Ichigo to give +1000 power this turn.",
            optional: true,
            includeLeader: true,
            filter: card => this.hasCardName(card, "Kurosaki Ichigo"),
            onSelect: ({ card }) => {
                addTemporaryPowerBonus(card, 1000);
                ui.renderLeaders();
                ui.renderCharacters();
                addGameLog(`${character.name} gave ${card.name} +1000 power this turn.`);
            },
            skipMessage: `${player.name} did not choose a Kurosaki Ichigo for ${character.name}.`,
            emptyMessage: `${character.name} found no Kurosaki Ichigo cards.`
        });

        return {
            activated: true,
            message
        };
    },

    resolveYoruichiWhenAttacking(player, attackerData, ui) {
        const character = attackerData?.cardType === "character"
            ? player?.characters?.[attackerData.slotIndex]
            : null;

        if (!character || character.cardNumber !== "BL01-011") {
            return {
                activated: false,
                message: ""
            };
        }

        if (Number(character.attachedDon || 0) < 1) {
            return {
                activated: false,
                message: `${character.name}'s When Attacking effect did not activate because it has no attached DON!!.`
            };
        }

        addTemporaryPowerBonus(character, 3000);

        if (ui?.renderCharacters) {
            ui.renderCharacters();
        }

        return {
            activated: true,
            message: `${character.name}'s When Attacking effect gave it +3000 power this turn.`
        };
    },

    resolveUryuWhenAttacking(player, attackerData, ui) {
        const character = attackerData?.cardType === "character"
            ? player?.characters?.[attackerData.slotIndex]
            : null;

        if (!character || character.cardNumber !== "BL01-014") {
            return {
                activated: false,
                message: ""
            };
        }

        const effectId = "BL01-014-when-attacking-minus-ko";

        if (this.wasEffectSkippedForAttack(character, effectId)) {
            return {
                activated: false,
                message: ""
            };
        }

        const chooseKOTarget = () => {
            const koMessage = chooseOpponentCharacter(player, character, {
                prompt: "Choose up to 1 opposing character with 4000 power or less to K.O.",
                optional: true,
                filter: card => getCardBattlePower(card, getPlayerForBoardCard(card)) <= 4000,
                onSelect: ({ playerKey, slotIndex }) => {
                    addGameLog(removeCharacterByOpponentEffect(player, gameState[playerKey], slotIndex, character, ui));
                },
                skipMessage: `${player.name} did not K.O. a character with ${character.name}.`,
                emptyMessage: `${character.name} found no opposing characters with 4000 power or less.`
            });

            addGameLog(koMessage);
        };

        const message = chooseOpponentCharacter(player, character, {
            prompt: "Choose up to 1 opposing character to give -1000 power this turn.",
            optional: true,
            onSelect: ({ card }) => {
                addTemporaryPowerBonus(card, -1000);
                ui.renderCharacters();
                addGameLog(`${character.name} gave ${card.name} -1000 power this turn.`);
                chooseKOTarget();
            },
            onSkip: chooseKOTarget,
            onEmpty: chooseKOTarget,
            skipMessage: `${player.name} did not reduce a character's power with ${character.name}.`,
            emptyMessage: `${character.name} found no opposing characters for power reduction.`
        });

        return {
            activated: true,
            message
        };
    },

    resolveDejanSigmaWhenAttacking(player, attackerData, ui) {
        const character = attackerData?.cardType === "character"
            ? player?.characters?.[attackerData.slotIndex]
            : null;

        if (!character || character.cardNumber !== "POG1-005") {
            return {
                activated: false,
                message: ""
            };
        }

        const effect = getCardAllEffects(character)?.find(cardEffect => cardEffect.id === "POG1-005-when-attacking");

        if (!effect || typeof resolveEffectAction !== "function") {
            return {
                activated: false,
                message: ""
            };
        }

        return {
            activated: true,
            message: resolveEffectAction(player, character, effect, ui, {
                skipActivationPrompt: true
            })
        };
    },

    resolveYujiItadoriWhenAttacking(player, attackerData, ui) {
        const character = attackerData?.cardType === "character"
            ? player?.characters?.[attackerData.slotIndex]
            : null;

        if (!character || character.cardNumber !== "JK01-007") {
            return {
                activated: false,
                message: ""
            };
        }

        const effectId = "JK01-007-when-attacking";

        if (this.hasUsedOncePerTurnEffect(character, effectId, player.turns)) {
            return {
                activated: false,
                message: `${character.name}'s Once Per Turn When Attacking effect has already been used this turn.`
            };
        }

        const message = typeof addCardFromTrashToHand === "function"
            ? addCardFromTrashToHand(player, character, ui, {
                optional: false,
                prompt: "Choose 1 Hiromi Higuruma card from your trash to add to your hand.",
                filter: card => this.hasCardName(card, "Hiromi Higuruma"),
                emptyMessage: `${character.name} found no Hiromi Higuruma cards in trash.`
            })
            : "";

        if (!message || message.includes("found no Hiromi Higuruma cards")) {
            return {
                activated: false,
                message
            };
        }

        this.markOncePerTurnEffectUsed(character, effectId, player.turns);

        return {
            activated: true,
            message
        };
    },

    // =========================
    // Stage Effects
    // =========================

    resolveWhenOpponentAttacksStageEffects(gameState, defendingPlayer, ui) {
        const stage = defendingPlayer?.stage;

        if (!stage || (typeof areCardEffectsNegated === "function" && areCardEffectsNegated(stage))) {
            return [];
        }

        const results = [];

        stage.effects
            ?.filter(effect => effect.type === "whenOpponentAttacks")
            .forEach(effect => {
                if (effect.actionId !== "restThisCard") {
                    return;
                }

                if ((stage.state || "active") === "rested") {
                    results.push({
                        activated: false,
                        message: `${stage.name}'s When Opponent Attacks effect did not rest it because it is already rested.`
                    });
                    return;
                }

                stage.state = "rested";

                if (ui?.renderStages) {
                    ui.renderStages();
                }

                results.push({
                    activated: true,
                    message: `${defendingPlayer.name}'s ${stage.name} rested for its When Opponent Attacks effect.`
                });
            });

        return results;
    },

    resolveTurboGrannyFormEndOfTurn(player) {
        if (!this.hasTurboGrannyFormStage(player)) {
            return null;
        }

        const stage = player.stage;
        const effect = stage.effects?.find(stageEffect => {
            return stageEffect.type === "endOfTurn" &&
                stageEffect.id === "DD01-002-end-of-turn-refresh-limit";
        });

        if (!effect || Number(player.leaderAttacksThisTurn || 0) < 2) {
            return null;
        }

        player.skipLeaderRefresh = true;

        return {
            activated: true,
            message: `${stage.name}: ${player.name}'s leader attacked twice this turn and will not become active during their next Refresh Phase.`
        };
    },

    resolveWhenAttackingEffects(gameState, player, attackerData, ui) {
        const attackingCard = attackerData?.cardType === "leader"
            ? player?.leader
            : player?.characters?.[attackerData?.slotIndex];

        if (typeof areCardEffectsNegated === "function" && areCardEffectsNegated(attackingCard)) {
            return [];
        }

        const results = [];
        const effectResults = [
            this.resolveTakakuraKenLeaderWhenAttacking(gameState, player, attackerData, ui),
            this.resolveTakakuraKenCharacterWhenAttacking(gameState, player, attackerData, ui),
            this.resolveRefreshDonWhenAttacking(player, attackerData, ui),
            this.resolveEvilEyeWhenAttacking(player, attackerData, ui),
            this.resolveAiraWhenAttacking(player, attackerData, ui),
            this.resolveEggmanLeaderWhenAttacking(player, attackerData, ui),
            this.resolveHanamiLeaderWhenAttacking(player, attackerData, ui),
            this.resolveSubaruLeaderWhenAttacking(player, attackerData, ui),
            this.resolveSubaruElsaWhenAttacking(player, attackerData, ui),
            this.resolveSaintGermainLeaderWhenAttacking(player, attackerData, ui),
            this.resolveImuLeaderWhenAttacking(player, attackerData, ui),
            this.resolveImuCharacterWhenAttacking(player, attackerData, ui),
            this.resolveJogoWhenAttacking(player, attackerData, ui),
            this.resolveKenjakuWhenAttacking(player, attackerData, ui),
            this.resolveKisukeWhenAttacking(player, attackerData, ui),
            this.resolveYoruichiWhenAttacking(player, attackerData, ui),
            this.resolveUryuWhenAttacking(player, attackerData, ui),
            this.resolveDejanSigmaWhenAttacking(player, attackerData, ui),
            this.resolveYujiItadoriWhenAttacking(player, attackerData, ui)
        ];

        effectResults.forEach(result => {
            if (result.message) {
                results.push(result);
            }
        });

        return results;
    }

};
