import { signInGuest, waitForUser } from "../firebase/firebaseApp.js";
import {
    createImmediateDisconnectRequest,
    getMatch,
    publishGameplayState,
    registerRoomPresence,
    sendImmediateDisconnectRequest,
    submitGameplayCommand,
    subscribeToMatch,
    subscribeToFullMatch,
    subscribeToPrivateGameState
} from "../firebase/multiplayerService.js";
import { createGameEngine, redactStateForPlayer } from "../../game/engine/gameEngine.js";
import { mountMatchController } from "../../ui/match/matchController.js";

let currentUser;
let roomCode;
let localSlot;
let immediateDisconnectRequest;
let engine;
let controller;
let latestState;
let publishing = false;
const locallyProcessing = new Set();
const disconnectTimers = new Map();

function setStatus(message, error = false) {
    const log = document.getElementById("gameLogMessages");
    if (log && (!latestState || error)) log.textContent = message;
}

function parseDeck(deckData) {
    const deck = String(deckData.deckText || "").trim().split(/\r?\n/).flatMap(line => {
        const match = line.trim().match(/^(\d+)x(.+)$/);
        const definition = match && window.cardDatabase[match[2].trim()];
        return definition ? Array(Number(match[1])).fill(definition) : [];
    });
    return { name: deckData.name || "Player", leader: window.leaders[deckData.leaderKey], deck };
}

function publicSummary(state) {
    return {
        revision: state.revision,
        phase: state.phase,
        turnNumber: state.turnNumber,
        activePlayerId: state.activePlayerId,
        winnerId: state.winnerId,
        winReason: state.winReason,
        counts: Object.fromEntries(Object.entries(state.players).map(([id, player]) => [id, { deck: player.deck.length, hand: player.hand.length, life: player.life.length, trash: player.trash.length }]))
    };
}

async function publish(match) {
    if (publishing || !engine) return;
    publishing = true;
    try {
        await publishGameplayState(roomCode, currentUser.uid, { p1: match.players.p1.uid, p2: match.players.p2.uid }, engine.state, {
            p1: redactStateForPlayer(engine.state, "p1"),
            p2: redactStateForPlayer(engine.state, "p2")
        }, publicSummary(engine.state), engine.state.processedCommandIds.slice(-200));
        latestState = redactStateForPlayer(engine.state, localSlot);
        controller?.render();
    } finally {
        publishing = false;
    }
}

async function ensureHostEngine(match) {
    if (localSlot !== "p1" || engine || !match?.players?.p2?.uid) return;
    const p1Deck = match.private?.[match.players.p1.uid]?.selectedDeck;
    const p2Deck = match.private?.[match.players.p2.uid]?.selectedDeck;
    if (!p1Deck || !p2Deck) return;
    const definitions = { ...window.cardDatabase, ...window.leaders };
    window.__gameDefinitions = definitions;
    const saved = match.private?.[currentUser.uid]?.authoritativeGame || null;
    engine = createGameEngine({ p1: { ...parseDeck(p1Deck), name: match.players.p1.name || "Player 1" }, p2: { ...parseDeck(p2Deck), name: match.players.p2.name || "Player 2" }, definitions, initialState: saved });
    latestState = redactStateForPlayer(engine.state, localSlot);
    controller = mountMatchController({ engine, localPlayerId: localSlot, getState: () => latestState, sendCommand });
    await publish(match);
}

async function processHostCommands(match) {
    if (localSlot !== "p1" || !engine || publishing) return;
    const commands = Object.entries(match.commands || {}).sort((a, b) => Number(a[1].createdAt || 0) - Number(b[1].createdAt || 0));
    let changed = false;
    for (const [id, entry] of commands) {
        if (match.processedCommands?.[id] || engine.state.processedCommandIds.includes(id) || locallyProcessing.has(id)) continue;
        const expectedUid = match.players?.[entry.playerId]?.uid;
        if (!expectedUid || entry.uid !== expectedUid || entry.command?.id !== id || entry.command?.playerId !== entry.playerId) continue;
        locallyProcessing.add(id);
        engine.dispatch(entry.command);
        changed = true;
    }
    if (changed) await publish(match);
}

function monitorDisconnect(match, playerId) {
    const player = match.players?.[playerId];
    if (player?.connected !== false || !engine || engine.state.phase === "gameOver") {
        clearTimeout(disconnectTimers.get(playerId));
        disconnectTimers.delete(playerId);
        return;
    }
    if (disconnectTimers.has(playerId)) return;
    const timer = setTimeout(async () => {
        disconnectTimers.delete(playerId);
        const latest = await getMatch(roomCode);
        if (latest?.players?.[playerId]?.connected === false && engine?.state.phase !== "gameOver") {
            engine.dispatch({ id: `disconnect-${playerId}-${Number(latest.players[playerId].disconnectedAt) || Date.now()}`, type: "disconnect", playerId });
            await publish(latest);
        }
    }, 15000);
    disconnectTimers.set(playerId, timer);
}

async function sendCommand(command) {
    await submitGameplayCommand(roomCode, currentUser, localSlot, command);
}

async function initialize() {
    const params = new URLSearchParams(location.search);
    roomCode = params.get("room")?.toUpperCase();
    localSlot = params.get("player");
    if (!roomCode || !["p1", "p2"].includes(localSlot)) throw new Error("Room and player slot are required.");
    setStatus("Connecting to game...");
    await window.loadCardDatabase();
    await signInGuest();
    currentUser = await waitForUser();
    immediateDisconnectRequest = await createImmediateDisconnectRequest(roomCode, localSlot, currentUser);
    await registerRoomPresence(roomCode, localSlot, currentUser);
    const disconnect = () => sendImmediateDisconnectRequest(immediateDisconnectRequest);
    addEventListener("pagehide", disconnect, { once: true });
    addEventListener("beforeunload", disconnect, { once: true });

    subscribeToPrivateGameState(roomCode, currentUser.uid, state => {
        if (!state) return;
        latestState = state;
        if (!controller) {
            const definitions = { ...window.cardDatabase, ...window.leaders };
            window.__gameDefinitions = definitions;
            controller = mountMatchController({ engine: { definitions }, localPlayerId: localSlot, getState: () => latestState, sendCommand });
        } else controller.render();
    });
    if (localSlot === "p1") {
        subscribeToFullMatch(roomCode, match => {
            if (!match) return setStatus("The room was closed.", true);
            ensureHostEngine(match).then(() => {
                monitorDisconnect(match, "p2");
                return processHostCommands(match);
            }).catch(error => setStatus(error.message, true));
        });
        await ensureHostEngine(await getMatch(roomCode));
    } else {
        subscribeToMatch(roomCode, match => {
            if (!match) setStatus("The room was closed.", true);
        });
    }
}

initialize().catch(error => {
    console.error("Failed to initialize multiplayer gameplay:", error);
    setStatus(error.message, true);
});
