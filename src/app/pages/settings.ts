import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { db, live } from '../core/db';
import { importSurveyZip } from '../core/export';
import { loadSurveyor, saveSurveyor } from '../core/settings';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-settings',
  imports: [Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="nav-row">
        <a class="link" routerLink="/"><app-icon name="arrow-left" [size]="20" /> Sörveyler</a>
      </header>
      <h1 class="large-title">Ayarlar</h1>

      <h2 class="group-title">Sörveyör</h2>
      <div class="form">
        <label>Ad soyad<input autocomplete="name" [value]="surveyor.name" (input)="set('name', $event)" /></label>
        <label>Unvan<input placeholder="Marin Sörveyör" [value]="surveyor.title" (input)="set('title', $event)" /></label>
      </div>
      <p class="subtitle">Yeni sörveylere ve zip dosyasına eklenir.</p>

      <h2 class="group-title">Not yazma</h2>
      <a class="list-row" routerLink="/ayarlar/parcalar">
        <span class="grow">
          <span class="row-title">Parçalar</span>
          <span class="row-sub">{{ partCount() }} parça · yazarken önerilir, bölümü belirler</span>
        </span>
        <app-icon name="chevron-right" [size]="20" />
      </a>


      <h2 class="group-title">Yedekten geri yükle</h2>
      <p class="subtitle">Dışa aktardığın zip dosyasını seç. Sörvey telefonda varsa kopya olarak eklenir, parça listesi birleştirilir.</p>
      <label class="btn wide">
        <app-icon name="upload" [size]="20" /> Zip seç
        <input type="file" accept=".zip,application/zip" hidden (change)="restore($event)" />
      </label>
      @if (busy()) {
        <p class="subtitle">Yükleniyor…</p>
      }
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
    </main>
  `,
})
export class Settings {
  private readonly router = inject(Router);
  protected readonly surveyor = loadSurveyor();
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly partCount = live(() => db.parts.count(), 0);

  protected set(key: 'name' | 'title', event: Event) {
    this.surveyor[key] = (event.target as HTMLInputElement).value;
    saveSurveyor(this.surveyor);
  }

  protected async restore(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const id = await importSurveyZip(file);
      void this.router.navigate(['/s', id, 'bulgular']);
    } catch (e) {
      console.error(e);
      this.error.set('Bu dosya yüklenemedi. Uygulamadan dışa aktarılmış bir zip seç.');
    } finally {
      this.busy.set(false);
    }
  }
}
