import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

export interface WorkflowStep {
  number: string;
  badge: string;
  title: string;
  description: string;
  detail: string;
  iconSvg: string;
  actionText?: string;
  actionLink?: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  public authService = inject(AuthService);

  @ViewChild('ambientCanvas', { static: false }) ambientCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('videoElement', { static: false }) videoElementRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('videoSection', { static: false }) videoSectionRef?: ElementRef<HTMLDivElement>;

  isAuthenticated = this.authService.isAuthenticated;
  isVideoPlaying = signal(false);
  videoExpanded = signal(false);
  expandedSteps = signal<Record<number, boolean>>({});

  toggleStep(idx: number, event?: Event): void {
    event?.stopPropagation();
    this.expandedSteps.update(map => ({ ...map, [idx]: !map[idx] }));
  }

  isStepExpanded(idx: number): boolean {
    return !!this.expandedSteps()[idx];
  }

  private animFrameId: number | null = null;
  private intersectionObserver: IntersectionObserver | null = null;

  readonly steps: WorkflowStep[] = [
    {
      number: '01',
      badge: '5 min chrono',
      title: "Préparez votre CV d'élite",
      description: "Échangez naturellement au micro avec Bray, notre mentor IA, ou déposez votre ancien CV.",
      detail: "FallaJobs extrait vos compétences, date rigoureusement vos expériences et génère un CV certifié aux standards internationaux.",
      iconSvg: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z',
      actionText: "Tester l'entretien vocal",
      actionLink: '/cvs/interview'
    },
    {
      number: '02',
      badge: 'Vos critères précis',
      title: 'Configurez vos ambitions',
      description: "Indiquez en quelques clics le poste souhaité, votre ville, vos prétentions et vos disponibilités.",
      detail: "Aucune démarche fastidieuse. Vous définissez simplement ce qui compte pour vous et votre famille.",
      iconSvg: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
      actionText: 'Créer mon profil',
      actionLink: '/login'
    },
    {
      number: '03',
      badge: '24h/24 en continu',
      title: 'Laissez FallaJobs chercher pour vous',
      description: "Pendant que vous vaquez à vos occupations, notre agent autonome scrute des milliers d'opportunités.",
      detail: "FallaJobs filtre le marché caché, repère les offres compatibles et soumet votre candidature adaptée au recruteur.",
      iconSvg: 'M13 10V3L4 14h7v7l9-11h-7z',
      actionText: 'Explorer les opportunités',
      actionLink: '/opportunities'
    },
    {
      number: '04',
      badge: 'WhatsApp direct',
      title: 'Recevez les offres sur WhatsApp',
      description: "Zéro boîte mail encombrée. Dès qu'un employeur souhaite vous rencontrer, vous êtes alerté sur votre téléphone.",
      detail: "Vous recevez directement le nom de l'entreprise, l'offre détaillée et le contact pour convenir de l'entretien.",
      iconSvg: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      actionText: 'Démarrer maintenant',
      actionLink: '/login'
    }
  ];

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.authService.checkSession().catch(() => {});
    }
  }

  ngAfterViewInit(): void {
    this.initAmbientCanvas();
    this.initScrollExpand();
  }

  ngOnDestroy(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.intersectionObserver?.disconnect();
  }

  togglePlayVideo(): void {
    const video = this.videoElementRef?.nativeElement;
    if (video) {
      if (video.paused) {
        video.play().then(() => this.isVideoPlaying.set(true)).catch(() => {});
      } else {
        video.pause();
        this.isVideoPlaying.set(false);
      }
    } else {
      this.isVideoPlaying.update(v => !v);
    }
  }

  scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private initScrollExpand(): void {
    const el = this.videoSectionRef?.nativeElement;
    if (!el) return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        this.videoExpanded.set(entry.isIntersecting && entry.intersectionRatio >= 0.4);
      },
      { threshold: [0, 0.4, 1.0] }
    );

    this.intersectionObserver.observe(el);
  }

  private initAmbientCanvas(): void {
    const canvas = this.ambientCanvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 1000);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    const onResize = () => {
      if (!canvas?.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', onResize);

    let time = 0;
    const render = () => {
      time += 0.0035;

      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#eef2ff');
      grad.addColorStop(1, '#e0e7ff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const cx1 = width * 0.35 + Math.sin(time * 0.9) * 120;
      const cy1 = height * 0.45 + Math.cos(time * 1.1) * 80;
      const r1 = Math.min(width, height) * 0.45;
      const g1 = ctx.createRadialGradient(cx1, cy1, 10, cx1, cy1, r1);
      g1.addColorStop(0, 'rgba(99, 102, 241, 0.22)');
      g1.addColorStop(0.6, 'rgba(129, 140, 248, 0.10)');
      g1.addColorStop(1, 'rgba(238, 242, 255, 0)');
      ctx.fillStyle = g1;
      ctx.beginPath(); ctx.arc(cx1, cy1, r1, 0, Math.PI * 2); ctx.fill();

      const cx2 = width * 0.68 + Math.cos(time * 0.8) * 100;
      const cy2 = height * 0.55 + Math.sin(time * 1.2) * 70;
      const r2 = Math.min(width, height) * 0.5;
      const g2 = ctx.createRadialGradient(cx2, cy2, 10, cx2, cy2, r2);
      g2.addColorStop(0, 'rgba(79, 70, 229, 0.18)');
      g2.addColorStop(0.7, 'rgba(165, 180, 252, 0.08)');
      g2.addColorStop(1, 'rgba(238, 242, 255, 0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(cx2, cy2, r2, 0, Math.PI * 2); ctx.fill();

      const cx3 = width * 0.5 + Math.sin(time * 0.6) * 90;
      const cy3 = height * 0.2 + Math.cos(time * 0.7) * 50;
      const r3 = Math.min(width, height) * 0.35;
      const g3 = ctx.createRadialGradient(cx3, cy3, 5, cx3, cy3, r3);
      g3.addColorStop(0, 'rgba(199, 210, 254, 0.20)');
      g3.addColorStop(1, 'rgba(238, 242, 255, 0)');
      ctx.fillStyle = g3;
      ctx.beginPath(); ctx.arc(cx3, cy3, r3, 0, Math.PI * 2); ctx.fill();

      this.animFrameId = requestAnimationFrame(render);
    };

    this.animFrameId = requestAnimationFrame(render);
  }
}
