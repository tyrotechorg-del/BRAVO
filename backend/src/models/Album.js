import mongoose from 'mongoose';

const albumSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  songs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song'
  }],
  coverArt: {
    type: String,
    required: true
  },
  description: String,
  genre: {
    type: String,
    enum: ['Afrobeat', 'Hip Hop', 'R&B', 'Dancehall', 'Reggae', 'Gospel',
           'Traditional', 'Amapiano', 'Cuundu', 'Kalindula', 'Other'],
    required: true
  },
  releaseDate: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['album', 'ep', 'single', 'compilation'],
    default: 'album'
  },
  price: {
    type: Number,
    default: 0
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  totalStreams: {
    type: Number,
    default: 0
  },
  totalDownloads: {
    type: Number,
    default: 0
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

const Album = mongoose.model('Album', albumSchema);
export default Album;