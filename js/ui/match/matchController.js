import { createGameEngine } from "../../game/engine/gameEngine.js";
import { findCard } from "../../game/state/zones.js";
import { canUseEffect, getActivatorEffects } from "../../game/effects/effectActivators.js";

const PHASE_LABELS = { refresh: "Advance to Draw", draw: "Advance to DON!!", don: "Advance to Main", main: "End Main Phase", end: "End Turn" };

function cardDefinition(definitions, card) {
    return card?.definitionId ? definitions[card.definitionId] : null;
}

function buildCardElement(card, definitions, hidden, onClick, selected, attackTarget, options = {}) {
    const definition = cardDefinition(definitions, card);
    const element = document.createElement("button");
    element.type = "button";
    element.className = `${options.cardClass || "hand-card"}${selected ? " selected-board-card" : ""}${attackTarget ? " attack-target" : ""}`;
    element.dataset.instanceId = card.instanceId;
    element.title = hidden ? "Hidden card" : `${definition?.name || card.definitionId}${definition?.cost !== undefined ? ` • Cost ${definition.cost}` : ""}`;
    const imageSource = hidden ? "../images/a-misc/card-back-normal.png" : definition?.image;
    if (imageSource) {
        const image = document.createElement("img");
        image.src = imageSource;
        image.alt = hidden ? "Face-down card" : definition.name || card.definitionId;
        image.className = options.imageClass || "hand-card-img";
        if (!hidden) image.addEventListener("mouseenter", () => showPreview(definition));
        element.append(image);
    } else {
        element.textContent = definition?.name || "Card";
    }
    if (hidden) element.classList.add("hidden-card");
    if (card.state === "rested") element.classList.add("board-card-rested");
    element.addEventListener("click", () => onClick(card));
    return element;
}

function buildZoneImage(source, alt, className = "deck-card-img") {
    const image = document.createElement("img");
    image.src = source;
    image.alt = alt;
    image.className = className;
    return image;
}

function buildCountBadge(count, className = "deck-count-badge") {
    const badge = document.createElement("span");
    badge.className = className;
    badge.textContent = String(count);
    return badge;
}

function showPreview(definition) {
    const image = document.getElementById("previewImage");
    const placeholder = document.getElementById("previewPlaceholder");
    if (!image || !definition?.image) return;
    image.src = definition.image;
    image.alt = definition.name || "Card preview";
    image.style.display = "block";
    if (placeholder) placeholder.style.display = "none";
}

function replaceChildren(target, children) {
    if (target) target.replaceChildren(...children);
}

export function mountMatchController({ engine, localPlayerId = null, sendCommand = null, getState = null }) {
    const definitions = engine?.definitions || window.__gameDefinitions;
    let selectedId = null;
    let attackModeId = null;
    let selectionIds = [];
    let selectionKey = null;
    const runtimeMessages = [];
    const stateOf = () => getState ? getState() : engine.state;

    function reportRuntimeIssue(error) {
        const message = error?.message || String(error || "Unknown runtime error.");
        const location = error?.stack?.split("\n")[1]?.trim();
        console.error(error);
        runtimeMessages.push(`Runtime error: ${message}${location ? ` • ${location}` : ""}`);
        if (runtimeMessages.length > 20) runtimeMessages.shift();
        const log = document.getElementById("gameLogMessages");
        if (log) {
            const line = document.createElement("div");
            line.textContent = runtimeMessages.at(-1);
            log.append(line);
            log.scrollTop = log.scrollHeight;
        }
    }

    const dispatch = command => {
        try {
            const result = sendCommand ? sendCommand(command) : engine.dispatch(command);
            if (result?.then) return result.then(value => { render(); return value; }).catch(error => { reportRuntimeIssue(error); return { status: "failed", message: error.message }; });
            render();
            return result;
        } catch (error) {
            reportRuntimeIssue(error);
            return { status: "failed", message: error.message };
        }
    };
    const allowed = playerId => !localPlayerId || playerId === localPlayerId;

    function currentDecisionPlayer(state) {
        return state.pendingSelection?.actingPlayerId || state.pendingActivation?.playerId || state.pendingTrigger?.playerId || state.pendingCombat?.defenderPlayerId || state.activePlayerId || "p1";
    }

    function canAttack(state, location) {
        if (!location || location.playerId !== state.activePlayerId || !["leader", "characterArea"].includes(location.zone)) return false;
        const type = String(definitions[location.card.definitionId]?.cardType || "").toLowerCase();
        return ["leader", "character"].includes(type) && location.card.state === "active" && location.card.playedOnTurn !== state.turnNumber;
    }

    function getAttackTargetIds(state) {
        if (!attackModeId || !canAttack(state, findCard(state, attackModeId))) return [];
        const opponentId = state.activePlayerId === "p1" ? "p2" : "p1";
        const opponent = state.players[opponentId];
        return [opponent.leader, ...opponent.characters.filter(card => card?.state === "rested")].filter(Boolean).map(card => card.instanceId);
    }

    function handleCardClick(card) {
        const state = stateOf();
        const pending = state.pendingSelection;
        if (pending) {
            if (!allowed(pending.actingPlayerId) || !pending.validCardIds.includes(card.instanceId)) return;
            selectionIds = selectionIds.includes(card.instanceId) ? selectionIds.filter(id => id !== card.instanceId) : [...selectionIds, card.instanceId].slice(-pending.amount);
            if (!pending.upTo && selectionIds.length === pending.amount) {
                dispatch({ id: crypto.randomUUID(), type: "select", playerId: pending.actingPlayerId, cardIds: selectionIds });
                selectionIds = [];
            } else render();
            return;
        }
        const location = findCard(state, card.instanceId);
        const actor = currentDecisionPlayer(state);
        if (state.pendingCombat?.window === "blocker" && state.pendingCombat.validBlockerIds?.includes(card.instanceId) && allowed(actor)) {
            dispatch({ id: crypto.randomUUID(), type: "blocker", playerId: actor, blockerId: card.instanceId });
            return;
        }
        if (state.pendingCombat?.window === "counter" && location?.zone === "hand" && location.playerId === actor && allowed(actor)) {
            const definition = definitions[card.definitionId];
            if (Number(definition?.counter || 0) > 0) {
                dispatch({ id: crypto.randomUUID(), type: "counter", playerId: actor, cardId: card.instanceId });
                return;
            }
            if (String(definition?.cardType || "").toLowerCase() === "event" && getActivatorEffects(definition, "counter").length) {
                selectedId = selectedId === card.instanceId ? null : card.instanceId;
                render();
                return;
            }
        }
        if (state.phase === "main" && state.activePlayerId && allowed(state.activePlayerId)) {
            if (attackModeId) {
                if (getAttackTargetIds(state).includes(card.instanceId)) {
                    const attackerId = attackModeId;
                    attackModeId = null;
                    selectedId = null;
                    dispatch({ id: crypto.randomUUID(), type: "attack", playerId: state.activePlayerId, attackerId, targetId: card.instanceId });
                }
                return;
            }
            if (selectedId) {
                const selectedLocation = findCard(state, selectedId);
                if (selectedLocation?.zone === "hand" && location?.playerId === state.activePlayerId) {
                    const selectedType = String(definitions[selectedLocation.card.definitionId]?.cardType || "").toLowerCase();
                    const replacementNeeded = (selectedType === "character" && !state.players[state.activePlayerId].characters.includes(null) && location.zone === "characterArea") || (selectedType === "stage" && state.players[state.activePlayerId].stage?.instanceId === card.instanceId);
                    if (replacementNeeded) {
                        dispatch({ id: crypto.randomUUID(), type: "playCard", playerId: state.activePlayerId, cardId: selectedId, replaceCardId: card.instanceId });
                        selectedId = null;
                        return;
                    }
                }
            }
            selectedId = selectedId === card.instanceId ? null : card.instanceId;
            render();
        }
    }

    function renderPlayer(playerId, visualId) {
        const state = stateOf();
        const player = state.players[playerId];
        const hiddenHand = Boolean(localPlayerId && localPlayerId !== playerId);
        const validIds = state.pendingSelection?.validCardIds || [];
        const attackTargetIds = getAttackTargetIds(state);
        const create = (card, hidden = false) => buildCardElement(
            card,
            definitions,
            hidden,
            handleCardClick,
            validIds.includes(card.instanceId) || selectionIds.includes(card.instanceId) || selectedId === card.instanceId,
            attackTargetIds.includes(card.instanceId)
        );
        const createLife = card => buildCardElement(
            card,
            definitions,
            card.face !== "up",
            handleCardClick,
            validIds.includes(card.instanceId) || selectionIds.includes(card.instanceId) || selectedId === card.instanceId,
            attackTargetIds.includes(card.instanceId),
            { cardClass: "life-card", imageClass: "life-card-img" }
        );
        replaceChildren(document.getElementById(`${visualId}Hand`), player.hand.map(card => create(card, hiddenHand)));
        replaceChildren(document.getElementById(`${visualId}LeaderArea`), player.leader ? [create(player.leader)] : []);
        replaceChildren(document.getElementById(`${visualId}StageArea`), player.stage ? [create(player.stage)] : [document.createTextNode("Stage Card")]);
        document.querySelectorAll(`.character-slot[data-player="${visualId}"]`).forEach((slot, index) => replaceChildren(slot, player.characters[index] ? [create(player.characters[index])] : []));
        const deck = document.getElementById(`${visualId}DeckArea`);
        if (deck) {
            replaceChildren(deck, player.deck.length
                ? [buildZoneImage("../images/a-misc/card-back-normal.png", "Deck"), buildCountBadge(player.deck.length)]
                : [document.createTextNode("Deck (0)")]);
        }
        const donDeck = document.getElementById(`${visualId}DonDeckArea`);
        if (donDeck) {
            replaceChildren(donDeck, player.donDeck
                ? [buildZoneImage("../images/a-misc/card-back-don.png", "DON!! deck"), buildCountBadge(player.donDeck)]
                : [document.createTextNode("DON!! Deck (0)")]);
        }
        const don = document.getElementById(`${visualId}DonArea`);
        if (don) {
            const activeDon = Array.from(
                { length: player.activeDon },
                () => buildZoneImage("../images/a-misc/card-front-don.png", "Active DON!!", "don-card-img")
            );
            const restedDon = Array.from(
                { length: player.restedDon },
                () => buildZoneImage("../images/a-misc/card-front-don.png", "Rested DON!!", "don-card-img rested-don")
            );
            replaceChildren(don, activeDon.length || restedDon.length
                ? [...activeDon, ...restedDon]
                : [document.createTextNode("Cost Area")]);
        }
        const trash = document.getElementById(`${visualId}TrashArea`);
        if (trash) {
            const topCard = player.trash[0];
            const topCardDefinition = cardDefinition(definitions, topCard);
            replaceChildren(trash, topCardDefinition?.image
                ? [buildZoneImage(topCardDefinition.image, topCardDefinition.name || "Top card in Trash"), buildCountBadge(player.trash.length, "trash-count")]
                : [document.createTextNode(`Trash (${player.trash.length})`)]);
        }
        const life = document.getElementById(visualId === "player1" ? "opponentLifeArea" : "lifeArea");
        if (life) {
            const label = document.createElement("span");
            label.className = "life-toggle-text";
            label.textContent = `Life (${player.life.length})`;
            replaceChildren(life, [label, ...player.life.map(createLife)]);
        }
    }

    function addControl(label, handler, disabled = false) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "card-action-button";
        button.textContent = label;
        button.disabled = disabled;
        button.addEventListener("click", handler);
        document.getElementById("battleControls")?.append(button);
    }

    function renderControls() {
        const state = stateOf();
        const controls = document.getElementById("battleControls");
        controls?.replaceChildren();
        const phaseButton = document.getElementById("phaseButton");
        if (!phaseButton) return;
        phaseButton.disabled = false;
        phaseButton.onclick = null;
        if (state.phase === "diceRoll") {
            const playerId = state.setup.dice.p1 === null ? "p1" : "p2";
            phaseButton.textContent = `${state.players[playerId].name}: Roll Die`;
            phaseButton.disabled = !allowed(playerId);
            phaseButton.onclick = () => dispatch({ id: crypto.randomUUID(), type: "rollDice", playerId });
        } else if (state.phase === "chooseFirst") {
            const chooserId = state.setup.turnOrderChooserId || state.setup.dice.winnerId;
            phaseButton.textContent = `${state.players[chooserId].name}: Go First`;
            phaseButton.disabled = !allowed(chooserId);
            phaseButton.onclick = () => dispatch({ id: crypto.randomUUID(), type: "chooseFirst", playerId: chooserId, firstPlayerId: chooserId });
            addControl("Let Opponent Go First", () => dispatch({ id: crypto.randomUUID(), type: "chooseFirst", playerId: chooserId, firstPlayerId: chooserId === "p1" ? "p2" : "p1" }), !allowed(chooserId));
        } else if (state.phase === "mulligan") {
            const playerId = state.setup.mulligan.p1 === null ? "p1" : "p2";
            phaseButton.textContent = `${state.players[playerId].name}: Keep Hand`;
            phaseButton.disabled = !allowed(playerId);
            phaseButton.onclick = () => dispatch({ id: crypto.randomUUID(), type: "mulligan", playerId, redraw: false });
            addControl("Mulligan", () => dispatch({ id: crypto.randomUUID(), type: "mulligan", playerId, redraw: true }), !allowed(playerId));
        } else if (state.phase === "gameOver") {
            phaseButton.textContent = `${state.players[state.winnerId]?.name || "Player"} Wins`;
            phaseButton.disabled = true;
        } else {
            const skipsFirstDraw = state.phase === "refresh" && state.activePlayerId === state.firstPlayerId && state.players[state.activePlayerId].turns === 1;
            const phaseLabel = skipsFirstDraw ? "Skip First-Turn Draw" : PHASE_LABELS[state.phase] || "Wait";
            phaseButton.textContent = `${state.players[state.activePlayerId].name} • ${state.phase.toUpperCase()} • ${phaseLabel}`;
            phaseButton.disabled = !allowed(state.activePlayerId) || Boolean(state.pendingSelection || state.pendingCombat || state.pendingTrigger || state.pendingActivation || state.effectQueue.length || attackModeId);
            phaseButton.onclick = () => dispatch({ id: crypto.randomUUID(), type: "advancePhase", playerId: state.activePlayerId });
        }

        if (state.pendingSelection) {
            if (state.pendingSelection.upTo && state.pendingSelection.area !== "search") addControl("Confirm / Skip Optional Choice", () => { dispatch({ id: crypto.randomUUID(), type: "select", playerId: state.pendingSelection.actingPlayerId, cardIds: selectionIds }); selectionIds = []; }, !allowed(state.pendingSelection.actingPlayerId));
            return;
        }
        if (state.pendingActivation) {
            const pending = state.pendingActivation;
            addControl("Activate Effect", () => dispatch({ id: crypto.randomUUID(), type: "activationChoice", playerId: pending.playerId, activate: true }), !allowed(pending.playerId));
            addControl("Skip Effect", () => dispatch({ id: crypto.randomUUID(), type: "activationChoice", playerId: pending.playerId, activate: false }), !allowed(pending.playerId));
            return;
        }
        if (state.pendingCombat?.window === "blocker") addControl("Do Not Block", () => dispatch({ id: crypto.randomUUID(), type: "blocker", playerId: state.pendingCombat.defenderPlayerId, blockerId: null }), !allowed(state.pendingCombat.defenderPlayerId));
        if (state.pendingCombat?.window === "counter") {
            const defenderId = state.pendingCombat.defenderPlayerId;
            addControl("Resolve Battle", () => dispatch({ id: crypto.randomUUID(), type: "resolveBattle", playerId: defenderId }), !allowed(defenderId));
            const selected = findCard(state, selectedId);
            const definition = definitions[selected?.card.definitionId];
            if (selected?.zone === "hand" && selected.playerId === defenderId && String(definition?.cardType || "").toLowerCase() === "event") {
                const counterEffects = getActivatorEffects(definition, "counter");
                counterEffects.forEach((descriptor, index) => addControl(
                    descriptor.executable ? (counterEffects.length > 1 ? `Activate Counter Effect ${index + 1}` : "Activate Counter Effect") : "Counter Effect Not Implemented",
                    () => dispatch({ id: crypto.randomUUID(), type: "activateCounterEvent", playerId: defenderId, cardId: selectedId, effectId: descriptor.effectId }),
                    !allowed(defenderId) || !descriptor.executable
                ));
                addControl("Cancel Card Selection", () => { selectedId = null; render(); });
            }
        }
        if (state.pendingTrigger) {
            addControl("Activate Trigger", () => dispatch({ id: crypto.randomUUID(), type: "triggerChoice", playerId: state.pendingTrigger.playerId, activate: true }), !allowed(state.pendingTrigger.playerId));
            addControl("Take Life to Hand", () => dispatch({ id: crypto.randomUUID(), type: "triggerChoice", playerId: state.pendingTrigger.playerId, activate: false }), !allowed(state.pendingTrigger.playerId));
        }
        if (attackModeId && !state.pendingCombat) {
            addControl("Choose a Highlighted Attack Target", () => {}, true);
            addControl("Cancel Attack", () => { attackModeId = null; render(); });
            return;
        }
        if (selectedId && state.phase === "main" && !state.pendingCombat) {
            const location = findCard(state, selectedId);
            const actor = state.activePlayerId;
            if (location?.zone === "hand" && location.playerId === actor) {
                const definition = definitions[location.card.definitionId];
                const type = String(definition?.cardType || "").toLowerCase();
                if (type === "event") {
                    const mainEffects = getActivatorEffects(definition, "activateMain");
                    mainEffects.forEach((descriptor, index) => addControl(
                        descriptor.executable ? (mainEffects.length > 1 ? `Play Event: Main ${index + 1}` : "Play Event: Main") : "Main Effect Not Implemented",
                        () => dispatch({ id: crypto.randomUUID(), type: "playCard", playerId: actor, cardId: selectedId, effectId: descriptor.effectId }),
                        !descriptor.executable
                    ));
                    if (!mainEffects.length) addControl("Main Effect Not Implemented", () => {}, true);
                } else {
                    addControl("Play Card", () => dispatch({ id: crypto.randomUUID(), type: "playCard", playerId: actor, cardId: selectedId }));
                }
            }
            if (["leader", "characterArea"].includes(location?.zone) && location.playerId === actor) {
                addControl("Attack", () => { attackModeId = selectedId; render(); }, !canAttack(state, location));
                addControl("Attach 1 DON!!", () => dispatch({ id: crypto.randomUUID(), type: "attachDon", playerId: actor, cardId: selectedId, quantity: 1 }), state.players[actor].activeDon < 1);
            }
            if (["leader", "characterArea", "stage"].includes(location?.zone) && location.playerId === actor) {
                const mainEffects = getActivatorEffects(definitions[location.card.definitionId], "activateMain");
                mainEffects.forEach((descriptor, index) => addControl(
                    descriptor.executable ? (mainEffects.length > 1 ? `Activate Main Effect ${index + 1}` : "Activate Main Effect") : "Main Effect Not Implemented",
                    () => dispatch({ id: crypto.randomUUID(), type: "activateMain", playerId: actor, cardId: selectedId, effectId: descriptor.effectId }),
                    !descriptor.executable || !canUseEffect(location.card, descriptor.effect, descriptor.usageKey, state.turnNumber)
                ));
            }
            addControl("Cancel Card Selection", () => { selectedId = null; render(); });
        }
    }

    function renderSearchSelection(state) {
        document.getElementById("searchSelectionOverlay")?.remove();
        const pending = state.pendingSelection;
        if (pending?.area !== "search" || !allowed(pending.actingPlayerId)) {
            selectionKey = null;
            return;
        }
        if (selectionKey !== pending.id) {
            selectionKey = pending.id;
            selectionIds = [];
        }

        const entry = state.effectQueue.find(item => item.executionId === pending.executionId);
        const cards = entry?.searchBuffer?.cards || [];
        const overlay = document.createElement("div");
        overlay.id = "searchSelectionOverlay";
        overlay.className = "look-top-overlay";

        const popup = document.createElement("div");
        popup.className = "look-top-popup";
        const heading = document.createElement("h2");
        heading.textContent = "Search your deck";
        const help = document.createElement("p");
        help.textContent = `Choose ${pending.upTo ? "up to " : ""}${pending.amount} matching card${pending.amount === 1 ? "" : "s"}.`;
        const grid = document.createElement("div");
        grid.className = "look-top-card-grid";

        for (const card of cards) {
            const definition = cardDefinition(definitions, card);
            const valid = pending.validCardIds.includes(card.instanceId);
            const selected = selectionIds.includes(card.instanceId);
            const button = document.createElement("button");
            button.type = "button";
            button.className = `look-top-card-button${selected ? " selected-look-card" : ""}${valid ? "" : " disabled-choice"}`;
            button.title = valid ? "Select this card" : "This card does not match the search";
            if (definition?.image) button.append(buildZoneImage(definition.image, definition.name || card.definitionId, "look-top-card-img"));
            const name = document.createElement("span");
            name.className = "look-top-card-name";
            name.textContent = definition?.name || card.definitionId || "Card";
            button.append(name);
            button.addEventListener("click", () => {
                if (!valid) {
                    showPreview(definition);
                    return;
                }
                selectionIds = selected
                    ? selectionIds.filter(instanceId => instanceId !== card.instanceId)
                    : [...selectionIds, card.instanceId].slice(-pending.amount);
                render();
            });
            grid.append(button);
        }

        const buttons = document.createElement("div");
        buttons.className = "look-top-buttons";
        const confirm = document.createElement("button");
        confirm.type = "button";
        confirm.className = "look-top-action-button";
        confirm.textContent = selectionIds.length ? "Add Selected Card" : "Take No Card";
        confirm.disabled = (!pending.upTo && selectionIds.length !== pending.amount) || selectionIds.length > pending.amount;
        confirm.addEventListener("click", () => {
            const cardIds = [...selectionIds];
            selectionIds = [];
            selectionKey = null;
            dispatch({ id: crypto.randomUUID(), type: "select", playerId: pending.actingPlayerId, cardIds });
        });
        buttons.append(confirm);
        popup.append(heading, help, grid, buttons);
        overlay.append(popup);
        document.body.append(overlay);
    }

    function render() {
        const state = stateOf();
        if (!state) return;
        renderPlayer("p2", "player2");
        renderPlayer("p1", "player1");
        renderControls();
        renderSearchSelection(state);
        const log = document.getElementById("gameLogMessages");
        if (log) {
            const messages = [...state.logs.map(entry => entry.message), ...runtimeMessages].slice(-50);
            replaceChildren(log, messages.map(message => { const line = document.createElement("div"); line.textContent = message; return line; }));
            log.scrollTop = log.scrollHeight;
        }
        window.__gameState = state;
    }

    document.getElementById("sidebarSortButton")?.addEventListener("click", () => {
        const playerId = localPlayerId || stateOf().activePlayerId || "p1";
        dispatch({ id: crypto.randomUUID(), type: "sortHand", playerId });
    });
    const sortButton = document.getElementById("sidebarSortButton");
    if (sortButton) { sortButton.disabled = false; sortButton.title = "Sort hand"; }
    document.getElementById("sidebarSurrenderButton")?.addEventListener("click", () => {
        const playerId = localPlayerId || stateOf().activePlayerId;
        if (playerId) dispatch({ id: crypto.randomUUID(), type: "surrender", playerId });
    });
    const surrender = document.getElementById("sidebarSurrenderButton");
    if (surrender) { surrender.disabled = false; surrender.title = "Surrender"; }
    window.addEventListener("error", event => reportRuntimeIssue(event.error || `${event.message} (${event.filename}:${event.lineno}:${event.colno})`));
    window.addEventListener("unhandledrejection", event => reportRuntimeIssue(event.reason));
    render();
    return { render };
}

function resolveDeck(deckId) {
    const preset = window.getDeckById(deckId);
    return { name: preset.name, leader: window.leaders[preset.leaderKey], deck: window.parseDeckText ? window.parseDeckText(preset.deckText) : parseDeck(preset.deckText) };
}

function parseDeck(text) {
    return text.trim().split(/\r?\n/).flatMap(line => {
        const match = line.trim().match(/^(\d+)x(.+)$/);
        if (!match) return [];
        const definition = window.cardDatabase[match[2].trim()];
        return definition ? Array(Number(match[1])).fill(definition) : [];
    });
}

export async function initializeLocalMatch() {
    await window.loadCardDatabase();
    const params = new URLSearchParams(location.search);
    const p1 = resolveDeck(params.get("player1Deck"));
    const p2 = resolveDeck(params.get("player2Deck"));
    const definitions = { ...window.cardDatabase, ...window.leaders };
    window.__gameDefinitions = definitions;
    const engine = createGameEngine({ p1: { ...p1, name: "Player 1" }, p2: { ...p2, name: "Player 2" }, definitions, turnOrderChooserId: "p1" });
    window.__gameEngine = engine;
    return mountMatchController({ engine });
}
