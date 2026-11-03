import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-survey-shell',
  imports: [Icon, RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <nav class="tabbar" aria-label="Sörvey bölümleri">
      <a routerLink="bulgular" routerLinkActive="on"><app-icon name="note" /><span>Bulgular</span></a>
      <a routerLink="ice-aktar" routerLinkActive="on"><app-icon name="upload" /><span>İçe aktar</span></a>
      <a routerLink="tekne" routerLinkActive="on"><app-icon name="sailboat" /><span>Tekne</span></a>
    </nav>
  `,
})
export class SurveyShell {}
