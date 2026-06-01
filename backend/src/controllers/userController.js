import User from '../models/User.js';
import Artist from '../models/Artist.js';
import Playlist from '../models/Playlist.js';
import Wallet from '../models/Wallet.js';
import Like from '../models/Like.js';
import Comment from '../models/Comment.js';
import Song from '../models/Song.js';
import Notification from '../models/Notification.js';
import Analytics from '../models/Analytics.js';
import storageService from '../services/storageService.js';

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires');
    
    let artistProfile = null;
    if (user.role === 'artist') {
      artistProfile = await Artist.findOne({ userId: user._id });
    }
    
    const wallet = await Wallet.findOne({ user: user._id });
    
    res.json({
      user,
      artistProfile,
      wallet: wallet ? { balance: wallet.balance, totalEarned: wallet.totalEarned } : null
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const updates = ['fullName', 'bio', 'location', 'socialLinks', 'preferences'];
    const updateData = {};
    
    updates.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    if (req.file) {
      const avatarUrl = await storageService.uploadImage(req.file, 'avatars');
      updateData.avatar = avatarUrl;
    }
    
    updateData.updatedAt = Date.now();
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const getFollowers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('followers', 'username fullName avatar');
    res.json(user.followers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
};

export const getFollowing = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('following', 'username fullName avatar');
    res.json(user.following);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch following' });
  }
};

export const followUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }
    
    if (req.user.following.includes(targetUser._id)) {
      return res.status(400).json({ error: 'Already following this user' });
    }
    
    req.user.following.push(targetUser._id);
    targetUser.followers.push(req.user._id);
    
    await req.user.save();
    await targetUser.save();
    
    const notification = new Notification({
      user: targetUser._id,
      type: 'follow',
      title: 'New Follower',
      message: `${req.user.username} started following you`,
      data: { followerId: req.user._id }
    });
    await notification.save();
    
    res.json({ message: 'User followed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
};

export const unfollowUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    req.user.following = req.user.following.filter(id => id.toString() !== targetUser._id.toString());
    targetUser.followers = targetUser.followers.filter(id => id.toString() !== req.user._id.toString());
    
    await req.user.save();
    await targetUser.save();
    
    res.json({ message: 'User unfollowed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
};

export const getListeningHistory = async (req, res) => {
  try {
    const history = await Analytics.find({ 
      user: req.user._id, 
      action: 'stream' 
    })
    .sort({ timestamp: -1 })
    .limit(50)
    .populate('song', 'title coverArt artist duration');
    
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch listening history' });
  }
};

export const getUserPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find({ user: req.user._id })
      .populate('songs', 'title coverArt duration');
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
};

export const getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('preferences email username');
    res.json({
      email: user.email,
      username: user.username,
      preferences: user.preferences
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { preferences, email, username } = req.body;
    
    if (email && email !== req.user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      req.user.email = email;
    }
    
    if (username && username !== req.user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      req.user.username = username;
    }
    
    if (preferences) {
      req.user.preferences = { ...req.user.preferences, ...preferences };
    }
    
    await req.user.save();
    
    res.json({ message: 'Settings updated successfully', user: req.user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    await Like.deleteMany({ user: req.user._id });
    await Comment.deleteMany({ user: req.user._id });
    await Playlist.deleteMany({ user: req.user._id });
    await Wallet.deleteOne({ user: req.user._id });
    
    if (req.user.role === 'artist') {
      await Artist.deleteOne({ userId: req.user._id });
      const songs = await Song.find({ artist: req.user._id });
      for (const song of songs) {
        await storageService.deleteFile(song.audioUrl);
      }
      await Song.deleteMany({ artist: req.user._id });
    }
    
    await User.findByIdAndDelete(req.user._id);
    
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};