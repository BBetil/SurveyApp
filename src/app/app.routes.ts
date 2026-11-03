import { Routes } from '@angular/router';
import { Findings } from './pages/findings';
import { NoteDetail } from './pages/note-detail';
import { PartsPage } from './pages/parts';
import { Settings } from './pages/settings';
import { SurveyShell } from './pages/survey-shell';
import { Surveys } from './pages/surveys';
import { Unassigned } from './pages/unassigned';
import { Vessel } from './pages/vessel';

export const routes: Routes = [
  { path: '', component: Surveys, title: 'Sörveyler' },
  { path: 'ayarlar', component: Settings, title: 'Ayarlar' },
  { path: 'ayarlar/parcalar', component: PartsPage, title: 'Parçalar' },
  { path: 's/:id/not/:noteId', component: NoteDetail, title: 'Not' },
  { path: 's/:id/fotolar', component: Unassigned, title: 'Atanmamış fotoğraflar' },
  {
    path: 's/:id',
    component: SurveyShell,
    children: [
      { path: '', redirectTo: 'bulgular', pathMatch: 'full' },
      { path: 'bulgular', component: Findings, title: 'Bulgular' },
      { path: 'tekne', component: Vessel, title: 'Tekne' },
    ],
  },
  { path: '**', redirectTo: '' },
];
