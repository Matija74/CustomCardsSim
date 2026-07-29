import { otherPlayerId } from "./gameState.js";

const ARRAY_ZONES = ["deck", "hand", "life", "trash"];

export function getPlayer(state, playerId) {
    return state.players?.[playerId] || null;
}

export function getOpponent(state, playerId) {
    return getPlayer(state, otherPlayerId(playerId));
}

export function findCard(state, instanceId) {
    if (!instanceId) return null;

    for (const player of Object.values(state.players || {})) {
        if (player.leader?.instanceId === instanceId) {
            return { card: player.leader, player, playerId: player.id, zone: "leader", index: null };
        }

        if (player.stage?.instanceId === instanceId) {
            return { card: player.stage, player, playerId: player.id, zone: "stage", index: null };
        }

        const characterIndex = player.characters.findIndex(card => card?.instanceId === instanceId);

        if (characterIndex !== -1) {
            return { card: player.characters[characterIndex], player, playerId: player.id, zone: "characterArea", index: characterIndex };
        }

        for (const zone of ARRAY_ZONES) {
            const index = player[zone].findIndex(card => card?.instanceId === instanceId);

            if (index !== -1) {
                return { card: player[zone][index], player, playerId: player.id, zone, index };
            }
        }
    }

    return null;
}

export function removeCard(state, instanceId) {
    const location = findCard(state, instanceId);

    if (!location) return null;

    if (location.zone === "leader") {
        location.player.leader = null;
    } else if (location.zone === "stage") {
        location.player.stage = null;
    } else if (location.zone === "characterArea") {
        location.player.characters[location.index] = null;
    } else {
        location.player[location.zone].splice(location.index, 1);
    }

    return location.card;
}

export function insertCard(state, card, playerId, zone, options = {}) {
    const player = getPlayer(state, playerId);

    if (!player || !card) return false;

    card.controllerId = playerId;
    card.zone = zone;

    if (zone === "leader") {
        if (player.leader) return false;
        player.leader = card;
        return true;
    }

    if (zone === "stage") {
        if (player.stage) return false;
        player.stage = card;
        return true;
    }

    if (zone === "characterArea") {
        const slotIndex = Number.isInteger(options.slotIndex)
            ? options.slotIndex
            : player.characters.findIndex(entry => !entry);

        if (slotIndex < 0 || slotIndex >= player.characters.length || player.characters[slotIndex]) {
            return false;
        }

        player.characters[slotIndex] = card;
        return true;
    }

    if (!ARRAY_ZONES.includes(zone)) return false;

    if (options.position === "bottom") {
        player[zone].push(card);
    } else {
        player[zone].unshift(card);
    }

    return true;
}

export function moveCard(state, instanceId, playerId, zone, options = {}) {
    const location = findCard(state, instanceId);

    if (!location) return false;

    const original = {
        playerId: location.playerId,
        zone: location.zone,
        index: location.index
    };
    const card = removeCard(state, instanceId);

    if (insertCard(state, card, playerId, zone, options)) {
        return true;
    }

    insertCard(state, card, original.playerId, original.zone, {
        slotIndex: original.zone === "characterArea" ? original.index : undefined,
        position: original.zone === "deck" ? "top" : "bottom"
    });

    return false;
}

export function getBoardCards(player) {
    return [player?.leader, player?.stage, ...(player?.characters || [])].filter(Boolean);
}

export function getAllCards(state) {
    return Object.values(state.players || {}).flatMap(player => [
        player.leader,
        player.stage,
        ...player.characters,
        ...player.deck,
        ...player.hand,
        ...player.life,
        ...player.trash
    ]).filter(Boolean);
}
