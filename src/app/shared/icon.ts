import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS } from './icons';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg
    viewBox="0 0 24 24"
    [attr.width]="size()"
    [attr.height]="size()"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    @for (d of paths(); track d) {
      <path [attr.d]="d" />
    }
  </svg>`,
  styles: `:host { display: inline-flex; flex: none; }`,
})
export class Icon {
  readonly name = input.required<string>();
  readonly size = input(22);
  protected readonly paths = computed(() => ICONS[this.name()] ?? []);
}
