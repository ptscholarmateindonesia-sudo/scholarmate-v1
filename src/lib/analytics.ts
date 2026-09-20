export interface AnalyticsEvent {
  id: string;
  name: string;
  timestamp: string;
  properties?: Record<string, unknown>;
}

const recentEvents: AnalyticsEvent[] = [];
const MAX_RECENT_EVENTS = 20;

type AnalyticsListener = (events: AnalyticsEvent[]) => void;
const listeners: Set<AnalyticsListener> = new Set();

export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  const event: AnalyticsEvent = {
    id: Math.random().toString(36).substring(2, 9),
    name,
    timestamp: new Date().toISOString(),
    properties,
  };

  recentEvents.unshift(event);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.pop();
  }

  // Internal log
  console.log(`[ScholarMate Analytics] ${name}`, properties || '');

  for (const listener of listeners) {
    listener([...recentEvents]);
  }
}

export function getRecentEvents(): AnalyticsEvent[] {
  return [...recentEvents];
}

export function subscribeAnalytics(listener: AnalyticsListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
