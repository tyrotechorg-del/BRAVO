/**
 * Form Validators
 */

class Validators {
    // Required field
    static required(value, fieldName = 'This field') {
        if (!value || (typeof value === 'string' && !value.trim())) {
            return `${fieldName} is required`;
        }
        return null;
    }

    // Min length
    static minLength(value, min, fieldName = 'This field') {
        if (value && value.length < min) {
            return `${fieldName} must be at least ${min} characters`;
        }
        return null;
    }

    // Max length
    static maxLength(value, max, fieldName = 'This field') {
        if (value && value.length > max) {
            return `${fieldName} must not exceed ${max} characters`;
        }
        return null;
    }

    // Email validation
    static email(value) {
        if (!value) return null;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return 'Please enter a valid email address';
        }
        return null;
    }

    // Password validation
    static password(value) {
        if (!value) return null;
        if (value.length < 6) {
            return 'Password must be at least 6 characters';
        }
        if (!/[A-Z]/.test(value)) {
            return 'Password must contain at least one uppercase letter';
        }
        if (!/[0-9]/.test(value)) {
            return 'Password must contain at least one number';
        }
        return null;
    }

    // Password match
    static confirmPassword(password, confirmPassword) {
        if (password !== confirmPassword) {
            return 'Passwords do not match';
        }
        return null;
    }

    // URL validation
    static url(value) {
        if (!value) return null;
        const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        if (!urlRegex.test(value)) {
            return 'Please enter a valid URL';
        }
        return null;
    }

    // Number validation
    static number(value, min, max, fieldName = 'This field') {
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
    }

    // File size validation
    static fileSize(file, maxMB, fieldName = 'This file') {
        if (!file) return null;
        const maxBytes = maxMB * 1024 * 1024;
        if (file.size > maxBytes) {
            return `${fieldName} must be less than ${maxMB}MB`;
        }
        return null;
    }

    // File type validation
    static fileType(file, allowedTypes, fieldName = 'This file') {
        if (!file) return null;
        if (!allowedTypes.includes(file.type)) {
            return `${fieldName} must be of type: ${allowedTypes.join(', ')}`;
        }
        return null;
    }

    // Phone number validation (Zambian)
    static phoneZambia(value) {
        if (!value) return null;
        const phoneRegex = /^(09|09[5-7]|2609|2609[5-7])[0-9]{8}$/;
        if (!phoneRegex.test(value.replace(/\D/g, ''))) {
            return 'Please enter a valid Zambian phone number (e.g., 0977123456)';
        }
        return null;
    }

    // Username validation
    static username(value) {
        if (!value) return null;
        if (value.length < 3) {
            return 'Username must be at least 3 characters';
        }
        if (value.length > 30) {
            return 'Username must not exceed 30 characters';
        }
        if (!/^[a-zA-Z0-9_]+$/.test(value)) {
            return 'Username can only contain letters, numbers, and underscores';
        }
        return null;
    }

    // Validate form
    static validateForm(formData, rules) {
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
    }

    // Show form errors
    static showFormErrors(form, errors) {
        form.querySelectorAll('.field-error').forEach(el => el.remove());
        form.querySelectorAll('.error-input').forEach(el => el.classList.remove('error-input'));
        
        for (const [field, message] of Object.entries(errors)) {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
                input.classList.add('error-input');
                const errorDiv = document.createElement('div');
                errorDiv.className = 'field-error';
                errorDiv.textContent = message;
                input.parentNode.insertBefore(errorDiv, input.nextSibling);
            }
        }
    }

    // Clear form errors
    static clearFormErrors(form) {
        form.querySelectorAll('.field-error').forEach(el => el.remove());
        form.querySelectorAll('.error-input').forEach(el => el.classList.remove('error-input'));
    }

    // Validate entire form on submit
    static attachValidation(form, rules, onSubmit) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const result = this.validateForm(formData, rules);
            
            if (result.isValid) {
                onSubmit(formData);
            } else {
                this.showFormErrors(form, result.errors);
            }
        });
        
        form.querySelectorAll('input, select, textarea').forEach(input => {
            input.addEventListener('input', () => {
                input.classList.remove('error-input');
                const errorDiv = input.parentNode.querySelector('.field-error');
                if (errorDiv) errorDiv.remove();
            });
        });
    }
}

window.Validators = Validators;