import { verifyToken } from '../config/jwt.js';
import User from '../models/User.js';

export const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error();
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      throw new Error();
    }
    
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      throw new Error();
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

export const requireVerified = async (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({ error: 'Email not verified' });
  }
  next();
};