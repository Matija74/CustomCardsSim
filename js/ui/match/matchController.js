import { createGameEngine } from "../../game/engine/gameEngine.js";
import { findCard } from "../../game/state/zones.js";
import { canUseEffect, getActivatorEffects } from "../../game/effects/effectActivators.js";
import { getEffectiveCost, getEffectivePower, getPrintedPower } from "../../game/checks/validation.js";
import { hasKeyword } from "../../game/keywords/cardKeywords.js";
import { hasStatePrevention } from "../../game/checks/statePreventions.js";
import { loadGameSettings, normalizeGameSettings } from "../shared/gameSettings.js";

const PHASE_LABELS = { draw: "Draw Card", don: "Draw DON!!", main: "End Turn" };

function cardDefinition(definitions, card) {
    return card?.definitionId ? definitions[card.definitionId] : null;
}

function buildCardElement(card, definitions, hidden, onClick, selected, attackTarget, options = {}) {
    const definition = cardDefinition(definitions, card);
    const element = document.createElement("div");
    const selectionClass = options.selectionClass || "selected-board-card";
    element.className = `${options.cardClass || "hand-card"}${selected ? ` ${selectionClass}` : ""}${attackTarget ? " attack-target" : ""}`;
    element.dataset.instanceId = card.instanceId;
    element.dataset.cardImage = hidden ? "" : definition?.image || "";
    element.dataset.zone = options.zone || "";
    element.title = hidden ? "Hidden card" : `${definition?.name || card.definitionId}${definition?.cost !== undefined ? ` • Cost ${definition.cost}` : ""}`;
    const imageSource = hidden ? "../images/a-misc/card-back-normal.png" : definition?.image;
    let imageElement = null;
    if (imageSource) {
        const image = document.createElement("img");
        imageElement = image;
        image.src = imageSource;
        image.alt = hidden ? "Face-down card" : definition.name || card.definitionId;
        image.className = options.imageClass || "hand-card-img";
        if (!hidden && options.onPreviewEnter) image.addEventListener("mouseenter", () => options.onPreviewEnter(definition));
        if (!hidden && options.onPreviewLeave) image.addEventListener("mouseleave", options.onPreviewLeave);
        element.append(image);
    } else {
        element.textContent = definition?.name || "Card";
    }
    if (hidden) element.classList.add("hidden-card");
    if (card.state === "rested") (options.restOnImage && imageElement ? imageElement : element).classList.add("board-card-rested");
    element.addEventListener("click", event => {
        event.stopPropagation();
        onClick(card);
    });
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
    image.hidden = false;
    if (placeholder) placeholder.style.display = "none";
}

function clearPreview() {
    const image = document.getElementById("previewImage");
    const placeholder = document.getElementById("previewPlaceholder");
    if (image) {
        image.src = "";
        image.alt = "Card preview";
        image.style.display = "none";
        image.hidden = true;
    }
    if (placeholder) placeholder.style.display = "block";
}

function replaceChildren(target, children) {
    if (target) target.replaceChildren(...children);
}

export function mountMatchController({ engine, localPlayerId = null, sendCommand = null, getState = null, settings = null }) {
    const definitions = engine?.definitions || window.__gameDefinitions;
    const gameSettings = normalizeGameSettings(settings || loadGameSettings());
    let selectedId = null;
    let attackModeId = null;
    let replacementId = null;
    let endTurnConfirming = false;
    let selectionIds = [];
    let selectionKey = null;
    let searchOrdering = false;
    let searchOrderIds = [];
    let previousSnapshot = null;
    let previewPinnedId = null;
    const runtimeMessages = [];
    const automaticCommandKeys = new Set();
    const stateOf = () => getState ? getState() : engine.state;

    document.documentElement.dataset.audioEnabled = String(gameSettings.audioEnabled);
    document.documentElement.dataset.soundEffects = String(gameSettings.soundEffects);

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

    function confirmAction(setting, message, action) {
        if (!gameSettings[setting] || typeof globalThis.confirm !== "function" || globalThis.confirm(message)) action();
    }

    function dispatchAutomatic(key, command) {
        if (automaticCommandKeys.has(key)) return false;
        automaticCommandKeys.add(key);
        const result = dispatch(command);
        if (result?.then) result.then(value => {
            if (value?.status === "failed") automaticCommandKeys.delete(key);
        });
        else if (result?.status === "failed") automaticCommandKeys.delete(key);
        return true;
    }

    function highestValueSelection(state, pending) {
        return pending.validCardIds
            .map((instanceId, index) => {
                const location = findCard(state, instanceId);
                const definition = definitions[location?.card.definitionId] || {};
                const hidden = location?.zone === "life" && location.card.face !== "up";
                const card = location?.card;
                return {
                    instanceId,
                    index,
                    cost: hidden || !card ? 0 : getEffectiveCost(card, definition, state),
                    power: hidden || !card ? 0 : getEffectivePower(card, definition, state)
                };
            })
            .sort((first, second) => second.cost - first.cost || second.power - first.power || first.index - second.index)
            .slice(0, pending.amount)
            .map(entry => entry.instanceId);
    }

    function applyAutomaticSettings(state) {
        if (state.pendingTrigger && allowed(state.pendingTrigger.playerId)) {
            if (gameSettings.autoSkipTrigger) {
                return dispatchAutomatic(`skip-trigger:${state.pendingTrigger.id}`, {
                    id: crypto.randomUUID(), type: "triggerChoice", playerId: state.pendingTrigger.playerId, activate: false
                });
            }
            if (!gameSettings.confirmTrigger) {
                return dispatchAutomatic(`activate-trigger:${state.pendingTrigger.id}`, {
                    id: crypto.randomUUID(), type: "triggerChoice", playerId: state.pendingTrigger.playerId, activate: true
                });
            }
        }
        if (gameSettings.autoSelectMaxValue && state.pendingSelection && allowed(state.pendingSelection.actingPlayerId)) {
            const pending = state.pendingSelection;
            return dispatchAutomatic(`select-max:${pending.id}`, {
                id: crypto.randomUUID(),
                type: "select",
                playerId: pending.actingPlayerId,
                cardIds: highestValueSelection(state, pending)
            });
        }
        if (gameSettings.autoSkipBlock && state.pendingCombat?.window === "blocker"
            && allowed(state.pendingCombat.defenderPlayerId)) {
            return dispatchAutomatic(`skip-block:${state.pendingCombat.id}`, {
                id: crypto.randomUUID(), type: "blocker", playerId: state.pendingCombat.defenderPlayerId, blockerId: null
            });
        }
        if (gameSettings.autoDraw && state.phase === "draw" && state.activePlayerId && allowed(state.activePlayerId)) {
            return dispatchAutomatic(`auto-draw:${state.gameId}:${state.turnNumber}:${state.activePlayerId}`, {
                id: crypto.randomUUID(), type: "advancePhase", playerId: state.activePlayerId
            });
        }
        return false;
    }

    function currentDecisionPlayer(state) {
        return state.pendingSelection?.actingPlayerId || state.pendingActivation?.playerId || state.pendingTrigger?.playerId || state.pendingCombat?.defenderPlayerId || state.activePlayerId || "p1";
    }

    function canAttack(state, location, targetId = null) {
        if (!location || location.playerId !== state.activePlayerId || !["leader", "characterArea"].includes(location.zone)) return false;
        const type = String(definitions[location.card.definitionId]?.cardType || "").toLowerCase();
        if (!["leader", "character"].includes(type) || location.card.state !== "active") return false;
        if (hasStatePrevention(state, location.card, "cannotAttack") || hasStatePrevention(state, location.card, "cannotBeRested")) return false;
        if (location.card.playedOnTurn !== state.turnNumber || hasKeyword(state, definitions, location.card, "rush")) return true;
        if (!hasKeyword(state, definitions, location.card, "rush: characters")) return false;
        return targetId ? findCard(state, targetId)?.zone === "characterArea" : true;
    }

    function getAttackTargetIds(state) {
        if (!attackModeId || !canAttack(state, findCard(state, attackModeId))) return [];
        const opponentId = state.activePlayerId === "p1" ? "p2" : "p1";
        const opponent = state.players[opponentId];
        return [opponent.leader, ...opponent.characters.filter(card => card?.state === "rested")]
            .filter(card => card && canAttack(state, findCard(state, attackModeId), card.instanceId))
            .map(card => card.instanceId);
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
        if (replacementId) {
            const replacement = findCard(state, replacementId);
            const replacementType = String(definitions[replacement?.card.definitionId]?.cardType || "").toLowerCase();
            const validCharacter = replacementType === "character" && location?.playerId === replacement.playerId && location.zone === "characterArea";
            const validStage = replacementType === "stage" && location?.playerId === replacement.playerId && location.zone === "stage";
            if (validCharacter || validStage) {
                const cardId = replacementId;
                replacementId = null;
                selectedId = null;
                previewPinnedId = null;
                dispatch({ id: crypto.randomUUID(), type: "playCard", playerId: replacement.playerId, cardId, replaceCardId: card.instanceId });
            }
            return;
        }
        if (state.pendingCombat?.window === "blocker" && state.pendingCombat.validBlockerIds?.includes(card.instanceId) && allowed(actor)) {
            dispatch({ id: crypto.randomUUID(), type: "blocker", playerId: actor, blockerId: card.instanceId });
            return;
        }
        if (state.pendingCombat?.window === "counter" && location?.zone === "hand" && location.playerId === actor && allowed(actor)) {
            const definition = definitions[card.definitionId];
            if (Number(definition?.counter || 0) > 0 || (String(definition?.cardType || "").toLowerCase() === "event" && getActivatorEffects(definition, "counter").length)) {
                selectedId = selectedId === card.instanceId ? null : card.instanceId;
                previewPinnedId = selectedId;
                if (selectedId) showPreview(definition);
                else clearPreview();
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
            const deselecting = selectedId === card.instanceId;
            selectedId = deselecting ? null : card.instanceId;
            previewPinnedId = selectedId;
            if (selectedId) showPreview(definitions[card.definitionId]);
            else clearPreview();
            render();
        }
    }

    function previewEnter(definition) {
        if (!previewPinnedId) showPreview(definition);
    }

    function previewLeave() {
        if (!previewPinnedId) clearPreview();
    }

    function actionButton(label, handler, className = "card-action-button-on-card", disabled = false, title = "") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        button.disabled = disabled;
        if (title) button.title = title;
        button.addEventListener("click", event => {
            event.stopPropagation();
            if (!button.disabled) handler();
        });
        return button;
    }

    function clearCardSelection() {
        selectedId = null;
        previewPinnedId = null;
        replacementId = null;
        clearPreview();
    }

    function beginPlayCard(location, effectId = null) {
        const state = stateOf();
        const definition = definitions[location.card.definitionId];
        const type = String(definition?.cardType || "").toLowerCase();
        const player = state.players[location.playerId];
        const needsReplacement = (type === "character" && !player.characters.includes(null)) || (type === "stage" && player.stage);
        if (needsReplacement) {
            replacementId = location.card.instanceId;
            render();
            return;
        }
        const command = { id: crypto.randomUUID(), type: "playCard", playerId: location.playerId, cardId: location.card.instanceId };
        if (effectId) command.effectId = effectId;
        clearCardSelection();
        dispatch(command);
    }

    function appendBoardBadges(element, card, definition, state) {
        const printedPower = getPrintedPower(definition);
        if (printedPower || String(definition?.cardType || "").toLowerCase() === "leader") {
            const base = document.createElement("span");
            base.className = "base-power-badge";
            base.textContent = String(printedPower);
            element.append(base);
            const effectivePower = getEffectivePower(card, definition, state);
            if (effectivePower !== printedPower) {
                const modifier = document.createElement("span");
                modifier.className = `power-modifier-badge ${effectivePower > printedPower ? "power-modifier-positive" : "power-modifier-negative"}`;
                modifier.textContent = String(effectivePower);
                element.append(modifier);
            }
        }
        const attached = document.createElement("span");
        attached.className = `attached-don-badge${card.attachedDon ? "" : " attached-don-empty"}`;
        attached.textContent = `DON!! ${Number(card.attachedDon || 0)}`;
        element.append(attached);
    }

    function appendSelectedActions(element, card, location) {
        const state = stateOf();
        if (selectedId !== card.instanceId || !location || !allowed(location.playerId)) return;
        const definition = definitions[card.definitionId];
        const type = String(definition?.cardType || "").toLowerCase();
        if (state.pendingCombat?.window === "counter" && location.zone === "hand" && location.playerId === state.pendingCombat.defenderPlayerId) {
            const counter = Number(definition?.counter || 0);
            if (counter > 0) {
                element.append(actionButton(`Counter +${counter}`, () => {
                    confirmAction("confirmCounter", `Use ${definition?.name || "this card"} as a +${counter} Counter?`, () => {
                        clearCardSelection();
                        dispatch({ id: crypto.randomUUID(), type: "counter", playerId: location.playerId, cardId: card.instanceId });
                    });
                }));
            }
            getActivatorEffects(definition, "counter").forEach((descriptor, index) => element.append(actionButton(
                descriptor.executable ? (index ? `Counter Effect ${index + 1}` : "Counter Effect") : "Not Implemented",
                () => {
                    confirmAction("confirmCounter", `Activate ${definition?.name || "this Event"}'s Counter effect?`, () => {
                        clearCardSelection();
                        dispatch({ id: crypto.randomUUID(), type: "activateCounterEvent", playerId: location.playerId, cardId: card.instanceId, effectId: descriptor.effectId });
                    });
                },
                "card-action-button-on-card",
                !descriptor.executable
            )));
            [...element.querySelectorAll(".card-action-button-on-card")].forEach((button, index) => { button.style.bottom = `${8 + (index * 35)}px`; });
            return;
        }
        if (state.phase !== "main" || state.activePlayerId !== location.playerId || state.pendingCombat) return;
        if (location.zone === "hand") {
            const cost = getEffectiveCost(card, definition, state);
            const unaffordable = state.players[location.playerId].activeDon < cost;
            if (type === "event") {
                const effects = getActivatorEffects(definition, "activateMain");
                effects.forEach((descriptor, index) => element.append(actionButton(
                    descriptor.executable ? `${effects.length > 1 ? `Main ${index + 1}` : "Play"} ${cost}` : "Not Implemented",
                    () => beginPlayCard(location, descriptor.effectId),
                    "card-action-button-on-card",
                    unaffordable || !descriptor.executable,
                    unaffordable ? `Requires ${cost} active DON!!.` : ""
                )));
                if (!effects.length) element.append(actionButton("Counter Only", () => {}, "card-action-button-on-card", true));
            } else {
                const player = state.players[location.playerId];
                const replacement = (type === "character" && !player.characters.includes(null)) || (type === "stage" && player.stage);
                element.append(actionButton(
                    `${replacement ? "Replace" : type === "stage" ? "Stage" : "Play"} ${cost}`,
                    () => beginPlayCard(location),
                    "card-action-button-on-card",
                    unaffordable,
                    unaffordable ? `Requires ${cost} active DON!!.` : replacement ? "Choose the card to replace." : ""
                ));
            }
            [...element.querySelectorAll(".card-action-button-on-card")].forEach((button, index) => { button.style.bottom = `${8 + (index * 35)}px`; });
            return;
        }
        if (["leader", "characterArea"].includes(location.zone)) {
            element.append(actionButton("Attack", () => {
                attackModeId = card.instanceId;
                selectedId = null;
                previewPinnedId = card.instanceId;
                render();
            }, "board-action-button-on-card attack-action-button", !canAttack(state, location), "Choose an opposing Leader or rested Character."));
            element.append(actionButton("Attach DON", () => dispatch({ id: crypto.randomUUID(), type: "attachDon", playerId: location.playerId, cardId: card.instanceId, quantity: 1 }), "board-action-button-on-card attach-don-button", state.players[location.playerId].activeDon < 1));
        }
        if (["leader", "characterArea", "stage"].includes(location.zone)) {
            getActivatorEffects(definition, "activateMain").forEach((descriptor, index) => element.append(actionButton(
                descriptor.executable ? (index ? `Activate Main ${index + 1}` : "Activate Main") : "Not Implemented",
                () => dispatch({ id: crypto.randomUUID(), type: "activateMain", playerId: location.playerId, cardId: card.instanceId, effectId: descriptor.effectId }),
                "board-action-button-on-card activate-main-button",
                !descriptor.executable || !canUseEffect(card, descriptor.effect, descriptor.usageKey, state.turnNumber)
            )));
        }
        [...element.querySelectorAll(".board-action-button-on-card")].forEach((button, index) => { button.style.bottom = `${8 + (index * 35)}px`; });
    }

    function applyTransitionClass(element, card, location) {
        if (!previousSnapshot) return;
        const key = card.instanceId;
        const previous = previousSnapshot.cards.get(key);
        if (!previous && location.zone === "hand") element.classList.add("card-drawn-animation");
        if (!previous && ["leader", "characterArea", "stage"].includes(location.zone)) element.querySelector("img")?.classList.add("card-played-animation");
        if (previous?.state !== card.state) element.querySelector("img")?.classList.add(card.state === "rested" ? "card-rest-transition" : "card-ready-transition");
    }

    function renderPlayer(playerId, visualId) {
        const state = stateOf();
        const player = state.players[playerId];
        const hiddenHand = Boolean(localPlayerId && localPlayerId !== playerId);
        const validIds = state.pendingSelection?.validCardIds || [];
        const attackTargetIds = getAttackTargetIds(state);
        const create = (card, hidden = false, zone = findCard(state, card.instanceId)?.zone) => {
            const location = findCard(state, card.instanceId);
            const isHand = zone === "hand";
            const element = buildCardElement(
                card, definitions, hidden, handleCardClick,
                validIds.includes(card.instanceId) || selectionIds.includes(card.instanceId) || selectedId === card.instanceId,
                attackTargetIds.includes(card.instanceId),
                { zone, cardClass: isHand ? "hand-card" : "board-card-shell", selectionClass: isHand ? "selected-card" : "selected-board-card", imageClass: isHand ? "hand-card-img" : zone === "leader" ? "leader-card-img board-leader-card" : zone === "stage" ? "deck-card-img board-card-img" : "hand-card-img board-card-img board-character-card", restOnImage: !isHand, onPreviewEnter: previewEnter, onPreviewLeave: previewLeave }
            );
            if (state.pendingCombat?.window === "blocker" && state.pendingCombat.validBlockerIds?.includes(card.instanceId)) element.classList.add("blocker-target");
            if (!hidden && ["leader", "characterArea"].includes(zone)) appendBoardBadges(element, card, definitions[card.definitionId], state);
            if (!hidden) appendSelectedActions(element, card, location);
            if (attackModeId === card.instanceId) element.append(actionButton("Cancel Attack", () => { attackModeId = null; previewPinnedId = null; clearPreview(); render(); }, "board-action-button-on-card cancel-attack-button-on-card"));
            applyTransitionClass(element, card, location);
            return element;
        };
        const createLife = card => buildCardElement(card, definitions, card.face !== "up", handleCardClick, validIds.includes(card.instanceId) || selectionIds.includes(card.instanceId), false, { cardClass: "life-card", imageClass: "life-card-img", zone: "life", onPreviewEnter: previewEnter, onPreviewLeave: previewLeave });
        const handCards = player.hand.map(card => create(card, hiddenHand, "hand"));
        const handCount = document.createElement("div");
        handCount.className = "hand-count";
        handCount.textContent = String(player.hand.length);
        replaceChildren(document.getElementById(`${visualId}Hand`), [...handCards, handCount]);
        replaceChildren(document.getElementById(`${visualId}LeaderArea`), player.leader ? [create(player.leader, false, "leader")] : []);
        const stageArea = document.getElementById(`${visualId}StageArea`);
        replaceChildren(stageArea, player.stage ? [create(player.stage, false, "stage")] : [document.createTextNode("Stage Card")]);
        stageArea?.classList.toggle("replace-target", replacementId && String(definitions[findCard(state, replacementId)?.card.definitionId]?.cardType || "").toLowerCase() === "stage" && player.stage && findCard(state, replacementId)?.playerId === playerId);
        document.querySelectorAll(`.character-slot[data-player="${visualId}"]`).forEach((slot, index) => {
            const card = player.characters[index];
            replaceChildren(slot, card ? [create(card, false, "characterArea")] : []);
            slot.classList.toggle("occupied-slot", Boolean(card));
            slot.classList.toggle("replace-target", Boolean(card && replacementId && findCard(state, replacementId)?.playerId === playerId && String(definitions[findCard(state, replacementId)?.card.definitionId]?.cardType || "").toLowerCase() === "character"));
        });
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
            trash.classList.toggle("clickable-trash", player.trash.length > 0);
            trash.onclick = player.trash.length ? () => showTrashViewer(playerId) : null;
        }
        const life = document.getElementById(visualId === "player1" ? "opponentLifeArea" : "lifeArea");
        if (life) {
            const label = document.createElement("span");
            label.className = "life-toggle-text";
            label.textContent = `Life (${player.life.length})`;
            replaceChildren(life, [label, ...player.life.map(createLife)]);
            life.onclick = event => {
                if (event.target.closest(".life-card") && state.pendingSelection) return;
                life.classList.toggle("open");
                label.textContent = life.classList.contains("open") ? `Life (${player.life.length}) View Locked` : `Life (${player.life.length})`;
            };
        }
    }

    function addControl(label, handler, disabled = false, extraClass = "") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `battle-button${extraClass ? ` ${extraClass}` : ""}`;
        button.textContent = label;
        button.disabled = disabled;
        button.addEventListener("click", handler);
        document.getElementById("battleControls")?.append(button);
    }

    function addPhaseChoice(label, handler, disabled = false) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "phase-button";
        button.textContent = label;
        button.disabled = disabled;
        button.addEventListener("click", handler);
        let choices = document.querySelector(".phase-controls > .choice-buttons");
        if (!choices) {
            choices = document.createElement("div");
            choices.className = "choice-buttons";
            document.querySelector(".phase-controls")?.append(choices);
        }
        choices.append(button);
    }

    function renderControls() {
        const state = stateOf();
        const battleControls = document.getElementById("battleControls");
        battleControls?.replaceChildren();
        document.querySelector(".phase-controls > .choice-buttons")?.remove();
        const phaseButton = document.getElementById("phaseButton");
        if (!phaseButton) return;
        phaseButton.style.display = "block";
        phaseButton.disabled = false;
        phaseButton.onclick = null;

        if (state.phase === "diceRoll") {
            const playerId = state.setup.dice.p1 === null ? "p1" : "p2";
            phaseButton.textContent = `${state.players[playerId].name}: Roll Die`;
            phaseButton.disabled = !allowed(playerId);
            phaseButton.onclick = () => dispatch({ id: crypto.randomUUID(), type: "rollDice", playerId });
        } else if (state.phase === "chooseFirst") {
            const chooserId = state.setup.turnOrderChooserId || state.setup.dice.winnerId || "p1";
            phaseButton.style.display = "none";
            addPhaseChoice("Go 1st", () => dispatch({ id: crypto.randomUUID(), type: "chooseFirst", playerId: chooserId, firstPlayerId: chooserId }), !allowed(chooserId));
            addPhaseChoice("Go 2nd", () => dispatch({ id: crypto.randomUUID(), type: "chooseFirst", playerId: chooserId, firstPlayerId: chooserId === "p1" ? "p2" : "p1" }), !allowed(chooserId));
        } else if (state.phase === "mulligan") {
            const playerId = state.setup.mulligan.p1 === null ? "p1" : "p2";
            phaseButton.style.display = "none";
            addPhaseChoice(`${state.players[playerId].name}: Keep Hand`, () => dispatch({ id: crypto.randomUUID(), type: "mulligan", playerId, redraw: false }), !allowed(playerId));
            addPhaseChoice("Mulligan", () => dispatch({ id: crypto.randomUUID(), type: "mulligan", playerId, redraw: true }), !allowed(playerId));
        } else if (state.phase === "gameOver") {
            phaseButton.textContent = `${state.players[state.winnerId]?.name || "Player"} Wins`;
            phaseButton.disabled = true;
        } else if (["refresh", "end"].includes(state.phase)) {
            phaseButton.style.display = "none";
            phaseButton.disabled = true;
        } else {
            phaseButton.textContent = PHASE_LABELS[state.phase] || "Wait";
            phaseButton.disabled = !allowed(state.activePlayerId) || Boolean(state.pendingSelection || state.pendingCombat || state.pendingTrigger || state.pendingActivation || state.effectQueue.length || attackModeId);
            phaseButton.onclick = () => {
                if (state.phase === "main") {
                    if (gameSettings.confirmEndTurn) {
                        endTurnConfirming = true;
                        render();
                    } else dispatch({ id: crypto.randomUUID(), type: "advancePhase", playerId: state.activePlayerId });
                } else dispatch({ id: crypto.randomUUID(), type: "advancePhase", playerId: state.activePlayerId });
            };
            if (endTurnConfirming && state.phase === "main") {
                phaseButton.style.display = "none";
                addPhaseChoice("Confirm End Turn", () => {
                    endTurnConfirming = false;
                    dispatch({ id: crypto.randomUUID(), type: "advancePhase", playerId: state.activePlayerId });
                }, !allowed(state.activePlayerId));
                addPhaseChoice("Cancel", () => { endTurnConfirming = false; render(); });
            } else if (state.phase !== "main") endTurnConfirming = false;
        }

        if (replacementId) {
            addControl("Choose a highlighted card to replace", () => {}, true);
            addControl("Cancel Replacement", () => { replacementId = null; render(); });
            return;
        }
        if (state.pendingSelection || state.pendingActivation || state.pendingTrigger) return;
        if (state.pendingCombat?.window === "blocker") {
            const defenderId = state.pendingCombat.defenderPlayerId;
            if (allowed(defenderId)) addControl("Skip Block", () => dispatch({ id: crypto.randomUUID(), type: "blocker", playerId: defenderId, blockerId: null }), false, "skip-block");
            else addControl(`Waiting for ${state.players[defenderId].name} to block`, () => {}, true);
        }
        if (state.pendingCombat?.window === "counter") {
            const defenderId = state.pendingCombat.defenderPlayerId;
            if (allowed(defenderId)) addControl("Resolve Attack", () => {
                clearCardSelection();
                dispatch({ id: crypto.randomUUID(), type: "resolveBattle", playerId: defenderId });
            });
            else addControl(`Waiting for ${state.players[defenderId].name}'s counters`, () => {}, true);
        }
        if (attackModeId && !state.pendingCombat) addControl("Choose a highlighted Attack Target", () => {}, true);
    }

    function renderSearchSelection(state) {
        document.getElementById("searchSelectionOverlay")?.remove();
        const pending = state.pendingSelection;
        if (pending?.area !== "search" || !allowed(pending.actingPlayerId)) {
            selectionKey = null;
            searchOrdering = false;
            searchOrderIds = [];
            return;
        }
        if (selectionKey !== pending.id) {
            selectionKey = pending.id;
            selectionIds = [];
            searchOrdering = false;
            searchOrderIds = [];
        }

        const entry = state.effectQueue.find(item => item.executionId === pending.executionId);
        const cards = entry?.searchBuffer?.cards || [];
        const source = effectSource(state, pending.executionId);
        const overlay = document.createElement("div");
        overlay.id = "searchSelectionOverlay";
        overlay.className = "look-top-overlay";

        const popup = document.createElement("div");
        popup.className = "look-top-popup";
        const heading = document.createElement("h2");
        heading.textContent = source.definition?.name || "Search your deck";
        const help = document.createElement("p");
        help.textContent = searchOrdering
            ? `Choose the ${pending.returnRest?.deckLocation || "bottom"} order. Number 1 is placed first.`
            : entry?.effectText || `Choose ${pending.upTo ? "up to " : ""}${pending.amount} matching card${pending.amount === 1 ? "" : "s"}.`;
        const grid = document.createElement("div");
        grid.className = "look-top-card-grid";

        const visibleCards = searchOrdering ? cards.filter(card => !selectionIds.includes(card.instanceId)) : cards;
        for (const card of visibleCards) {
            const definition = cardDefinition(definitions, card);
            const valid = searchOrdering || pending.validCardIds.includes(card.instanceId);
            const selected = searchOrdering ? searchOrderIds.includes(card.instanceId) : selectionIds.includes(card.instanceId);
            const button = document.createElement("button");
            button.type = "button";
            button.className = `look-top-card-button${selected ? " selected-look-card" : ""}${valid ? "" : " disabled-choice"}`;
            button.title = searchOrdering ? "Add this card next in the return order" : valid ? "Select this card" : "This card does not match the search";
            if (definition?.image) button.append(buildZoneImage(definition.image, definition.name || card.definitionId, "look-top-card-img"));
            const name = document.createElement("span");
            name.className = "look-top-card-name";
            const orderIndex = searchOrderIds.indexOf(card.instanceId);
            name.textContent = `${searchOrdering && orderIndex >= 0 ? `${orderIndex + 1}. ` : ""}${definition?.name || card.definitionId || "Card"}`;
            button.append(name);
            button.addEventListener("click", () => {
                if (searchOrdering) {
                    searchOrderIds = selected
                        ? searchOrderIds.filter(instanceId => instanceId !== card.instanceId)
                        : [...searchOrderIds, card.instanceId];
                    render();
                    return;
                }
                if (!valid) {
                    showCardImagePopup(definition);
                    return;
                }
                selectionIds = selected
                    ? selectionIds.filter(instanceId => instanceId !== card.instanceId)
                    : [...selectionIds, card.instanceId].slice(-pending.amount);
                render();
            });
            button.addEventListener("dblclick", event => {
                event.preventDefault();
                showCardImagePopup(definition);
            });
            grid.append(button);
        }

        const buttons = document.createElement("div");
        buttons.className = "look-top-buttons";
        const confirm = document.createElement("button");
        confirm.type = "button";
        confirm.className = "look-top-action-button";
        const remainingIds = cards.filter(card => !selectionIds.includes(card.instanceId)).map(card => card.instanceId);
        confirm.textContent = searchOrdering
            ? `Confirm ${pending.returnRest?.deckLocation || "bottom"} order`
            : selectionIds.length ? `Continue With Selected (${selectionIds.length}/${pending.amount})` : "Take No Card";
        confirm.disabled = searchOrdering
            ? searchOrderIds.length !== remainingIds.length
            : (!pending.upTo && selectionIds.length !== pending.amount) || selectionIds.length > pending.amount;
        confirm.addEventListener("click", () => {
            if (!searchOrdering && pending.returnRest && remainingIds.length > 1) {
                searchOrdering = true;
                searchOrderIds = [];
                render();
                return;
            }
            const cardIds = [...selectionIds];
            const returnOrder = searchOrdering ? [...searchOrderIds] : remainingIds;
            selectionIds = [];
            selectionKey = null;
            searchOrdering = false;
            searchOrderIds = [];
            dispatch({ id: crypto.randomUUID(), type: "select", playerId: pending.actingPlayerId, cardIds, returnOrder });
        });
        buttons.append(confirm);
        if (searchOrdering) {
            const reset = document.createElement("button");
            reset.type = "button";
            reset.className = "look-top-action-button secondary";
            reset.textContent = "Reset Order";
            reset.addEventListener("click", () => { searchOrderIds = []; render(); });
            buttons.append(reset);
        }
        popup.append(heading, help, grid, buttons);
        overlay.append(popup);
        document.body.append(overlay);
    }

    function effectSource(state, executionId, sourceInstanceId) {
        const entry = state.effectQueue.find(item => item.executionId === executionId);
        const instanceId = sourceInstanceId || entry?.sourceInstanceId;
        const card = findCard(state, instanceId)?.card || entry?.sourceSnapshot;
        return { card, definition: cardDefinition(definitions, card), entry };
    }

    function showCardImagePopup(definition) {
        document.getElementById("searchCardImageOverlay")?.remove();
        if (!definition?.image) return;
        const overlay = document.createElement("div");
        overlay.id = "searchCardImageOverlay";
        overlay.className = "look-top-overlay search-card-image-overlay";
        const popup = document.createElement("div");
        popup.className = "search-card-image-popup";
        const image = buildZoneImage(definition.image, definition.name || "Card", "search-card-image-large");
        const title = document.createElement("h3");
        title.textContent = definition.name || definition.id || "Card";
        const buttons = document.createElement("div");
        buttons.className = "search-card-image-buttons";
        const close = document.createElement("button");
        close.className = "look-top-action-button secondary";
        close.textContent = "Close";
        close.addEventListener("click", () => overlay.remove());
        buttons.append(close);
        popup.append(image, title, buttons);
        overlay.append(popup);
        document.body.append(overlay);
    }

    function showTrashViewer(playerId) {
        document.getElementById("trashViewerOverlay")?.remove();
        const player = stateOf().players[playerId];
        if (!player?.trash.length) return;
        const overlay = document.createElement("div");
        overlay.id = "trashViewerOverlay";
        overlay.className = "look-top-overlay";
        const popup = document.createElement("div");
        popup.className = "look-top-popup trash-viewer-popup";
        const title = document.createElement("h2");
        title.textContent = `${player.name}'s Trash`;
        const description = document.createElement("p");
        description.textContent = "Cards are shown from newest to oldest.";
        const grid = document.createElement("div");
        grid.className = "look-top-card-grid trash-viewer-grid";
        player.trash.forEach(card => {
            const definition = cardDefinition(definitions, card);
            const frame = document.createElement("button");
            frame.type = "button";
            frame.className = "look-top-card-button trash-viewer-card";
            if (definition?.image) frame.append(buildZoneImage(definition.image, definition.name || card.definitionId, "look-top-card-img"));
            const name = document.createElement("span");
            name.className = "look-top-card-name";
            name.textContent = definition?.name || card.definitionId;
            frame.append(name);
            frame.addEventListener("click", () => showCardImagePopup(definition));
            grid.append(frame);
        });
        const buttons = document.createElement("div");
        buttons.className = "look-top-buttons";
        const close = document.createElement("button");
        close.className = "look-top-action-button secondary";
        close.textContent = "Close";
        close.addEventListener("click", () => overlay.remove());
        buttons.append(close);
        popup.append(title, description, grid, buttons);
        overlay.append(popup);
        document.body.append(overlay);
    }

    function renderPendingSelection(state) {
        document.getElementById("pendingSelectionOverlay")?.remove();
        const pending = state.pendingSelection;
        if (!pending || pending.area === "search" || !allowed(pending.actingPlayerId)) return;
        if (selectionKey !== pending.id) {
            selectionKey = pending.id;
            selectionIds = [];
        }
        const source = effectSource(state, pending.executionId);
        const cards = pending.validCardIds.map(instanceId => findCard(state, instanceId)?.card).filter(Boolean);
        const overlay = document.createElement("div");
        overlay.id = "pendingSelectionOverlay";
        overlay.className = "look-top-overlay";
        const popup = document.createElement("div");
        popup.className = "look-top-popup";
        const title = document.createElement("h2");
        title.textContent = source.definition?.name || `Choose ${pending.area === "life" ? "a Life card" : "a card"}`;
        const description = document.createElement("p");
        description.textContent = `Choose ${pending.upTo ? "up to " : ""}${pending.amount} card${pending.amount === 1 ? "" : "s"}.`;
        const grid = document.createElement("div");
        grid.className = "look-top-card-grid";
        cards.forEach((card, index) => {
            const definition = cardDefinition(definitions, card);
            const selected = selectionIds.includes(card.instanceId);
            const button = document.createElement("button");
            button.type = "button";
            button.className = `look-top-card-button${selected ? " selected-look-card" : ""}`;
            const hiddenLife = pending.area === "life" && card.face !== "up";
            button.append(buildZoneImage(hiddenLife ? "../images/a-misc/card-back-normal.png" : definition?.image, hiddenLife ? "Life card" : definition?.name || card.definitionId, "look-top-card-img"));
            const name = document.createElement("span");
            name.className = "look-top-card-name";
            name.textContent = hiddenLife ? `Life ${index + 1}` : definition?.name || card.definitionId;
            button.append(name);
            button.addEventListener("click", () => {
                selectionIds = selected ? selectionIds.filter(id => id !== card.instanceId) : [...selectionIds, card.instanceId].slice(-pending.amount);
                render();
            });
            grid.append(button);
        });
        const buttons = document.createElement("div");
        buttons.className = "look-top-buttons";
        const choose = document.createElement("button");
        choose.className = "look-top-action-button";
        choose.textContent = "Choose";
        choose.disabled = selectionIds.length !== pending.amount;
        choose.addEventListener("click", () => {
            const cardIds = [...selectionIds];
            selectionIds = [];
            selectionKey = null;
            dispatch({ id: crypto.randomUUID(), type: "select", playerId: pending.actingPlayerId, cardIds });
        });
        buttons.append(choose);
        if (pending.upTo) {
            const skip = document.createElement("button");
            skip.className = "look-top-action-button secondary";
            skip.textContent = selectionIds.length ? "Choose Selected" : "Skip";
            skip.addEventListener("click", () => {
                const cardIds = [...selectionIds];
                selectionIds = [];
                selectionKey = null;
                dispatch({ id: crypto.randomUUID(), type: "select", playerId: pending.actingPlayerId, cardIds });
            });
            buttons.append(skip);
        }
        popup.append(title, description, grid, buttons);
        overlay.append(popup);
        document.body.append(overlay);
    }

    function renderEffectChoices(state) {
        document.getElementById("effectChoiceOverlay")?.remove();
        const pending = state.pendingActivation || state.pendingTrigger;
        if (!pending || !allowed(pending.playerId)) return;
        const isTrigger = Boolean(state.pendingTrigger);
        const source = isTrigger
            ? { card: pending.card, definition: cardDefinition(definitions, pending.card) }
            : effectSource(state, pending.executionId, pending.sourceInstanceId);
        const overlay = document.createElement("div");
        overlay.id = "effectChoiceOverlay";
        overlay.className = "look-top-overlay";
        const popup = document.createElement("div");
        popup.className = "look-top-popup effect-choice-popup";
        const heading = document.createElement("h2");
        heading.textContent = source.definition?.name || (isTrigger ? "Trigger" : "Choose Effect");
        const body = document.createElement("div");
        body.className = "effect-choice-body";
        if (source.definition?.image) body.append(buildZoneImage(source.definition.image, source.definition.name || "Effect source", "effect-choice-card-img"));
        const content = document.createElement("div");
        content.className = "effect-choice-content";
        const prompt = document.createElement("p");
        prompt.textContent = pending.text || (isTrigger ? "Activate this card's Trigger effect?" : "Activate this optional effect?");
        const buttons = document.createElement("div");
        buttons.className = "look-top-buttons effect-choice-buttons";
        const activate = document.createElement("button");
        activate.className = "look-top-action-button";
        activate.textContent = isTrigger ? "Activate Trigger" : "Activate";
        activate.addEventListener("click", () => dispatch({ id: crypto.randomUUID(), type: isTrigger ? "triggerChoice" : "activationChoice", playerId: pending.playerId, activate: true }));
        const skip = document.createElement("button");
        skip.className = "look-top-action-button secondary";
        skip.textContent = isTrigger ? "Take Life to Hand" : "Skip";
        skip.addEventListener("click", () => dispatch({ id: crypto.randomUUID(), type: isTrigger ? "triggerChoice" : "activationChoice", playerId: pending.playerId, activate: false }));
        buttons.append(activate, skip);
        content.append(prompt, buttons);
        body.append(content);
        popup.append(heading, body);
        overlay.append(popup);
        document.body.append(overlay);
    }

    function drawAttackArrow(state) {
        const overlay = document.getElementById("attackArrowOverlay");
        if (!overlay) return;
        overlay.replaceChildren();
        const combat = state.pendingCombat;
        if (!combat) return;
        const attacker = document.querySelector(`[data-instance-id="${CSS.escape(combat.attackerId)}"]`);
        const target = document.querySelector(`[data-instance-id="${CSS.escape(combat.targetId)}"]`);
        if (!attacker || !target) return;
        const overlayRect = overlay.getBoundingClientRect();
        const attackerRect = attacker.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        overlay.setAttribute("viewBox", `0 0 ${overlayRect.width} ${overlayRect.height}`);
        const svg = "http://www.w3.org/2000/svg";
        const defs = document.createElementNS(svg, "defs");
        const marker = document.createElementNS(svg, "marker");
        marker.setAttribute("id", "attackArrowHead");
        marker.setAttribute("markerWidth", "10");
        marker.setAttribute("markerHeight", "10");
        marker.setAttribute("refX", "8");
        marker.setAttribute("refY", "3");
        marker.setAttribute("orient", "auto");
        const head = document.createElementNS(svg, "path");
        head.setAttribute("d", "M0,0 L0,6 L9,3 z");
        head.setAttribute("class", "attack-arrow-head");
        marker.append(head);
        defs.append(marker);
        const line = document.createElementNS(svg, "line");
        line.setAttribute("x1", String(attackerRect.left + attackerRect.width / 2 - overlayRect.left));
        line.setAttribute("y1", String(attackerRect.top + attackerRect.height / 2 - overlayRect.top));
        line.setAttribute("x2", String(targetRect.left + targetRect.width / 2 - overlayRect.left));
        line.setAttribute("y2", String(targetRect.top + targetRect.height / 2 - overlayRect.top));
        line.setAttribute("class", "attack-arrow-line");
        line.setAttribute("marker-end", "url(#attackArrowHead)");
        overlay.append(defs, line);
    }

    function renderGameOver(state) {
        if (state.phase !== "gameOver") {
            document.getElementById("gameOverOverlay")?.remove();
            return;
        }
        document.getElementById("gameOverOverlay")?.remove();
        const overlay = document.createElement("div");
        overlay.id = "gameOverOverlay";
        overlay.className = "game-over-overlay";
        const popup = document.createElement("div");
        popup.className = "game-over-popup";
        const title = document.createElement("h2");
        title.textContent = "Game Over";
        const message = document.createElement("p");
        message.textContent = `${state.players[state.winnerId]?.name || "Player"} wins!`;
        const reason = document.createElement("p");
        reason.className = "game-over-reason-text";
        reason.textContent = state.winReason || "The match has ended.";
        const buttons = document.createElement("div");
        buttons.className = "game-over-buttons";
        const menu = document.createElement("a");
        menu.className = "game-over-button main-menu";
        menu.href = "../index.html";
        menu.textContent = "Main Menu";
        const again = document.createElement("button");
        again.className = "game-over-button play-again";
        const waitingForRematch = Boolean(localPlayerId && state.rematchRequests?.[localPlayerId]);
        again.textContent = waitingForRematch ? "Waiting for Opponent" : "Play Again";
        again.disabled = waitingForRematch;
        again.addEventListener("click", () => {
            if (!localPlayerId) {
                location.reload();
                return;
            }
            dispatch({ id: crypto.randomUUID(), type: "requestRematch", playerId: localPlayerId });
        });
        buttons.append(menu, again);
        popup.append(title, message, reason, buttons);
        overlay.append(popup);
        document.body.append(overlay);
    }

    function showSurrenderConfirmation() {
        document.getElementById("surrenderConfirmOverlay")?.remove();
        const playerId = localPlayerId || stateOf().activePlayerId;
        if (!playerId || stateOf().phase === "gameOver") return;
        const overlay = document.createElement("div");
        overlay.id = "surrenderConfirmOverlay";
        overlay.className = "look-top-overlay";
        const popup = document.createElement("div");
        popup.className = "look-top-popup effect-choice-popup surrender-confirm-popup";
        const heading = document.createElement("h2");
        heading.textContent = "Surrender Match";
        const text = document.createElement("p");
        text.textContent = "Are you sure you want to surrender? Your opponent will win the match.";
        const buttons = document.createElement("div");
        buttons.className = "surrender-confirm-actions look-top-buttons";
        const cancel = document.createElement("button");
        cancel.className = "look-top-action-button secondary";
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", () => overlay.remove());
        const confirm = document.createElement("button");
        confirm.className = "look-top-action-button danger";
        confirm.textContent = "Surrender";
        confirm.addEventListener("click", () => {
            overlay.remove();
            dispatch({ id: crypto.randomUUID(), type: "surrender", playerId });
        });
        buttons.append(cancel, confirm);
        popup.append(heading, text, buttons);
        overlay.append(popup);
        document.body.append(overlay);
    }

    function updatePlayerRails(state, topPlayerId, bottomPlayerId) {
        const topName = document.getElementById("player2Name");
        const bottomName = document.getElementById("player1Name");
        const topStatus = document.getElementById("player2Status");
        const bottomStatus = document.getElementById("player1Status");
        if (topName) topName.textContent = state.players[topPlayerId].name;
        if (bottomName) bottomName.textContent = state.players[bottomPlayerId].name;
        const statusFor = playerId => state.phase === "gameOver" ? (state.winnerId === playerId ? "Winner" : "Match finished") : state.activePlayerId === playerId ? `${state.phase.toUpperCase()} • Active player` : "Waiting";
        if (topStatus) topStatus.textContent = statusFor(topPlayerId);
        if (bottomStatus) bottomStatus.textContent = statusFor(bottomPlayerId);
    }

    function snapshotState(state) {
        const cards = new Map();
        Object.values(state.players).forEach(player => [player.leader, player.stage, ...player.characters, ...player.hand, ...player.life, ...player.trash].filter(Boolean).forEach(card => cards.set(card.instanceId, { state: card.state, zone: card.zone })));
        return { cards };
    }

    function render() {
        const state = stateOf();
        if (!state) return;
        if (applyAutomaticSettings(state)) return;
        if (selectedId && !findCard(state, selectedId)) clearCardSelection();
        if (attackModeId && !findCard(state, attackModeId)) attackModeId = null;
        const bottomPlayerId = localPlayerId || "p1";
        const topPlayerId = bottomPlayerId === "p1" ? "p2" : "p1";
        renderPlayer(topPlayerId, "player2");
        renderPlayer(bottomPlayerId, "player1");
        updatePlayerRails(state, topPlayerId, bottomPlayerId);
        renderControls();
        renderSearchSelection(state);
        renderPendingSelection(state);
        renderEffectChoices(state);
        renderGameOver(state);
        requestAnimationFrame(() => drawAttackArrow(state));
        const log = document.getElementById("gameLogMessages");
        if (log) {
            const messages = [...state.logs.map(entry => entry.message), ...runtimeMessages].slice(-50);
            replaceChildren(log, messages.map(message => { const line = document.createElement("div"); line.textContent = message; return line; }));
            log.scrollTop = log.scrollHeight;
        }
        previousSnapshot = snapshotState(state);
        window.__gameState = state;
    }

    document.getElementById("sidebarSortButton")?.addEventListener("click", () => {
        const playerId = localPlayerId || stateOf().activePlayerId || "p1";
        dispatch({ id: crypto.randomUUID(), type: "sortHand", playerId });
    });
    const sortButton = document.getElementById("sidebarSortButton");
    if (sortButton) { sortButton.disabled = false; sortButton.title = "Sort hand"; }
    document.getElementById("sidebarSurrenderButton")?.addEventListener("click", () => {
        showSurrenderConfirmation();
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
    const engine = createGameEngine({ p1: { ...p1, name: "Player 1" }, p2: { ...p2, name: "Player 2" }, definitions, turnOrderChooserId: "p1", autoDraw: false });
    window.__gameEngine = engine;
    return mountMatchController({ engine });
}
