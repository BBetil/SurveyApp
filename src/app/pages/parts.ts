import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { db, live } from '../core/db';
import { addPart, renamePart, setPartSection } from '../core/lists';
import { normalizeTr, Part, SECTIONS } from '../core/models';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-parts',
  imports: [Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="nav-row">
        <a class="link" routerLink="/ayarlar"><app-icon name="arrow-left" [size]="20" /> Ayarlar</a>
      </header>
      <h1 class="large-title">Parçalar</h1>
      <p class="subtitle">Not yazarken önerilir. Notta geçen parçanın bölümü, not için önerilen bölüm olur.</p>

      <form class="add-row" (submit)="add($event, nameInput, sectionInput)">
        <input #nameInput placeholder="Yeni parça" aria-label="Yeni parça adı" />
        <select #sectionInput aria-label="Yeni parçanın bölümü">
          @for (s of sections; track s.no) {
            <option [value]="s.no">{{ s.short }}</option>
          }
        </select>
        <button type="submit" class="btn">Ekle</button>
      </form>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <label class="search">
        <app-icon name="search" [size]="18" />
        <input type="search" placeholder="Parçalarda ara" aria-label="Parçalarda ara" (input)="onQuery($event)" />
      </label>

      @for (group of groups(); track group.no) {
        <h2 class="group-title">{{ group.label }} ({{ group.parts.length }})</h2>
        @for (part of group.parts; track part.id) {
          <div class="part-row">
            <input [value]="part.name" [attr.aria-label]="part.name + ' adı'" (change)="rename(part, $event)" />
            <select [attr.aria-label]="part.name + ' bölümü'" (change)="move(part, $event)">
              @for (s of sections; track s.no) {
                <option [value]="s.no" [selected]="s.no === part.section">{{ s.short }}</option>
              }
            </select>
            <button type="button" class="icon-btn" [attr.aria-label]="part.name + ' sil'" (click)="remove(part)">
              <app-icon name="trash" [size]="18" />
            </button>
          </div>
        }
      } @empty {
        <p class="empty">Parça bulunamadı.</p>
      }
    </main>
  `,
})
export class PartsPage {
  protected readonly sections = SECTIONS;
  protected readonly error = signal('');
  private readonly query = signal('');
  private readonly parts = live<Part[]>(() => db.parts.toArray(), []);

  protected readonly groups = computed(() => {
    const query = normalizeTr(this.query().trim());
    const parts = this.parts()
      .filter((p) => normalizeTr(p.name).includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    return SECTIONS.map((s) => ({ no: s.no, label: s.label, parts: parts.filter((p) => p.section === s.no) })).filter(
      (g) => g.parts.length,
    );
  });

  protected onQuery(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected async add(event: Event, name: HTMLInputElement, section: HTMLSelectElement) {
    event.preventDefault();
    this.error.set('');
    const value = name.value.trim();
    if (!value) return;
    if (await addPart(value, +section.value)) name.value = '';
    else this.error.set(`"${value}" zaten listede.`);
  }

  protected async rename(part: Part, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    this.error.set('');
    if (value && (await renamePart(part.id, value))) return;
    input.value = part.name;
    if (value) this.error.set(`"${value}" zaten listede.`);
  }

  protected move(part: Part, event: Event) {
    void setPartSection(part.id, +(event.target as HTMLSelectElement).value);
  }

  protected remove(part: Part) {
    if (confirm(`"${part.name}" silinsin mi?`)) void db.parts.delete(part.id);
  }
}
