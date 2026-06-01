import User from '../models/User.js';
import Artist from '../models/Artist.js';
import Wallet from '../models/Wallet.js';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../config/jwt.js';
import crypto from 'crypto';
import emailService from '../services/emailService.js';

export const register = async (req, res) => {
  try {
    const { username, email, password, fullName, role } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // ARTISTS need email verification, LISTENERS do NOT
    const needsVerification = role === 'artist';
    
    const user = new User({
      username,
      email,
      password,
      fullName,
      role: role || 'listener',
      isVerified: !needsVerification // Listeners are auto-verified, artists need verification
    });

    // Only generate verification token for artists
    if (needsVerification) {
      user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
    }
    
    await user.save();

    const wallet = new Wallet({ user: user._id });
    await wallet.save();

    if (role === 'artist') {
      const artist = new Artist({
        userId: user._id,
        stageName: username,
        subscriptionStatus: 'inactive'
      });
      await artist.save();
      
      // Send verification email only to artists
      await emailService.sendVerificationEmail(user.email, user.emailVerificationToken);
    }

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const responseMessage = role === 'artist' 
      ? 'Registration successful. Please verify your email to start uploading music.'
      : 'Registration successful! Welcome to Bravo Music!';

    res.status(201).json({
      message: responseMessage,
      token,
      refreshToken,
      user: user.toJSON()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Only ARTISTS need email verification, LISTENERS can login without verification
    if (user.role === 'artist' && !user.isVerified) {
      return res.status(401).json({ error: 'Please verify your email first. Check your inbox for verification link.' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: user.toJSON()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ emailVerificationToken: token });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully! You can now upload music.' });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'artist') {
      return res.status(400).json({ error: 'Email verification is not required for listeners' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new token
    user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
    await user.save();

    // Resend email
    await emailService.sendVerificationEmail(user.email, user.emailVerificationToken);

    res.json({ message: 'Verification email resent successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to resend verification' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 3600000;
    await user.save();

    await emailService.sendPasswordResetEmail(user.email, resetToken);

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send reset email' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: 'Password reset failed' });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const decoded = verifyRefreshToken(refreshToken);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    const newToken = generateToken(decoded.userId);
    const newRefreshToken = generateRefreshToken(decoded.userId);

    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const logout = async (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

