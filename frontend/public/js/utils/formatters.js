/**
 * Formatter Functions
 */

const Formatters = {
    // Format number
    formatNumber: (num) => {
        if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    },

    // Format currency
    formatCurrency: (amount, currency = 'ZMW') => {
        return new Intl.NumberFormat('en-ZM', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    },

    // Format duration
    formatDuration: (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    },

    // Format date
    formatDate: (date, format = 'short') => {
        const d = new Date(date);
        
        switch(format) {
            case 'short':
                return d.toLocaleDateString('en-ZM');
            case 'long':
                return d.toLocaleDateString('en-ZM', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            case 'full':
                return d.toLocaleDateString('en-ZM', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            case 'relative':
                const now = new Date();
                const diff = now - d;
                const seconds = Math.floor(diff / 1000);
                const minutes = Math.floor(seconds / 60);
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);
                const weeks = Math.floor(days / 7);
                const months = Math.floor(days / 30);
                const years = Math.floor(days / 365);
                
                if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
                if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
                if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
                if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
                if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
                if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
                return 'Just now';
            default:
                return d.toISOString().split('T')[0];
        }
    },

    // Format file size
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Truncate text
    truncate: (text, maxLength = 100, suffix = '...') => {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + suffix;
    },

    // Capitalize
    capitalize: (str) => {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },

    // Title case
    titleCase: (str) => {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    },

    // Slugify
    slugify: (str) => {
        return str.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/--+/g, '-').trim();
    },

    // Get initials
    getInitials: (name) => {
        if (!name) return '';
        return name.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 2);
    },

    // Format phone (Zambian)
    formatPhone: (phone) => {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10 && cleaned.startsWith('09')) {
            return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
        }
        if (cleaned.length === 12 && cleaned.startsWith('260')) {
            return '+' + cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
        }
        return phone;
    },

    // Format percentage
    formatPercentage: (value, total) => {
        if (total === 0) return '0%';
        return ((value / total) * 100).toFixed(1) + '%';
    },

    // Format rating stars
    formatRating: (rating, maxRating = 5) => {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = maxRating - Math.ceil(rating);
        return '★'.repeat(fullStars) + (hasHalfStar ? '½' : '') + '☆'.repeat(emptyStars);
    },

    // Add ordinal suffix to number (1st, 2nd, 3rd)
    ordinalSuffix: (num) => {
        const j = num % 10;
        const k = num % 100;
        if (j === 1 && k !== 11) return num + 'st';
        if (j === 2 && k !== 12) return num + 'nd';
        if (j === 3 && k !== 13) return num + 'rd';
        return num + 'th';
    }
};

window.Formatters = Formatters;