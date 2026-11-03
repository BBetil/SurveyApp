import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { db, fullUrl, live } from '../core/db';
import { Note, Photo, Survey, surveyTitle } from '../core/models';
import { buildReportModel, reportDetails } from '../core/report';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-report',
  imports: [Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="report-bar no-print">
      <a class="link" [routerLink]="['/s', surveyId, 'bulgular']"><app-icon name="arrow-left" [size]="20" /> Bulgular</a>
      <button type="button" class="btn primary" [disabled]="!model().total" (click)="print()">
        <app-icon name="download" [size]="20" /> PDF
      </button>
    </div>

    @if (survey(); as s) {
      <p class="report-summary no-print">
        {{ model().total }} not
        @if (model().withoutSection) {
          · <span class="tag warn">{{ model().withoutSection }} bölümsüz</span>
        }
        @if (model().withoutGrade) {
          · <span class="tag warn">{{ model().withoutGrade }} derecesiz</span>
        }
      </p>

      <article class="report-page">
        <header class="report-cover">
          <p class="report-kicker">Ön Satın Alma Sörveyi</p>
          <h1>{{ title(s) }}</h1>
          <dl>
            @for (row of details(); track row.label) {
              <div>
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
            }
          </dl>
        </header>

        @for (section of model().sections; track section.title) {
          <section class="report-section">
            <h2>
              @if (section.number) {
                <span>{{ section.number }}</span>
              }
              {{ section.title }}
            </h2>
            @for (finding of section.findings; track finding.noteId) {
              <div class="report-finding">
                <p>
                  @if (finding.number) {
                    <span class="report-no">{{ finding.number }}</span>
                  }
                  @if (finding.text) {
                    {{ finding.text }}
                  } @else {
                    <span class="report-missing no-print">Metinsiz not</span>
                  }
                  @if (finding.grade) {
                    <strong [class]="'report-grade rg-' + finding.grade">({{ finding.grade }})</strong>
                  } @else {
                    <span class="report-missing no-print">Derece yok</span>
                  }
                </p>
                @if (finding.photos.length) {
                  <div class="report-photos">
                    @for (photo of finding.photos; track photo.id) {
                      <img [src]="fullUrl(photo)" alt="" />
                    }
                  </div>
                }
              </div>
            }
          </section>
        } @empty {
          <p class="report-empty">Henüz not yok. Not ekledikçe rapor burada oluşur.</p>
        }
      </article>
    }
  `,
})
export class Report {
  protected readonly surveyId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;

  protected readonly title = surveyTitle;
  protected readonly fullUrl = fullUrl;
  protected readonly survey = live<Survey | undefined>(() => db.surveys.get(this.surveyId), undefined);
  private readonly notes = live<Note[]>(() => db.notes.where({ surveyId: this.surveyId }).toArray(), []);
  private readonly photos = live<Photo[]>(() => db.photos.where({ surveyId: this.surveyId }).toArray(), []);

  protected readonly model = computed(() => buildReportModel(this.notes(), this.photos()));
  protected readonly details = computed(() => {
    const survey = this.survey();
    return survey ? reportDetails(survey) : [];
  });

  /** Tarayıcının yazdır menüsü PDF kaydeder; dosya adı olarak sayfa başlığını önerir. */
  protected print() {
    const survey = this.survey();
    const previous = document.title;
    if (survey) document.title = `${surveyTitle(survey)} sörvey raporu`;
    window.print();
    document.title = previous;
  }
}
