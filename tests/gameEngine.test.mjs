import assert from "node:assert/strict";
import { createGameEngine, redactStateForPlayer } from "../js/game/engine/gameEngine.js";
import { createCardInstance } from "../js/game/state/gameState.js";
import { lifeModifierActionHandlers } from "../js/game/actions/lifeModifierActions.js";
import { getEffectiveCost, getEffectivePower } from "../js/game/checks/validation.js";
import { cardActionHandlers, drawCard } from "../js/game/actions/cardActions.js";
import { getSupportedActivators, normalizeActivator } from "../js/game/effects/effectActivators.js";
import { getRegisteredActions } from "../js/game/effects/actionRegistry.js";
import { activateMainEffectDefinitions } from "../js/cards/effects/activateMainEffects.js";
import { counterEffectDefinitions } from "../js/cards/effects/counterEffects.js";
import { onBlockEffectDefinitions } from "../js/cards/effects/onBlockEffects.js";
import { onKOEffectDefinitions } from "../js/cards/effects/onKOEffects.js";
import { onOpponentAttackEffectDefinitions } from "../js/cards/effects/onOpponentAttackEffects.js";
import { onPlayEffectDefinitions } from "../js/cards/effects/onPlayEffects.js";
import { turnEffectDefinitions } from "../js/cards/effects/turnEffects.js";
import { triggerEffectDefinitions } from "../js/cards/effects/triggerEffects.js";
import { whenAttackingEffectDefinitions } from "../js/cards/effects/whenAttackingEffects.js";
import { whenTrashedFromDeckEffectDefinitions } from "../js/cards/effects/whenTrashedFromDeckEffects.js";
import { cardEffectDefinitions } from "../js/cards/effects/cardEffectDefinitions.js";
import { compileCardEffects } from "../js/cards/effects/effectCompiler.js";
import { refreshPlayer } from "../js/game/phases/turnSystem.js";
import { returnDon } from "../js/game/actions/donStateActions.js";
import { loadGameSettings, normalizeGameSettings, saveGameSettings } from "../js/ui/shared/gameSettings.js";

const leader = id => ({ id, name: id, cardType: "leader", power: 5000, life: 5 });
const vanilla = { id: "T-001", name: "Vanilla", cardType: "character", cost: 1, power: 3000, counter: 1000, effects: [] };
const koTarget = {
    id: "T-002", name: "KO Target", cardType: "character", cost: 1, power: 1000, counter: 0,
    effects: [{ id: "ko-draw", trigger: "onKO", actions: [{ action: "drawCard", player: "self", quantity: 1 }] }]
};
const proof = {
    id: "T-003", name: "Sequential Proof", cardType: "character", cost: 1, power: 2000, counter: 0,
    effects: [{
        id: "proof-on-play",
        trigger: "onPlay",
        actions: [
            { action: "drawCard", player: "self", quantity: 2 },
            { action: "trashCard", actingPlayer: "self", selection: { controller: "self", area: "hand", amount: 1 } },
            { action: "cardKO", selection: { controller: "opponent", area: "characterArea", amount: 1, upTo: true, filters: { maximumCost: 1 } }, cause: "effect" }
        ]
    }]
};
const blocker = { id: "T-004", name: "Blocker", cardType: "character", cost: 1, power: 1000, counter: 0, keywords: ["blocker"], effects: [] };
const lifeTrigger = { id: "T-005", name: "Life Trigger", cardType: "event", cost: 1, effects: [{ id: "life-draw", trigger: "trigger", actions: [{ action: "drawCard", player: "self", quantity: 1 }] }] };
const searchProof = { id: "T-006", name: "Search Proof", cardType: "character", cost: 1, power: 1000, effects: [{ id: "search-main", trigger: "activateMain", actions: [{ action: "search", player: "self", deckLocation: "top", quantity: 3, amountTaken: 1, targetArea: "hand", filters: { name: "Vanilla" } }, { action: "returnRest", deckLocation: "bottom" }] }] };
const definitions = Object.fromEntries([leader("L-1"), leader("L-2"), vanilla, koTarget, proof, blocker, lifeTrigger, searchProof].map(card => [card.id, card]));
const deck = Array.from({ length: 30 }, () => vanilla);
const settingsStorage = {
    value: null,
    getItem() { return this.value; },
    setItem(key, value) { this.value = value; }
};
saveGameSettings({ autoDraw: true, confirmEndTurn: false }, settingsStorage);
assert.equal(loadGameSettings(settingsStorage).autoDraw, true, "saved Auto Draw preference is loaded for gameplay");
assert.equal(loadGameSettings(settingsStorage).confirmEndTurn, false, "saved confirmation preferences are loaded for gameplay");
assert.equal(normalizeGameSettings({ autoSkipBlock: true }).autoSkipBlock, true, "gameplay settings normalize saved booleans");
assert.equal(normalizeGameSettings({ autoDraw: "yes" }).autoDraw, false, "invalid saved values fall back safely");
assert.deepEqual(new Set(getSupportedActivators()), new Set(["activateMain", "counter", "trigger", "onPlay", "onKO", "whenAttacking", "onOpponentAttack", "whenAttacked", "onBlock", "gameStart", "startOfTurn", "endOfTurn", "endOfOpponentTurn", "onOpponentDealsDamage", "onCharacterPlay", "whenTrashedFromDeck"]));
assert.equal(normalizeActivator("main"), "activateMain");
assert.equal(normalizeActivator("onOpponentsAttack"), "onOpponentAttack");
assert.equal(normalizeActivator("endOfYourTurn"), "endOfTurn");
let randomCall = 0;
const engine = createGameEngine({ p1: { name: "P1", leader: definitions["L-1"], deck }, p2: { name: "P2", leader: definitions["L-2"], deck }, definitions, random: () => (++randomCall % 2 ? 0.99 : 0.01) });

const singleplayerEngine = createGameEngine({ p1: { name: "P1", leader: definitions["L-1"], deck }, p2: { name: "P2", leader: definitions["L-2"], deck }, definitions, turnOrderChooserId: "p1" });
assert.equal(singleplayerEngine.state.phase, "chooseFirst");
assert.equal(singleplayerEngine.state.setup.turnOrderChooserId, "p1");
assert.equal(singleplayerEngine.dispatch({ id: "p2-cannot-choose", type: "chooseFirst", playerId: "p2", firstPlayerId: "p2" }).status, "failed");
assert.match(singleplayerEngine.state.logs.at(-1).message, /Action failed \(chooseFirst\)/);
assert.equal(singleplayerEngine.dispatch({ id: "p1-chooses-second", type: "chooseFirst", playerId: "p1", firstPlayerId: "p2" }).status, "completed");

const manualDrawEngine = createGameEngine({ p1: { name: "P1", leader: definitions["L-1"], deck }, p2: { name: "P2", leader: definitions["L-2"], deck }, definitions, turnOrderChooserId: "p1", autoDraw: false });
manualDrawEngine.dispatch({ id: "manual-draw-first", type: "chooseFirst", playerId: "p1", firstPlayerId: "p1" });
manualDrawEngine.dispatch({ id: "manual-draw-mulligan-p1", type: "mulligan", playerId: "p1", redraw: false });
manualDrawEngine.dispatch({ id: "manual-draw-mulligan-p2", type: "mulligan", playerId: "p2", redraw: false });
assert.equal(manualDrawEngine.state.phase, "don", "the first player skips Draw Card and starts with Draw DON!!");
manualDrawEngine.dispatch({ id: "manual-draw-first-don", type: "advancePhase", playerId: "p1" });
assert.equal(manualDrawEngine.state.phase, "main", "Draw DON!! adds DON!! and enters the Main Phase");
manualDrawEngine.dispatch({ id: "manual-draw-end-turn", type: "advancePhase", playerId: "p1" });
assert.equal(manualDrawEngine.state.activePlayerId, "p2", "End Turn completes the End Phase and starts the opponent's turn");
assert.equal(manualDrawEngine.state.phase, "draw", "disabled Auto Draw leaves the second player on Draw Card");
const manualDrawHandBefore = manualDrawEngine.state.players.p2.hand.length;
manualDrawEngine.dispatch({ id: "manual-draw-card", type: "advancePhase", playerId: "p2" });
assert.equal(manualDrawEngine.state.phase, "don", "Draw Card advances to Draw DON!!");
assert.equal(manualDrawEngine.state.players.p2.hand.length, manualDrawHandBefore + 1, "Draw Card draws exactly one card");

function command(type, playerId, extra = {}) {
    return engine.dispatch({ id: `${type}-${Math.random()}`, type, playerId, ...extra });
}

assert.equal(command("rollDice", "p1").status, "completed");
assert.equal(command("rollDice", "p2").status, "completed");
assert.equal(engine.state.phase, "chooseFirst");
command("chooseFirst", engine.state.setup.dice.winnerId, { firstPlayerId: "p1" });
command("mulligan", "p1", { redraw: false });
command("mulligan", "p2", { redraw: false });
assert.equal(engine.state.phase, "don", "refresh and the first player's skipped draw complete automatically");
assert.equal(engine.state.players.p1.life.length, 5);
assert.equal(engine.state.players.p1.hand.length, 5, "first player skips first draw");
assert.equal(engine.state.logs.some(entry => /skips the first-turn draw/.test(entry.message)), true);
command("advancePhase", "p1");
assert.equal(engine.state.players.p1.activeDon, 1, "first DON!! phase adds one");
assert.equal(engine.state.phase, "main");
assert.equal(command("advancePhase", "p2").status, "failed", "out-of-turn phase command rejected");

const turnEngine = createGameEngine({ p1: { name: "P1", leader: definitions["L-1"], deck }, p2: { name: "P2", leader: definitions["L-2"], deck }, definitions, random: () => Math.random() });
turnEngine.state.firstPlayerId = "p1";
turnEngine.state.activePlayerId = "p2";
turnEngine.state.players.p2.turns = 1;
turnEngine.state.phase = "don";
turnEngine.dispatch({ id: "p2-first-don", type: "advancePhase", playerId: "p2" });
assert.equal(turnEngine.state.players.p2.activeDon, 2, "second player receives 2 DON!! on their first turn");

const secondPlayerDrawEngine = createGameEngine({ p1: { name: "P1", leader: definitions["L-1"], deck }, p2: { name: "P2", leader: definitions["L-2"], deck }, definitions });
secondPlayerDrawEngine.state.firstPlayerId = "p1";
secondPlayerDrawEngine.state.activePlayerId = "p2";
secondPlayerDrawEngine.state.players.p2.turns = 1;
secondPlayerDrawEngine.state.phase = "draw";
const secondPlayerHandBeforeDraw = secondPlayerDrawEngine.state.players.p2.hand.length;
secondPlayerDrawEngine.dispatch({ id: "p2-first-draw", type: "advancePhase", playerId: "p2" });
assert.equal(secondPlayerDrawEngine.state.players.p2.hand.length, secondPlayerHandBeforeDraw + 1, "second player draws on their first turn");

const refreshEngine = createGameEngine({ p1: { name: "P1", leader: definitions["L-1"], deck }, p2: { name: "P2", leader: definitions["L-2"], deck }, definitions });
refreshEngine.state.phase = "main";
refreshEngine.state.firstPlayerId = "p1";
refreshEngine.state.activePlayerId = "p1";
const refreshCard = createCardInstance(vanilla, "p2", "characterArea");
refreshCard.state = "rested";
refreshCard.attachedDon = 2;
refreshEngine.state.players.p2.characters[0] = refreshCard;
refreshEngine.state.players.p2.restedDon = 1;
const refreshHandBefore = refreshEngine.state.players.p2.hand.length;
refreshEngine.dispatch({ id: "automatic-end-turn", type: "advancePhase", playerId: "p1" });
assert.equal(refreshEngine.state.phase, "don", "End Turn completes End and Refresh, then automatically draws when enabled");
assert.equal(refreshCard.state, "active", "refresh readies rested cards");
assert.equal(refreshCard.attachedDon, 0, "refresh detaches DON!! from cards");
assert.equal(refreshEngine.state.players.p2.activeDon, 3, "detached and rested DON!! become active");
assert.equal(refreshEngine.state.players.p2.hand.length, refreshHandBefore + 1, "automatic refresh continues into the draw step");

const p1 = engine.state.players.p1;
const p2 = engine.state.players.p2;
const proofCard = createCardInstance(proof, "p1", "hand");
p1.hand.unshift(proofCard);
const target = createCardInstance(koTarget, "p2", "characterArea");
p2.characters[0] = target;
p1.activeDon = 5;
const playResult = command("playCard", "p1", { cardId: proofCard.instanceId });
assert.notEqual(playResult.status, "failed");
assert.equal(engine.state.pendingSelection?.area, "hand", "draw resolves before trash selection");
const afterDrawCount = p1.hand.length;
const trashChoice = p1.hand[0].instanceId;
command("select", "p1", { cardIds: [trashChoice] });
assert.equal(engine.state.pendingSelection?.upTo, true, "optional K.O. follows trash");
command("select", "p1", { cardIds: [] });
assert.equal(p2.characters[0]?.instanceId, target.instanceId, "optional K.O. may be skipped");
assert.equal(p1.hand.length, afterDrawCount - 1);

const secondProof = createCardInstance(proof, "p1", "hand");
p1.hand.unshift(secondProof);
p1.activeDon = 5;
command("playCard", "p1", { cardId: secondProof.instanceId });
command("select", "p1", { cardIds: [p1.hand[0].instanceId] });
const koStep = engine.state.pendingSelection;
const duplicateId = "ko-select-once";
assert.notEqual(engine.dispatch({ id: duplicateId, type: "select", playerId: "p1", cardIds: [target.instanceId] }).status, "failed");
assert.equal(engine.dispatch({ id: duplicateId, type: "select", playerId: "p1", cardIds: [target.instanceId] }).status, "skipped");
assert.equal(p2.characters[0], null);
if (engine.state.pendingSelection) throw new Error("Unexpected pending selection after On K.O. draw.");

const modified = createCardInstance(vanilla, "p1", "characterArea");
p1.characters[4] = modified;
modified.attachedDon = 1;
const restedBeforeRemoval = p1.restedDon;
cardActionHandlers.trashCard(engine.state, definitions, { actingPlayerId: "p1", controllerId: "p1" }, {}, [modified.instanceId]);
assert.equal(p1.restedDon, restedBeforeRemoval + 1, "attached DON!! returns rested when its card leaves play");
const modifiedAgain = createCardInstance(vanilla, "p1", "characterArea");
p1.characters[4] = modifiedAgain;
lifeModifierActionHandlers.increasePower(engine.state, definitions, { actingPlayerId: "p1", controllerId: "p1" }, { amount: 2000, duration: "endOfTurn" }, [modifiedAgain.instanceId]);
assert.equal(getEffectivePower(modifiedAgain, vanilla, engine.state), 5000);
engine.state.turnNumber += 1;
assert.equal(getEffectivePower(modifiedAgain, vanilla, engine.state), 3000, "turn modifier expires without changing printed power");
engine.state.turnNumber -= 1;

const searcher = createCardInstance(searchProof, "p1", "characterArea");
p1.characters[3] = searcher;
const handBeforeSearch = p1.hand.length;
const deckBeforeSearch = p1.deck.length;
command("activateMain", "p1", { cardId: searcher.instanceId });
assert.equal(engine.state.pendingSelection?.area, "search");
const opponentSearchView = redactStateForPlayer(engine.state, "p2");
assert.deepEqual(opponentSearchView.pendingSelection.validCardIds, []);
assert.equal(opponentSearchView.effectQueue[0].searchBuffer.cards.some(card => card.definitionId), false);
assert.equal(engine.state.pendingSelection.returnRest?.deckLocation, "bottom");
const searchedCardId = engine.state.pendingSelection.validCardIds[0];
const returnOrder = engine.state.effectQueue[0].searchBuffer.cards
    .filter(card => card.instanceId !== searchedCardId)
    .map(card => card.instanceId)
    .reverse();
command("select", "p1", { cardIds: [searchedCardId], returnOrder });
assert.equal(p1.hand.length, handBeforeSearch + 1);
assert.equal(p1.deck.length, deckBeforeSearch - 1, "unselected search cards return to the deck");
assert.deepEqual(p1.deck.slice(-returnOrder.length).map(card => card.instanceId), returnOrder, "searched cards use the chosen return order");

engine.state.effectQueue = [];
engine.state.pendingSelection = null;
const attacker = p1.leader;
attacker.state = "active";
const defendingLeader = p2.leader;
const block = createCardInstance(blocker, "p2", "characterArea");
p2.characters[1] = block;
const attack = command("attack", "p1", { attackerId: attacker.instanceId, targetId: defendingLeader.instanceId });
assert.notEqual(attack.status, "failed");
assert.equal(engine.state.pendingCombat.window, "blocker");
command("blocker", "p2", { blockerId: block.instanceId });
assert.equal(engine.state.pendingCombat.window, "counter");
assert.equal(command("resolveBattle", "p1").status, "failed", "attacker cannot close defender Counter window");
command("resolveBattle", "p2");
assert.equal(p2.characters[1], null, "Blocker is K.O.'d when attack power wins");

attacker.state = "active";
const counterCard = createCardInstance(vanilla, "p2", "hand");
p2.hand.unshift(counterCard);
const lifeBeforeCounter = p2.life.length;
command("attack", "p1", { attackerId: attacker.instanceId, targetId: p2.leader.instanceId });
command("counter", "p2", { cardId: counterCard.instanceId });
assert.equal(engine.state.pendingCombat.counterPower, 1000);
command("resolveBattle", "p2");
assert.equal(p2.life.length, lifeBeforeCounter, "Counter power prevents equal-power Leader damage");

attacker.state = "active";
p2.life = [createCardInstance(lifeTrigger, "p2", "life")];
command("attack", "p1", { attackerId: attacker.instanceId, targetId: p2.leader.instanceId });
command("resolveBattle", "p2");
assert.equal(engine.state.pendingTrigger?.playerId, "p2");
assert.equal(redactStateForPlayer(engine.state, "p1").pendingTrigger.card.definitionId, undefined);
command("triggerChoice", "p2", { activate: false });
assert.equal(engine.state.pendingTrigger, null);

attacker.state = "active";
p2.life = [];
command("attack", "p1", { attackerId: attacker.instanceId, targetId: p2.leader.instanceId });
if (engine.state.pendingCombat.window === "blocker") command("blocker", "p2", { blockerId: null });
command("resolveBattle", "p2");
assert.equal(engine.state.winnerId, "p1");
assert.equal(engine.state.phase, "gameOver");

const redacted = redactStateForPlayer(engine.state, "p1");
assert.equal(redacted.players.p2.hand.some(card => card.definitionId), false, "opponent hand definitions are private");

const deckOutEngine = createGameEngine({ p1: { name: "P1", leader: definitions["L-1"], deck: [] }, p2: { name: "P2", leader: definitions["L-2"], deck: [] }, definitions });
drawCard(deckOutEngine.state, definitions, { controllerId: "p1", actingPlayerId: "p1" }, { player: "self", quantity: 1 });
assert.equal(deckOutEngine.state.winnerId, "p2");
assert.equal(deckOutEngine.state.winReason, "deck out");

function activationEngine(extraDefinitions = {}, p1Leader = leader("A-L1"), p2Leader = leader("A-L2"), engineOptions = {}) {
    const allDefinitions = { [p1Leader.id]: p1Leader, [p2Leader.id]: p2Leader, [vanilla.id]: vanilla, ...extraDefinitions };
    const game = createGameEngine({
        p1: { name: "P1", leader: p1Leader, deck: Array.from({ length: 20 }, () => vanilla) },
        p2: { name: "P2", leader: p2Leader, deck: Array.from({ length: 20 }, () => vanilla) },
        definitions: allDefinitions,
        random: () => 0.5,
        ...engineOptions
    });
    game.state.phase = "main";
    game.state.firstPlayerId = "p1";
    game.state.activePlayerId = "p1";
    game.state.turnNumber = 1;
    return game;
}

const rushDefinition = { id: "KEY-RUSH", name: "Rush", cardType: "character", power: 5000, keywords: ["rush"] };
const rushGame = activationEngine({ [rushDefinition.id]: rushDefinition });
const rushCard = createCardInstance(rushDefinition, "p1", "characterArea");
rushCard.playedOnTurn = rushGame.state.turnNumber;
rushGame.state.players.p1.characters[0] = rushCard;
assert.notEqual(rushGame.dispatch({ id: "rush-attack", type: "attack", playerId: "p1", attackerId: rushCard.instanceId, targetId: rushGame.state.players.p2.leader.instanceId }).status, "failed", "Rush can attack on the turn the Character was played");

const characterRushDefinition = { id: "KEY-CHAR-RUSH", name: "Character Rush", cardType: "character", power: 5000, keywords: ["Rush: Characters"] };
const characterRushGame = activationEngine({ [characterRushDefinition.id]: characterRushDefinition });
const characterRushCard = createCardInstance(characterRushDefinition, "p1", "characterArea");
const characterRushTarget = createCardInstance(vanilla, "p2", "characterArea");
characterRushCard.playedOnTurn = characterRushGame.state.turnNumber;
characterRushTarget.state = "rested";
characterRushGame.state.players.p1.characters[0] = characterRushCard;
characterRushGame.state.players.p2.characters[0] = characterRushTarget;
assert.equal(characterRushGame.dispatch({ id: "character-rush-leader", type: "attack", playerId: "p1", attackerId: characterRushCard.instanceId, targetId: characterRushGame.state.players.p2.leader.instanceId }).status, "failed", "Rush: Characters cannot attack a Leader on the turn played");
assert.notEqual(characterRushGame.dispatch({ id: "character-rush-character", type: "attack", playerId: "p1", attackerId: characterRushCard.instanceId, targetId: characterRushTarget.instanceId }).status, "failed", "Rush: Characters can attack a Character on the turn played");

const unblockableDefinition = { id: "KEY-UNBLOCKABLE", name: "Unblockable", cardType: "character", power: 5000, keywords: ["unblockable"] };
const unblockableGame = activationEngine({ [unblockableDefinition.id]: unblockableDefinition, [blocker.id]: blocker });
const unblockableCard = createCardInstance(unblockableDefinition, "p1", "characterArea");
const ignoredBlocker = createCardInstance(blocker, "p2", "characterArea");
unblockableGame.state.players.p1.characters[0] = unblockableCard;
unblockableGame.state.players.p2.characters[0] = ignoredBlocker;
unblockableGame.dispatch({ id: "unblockable-attack", type: "attack", playerId: "p1", attackerId: unblockableCard.instanceId, targetId: unblockableGame.state.players.p2.leader.instanceId });
assert.equal(unblockableGame.state.pendingCombat?.window, "counter", "Unblockable skips the Blocker Step");
assert.deepEqual(unblockableGame.state.pendingCombat?.validBlockerIds, [], "Unblockable exposes no valid Blocker choices");
assert.equal(ignoredBlocker.state, "active", "an ignored Blocker is not rested");

const preventionGame = activationEngine();
const preventionCard = createCardInstance(vanilla, "p1", "characterArea");
const preventionContext = { actingPlayerId: "p1", controllerId: "p1", ownerId: "p1" };
preventionGame.state.players.p1.characters[0] = preventionCard;

cardActionHandlers.preventStateChange(preventionGame.state, preventionGame.definitions, preventionContext, { prevention: "cannotBeRested", duration: "turn" }, [preventionCard.instanceId]);
assert.equal(cardActionHandlers.restCard(preventionGame.state, preventionGame.definitions, preventionContext, {}, [preventionCard.instanceId]).status, "failed", "cannotBeRested rejects effect resting");
assert.equal(preventionGame.dispatch({ id: "cannot-rest-attack", type: "attack", playerId: "p1", attackerId: preventionCard.instanceId, targetId: preventionGame.state.players.p2.leader.instanceId }).status, "failed", "cannotBeRested also prevents paying the rest requirement to attack");

preventionCard.preventions = [];
cardActionHandlers.preventStateChange(preventionGame.state, preventionGame.definitions, preventionContext, { prevention: "cannotAttack", duration: "turn" }, [preventionCard.instanceId]);
assert.equal(preventionGame.dispatch({ id: "cannot-attack", type: "attack", playerId: "p1", attackerId: preventionCard.instanceId, targetId: preventionGame.state.players.p2.leader.instanceId }).status, "failed", "cannotAttack rejects attack declaration");
assert.equal(cardActionHandlers.restCard(preventionGame.state, preventionGame.definitions, preventionContext, {}, [preventionCard.instanceId]).status, "completed", "cannotAttack does not prevent other resting");

preventionCard.preventions = [];
preventionCard.state = "rested";
cardActionHandlers.preventStateChange(preventionGame.state, preventionGame.definitions, preventionContext, { prevention: "skipRefreshActivation", duration: "nextRefresh" }, [preventionCard.instanceId]);
refreshPlayer(preventionGame.state.players.p1, preventionGame.state);
assert.equal(preventionCard.state, "rested", "skipRefreshActivation leaves the card rested during the next Refresh Phase");
assert.equal(preventionCard.preventions.length, 0, "a next-Refresh prevention is consumed by that Refresh Phase");
refreshPlayer(preventionGame.state.players.p1, preventionGame.state);
assert.equal(preventionCard.state, "active", "the card becomes active during a later Refresh Phase");

preventionCard.state = "rested";
cardActionHandlers.preventStateChange(preventionGame.state, preventionGame.definitions, preventionContext, { prevention: "cannotBecomeActive", duration: "turn" }, [preventionCard.instanceId]);
assert.equal(cardActionHandlers.restandCard(preventionGame.state, preventionGame.definitions, preventionContext, {}, [preventionCard.instanceId]).status, "failed", "cannotBecomeActive rejects effect activation");
refreshPlayer(preventionGame.state.players.p1, preventionGame.state);
assert.equal(preventionCard.state, "rested", "cannotBecomeActive also prevents Refresh activation");
preventionGame.state.turnNumber += 1;
assert.equal(cardActionHandlers.restandCard(preventionGame.state, preventionGame.definitions, preventionContext, {}, [preventionCard.instanceId]).status, "completed", "turn-duration prevention expires after its stated turn");

const preventionStageDefinition = { id: "PREVENTION-STAGE", name: "Prevention Source", cardType: "stage", cost: 1 };
const whileInPlayGame = activationEngine({ [preventionStageDefinition.id]: preventionStageDefinition });
const preventionStage = createCardInstance(preventionStageDefinition, "p1", "stage");
whileInPlayGame.state.players.p1.stage = preventionStage;
const whileInPlayContext = { actingPlayerId: "p1", controllerId: "p1", ownerId: "p1", sourceInstanceId: preventionStage.instanceId };
cardActionHandlers.preventStateChange(whileInPlayGame.state, whileInPlayGame.definitions, whileInPlayContext, { prevention: "cannotAttack", duration: "whileInPlay" }, [whileInPlayGame.state.players.p1.leader.instanceId]);
assert.equal(whileInPlayGame.dispatch({ id: "while-in-play-blocked", type: "attack", playerId: "p1", attackerId: whileInPlayGame.state.players.p1.leader.instanceId, targetId: whileInPlayGame.state.players.p2.leader.instanceId }).status, "failed", "whileInPlay prevention applies while its source remains on the board");
cardActionHandlers.trashCard(whileInPlayGame.state, whileInPlayGame.definitions, whileInPlayContext, {}, [preventionStage.instanceId]);
assert.notEqual(whileInPlayGame.dispatch({ id: "while-in-play-expired", type: "attack", playerId: "p1", attackerId: whileInPlayGame.state.players.p1.leader.instanceId, targetId: whileInPlayGame.state.players.p2.leader.instanceId }).status, "failed", "whileInPlay prevention expires when its source leaves the board");

const returnDonGame = activationEngine();
const returnDonCard = createCardInstance(vanilla, "p1", "characterArea");
returnDonGame.state.players.p1.characters[0] = returnDonCard;
returnDonGame.state.players.p1.activeDon = 1;
returnDonGame.state.players.p1.restedDon = 1;
returnDonGame.state.players.p1.donDeck = 6;
returnDonCard.attachedDon = 2;
const partialDonReturn = returnDon(returnDonGame.state, returnDonGame.definitions, preventionContext, { player: "self", quantity: 5 });
assert.equal(partialDonReturn.status, "completed", "returnDon does not fail when fewer DON!! are available than requested");
assert.equal(partialDonReturn.quantity, 4, "returnDon reports the amount actually returned");
assert.equal(returnDonGame.state.players.p1.donDeck, 10, "returnDon returns Cost Area and attached DON!! to the DON!! deck");
assert.equal(returnDonGame.state.players.p1.activeDon + returnDonGame.state.players.p1.restedDon + returnDonCard.attachedDon, 0, "returnDon removes every available eligible DON!! up to the requested amount");
const emptyDonReturn = returnDon(returnDonGame.state, returnDonGame.definitions, preventionContext, { player: "self", quantity: 2 });
assert.equal(emptyDonReturn.status, "completed", "returnDon completes when no eligible DON!! are available");
assert.equal(emptyDonReturn.quantity, 0, "returnDon reports zero when nothing can be returned");

const protectedLeader = returnDonGame.state.players.p1.leader;
const leaderTrashResult = cardActionHandlers.trashCard(returnDonGame.state, returnDonGame.definitions, preventionContext, {}, [protectedLeader.instanceId]);
assert.equal(leaderTrashResult.status, "failed", "trashCard rejects Leader cards");
assert.equal(returnDonGame.state.players.p1.leader, protectedLeader, "a rejected trash action leaves the Leader in play");

returnDonGame.state.players.p1.activeDon = 1;
returnDonGame.state.players.p1.restedDon = 1;
returnDonGame.state.players.p1.donDeck = 6;
returnDonCard.attachedDon = 2;
const attachedOnlyReturn = returnDon(returnDonGame.state, returnDonGame.definitions, preventionContext, { player: "self", quantity: 1, source: "attached" }, [returnDonCard.instanceId]);
assert.equal(attachedOnlyReturn.quantity, 1, "returnDon can be limited to attached DON!! on selected cards");
assert.equal(returnDonCard.attachedDon, 1, "attached-only return removes DON!! from the selected card");
assert.equal(returnDonGame.state.players.p1.activeDon, 1, "attached-only return does not remove active Cost Area DON!!");
assert.equal(returnDonGame.state.players.p1.restedDon, 1, "attached-only return does not remove rested Cost Area DON!!");

const doubleAttackDefinition = { id: "KEY-DOUBLE", name: "Double Attack", cardType: "character", power: 7000, keywords: ["doubleAttack"] };
const doubleAttackGame = activationEngine({ [doubleAttackDefinition.id]: doubleAttackDefinition });
const doubleAttackCard = createCardInstance(doubleAttackDefinition, "p1", "characterArea");
doubleAttackGame.state.players.p1.characters[0] = doubleAttackCard;
doubleAttackGame.state.players.p2.life = Array.from({ length: 3 }, () => createCardInstance(vanilla, "p2", "life"));
doubleAttackGame.dispatch({ id: "double-attack", type: "attack", playerId: "p1", attackerId: doubleAttackCard.instanceId, targetId: doubleAttackGame.state.players.p2.leader.instanceId });
doubleAttackGame.dispatch({ id: "double-attack-damage", type: "resolveBattle", playerId: "p2" });
assert.equal(doubleAttackGame.state.players.p2.life.length, 1, "Double Attack deals two Life damage");
assert.equal(doubleAttackGame.state.players.p2.hand.length, 2, "both Double Attack Life cards go to hand normally");

const banishDefinition = { id: "KEY-BANISH", name: "Banish", cardType: "character", power: 7000, keywords: ["banish"] };
const banishGame = activationEngine({ [banishDefinition.id]: banishDefinition, [lifeTrigger.id]: lifeTrigger });
const banishCard = createCardInstance(banishDefinition, "p1", "characterArea");
const banishedLife = createCardInstance(lifeTrigger, "p2", "life");
banishGame.state.players.p1.characters[0] = banishCard;
banishGame.state.players.p2.life = [banishedLife];
banishGame.dispatch({ id: "banish-attack", type: "attack", playerId: "p1", attackerId: banishCard.instanceId, targetId: banishGame.state.players.p2.leader.instanceId });
banishGame.dispatch({ id: "banish-damage", type: "resolveBattle", playerId: "p2" });
assert.equal(banishGame.state.pendingTrigger, null, "Banish prevents a Life Trigger from activating");
assert.equal(banishGame.state.players.p2.hand.includes(banishedLife), false, "Banish does not add the Life card to hand");
assert.equal(banishGame.state.players.p2.trash.includes(banishedLife), true, "Banish sends the Life card to Trash");

const doubleTriggerGame = activationEngine({ [doubleAttackDefinition.id]: doubleAttackDefinition, [lifeTrigger.id]: lifeTrigger });
const doubleTriggerAttacker = createCardInstance(doubleAttackDefinition, "p1", "characterArea");
doubleTriggerGame.state.players.p1.characters[0] = doubleTriggerAttacker;
doubleTriggerGame.state.players.p2.life = [createCardInstance(lifeTrigger, "p2", "life"), createCardInstance(vanilla, "p2", "life"), createCardInstance(vanilla, "p2", "life")];
doubleTriggerGame.dispatch({ id: "double-trigger-attack", type: "attack", playerId: "p1", attackerId: doubleTriggerAttacker.instanceId, targetId: doubleTriggerGame.state.players.p2.leader.instanceId });
doubleTriggerGame.dispatch({ id: "double-trigger-damage", type: "resolveBattle", playerId: "p2" });
assert.equal(doubleTriggerGame.state.pendingTrigger?.playerId, "p2", "Double Attack pauses on the first Life Trigger");
assert.equal(doubleTriggerGame.state.players.p2.life.length, 2, "the second Double Attack damage waits for the Trigger choice");
doubleTriggerGame.dispatch({ id: "double-trigger-skip", type: "triggerChoice", playerId: "p2", activate: false });
assert.equal(doubleTriggerGame.state.players.p2.life.length, 1, "Double Attack resumes after the Trigger choice");

const rematchGame = activationEngine();
const finishedGameId = rematchGame.state.gameId;
rematchGame.state.phase = "gameOver";
rematchGame.state.winnerId = "p1";
assert.equal(rematchGame.dispatch({ id: "rematch-p1", type: "requestRematch", playerId: "p1" }).awaitingOpponent, true);
assert.equal(rematchGame.state.rematchRequests.p1, true);
assert.equal(rematchGame.dispatch({ id: "rematch-p2", type: "requestRematch", playerId: "p2" }).rematchStarted, true);
assert.notEqual(rematchGame.state.gameId, finishedGameId, "both rematch requests create a fresh match");
assert.equal(rematchGame.state.phase, "diceRoll");

const sortableCards = [
    { id: "SORT-010", name: "Beta", cardType: "character", cost: 1, power: 1000 },
    { id: "SORT-002", name: "Alpha", cardType: "character", cost: 3, power: 1000 },
    { id: "SORT-001", name: "Alpha", cardType: "character", cost: 3, power: 1000 },
    { id: "SORT-003", name: "Zeta", cardType: "character", cost: 2, power: 1000 }
];
const sortGame = activationEngine(Object.fromEntries(sortableCards.map(card => [card.id, card])));
sortGame.state.players.p1.hand = sortableCards.map(card => createCardInstance(card, "p1", "hand"));
sortGame.dispatch({ id: "sort-hand-proof", type: "sortHand", playerId: "p1" });
assert.deepEqual(
    sortGame.state.players.p1.hand.map(card => card.definitionId),
    ["SORT-010", "SORT-003", "SORT-001", "SORT-002"],
    "hand sorting uses cost, then name, then card ID"
);

const registeredActionNames = new Set(getRegisteredActions());
assert.equal(Object.keys(onPlayEffectDefinitions).length, 32, "the On Play implementation batch is registered separately");
assert.equal(Object.keys(activateMainEffectDefinitions).length, 19, "the Activate: Main implementation batch is registered separately");
assert.equal(Object.keys(counterEffectDefinitions).length, 13, "the Counter implementation batch is registered separately");
assert.equal(Object.keys(onBlockEffectDefinitions).length, 1, "the On Block implementation batch is registered separately");
assert.equal(Object.keys(onKOEffectDefinitions).length, 7, "the On K.O. implementation batch is registered separately");
assert.equal(Object.keys(onOpponentAttackEffectDefinitions).length, 1, "the On Opponent Attack implementation batch is registered separately");
assert.equal(Object.keys(turnEffectDefinitions).length, 3, "the turn timing implementation batch is registered separately");
assert.equal(Object.keys(triggerEffectDefinitions).length, 20, "the Trigger implementation batch is registered separately");
assert.equal(Object.keys(whenAttackingEffectDefinitions).length, 12, "the When Attacking implementation batch is registered separately");
assert.equal(Object.keys(whenTrashedFromDeckEffectDefinitions).length, 1, "the When Trashed From Deck implementation batch is registered separately");
const compiledRegistryProof = compileCardEffects({ id: "REGISTRY", effects: [{ id: "BK01-009-on-play-ko-cost-five", type: "onPlay" }] }, cardEffectDefinitions);
assert.equal(compiledRegistryProof.effects[0].actions[0].action, "cardKO", "the shared card compiler merges activator definitions into JSON cards");
for (const [effectId, implementation] of Object.entries(onPlayEffectDefinitions)) {
    assert.equal(implementation.trigger, "onPlay", `${effectId} stays in the On Play activator module`);
    assert.ok(implementation.actions.length > 0, `${effectId} has executable actions`);
    assert.equal(implementation.actions.every(action => registeredActionNames.has(action.action)), true, `${effectId} uses only registered staple actions`);
}
for (const [effectId, implementation] of Object.entries(activateMainEffectDefinitions)) {
    assert.equal(implementation.trigger, "activateMain", `${effectId} stays in the Activate: Main activator module`);
    assert.ok(implementation.actions.length > 0, `${effectId} has executable actions`);
    assert.equal(implementation.actions.every(action => registeredActionNames.has(action.action)), true, `${effectId} uses only registered staple actions`);
}
for (const [effectId, implementation] of Object.entries(counterEffectDefinitions)) {
    assert.equal(implementation.trigger, "counter", `${effectId} stays in the Counter activator module`);
    assert.ok(implementation.actions.length > 0, `${effectId} has executable actions`);
    assert.equal(implementation.actions.every(action => registeredActionNames.has(action.action)), true, `${effectId} uses only registered staple actions`);
}
for (const [effectId, implementation] of Object.entries(onBlockEffectDefinitions)) {
    assert.equal(implementation.trigger, "onBlock", `${effectId} stays in the On Block activator module`);
    assert.ok(implementation.actions.length > 0, `${effectId} has executable actions`);
    assert.equal(implementation.actions.every(action => registeredActionNames.has(action.action)), true, `${effectId} uses only registered staple actions`);
}
for (const [effectId, implementation] of Object.entries(onKOEffectDefinitions)) {
    assert.equal(implementation.trigger, "onKO", `${effectId} stays in the On K.O. activator module`);
    assert.ok(implementation.actions.length > 0, `${effectId} has executable actions`);
    assert.equal(implementation.actions.every(action => registeredActionNames.has(action.action)), true, `${effectId} uses only registered staple actions`);
}
for (const [effectId, implementation] of Object.entries(onOpponentAttackEffectDefinitions)) {
    assert.equal(implementation.trigger, "onOpponentAttack", `${effectId} stays in the On Opponent Attack activator module`);
    assert.ok(implementation.actions.length > 0, `${effectId} has executable actions`);
    assert.equal(implementation.actions.every(action => registeredActionNames.has(action.action)), true, `${effectId} uses only registered staple actions`);
}
for (const [effectId, implementation] of Object.entries(turnEffectDefinitions)) {
    assert.equal(implementation.trigger, "endOfTurn", `${effectId} stays in the turn activator module`);
    assert.ok(implementation.actions.length > 0, `${effectId} has executable actions`);
    assert.equal(implementation.actions.every(action => registeredActionNames.has(action.action)), true, `${effectId} uses only registered staple actions`);
}
for (const [effectId, implementation] of Object.entries(triggerEffectDefinitions)) {
    assert.equal(implementation.trigger, "trigger", `${effectId} stays in the Trigger activator module`);
    assert.ok(implementation.actions.length > 0, `${effectId} has executable actions`);
    assert.equal(implementation.actions.every(action => registeredActionNames.has(action.action)), true, `${effectId} uses only registered staple actions`);
}
for (const [effectId, implementation] of Object.entries(whenAttackingEffectDefinitions)) {
    assert.equal(implementation.trigger, "whenAttacking", `${effectId} stays in the When Attacking activator module`);
    assert.ok(implementation.actions.length > 0, `${effectId} has executable actions`);
    assert.equal(implementation.actions.every(action => registeredActionNames.has(action.action)), true, `${effectId} uses only registered staple actions`);
}
for (const [effectId, implementation] of Object.entries(whenTrashedFromDeckEffectDefinitions)) {
    assert.equal(implementation.trigger, "whenTrashedFromDeck", `${effectId} stays in the When Trashed From Deck activator module`);
    assert.ok(implementation.actions.length > 0, `${effectId} has executable actions`);
    assert.equal(implementation.actions.every(action => registeredActionNames.has(action.action)), true, `${effectId} uses only registered staple actions`);
}

const trashReturnTrigger = compileCardEffects({
    id: "POG1-014", name: "Hvala hvala hvala", cardType: "event", cost: 1,
    effects: [{ id: "POG1-014-trigger", type: "trigger" }]
}, cardEffectDefinitions);
const trashReturnTriggerGame = activationEngine({ [trashReturnTrigger.id]: trashReturnTrigger });
const trashReturnSource = createCardInstance(trashReturnTrigger, "p2", "life");
const trashReturnTarget = createCardInstance(vanilla, "p2", "trash");
trashReturnTriggerGame.state.players.p2.life = [trashReturnSource];
trashReturnTriggerGame.state.players.p2.trash = [trashReturnTarget];
trashReturnTriggerGame.dispatch({
    id: "trash-return-trigger-attack",
    type: "attack",
    playerId: "p1",
    attackerId: trashReturnTriggerGame.state.players.p1.leader.instanceId,
    targetId: trashReturnTriggerGame.state.players.p2.leader.instanceId
});
trashReturnTriggerGame.dispatch({ id: "trash-return-trigger-damage", type: "resolveBattle", playerId: "p2" });
trashReturnTriggerGame.dispatch({ id: "trash-return-trigger-use", type: "triggerChoice", playerId: "p2", activate: true });
assert.deepEqual(trashReturnTriggerGame.state.pendingSelection?.validCardIds, [trashReturnTarget.instanceId], "a Trigger cannot select its own resolving Life card from Trash");
trashReturnTriggerGame.dispatch({ id: "trash-return-trigger-select", type: "select", playerId: "p2", cardIds: [trashReturnTarget.instanceId] });
assert.equal(trashReturnTriggerGame.state.players.p2.hand.includes(trashReturnTarget), true, "the selected Trash card returns to hand");
assert.equal(trashReturnTriggerGame.state.players.p2.trash.includes(trashReturnSource), true, "the resolved Trigger card remains in Trash");

const vamolaOnKO = compileCardEffects({
    id: "DD01-012", name: "Vamola", cardType: "character", cost: 1, power: 1000,
    effects: [{ id: "DD01-012-on-ko-add-don", type: "onKO" }]
}, cardEffectDefinitions);
const vamolaOnKOGame = activationEngine({ [vamolaOnKO.id]: vamolaOnKO });
const vamolaOnKOCard = createCardInstance(vamolaOnKO, "p2", "characterArea");
vamolaOnKOCard.state = "rested";
vamolaOnKOGame.state.players.p2.characters[0] = vamolaOnKOCard;
const activeDonBeforeVamola = vamolaOnKOGame.state.players.p2.activeDon;
vamolaOnKOGame.dispatch({
    id: "vamola-on-ko-attack",
    type: "attack",
    playerId: "p1",
    attackerId: vamolaOnKOGame.state.players.p1.leader.instanceId,
    targetId: vamolaOnKOCard.instanceId
});
vamolaOnKOGame.dispatch({ id: "vamola-on-ko-battle", type: "resolveBattle", playerId: "p2" });
assert.equal(vamolaOnKOGame.state.pendingActivation?.effectId, "DD01-012-on-ko-add-don", "Vamola's optional On K.O. effect asks its controller");
vamolaOnKOGame.dispatch({ id: "vamola-on-ko-use", type: "activationChoice", playerId: "p2", activate: true });
assert.equal(vamolaOnKOGame.state.players.p2.activeDon, activeDonBeforeVamola + 1, "Vamola adds its DON!! active");

const yamatoOnKO = compileCardEffects({
    id: "OP16-096", name: "Yamato", cardType: "character", cost: 8, power: 1000,
    effects: [{ id: "OP16-096-on-ko-play-yamato", type: "onKO" }]
}, cardEffectDefinitions);
const smallerYamato = { id: "YAMATO-SIX", name: "Yamato", cardType: "character", cost: 6, power: 6000 };
const yamatoOnKOGame = activationEngine({ [yamatoOnKO.id]: yamatoOnKO, [smallerYamato.id]: smallerYamato });
const yamatoOnKOSource = createCardInstance(yamatoOnKO, "p2", "characterArea");
const smallerYamatoCard = createCardInstance(smallerYamato, "p2", "trash");
yamatoOnKOSource.state = "rested";
yamatoOnKOGame.state.players.p2.characters[0] = yamatoOnKOSource;
yamatoOnKOGame.state.players.p2.trash = [smallerYamatoCard];
yamatoOnKOGame.dispatch({
    id: "yamato-on-ko-attack",
    type: "attack",
    playerId: "p1",
    attackerId: yamatoOnKOGame.state.players.p1.leader.instanceId,
    targetId: yamatoOnKOSource.instanceId
});
yamatoOnKOGame.dispatch({ id: "yamato-on-ko-battle", type: "resolveBattle", playerId: "p2" });
assert.deepEqual(yamatoOnKOGame.state.pendingSelection?.validCardIds, [smallerYamatoCard.instanceId], "Yamato's On K.O. effect finds an eligible different Yamato");
yamatoOnKOGame.dispatch({ id: "yamato-on-ko-select", type: "select", playerId: "p2", cardIds: [smallerYamatoCard.instanceId] });
assert.equal(yamatoOnKOGame.state.players.p2.characters.includes(smallerYamatoCard), true, "the selected Yamato is played from Trash");
assert.equal(smallerYamatoCard.state, "active", "the Yamato played by the On K.O. effect enters active");

const uryuWhenAttacking = compileCardEffects({
    id: "BL01-014", name: "Uryu Ishida", cardType: "character", cost: 4, power: 5000,
    effects: [{ id: "BL01-014-when-attacking-minus-ko", type: "whenAttacking" }]
}, cardEffectDefinitions);
const uryuVictimDefinition = { id: "URYU-VICTIM", name: "Power Target", cardType: "character", cost: 5, power: 5000 };
const uryuWhenAttackingGame = activationEngine({ [uryuWhenAttacking.id]: uryuWhenAttacking, [uryuVictimDefinition.id]: uryuVictimDefinition });
const uryuAttacker = createCardInstance(uryuWhenAttacking, "p1", "characterArea");
const uryuVictim = createCardInstance(uryuVictimDefinition, "p2", "characterArea");
uryuWhenAttackingGame.state.players.p1.characters[0] = uryuAttacker;
uryuWhenAttackingGame.state.players.p2.characters[0] = uryuVictim;
uryuWhenAttackingGame.dispatch({
    id: "uryu-when-attacking",
    type: "attack",
    playerId: "p1",
    attackerId: uryuAttacker.instanceId,
    targetId: uryuWhenAttackingGame.state.players.p2.leader.instanceId
});
uryuWhenAttackingGame.dispatch({ id: "uryu-minus-power", type: "select", playerId: "p1", cardIds: [uryuVictim.instanceId] });
assert.equal(getEffectivePower(uryuVictim, uryuVictimDefinition, uryuWhenAttackingGame.state), 4000, "Uryu first reduces the selected Character's power");
assert.deepEqual(uryuWhenAttackingGame.state.pendingSelection?.validCardIds, [uryuVictim.instanceId], "the K.O. filter uses the Character's reduced effective power");
uryuWhenAttackingGame.dispatch({ id: "uryu-ko-target", type: "select", playerId: "p1", cardIds: [uryuVictim.instanceId] });
assert.equal(uryuWhenAttackingGame.state.players.p2.characters[0], null, "Uryu K.O.s the eligible Character before the Counter Step");
assert.equal(uryuWhenAttackingGame.state.pendingCombat?.window, "counter", "combat continues after the When Attacking effect");

const eggmanWhenAttacking = compileCardEffects({
    id: "EGG1-001", name: "Eggman", cardType: "leader", power: 5000, life: 5,
    effects: [{ id: "EGG1-001-when-attacking-power", type: "whenAttacking" }]
}, cardEffectDefinitions);
const eggmanWhenAttackingGame = activationEngine({}, eggmanWhenAttacking, leader("EGGMAN-OPPONENT"));
const targetlessAttack = eggmanWhenAttackingGame.dispatch({
    id: "eggman-no-target-attack",
    type: "attack",
    playerId: "p1",
    attackerId: eggmanWhenAttackingGame.state.players.p1.leader.instanceId,
    targetId: eggmanWhenAttackingGame.state.players.p2.leader.instanceId
});
assert.notEqual(targetlessAttack.status, "failed", "a targetless automatic effect does not fail the attack");
assert.equal(eggmanWhenAttackingGame.state.pendingCombat?.window, "counter", "a targetless automatic effect does not block combat");

const ishidroMain = compileCardEffects({
    id: "BK01-008", name: "Ishidro", cardType: "character", cost: 1, power: 1000,
    effects: [{ id: "BK01-008-activate-main-minus-cost-rest", type: "activateMain" }]
}, cardEffectDefinitions);
const ishidroMainGame = activationEngine({ [ishidroMain.id]: ishidroMain });
const ishidroMainCard = createCardInstance(ishidroMain, "p1", "characterArea");
const ishidroMainTargetDefinition = { ...vanilla, id: "ISHIDRO-TARGET", cost: 5 };
const ishidroMainTarget = createCardInstance(ishidroMainTargetDefinition, "p2", "characterArea");
ishidroMainGame.definitions[ishidroMainTargetDefinition.id] = ishidroMainTargetDefinition;
ishidroMainGame.state.players.p1.characters[0] = ishidroMainCard;
ishidroMainGame.state.players.p2.characters[0] = ishidroMainTarget;
ishidroMainGame.dispatch({ id: "ishidro-main", type: "activateMain", playerId: "p1", cardId: ishidroMainCard.instanceId });
ishidroMainGame.dispatch({ id: "ishidro-main-target", type: "select", playerId: "p1", cardIds: [ishidroMainTarget.instanceId] });
assert.equal(getEffectiveCost(ishidroMainTarget, ishidroMainTargetDefinition, ishidroMainGame.state), 3, "Ishidro reduces the chosen opposing Character's cost");
assert.equal(ishidroMainCard.state, "rested", "Ishidro rests after its Activate: Main effect resolves");

const magdalenaMain = compileCardEffects({
    id: "POG1-013", name: "Magdalena", cardType: "character", cost: 1, power: 1000,
    effects: [{ id: "POG1-013-activate-main", type: "activateMain" }]
}, cardEffectDefinitions);
const magdalenaMainGame = activationEngine({ [magdalenaMain.id]: magdalenaMain });
const magdalenaMainCard = createCardInstance(magdalenaMain, "p1", "characterArea");
magdalenaMainGame.state.players.p1.characters[0] = magdalenaMainCard;
const unavailableMain = magdalenaMainGame.dispatch({ id: "magdalena-main-unavailable", type: "activateMain", playerId: "p1", cardId: magdalenaMainCard.instanceId });
assert.equal(unavailableMain.status, "failed", "an Activate: Main cost cannot be paid without its required cards");
assert.equal(magdalenaMainGame.state.effectQueue.length, 0, "an unavailable activation does not leave the game blocked");
assert.equal(Object.keys(magdalenaMainCard.oncePerTurn).length, 0, "an unavailable activation does not consume Once Per Turn usage");

const addDonOnPlay = {
    id: "DD01-008", name: "Ayase Momo", cardType: "character", cost: 0, power: 1000,
    effects: [{ id: "DD01-008-on-play-add-don", type: "onPlay", ...onPlayEffectDefinitions["DD01-008-on-play-add-don"] }]
};
const addDonGame = activationEngine({ [addDonOnPlay.id]: addDonOnPlay });
const addDonCard = createCardInstance(addDonOnPlay, "p1", "hand");
addDonGame.state.players.p1.hand.push(addDonCard);
const donDeckBeforeEffect = addDonGame.state.players.p1.donDeck;
addDonGame.dispatch({ id: "on-play-add-don", type: "playCard", playerId: "p1", cardId: addDonCard.instanceId });
assert.equal(addDonGame.state.pendingActivation?.effectId, "DD01-008-on-play-add-don");
addDonGame.dispatch({ id: "on-play-add-don-confirm", type: "activationChoice", playerId: "p1", activate: true });
assert.equal(addDonGame.state.players.p1.donDeck, donDeckBeforeEffect - 1);
assert.equal(addDonGame.state.players.p1.restedDon, 1, "On Play adds the DON!! rested");

const restCharacterOnPlay = {
    id: "DD01-009", name: "Sakata Kinta", cardType: "character", cost: 0, power: 3000,
    effects: [{ id: "DD01-009-on-play-rest-character", type: "onPlay", ...onPlayEffectDefinitions["DD01-009-on-play-rest-character"] }]
};
const restCharacterGame = activationEngine({ [restCharacterOnPlay.id]: restCharacterOnPlay });
const restSource = createCardInstance(restCharacterOnPlay, "p1", "hand");
const restTarget = createCardInstance({ ...vanilla, cost: 4 }, "p2", "characterArea");
restCharacterGame.state.players.p1.hand.push(restSource);
restCharacterGame.state.players.p2.characters[0] = restTarget;
restCharacterGame.dispatch({ id: "on-play-rest-character", type: "playCard", playerId: "p1", cardId: restSource.instanceId });
assert.deepEqual(restCharacterGame.state.pendingSelection?.validCardIds, [restTarget.instanceId]);
assert.equal(restCharacterGame.dispatch({ id: "opponent-cannot-choose-rest", type: "select", playerId: "p2", cardIds: [restTarget.instanceId] }).status, "failed");
restCharacterGame.dispatch({ id: "on-play-rest-select", type: "select", playerId: "p1", cardIds: [restTarget.instanceId] });
assert.equal(restTarget.state, "rested", "On Play may rest an eligible opposing Character");

const koOnPlay = {
    id: "BK01-009", name: "Serpico", cardType: "character", cost: 0, power: 1000,
    effects: [{ id: "BK01-009-on-play-ko-cost-five", type: "onPlay", ...onPlayEffectDefinitions["BK01-009-on-play-ko-cost-five"] }]
};
const koOnPlayGame = activationEngine({ [koOnPlay.id]: koOnPlay });
const koSource = createCardInstance(koOnPlay, "p1", "hand");
const koVictim = createCardInstance({ ...vanilla, cost: 5 }, "p2", "characterArea");
koOnPlayGame.state.players.p1.hand.push(koSource);
koOnPlayGame.state.players.p2.characters[0] = koVictim;
koOnPlayGame.dispatch({ id: "on-play-ko", type: "playCard", playerId: "p1", cardId: koSource.instanceId });
assert.deepEqual(koOnPlayGame.state.pendingSelection?.validCardIds, [koVictim.instanceId]);
koOnPlayGame.dispatch({ id: "on-play-ko-select", type: "select", playerId: "p1", cardIds: [koVictim.instanceId] });
assert.equal(koOnPlayGame.state.players.p2.characters[0], null, "filtered On Play K.O. resolves through the existing staple");

const multiMain = {
    id: "A-001", name: "Two Main Effects", cardType: "character", cost: 1, power: 1000,
    effects: [
        { id: "main-power", type: "activateMain", oncePerTurn: true, actions: [{ action: "increasePower", target: "source", amount: 1000, duration: "turn" }] },
        { id: "main-draw", trigger: "activateMain", actions: [{ action: "drawCard", player: "self", quantity: 1 }] }
    ]
};
const mainGame = activationEngine({ [multiMain.id]: multiMain });
const mainCard = createCardInstance(multiMain, "p1", "characterArea");
mainGame.state.players.p1.characters[0] = mainCard;
const mainHandBefore = mainGame.state.players.p1.hand.length;
assert.notEqual(mainGame.dispatch({ id: "main-two", type: "activateMain", playerId: "p1", cardId: mainCard.instanceId, effectId: "main-draw" }).status, "failed");
assert.equal(mainGame.state.players.p1.hand.length, mainHandBefore + 1, "the selected Main effect resolves without activating sibling effects");
assert.equal(getEffectivePower(mainCard, multiMain, mainGame.state), 1000);
assert.notEqual(mainGame.dispatch({ id: "main-one", type: "activateMain", playerId: "p1", cardId: mainCard.instanceId, effectId: "main-power" }).status, "failed");
assert.equal(getEffectivePower(mainCard, multiMain, mainGame.state), 2000);
assert.equal(mainGame.dispatch({ id: "main-repeat", type: "activateMain", playerId: "p1", cardId: mainCard.instanceId, effectId: "main-power" }).status, "failed", "Once Per Turn Main effects cannot be repeated");

const optionalWatcher = {
    id: "A-002", name: "Optional Watcher", cardType: "character", cost: 1, power: 1000,
    effects: [{ id: "optional-attack", type: "onOpponentAttack", optional: true, actions: [{ action: "drawCard", player: "self", quantity: 1 }] }]
};
const optionalGame = activationEngine({ [optionalWatcher.id]: optionalWatcher });
const optionalCard = createCardInstance(optionalWatcher, "p2", "characterArea");
optionalGame.state.players.p2.characters[0] = optionalCard;
const optionalHandBefore = optionalGame.state.players.p2.hand.length;
optionalGame.dispatch({ id: "optional-attack", type: "attack", playerId: "p1", attackerId: optionalGame.state.players.p1.leader.instanceId, targetId: optionalGame.state.players.p2.leader.instanceId });
assert.equal(optionalGame.state.pendingActivation?.playerId, "p2", "optional automatic effects ask their controller");
assert.equal(optionalGame.dispatch({ id: "wrong-optional", type: "activationChoice", playerId: "p1", activate: true }).status, "failed", "the opponent cannot answer an effect choice");
optionalGame.dispatch({ id: "skip-optional", type: "activationChoice", playerId: "p2", activate: false });
assert.equal(optionalGame.state.players.p2.hand.length, optionalHandBefore);
assert.equal(optionalGame.state.pendingCombat.window, "counter");

const blockDraw = {
    id: "A-003", name: "Block Draw", cardType: "character", cost: 1, power: 1000, keywords: ["blocker"],
    effects: [{ id: "block-draw", type: "onBlock", actions: [{ action: "drawCard", player: "self", quantity: 1 }] }]
};
const blockGame = activationEngine({ [blockDraw.id]: blockDraw });
const blockDrawCard = createCardInstance(blockDraw, "p2", "characterArea");
blockGame.state.players.p2.characters[0] = blockDrawCard;
const blockHandBefore = blockGame.state.players.p2.hand.length;
blockGame.dispatch({ id: "block-attack", type: "attack", playerId: "p1", attackerId: blockGame.state.players.p1.leader.instanceId, targetId: blockGame.state.players.p2.leader.instanceId });
blockGame.dispatch({ id: "choose-block", type: "blocker", playerId: "p2", blockerId: blockDrawCard.instanceId });
assert.equal(blockGame.state.players.p2.hand.length, blockHandBefore + 1, "On Block resolves before the Counter Step");
assert.equal(blockGame.state.pendingCombat.window, "counter");

const counterEvent = {
    id: "A-004", name: "Counter Event", cardType: "event", cost: 1,
    effects: [{ id: "event-counter", type: "counter", actions: [{ action: "increasePower", target: "battleTarget", amount: 2000, duration: "turn" }] }]
};
const counterGame = activationEngine({ [counterEvent.id]: counterEvent });
counterGame.state.players.p2.life = [createCardInstance(vanilla, "p2", "life")];
counterGame.state.players.p2.activeDon = 1;
const counterEventCard = createCardInstance(counterEvent, "p2", "hand");
counterGame.state.players.p2.hand.push(counterEventCard);
counterGame.dispatch({ id: "counter-event-attack", type: "attack", playerId: "p1", attackerId: counterGame.state.players.p1.leader.instanceId, targetId: counterGame.state.players.p2.leader.instanceId });
assert.notEqual(counterGame.dispatch({ id: "counter-event-use", type: "activateCounterEvent", playerId: "p2", cardId: counterEventCard.instanceId, effectId: "event-counter" }).status, "failed");
assert.equal(counterGame.state.players.p2.activeDon, 0, "Counter Event pays its DON!! cost");
assert.equal(counterGame.state.pendingCombat.window, "counter");
counterGame.dispatch({ id: "counter-event-resolve", type: "resolveBattle", playerId: "p2" });
assert.equal(counterGame.state.players.p2.life.length, 1, "Counter Event power applies to the battle target");

const endOwn = { id: "A-005", name: "Own End", cardType: "character", power: 1000, effects: [{ id: "own-end", type: "endOfYourTurn", actions: [{ action: "drawCard", player: "self", quantity: 1 }] }] };
const endOpponent = { id: "A-006", name: "Opponent End", cardType: "character", power: 1000, effects: [{ id: "opponent-end", type: "endOfOpponentTurn", actions: [{ action: "drawCard", player: "self", quantity: 1 }] }] };
const endGame = activationEngine({ [endOwn.id]: endOwn, [endOpponent.id]: endOpponent }, leader("A-L1"), leader("A-L2"), { autoDraw: false });
endGame.state.players.p1.characters[0] = createCardInstance(endOwn, "p1", "characterArea");
endGame.state.players.p2.characters[0] = createCardInstance(endOpponent, "p2", "characterArea");
const ownEndHand = endGame.state.players.p1.hand.length;
const opponentEndHand = endGame.state.players.p2.hand.length;
endGame.dispatch({ id: "end-timings", type: "advancePhase", playerId: "p1" });
assert.equal(endGame.state.players.p1.hand.length, ownEndHand + 1);
assert.equal(endGame.state.players.p2.hand.length, opponentEndHand + 1, "opponent End Phase timing is recognized separately");

const optionalEnd = { id: "A-005-OPTIONAL", name: "Optional End", cardType: "character", power: 1000, effects: [{ id: "optional-own-end", type: "endOfYourTurn", optional: true, actions: [{ action: "drawCard", player: "self", quantity: 1 }] }] };
const optionalEndGame = activationEngine({ [optionalEnd.id]: optionalEnd }, leader("A-L1"), leader("A-L2"), { autoDraw: false });
optionalEndGame.state.players.p1.characters[0] = createCardInstance(optionalEnd, "p1", "characterArea");
optionalEndGame.dispatch({ id: "optional-end-turn", type: "advancePhase", playerId: "p1" });
assert.equal(optionalEndGame.state.phase, "end", "an optional End Phase effect pauses turn completion");
assert.equal(optionalEndGame.state.pendingActivation?.playerId, "p1", "an optional End Phase effect prompts its controller");
optionalEndGame.dispatch({ id: "optional-end-choice", type: "activationChoice", playerId: "p1", activate: false });
assert.equal(optionalEndGame.state.activePlayerId, "p2", "the next turn begins automatically after the optional End Phase choice");
assert.equal(optionalEndGame.state.phase, "draw", "disabled Auto Draw leaves the next player on Draw Card after the End Phase choice");

const characterWatcherLeader = { id: "A-L3", name: "Character Watcher", cardType: "leader", power: 5000, life: 5, effects: [{ id: "character-play-draw", type: "onCharacterPlay", actions: [{ action: "drawCard", player: "self", quantity: 1 }] }] };
const characterGame = activationEngine({}, characterWatcherLeader, leader("A-L4"));
characterGame.state.players.p1.activeDon = 1;
const playedCharacter = createCardInstance(vanilla, "p1", "hand");
characterGame.state.players.p1.hand.push(playedCharacter);
const characterHandBefore = characterGame.state.players.p1.hand.length;
characterGame.dispatch({ id: "character-play-timing", type: "playCard", playerId: "p1", cardId: playedCharacter.instanceId });
assert.equal(characterGame.state.players.p1.hand.length, characterHandBefore, "character-play activator resolves after the played card leaves hand");

const trashReactive = { id: "A-007", name: "Trash Reactive", cardType: "character", power: 1000, effects: [{ id: "deck-trash-draw", type: "whenTrashedFromDeck", actions: [{ action: "drawCard", player: "self", quantity: 1 }] }] };
const deckTrasher = { id: "A-008", name: "Deck Trasher", cardType: "character", power: 1000, effects: [{ id: "trash-main", type: "activateMain", actions: [{ action: "search", player: "self", deckLocation: "top", quantity: 1, amountTaken: 1, targetArea: "hand", upTo: true, filters: { name: "No Match" } }, { action: "trashRest" }] }] };
const trashGame = activationEngine({ [trashReactive.id]: trashReactive, [deckTrasher.id]: deckTrasher });
trashGame.state.players.p1.deck.unshift(createCardInstance(trashReactive, "p1", "deck"));
trashGame.state.players.p1.characters[0] = createCardInstance(deckTrasher, "p1", "characterArea");
const trashHandBefore = trashGame.state.players.p1.hand.length;
trashGame.dispatch({ id: "trash-from-deck", type: "activateMain", playerId: "p1", cardId: trashGame.state.players.p1.characters[0].instanceId, effectId: "trash-main" });
assert.equal(trashGame.state.players.p1.hand.length, trashHandBefore + 1, "deck-to-trash activator observes action transitions outside action files");

const attackedTarget = { id: "A-009", name: "Attacked Target", cardType: "character", power: 6000, effects: [{ id: "attacked-draw", type: "whenAttacked", actions: [{ action: "drawCard", player: "self", quantity: 1 }] }] };
const attackedGame = activationEngine({ [attackedTarget.id]: attackedTarget });
const attackedCard = createCardInstance(attackedTarget, "p2", "characterArea");
attackedCard.state = "rested";
attackedGame.state.players.p2.characters[0] = attackedCard;
const attackedHandBefore = attackedGame.state.players.p2.hand.length;
attackedGame.dispatch({ id: "when-attacked", type: "attack", playerId: "p1", attackerId: attackedGame.state.players.p1.leader.instanceId, targetId: attackedCard.instanceId });
assert.equal(attackedGame.state.players.p2.hand.length, attackedHandBefore + 1, "When Attacked resolves in the attack effect window");

const damageLeader = { id: "A-L7", name: "Damage Watcher", cardType: "leader", power: 5000, life: 5, effects: [{ id: "damage-draw", type: "onOpponentDealsDamage", actions: [{ action: "drawCard", player: "self", quantity: 1 }] }] };
const damageGame = activationEngine({}, leader("A-L8"), damageLeader);
damageGame.state.players.p2.life = [createCardInstance(vanilla, "p2", "life")];
const damageHandBefore = damageGame.state.players.p2.hand.length;
damageGame.dispatch({ id: "damage-attack", type: "attack", playerId: "p1", attackerId: damageGame.state.players.p1.leader.instanceId, targetId: damageGame.state.players.p2.leader.instanceId });
damageGame.dispatch({ id: "damage-resolve", type: "resolveBattle", playerId: "p2" });
assert.equal(damageGame.state.players.p2.hand.length, damageHandBefore + 2, "damage card and opponent-damage effect both reach hand");

const turnStartLeader = { id: "A-L9", name: "Turn Start", cardType: "leader", power: 5000, life: 5, effects: [{ id: "turn-start-draw", type: "startOfTurn", actions: [{ action: "drawCard", player: "self", quantity: 1 }] }] };
const turnStartGame = activationEngine({}, leader("A-L10"), turnStartLeader);
turnStartGame.state.phase = "end";
const turnStartHandBefore = turnStartGame.state.players.p2.hand.length;
turnStartGame.dispatch({ id: "turn-start", type: "advancePhase", playerId: "p1" });
assert.equal(turnStartGame.state.players.p2.hand.length, turnStartHandBefore + 2, "Start Of Turn resolves before the second player's normal first draw");

const gameStartLeader = { id: "A-L5", name: "Game Start", cardType: "leader", power: 5000, life: 5, effects: [{ id: "start-draw", type: "gameStart", actions: [{ action: "drawCard", player: "self", quantity: 1 }] }] };
const setupDefinitions = { [gameStartLeader.id]: gameStartLeader, "A-L6": leader("A-L6"), [vanilla.id]: vanilla };
const setupGame = createGameEngine({ p1: { name: "P1", leader: gameStartLeader, deck: Array.from({ length: 20 }, () => vanilla) }, p2: { name: "P2", leader: setupDefinitions["A-L6"], deck: Array.from({ length: 20 }, () => vanilla) }, definitions: setupDefinitions, turnOrderChooserId: "p1", random: () => 0.5 });
setupGame.dispatch({ id: "setup-first", type: "chooseFirst", playerId: "p1", firstPlayerId: "p1" });
setupGame.dispatch({ id: "setup-mulligan-p1", type: "mulligan", playerId: "p1", redraw: false });
setupGame.dispatch({ id: "setup-mulligan-p2", type: "mulligan", playerId: "p2", redraw: false });
assert.equal(setupGame.state.players.p1.hand.length, 6, "Game Start activates after Life setup and before the first draw");

console.log("Focused gameplay checks passed.");
