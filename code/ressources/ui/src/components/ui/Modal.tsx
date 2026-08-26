import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'modal' | 'drawer';
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  variant = 'modal',
  className
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const isDrawer = variant === 'drawer';

  return (
    <AnimatePresence>
      {open ?
      <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
          className="absolute inset-0 bg-slate-900/25"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          onClick={onClose} />
        
          <motion.div
          className={cn(
            'relative z-10 flex flex-col overflow-hidden border-line bg-surface shadow-pop',
            isDrawer ?
            'ml-auto h-full w-full max-w-md border-l' :
            'm-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-lg rounded-xl border',
            className
          )}
          initial={isDrawer ? { x: 24, opacity: 0 } : { scale: 0.97, opacity: 0 }}
          animate={isDrawer ? { x: 0, opacity: 1 } : { scale: 1, opacity: 1 }}
          exit={isDrawer ? { x: 24, opacity: 0 } : { scale: 0.97, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}>
          
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
                {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
              </div>
              <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="rounded p-1 text-muted transition-colors duration-150 ease-out hover:bg-slate-100 hover:text-ink">
              
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="scroll-slim flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer ?
          <div className="flex items-center justify-end gap-2 border-t border-line bg-slate-50/70 px-5 py-3">
                {footer}
              </div> :
          null}
          </motion.div>
        </div> :
      null}
    </AnimatePresence>);

}