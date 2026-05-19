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
        if (!card || !Array.isArray(card.keywords)) {
            return false;
        }

        const wantedKeyword = this.normalizeKeyword(keywordName);

        return card.keywords.some(keyword => {
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
        const takakuraKenResult = this.resolveTakakuraKenLeaderWhenAttacking(
            gameState,
            player,
            attackerData,
            ui
        );

        if (takakuraKenResult.message) {
            results.push(takakuraKenResult);
        }

        return results;
    }

};
