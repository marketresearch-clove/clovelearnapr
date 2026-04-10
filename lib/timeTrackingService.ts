/**
 * Time Tracking Service
 * Standardizes all time handling to SECONDS internally
 * Provides conversion utilities for display
 */

export const timeTrackingService = {
  /**
   * Convert seconds to hours (with decimals)
   * Example: 3600 → 1.00
   */
  secondsToHours(seconds: number): number {
    return Math.round((seconds / 3600) * 100) / 100;
  },

  /**
   * Convert seconds to minutes (with decimals)
   * Example: 120 → 2.00
   */
  secondsToMinutes(seconds: number): number {
    return Math.round((seconds / 60) * 100) / 100;
  },

  /**
   * Convert hours to seconds
   * Example: 1.5 → 5400
   */
  hoursToSeconds(hours: number): number {
    return Math.round(hours * 3600);
  },

  /**
   * Convert minutes to seconds
   * Example: 30 → 1800
   */
  minutesToSeconds(minutes: number): number {
    return Math.round(minutes * 60);
  },

  /**
   * Format seconds as readable time string
   * Example: 3665 → "1h 1m 5s"
   */
  formatSeconds(seconds: number): string {
    if (seconds < 0) return '0s';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  },

  /**
   * Format seconds as HH:MM:SS
   * Example: 3665 → "01:01:05"
   */
  formatAsHMS(seconds: number): string {
    if (seconds < 0) return '00:00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return [hours, minutes, secs]
      .map((val) => String(val).padStart(2, '0'))
      .join(':');
  },

  /**
   * Parse time string to seconds
   * Supports formats: "1h 2m 3s", "1:02:03", "60m", "120"
   */
  parseToSeconds(timeStr: string): number {
    if (!timeStr) return 0;

    let totalSeconds = 0;

    // Try HH:MM:SS format first
    const hmsMatch = timeStr.match(/^(\d+):(\d+):(\d+)$/);
    if (hmsMatch) {
      const [, h, m, s] = hmsMatch;
      return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s);
    }

    // Try "1h 2m 3s" format
    const hMatch = timeStr.match(/(\d+)\s*h/i);
    const mMatch = timeStr.match(/(\d+)\s*m/i);
    const sMatch = timeStr.match(/(\d+)\s*s/i);

    if (hMatch) totalSeconds += parseInt(hMatch[1]) * 3600;
    if (mMatch) totalSeconds += parseInt(mMatch[1]) * 60;
    if (sMatch) totalSeconds += parseInt(sMatch[1]);

    // Fallback: treat as seconds if no format matched
    if (totalSeconds === 0) {
      const numMatch = timeStr.match(/^(\d+)$/);
      if (numMatch) totalSeconds = parseInt(numMatch[1]);
    }

    return totalSeconds;
  },

  /**
   * Get readable summary of time (hours focus)
   * Example: 3665 → "1.02 hours"
   */
  getSummaryInHours(seconds: number): string {
    const hours = this.secondsToHours(seconds);
    return `${hours.toFixed(2)} hours`;
  },

  /**
   * Get readable summary of time (minutes focus)
   * Example: 120 → "2.00 minutes"
   */
  getSummaryInMinutes(seconds: number): string {
    const minutes = this.secondsToMinutes(seconds);
    return `${minutes.toFixed(2)} minutes`;
  },

  /**
   * Aggregate multiple time durations
   */
  aggregateDurations(durations: number[]): {
    totalSeconds: number;
    totalMinutes: number;
    totalHours: number;
    formatted: string;
  } {
    const totalSeconds = durations.reduce((sum, d) => sum + d, 0);
    return {
      totalSeconds,
      totalMinutes: this.secondsToMinutes(totalSeconds),
      totalHours: this.secondsToHours(totalSeconds),
      formatted: this.formatSeconds(totalSeconds),
    };
  },

  /**
   * Calculate average duration
   */
  getAverageDuration(
    totalSeconds: number,
    count: number
  ): {
    seconds: number;
    minutes: number;
    hours: number;
    formatted: string;
  } {
    if (count === 0) {
      return {
        seconds: 0,
        minutes: 0,
        hours: 0,
        formatted: '0s',
      };
    }

    const avgSeconds = Math.round(totalSeconds / count);
    return {
      seconds: avgSeconds,
      minutes: this.secondsToMinutes(avgSeconds),
      hours: this.secondsToHours(avgSeconds),
      formatted: this.formatSeconds(avgSeconds),
    };
  },

  /**
   * Validate time value
   */
  isValidTime(seconds: number): boolean {
    return typeof seconds === 'number' && seconds >= 0 && isFinite(seconds);
  },

  /**
   * Get time range for date
   */
  getDateRange(date: Date): {
    start: string;
    end: string;
  } {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    return {
      start: `${dateStr}T00:00:00Z`,
      end: `${dateStr}T23:59:59Z`,
    };
  },

  /**
   * Compare two time values
   */
  compareTime(
    actual: number,
    expected: number,
    tolerancePercent = 5
  ): {
    matches: boolean;
    percentDifference: number;
    discrepancySeconds: number;
  } {
    const difference = Math.abs(actual - expected);
    const percentDiff = expected > 0 ? (difference / expected) * 100 : 0;
    const matches = percentDiff <= tolerancePercent;

    return {
      matches,
      percentDifference: Math.round(percentDiff * 100) / 100,
      discrepancySeconds: difference,
    };
  },
};
