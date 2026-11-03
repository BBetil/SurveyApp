import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { NoteEditor } from './core/note-editor';
import { NoteSheet } from './shared/note-sheet';

@Component({
  imports: [NoteSheet, RouterOutlet],
  selector: 'app-root',
  template: `
    <router-outlet />
    @if (editor.request()) {
      <app-note-sheet />
    }
    @if (updateReady()) {
      <div class="update-toast" role="status">
        <span>Yeni sürüm var</span>
        <button type="button" class="btn small primary" (click)="reload()">Yenile</button>
      </div>
    }
  `,
})
export class App implements OnInit {
  private readonly sw = inject(SwUpdate);
  protected readonly editor = inject(NoteEditor);
  protected readonly updateReady = signal(false);

  ngOnInit() {
    // Tarayıcıdan veri silinmesini engellemek için kalıcı depolama iste (HTTP'de yok)
    void navigator.storage?.persist?.();
    if (this.sw.isEnabled) {
      this.sw.versionUpdates.subscribe((e) => {
        if (e.type === 'VERSION_READY') this.updateReady.set(true);
      });
    }
  }

  protected reload() {
    location.reload();
  }
}
