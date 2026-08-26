import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  documents: DocItem[] = [
    {
      id: 'd1',
      name: 'CV_Dev_FullStack_2026.pdf',
      type: 'cv',
      target: 'Générique (Modèle Rigueur)',
      date: 'Aujourd’hui à 10:14',
      size: '142 Ko',
      status: 'Prête'
    },
    {
      id: 'd2',
      name: 'Lettre_Motivation_LeadTech.pdf',
      type: 'lettre',
      target: 'Candidature Lead Developer',
      date: 'Hier à 14:30',
      size: '88 Ko',
      status: 'Envoyée'
    },
    {
      id: 'd3',
      name: 'CV_TechLead_Moderne.pdf',
      type: 'cv',
      target: 'Offre Architecte Web',
      date: '18 août 2026',
      size: '156 Ko',
      status: 'Prête'
    }
  ];

  ngOnInit(): void {}
}
