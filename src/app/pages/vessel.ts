import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { addPhoto, db, deletePhoto, deleteSurvey, live, setSurveyField, thumbUrl } from '../core/db';
import { processImage } from '../core/image';
import { Photo, Survey, VESSEL_KINDS, VesselKind } from '../core/models';
import { Icon } from '../shared/icon';
import { PhotoViewer } from '../shared/photo-viewer';

@Component({
  selector: 'app-vessel',
  imports: [Icon, PhotoViewer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vessel.html',
})
export class Vessel implements OnInit {
  private readonly router = inject(Router);
  private readonly surveyId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;

  protected readonly thumbUrl = thumbUrl;
  protected readonly survey = signal<Survey | undefined>(undefined);
  protected readonly error = signal('');
  protected readonly viewing = signal<Photo | null>(null);
  private readonly photos = live<Photo[]>(() => db.photos.where({ surveyId: this.surveyId }).toArray(), []);

  protected readonly plates = computed(() =>
    VESSEL_KINDS.map((v) => ({ ...v, photos: this.photos().filter((p) => p.vesselKind === v.kind) })),
  );

  async ngOnInit() {
    this.survey.set(await db.surveys.get(this.surveyId));
  }

  protected setField(path: string, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    void setSurveyField(this.surveyId, path, value);
  }

  protected async onPlate(kind: VesselKind, event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.error.set('');
    for (const file of files) {
      try {
        await addPhoto(this.surveyId, await processImage(file), { vesselKind: kind });
      } catch {
        this.error.set('Bir fotoğraf işlenemedi.');
      }
    }
  }

  protected removePhoto(photo: Photo) {
    if (!confirm('Fotoğraf kalıcı olarak silinsin mi?')) return;
    this.viewing.set(null);
    void deletePhoto(photo.id);
  }

  protected async remove() {
    if (!confirm('Bu sörvey, notları ve fotoğraflarıyla kalıcı olarak silinsin mi? Bu geri alınamaz.')) return;
    await deleteSurvey(this.surveyId);
    void this.router.navigateByUrl('/');
  }
}
