import mongoose from 'mongoose';

const songSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  album: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Album'
  },
  featuredArtists: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist'
  }],
  genre: {
    type: String,
    enum: ['Afrobeat', 'Hip Hop', 'R&B', 'Dancehall', 'Reggae', 'Gospel', 
           'Traditional', 'Amapiano', 'Cuundu', 'Kalindula', 'Other'],
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  audioUrl: {
    type: String,
    required: true
  },
  videoUrl: {
    type: String,
    default: null
  },
  videoFileId: String,
  audioFileId: String,
  coverArt: {
    type: String,
    default: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300'
  },
  isVideo: {
    type: Boolean,
    default: false
  },
  qualityVersions: {
    low: String,
    medium: String,
    high: String
  },
  waveform: String,
  price: {
    type: Number,
    default: 0
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  isExplicit: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'featured'],
    default: 'pending'
  },
  playCount: {
    type: Number,
    default: 0
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  commentCount: {
    type: Number,
    default: 0
  },
  shareCount: {
    type: Number,
    default: 0
  },
  revenue: {
    type: Number,
    default: 0
  },
  releaseDate: {
    type: Date,
    default: Date.now
  },
  lyrics: String,
  tags: [String],
  language: String,
  mood: String,
  bpm: Number,
  key: String,
  isPromoted: {
    type: Boolean,
    default: false
  },
  promotionExpiry: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Text index for search
songSchema.index({ title: 'text', tags: 'text', genre: 'text' });

// Methods
songSchema.methods.incrementPlayCount = async function() {
  this.playCount++;
  this.updatedAt = Date.now();
  await this.save();
};

songSchema.methods.incrementDownloadCount = async function() {
  this.downloadCount++;
  await this.save();
};

const Song = mongoose.model('Song', songSchema);
export default Song;