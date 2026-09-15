import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of, tap, takeUntil } from 'rxjs';
import { CvApiService } from './cv-api.service';
import { AuthService } from './auth.service';
import { CvData, CvSectionKey } from '../../shared/components/cv-preview/cv-preview.component';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Service dédié à l'édition d'un CV.
 *
 * Responsabilités :
 *   — Maintenir un FormGroup réactif représentant le CV en cours d'édition.
 *   — Auto-sauvegarder avec un debounce de 1s à chaque changement.
 *   — Exposer une méthode de sauvegarde manuelle immédiate.
 *   — Exposer un signal `saveStatus` pour l'indicateur UI.
 *   — Convertir le FormValue → CvData pour le preview live.
 */
@Injectable({ providedIn: 'root' })
export class CvEditorService {

  /** Exposé pour que le composant puisse créer des controls additionnels */
  readonly fb = inject(FormBuilder);
  private cvApi = inject(CvApiService);
  private authService = inject(AuthService);

  readonly saveStatus = signal<SaveStatus>('idle');
  readonly sectionOrder = signal<CvSectionKey[]>([
    'summary',
    'experiences',
    'education',
    'skills',
    'languages',
    'projects'
  ]);
  readonly templateId = signal<string>('modern');
  public cvData!: WritableSignal<CvData>;

  private _currentCvId: string | null = null;
  private _destroy$ = new Subject<void>();
  private _saveManually$ = new Subject<void>();

  // ── Formulaire principal ─────────────────────────────────────────────────

  form!: FormGroup;

  constructor() {
    this.form = this._buildForm();
    this.cvData = signal<CvData>(this.toCvData());
  }

  moveSectionUp(key: CvSectionKey): void {
    const list = [...this.sectionOrder()];
    const idx = list.indexOf(key);
    if (idx > 0) {
      const temp = list[idx - 1];
      list[idx - 1] = list[idx];
      list[idx] = temp;
      this.sectionOrder.set(list);
      this.cvData.set(this.toCvData());
    }
  }

  moveSectionDown(key: CvSectionKey): void {
    const list = [...this.sectionOrder()];
    const idx = list.indexOf(key);
    if (idx >= 0 && idx < list.length - 1) {
      const temp = list[idx + 1];
      list[idx + 1] = list[idx];
      list[idx] = temp;
      this.sectionOrder.set(list);
      this.cvData.set(this.toCvData());
    }
  }

  private _buildForm(): FormGroup {
    const u = this.authService.currentUser();
    return this.fb.group({
      identity: this.fb.group({
        fullName: [u?.fullName || ''],
        email:    [u?.email || '', [Validators.email]],
        phone:    [u?.phone || ''],
        city:     [u?.city || ''],
        linkedin: ['']
      }),
      headline:    [u?.targetRole || ''],
      summary:     [''],
      links:       this.fb.array([]),
      experiences: this.fb.array([]),
      education:   this.fb.array([]),
      skills:      this.fb.array([]),
      languages:   this.fb.array([])
    });
  }

  // ── Getters FormArray ────────────────────────────────────────────────────

  get links():       FormArray { return this.form.get('links')       as FormArray; }
  get experiences(): FormArray { return this.form.get('experiences') as FormArray; }
  get education():   FormArray { return this.form.get('education')   as FormArray; }
  get skills():      FormArray { return this.form.get('skills')      as FormArray; }
  get languages():   FormArray { return this.form.get('languages')   as FormArray; }

  // ── Init / Destroy ───────────────────────────────────────────────────────

  init(cvId: string, data: any): void {
    this._currentCvId = cvId;
    this._destroy$.next();
    
    // Réinitialiser les arrays sans détruire l'instance form
    this.links.clear();
    this.experiences.clear();
    this.education.clear();
    this.skills.clear();
    this.languages.clear();

    this.patchFromData(data);
    this._setupAutoSave();
  }

  destroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // ── Auto-save + save manuel ──────────────────────────────────────────────

  private _setupAutoSave(): void {
    // Mise à jour immédiate du signal preview à chaque frappe clavier
    this.form.valueChanges.pipe(
      takeUntil(this._destroy$)
    ).subscribe(() => {
      this.cvData.set(this.toCvData());
    });

    // Auto-save délayé vers l'API
    this.form.valueChanges.pipe(
      debounceTime(1000),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      switchMap(() => this._doSave()),
      takeUntil(this._destroy$)
    ).subscribe();

    this._saveManually$.pipe(
      switchMap(() => this._doSave()),
      takeUntil(this._destroy$)
    ).subscribe();
  }

  saveNow(): void {
    this._saveManually$.next();
  }

  private _doSave() {
    if (!this._currentCvId) return of(null);
    this.saveStatus.set('saving');

    return this.cvApi.saveDraft(this._currentCvId, this._toApiPayload()).pipe(
      tap((savedCv) => {
        if (savedCv?.id) {
          this._currentCvId = String(savedCv.id);
        }
        this.saveStatus.set('saved');
        setTimeout(() => {
          if (this.saveStatus() === 'saved') this.saveStatus.set('idle');
        }, 3000);
      }),
      catchError(() => {
        this.saveStatus.set('error');
        return of(null);
      })
    );
  }

  // ── Patch depuis données API ─────────────────────────────────────────────

  patchFromData(data: any): void {
    const u = this.authService.currentUser();
    if (!data) {
      if (u) {
        this.form.patchValue({
          identity: {
            fullName: u.fullName || '',
            email:    u.email || '',
            phone:    u.phone || '',
            city:     u.city || ''
          },
          headline: u.targetRole || ''
        });
      }
      return;
    }
    const d: any = typeof data === 'string' ? JSON.parse(data) : data;

    this.form.patchValue({
      identity: {
        fullName: d.identity?.fullName || d.name || u?.fullName || '',
        email:    d.identity?.email    || d.email || u?.email || '',
        phone:    d.identity?.phone    || d.phone || u?.phone || '',
        city:     d.identity?.city     || d.city  || u?.city || '',
        linkedin: d.identity?.linkedin || d.linkedin || ''
      },
      headline: d.headline || d.title || u?.targetRole || '',
      summary:  d.summary  || ''
    });

    this.links.clear();
    if (d.links && Array.isArray(d.links) && d.links.length > 0) {
      d.links.forEach((l: any) => this.links.push(this.newLink(l)));
    } else if (d.identity?.linkedin || d.linkedin) {
      this.links.push(this.newLink({ label: 'LinkedIn', url: d.identity?.linkedin || d.linkedin }));
    }

    if (d.template) {
      this.templateId.set(d.template);
    }

    if (d.sectionOrder && Array.isArray(d.sectionOrder) && d.sectionOrder.length > 0) {
      this.sectionOrder.set(d.sectionOrder);
    }

    this.experiences.clear();
    (d.experiences || []).forEach((e: any) => this.experiences.push(this.newExperience(e)));

    this.education.clear();
    (d.education || []).forEach((e: any) => this.education.push(this.newEducation(e)));

    // Fusionner les compétences globales et les technologies extraites par l'OCR
    const allSkills = new Set<string>();
    (d.skills || []).forEach((s: any) => {
      const str = typeof s === 'string' ? s.trim() : (s?.name || '').trim();
      if (str) allSkills.add(str);
    });
    (d.experiences || []).forEach((exp: any) => {
      if (Array.isArray(exp?.technologies)) {
        exp.technologies.forEach((t: any) => {
          const str = String(t || '').trim();
          if (str) allSkills.add(str);
        });
      }
    });

    this.skills.clear();
    allSkills.forEach((s: string) => this.skills.push(this.fb.control(s)));

    this.languages.clear();
    (d.languages || []).forEach((l: any) => this.languages.push(this.newLanguage(l)));

    this.cvData.set(this.toCvData());
  }

  // ── Builders FormGroup ───────────────────────────────────────────────────

  newLink(data?: any): FormGroup {
    return this.fb.group({
      label: [data?.label || 'Lien'],
      url:   [data?.url   || '']
    });
  }

  addLink(label = 'Lien', url = ''): void {
    this.links.push(this.newLink({ label, url }));
  }

  removeLink(i: number): void {
    this.links.removeAt(i);
  }

  newExperience(data?: any): FormGroup {
    const rawBullets = [
      ...(Array.isArray(data?.responsibilities) ? data.responsibilities : (typeof data?.responsibilities === 'string' && data.responsibilities.trim() ? [data.responsibilities] : [])),
      ...(Array.isArray(data?.achievements) ? data.achievements : (typeof data?.achievements === 'string' && data.achievements.trim() ? [data.achievements] : [])),
      ...(Array.isArray(data?.bullets) ? data.bullets : (typeof data?.bullets === 'string' && data.bullets.trim() ? [data.bullets] : []))
    ];
    const seen = new Set<string>();
    const bullets: string[] = [];
    for (const b of rawBullets) {
      const s = String(b || '').trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        bullets.push(s);
      }
    }

    if (data?.context && bullets.length === 0) {
      bullets.push(data.context);
    }

    return this.fb.group({
      company:     [data?.company  || ''],
      position:    [data?.position || data?.role || data?.title || ''],
      city:        [data?.city || ''],
      description: [data?.description || (bullets.length === 0 && data?.context ? data.context : '') || ''],
      startDate:   [data?.startDate || (data?.period ? data.period.split('-')[0]?.trim() : '') || ''],
      endDate:     [data?.endDate   || (data?.period ? data.period.split('-')[1]?.trim() : '') || ''],
      responsibilities: this.fb.array(
        bullets.map((r: string) => this.fb.control(r))
      )
    });
  }

  newEducation(data?: any): FormGroup {
    return this.fb.group({
      school: [data?.school || data?.institution || ''],
      degree: [data?.degree || data?.diploma     || ''],
      year:   [data?.year   || data?.period || data?.date || '']
    });
  }

  newLanguage(data?: any): FormGroup {
    let langName = '';
    let levelName = '';

    if (typeof data === 'string') {
      const match = data.match(/^([^(]+)(?:\(([^)]+)\))?$/);
      if (match) {
        langName = match[1].trim();
        levelName = match[2]?.trim() || '';
      } else {
        langName = data.trim();
      }
    } else if (data) {
      langName = data.lang || data.name || data.language || '';
      levelName = data.level || '';
    }

    return this.fb.group({
      lang:  [langName],
      level: [levelName]
    });
  }

  getResponsibilities(exp: FormGroup): FormArray {
    return exp.get('responsibilities') as FormArray;
  }

  addResponsibility(exp: FormGroup): void {
    this.getResponsibilities(exp).push(this.fb.control(''));
  }

  removeResponsibility(exp: FormGroup, i: number): void {
    this.getResponsibilities(exp).removeAt(i);
  }

  // ── Conversion → CvData (preview live) ──────────────────────────────────

  toCvData(): CvData {
    const v = this.form.value;
    const u = this.authService.currentUser();
    const skills: string[] = (v.skills || []).filter((s: string) => s && s.trim());
    return {
      name:    v.identity?.fullName || u?.fullName || '',
      title:   v.headline           || u?.targetRole || '',
      email:   v.identity?.email    || u?.email || '',
      phone:   v.identity?.phone    || u?.phone || '',
      city:    v.identity?.city     || u?.city || '',
      summary: v.summary            || '',
      skills:  skills,
      links: (v.links || [])
        .filter((l: any) => l?.url && l.url.trim())
        .map((l: any) => ({
          label: l.label?.trim() || 'Lien',
          url: l.url.trim()
        })),
      experiences: (v.experiences || [])
        .filter((e: any) => e?.position?.trim() || e?.company?.trim() || (e?.responsibilities && e.responsibilities.length > 0) || e?.description?.trim())
        .map((e: any) => ({
          role:        e.position || '',
          company:     e.company  || '',
          city:        e.city     || '',
          period:      [e.startDate, e.endDate || (e.startDate ? 'Présent' : '')].filter(Boolean).join(' - '),
          description: e.description || '',
          bullets:     (e.responsibilities || []).filter((r: string) => r && r.trim())
        })),
      education: (v.education || [])
        .filter((edu: any) => edu?.degree?.trim() || edu?.school?.trim())
        .map((edu: any) => ({
          degree: edu.degree || '',
          school: edu.school || '',
          year:   edu.year   || ''
        })),
      languages: (v.languages || [])
        .filter((l: any) => (typeof l === 'string' && l.trim()) || l?.lang?.trim() || l?.name?.trim())
        .map((l: any) => {
          if (typeof l === 'string') return { lang: l, level: '' };
          return {
            lang:  l.lang  || l.name || '',
            level: l.level || ''
          };
        }),
      sectionOrder: this.sectionOrder()
    };
  }

  // ── Payload API ───────────────────────────────────────────────────────────

  private _toApiPayload(): any {
    const v = this.form.value;
    return {
      identity:     v.identity,
      headline:     v.headline,
      summary:      v.summary,
      links:        v.links,
      experiences:  v.experiences,
      education:    v.education,
      skills:       (v.skills || []).filter((s: string) => s?.trim()),
      languages:    v.languages,
      sectionOrder: this.sectionOrder(),
      template:     this.templateId()
    };
  }

  saveDraft(cvId: string, template?: string) {
    this._currentCvId = cvId;
    if (template) {
      this.templateId.set(template);
    }
    return this.cvApi.saveDraft(cvId, this._toApiPayload());
  }
}
