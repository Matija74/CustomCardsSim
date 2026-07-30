const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { logger } = require("firebase-functions");
const { onSchedule } = require("firebase-functions/v2/scheduler");

initializeApp();

const ABANDONED_GRACE_MS = 10 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 25;

function hasConnectedPlayer(room) {
    return Object.values(room?.players || {})
        .some(player => player?.connected === true);
}

function getLastActivityAt(room) {
    const timestamps = [
        room?.createdAt,
        room?.updatedAt,
        room?.players?.p1?.disconnectedAt,
        room?.players?.p1?.lastSeenAt,
        room?.players?.p2?.disconnectedAt,
        room?.players?.p2?.lastSeenAt
    ].filter(Number.isFinite);

    return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

async function deleteRoomIfAbandoned(roomRef, cutoff) {
    const result = await roomRef.transaction(room => {
        if (!room || hasConnectedPlayer(room)) {
            return undefined;
        }

        const lastActivityAt = getLastActivityAt(room);

        if (lastActivityAt === null || lastActivityAt > cutoff) {
            return undefined;
        }

        return null;
    }, undefined, false);

    return result.committed && !result.snapshot.exists();
}

exports.cleanupAbandonedMatches = onSchedule({
    schedule: "59 23 * * *",
    timeZone: "Europe/Ljubljana",
    region: "europe-west1",
    maxInstances: 1,
    timeoutSeconds: 540,
    memory: "256MiB"
}, async () => {
    const matchesSnapshot = await getDatabase().ref("matches").get();

    if (!matchesSnapshot.exists()) {
        logger.info("No match rooms found during scheduled cleanup.");
        return;
    }

    const cutoff = Date.now() - ABANDONED_GRACE_MS;
    const roomReferences = [];

    matchesSnapshot.forEach(roomSnapshot => {
        roomReferences.push(roomSnapshot.ref);
    });

    let deletedRooms = 0;
    let failedRooms = 0;

    for (let start = 0; start < roomReferences.length; start += CLEANUP_BATCH_SIZE) {
        const batch = roomReferences.slice(start, start + CLEANUP_BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(roomRef => deleteRoomIfAbandoned(roomRef, cutoff))
        );

        results.forEach((result, index) => {
            if (result.status === "fulfilled") {
                if (result.value) {
                    deletedRooms += 1;
                }
                return;
            }

            failedRooms += 1;
            logger.error("Failed to inspect an abandoned match room.", {
                roomCode: batch[index].key,
                error: result.reason?.message || String(result.reason)
            });
        });
    }

    logger.info("Scheduled abandoned match cleanup finished.", {
        inspectedRooms: roomReferences.length,
        deletedRooms,
        failedRooms
    });
});
