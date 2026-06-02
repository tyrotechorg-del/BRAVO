import mongoose from 'mongoose';

const artistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  stageName: {
    type: String,
    required: true,
    unique: true
  },
  genres: [{
    type: String,
    enum: ['Afrobeat', 'Hip Hop', 'R&B', 'Dancehall', 'Reggae', 'Cuundu', 'Kalindula', 'Gospel', 'Traditional', 'Amapiano', 'Other']
  }],
  verified: {
    type: Boolean,
    default: false
  },
  featured: {
    type: Boolean,
    default: false
  },
  monthlyListeners: {
    type: Number,
    default: 0
  },
  totalStreams: {
    type: Number,
    default: 0
  },
  totalDownloads: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'inactive', 'expired', 'suspended'],
    default: 'inactive'
  },
  currentPlan: {
    type: String,
    enum: ['basic', 'pro', 'vip', 'none'],
    default: 'none'
  },
  subscriptionExpiry: Date,
  uploadCredits: {
    type: Number,
    default: 0
  },
  uploadCreditsExpiry: Date,
  uploadLimit: {
    type: Number,
    default: 0
  },
  songsUploaded: {
    type: Number,
    default: 0
  },
  albumsUploaded: {
    type: Number,
    default: 0
  },
  promotionalBalance: {
    type: Number,
    default: 0
  },
  website: String,
  recordLabel: String,
  establishmentYear: Number,
  bannerImage: String,
  avatar: {
    type: String,
    default: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150'
  },
  bio: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

artistSchema.methods.canUpload = function() {
  if (this.subscriptionStatus === 'active' && this.subscriptionExpiry > new Date()) {
    return true;
  }
  if (this.uploadCredits > 0 && this.uploadCreditsExpiry > new Date()) {
    return true;
  }
  return false;
};

artistSchema.methods.useUploadCredit = async function() {
  if (this.uploadCredits > 0) {
    this.uploadCredits--;
    this.updatedAt = Date.now();
    await this.save();
    return true;
  }
  return false;
};

const Artist = mongoose.model('Artist', artistSchema);
export default Artist;