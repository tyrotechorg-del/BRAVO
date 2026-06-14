// ============================================================
// PATCH for backend/src/controllers/adminController.js
// ============================================================
//
// This file shows the TWO functions that need to be replaced in
// adminController.js now that SystemSettings model exists. Replace
// the existing getSystemSettings and updateSystemSettings exports
// with these.
//
// Don't forget to add the import at the top:
//   import SystemSettings from '../models/SystemSettings.js';
//
// Why this matters: the batch 4 versions mutated process.env which
// (1) didn't persist across restarts, (2) didn't propagate to other
// instances in a clustered deployment. The new SystemSettings collection
// fixes both — settings are stored in the DB, read on every request,
// and shared across all instances.
//
// ============================================================

import SystemSettings from '../models/SystemSettings.js';

// GET /api/admin/settings
//
// Now reads from the DB instead of process.env. Falls back to env-var
// defaults via the SystemSettings schema's `default:` values, so a
// fresh install with no settings doc still returns sane numbers.
//
// Note the subscription plans block stays hardcoded — those are
// product decisions, not runtime configuration. If you want them
// editable too, add them to the SystemSettings schema as a nested
// object and remove the hardcoded values here.
export const getSystemSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();

    res.json({
      platformCommission:  settings.platformCommission,
      minWithdrawalAmount: settings.minWithdrawalAmount,
      maxUploadSize:       settings.maxUploadSize,
      flags:               settings.flags || {},

      // Subscription plan structure — hardcoded product config.
      // (Same as the previous version.)
      subscriptionPlans: {
        artist_basic: { price: 50,  uploadLimit: 10, features: ['Basic Analytics', '10 Uploads'] },
        artist_pro:   { price: 120, uploadLimit: -1, features: ['Advanced Analytics', 'Unlimited Uploads', 'Monetization'] },
        artist_vip:   { price: 300, uploadLimit: -1, features: ['Verified Badge', 'Homepage Promotion', 'Priority Support'] },
      },
    });
  } catch (err) {
    console.error('getSystemSettings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

// PUT /api/admin/settings
//
// Now persists to the DB. The mutation propagates to all running
// instances because every read hits SystemSettings.getSettings() —
// no more "settings don't apply until you restart the server"
// surprises.
//
// We still log the change to AdminLog so there's an audit trail of
// who changed what when.
export const updateSystemSettings = async (req, res) => {
  try {
    const { platformCommission, minWithdrawalAmount, maxUploadSize, flags } = req.body;

    const updates = {};

    if (platformCommission !== undefined) {
      const n = Number(platformCommission);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return res.status(400).json({ error: 'platformCommission must be 0-100' });
      }
      updates.platformCommission = n;
    }

    if (minWithdrawalAmount !== undefined) {
      const n = Number(minWithdrawalAmount);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ error: 'minWithdrawalAmount must be non-negative' });
      }
      updates.minWithdrawalAmount = n;
    }

    if (maxUploadSize !== undefined) {
      const n = Number(maxUploadSize);
      if (!Number.isFinite(n) || n <= 0 || n > 5000) {
        return res.status(400).json({ error: 'maxUploadSize must be 1-5000 (MB)' });
      }
      updates.maxUploadSize = n;
    }

    // `flags` is free-form (the schema uses Mixed). We don't validate
    // its shape here — callers should know what flags exist. If a
    // typo or bad value gets in, it just sits in the doc until cleared.
    if (flags !== undefined && typeof flags === 'object' && flags !== null) {
      updates.flags = flags;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid settings provided' });
    }

    updates.updatedBy = req.user._id;

    const settings = await SystemSettings.findOneAndUpdate(
      { key: 'global' },
      { $set: updates, $setOnInsert: { key: 'global' } },
      { new: true, upsert: true }
    );

    // Audit log — same pattern as the rest of the admin controller.
    // We re-use the existing logAdminAction helper; it's already imported
    // in the main file.
    await logAdminAction(req.user._id, 'update_settings', null, updates);

    res.json({
      message: 'Settings updated successfully',
      settings: {
        platformCommission:  settings.platformCommission,
        minWithdrawalAmount: settings.minWithdrawalAmount,
        maxUploadSize:       settings.maxUploadSize,
        flags:               settings.flags,
      },
    });
  } catch (err) {
    console.error('updateSystemSettings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

// ============================================================
// IMPORTANT: code elsewhere that reads these settings should NOT
// use process.env anymore. Replace lookups like:
//
//   const rate = Number(process.env.PLATFORM_COMMISSION_RATE) || 10;
//
// with:
//
//   import SystemSettings from '../models/SystemSettings.js';
//   const settings = await SystemSettings.getSettings();
//   const rate = settings.platformCommission;
//
// The places this affects (from the controller fixes in batches 1-4):
//   - paymentController.processPayment       (uses PLATFORM_COMMISSION_RATE)
//   - albumController.purchaseAlbum          (uses PLATFORM_COMMISSION_RATE)
//   - walletController.withdraw              (uses MIN_WITHDRAWAL_AMOUNT)
//   - artistController.requestWithdrawal     (uses MIN_WITHDRAWAL_AMOUNT)
//
// These can be migrated incrementally — until then, env vars still
// work as defaults. The new admin endpoint is purely additive.
// ============================================================
