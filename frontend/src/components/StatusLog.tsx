import React, { useEffect, useRef } from 'react';
import { GameEvent } from '../types';

interface StatusLogProps {
  events: GameEvent[];
  shipNames: Map<string, string>;
}

const StatusLog: React.FC<StatusLogProps> = ({ events, shipNames }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events are added
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const formatTime = (timestamp: number): string => {
    const totalSeconds = Math.floor(timestamp / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatLogEntry = (event: GameEvent): { time: string; reporter: string; message: string; className: string } => {
    const time = formatTime(event.timestamp);
    let reporter = 'System';
    let message = event.message;
    let className = 'log-entry';

    // Extract ship name from event data or message
    if (event.data?.shipId) {
      reporter = shipNames.get(event.data.shipId as string) || 'Unknown Ship';
    } else if (event.message.includes(' - ')) {
      const parts = event.message.split(' - ');
      if (parts.length > 1) {
        reporter = parts[0];
        message = parts.slice(1).join(' - ');
      }
    }

    // Apply different styling based on event type
    switch (event.type) {
      case 'sector_changed':
        className += ' log-sector-change';
        // Parse message to match the required format
        if (event.data?.fromSectorName && event.data?.toSectorName) {
          message = `Jumped from ${event.data.fromSectorName} to ${event.data.toSectorName}`;
        }
        break;
      case 'trade':
      case 'trade_completed':
        className += ' log-trade';
        // Format trade message
        if (event.data?.type && event.data?.stationName) {
          const action = (event.data.type as string).toUpperCase();
          const stationName = event.data.stationName as string;
          const creditsBeforeTrade = event.data.creditsBeforeTrade as number;
          const creditsAfterTrade = event.data.creditsAfterTrade as number;
          const stationStockBefore = event.data.stationStockBefore as number;
          const stationStockAfter = event.data.stationStockAfter as number;
          const shipCargoBefore = event.data.shipCargoBefore as number;
          const shipCargoAfter = event.data.shipCargoAfter as number;
          
          message = `${action} at ${stationName}: Credits ${creditsBeforeTrade} → ${creditsAfterTrade}, Station stock ${stationStockBefore} → ${stationStockAfter}, Ship cargo ${shipCargoBefore} → ${shipCargoAfter}`;
        }
        break;
      case 'ship_command':
        className += ' log-command';
        break;
      case 'ship_moved':
        className += ' log-movement';
        break;
      case 'sector_discovered':
        className += ' log-discovery';
        break;
      default:
        className += ' log-default';
    }

    return { time, reporter, message, className };
  };

  return (
    <div className="status-log">
      <div className="status-log-content">
        {events.map((event) => {
          const { time, reporter, message, className } = formatLogEntry(event);
          return (
            <div key={event.id} className={className}>
              <span className="log-time">[{time}]</span>
              <span className="log-reporter">[{reporter}]</span>
              <span className="log-message">{message}</span>
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default StatusLog;