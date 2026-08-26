import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellIcon, ChevronDownIcon, MenuIcon, PlusIcon } from 'lucide-react';
import { SearchInput } from '../ui/Field';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

const notifications = [
{ id: 'n1', title: '7 nouvelles opportunités', detail: 'Recherche Front-End Senior · Île-de-France', time: '12 min' },
{ id: 'n2', title: 'Lettre générée', detail: 'Alvéa Technologies — prête à relire', time: '48 min' },
{ id: 'n3', title: 'Entretien confirmé', detail: 'Fidelis Assurance — 26 août, 14h00', time: 'Hier' }];


export function Topbar({ onOpenNav }: {onOpenNav: () => void;}) {
  const [openMenu, setOpenMenu] = useState<'user' | 'notifications' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Ouvrir la navigation"
          className="rounded-lg border border-line-strong p-1.5 text-muted transition-colors duration-150 ease-out hover:bg-slate-50 hover:text-ink lg:hidden">
          
          <MenuIcon className="h-4 w-4" />
        </button>

        <SearchInput
          placeholder="Rechercher une offre, une entreprise, un document…"
          aria-label="Recherche"
          wrapperClassName="max-w-md flex-1" />
        

        <div className="ml-auto flex items-center gap-2" ref={ref}>
          <Button
            variant="primary"
            size="sm"
            icon={PlusIcon}
            className="hidden sm:inline-flex"
            onClick={() => undefined}>
            
            Nouvelle recherche
          </Button>

          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={openMenu === 'notifications'}
              onClick={() => setOpenMenu(openMenu === 'notifications' ? null : 'notifications')}
              className="relative rounded-lg border border-line-strong bg-white p-1.5 text-muted transition-colors duration-150 ease-out hover:bg-slate-50 hover:text-ink">
              
              <BellIcon className="h-4 w-4" />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand-600 ring-2 ring-white" />
            </button>
            {openMenu === 'notifications' ?
            <div className="absolute right-0 top-11 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
                <div className="border-b border-line px-3.5 py-2.5">
                  <p className="text-[13px] font-semibold text-ink">Notifications</p>
                </div>
                <ul className="divide-y divide-line">
                  {notifications.map((item) =>
                <li key={item.id} className="px-3.5 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-ink">{item.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted">{item.detail}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-soft">{item.time}</span>
                      </div>
                    </li>
                )}
                </ul>
                <div className="border-t border-line px-3.5 py-2">
                  <Link
                  to="/activite"
                  onClick={() => setOpenMenu(null)}
                  className="text-[13px] font-medium text-brand-700 hover:text-brand-800">
                  
                    Voir toute l’activité
                  </Link>
                </div>
              </div> :
            null}
          </div>

          <div className="relative">
            <button
              type="button"
              aria-expanded={openMenu === 'user'}
              onClick={() => setOpenMenu(openMenu === 'user' ? null : 'user')}
              className={cn(
                'flex items-center gap-2 rounded-lg border border-line-strong bg-white py-1 pl-1 pr-2 text-left',
                'transition-colors duration-150 ease-out hover:bg-slate-50'
              )}>
              
              <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-800 text-2xs font-semibold text-white">
                LB
              </span>
              <span className="hidden text-[13px] font-medium text-ink sm:block">Léa Bertrand</span>
              <ChevronDownIcon className="h-3.5 w-3.5 text-muted" />
            </button>
            {openMenu === 'user' ?
            <div className="absolute right-0 top-11 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop">
                <div className="border-b border-line px-3.5 py-2.5">
                  <p className="text-[13px] font-semibold text-ink">Léa Bertrand</p>
                  <p className="truncate text-xs text-muted">lea.bertrand@email.fr</p>
                </div>
                {[
              { label: 'Mon profil', to: '/profil' },
              { label: 'Paramètres', to: '/parametres' },
              { label: 'Documents', to: '/documents' }].
              map((item) =>
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpenMenu(null)}
                className="block px-3.5 py-2 text-[13px] text-ink-soft transition-colors duration-150 ease-out hover:bg-slate-50 hover:text-ink">
                
                    {item.label}
                  </Link>
              )}
                <button
                type="button"
                className="w-full border-t border-line px-3.5 py-2 text-left text-[13px] text-muted transition-colors duration-150 ease-out hover:bg-slate-50 hover:text-ink">
                
                  Se déconnecter
                </button>
              </div> :
            null}
          </div>
        </div>
      </div>
    </header>);

}