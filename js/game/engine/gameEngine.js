import { appendLog, createGameState, createId, finishGame, otherPlayerId, shuffleCards } from "../state/gameState.js";
import { findCard, getPlayer } from "../state/zones.js";
import { getEffectiveCost, validateActingPlayer } from "../checks/validation.js";
import { playCard, trashCard, useEventCard } from "../actions/cardActions.js";
import { attachDon } from "../actions/donStateActions.js";
import { advancePhase, beginTurn, refreshPlayer } from "../phases/turnSystem.js";
import { queueCharacterPlayedTriggers, queuePlayerBoardTriggers, queueTrigger, resolveEffectQueue, submitActivationChoice, submitEffectSelection } from "../effects/effectResolver.js";
import { getActivatorEffects, validateCounterEventActivation, validateMainActivation } from "../effects/effectActivators.js";
import { chooseBlocker, continueCombat, continueLeaderDamage, declareAttack, resolveBattle, resolveLifeTriggerChoice, useCounter } from "../battle/battleSystem.js";

function contextFor(playerId, emit) {
    return { actingPlayerId: playerId, controllerId: playerId, ownerId: playerId, emit };
}

function drawOpeningHand(player, amount = 5) {
    for (let i = 0; i < amount && player.deck.length; i += 1) {
        const card = player.deck.shift();
        card.zone = "hand";
        card.face = "up";
        player.hand.push(card);
    }
}

function prepareOpeningHands(state) {
    for (const player of Object.values(state.players)) drawOpeningHand(player);
    state.phase = "mulligan";
    appendLog(state, "Opening hands were dealt.");
}

function finishSetup(state, definitions) {
    for (const player of Object.values(state.players)) {
        const leaderDefinition = definitions[player.leader.definitionId];
        const lifeCount = Math.max(0, Number(leaderDefinition?.life ?? 5));
        for (let i = 0; i < lifeCount && player.deck.length; i += 1) {
            const card = player.deck.shift();
            card.zone = "life";
            card.face = "down";
            player.life.push(card);
        }
    }
    state.activePlayerId = state.firstPlayerId;
    queuePlayerBoardTriggers(state, definitions, "gameStart", state.firstPlayerId, "setup");
    queuePlayerBoardTriggers(state, definitions, "gameStart", otherPlayerId(state.firstPlayerId), "setup");
    beginTurn(state, definitions, queueTrigger);
}

function rollDice(state, playerId, random) {
    if (state.phase !== "diceRoll" || state.setup.dice[playerId] !== null) return { status: "failed", message: "This die was already rolled." };
    state.setup.dice[playerId] = Math.floor(random() * 6) + 1;
    const { p1, p2 } = state.setup.dice;
    if (p1 !== null && p2 !== null) {
        if (p1 === p2) {
            state.setup.dice = { p1: null, p2: null, winnerId: null };
            appendLog(state, "Dice tied. Roll again.");
        } else {
            state.setup.dice.winnerId = p1 > p2 ? "p1" : "p2";
            state.phase = "chooseFirst";
        }
    }
    return { status: "completed" };
}

function chooseFirst(state, playerId, firstPlayerId) {
    const chooserId = state.setup.turnOrderChooserId || state.setup.dice.winnerId;
    if (state.phase !== "chooseFirst" || chooserId !== playerId) return { status: "failed", message: "The assigned player must choose who goes first." };
    if (!["p1", "p2"].includes(firstPlayerId)) return { status: "failed", message: "Choose a valid first player." };
    state.firstPlayerId = firstPlayerId;
    prepareOpeningHands(state);
    return { status: "completed" };
}

function mulligan(state, playerId, redraw, random, definitions) {
    if (state.phase !== "mulligan" || state.setup.mulligan[playerId] !== null) return { status: "failed", message: "Mulligan is not available." };
    const player = getPlayer(state, playerId);
    state.setup.mulligan[playerId] = Boolean(redraw);
    player.mulliganComplete = true;
    if (redraw) {
        for (const card of player.hand) {
            card.zone = "deck";
            card.face = "down";
        }
        player.deck = shuffleCards([...player.deck, ...player.hand], random);
        player.hand = [];
        drawOpeningHand(player);
    }
    if (state.setup.mulligan.p1 !== null && state.setup.mulligan.p2 !== null) finishSetup(state, definitions);
    return { status: "completed" };
}

function payCost(player, amount) {
    if (player.activeDon < amount) return false;
    player.activeDon -= amount;
    player.restedDon += amount;
    return true;
}

function playFromHand(state, definitions, playerId, command) {
    const turnCheck = validateActingPlayer(state, playerId, { requireTurn: true, phase: "main" });
    if (turnCheck.status === "failed") return turnCheck;
    if (state.pendingCombat || state.pendingSelection || state.pendingTrigger || state.pendingActivation || state.effectQueue.length) return { status: "failed", message: "Finish the pending interaction first." };
    const location = findCard(state, command.cardId);
    if (!location || location.zone !== "hand" || location.card.controllerId !== playerId) return { status: "failed", message: "You may only play a card from your hand." };
    const definition = definitions[location.card.definitionId];
    const type = String(definition?.cardType || "").toLowerCase();
    if (!['character', 'stage', 'event'].includes(type)) return { status: "failed", message: "That card type cannot be played." };
    const player = getPlayer(state, playerId);
    const cost = getEffectiveCost(location.card, definition, state);
    if (player.activeDon < cost) return { status: "failed", message: "Not enough active DON!!." };

    const mainEffects = type === "event" ? getActivatorEffects(definition, "activateMain", { executableOnly: true }) : [];
    const selectedMainEffect = type === "event"
        ? (command.effectId ? mainEffects.find(descriptor => descriptor.effectId === command.effectId) : mainEffects[Number(command.effectIndex || 0)])
        : null;
    if (type === "event" && !selectedMainEffect) return { status: "failed", message: "That Event has no implemented Main effect." };

    if (type === "character" && !player.characters.includes(null)) {
        const replaced = findCard(state, command.replaceCardId);
        if (!replaced || replaced.playerId !== playerId || replaced.zone !== "characterArea") return { status: "failed", message: "Choose one of your Characters to replace." };
        const slotIndex = replaced.index;
        trashCard(state, definitions, contextFor(playerId), {}, [replaced.card.instanceId]);
        command.slotIndex = slotIndex;
    }
    if (type === "stage" && player.stage) {
        if (command.replaceCardId !== player.stage.instanceId) return { status: "failed", message: "Choose your current Stage to replace." };
        trashCard(state, definitions, contextFor(playerId), {}, [player.stage.instanceId]);
    }
    if (!payCost(player, cost)) return { status: "failed", message: "Cost payment failed." };
    const emit = (trigger, sourceId, actingPlayerId, cause) => queueTrigger(
        state,
        definitions,
        trigger,
        sourceId,
        actingPlayerId,
        cause,
        type === "event" && trigger === "activateMain" ? { effectId: selectedMainEffect.effectId, confirmed: true } : {}
    );
    const context = contextFor(playerId, emit);
    const result = type === "event"
        ? useEventCard(state, definitions, context, { instanceId: command.cardId }, [command.cardId])
        : playCard(state, definitions, context, { instanceId: command.cardId, destination: type === "stage" ? "stage" : "characterArea", slotIndex: command.slotIndex, cause: "play" }, [command.cardId]);
    if (result.status === "failed") {
        player.restedDon -= cost;
        player.activeDon += cost;
    } else if (type === "character") {
        queueCharacterPlayedTriggers(state, definitions, command.cardId, playerId, "handPlay");
    }
    return result;
}

function activateMain(state, definitions, playerId, cardId, effectIndex = 0, effectId = null) {
    const location = findCard(state, cardId);
    const effects = getActivatorEffects(definitions[location?.card.definitionId], "activateMain");
    const descriptor = effectId ? effects.find(entry => entry.effectId === effectId) : effects[Number(effectIndex || 0)];
    const check = validateMainActivation(state, definitions, location, playerId, descriptor);
    if (check.status === "failed") return check;
    return queueTrigger(state, definitions, "activateMain", cardId, playerId, "activation", { effectId: descriptor.effectId, confirmed: true });
}

function activateCounterEvent(state, definitions, playerId, command) {
    const location = findCard(state, command.cardId);
    const effects = getActivatorEffects(definitions[location?.card.definitionId], "counter");
    const descriptor = command.effectId ? effects.find(entry => entry.effectId === command.effectId) : effects[Number(command.effectIndex || 0)];
    const check = validateCounterEventActivation(state, definitions, location, playerId, descriptor);
    if (check.status === "failed") return check;
    const player = getPlayer(state, playerId);
    const definition = definitions[location.card.definitionId];
    const cost = getEffectiveCost(location.card, definition, state);
    if (!payCost(player, cost)) return { status: "failed", message: "Not enough active DON!! for that Counter Event." };
    const cardId = location.card.instanceId;
    const trashResult = trashCard(state, definitions, contextFor(playerId), {}, [cardId]);
    if (trashResult.status === "failed") {
        player.restedDon -= cost;
        player.activeDon += cost;
        return trashResult;
    }
    const queued = queueTrigger(state, definitions, "counter", cardId, playerId, "counterEvent", { effectId: descriptor.effectId, confirmed: true }).queued || 0;
    if (queued) state.pendingCombat.window = "counterEffects";
    appendLog(state, `${player.name} activated ${definition?.name || "an Event"}'s Counter effect.`);
    return { status: "completed" };
}

function drain(state, definitions) {
    const effectResult = resolveEffectQueue(state, definitions);
    if (["failed", "awaitingSelection", "awaitingActivation"].includes(effectResult.status)) return effectResult;
    if (state.pendingDamage && !state.pendingTrigger) {
        const damageResult = continueLeaderDamage(state, definitions, queueTrigger);
        if (damageResult.status !== "completed") return damageResult;
        if (state.effectQueue.length) return drain(state, definitions);
    }
    if (["effects", "counterEffects"].includes(state.pendingCombat?.window)) return continueCombat(state, definitions);
    return effectResult;
}

function hasPendingInteraction(state) {
    return Boolean(state.pendingSelection || state.pendingCombat || state.pendingTrigger || state.pendingActivation || state.effectQueue.length);
}

function settleAutomaticTurnFlow(state, definitions, autoDraw) {
    while (state.phase !== "gameOver" && !hasPendingInteraction(state)) {
        if (state.phase === "end") {
            const endResult = advancePhase(state, definitions, queueTrigger);
            if (endResult.status === "failed") return endResult;
            const startEffects = drain(state, definitions);
            if (startEffects.status !== "completed") return startEffects;
            continue;
        }
        if (state.phase === "refresh") {
            const refreshResult = advancePhase(state, definitions, queueTrigger);
            if (refreshResult.status === "failed") return refreshResult;
            continue;
        }
        if (state.phase === "draw") {
            const player = getPlayer(state, state.activePlayerId);
            const skipsFirstDraw = player?.id === state.firstPlayerId && player.turns === 1;
            if (skipsFirstDraw || autoDraw) {
                const drawResult = advancePhase(state, definitions, queueTrigger);
                if (drawResult.status === "failed") return drawResult;
                continue;
            }
        }
        break;
    }
    return { status: "completed" };
}

export function createGameEngine({ p1, p2, definitions, random = Math.random, initialState = null, turnOrderChooserId = null, autoDraw = true }) {
    if (!definitions || !p1 || !p2) throw new Error("Two players and card definitions are required.");
    const state = initialState || createGameState({ p1, p2, random });
    if (!initialState && turnOrderChooserId) {
        if (!getPlayer(state, turnOrderChooserId)) throw new Error("Turn-order chooser must be a player in the game.");
        state.phase = "chooseFirst";
        state.setup.turnOrderChooserId = turnOrderChooserId;
        appendLog(state, `${state.players[turnOrderChooserId].name} chooses who goes first.`);
    }
    if (initialState && state.phase === "refresh" && state.activePlayerId) {
        refreshPlayer(getPlayer(state, state.activePlayerId), state);
        const turnFlowResult = settleAutomaticTurnFlow(state, definitions, autoDraw);
        if (turnFlowResult.status === "completed") state.revision += 1;
    }

    function dispatch(command) {
        if (!command?.playerId || !command?.type) return { status: "failed", message: "Command type and player are required." };
        if (!getPlayer(state, command.playerId)) return { status: "failed", message: "Command player is not part of this game." };
        const commandId = command.id || createId("command");
        if (state.processedCommandIds.includes(commandId)) return { status: "skipped", message: "Duplicate command ignored." };
        let result;
        switch (command.type) {
            case "rollDice": result = rollDice(state, command.playerId, random); break;
            case "chooseFirst": result = chooseFirst(state, command.playerId, command.firstPlayerId); break;
            case "mulligan": result = mulligan(state, command.playerId, command.redraw, random, definitions); break;
            case "advancePhase": result = validateActingPlayer(state, command.playerId, { requireTurn: true }); if (result.status !== "failed") result = advancePhase(state, definitions, queueTrigger); break;
            case "playCard": result = playFromHand(state, definitions, command.playerId, command); break;
            case "attachDon": result = validateActingPlayer(state, command.playerId, { requireTurn: true, phase: "main" }); if (result.status !== "failed") result = attachDon(state, definitions, contextFor(command.playerId), { quantity: command.quantity, instanceId: command.cardId }, [command.cardId]); break;
            case "attack": result = declareAttack(state, definitions, queueTrigger, command.playerId, command.attackerId, command.targetId); break;
            case "blocker": result = chooseBlocker(state, definitions, queueTrigger, command.playerId, command.blockerId); break;
            case "counter": result = useCounter(state, definitions, command.playerId, command.cardId); break;
            case "activateCounterEvent": result = activateCounterEvent(state, definitions, command.playerId, command); break;
            case "resolveBattle": result = state.pendingCombat?.defenderPlayerId === command.playerId ? resolveBattle(state, definitions, queueTrigger) : { status: "failed", message: "Only the defending player can resolve this battle." }; break;
            case "triggerChoice": result = resolveLifeTriggerChoice(state, definitions, queueTrigger, command.playerId, command.activate); break;
            case "select": result = submitEffectSelection(state, definitions, command.playerId, command.cardIds, { returnOrder: command.returnOrder }); break;
            case "activationChoice": result = submitActivationChoice(state, definitions, command.playerId, command.activate); break;
            case "activateMain": result = activateMain(state, definitions, command.playerId, command.cardId, command.effectIndex, command.effectId); break;
            case "sortHand": {
                const player = getPlayer(state, command.playerId);
                if (!player) result = { status: "failed", message: "Player was not found." };
                else {
                    player.hand.sort((a, b) => {
                        const firstDefinition = definitions[a.definitionId] || {};
                        const secondDefinition = definitions[b.definitionId] || {};
                        const costDifference = Number(firstDefinition.cost ?? firstDefinition.playCost ?? 0)
                            - Number(secondDefinition.cost ?? secondDefinition.playCost ?? 0);
                        if (costDifference) return costDifference;
                        const nameDifference = String(firstDefinition.name || a.definitionId).localeCompare(
                            String(secondDefinition.name || b.definitionId),
                            undefined,
                            { numeric: true, sensitivity: "base" }
                        );
                        if (nameDifference) return nameDifference;
                        return String(a.definitionId).localeCompare(String(b.definitionId), undefined, { numeric: true, sensitivity: "base" });
                    });
                    result = { status: "completed" };
                }
                break;
            }
            case "surrender": finishGame(state, otherPlayerId(command.playerId), command.playerId, "surrender"); result = { status: "completed" }; break;
            case "disconnect": finishGame(state, otherPlayerId(command.playerId), command.playerId, "disconnect"); result = { status: "completed" }; break;
            case "requestRematch": {
                if (state.phase !== "gameOver") {
                    result = { status: "failed", message: "A rematch can only be requested after the game ends." };
                    break;
                }
                state.rematchRequests = { ...(state.rematchRequests || {}), [command.playerId]: true };
                if (state.rematchRequests.p1 && state.rematchRequests.p2) {
                    const freshState = createGameState({ p1, p2, random });
                    if (turnOrderChooserId) {
                        freshState.phase = "chooseFirst";
                        freshState.setup.turnOrderChooserId = turnOrderChooserId;
                    }
                    for (const key of Object.keys(state)) delete state[key];
                    Object.assign(state, freshState);
                    appendLog(state, "Rematch started.");
                    result = { status: "completed", rematchStarted: true };
                } else {
                    appendLog(state, `${state.players[command.playerId].name} requested a rematch.`);
                    result = { status: "completed", awaitingOpponent: true };
                }
                break;
            }
            default: result = { status: "failed", message: `Unknown command: ${command.type}` };
        }
        state.processedCommandIds.push(commandId);
        if (state.processedCommandIds.length > 500) state.processedCommandIds.splice(0, 100);
        if (result.status !== "failed") {
            state.revision += 1;
            const drained = drain(state, definitions);
            if (drained.status === "failed") result = drained;
            else if (drained.status === "completed") {
                const turnFlowResult = settleAutomaticTurnFlow(state, definitions, autoDraw);
                if (turnFlowResult.status === "failed") result = turnFlowResult;
            }
        }
        if (result.status === "failed") {
            appendLog(state, `Action failed (${command.type}): ${result.message || "Unknown gameplay error."}`);
        }
        return result;
    }

    return { state, dispatch, definitions };
}

export function redactStateForPlayer(state, playerId) {
    const copy = structuredClone(state);
    const hideCard = card => ({ instanceId: card.instanceId, zone: card.zone, face: "down", ownerId: card.ownerId, controllerId: card.controllerId });
    for (const player of Object.values(copy.players)) {
        if (player.id !== playerId) {
            player.hand = player.hand.map(hideCard);
            player.deck = player.deck.map(hideCard);
            player.life = player.life.map(card => card.face === "up" ? card : hideCard(card));
        }
    }
    if (copy.pendingSelection?.actingPlayerId !== playerId) copy.pendingSelection = copy.pendingSelection ? { ...copy.pendingSelection, validCardIds: [] } : null;
    if (copy.pendingTrigger?.playerId !== playerId && copy.pendingTrigger?.card) copy.pendingTrigger.card = hideCard(copy.pendingTrigger.card);
    copy.effectQueue = copy.effectQueue.map(entry => entry.actingPlayerId === playerId || !entry.searchBuffer ? entry : {
        ...entry,
        searchBuffer: { ...entry.searchBuffer, cards: entry.searchBuffer.cards.map(hideCard) }
    });
    return copy;
}
