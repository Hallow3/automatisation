import { Component, Input, Output, EventEmitter, booleanAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html',
  styleUrl: './button.component.css'
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'secondary';
  @Input() size: ButtonSize = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input({ transform: booleanAttribute }) disabled = false;
  @Input({ transform: booleanAttribute }) loading = false;
  @Input({ transform: booleanAttribute }) fullWidth = false;
  @Input() customClass = '';
  
  @Output() btnClick = new EventEmitter<MouseEvent>();

  get classes(): string {
    const base = 'inline-flex items-center justify-center whitespace-nowrap rounded-lg sm:rounded-xl font-semibold transition-all duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 select-none active:scale-[0.98]';
    
    let variantClass = '';
    switch (this.variant) {
      case 'primary':
      case 'accent':
        variantClass = 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white shadow-brand border border-transparent focus-visible:outline-brand-600';
        break;
      case 'secondary':
        variantClass = 'bg-white text-slate-800 border border-brand-100 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 shadow-sm focus-visible:outline-brand-600';
        break;
      case 'ghost':
        variantClass = 'bg-transparent text-slate-600 hover:bg-brand-50 hover:text-brand-700 border border-transparent focus-visible:outline-brand-600';
        break;
      case 'destructive':
        variantClass = 'bg-white text-rose-700 border border-rose-100 hover:bg-rose-50 hover:text-rose-800 focus-visible:outline-rose-500 shadow-sm';
        break;
    }

    let sizeClass = '';
    switch (this.size) {
      case 'sm':
        sizeClass = 'h-7 sm:h-8 px-2.5 sm:px-3 text-xs gap-1.5';
        break;
      case 'md':
        sizeClass = 'h-8 sm:h-9 lg:h-10 px-3 sm:px-4 text-xs sm:text-sm gap-2';
        break;
    }

    const widthClass = this.fullWidth ? 'w-full' : '';

    return `${base} ${variantClass} ${sizeClass} ${widthClass} ${this.customClass}`.trim();
  }

  handleClick(event: MouseEvent): void {
    if (!this.disabled && !this.loading) {
      this.btnClick.emit(event);
    }
  }
}
