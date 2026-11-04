import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { db, fullUrl, live } from '../core/db';
import { Note, Photo, Survey, surveyTitle } from '../core/models';
import { buildReport, Paragraph } from '../core/report';
import { importTemplateFile, loadTemplate, ReportTemplate } from '../core/report-template';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-spans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Boşluksuz yazılı: araya boşluk girerse "Marina ’da" gibi noktalama kayar
  template: `@for (span of spans(); track $index) {@if (span.blank) {<mark class="report-blank">[{{ span.blank }}]</mark>} @else {{{ span.text }}}}`,
})
class Spans {
  readonly spans = input.required<Paragraph>();
}

@Component({
  selector: 'app-report',
  imports: [Icon, RouterLink, Spans],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="report-bar no-print">
      <a class="link" [routerLink]="['/s', surveyId, 'bulgular']"><app-icon name="arrow-left" [size]="20" /> Bulgular</a>
      <button type="button" class="btn primary" (click)="print()"><app-icon name="download" [size]="20" /> PDF</button>
    </div>

    @if (doc(); as d) {
      <div class="report-summary no-print">
        <p>
          {{ d.total }} not
          @if (d.withoutSection) {
            · <span class="tag warn">{{ d.withoutSection }} bölümsüz</span>
          }
          @if (d.withoutGrade) {
            · <span class="tag warn">{{ d.withoutGrade }} derecesiz</span>
          }
          @if (d.blanks) {
            · <span class="tag warn">{{ d.blanks }} boş alan</span>
          }
        </p>
        @if (!template()) {
          <div class="banner">
            <span class="grow">Sabit rapor metinleri için şablon dosyasını yükle. Bir kez yeterli, bu cihazda kalır.</span>
            <label class="btn small">
              Yükle
              <input type="file" accept=".json,application/json" hidden (change)="onTemplate($event)" />
            </label>
          </div>
        }
        @if (templateError()) {
          <p class="error">{{ templateError() }}</p>
        }
      </div>

      <article class="report-page">
        <header class="report-cover">
          <p class="report-kicker">Ön Satın Alma Sörveyi</p>
          <h1>{{ d.title }}</h1>
          <p>{{ d.date }}</p>
          @if (d.reportNo) {
            <p>PREPURCHASE-{{ d.reportNo }}</p>
          }
        </header>

        <nav class="report-toc" aria-label="İçindekiler">
          <h2>İçindekiler</h2>
          <ol>
            <li>Sörvey &amp; Tekne Detayları</li>
            <li>Sörvey Kısıtları</li>
            <li>Giriş</li>
            <li>Özet</li>
            <li>
              Gözlemler &amp; Tavsiyeler
              <ul>
                @for (section of d.sections; track section.title) {
                  @if (section.number) {
                    <li>{{ section.number }} {{ section.title }}</li>
                  }
                }
              </ul>
            </li>
            <li>Sonuç</li>
          </ol>
        </nav>

        <section class="report-chapter">
          <h2>1. Sörvey &amp; Tekne Detayları</h2>
          @for (group of d.details; track group.heading) {
            <h3>{{ group.heading }}</h3>
            <dl class="report-details">
              @for (row of group.rows; track row.label) {
                <div>
                  <dt>{{ row.label }}</dt>
                  <dd><app-spans [spans]="row.value" /></dd>
                </div>
              }
            </dl>
          }
        </section>

        <section class="report-chapter">
          <h2>2. Sörvey Kısıtları</h2>
          @for (p of d.limits; track $index) {
            <p><app-spans [spans]="p" /></p>
          }
        </section>

        <section class="report-chapter">
          <h2>3. Giriş</h2>
          <p><app-spans [spans]="d.intro" /></p>
        </section>

        <section class="report-chapter">
          <h2>4. Özet</h2>
          @for (p of d.summary; track $index) {
            <p><app-spans [spans]="p" /></p>
          }
          @for (item of d.summaryItems; track item.noteId) {
            <p class="report-summary-item">
              @if (item.number) {
                <span class="report-no">{{ item.number }}</span>
              }
              {{ item.text }}
              <strong [class]="'report-grade rg-' + item.grade">({{ item.grade }})</strong>
            </p>
          } @empty {
            <p><mark class="report-blank">[D1, D2 ve NWI bulguları derece verilince burada listelenir]</mark></p>
          }
        </section>

        <section class="report-chapter">
          <h2>5. Gözlemler &amp; Tavsiyeler</h2>
          @for (p of d.observationsIntro; track $index) {
            <p><app-spans [spans]="p" /></p>
          }
          @for (p of d.gradeExplanations; track $index) {
            <p><app-spans [spans]="p" /></p>
          }

          @for (section of d.sections; track section.title) {
            <section class="report-section">
              <h3>
                @if (section.number) {
                  <span>{{ section.number }}</span>
                }
                {{ section.title }}
              </h3>
              @for (p of section.leads; track $index) {
                <p class="report-lead"><app-spans [spans]="p" /></p>
              }
              @if (section.trial; as rows) {
                <table class="report-table">
                  <thead>
                    <tr>
                      <th>Devir (RPM)</th>
                      <th>Sürat (knot)</th>
                      <th>Vibrasyon (mm/sn)</th>
                      <th>Tüketim (l/h)</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of rows; track $index) {
                      <tr>
                        <td>{{ row.rpm }}</td>
                        <td>{{ row.knots }}</td>
                        <td>{{ row.vib }}</td>
                        <td>{{ row.fuelLph }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="4"><mark class="report-blank">[Deniz testi değerleri]</mark></td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
              @for (p of section.afterTrial; track $index) {
                <p class="report-lead"><app-spans [spans]="p" /></p>
              }
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
          }
        </section>

        <section class="report-chapter">
          <h2>6. Sonuç</h2>
          @for (p of d.conclusion; track $index) {
            <p><app-spans [spans]="p" /></p>
          }
          <p class="report-signature">
            Saygılarımla,<br />
            <app-spans [spans]="d.signature.name" /><br />
            {{ d.signature.title }}
          </p>
        </section>
      </article>
    }
  `,
})
export class Report {
  protected readonly surveyId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;

  protected readonly fullUrl = fullUrl;
  protected readonly survey = live<Survey | undefined>(() => db.surveys.get(this.surveyId), undefined);
  protected readonly template = live<ReportTemplate | undefined>(loadTemplate, undefined);
  protected readonly templateError = signal('');
  private readonly notes = live<Note[]>(() => db.notes.where({ surveyId: this.surveyId }).toArray(), []);
  private readonly photos = live<Photo[]>(() => db.photos.where({ surveyId: this.surveyId }).toArray(), []);

  protected readonly doc = computed(() => {
    const survey = this.survey();
    return survey && buildReport(survey, this.notes(), this.photos(), this.template());
  });

  protected async onTemplate(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.templateError.set('');
    try {
      await importTemplateFile(file);
    } catch (e) {
      console.error(e);
      this.templateError.set('Bu dosya rapor şablonu olarak okunamadı.');
    }
  }

  /** Tarayıcının yazdır menüsü PDF kaydeder; dosya adı olarak sayfa başlığını önerir. */
  protected print() {
    const survey = this.survey();
    const previous = document.title;
    if (survey) document.title = `${surveyTitle(survey)} sörvey raporu`;
    window.print();
    document.title = previous;
  }
}
