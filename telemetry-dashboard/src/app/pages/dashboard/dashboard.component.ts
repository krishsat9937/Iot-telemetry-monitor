import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { BaseChartDirective } from 'ng2-charts';



import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { Subscription } from 'rxjs';
// import { DeviceRosterComponent } from '../../components/device-roster.component';
import { TelemetryRow, TelemetryService } from '../../telemetry.service';

// Chart.js v4
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
Chart.register(...registerables);

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatChipsModule, MatTableModule, MatCardModule, BaseChartDirective, MatDividerModule, MatButtonModule],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
    // changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
    last?: TelemetryRow;
    status: 'live' | 'offline' = 'offline';
    sub?: Subscription;

    rows: TelemetryRow[] = [];
    displayedColumns = ['device_id', 'metric'];



    private MAX_POINTS = 300;

    lineData: ChartData<'line'> = {
        labels: [],
        datasets: [
            {
                data: [],
                label: 'Heart rate (bpm)',
                pointRadius: 0,
                tension: 0.25
            }
        ]
    };

    lineOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
            x: { type: 'time' as const, time: { unit: 'minute', tooltipFormat: 'HH:mm:ss' } },
            y: { suggestedMin: 40, suggestedMax: 160 }
        },
        plugins: { legend: { display: false } }
    };

    get displayedLatest(): TelemetryRow[] {
     // `this.last` is your most recent sample
    return this.last ? [this.last] : [];
    }

    constructor(private svc: TelemetryService) { }

    // Color based on heart rate bands
        get heartColor(): string {
        if (!this.last || this.last.metric !== 'heart_rate') return '#999';
        const hr = this.last.value;
        if (hr < 60) return '#2563eb'; // blue (low)
        if (hr < 100) return '#16a34a'; // green (normal)
        if (hr < 120) return '#ca8a04'; // amber (elevated)
        return '#dc2626'; // red (high)
        }

        // Determine trend (+1, -1, 0)
        get trend(): 'up' | 'down' | 'stable' {
        if (!this.last || !this.previous) return 'stable';
        if (this.last.value > this.previous.value) return 'up';
        if (this.last.value < this.previous.value) return 'down';
        return 'stable';
        }

        // Keep track of previous heart-rate value for trend
        previous?: TelemetryRow;

    async ngOnInit() {
        try {
            const seed = await this.svc.listLatest(300);
            this.rows = seed;                       // + keep for roster
            const hr = seed
                .filter(r => r.metric === 'heart_rate')
                .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
            for (const r of hr) this.pushPoint(r);
            this.last = seed[0];
        } catch { }

        this.svc.startStream();
        this.status = 'live';
        this.sub = this.svc.live$.subscribe(ev => {
            if (!ev) return;
            this.previous = this.last;
            this.last = ev;
            // + prepend to buffer for roster (cap for perf)
            this.rows = [ev, ...this.rows].slice(0, 1000);
            if (ev.metric === 'heart_rate') this.pushPoint(ev);
        });
    }

    ngOnDestroy() {
        this.svc.stopStream();
        this.sub?.unsubscribe();
        this.status = 'offline';
    }

    private pushPoint(r: TelemetryRow) {
        const labels = this.lineData.labels as (string | Date)[];
        const data = this.lineData.datasets[0].data as number[];

        labels.push(new Date(r.timestamp));
        data.push(Math.round(r.value));

        if (labels.length > this.MAX_POINTS) {
            labels.splice(0, labels.length - this.MAX_POINTS);
            data.splice(0, data.length - this.MAX_POINTS);
        }
    }
}
