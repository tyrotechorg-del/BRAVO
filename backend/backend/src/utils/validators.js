export const required = (value, fieldName = 'This field') => {
    if (!value || (typeof value === 'string' && !value.trim())) {
        return `${fieldName} is required`;
    }
    return null;
};

export const minLength = (value, min, fieldName = 'This field') => {
    if (value && value.length < min) {
        return `${fieldName} must be at least ${min} characters`;
    }
    return null;
};

export const maxLength = (value, max, fieldName = 'This field') => {
    if (value && value.length > max) {
        return `${fieldName} must not exceed ${max} characters`;
    }
    return null;
};

export const isValidEmail = (value) => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
        return 'Please enter a valid email address';
    }
    return null;
};

export const isValidPassword = (value) => {
    if (!value) return null;
    if (value.length < 6) {
        return 'Password must be at least 6 characters';
    }
    return null;
};

export const passwordsMatch = (password, confirmPassword) => {
    if (password !== confirmPassword) {
        return 'Passwords do not match';
    }
    return null;
};

export const isValidUrl = (value) => {
    if (!value) return null;
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlRegex.test(value)) {
        return 'Please enter a valid URL';
    }
    return null;
};

export const isValidNumber = (value, min, max, fieldName = 'This field') => {
    const num = parseFloat(value);
    if (isNaN(num)) {
        return `${fieldName} must be a number`;
    }
    if (min !== undefined && num < min) {
        return `${fieldName} must be at least ${min}`;
    }
    if (max !== undefined && num > max) {
        return `${fieldName} must not exceed ${max}`;
    }
    return null;
};

export const validateForm = (formData, rules) => {
    const errors = {};
    
    for (const [field, validators] of Object.entries(rules)) {
        const value = formData.get(field);
        
        for (const validator of validators) {
            const error = validator(value, field);
            if (error) {
                errors[field] = error;
                break;
            }
        }
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};