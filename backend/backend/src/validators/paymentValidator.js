const { body } = require('express-validator');

exports.validatePaymentInitiate = [
    body('amount')
        .isFloat({ min: 1, max: 10000 })
        .withMessage('Amount must be between 1 and 10000'),
    
    body('type')
        .isIn(['subscription', 'upload_credit', 'deposit', 'promotion', 'purchase'])
        .withMessage('Invalid payment type'),
    
    body('method')
        .isIn(['mtn_money', 'airtel_money', 'zamtel_kwacha', 'card'])
        .withMessage('Invalid payment method'),
    
    body('phoneNumber')
        .if(body('method').isIn(['mtn_money', 'airtel_money', 'zamtel_kwacha']))
        .matches(/^(09|09[5-7]|2609|2609[5-7])[0-9]{8}$/)
        .withMessage('Please provide a valid Zambian phone number')
];

exports.validateWithdrawal = [
    body('amount')
        .isFloat({ min: 50 })
        .withMessage('Minimum withdrawal amount is 50 ZMW'),
    
    body('method')
        .isIn(['mtn_money', 'airtel_money', 'zamtel_kwacha', 'bank_transfer'])
        .withMessage('Invalid withdrawal method'),
    
    body('accountDetails')
        .isObject()
        .withMessage('Account details are required')
];