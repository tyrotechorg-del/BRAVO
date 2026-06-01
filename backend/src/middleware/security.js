import helmet from 'helmet';
import cors from 'cors';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import dotenv from 'dotenv';

dotenv.config();
export const securityMiddleware = [
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }),
  
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }),
  
  mongoSanitize(),
  
  xss(),
  
  (req, res, next) => {
    if (req.query) {
      for (const key in req.query) {
        if (typeof req.query[key] === 'string') {
          req.query[key] = req.query[key].trim();
        }
      }
    }
    next();
  }
];

export default securityMiddleware;