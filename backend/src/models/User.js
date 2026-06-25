import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      // Don't allow whitespace or special chars in usernames — they
      // turn into URL escaping problems for profile routes.
      match: /^[a-zA-Z0-9_.-]+$/,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // Loose RFC-shaped check. Real validation happens at signup time
      // (controller does typeof check + includes '@'); this catches
      // obvious garbage at the DB level.
      match: /^\S+@\S+\.\S+$/,
    },
    password: {
      type: String,
      required: true,
      // Schema enforces 6 here as defense-in-depth; the controller
      // enforces 8 + complexity. Don't tighten this to 8 — older
      // accounts pre-policy may have shorter (still-hashed) passwords
      // and we'd lock them out.
      minlength: 6,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    avatar: {
      type: String,
      default: 'images/bravo.png',
    },
    coverImage: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      maxlength: 500,
      default: '',
    },
    role: {
      type: String,
      enum: ['listener', 'artist', 'admin'],
      default: 'listener',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    emailVerificationToken: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },
    passwordResetToken: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },

    socialLinks: {
      facebook: String,
      twitter: String,
      instagram: String,
      spotify: String,
      appleMusic: String,
    },
    location: {
      country: String,
      city: String,
    },
    preferences: {
      language: { type: String, default: 'en' },
      theme: { type: String, enum: ['light', 'dark'], default: 'dark' },
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        comments: { type: Boolean, default: true },
        followers: { type: Boolean, default: true },
        subscriptions: { type: Boolean, default: true },
      },
      // Listener prefs added so the controller's allowlist
      // (autoplay, highQualityStreaming, downloadOverWifi) has a home.
      autoplay: { type: Boolean, default: true },
      highQualityStreaming: { type: Boolean, default: false },
      downloadOverWifi: { type: Boolean, default: true },
    },

    // Followers/following are embedded arrays. This works for typical
    // accounts but grows unbounded — at 100k+ followers, every read
    // of this user document fetches all of them. Flagged for refactor
    // into a separate Follow collection in a future batch.
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    lastLogin: { type: Date, default: null },
  },
  {
    // FIX: Use Mongoose-managed timestamps. The original hand-rolled
    // createdAt/updatedAt with a pre-save hook that updated `updatedAt`,
    // but `findOneAndUpdate` bypasses pre-save — so direct updates
    // (which we now use almost everywhere) never refreshed `updatedAt`.
    // `{ timestamps: true }` makes Mongoose handle this for both save()
    // and findOneAndUpdate.
    timestamps: true,
  }
);

// ============================================================
// Indexes
// ============================================================
// `username` and `email` are already unique. Add a non-unique index on
// `role` so admin listings (`role: 'artist'`) can scan efficiently.
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

// ============================================================
// Pre-save hooks
// ============================================================

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Methods
// ============================================================

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// `updatePassword` triggers the pre-save hash via .save().
userSchema.methods.updatePassword = async function (newPassword) {
  this.password = newPassword;
  await this.save();
};

userSchema.methods.generateVerificationToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = token;
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  return token;
};

userSchema.methods.generatePasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = token;
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  return token;
};

userSchema.methods.isVerificationTokenValid = function (token) {
  return (
    this.emailVerificationToken === token &&
    this.emailVerificationExpires &&
    this.emailVerificationExpires > Date.now()
  );
};

userSchema.methods.isResetTokenValid = function (token) {
  return (
    this.passwordResetToken === token &&
    this.passwordResetExpires &&
    this.passwordResetExpires > Date.now()
  );
};

// Sensitive fields removed when serialising for API responses.
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.__v;
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;
