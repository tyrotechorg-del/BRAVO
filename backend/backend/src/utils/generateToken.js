import jwt from 'jsonwebtoken';

export const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'bravo-music-secret-key-2024',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

export const generateRefreshToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_REFRESH_SECRET || 'bravo-music-refresh-secret-key-2024',
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );
};

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET || 'bravo-music-secret-key-2024');
    } catch (error) {
        return null;
    }
};

export const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'bravo-music-refresh-secret-key-2024');
    } catch (error) {
        return null;
    }
};

export default { generateToken, generateRefreshToken, verifyToken, verifyRefreshToken };