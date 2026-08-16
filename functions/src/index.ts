/**
 * Firebase Cloud Functions for QuranNotes.
 *
 * Noor is the sole governed AI callable. Account deletion remains a separate
 * server-side trigger so user-scoped data and Noor state are cleaned together.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export { askNoorRagV1 } from './noor-rag/callable';

admin.initializeApp();
const db = admin.firestore();

/** Cascade-delete user data when a Firebase Auth account is deleted. */
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
    const uid = user.uid;
    functions.logger.info(`Deleting all data for user: ${uid}`);

    const collectionsToClean = ['notes', 'recordings', 'folders'];
    const batch = db.batch();
    let totalDeleted = 0;
    let hasPendingDeletes = false;

    for (const collectionName of collectionsToClean) {
        try {
            const snapshot = await db
                .collection(collectionName)
                .where('userId', '==', uid)
                .get();

            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
                totalDeleted++;
                hasPendingDeletes = true;
            });
        } catch (error) {
            functions.logger.error(
                `Error querying ${collectionName} for user ${uid}:`,
                error,
            );
        }
    }

    try {
        batch.delete(db.collection('_rateLimits').doc(uid));
        hasPendingDeletes = true;
    } catch (error) {
        functions.logger.warn('Error deleting rate limit doc:', error);
    }

    // Noor's validated context and subject pseudonym index are user-scoped.
    batch.delete(db.collection('noorConversationState').doc(uid));
    batch.delete(db.collection('noorTelemetrySubjects').doc(uid));
    hasPendingDeletes = true;

    if (hasPendingDeletes) {
        await batch.commit();
        functions.logger.info(`Deleted ${totalDeleted} documents for user ${uid}`);
    } else {
        functions.logger.info(`No documents found for user ${uid}`);
    }
});
