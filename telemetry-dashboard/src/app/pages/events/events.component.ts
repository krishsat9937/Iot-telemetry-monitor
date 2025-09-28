import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TelemetryRow, TelemetryService } from '../../telemetry.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.scss']
})
export class EventsComponent implements OnInit, OnDestroy {
  // live rows buffer
  rows: TelemetryRow[] = [];

  // stream state
  status: 'live' | 'paused' | 'offline' = 'offline';
  sub?: Subscription;

  // filters (signals so template updates are snappy)
  metric = signal<string>('');
  device = signal<string>('');
  fromMinutes = signal<number>(0); // 0 = no time filter

  displayed = ['id','device_id','metric','value','unit','timestamp','created_at','latency'];

  constructor(private svc: TelemetryService) {}

  async ngOnInit() {
    // seed last hour for usefulness
    this.rows = await this.svc.listLatest(500, { minutes: 60 });

    // start live stream (service has auto-reconnect)
    this.status = 'live';
    this.svc.startStream();
    this.sub = this.svc.live$.subscribe(ev => {
      if (!ev || this.status !== 'live') return;
      this.rows = [ev, ...this.rows].slice(0, 5000);
    });
  }

  ngOnDestroy() {
    this.svc.stopStream();
    this.sub?.unsubscribe();
    this.status = 'offline';
  }

  pause()  { this.status = 'paused'; }
  resume() { this.status = 'live'; }

  reconnect() {
    this.svc.startStream();
    this.status = 'live';
  }

  // latency in ms
  latencyMs(r: TelemetryRow): number {
    return Math.max(0, +new Date(r.created_at) - +new Date(r.timestamp));
  }

  // filtered datasource (computed for perf/readability)
  filtered = computed<TelemetryRow[]>(() => {
    const m = this.metric().trim().toLowerCase();
    const d = this.device().trim().toLowerCase();
    const from = this.fromMinutes();
    const cutoff = from ? Date.now() - from * 60_000 : 0;

    return this.rows.filter(r => {
      if (m && r.metric.toLowerCase() !== m) return false;
      if (d && r.device_id.toLowerCase().indexOf(d) === -1) return false;
      if (cutoff && +new Date(r.timestamp) < cutoff) return false;
      return true;
    });
  });

  // CSV export for current view
  exportCsv() {
    const header = 'id,device_id,metric,value,unit,timestamp,created_at,latency_ms';
    const lines = this.filtered().map(r =>
      [r.id, r.device_id, r.metric, r.value, r.unit, r.timestamp, r.created_at, this.latencyMs(r)]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `telemetry_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  setRange(mins: number) { this.fromMinutes.set(mins); }
}
