import { Routes } from '@angular/router';
import { AppShellComponent } from './layout/app-shell/app-shell.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // ── Route publique : Login / Register ──────────────────────────────────────
  {
    path: 'login',
    loadComponent: () => import('./features/auth/auth.component').then(m => m.AuthComponent),
    title: 'Connexion — GetJobAI'
  },

  // ── Routes protégées : nécessitent un cookie JWT valide ────────────────────
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/pages/dashboard-home/dashboard-home.component')
          .then(m => m.DashboardHomeComponent),
        title: 'Tableau de bord — GetJobAI'
      },
      {
        path: 'opportunities',
        loadComponent: () => import('./features/opportunities/pages/opportunity-list/opportunity-list.component')
          .then(m => m.OpportunityListComponent),
        title: 'Opportunités — GetJobAI'
      },
      {
        path: 'opportunites',
        redirectTo: 'opportunities',
        pathMatch: 'full'
      },
      {
        path: 'opportunities/:id',
        loadComponent: () => import('./features/opportunities/pages/opportunity-detail/opportunity-detail.component')
          .then(m => m.OpportunityDetailComponent),
        title: 'Détail de l’opportunité — GetJobAI'
      },
      {
        path: 'applications',
        loadComponent: () => import('./features/applications/pages/application-list/application-list.component')
          .then(m => m.ApplicationListComponent),
        title: 'Candidatures — GetJobAI'
      },
      {
        path: 'candidatures',
        redirectTo: 'applications',
        pathMatch: 'full'
      },
      {
        path: 'cvs',
        loadComponent: () => import('./features/cvs/pages/cv-list/cv-list.component')
          .then(m => m.CvListComponent),
        title: 'Mes CV — GetJobAI'
      },
      {
        path: 'cvs/interview',
        loadComponent: () => import('./features/cvs/pages/cv-interview/cv-interview.component')
          .then(m => m.CvInterviewComponent),
        title: 'Entretien IA — GetJobAI'
      },
      {
        path: 'cvs/:id/interview',
        loadComponent: () => import('./features/cvs/pages/cv-interview/cv-interview.component')
          .then(m => m.CvInterviewComponent),
        title: 'Entretien IA — GetJobAI'
      },
      {
        path: 'cv-builder',
        loadComponent: () => import('./features/cv-builder/pages/cv-builder-main/cv-builder-main.component')
          .then(m => m.CvBuilderMainComponent),
        title: 'Créer mon CV — GetJobAI'
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/pages/profile-main/profile-main.component')
          .then(m => m.ProfileMainComponent),
        title: 'Mon profil — GetJobAI'
      },
      {
        path: 'profil',
        redirectTo: 'profile',
        pathMatch: 'full'
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/pages/settings-main/settings-main.component')
          .then(m => m.SettingsMainComponent),
        title: 'Paramètres — GetJobAI'
      },
      {
        path: 'parametres',
        redirectTo: 'settings',
        pathMatch: 'full'
      },
      {
        path: 'documents',
        loadComponent: () => import('./features/documents/documents.component')
          .then(m => m.DocumentsComponent),
        title: 'Documents — GetJobAI'
      },
      {
        path: 'activity',
        loadComponent: () => import('./features/activity/activity.component')
          .then(m => m.ActivityComponent),
        title: 'Activité — GetJobAI'
      },
      {
        path: 'activite',
        redirectTo: 'activity',
        pathMatch: 'full'
      }
    ]
  },

  // ── Fallback ───────────────────────────────────────────────────────────────
  { path: '**', redirectTo: 'dashboard' }
];
