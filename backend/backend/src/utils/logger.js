const logger = {
    info: (message, data = null) => {
        console.log(`[INFO] ${new Date().toISOString()}: ${message}`, data || '');
    },
    error: (message, error = null) => {
        console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error || '');
    },
    warn: (message, data = null) => {
        console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, data || '');
    },
    debug: (message, data = null) => {
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[DEBUG] ${new Date().toISOString()}: ${message}`, data || '');
        }
    }
};

export default logger;