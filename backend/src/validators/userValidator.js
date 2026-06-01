const { body } = require('express-validator');

exports.validateProfileUpdate = [
    body('fullName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters'),
    
    body('bio')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Bio cannot exceed 500 characters'),
    
    body('location')
        .optional()
        .isObject()
        .withMessage('Location must be an object'),
    
    body('socialLinks')
        .optional()
        .isObject()
        .withMessage('Social links must be an object')
];

exports.validateSettingsUpdate = [
    body('preferences.language')
        .optional()
        .isIn(['en', 'fr', 'pt'])
        .withMessage('Language must be en, fr, or pt'),
    
    body('preferences.theme')
        .optional()
        .isIn(['light', 'dark'])
        .withMessage('Theme must be light or dark'),
    
    body('email')
        .optional()
        .isEmail()
        .withMessage('Please provide a valid email'),
    
    body('username')
        .optional()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores')
];