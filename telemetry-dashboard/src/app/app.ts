import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { TelemetryService } from './telemetry.service';
import {TitleCasePipe, CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';

type ConnState = 'connecting' | 'live' | 'offline';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MatToolbarModule, MatButtonModule, TitleCasePipe, MatIconModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnDestroy {
  private svc = inject(TelemetryService);
  private router = inject(Router);

  // theme
  isDark = signal<boolean>(false);

  // connection + health
  connState: ConnState = 'offline';
  healthBanner: 'ok' | 'down' | null = null;
  private healthTimer?: any;

  // demo mode
  demo = false;

  constructor() {
    // restore theme
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') this.isDark.set(true);
    effect(() => {
      const dark = this.isDark();
      document.body.classList.toggle('dark', dark);
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    });

    // wire live connection state + open stream with auto-reconnect
    this.svc.connection$.subscribe(s => (this.connState = s));
    this.svc.startStream(); // auto-reconnect handled inside service

    // health banner poll
    this.pingHealth();
    this.healthTimer = setInterval(() => this.pingHealth(), 15000);
  }

  toggleTheme() { this.isDark.update(v => !v); }

  onDashboardClick() {
    this.router.navigate(['/']);
  }

  onEventsClick() {
    this.router.navigate(['/events']);
  }

  async pingHealth() {
    try {
      const h = await this.svc.health();
      this.healthBanner = h.status === 'ok' ? 'ok' : 'down';
    } catch {
      this.healthBanner = 'down';
    }
  }

  toggleDemo() {
    this.demo = !this.demo;
    if (this.demo) this.svc.enableDemoMode('interview-demo');
    else this.svc.disableDemoMode();
  }

  ngOnDestroy() {
    if (this.healthTimer) clearInterval(this.healthTimer);
  }
}
