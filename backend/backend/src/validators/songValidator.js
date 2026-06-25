const { body } = require('express-validator');

exports.validateSongUpload = [
    body('title')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Title must be between 1 and 200 characters'),
    
    body('genre')
        .trim()
        .notEmpty()
        .withMessage('Genre is required'),
    
    body('price')
        .optional()
        .isFloat({ min: 0, max: 1000 })
        .withMessage('Price must be between 0 and 1000'),
    
    body('isPremium')
        .optional()
        .isBoolean()
        .withMessage('isPremium must be a boolean'),
    
    body('tags')
        .optional()
        .isString()
        .withMessage('Tags must be a string')
];

exports.validateSongUpdate = [
    body('title')
        .optional()
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Title must be between 1 and 200 characters'),
    
    body('genre')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Genre cannot be empty'),
    
    body('isExplicit')
        .optional()
        .isBoolean()
        .withMessage('isExplicit must be a boolean')
];