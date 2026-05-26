import {
    signInGuest,
    waitForUser
} from "../firebase/firebaseApp.js";

import {
    getMatch,
    rollMultiplayerDice,
    chooseMultiplayerTurnOrder,
    setMultiplayerMulligan,
    setPlayerDeck,
    setPlayerReady,
    startMatch,
    subscribeToMatch,
    subscribeToPrivateState,
    updatePublicState
} from "../firebase/multiplayerService.js";

const deckSelectionStorageKey = "customCardsDeckSelection";

let currentUser = null;
let roomCode = null;
let localSlot = null;
let ownPrivateState = null;
let latestPublicMatch = null;
let unsubscribeMatch = null;
let unsubscribePrivate = null;
let syncTimer = null;
let revisionCounter = 0;
let lastAppliedSharedRevision = null;
let lastSubmittedSharedRevision = null;
let initializingSharedState = false;
let lastDiceRenderKey = null;

window.__multiplayerRuntime = {
    getLocalSlot: () => localSlot,
    isActive: () => Boolean(roomCode && localSlot),
    scheduleStateSync
};

function cloneValue(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

function getOpponentSlot(slot) {
    return slot === "p1" ? "p2" : "p1";
}

function getPageApi() {
    return window.multiplayerPageApi || null;
}

function addRuntimeLog(message) {
    const gameLogMessages = document.getElementById("gameLogMessages");

    if (!gameLogMessages || !message) {
        return;
    }

    const entry = document.createElement("div");

    entry.className = "log-message";
    entry.textContent = message;
    gameLogMessages.appendChild(entry);
    gameLogMessages.scrollTop = gameLogMessages.scrollHeight;
}

function reportRuntimeError(prefix, error) {
    const message = error?.message || String(error);

    console.error(prefix, error);
    addRuntimeLog(`${prefix}: ${message}`);
}

async function runPregameAction(prefix, action) {
    try {
        await action();
    } catch (error) {
        reportRuntimeError(prefix, error);
    }
}

function getSavedDeckDefinition() {
    const availableDecks = window.getAvailableDecks?.() || [];
    const defaultDeck = availableDecks[0] || null;

    if (availableDecks.length === 0) {
        return null;
    }

    try {
        const saved = JSON.parse(localStorage.getItem(deckSelectionStorageKey) || "{}");
        const requestedDeckId = localSlot === "p2"
            ? saved.player2DeckId || saved.player1DeckId
            : saved.player1DeckId || saved.player2DeckId;

        return window.getDeckById?.(requestedDeckId) || defaultDeck;
    } catch (error) {
        return defaultDeck;
    }
}

function createHiddenCards(count) {
    return Array.from({ length: Math.max(0, Number(count || 0)) }, () => ({}));
}

function buildPlayerState(playerEntry, publicPlayerState, privateState, useOwnHiddenData) {
    return {
        name: playerEntry?.name || "Player",
        don: Number(publicPlayerState?.activeDon || 0),
        restedDon: Number(publicPlayerState?.restedDon || 0),
        donDeck: Number(publicPlayerState?.donDeckCount ?? 10),
        turns: Number(publicPlayerState?.turns || 0),
        deck: useOwnHiddenData
            ? cloneValue(privateState?.deck || [])
            : createHiddenCards(publicPlayerState?.deckCount || 0),
        deckName: privateState?.selectedDeck?.name || "",
        hasMulliganed: false,
        hand: useOwnHiddenData
            ? cloneValue(privateState?.hand || [])
            : createHiddenCards(publicPlayerState?.handCount || 0),
        life: useOwnHiddenData
            ? cloneValue(privateState?.life || [])
            : createHiddenCards(publicPlayerState?.lifeCount || 0),
        trash: cloneValue(publicPlayerState?.trash || []),
        leader: cloneValue(privateState?.leader || publicPlayerState?.leader || null),
        characters: cloneValue(publicPlayerState?.characters || []),
        stage: cloneValue(privateState?.stage || publicPlayerState?.stage || null),
        leaderAttacksThisTurn: 0
    };
}

function buildSnapshotFromRoom(match, privateState, options = {}) {
    const players = match?.players || {};
    const publicState = match?.public || {};
    const localPublicKey = localSlot === "p1" ? "player1" : "player2";
    const opponentSlot = getOpponentSlot(localSlot);
    const opponentPublicKey = opponentSlot === "p1" ? "player1" : "player2";

    return {
        players: {
            [localSlot]: buildPlayerState(
                players[localSlot],
                publicState[localPublicKey],
                privateState,
                true
            ),
            [opponentSlot]: buildPlayerState(
                players[opponentSlot],
                publicState[opponentPublicKey],
                null,
                false
            )
        },
        diceWinnerSlot: publicState.setup?.dice?.winner || null,
        firstPlayerSlot: publicState.firstPlayer || publicState.setup?.turnChoice?.firstPlayer || null,
        secondPlayerSlot: publicState.secondPlayer || publicState.setup?.turnChoice?.secondPlayer || null,
        currentPlayerSlot: publicState.currentPlayer || null,
        turnNumber: Number(publicState.turnNumber || 1),
        currentPhase: publicState.phase || "waiting",
        battle: {
            pendingAttack: null,
            currentAttack: null,
            pendingBlock: null,
            pendingTrashChoice: null
        },
        logs: options.logs || buildPregameLogs(match)
    };
}

function buildSharedSnapshotFromFullMatch(match) {
    const p1 = match?.players?.p1;
    const p2 = match?.players?.p2;
    const p1Private = p1?.uid ? match.private?.[p1.uid] : null;
    const p2Private = p2?.uid ? match.private?.[p2.uid] : null;
    const publicState = match?.public || {};

    return {
        players: {
            p1: buildPlayerState(p1, publicState.player1, p1Private, true),
            p2: buildPlayerState(p2, publicState.player2, p2Private, true)
        },
        diceWinnerSlot: publicState.setup?.dice?.winner || null,
        firstPlayerSlot: publicState.firstPlayer || publicState.setup?.turnChoice?.firstPlayer || null,
        secondPlayerSlot: publicState.secondPlayer || publicState.setup?.turnChoice?.secondPlayer || null,
        currentPlayerSlot: publicState.currentPlayer || null,
        turnNumber: Number(publicState.turnNumber || 1),
        currentPhase: publicState.phase || "main",
        battle: {
            pendingAttack: null,
            currentAttack: null,
            pendingBlock: null,
            pendingTrashChoice: null
        },
        logs: buildPregameLogs(match)
    };
}

function buildPregameLogs(match) {
    const logs = [];
    const players = match?.players || {};
    const publicState = match?.public || {};
    const dice = publicState.setup?.dice || {};
    const turnChoice = publicState.setup?.turnChoice || {};
    const mulligan = publicState.setup?.mulligan || {};
    const p1Name = players.p1?.name || "Player 1";
    const p2Name = players.p2?.name || "Player 2";

    if (dice.p1Roll || dice.p2Roll) {
        logs.push("Players rolled the dice...");

        if (dice.p1Roll) {
            logs.push(`${p1Name} rolled: ${dice.p1Roll}`);
        }

        if (dice.p2Roll) {
            logs.push(`${p2Name} rolled: ${dice.p2Roll}`);
        }

        if (dice.tie) {
            logs.push("Tie! Rolling again...");
        } else if (dice.winner) {
            logs.push(`${players[dice.winner]?.name || "Winner"} wins the dice roll.`);
        }
    }

    if (turnChoice.firstPlayer && turnChoice.secondPlayer) {
        const chooserName = players[turnChoice.chooser]?.name || "Winner";
        const choiceText = turnChoice.firstPlayer === turnChoice.chooser ? "first" : "second";

        logs.push(`${chooserName} chose to go ${choiceText}.`);
        logs.push(`${players[turnChoice.firstPlayer]?.name || "Player 1"} will go first.`);
        logs.push(`${players[turnChoice.secondPlayer]?.name || "Player 2"} will go second.`);
    }

    ["p1", "p2"].forEach(slot => {
        if (!mulligan[slot]?.done) {
            return;
        }

        logs.push(
            mulligan[slot].took
                ? `${players[slot]?.name || "Player"} took a mulligan and placed life cards.`
                : `${players[slot]?.name || "Player"} kept their starting hand and placed life cards.`
        );
    });

    if (mulligan.p1?.done && mulligan.p2?.done) {
        logs.push("Both players are ready.");
        logs.push("Starting Turn 1.");
    }

    return logs;
}

function removeChoiceButtons() {
    document.querySelector(".choice-buttons")?.remove();
}

function getPhaseButton() {
    return document.getElementById("phaseButton");
}

function setPhaseButtonState({ text, disabled = false, hidden = false, onClick = null }) {
    const phaseButton = getPhaseButton();

    if (!phaseButton) {
        return;
    }

    phaseButton.style.display = hidden ? "none" : "block";
    phaseButton.disabled = disabled;
    phaseButton.textContent = text;
    window.__multiplayerRuntime.handlePhaseButtonClick = onClick
        ? () => runPregameAction("Pregame action failed", onClick)
        : null;
}

function showTurnOrderButtons() {
    removeChoiceButtons();

    const controls = document.querySelector(".phase-controls");

    if (!controls) {
        return;
    }

    const choiceContainer = document.createElement("div");
    choiceContainer.className = "choice-buttons";

    [
        {
            label: "Go 1st",
            choice: "first"
        },
        {
            label: "Go 2nd",
            choice: "second"
        }
    ].forEach(entry => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "phase-button";
        button.textContent = entry.label;
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();

            await runPregameAction("Turn order choice failed", async () => {
                await chooseMultiplayerTurnOrder(roomCode, localSlot, entry.choice);
            });
        });
        choiceContainer.appendChild(button);
    });

    controls.appendChild(choiceContainer);
}

function showMulliganButtons() {
    removeChoiceButtons();

    const controls = document.querySelector(".phase-controls");

    if (!controls) {
        return;
    }

    const choiceContainer = document.createElement("div");
    choiceContainer.className = "choice-buttons";

    [
        {
            label: "Keep Hand",
            tookMulligan: false
        },
        {
            label: "Mulligan",
            tookMulligan: true
        }
    ].forEach(entry => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "phase-button";
        button.textContent = entry.label;
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();

            await runPregameAction("Mulligan choice failed", async () => {
                await setMultiplayerMulligan(roomCode, currentUser, localSlot, entry.tookMulligan);
            });
        });
        choiceContainer.appendChild(button);
    });

    controls.appendChild(choiceContainer);
}

function renderPregameControls(match) {
    const publicState = match?.public || {};
    const dice = publicState.setup?.dice || {};
    const mulliganState = publicState.setup?.mulligan?.[localSlot] || {};
    const phase = publicState.phase || "starting";

    removeChoiceButtons();

    if (phase === "starting") {
        const bothPlayersConnected = Boolean(match?.players?.p1?.connected && match?.players?.p2?.connected);
        const hostCanStart = localSlot === "p1" && bothPlayersConnected;

        setPhaseButtonState({
            text: hostCanStart ? "Start Match" : "Preparing Match",
            disabled: !hostCanStart,
            onClick: hostCanStart
                ? async () => {
                    await startMatch(roomCode);
                }
                : null
        });
        return;
    }

    if (phase === "diceRoll") {
        const ownRollKey = `${localSlot}Roll`;
        const otherRollKey = `${getOpponentSlot(localSlot)}Roll`;
        const ownRolled = Boolean(dice[ownRollKey]);
        const otherRolled = Boolean(dice[otherRollKey]);
        const canRoll = !ownRolled || dice.tie;
        const diceRenderKey = `${dice.p1Roll || "-"}:${dice.p2Roll || "-"}:${dice.winner || "-"}:${dice.tie ? "tie" : "clear"}`;

        if (diceRenderKey !== lastDiceRenderKey && (ownRolled || otherRolled)) {
            lastDiceRenderKey = diceRenderKey;

            if (dice.p1Roll && dice.p2Roll && !dice.tie) {
                const winnerName = match.players?.[dice.winner]?.name || "Winner";

                window.showDiceRollAnimation?.(
                    dice.p1Roll,
                    dice.p2Roll,
                    { name: winnerName }
                );
            } else if (dice.tie) {
                window.removeDiceRollDisplay?.();
            }
        }

        setPhaseButtonState({
            text: dice.tie ? "Roll Again" : ownRolled ? "Waiting For Opponent" : "Roll Dice",
            disabled: !canRoll,
            onClick: async () => {
                await rollMultiplayerDice(roomCode, localSlot);
            }
        });

        if (dice.winner === localSlot) {
            showTurnOrderButtons();
        }

        return;
    }

    window.removeDiceRollDisplay?.();

    if (phase === "mulligan") {
        setPhaseButtonState({
            text: mulliganState.done ? "Waiting For Opponent" : "Choose Mulligan",
            disabled: true
        });

        if (!mulliganState.done) {
            showMulliganButtons();
        }

        return;
    }

    setPhaseButtonState({
        text: "Waiting",
        disabled: true
    });
}

async function ensureDeckAndReady(match) {
    const ownPlayer = match?.players?.[localSlot];

    if (!ownPlayer || ownPlayer.uid !== currentUser?.uid) {
        return;
    }

    const preferredDeck = getSavedDeckDefinition();

    if (!ownPrivateState?.selectedDeck && preferredDeck) {
        await setPlayerDeck(roomCode, currentUser.uid, preferredDeck);
        return;
    }

    if (!ownPlayer.ready && ownPrivateState?.selectedDeck) {
        await setPlayerReady(roomCode, currentUser.uid, true);
    }
}

async function maybeInitializeServiceMatch(match) {
    if (
        localSlot !== "p1" ||
        match?.status !== "started" ||
        match?.public?.phase !== "starting" ||
        match?.public?.player1 ||
        !match?.players?.p1?.ready ||
        !match?.players?.p2?.ready ||
        !match?.players?.p1?.connected ||
        !match?.players?.p2?.connected
    ) {
        return;
    }

    await startMatch(roomCode);
}

async function maybeCreateSharedState(match) {
    if (
        initializingSharedState ||
        localSlot !== "p1" ||
        match?.public?.sharedState ||
        match?.public?.phase !== "main"
    ) {
        return;
    }

    initializingSharedState = true;

    try {
        const fullMatch = await getMatch(roomCode);

        if (fullMatch?.public?.sharedState) {
            return;
        }

        const snapshot = buildSharedSnapshotFromFullMatch(fullMatch);
        const revision = `${currentUser.uid}-${Date.now()}-${++revisionCounter}`;

        lastSubmittedSharedRevision = revision;
        lastAppliedSharedRevision = revision;

        getPageApi()?.applySharedState({
            ...snapshot,
            revision,
            updatedBy: currentUser.uid
        });

        await updatePublicState(roomCode, {
            sharedState: {
                ...snapshot,
                revision,
                updatedBy: currentUser.uid
            }
        });
    } finally {
        initializingSharedState = false;
    }
}

async function syncSharedStateNow() {
    const pageApi = getPageApi();

    if (!pageApi || !latestPublicMatch?.public?.sharedState) {
        return;
    }

    const snapshot = pageApi.exportSharedState();

    if (!snapshot) {
        return;
    }

    const revision = `${currentUser.uid}-${Date.now()}-${++revisionCounter}`;

    lastSubmittedSharedRevision = revision;

    await updatePublicState(roomCode, {
        sharedState: {
            ...snapshot,
            revision,
            updatedBy: currentUser.uid
        }
    });
}

function scheduleStateSync() {
    if (!latestPublicMatch?.public?.sharedState) {
        return;
    }

    clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
        syncSharedStateNow().catch(error => {
            console.error("Failed to sync multiplayer state:", error);
        });
    }, 0);
}

function applySharedStateIfNeeded(match) {
    const sharedState = match?.public?.sharedState;
    const pageApi = getPageApi();

    if (!sharedState || !pageApi) {
        return false;
    }

    if (sharedState.revision === lastAppliedSharedRevision) {
        return true;
    }

    if (sharedState.revision === lastSubmittedSharedRevision && sharedState.updatedBy === currentUser?.uid) {
        lastAppliedSharedRevision = sharedState.revision;
        window.__multiplayerRuntime.handlePhaseButtonClick = null;
        return true;
    }

    lastAppliedSharedRevision = sharedState.revision;
    window.__multiplayerRuntime.handlePhaseButtonClick = null;
    pageApi.applySharedState(sharedState);

    return true;
}

function applyPregameSnapshot(match) {
    const pageApi = getPageApi();

    if (!pageApi || !ownPrivateState?.leader) {
        return;
    }

    pageApi.applySharedState(buildSnapshotFromRoom(match, ownPrivateState));
}

async function handlePublicMatchUpdate(match) {
    latestPublicMatch = match;

    if (!currentUser || !roomCode || !localSlot) {
        return;
    }

    await ensureDeckAndReady(match);
    await maybeInitializeServiceMatch(match);

    if (applySharedStateIfNeeded(match)) {
        removeChoiceButtons();
        return;
    }

    applyPregameSnapshot(match);
    renderPregameControls(match);
    await maybeCreateSharedState(match);
}

function waitForPageApi() {
    return new Promise(resolve => {
        if (getPageApi()) {
            resolve();
            return;
        }

        window.addEventListener("multiplayer-page-ready", () => resolve(), {
            once: true
        });
    });
}

async function initializeRuntime() {
    const params = new URLSearchParams(window.location.search);

    roomCode = params.get("room");
    localSlot = params.get("player");

    if (!roomCode || (localSlot !== "p1" && localSlot !== "p2")) {
        return;
    }

    await waitForPageApi();
    await signInGuest();

    currentUser = await waitForUser();

    unsubscribePrivate = subscribeToPrivateState(roomCode, currentUser.uid, (privateState) => {
        ownPrivateState = privateState || {};

        if (latestPublicMatch?.public?.sharedState) {
            return;
        }

        if (latestPublicMatch) {
            applyPregameSnapshot(latestPublicMatch);
            renderPregameControls(latestPublicMatch);
        }
    });

    unsubscribeMatch = subscribeToMatch(roomCode, (match) => {
        if (!match) {
            setPhaseButtonState({
                text: "Room Closed",
                disabled: true
            });
            return;
        }

        handlePublicMatchUpdate(match).catch(error => {
            console.error("Failed to process multiplayer update:", error);
        });
    });
}

initializeRuntime().catch(error => {
    console.error("Failed to initialize multiplayer runtime:", error);
});
