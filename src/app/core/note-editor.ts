import { Injectable, signal } from '@angular/core';

export interface NoteEditorRequest {
  surveyId: string;
  noteId?: string;
  /** Kamera butonundan gelen, sayfa açılınca eklenecek fotoğraflar */
  files?: File[];
  /** Atanmamış fotoğraftan yeni not açılırken */
  photoIds?: string[];
}

@Injectable({ providedIn: 'root' })
export class NoteEditor {
  readonly request = signal<NoteEditorRequest | null>(null);

  open(request: NoteEditorRequest) {
    this.request.set(request);
  }

  close() {
    this.request.set(null);
  }
}
