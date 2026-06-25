import mongoose from 'mongoose';

/**
 * Persistent system settings.
 *
 * Replaces the runtime `process.env` mutation in adminController.updateSystemSettings
 * (which didn't persist across restarts and didn't propagate to other
 * instances in a clustered deployment — see batch 4 README for context).
 *
 * Design: single-document collection. The admin's UI reads from this
 * doc and writes back to it. Code that needs a setting reads it from
 * here, with env-var fallbacks for defaults.
 *
 * To use from another file:
 *
 *   import SystemSettings from '../models/SystemSettings.js';
 *   const settings = await SystemSettings.getSettings();
 *   const commission = settings.platformCommission; // number
 *
 * Static method `getSettings()` upserts the document if it doesn't
 * exist, so callers never need to handle "no settings yet" branches.
 */
const systemSettingsSchema = new mongoose.Schema(
  {
    // A sentinel key so we always find the single instance.
    key: {
      type: String,
      default: 'global',
      unique: true,
      immutable: true,
    },

    platformCommission: {
      type: Number,
      min: 0,
      max: 100,
      default: 10,
    },

    minWithdrawalAmount: {
      type: Number,
      min: 0,
      default: 50,
    },

    maxUploadSize: {
      type: Number,
      min: 1,
      max: 5000,
      default: 50, // MB
    },

    // Reserved for future settings. Free-form so we don't need a schema
    // migration every time we add a feature flag. Code that reads these
    // should validate the shape.
    flags: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

/**
 * Get the (single) settings document, creating it with defaults if missing.
 *
 * Use this in service code that needs to read settings — never
 * `findOne()` directly, because the first read on a fresh DB would
 * return null.
 */
systemSettingsSchema.statics.getSettings = async function () {
  return this.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global' } },
    { new: true, upsert: true }
  );
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
export default SystemSettings;
