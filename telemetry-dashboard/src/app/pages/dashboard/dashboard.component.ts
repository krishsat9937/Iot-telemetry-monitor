import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { BaseChartDirective } from 'ng2-charts';
import { TelemetryRow, TelemetryService } from '../../telemetry.service';
import { Subscription } from 'rxjs';
import { DeviceRosterComponent } from '../../components/device-roster.component';

// Chart.js v4
import { ChartOptions, ChartData, Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
Chart.register(...registerables);

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, MatCardModule, BaseChartDirective, DeviceRosterComponent],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
    last?: TelemetryRow;
    status: 'live' | 'offline' = 'offline';
    sub?: Subscription;

    rows: TelemetryRow[] = [];


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

    constructor(private svc: TelemetryService) { }

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
