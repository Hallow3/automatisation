import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  ActivityIcon,
  BriefcaseIcon,
  FileTextIcon,
  FolderIcon,
  LayoutDashboardIcon,
  SendIcon,
  SettingsIcon,
  UserIcon,
  XIcon } from
'lucide-react';
import { cn } from '../../utils/cn';

const primaryNav = [
{ to: '/', label: 'Tableau de bord', icon: LayoutDashboardIcon, end: true },
{ to: '/opportunites', label: 'Opportunités', icon: BriefcaseIcon, badge: '7' },
{ to: '/candidatures', label: 'Candidatures', icon: SendIcon },
{ to: '/cv', label: 'Mes CV', icon: FileTextIcon },
{ to: '/profil', label: 'Profil', icon: UserIcon },
{ to: '/parametres', label: 'Paramètres', icon: SettingsIcon }];


const secondaryNav = [
{ to: '/documents', label: 'Documents', icon: FolderIcon },
{ to: '/activite', label: 'Activité', icon: ActivityIcon }];


function NavList({ items, onNavigate }: {items: typeof primaryNav;onNavigate?: () => void;}) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={'end' in item ? Boolean(item.end) : false}
              onClick={onNavigate}
              className={({ isActive }) =>
              cn(
                'group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium',
                'transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                isActive ? 'bg-white text-ink shadow-card ring-1 ring-line' : 'text-muted hover:bg-white/70 hover:text-ink'
              )
              }>
              
              {({ isActive }) =>
              <>
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-brand-600' : 'text-muted-soft')} />
                  <span className="truncate">{item.label}</span>
                  {'badge' in item && item.badge ?
                <span className="ml-auto rounded bg-brand-50 px-1.5 py-px text-2xs font-semibold text-brand-700">
                      {item.badge}
                    </span> :
                null}
                </>
              }
            </NavLink>
          </li>);

      })}
    </ul>);

}

export function SidebarContent({ onNavigate }: {onNavigate?: () => void;}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-[13px] font-bold text-white">
          J
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-[-0.01em] text-ink">Joprelys Jobs</p>
        </div>
      </div>

      <nav aria-label="Navigation principale" className="scroll-slim flex-1 overflow-y-auto px-3 py-2">
        <NavList items={primaryNav} onNavigate={onNavigate} />
        <p className="px-2.5 pb-1.5 pt-5 text-2xs font-semibold uppercase tracking-wide text-muted-soft">Suivi</p>
        <NavList items={secondaryNav} onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-line p-3">
        <div className="rounded-lg border border-line bg-white p-3">
          <p className="text-[13px] font-semibold text-ink">Recherche automatique</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            3 workflows actifs · dernière analyse à 09:42
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-emerald-700">En fonctionnement</span>
          </div>
        </div>
      </div>
    </div>);

}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-line bg-canvas lg:block">
      <div className="sticky top-0 h-screen">
        <SidebarContent />
      </div>
    </aside>);

}

export function MobileSidebar({ open, onClose }: {open: boolean;onClose: () => void;}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="relative h-full w-64 border-r border-line bg-canvas">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la navigation"
          className="absolute right-2 top-3.5 rounded p-1 text-muted hover:bg-white hover:text-ink">
          
          <XIcon className="h-4 w-4" />
        </button>
        <SidebarContent onNavigate={onClose} />
      </div>
    </div>);

}