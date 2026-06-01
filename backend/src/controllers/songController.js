import Song from '../models/Song.js';
import Artist from '../models/Artist.js';
import Album from '../models/Album.js';
import Like from '../models/Like.js';
import storageService from '../services/storageService.js';
import audioService from '../services/audioService.js';
import notificationService from '../services/notificationService.js';

export const getSongs = async (req, res) => {
  try {
    const { page = 1, limit = 20, genre } = req.query;
    const query = { status: 'approved' };
    if (genre && genre !== 'all') query.genre = genre;
    
    const songs = await Song.find(query)
      .populate('artist', 'stageName verified avatar')
      .sort({ playCount: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Song.countDocuments(query);
    
    res.json({
      songs,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
};

export const getSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id)
      .populate('artist', 'stageName verified avatar')
      .populate('featuredArtists', 'stageName')
      .populate('album', 'title coverArt');
    
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    await song.incrementPlayCount();
    
    res.json(song);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch song' });
  }
};

export const getTrendingSongs = async (req, res) => {
  try {
    const trending = await Song.find({ status: 'approved' })
      .sort({ playCount: -1, likeCount: -1 })
      .limit(20)
      .populate('artist', 'stageName');
    
    res.json(trending);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trending songs' });
  }
};

export const getFeaturedSongs = async (req, res) => {
  try {
    const featured = await Song.find({ status: 'featured' })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('artist', 'stageName');
    
    res.json(featured);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch featured songs' });
  }
};

export const getRecentSongs = async (req, res) => {
  try {
    const recent = await Song.find({ status: 'approved' })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('artist', 'stageName');
    
    res.json(recent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recent songs' });
  }
};

export const uploadSong = async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.user._id });
    const isAdmin = req.user.role === 'admin';
    
    if (!isAdmin && !artist) {
      return res.status(403).json({ error: 'Only artists and admins can upload songs' });
    }
    
    let artistId = null;
    if (isAdmin && req.body.artistId) {
      const targetArtist = await Artist.findById(req.body.artistId);
      if (targetArtist) {
        artistId = targetArtist._id;
      } else {
        return res.status(404).json({ error: 'Artist not found' });
      }
    } else if (artist) {
      artistId = artist._id;
    }
    
    if (!artistId) {
      return res.status(403).json({ error: 'Artist profile required' });
    }
    
    if (!isAdmin && artist && !artist.canUpload()) {
      return res.status(403).json({ 
        error: 'Upload limit reached. Please subscribe or purchase upload credits.' 
      });
    }
    
    const { title, genre, price, isPremium, albumId, featuredArtists, lyrics, tags } = req.body;
    
    const audioFile = req.files?.audio;
    const coverArt = req.files?.coverArt;
    
    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    
    const audioUrl = await storageService.uploadAudio(audioFile, artistId);
    const coverArtUrl = coverArt ? await storageService.uploadImage(coverArt, 'covers') : 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300';
    const duration = await audioService.getDuration(audioFile.path);
    
    const song = new Song({
      title,
      artist: artistId,
      genre,
      duration,
      audioUrl,
      coverArt: coverArtUrl,
      price: price || 0,
      isPremium: isPremium === 'true' || isPremium === true,
      lyrics,
      tags: tags ? tags.split(',') : [],
      featuredArtists: featuredArtists ? featuredArtists.split(',') : [],
      status: isAdmin ? 'approved' : 'pending'
    });
    
    if (albumId) {
      const album = await Album.findById(albumId);
      if (album && album.artist.toString() === artistId.toString()) {
        song.album = albumId;
        album.songs.push(song._id);
        await album.save();
      }
    }
    
    await song.save();
    
    if (!isAdmin && artist) {
      await artist.useUploadCredit();
      artist.songsUploaded++;
      await artist.save();
    }
    
    if (!isAdmin) {
      await notificationService.notifyAdmins('New song pending approval', { title: song.title, artist: artist?.stageName });
    }
    
    res.status(201).json({
      message: isAdmin ? 'Song uploaded and approved successfully' : 'Song uploaded successfully, pending approval',
      song
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Upload failed' });
  }
};

export const likeSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    const existingLike = await Like.findOne({
      user: req.user._id,
      song: song._id,
      type: 'song'
    });
    
    if (existingLike) {
      await existingLike.deleteOne();
      song.likeCount = Math.max(0, song.likeCount - 1);
      await song.save();
      return res.json({ liked: false, message: 'Song unliked' });
    }
    
    const like = new Like({
      user: req.user._id,
      song: song._id,
      type: 'song'
    });
    await like.save();
    
    song.likeCount += 1;
    await song.save();
    
    res.json({ liked: true, message: 'Song liked' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to like song' });
  }
};

export const unlikeSong = async (req, res) => {
  try {
    const like = await Like.findOne({
      user: req.user._id,
      song: req.params.id,
      type: 'song'
    });
    
    if (!like) {
      return res.status(404).json({ error: 'Like not found' });
    }
    
    await like.deleteOne();
    
    const song = await Song.findById(req.params.id);
    if (song) {
      song.likeCount = Math.max(0, song.likeCount - 1);
      await song.save();
    }
    
    res.json({ liked: false, message: 'Song unliked' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unlike song' });
  }
};

export const streamSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    const stream = await storageService.getAudioStream(song.audioUrl);
    res.setHeader('Content-Type', 'audio/mpeg');
    stream.pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'Streaming failed' });
  }
};

export const getSongsByArtist = async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.params.artistId });
    if (!artist) {
      const songs = await Song.find({ 
        artist: req.params.artistId,
        status: 'approved'
      }).sort({ playCount: -1 });
      return res.json(songs);
    }
    
    const songs = await Song.find({ 
      artist: artist._id,
      status: 'approved'
    }).sort({ playCount: -1 });
    
    res.json(songs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch artist songs' });
  }
};

export const getSongsByGenre = async (req, res) => {
  try {
    const songs = await Song.find({
      genre: { $regex: new RegExp(req.params.genre, 'i') },
      status: 'approved'
    }).limit(50).populate('artist', 'stageName');
    
    res.json(songs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch songs by genre' });
  }
};

export const shareSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    song.shareCount += 1;
    await song.save();
    
    res.json({ message: 'Song shared successfully', shareCount: song.shareCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to share song' });
  }
};

export const getSongComments = async (req, res) => {
  try {
    const Comment = await import('../models/Comment.js');
    const { page = 1, limit = 20 } = req.query;
    
    const comments = await Comment.default.find({ 
      song: req.params.id, 
      parentComment: null,
      isDeleted: false
    })
    .populate('user', 'username avatar')
    .populate({
      path: 'replies',
      match: { isDeleted: false },
      populate: { path: 'user', select: 'username avatar' }
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
    
    const total = await Comment.default.countDocuments({ song: req.params.id, parentComment: null });
    
    res.json({
      comments,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    res.json({
      comments: [],
      totalPages: 0,
      currentPage: 1,
      total: 0
    });
  }
};

export const getAllVideos = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const videos = await Song.find({ 
            isVideo: true, 
            status: 'approved' 
        })
        .populate('artist', 'stageName verified avatar')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));
        
        const total = await Song.countDocuments({ isVideo: true, status: 'approved' });
        
        res.json({
            videos,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalVideos: total
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
};

export const streamVideo = async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);
        if (!song || !song.isVideo) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        const stream = await storageService.getVideoStream(song.videoUrl);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        stream.pipe(res);
        
        // Track play count
        await song.incrementPlayCount();
    } catch (error) {
        res.status(500).json({ error: 'Video streaming failed' });
    }
};


// DELETE SONG - New function
export const deleteSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Check authorization
    const artist = await Artist.findOne({ userId: req.user._id });
    const isAdmin = req.user.role === 'admin';
    
    if (!isAdmin && (!artist || song.artist.toString() !== artist._id.toString())) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Remove song from album if exists
    if (song.album) {
      await Album.findByIdAndUpdate(song.album, {
        $pull: { songs: song._id }
      });
    }

    // Delete audio file
    if (song.audioUrl && !song.audioUrl.startsWith('http')) {
      await storageService.deleteFile(song.audioUrl);
    }
    
    // Delete cover art if exists and not default
    if (song.coverArt && !song.coverArt.startsWith('http') && !song.coverArt.includes('unsplash')) {
      await storageService.deleteFile(song.coverArt);
    }

    await song.deleteOne();

    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete song' });
  }
};