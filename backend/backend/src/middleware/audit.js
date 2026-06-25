import AdminLog from '../models/AdminLog.js';

export const auditLog = (action) => {
  return async (req, res, next) => {
    const originalSend = res.json;
    
    res.json = async function(data) {
      if (req.user && req.user.role === 'admin') {
        try {
          const log = new AdminLog({
            admin: req.user._id,
            action: action,
            target: req.params.id || req.body.id,
            details: {
              method: req.method,
              url: req.url,
              body: req.body,
              params: req.params,
              query: req.query
            },
            ip: req.ip,
            userAgent: req.get('user-agent')
          });
          await log.save();
        } catch (error) {
          console.error('Audit log error:', error);
        }
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

export default auditLog;