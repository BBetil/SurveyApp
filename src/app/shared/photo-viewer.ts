import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { fullUrl } from '../core/db';
import { Photo } from '../core/models';
import { Icon } from './icon';

/** Fotoğrafı tam ekran gösterir. Silme yalnızca buradaki ayrı düğmeyle yapılır. */
@Component({
  selector: 'app-photo-viewer',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="viewer" role="dialog" aria-modal="true" aria-label="Fotoğraf">
      <div class="viewer-bar">
        <button type="button" class="btn small" (click)="closed.emit()"><app-icon name="x" [size]="16" /> Kapat</button>
        <button type="button" class="btn small danger" (click)="removed.emit()">
          <app-icon name="trash" [size]="16" /> {{ removeLabel() }}
        </button>
      </div>
      <img [src]="url()" alt="" />
    </div>
  `,
})
export class PhotoViewer {
  readonly photo = input.required<Photo>();
  readonly removeLabel = input('Sil');
  readonly closed = output<void>();
  readonly removed = output<void>();

  protected readonly url = computed(() => fullUrl(this.photo()));
}
