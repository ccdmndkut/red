// utils.js - Define utility functions in global scope

/**
 * Capitalizes the first letter of a string.
 * @param {string} s The string to capitalize.
 * @returns {string} The capitalized string or an empty string if input is falsy.
 */
const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

/**
 * Formats a Unix timestamp into a relative time string (e.g., "5m ago").
 * @param {number} timestamp Unix timestamp in seconds.
 * @returns {string} Relative time string.
 */
const formatTime = (timestamp) => {
    const seconds = Math.floor(Date.now() / 1000) - timestamp;
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};

// Add any other small, pure utility functions here if needed.