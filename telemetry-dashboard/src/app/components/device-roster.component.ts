import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TelemetryRow } from '../telemetry.service';

type DeviceStatus = 'online' | 'stale' | 'offline';

type DeviceView = {
  device_id: string;
  metric?: string;
  value?: number;
  unit?: string;
  timestamp?: string;
  lastSeenSec: number;
  status: DeviceStatus;
};

@Component({
  selector: 'app-device-roster',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './device-roster.component.html'
})
export class DeviceRosterComponent {
  @Input() rows: TelemetryRow[] = [];
  now = () => Date.now();

  get devices(): DeviceView[] {
    const latest = new Map<string, TelemetryRow>();
    for (const r of this.rows) {
      const prev = latest.get(r.device_id);
      if (!prev || +new Date(r.timestamp) > +new Date(prev.timestamp)) latest.set(r.device_id, r);
    }
    return Array.from(latest.values()).map(r => {
      const lastSeenSec = Math.max(0, Math.round((this.now() - +new Date(r.timestamp))/1000));
      const status: DeviceStatus = lastSeenSec <= 60 ? 'online' : lastSeenSec <= 300 ? 'stale' : 'offline';
      return { device_id: r.device_id, metric: r.metric, value: r.value, unit: r.unit, timestamp: r.timestamp, lastSeenSec, status };
    }).sort((a,b)=>a.device_id.localeCompare(b.device_id));
  }
}
