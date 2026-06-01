const { body } = require('express-validator');

exports.validateRegister = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    
    body('fullName')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters'),
    
    body('role')
        .optional()
        .isIn(['listener', 'artist'])
        .withMessage('Role must be either listener or artist')
];

exports.validateLogin = [
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email'),
    
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

exports.validateForgotPassword = [
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email')
];

exports.validateResetPassword = [
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
];