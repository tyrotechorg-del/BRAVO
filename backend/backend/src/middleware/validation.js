import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

export const validateFile = (req, res, next) => {
  if (!req.files && !req.file) {
    return res.status(400).json({ error: 'File is required' });
  }
  next();
};

export default { validate, validateFile };