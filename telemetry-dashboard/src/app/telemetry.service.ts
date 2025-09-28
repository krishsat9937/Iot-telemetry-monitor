import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface TelemetryRow {
  id: number;
  device_id: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: string;   // ISO
  created_at: string;  // ISO
}

let API_BASE = (import.meta as any).env.NG_APP_API_BASE;

type ConnState = 'connecting' | 'live' | 'offline';

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private es?: EventSource;
  private reconnectTimer?: any;
  private backoffMs = 1000;              // start at 1s
  private readonly maxBackoffMs = 30000; // cap at 30s
  private readonly jitter = 0.25;        // +/- 25% jitter

  private demoTimer?: any;

  private _live$ = new BehaviorSubject<TelemetryRow | null>(null);
  live$ = this._live$.asObservable();

  private _conn$ = new BehaviorSubject<ConnState>('offline');
  connection$ = this._conn$.asObservable();

  constructor(private zone: NgZone) {}

  /** Optionally override API base at runtime (e.g., staging vs prod) */
  setApiBase(url: string) { API_BASE = url.replace(/\/$/, ''); }

  /** Health check banner */
  async health(): Promise<{ status: string; time?: string }> {
    const r = await fetch(`${API_BASE}/healthz`);
    return r.ok ? r.json() : { status: 'down' };
  }

  /** History with light filters */
  async listLatest(
    limit = 200,
    opts?: { metric?: string; device_id?: string; minutes?: number }
  ): Promise<TelemetryRow[]> {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (opts?.metric) qs.set('metric', opts.metric);
    if (opts?.device_id) qs.set('device_id', opts.device_id);
    if (opts?.minutes) {
      const from = new Date(Date.now() - opts.minutes * 60_000).toISOString();
      qs.set('from', from);
    }
    const r = await fetch(`${API_BASE}/api/telemetry?${qs.toString()}`);
    if (!r.ok) throw new Error(`list failed: ${r.status}`);
    return r.json();
  }

  /** Open SSE (with backoff auto-reconnect by default) */
  startStream({ autoReconnect = true }: { autoReconnect?: boolean } = {}): void {
    this.stopStream(); // idempotent
    this._conn$.next('connecting');

    try {
      this.es = new EventSource(`${API_BASE}/api/stream`, { withCredentials: false });

      this.es.onopen = () => {
        this.zone.run(() => {
          this._conn$.next('live');
          this.backoffMs = 1000; // reset backoff after success
        });
      };

      this.es.onmessage = (e) => {
        this.zone.run(() => {
          const row = JSON.parse((e as MessageEvent).data) as TelemetryRow;
          this._live$.next(row);
        });
      };

      this.es.onerror = () => {
        // Close current and schedule reconnect if enabled
        this.zone.run(() => this._conn$.next('offline'));
        this.es?.close();
        this.es = undefined;

        if (autoReconnect) {
          const jittered = this.jitterDelay(this.backoffMs);
          this.reconnectTimer = setTimeout(() => this.startStream({ autoReconnect }), jittered);
          this.backoffMs = Math.min(this.maxBackoffMs, Math.round(this.backoffMs * 2));
        }
      };
    } catch {
      this._conn$.next('offline');
    }
  }

  stopStream(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = undefined; }
    this.es?.close();
    this.es = undefined;
    this._conn$.next('offline');
  }

  /** Demo mode: synthesize heart_rate rows for interviews/demos */
  enableDemoMode(deviceId = 'demo-ios'): void {
    this.disableDemoMode();
    let bpm = 78;
    this.demoTimer = setInterval(() => {
      bpm += Math.round((Math.random() - 0.5) * 6);
      bpm = Math.max(55, Math.min(160, bpm));
      const now = new Date().toISOString();
      const row: TelemetryRow = {
        id: Date.now(), device_id: deviceId, metric: 'heart_rate',
        value: bpm, unit: 'count/min', timestamp: now, created_at: now
      };
      // emit inside Angular zone so UI updates
      this.zone.run(() => this._live$.next(row));
      // mark UI as "live" while demoing
      if (this._conn$.value !== 'live') this._conn$.next('live');
    }, 1200);
  }

  disableDemoMode(): void {
    if (this.demoTimer) { clearInterval(this.demoTimer); this.demoTimer = undefined; }
  }

  // --- helpers ---
  private jitterDelay(ms: number) {
    const delta = ms * this.jitter;
    const min = ms - delta;
    const max = ms + delta;
    return Math.round(min + Math.random() * (max - min));
  }
}
