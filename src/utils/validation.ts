
export const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const validatePassword = (password: string): boolean => {
    return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#$%^&*()!]{8,}$/.test(password);
};

export const validatePhone = (phone: string): boolean => {
    // Adjust regex based on your phone format requirements
    return /^\+?[\d\s-]{10,}$/.test(phone);
};