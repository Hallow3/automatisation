import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { Opportunities } from './pages/Opportunities';
import { OpportunityDetail } from './pages/OpportunityDetail';
import { Applications } from './pages/Applications';
import { CvList } from './pages/CvList';
import { CvTemplates } from './pages/CvTemplates';
import { VoiceInterview } from './pages/VoiceInterview';
import { CvEditor } from './pages/CvEditor';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { Documents } from './pages/Documents';
import { ActivityPage } from './pages/ActivityPage';

type OpportunitiesView = 'cartes' | 'tableau';
type ApplicationsView = 'tableau' | 'pipeline';

interface AppProps {
  /** Vue par défaut de la liste des opportunités. */
  opportunitiesView?: OpportunitiesView;
  /** Vue par défaut du suivi des candidatures. */
  applicationsView?: ApplicationsView;
  /** Affiche les écrans en état de chargement (squelettes). */
  showLoadingStates?: boolean;
}

export function App({
  opportunitiesView = 'cartes',
  applicationsView = 'tableau',
  showLoadingStates = false
}: AppProps) {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard loading={showLoadingStates} />} />
          <Route
            path="opportunites"
            element={<Opportunities defaultView={opportunitiesView} loading={showLoadingStates} />} />
          
          <Route path="opportunites/:id" element={<OpportunityDetail />} />
          <Route path="candidatures" element={<Applications defaultView={applicationsView} />} />
          <Route path="cv" element={<CvList loading={showLoadingStates} />} />
          <Route path="cv/modeles" element={<CvTemplates />} />
          <Route path="cv/entretien" element={<VoiceInterview />} />
          <Route path="cv/editeur" element={<CvEditor />} />
          <Route path="profil" element={<Profile />} />
          <Route path="parametres" element={<Settings />} />
          <Route path="documents" element={<Documents />} />
          <Route path="activite" element={<ActivityPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>);

}