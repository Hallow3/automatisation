import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skeleton.component.html',
  styleUrl: './skeleton.component.css'
})
export class SkeletonComponent {
  @Input() customClass: string = 'h-4 w-full';
}

@Component({
  selector: 'app-skeleton-card',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div class="flex items-start justify-between gap-4">
        <div class="w-full space-y-2">
          <app-skeleton customClass="h-3.5 w-2/5" />
          <app-skeleton customClass="h-3 w-1/4" />
        </div>
        <app-skeleton customClass="h-6 w-12 rounded-md" />
      </div>
      <div class="mt-4 space-y-2">
        <app-skeleton customClass="h-3 w-full" />
        <app-skeleton customClass="h-3 w-4/5" />
      </div>
      <div class="mt-4 flex gap-2">
        <app-skeleton customClass="h-6 w-16 rounded-md" />
        <app-skeleton customClass="h-6 w-20 rounded-md" />
        <app-skeleton customClass="h-6 w-14 rounded-md" />
      </div>
    </div>
  `
})
export class SkeletonCardComponent {}

@Component({
  selector: 'app-skeleton-row',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0">
      <app-skeleton customClass="h-3.5 w-1/4" />
      <app-skeleton customClass="h-3.5 w-1/6" />
      <app-skeleton customClass="ml-auto h-6 w-12 rounded-md" />
      <app-skeleton customClass="h-6 w-20 rounded-md" />
    </div>
  `
})
export class SkeletonRowComponent {}
