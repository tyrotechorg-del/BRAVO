

class Validators {
    static required(value, fieldName = 'This field') {
        if (!value || (typeof value === 'string' && !value.trim())) {
            return `${fieldName} is required`;
        }
        return null;
    }

    static minLength(value, min, fieldName = 'This field') {
        if (value && value.length < min) {
            return `${fieldName} must be at least ${min} characters`;
        }
        return null;
    }

    static maxLength(value, max, fieldName = 'This field') {
        if (value && value.length > max) {
            return `${fieldName} must not exceed ${max} characters`;
        }
        return null;
    }

    static email(value) {
        if (!value) return null;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return 'Please enter a valid email address';
        }
        return null;
    }

    static password(value) {
        if (!value) return null;
        if (value.length < 8) {
            return 'Password must be at least 8 characters';
        }
        if (!/[A-Z]/.test(value)) {
            return 'Password must contain at least one uppercase letter';
        }
        if (!/[0-9]/.test(value)) {
            return 'Password must contain at least one number';
        }
        if (!/[^A-Za-z0-9]/.test(value)) {
            return 'Password must contain at least one special character';
        }
        return null;
    }

    static confirmPassword(password, confirmPassword) {
        if (password !== confirmPassword) {
            return 'Passwords do not match';
        }
        return null;
    }

    // Username: letters, numbers, dot, underscore, hyphen.
    static username(value) {
        if (!value) return null;
        if (value.length < 3 || value.length > 30) {
            return 'Username must be 3-30 characters';
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
            return 'Username can only contain letters, numbers, dots, underscores, and hyphens';
        }
        return null;
    }

    // Zambian phone format: 09xxxxxxxx, +260xxxxxxxxx, 260xxxxxxxxx.
    static phoneNumber(value) {
        if (!value) return null;
        const cleaned = String(value).replace(/[\s-]/g, '');
        if (!/^(\+?260|0)?[97][567]\d{7}$/.test(cleaned)) {
            return 'Please enter a valid Zambian phone number';
        }
        return null;
    }

    static url(value) {
        if (!value) return null;
        try {
            new URL(value);
            return null;
        } catch {
            return 'Please enter a valid URL';
        }
    }

    static number(value, fieldName = 'This field') {
        if (value === null || value === undefined || value === '') return null;
        const num = Number(value);
        if (!Number.isFinite(num)) {
            return `${fieldName} must be a number`;
        }
        return null;
    }

    static min(value, min, fieldName = 'This field') {
        const num = Number(value);
        if (Number.isFinite(num) && num < min) {
            return `${fieldName} must be at least ${min}`;
        }
        return null;
    }

    static max(value, max, fieldName = 'This field') {
        const num = Number(value);
        if (Number.isFinite(num) && num > max) {
            return `${fieldName} must not exceed ${max}`;
        }
        return null;
    }

    static fileSize(file, maxSizeMB) {
        if (!file) return null;
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > maxSizeMB) {
            return `File size must not exceed ${maxSizeMB}MB`;
        }
        return null;
    }

    static fileType(file, allowedTypes) {
        if (!file) return null;
        if (!allowedTypes.includes(file.type)) {
            return `File type not allowed. Allowed: ${allowedTypes.join(', ')}`;
        }
        return null;
    }

    /**
     * Validate a whole form-values object against a schema.
     * Returns { isValid, errors } where errors is { field: 'message' }.
     */
    static validateForm(values, schema) {
        const errors = {};
        for (const [field, rules] of Object.entries(schema)) {
            const value = values[field];
            for (const rule of rules) {
                const err = rule(value, values);
                if (err) {
                    errors[field] = err;
                    break; // first error per field
                }
            }
        }
        return { isValid: Object.keys(errors).length === 0, errors };
    }
}

window.Validators = Validators;
