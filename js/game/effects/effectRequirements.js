import { getBoardCards, getPlayer } from "../state/zones.js";
import { getEffectivePower } from "../checks/validation.js";

export function meetsEffectRequirements(state, definitions, source, requirements = {}) {
    const player = getPlayer(state, source?.controllerId);
    const opponent = getPlayer(state, source?.controllerId === "p1" ? "p2" : "p1");
    if (!player || !opponent) return false;

    const characters = player.characters.filter(Boolean);
    if (requirements.leaderName && definitions[player.leader?.definitionId]?.name !== requirements.leaderName) return false;
    if (requirements.stageName && definitions[player.stage?.definitionId]?.name !== requirements.stageName) return false;
    if (requirements.noStage && player.stage) return false;
    if (requirements.characterName && !characters.some(card => definitions[card.definitionId]?.name === requirements.characterName)) return false;
    if (requirements.restedCharactersAtLeast !== undefined) {
        const rested = characters.filter(card => card.instanceId !== (requirements.excludeSource ? source.instanceId : null) && card.state === "rested").length;
        if (rested < Number(requirements.restedCharactersAtLeast)) return false;
    }
    if (requirements.lifeAtMost !== undefined && player.life.length > Number(requirements.lifeAtMost)) return false;
    if (requirements.lifeAtLeast !== undefined && player.life.length < Number(requirements.lifeAtLeast)) return false;
    if (requirements.opponentLifeAtMost !== undefined && opponent.life.length > Number(requirements.opponentLifeAtMost)) return false;
    if (requirements.handAtLeast !== undefined && player.hand.length < Number(requirements.handAtLeast)) return false;
    if (requirements.otherHandCardsAtLeast !== undefined) {
        const otherHandCards = player.hand.filter(card => card.instanceId !== source.instanceId).length;
        if (otherHandCards < Number(requirements.otherHandCardsAtLeast)) return false;
    }
    if (requirements.activeDonAtLeast !== undefined && player.activeDon < Number(requirements.activeDonAtLeast)) return false;
    if (requirements.totalDonAtLeast !== undefined) {
        const attachedDon = getBoardCards(player).reduce((total, card) => total + Number(card.attachedDon || 0), 0);
        if (player.activeDon + player.restedDon + attachedDon < Number(requirements.totalDonAtLeast)) return false;
    }
    if (requirements.leaderTypeIncludes && !String(definitions[player.leader?.definitionId]?.type || "").includes(requirements.leaderTypeIncludes)) return false;
    if (requirements.sourceAttachedDonAtLeast !== undefined && Number(source.attachedDon || 0) < Number(requirements.sourceAttachedDonAtLeast)) return false;
    if (requirements.characterPowerAtLeast !== undefined && !characters.some(card => getEffectivePower(card, definitions[card.definitionId], state) >= Number(requirements.characterPowerAtLeast))) return false;
    return true;
}
