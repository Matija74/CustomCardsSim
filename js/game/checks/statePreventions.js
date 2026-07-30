import { otherPlayerId } from "../state/gameState.js";
import { findCard } from "../state/zones.js";

const PREVENTION_ALIASES = Object.freeze({
    cannotberested: "cannotBeRested",
    cannotrest: "cannotBeRested",
    rested: "cannotBeRested",
    cannotattack: "cannotAttack",
    skiprefreshactivation: "skipRefreshActivation",
    doesnotbecomeactiveinrefresh: "skipRefreshActivation",
    doesnotbecomeactiveinrefreshphase: "skipRefreshActivation",
    doesnotbecomeactiveduringrefresh: "skipRefreshActivation",
    doesnotbecomeactiveduringrefreshphase: "skipRefreshActivation",
    doesnotbecomeactiveduringnextrefreshphase: "skipRefreshActivation",
    doesnotbecomeactiveduringthenextrefreshphase: "skipRefreshActivation",
    cannotbecomeactive: "cannotBecomeActive",
    active: "cannotBecomeActive"
});

const DURATION_ALIASES = Object.freeze({
    turn: "turn",
    thisturn: "turn",
    forthisturn: "turn",
    currentturn: "turn",
    endofturn: "turn",
    untilendofturn: "turn",
    untilendofyourturn: "untilEndOfYourTurn",
    endofyourturn: "untilEndOfYourTurn",
    yourturn: "untilEndOfYourTurn",
    untilendofopponentturn: "untilEndOfOpponentTurn",
    untilendofopponentsturn: "untilEndOfOpponentTurn",
    endofopponentturn: "untilEndOfOpponentTurn",
    opponentturn: "untilEndOfOpponentTurn",
    opponentnextendphase: "untilEndOfOpponentTurn",
    untilopponentsnextendphase: "untilEndOfOpponentTurn",
    untilyouropponentsnextendphase: "untilEndOfOpponentTurn",
    untiltheendofyouropponentsnextendphase: "untilEndOfOpponentTurn",
    untilendoftargetturn: "untilEndOfTargetTurn",
    targetturn: "untilEndOfTargetTurn",
    nextrefresh: "nextRefresh",
    nextrefreshphase: "nextRefresh",
    duringnextrefreshphase: "nextRefresh",
    duringthenextrefreshphase: "nextRefresh",
    untilnextrefresh: "nextRefresh",
    battle: "battle",
    whileinplay: "whileInPlay",
    permanent: "permanent",
    restofgame: "permanent",
    fortherestofthegame: "permanent"
});

function normalizedKey(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizePreventionType(value) {
    return PREVENTION_ALIASES[normalizedKey(value)] || null;
}

export function normalizePreventionDuration(value) {
    return DURATION_ALIASES[normalizedKey(value)] || null;
}

export function createStatePrevention(state, context, card, type, duration) {
    const prevention = {
        type,
        duration,
        sourcePlayerId: context.controllerId,
        sourceInstanceId: context.sourceInstanceId || card.instanceId,
        appliedTurn: state.turnNumber
    };
    if (duration === "turn") prevention.expiresTurn = state.turnNumber;
    if (duration === "untilEndOfYourTurn") prevention.expiresAtEndOfPlayerId = context.controllerId;
    if (duration === "untilEndOfOpponentTurn") prevention.expiresAtEndOfPlayerId = otherPlayerId(context.controllerId);
    if (duration === "untilEndOfTargetTurn") prevention.expiresAtEndOfPlayerId = card.controllerId;
    if (duration === "nextRefresh") prevention.expiresOnRefreshPlayerId = card.controllerId;
    if (duration === "battle") prevention.battleId = state.pendingCombat?.id || null;
    return prevention;
}

function preventionIsActive(state, prevention) {
    if (prevention.expiresTurn !== undefined && state.turnNumber > prevention.expiresTurn) return false;
    if (prevention.duration === "battle") return Boolean(state.pendingCombat && prevention.battleId === state.pendingCombat.id);
    if (prevention.duration === "whileInPlay") {
        const sourceLocation = findCard(state, prevention.sourceInstanceId);
        return Boolean(sourceLocation && ["leader", "characterArea", "stage"].includes(sourceLocation.zone));
    }
    return true;
}

export function hasStatePrevention(state, card, type) {
    const normalizedType = normalizePreventionType(type);
    return Boolean(normalizedType && (card?.preventions || []).some(prevention =>
        normalizePreventionType(prevention.type || prevention.state) === normalizedType && preventionIsActive(state, prevention)
    ));
}

export function expirePreventionsAtEndOfTurn(state, card, endingPlayerId) {
    card.preventions = (card.preventions || []).filter(prevention => {
        if (!preventionIsActive(state, prevention)) return false;
        if (prevention.expiresTurn !== undefined && prevention.expiresTurn <= state.turnNumber) return false;
        return prevention.expiresAtEndOfPlayerId !== endingPlayerId;
    });
}

export function consumeRefreshPreventions(card, playerId) {
    card.preventions = (card.preventions || []).filter(prevention => prevention.expiresOnRefreshPlayerId !== playerId);
}
