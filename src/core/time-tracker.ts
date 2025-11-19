/**
 * Time Tracker - Parse estimates and calculate actual time
 * @requirement FREE-TIER-004 - Time Tracking
 */

export interface TimeEntry {
  startTime: string;      // ISO timestamp
  endTime?: string;        // ISO timestamp
  duration?: number;       // hours (decimal)
}

export interface TimeTracking {
  estimatedTime?: string;  // "2 days", "4 hours"
  estimatedHours?: number; // Parsed estimate in hours
  actualTime?: number;     // hours (decimal)
  startedAt?: string;      // ISO timestamp (when task activated)
  completedAt?: string;    // ISO timestamp (when task completed)
  timeEntries: TimeEntry[]; // For paused/resumed tasks (future)
}

export class TimeTracker {
  /**
   * Parse estimate string to hours
   * Supports: "2 days", "4 hours", "1 week", "30m", etc.
   */
  static parseEstimate(estimate: string): number {
    if (!estimate || typeof estimate !== 'string') {
      return 0;
    }

    const lower = estimate.toLowerCase().trim();
    
    // Match patterns: "2 days", "4 hours", "1 week", etc.
    const dayMatch = lower.match(/(\d+)\s*days?/);
    if (dayMatch) {
      return parseInt(dayMatch[1]) * 8; // 8 hours per day
    }

    const hourMatch = lower.match(/(\d+)\s*hours?/);
    if (hourMatch) {
      return parseInt(hourMatch[1]);
    }

    const weekMatch = lower.match(/(\d+)\s*weeks?/);
    if (weekMatch) {
      return parseInt(weekMatch[1]) * 40; // 40 hours per week
    }

    const minuteMatch = lower.match(/(\d+)\s*minutes?/);
    if (minuteMatch) {
      return parseInt(minuteMatch[1]) / 60; // Convert minutes to hours
    }

    const minMatch = lower.match(/(\d+)\s*m(?!\w)/); // "30m" but not "minutes"
    if (minMatch) {
      return parseInt(minMatch[1]) / 60;
    }

    // Default: assume hours if just number
    const numberMatch = lower.match(/(\d+)/);
    if (numberMatch) {
      return parseInt(numberMatch[1]);
    }

    return 0; // Invalid format
  }

  /**
   * Calculate actual time from start to end
   */
  static calculateActualTime(startTime: string, endTime: string): number {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    return diffMs / (1000 * 60 * 60); // Convert to hours
  }

  /**
   * Format time for display
   * Examples: "30m", "2.5h", "3d", "2d 4h"
   */
  static formatTime(hours: number): string {
    if (hours < 0) {
      return '0m';
    }
    
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    }
    
    if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    }
    
    const days = Math.floor(hours / 8);
    const remainingHours = hours % 8;
    
    if (remainingHours < 0.1) {
      return `${days}d`;
    }
    
    return `${days}d ${remainingHours.toFixed(1)}h`;
  }

  /**
   * Compare estimated vs actual time
   * Returns: { ratio, status, message }
   */
  static compareTime(estimatedHours: number, actualHours: number): {
    ratio: number;
    status: 'under' | 'on-track' | 'over';
    message: string;
  } {
    if (estimatedHours === 0) {
      return {
        ratio: 0,
        status: 'on-track',
        message: 'No estimate provided'
      };
    }

    const ratio = actualHours / estimatedHours;

    if (ratio < 0.8) {
      return {
        ratio,
        status: 'under',
        message: `Completed ${((1 - ratio) * 100).toFixed(0)}% faster than estimated`
      };
    } else if (ratio <= 1.2) {
      return {
        ratio,
        status: 'on-track',
        message: 'Completed within estimate range'
      };
    } else {
      return {
        ratio,
        status: 'over',
        message: `Took ${((ratio - 1) * 100).toFixed(0)}% longer than estimated`
      };
    }
  }
}

