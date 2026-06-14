import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { getIO } from '../config/socket.js';

// Max users a single notifyFollowers call will fan out to in one
// batch. Avoids loading a 100K-user follower array into memory and
// firing 100K writes at once.
const FOLLOWER_BATCH_SIZE = 500;

class NotificationService {
  /**
   * Create a single in-app notification + emit a real-time event.
   *
   * Socket.IO emit is best-effort: if the io instance isn't ready
   * (tests, cold start), we log and continue. The DB row is the
   * source of truth.
   */
  async createNotification(userId, type, title, message, data = {}) {
    try {
      const notification = await Notification.create({
        user: userId,
        type,
        title,
        message,
        data,
        read: false,
      });

      try {
        const io = getIO();
        io.to(`user:${userId}`).emit('notification', notification);
      } catch (socketErr) {
        // Socket not ready — DB row is what matters.
        console.log('Socket emit failed (DB row still saved):', socketErr.message);
      }

      return notification;
    } catch (error) {
      console.error('createNotification error:', error.message);
      // FIX: original returned null silently. Callers couldn't tell if
      // the notification was saved or not. Keep the null-return for
      // backwards compat but also expose the error via console so ops
      // can see it.
      return null;
    }
  }

  /**
   * Notify all active admins. Was sequential `for` loop — for 5 admins
   * that's not a big deal, but parallelizing is free.
   *
   * FIX: `User` is imported at the top — old code did
   *   const User = await import('../models/User.js');
   * inside the method body, which re-evaluated the import on every call.
   */
  async notifyAdmins(title, message, data = {}) {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');

    if (admins.length === 0) return [];

    // Bulk-create the DB rows in one round-trip rather than N separate
    // inserts. Then emit socket events in parallel.
    const docs = admins.map((admin) => ({
      user: admin._id,
      type: 'admin',
      title,
      message,
      data,
      read: false,
    }));

    let notifications;
    try {
      notifications = await Notification.insertMany(docs, { ordered: false });
    } catch (err) {
      console.error('notifyAdmins insertMany error:', err.message);
      return [];
    }

    // Emit in parallel — best-effort.
    try {
      const io = getIO();
      for (const n of notifications) {
        io.to(`user:${n.user}`).emit('notification', n);
      }
    } catch (socketErr) {
      console.log('Socket emit failed in notifyAdmins:', socketErr.message);
    }

    return notifications;
  }

  /**
   * Notify all followers of an artist. Batched to avoid loading 100K
   * follower records into memory at once.
   *
   * FIX: original code did `for (const f of followers) await create(...)`
   * — for a popular artist this serializes thousands of writes. Now
   * uses `insertMany` per batch, which is one round-trip per 500
   * followers.
   *
   * `targetUserId` is the User._id of the artist (followers store User IDs
   * in their `following` array).
   */
  async notifyFollowers(targetUserId, title, message, data = {}) {
    let processed = 0;
    let lastSeenId = null;

    while (true) {
      const query = { following: targetUserId };
      if (lastSeenId) query._id = { $gt: lastSeenId };

      const batch = await User.find(query)
        .sort({ _id: 1 })
        .limit(FOLLOWER_BATCH_SIZE)
        .select('_id');

      if (batch.length === 0) break;

      const docs = batch.map((follower) => ({
        user: follower._id,
        type: 'artist_update',
        title,
        message,
        data,
        read: false,
      }));

      try {
        const notifications = await Notification.insertMany(docs, { ordered: false });

        // Emit in parallel (best-effort).
        try {
          const io = getIO();
          for (const n of notifications) {
            io.to(`user:${n.user}`).emit('notification', n);
          }
        } catch {
          // Socket not available — DB rows still saved.
        }
      } catch (err) {
        console.error('notifyFollowers batch error:', err.message);
        // Continue to the next batch — don't fail the whole fanout.
      }

      processed += batch.length;
      lastSeenId = batch[batch.length - 1]._id;

      if (batch.length < FOLLOWER_BATCH_SIZE) break;
    }

    return { notified: processed };
  }

  async notifySongUpload(artist, song) {
    return this.notifyFollowers(
      artist.userId,
      'New Music Upload',
      `${artist.stageName} just released a new song: ${song.title}`,
      { songId: song._id, type: 'new_song' }
    );
  }

  async notifySubscriptionExpiry(userId, daysLeft) {
    return this.createNotification(
      userId,
      'subscription',
      'Subscription Expiring Soon',
      `Your subscription will expire in ${daysLeft} days. Renew now to continue enjoying benefits.`,
      { daysLeft, type: 'expiry_warning' }
    );
  }
}

export default new NotificationService();
