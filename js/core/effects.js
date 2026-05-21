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

        const allKeywords = [
            ...(Array.isArray(card.keywords) ? card.keywords : []),
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

        card.effects
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

    hasUsedOncePerTurnEffect(card, effectId, turnNumber) {
        return card?.oncePerTurnEffectsUsed?.[effectId] === turnNumber;
    },

    markOncePerTurnEffectUsed(card, effectId, turnNumber) {
        if (!card) {
            return;
        }

        if (!card.oncePerTurnEffectsUsed) {
            card.oncePerTurnEffectsUsed = {};
        }

        card.oncePerTurnEffectsUsed[effectId] = turnNumber;
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

    // =========================
    // Stage Effects
    // =========================

    resolveWhenOpponentAttacksStageEffects(gameState, defendingPlayer, ui) {
        const stage = defendingPlayer?.stage;

        if (!stage) {
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
        const results = [];
        const effectResults = [
            this.resolveTakakuraKenLeaderWhenAttacking(gameState, player, attackerData, ui),
            this.resolveTakakuraKenCharacterWhenAttacking(gameState, player, attackerData, ui),
            this.resolveRefreshDonWhenAttacking(player, attackerData, ui),
            this.resolveEvilEyeWhenAttacking(player, attackerData, ui),
            this.resolveAiraWhenAttacking(player, attackerData, ui),
            this.resolveEggmanLeaderWhenAttacking(player, attackerData, ui),
            this.resolveKisukeWhenAttacking(player, attackerData, ui),
            this.resolveYoruichiWhenAttacking(player, attackerData, ui),
            this.resolveUryuWhenAttacking(player, attackerData, ui)
        ];

        effectResults.forEach(result => {
            if (result.message) {
                results.push(result);
            }
        });

        return results;
    }

};
