import { GlobioClient } from '../GlobioClient';
import { GlobioResult } from '../types';

export interface TrackEventPayload {
  event_name: string;
  user_id?: string;
  session_id?: string;
  platform?: string;
  properties?: Record<string, unknown>;
}

export interface EventSchema {
  id: string;
  event_name: string;
  properties_schema: Record<string, unknown>;
  system_event: boolean;
  created_at: number;
}

export interface FunnelStep {
  event_name: string;
  name?: string;
}

export interface Funnel {
  id: string;
  name: string;
  steps: FunnelStep[];
  conversion_window_hours: number;
  created_at: number;
}

export interface FunnelData {
  steps: Array<{
    name: string;
    event_name: string;
    count: number;
    conversion_rate: number;
  }>;
  overall_conversion_rate: number;
}

export interface DashboardWidget {
  type: 'metric' | 'chart' | 'table' | 'funnel';
  title: string;
  config: Record<string, unknown>;
}

export interface Dashboard {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  created_at: number;
  updated_at: number;
}

export interface Metrics {
  dau: number;
  wau: number;
  mau: number;
}

export interface TopEvent {
  event_name: string;
  count: number;
}

interface QueuedEvent {
  payload: TrackEventPayload;
  retries: number;
}

export class GlobioScope {
  private queue: QueuedEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private client: GlobioClient;
  private maxQueueSize = 20;
  private flushDelay = 2000;
  private maxRetries = 3;

  constructor(client: GlobioClient) {
    this.client = client;
  }

  track(eventName: string, properties?: Record<string, unknown>): void {
    const session = this.client.session.get();
    this.queue.push({
      payload: {
        event_name: eventName,
        properties,
        user_id: session?.user_id,
      },
      retries: 0,
    });

    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (this.queue.length >= this.maxQueueSize) {
      this.flush();
    } else {
      this.flushTimer = setTimeout(() => this.flush(), this.flushDelay);
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const events = this.queue.splice(0, this.queue.length);
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const result = await this.client.request({
      service: 'scope',
      path: '/scope/track/batch',
      method: 'POST',
      body: { events: events.map((event) => event.payload) },
      auth: true,
    });

    if (!result.success) {
      const retryableEvents = events
        .map((event) => ({ ...event, retries: event.retries + 1 }))
        .filter((event) => event.retries < this.maxRetries);
      const droppedEvents = events.length - retryableEvents.length;

      console.warn('GlobalScope flush failed:', result.error.message);

      if (retryableEvents.length > 0) {
        this.queue.unshift(...retryableEvents);
      }

      if (droppedEvents > 0) {
        console.error(`GlobalScope flush dropped ${droppedEvents} event(s) after ${this.maxRetries} failed attempts.`);
      }

      return;
    }
  }

  async trackOnce(eventName: string, properties?: Record<string, unknown>): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'scope',
      path: '/scope/track',
      method: 'POST',
      body: { event_name: eventName, properties },
      auth: true,
    });
  }

  async trackBatch(events: TrackEventPayload[]): Promise<GlobioResult<{ tracked: number }>> {
    return this.client.request<{ tracked: number }>({
      service: 'scope',
      path: '/scope/track/batch',
      method: 'POST',
      body: { events },
      auth: true,
    });
  }

  async getSchemas(): Promise<GlobioResult<EventSchema[]>> {
    return this.client.request<EventSchema[]>({
      service: 'scope',
      path: '/scope/schemas',
    });
  }

  async deleteSchema(eventName: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'scope',
      path: `/scope/schemas/${encodeURIComponent(eventName)}`,
      method: 'DELETE',
    });
  }

  async getEventCounts(eventName: string, days: number = 30): Promise<GlobioResult<Array<{ date: string; count: number }>>> {
    return this.client.request<Array<{ date: string; count: number }>>({
      service: 'scope',
      path: `/scope/events/${encodeURIComponent(eventName)}/counts?days=${days}`,
    });
  }

  async getMetrics(): Promise<GlobioResult<Metrics>> {
    return this.client.request<Metrics>({
      service: 'scope',
      path: '/scope/metrics/dau',
    });
  }

  async getTopEvents(days: number = 7, limit: number = 10): Promise<GlobioResult<TopEvent[]>> {
    return this.client.request<TopEvent[]>({
      service: 'scope',
      path: `/scope/metrics/top-events?days=${days}&limit=${limit}`,
    });
  }

  async createFunnel(name: string, steps: FunnelStep[], conversionWindowHours: number = 168): Promise<GlobioResult<Funnel>> {
    return this.client.request<Funnel>({
      service: 'scope',
      path: '/scope/funnels',
      method: 'POST',
      body: { name, steps, conversion_window_hours: conversionWindowHours },
    });
  }

  async listFunnels(): Promise<GlobioResult<Funnel[]>> {
    return this.client.request<Funnel[]>({
      service: 'scope',
      path: '/scope/funnels',
    });
  }

  async getFunnelData(funnelId: string): Promise<GlobioResult<FunnelData>> {
    return this.client.request<FunnelData>({
      service: 'scope',
      path: `/scope/funnels/${funnelId}/data`,
    });
  }

  async deleteFunnel(funnelId: string): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'scope',
      path: `/scope/funnels/${funnelId}`,
      method: 'DELETE',
    });
  }

  async createDashboard(name: string): Promise<GlobioResult<Dashboard>> {
    return this.client.request<Dashboard>({
      service: 'scope',
      path: '/scope/dashboards',
      method: 'POST',
      body: { name },
    });
  }

  async listDashboards(): Promise<GlobioResult<Dashboard[]>> {
    return this.client.request<Dashboard[]>({
      service: 'scope',
      path: '/scope/dashboards',
    });
  }

  async updateDashboardWidgets(dashboardId: string, widgets: DashboardWidget[]): Promise<GlobioResult<void>> {
    return this.client.request<void>({
      service: 'scope',
      path: `/scope/dashboards/${dashboardId}/widgets`,
      method: 'PUT',
      body: { widgets },
    });
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
