import React from 'react';
import { timeTrackingService } from '../lib/timeTrackingService';

/**
 * TimeDisplay Component
 * Consistently displays time in HH:MM:SS format
 */

interface TimeDisplayProps {
  seconds: number;
  format?: 'hms' | 'hours' | 'minutes' | 'compact';
  className?: string;
  showLabel?: boolean;
}

export const TimeDisplay: React.FC<TimeDisplayProps> = ({
  seconds,
  format = 'hms',
  className = '',
  showLabel = false,
}) => {
  if (seconds === undefined || seconds === null || seconds < 0) {
    return <span className={className}>00:00:00</span>;
  }

  let displayed = '';

  switch (format) {
    case 'hms':
      displayed = timeTrackingService.formatAsHMS(seconds);
      break;
    case 'hours':
      displayed = timeTrackingService.getSummaryInHours(seconds);
      break;
    case 'minutes':
      displayed = timeTrackingService.getSummaryInMinutes(seconds);
      break;
    case 'compact':
      displayed = timeTrackingService.formatSeconds(seconds);
      break;
  }

  return (
    <span className={className} title={`${seconds} seconds`}>
      {displayed}
      {showLabel && format === 'hms' && ' (HH:MM:SS)'}
    </span>
  );
};

/**
 * Time Range Display Component
 */
interface TimeRangeDisplayProps {
  currentSeconds: number;
  allocatedSeconds: number;
  className?: string;
}

export const TimeRangeDisplay: React.FC<TimeRangeDisplayProps> = ({
  currentSeconds,
  allocatedSeconds,
  className = '',
}) => {
  const isExceeded = currentSeconds > allocatedSeconds;

  return (
    <span className={`${className} ${isExceeded ? 'text-red-600 font-semibold' : ''}`}>
      <TimeDisplay seconds={currentSeconds} format="hms" /> /{' '}
      <TimeDisplay seconds={allocatedSeconds} format="hms" />
      {isExceeded && ' (Exceeded)'}
    </span>
  );
};

/**
 * Time Summary Component
 */
interface TimeSummaryProps {
  totalSeconds: number;
  sessionCount?: number;
  compact?: boolean;
  className?: string;
}

export const TimeSummary: React.FC<TimeSummaryProps> = ({
  totalSeconds,
  sessionCount,
  compact = false,
  className = '',
}) => {
  if (compact) {
    return (
      <div className={className}>
        <TimeDisplay seconds={totalSeconds} format="hms" />
        {sessionCount && <span className="text-sm text-gray-500 ml-2">({sessionCount} sessions)</span>}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="font-semibold">
        <TimeDisplay seconds={totalSeconds} format="hms" />
      </div>
      <div className="text-sm text-gray-600">
        ≈ {timeTrackingService.formatSeconds(totalSeconds)}
      </div>
      {sessionCount && (
        <div className="text-xs text-gray-500">
          {sessionCount} sessions ({totalSeconds > 0 && sessionCount > 0
            ? timeTrackingService.formatAsHMS(Math.round(totalSeconds / sessionCount))
            : '00:00:00'} avg)
        </div>
      )}
    </div>
  );
};

/**
 * Time Statistics Table Component
 */
interface TimeStatRow {
  label: string;
  seconds: number;
}

interface TimeStatisticsProps {
  data: TimeStatRow[];
  className?: string;
}

export const TimeStatistics: React.FC<TimeStatisticsProps> = ({ data, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {data.map((row, idx) => (
        <div key={idx} className="flex justify-between items-center p-2 border-b">
          <span className="font-medium text-gray-700">{row.label}</span>
          <TimeDisplay seconds={row.seconds} format="hms" className="font-semibold" />
        </div>
      ))}
    </div>
  );
};

/**
 * Peak Hours Display Component
 */
interface PeakHourDisplayProps {
  hour: number;
  activeUsers: number;
  totalTimeSeconds?: number;
  className?: string;
}

export const PeakHourDisplay: React.FC<PeakHourDisplayProps> = ({
  hour,
  activeUsers,
  totalTimeSeconds = 0,
  className = '',
}) => {
  const timeString = `${String(hour).padStart(2, '0')}:00 - ${String((hour + 1) % 24).padStart(2, '0')}:00`;

  return (
    <div className={`p-4 bg-blue-50 rounded border border-blue-200 ${className}`}>
      <div className="text-sm font-semibold text-blue-900">Peak Activity Hour</div>
      <div className="text-lg font-bold text-blue-700">
        {timeString}
      </div>
      <div className="text-sm text-blue-600 mt-1">
        {activeUsers} active users
      </div>
      {totalTimeSeconds > 0 && (
        <div className="text-sm text-blue-600">
          Total time: <TimeDisplay seconds={totalTimeSeconds} format="hms" />
        </div>
      )}
    </div>
  );
};

/**
 * Session Metrics Card Component
 */
interface SessionMetricsCardProps {
  totalSessions: number;
  avgSessionSeconds: number;
  totalTimeSeconds: number;
  lastActivityAt?: string;
  className?: string;
}

export const SessionMetricsCard: React.FC<SessionMetricsCardProps> = ({
  totalSessions,
  avgSessionSeconds,
  totalTimeSeconds,
  lastActivityAt,
  className = '',
}) => {
  return (
    <div className={`p-4 bg-gray-50 rounded border border-gray-200 ${className}`}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-gray-600">Sessions</div>
          <div className="text-lg font-bold">{totalSessions}</div>
        </div>
        <div>
          <div className="text-xs text-gray-600">Avg Session</div>
          <div className="text-sm font-semibold">
            <TimeDisplay seconds={avgSessionSeconds} format="hms" />
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-600">Total Time</div>
          <div className="text-sm font-semibold">
            <TimeDisplay seconds={totalTimeSeconds} format="hms" />
          </div>
        </div>
        {lastActivityAt && (
          <div>
            <div className="text-xs text-gray-600">Last Activity</div>
            <div className="text-xs text-gray-500">
              {new Date(lastActivityAt).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
