/**
 * Duration Service - Standardized Duration Handling
 * 
 * All durations in the system are stored in MINUTES
 * This service provides utilities for validation, conversion, and display
 */

export interface DurationValidationResult {
    isValid: boolean;
    error?: string;
    correctedValue?: number;
}

// Constants
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 10080; // 7 days in minutes
const MINUTES_PER_HOUR = 60;

export const durationService = {
    /**
     * Validate that duration is in the correct range and unit
     * All durations should be in MINUTES
     * @param duration - Duration value to validate
     * @param context - Where this is being used (for error messages)
     */
    validateDurationMinutes(
        duration: number,
        context: string = 'Duration'
    ): DurationValidationResult {
        // Must be a number
        if (typeof duration !== 'number') {
            return {
                isValid: false,
                error: `${context}: Duration must be a number, got ${typeof duration}`,
            };
        }

        // Must be a positive integer
        if (!Number.isInteger(duration) || duration < 0) {
            return {
                isValid: false,
                error: `${context}: Duration must be a non-negative integer, got ${duration}`,
            };
        }

        // Minimum 1 minute (or 0 for unset)
        if (duration > 0 && duration < MIN_DURATION_MINUTES) {
            return {
                isValid: false,
                error: `${context}: Duration must be at least ${MIN_DURATION_MINUTES} minute, got ${duration}`,
            };
        }

        // Maximum 10080 minutes (7 days)
        if (duration > MAX_DURATION_MINUTES) {
            return {
                isValid: false,
                error: `${context}: Duration cannot exceed ${MAX_DURATION_MINUTES} minutes (7 days), got ${duration}`,
            };
        }

        return { isValid: true };
    },

    /**
     * Detect and auto-correct common duration errors
     * @param duration - Duration value that might be corrupted
     * @param context - Where this is being used
     */
    detectAndCorrectDuration(
        duration: number,
        context: string = 'Duration'
    ): DurationValidationResult {
        // First validate
        const validation = this.validateDurationMinutes(duration, context);
        if (validation.isValid) {
            return { isValid: true };
        }

        // If suspiciously small (1-24), might be hours instead of minutes
        if (duration > 0 && duration <= 24) {
            const corrected = duration * MINUTES_PER_HOUR;
            if (corrected <= MAX_DURATION_MINUTES) {
                return {
                    isValid: true,
                    correctedValue: corrected,
                    error: `${context}: Detected possible unit error - converted ${duration}h to ${corrected}m`,
                };
            }
        }

        // If suspiciously large (> 48), might need division by 60
        if (duration > MAX_DURATION_MINUTES && duration <= MAX_DURATION_MINUTES * 60) {
            const corrected = Math.round(duration / MINUTES_PER_HOUR);
            return {
                isValid: true,
                correctedValue: corrected,
                error: `${context}: Detected possible unit error - converted ${duration}m to ${corrected}h`,
            };
        }

        return validation;
    },

    /**
     * Convert minutes to human-readable display format
     * @param minutes - Duration in minutes
     * @returns Formatted string like "2h 30m" or "45m"
     */
    formatDurationForDisplay(minutes: number): string {
        if (minutes === null || minutes === undefined) {
            return 'N/A';
        }

        if (typeof minutes !== 'number' || minutes < 0) {
            return 'Invalid';
        }

        if (minutes === 0) {
            return 'N/A';
        }

        const hours = Math.floor(minutes / MINUTES_PER_HOUR);
        const mins = minutes % MINUTES_PER_HOUR;

        if (hours === 0) {
            return `${mins}m`;
        }

        if (mins === 0) {
            return `${hours}h`;
        }

        return `${hours}h ${mins}m`;
    },

    /**
     * Convert minutes to decimal hours for calculations
     * @param minutes - Duration in minutes
     * @returns Duration in hours (as decimal, rounded to 1 place)
     */
    minutesToHours(minutes: number): number {
        if (minutes <= 0) return 0;
        return Math.round((minutes / MINUTES_PER_HOUR) * 10) / 10;
    },

    /**
     * Convert hours to minutes for calculations
     * @param hours - Duration in hours (can be decimal)
     * @returns Duration in minutes (as integer)
     */
    hoursToMinutes(hours: number): number {
        if (hours <= 0) return 0;
        return Math.round(hours * MINUTES_PER_HOUR);
    },

    /**
     * Calculate total duration from array of lessons
     * @param lessons - Array of lessons with duration_minutes property
     * @returns Total duration in minutes
     */
    calculateTotalDuration(
        lessons: Array<{ duration_minutes?: number; duration?: number }>
    ): number {
        let total = 0;

        lessons.forEach((lesson) => {
            // Prefer duration_minutes, fallback to duration
            const duration = lesson.duration_minutes ?? lesson.duration ?? 0;

            // Validate before adding
            const validation = this.validateDurationMinutes(duration);
            if (validation.isValid) {
                total += duration;
            }
        });

        return total;
    },

    /**
     * Get duration range for display
     * @param minMinutes - Minimum duration in minutes
     * @param maxMinutes - Maximum duration in minutes
     * @returns Formatted string like "1h - 3h"
     */
    formatDurationRange(minMinutes: number, maxMinutes: number): string {
        const minFormatted = this.formatDurationForDisplay(minMinutes);
        const maxFormatted = this.formatDurationForDisplay(maxMinutes);

        if (minFormatted === maxFormatted) {
            return minFormatted;
        }

        return `${minFormatted} - ${maxFormatted}`;
    },

    /**
     * Parse a duration string and return minutes
     * Supports formats like "2h", "30m", "1h 30m", "90"
     * @param durationString - String to parse
     * @returns Duration in minutes, or null if invalid
     */
    parseDurationString(durationString: string): number | null {
        if (!durationString || typeof durationString !== 'string') {
            return null;
        }

        const trimmed = durationString.trim().toLowerCase();

        // Handle format: "2h 30m"
        const amountMatch = trimmed.match(/(\d+\.?\d*)\s*h\s*(\d+\.?\d*)\s*m/);
        if (amountMatch) {
            const hours = parseInt(amountMatch[1]);
            const mins = parseInt(amountMatch[2]);
            return hours * MINUTES_PER_HOUR + mins;
        }

        // Handle format: "2h"
        const hoursMatch = trimmed.match(/(\d+\.?\d*)\s*h/);
        if (hoursMatch) {
            const hours = parseInt(hoursMatch[1]);
            return hours * MINUTES_PER_HOUR;
        }

        // Handle format: "30m"
        const minsMatch = trimmed.match(/(\d+\.?\d*)\s*m/);
        if (minsMatch) {
            const mins = parseInt(minsMatch[1]);
            return mins;
        }

        // Handle plain number (assume minutes)
        const plainNumber = parseInt(trimmed);
        if (!isNaN(plainNumber) && plainNumber >= 0) {
            return plainNumber;
        }

        return null;
    },

    /**
     * Get duration category (short, medium, long)
     * @param minutes - Duration in minutes
     * @returns Category string
     */
    getDurationCategory(minutes: number): 'short' | 'medium' | 'long' {
        if (minutes < 30) return 'short';
        if (minutes < 120) return 'medium';
        return 'long';
    },

    /**
     * Get estimated completion days based on study time
     * @param courseDurationMinutes - Course duration in minutes
     * @param dailyStudyMinutes - Expected daily study time in minutes
     * @returns Estimated number of days
     */
    estimateCompletionDays(
        courseDurationMinutes: number,
        dailyStudyMinutes: number = 60
    ): number {
        if (dailyStudyMinutes <= 0) return 0;
        return Math.ceil(courseDurationMinutes / dailyStudyMinutes);
    }
};
