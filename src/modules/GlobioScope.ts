import { GlobioClient } from '../GlobioClient';
import { GlobioResult, TrackEventPayload, ScopeMetrics, ScopeFunnel, ScopeDashboard, ScopeDashboardWidget, FunnelStepResult } from '../types';

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

export interface TopEvent {
  event_name: string;
  count: number;
}

type RawFunnel = Omit<ScopeFunnel, 'steps'> & {
  steps: string[] | string;
};

type RawDashboard = Omit<ScopeDashboard, 'widgets'> & {
  widgets: ScopeDashboardWidget[] | string;
};

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

  private normalizeFunnel(funnel: RawFunnel): ScopeFunnel {
    if (typeof funnel.steps === 'string') {
      try {
        return { ...funnel, steps: JSON.parse(funnel.steps) as string[] };
      } catch {
        return { ...funnel, steps: [] };
      }
    }

    return { ...funnel, steps: funnel.steps };
  }

  private normalizeDashboard(dashboard: RawDashboard): ScopeDashboard {
    if (typeof dashboard.widgets === 'string') {
      try {
        return { ...dashboard, widgets: JSON.parse(dashboard.widgets) as ScopeDashboardWidget[] };
      } catch {
        return { ...dashboard, widgets: [] };
      }
    }

    return { ...dashboard, widgets: dashboard.widgets };
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
        setTimeout(() => {
          void this.flush();
        }, 5000);
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

  async getMetrics(): Promise<GlobioResult<ScopeMetrics>> {
    return this.client.request<ScopeMetrics>({
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

  async createFunnel(name: string, steps: string[], conversionWindowHours: number = 168): Promise<GlobioResult<ScopeFunnel>> {
    const result = await this.client.request<RawFunnel>({
      service: 'scope',
      path: '/scope/funnels',
      method: 'POST',
      body: {
        name,
        steps,
        conversion_window_hours: conversionWindowHours,
      },
    });

    return result.success ? { success: true, data: this.normalizeFunnel(result.data) } : result;
  }

  async listFunnels(): Promise<GlobioResult<ScopeFunnel[]>> {
    return this.client.request<ScopeFunnel[]>({
      service: 'scope',
      path: '/scope/funnels',
    });
  }

  /**
   * Returns per-step user counts for a funnel.
   * Note: this is not a strict ordered funnel — each step is
   * calculated as distinct users who triggered that event within
   * the conversion window. Users are not required to complete
   * steps in sequence. conversion_rate is relative to step 1.
   */
  async getFunnelData(funnelId: string): Promise<GlobioResult<FunnelStepResult[]>> {
    return this.client.request<FunnelStepResult[]>({
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

  async createDashboard(name: string): Promise<GlobioResult<ScopeDashboard>> {
    const result = await this.client.request<RawDashboard>({
      service: 'scope',
      path: '/scope/dashboards',
      method: 'POST',
      body: { name },
    });

    return result.success ? { success: true, data: this.normalizeDashboard(result.data) } : result;
  }

  async listDashboards(): Promise<GlobioResult<ScopeDashboard[]>> {
    return this.client.request<ScopeDashboard[]>({
      service: 'scope',
      path: '/scope/dashboards',
    });
  }

  async updateDashboardWidgets(dashboardId: string, widgets: ScopeDashboardWidget[]): Promise<GlobioResult<void>> {
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
