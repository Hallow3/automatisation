import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CvApiService } from '../../core/services/cv-api.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { CardComponent } from '../../shared/components/card/card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { EmptyStateComponent } from '../../shared/components/feedback/empty-state.component';

interface DocItem {
  id: string;
  name: string;
  type: 'cv' | 'lettre';
  target: string;
  date: string;
  size: string;
  status: string;
}

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PageHeaderComponent,
    ButtonComponent,
    CardComponent,
    StatusBadgeComponent,
    BadgeComponent,
    EmptyStateComponent
  ],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.css'
})
export class DocumentsComponent implements OnInit {
  private cvApi = inject(CvApiService);
  documents: DocItem[] = [];
  loading = true;

  ngOnInit(): void {
    this.cvApi.getCvs().subscribe({
      next: (cvs) => {
        this.documents = (cvs || []).map((cv) => {
          let content: any = null;
          if (cv.contentJson) {
            try {
              content = typeof cv.contentJson === 'string' ? JSON.parse(cv.contentJson) : cv.contentJson;
            } catch {}
          }
          const target = content?.headline || cv.title || 'Générique';

          return {
            id: cv.id,
            name: `${cv.title || 'CV'}.pdf`,
            type: 'cv',
            target,
            date: cv.updatedAt ? new Date(cv.updatedAt).toLocaleDateString('fr-FR') : 'Récemment',
            size: '~120 Ko',
            status: cv.status === 'READY' ? 'Prête' : 'En cours'
          };
        });
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
