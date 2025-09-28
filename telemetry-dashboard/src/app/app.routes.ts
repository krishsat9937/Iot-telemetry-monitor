import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { EventsComponent } from './pages/events/events.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'events', component: EventsComponent },
  { path: '**', redirectTo: '' }
];
