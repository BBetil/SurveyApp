import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { createSurvey, db, deleteSurvey, live } from '../core/db';
import { normalizeTr, Survey, surveyTitle } from '../core/models';
import { loadSurveyor } from '../core/settings';
import { Icon } from '../shared/icon';

interface SurveyRow {
  survey: Survey;
  notes: number;
  photos: number;
}

@Component({
  selector: 'app-surveys',
  imports: [Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './surveys.html',
})
export class Surveys {
  private readonly router = inject(Router);

  protected readonly title = surveyTitle;
  protected readonly query = signal('');
  protected readonly creating = signal(false);
  protected readonly error = signal('');
  protected readonly today = new Date().toISOString().slice(0, 10);

  private readonly rows = live<SurveyRow[]>(async () => {
    const surveys = await db.surveys.orderBy('updatedAt').reverse().toArray();
    return Promise.all(
      surveys.map(async (survey) => ({
        survey,
        notes: await db.notes.where({ surveyId: survey.id }).count(),
        photos: await db.photos.where({ surveyId: survey.id }).count(),
      })),
    );
  }, []);

  protected readonly filtered = computed(() => {
    const q = normalizeTr(this.query().trim());
    if (!q) return this.rows();
    return this.rows().filter(({ survey: s }) =>
      normalizeTr([s.vessel.name, s.vessel.model, s.location, s.reportNo, s.client].join(' ')).includes(q),
    );
  });

  protected needsBackup(row: SurveyRow): boolean {
    const { survey } = row;
    if (!row.notes && !row.photos) return false;
    return !survey.lastExportAt || survey.updatedAt > survey.lastExportAt;
  }

  protected remove(row: SurveyRow) {
    const warning = this.needsBackup(row) ? ' Son hali yedeklenmedi.' : '';
    const message = `"${surveyTitle(row.survey)}" silinsin mi? ${row.notes} not ve ${row.photos} fotoğraf kalıcı olarak silinir.${warning} Bu geri alınamaz.`;
    if (confirm(message)) void deleteSurvey(row.survey.id);
  }

  protected onQuery(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected async create(event: Event) {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const value = (key: string) => String(data.get(key) ?? '').trim();
    if (!value('name') && !value('model')) {
      this.error.set('Tekne adı ya da modeli yaz.');
      return;
    }
    const id = await createSurvey({
      reportNo: value('reportNo'),
      client: value('client'),
      location: value('location'),
      dates: { land: value('date') || undefined },
      vessel: { name: value('name'), model: value('model') },
      surveyor: loadSurveyor(),
    });
    void this.router.navigate(['/s', id, 'bulgular']);
  }
}
