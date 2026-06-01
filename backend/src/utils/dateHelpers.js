const formatDate = (date, format = 'ISO') => {
    const d = new Date(date);
    
    switch(format) {
        case 'ISO':
            return d.toISOString();
        case 'DATE':
            return d.toISOString().split('T')[0];
        case 'DATETIME':
            return d.toISOString().replace('T', ' ').substring(0, 19);
        case 'READABLE':
            return d.toLocaleDateString('en-ZM', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        default:
            return d;
    }
};

const getDateRange = (period) => {
    const now = new Date();
    const start = new Date();
    
    switch(period) {
        case 'today':
            start.setHours(0, 0, 0, 0);
            break;
        case 'yesterday':
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            now.setDate(now.getDate() - 1);
            now.setHours(23, 59, 59, 999);
            break;
        case 'week':
            start.setDate(start.getDate() - 7);
            break;
        case 'month':
            start.setMonth(start.getMonth() - 1);
            break;
        case 'quarter':
            start.setMonth(start.getMonth() - 3);
            break;
        case 'year':
            start.setFullYear(start.getFullYear() - 1);
            break;
        default:
            start.setDate(start.getDate() - 30);
    }
    
    return { start, end: now };
};

const isExpired = (date) => {
    return new Date(date) < new Date();
};

const daysBetween = (date1, date2) => {
    const diffTime = Math.abs(new Date(date2) - new Date(date1));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const addMonths = (date, months) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
};

module.exports = {
    formatDate,
    getDateRange,
    isExpired,
    daysBetween,
    addDays,
    addMonths
};