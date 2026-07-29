import assert from "node:assert/strict";
import { createGameEngine, redactStateForPlayer } from "../js/game/engine/gameEngine.js";
import { createCardInstance } from "../js/game/state/gameState.js";
import { lifeModifierActionHandlers } from "../js/game/actions/lifeModifierActions.js";
import { getEffectivePower } from "../js/game/checks/validation.js";
import { cardActionHandlers, drawCard } from "../js/game/actions/cardActions.js";
import { getSupportedActivators, normalizeActivator } from "../js/game/effects/effectActivators.js";
import { getRegisteredActions } from "../js/game/effects/actionRegistry.js";
import { onPlayEffectDefinitions } from "../js/cards/effects/onPlayEffects.js";
import { cardEffectDefinitions } from "../js/cards/effects/cardEffectDefinitions.js";
import { compileCardEffects } from "../js/cards/effects/effectCompiler.js";

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

function command(type, playerId, extra = {}) {
    return engine.dispatch({ id: `${type}-${Math.random()}`, type, playerId, ...extra });
}

assert.equal(command("rollDice", "p1").status, "completed");
assert.equal(command("rollDice", "p2").status, "completed");
assert.equal(engine.state.phase, "chooseFirst");
command("chooseFirst", engine.state.setup.dice.winnerId, { firstPlayerId: "p1" });
command("mulligan", "p1", { redraw: false });
command("mulligan", "p2", { redraw: false });
assert.equal(engine.state.phase, "draw", "refresh completes automatically");
assert.equal(engine.state.players.p1.life.length, 5);
assert.equal(engine.state.players.p1.hand.length, 5, "first player skips first draw");
assert.match(engine.state.logs.at(-2).message, /skips the first-turn draw/);
command("advancePhase", "p1");
assert.equal(engine.state.players.p1.activeDon, 1, "first DON!! phase adds one");
command("advancePhase", "p1");
assert.equal(engine.state.phase, "main");
assert.equal(command("advancePhase", "p2").status, "failed", "out-of-turn phase command rejected");

const turnEngine = createGameEngine({ p1: { name: "P1", leader: definitions["L-1"], deck }, p2: { name: "P2", leader: definitions["L-2"], deck }, definitions, random: () => Math.random() });
turnEngine.state.phase = "draw";
turnEngine.state.firstPlayerId = "p1";
turnEngine.state.activePlayerId = "p2";
turnEngine.state.players.p2.turns = 1;
turnEngine.dispatch({ id: "p2-first-don", type: "advancePhase", playerId: "p2" });
assert.equal(turnEngine.state.players.p2.activeDon, 2, "second player receives 2 DON!! on their first turn");

const secondPlayerDrawEngine = createGameEngine({ p1: { name: "P1", leader: definitions["L-1"], deck }, p2: { name: "P2", leader: definitions["L-2"], deck }, definitions });
secondPlayerDrawEngine.state.firstPlayerId = "p1";
secondPlayerDrawEngine.state.activePlayerId = "p2";
secondPlayerDrawEngine.state.players.p2.turns = 1;
secondPlayerDrawEngine.state.phase = "refresh";
const secondPlayerHandBeforeDraw = secondPlayerDrawEngine.state.players.p2.hand.length;
secondPlayerDrawEngine.dispatch({ id: "p2-first-draw", type: "advancePhase", playerId: "p2" });
assert.equal(secondPlayerDrawEngine.state.players.p2.hand.length, secondPlayerHandBeforeDraw + 1, "second player draws on their first turn");

const refreshEngine = createGameEngine({ p1: { name: "P1", leader: definitions["L-1"], deck }, p2: { name: "P2", leader: definitions["L-2"], deck }, definitions });
refreshEngine.state.phase = "end";
refreshEngine.state.firstPlayerId = "p1";
refreshEngine.state.activePlayerId = "p1";
const refreshCard = createCardInstance(vanilla, "p2", "characterArea");
refreshCard.state = "rested";
refreshCard.attachedDon = 2;
refreshEngine.state.players.p2.characters[0] = refreshCard;
refreshEngine.state.players.p2.restedDon = 1;
const refreshHandBefore = refreshEngine.state.players.p2.hand.length;
refreshEngine.dispatch({ id: "automatic-refresh", type: "advancePhase", playerId: "p1" });
assert.equal(refreshEngine.state.phase, "draw", "next player's refresh advances automatically");
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
command("select", "p1", { cardIds: [engine.state.pendingSelection.validCardIds[0]] });
assert.equal(p1.hand.length, handBeforeSearch + 1);
assert.equal(p1.deck.length, deckBeforeSearch - 1, "unselected search cards return to the deck");

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

function activationEngine(extraDefinitions = {}, p1Leader = leader("A-L1"), p2Leader = leader("A-L2")) {
    const allDefinitions = { [p1Leader.id]: p1Leader, [p2Leader.id]: p2Leader, [vanilla.id]: vanilla, ...extraDefinitions };
    const game = createGameEngine({
        p1: { name: "P1", leader: p1Leader, deck: Array.from({ length: 20 }, () => vanilla) },
        p2: { name: "P2", leader: p2Leader, deck: Array.from({ length: 20 }, () => vanilla) },
        definitions: allDefinitions,
        random: () => 0.5
    });
    game.state.phase = "main";
    game.state.firstPlayerId = "p1";
    game.state.activePlayerId = "p1";
    game.state.turnNumber = 1;
    return game;
}

const registeredActionNames = new Set(getRegisteredActions());
assert.equal(Object.keys(onPlayEffectDefinitions).length, 11, "the first On Play implementation batch is registered separately");
const compiledRegistryProof = compileCardEffects({ id: "REGISTRY", effects: [{ id: "BK01-009-on-play-ko-cost-five", type: "onPlay" }] }, cardEffectDefinitions);
assert.equal(compiledRegistryProof.effects[0].actions[0].action, "cardKO", "the shared card compiler merges activator definitions into JSON cards");
for (const [effectId, implementation] of Object.entries(onPlayEffectDefinitions)) {
    assert.equal(implementation.trigger, "onPlay", `${effectId} stays in the On Play activator module`);
    assert.ok(implementation.actions.length > 0, `${effectId} has executable actions`);
    assert.equal(implementation.actions.every(action => registeredActionNames.has(action.action)), true, `${effectId} uses only registered staple actions`);
}

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
const endGame = activationEngine({ [endOwn.id]: endOwn, [endOpponent.id]: endOpponent });
endGame.state.players.p1.characters[0] = createCardInstance(endOwn, "p1", "characterArea");
endGame.state.players.p2.characters[0] = createCardInstance(endOpponent, "p2", "characterArea");
const ownEndHand = endGame.state.players.p1.hand.length;
const opponentEndHand = endGame.state.players.p2.hand.length;
endGame.dispatch({ id: "end-timings", type: "advancePhase", playerId: "p1" });
assert.equal(endGame.state.players.p1.hand.length, ownEndHand + 1);
assert.equal(endGame.state.players.p2.hand.length, opponentEndHand + 1, "opponent End Phase timing is recognized separately");

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
