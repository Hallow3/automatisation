import React from 'react';
import { cn } from '../../utils/cn';

type Layout = 'classic' | 'sidebar' | 'compact' | 'editorial';

function Line({ width, dark = false }: {width: string;dark?: boolean;}) {
  return <span className={cn('block h-1 rounded-sm', dark ? 'bg-slate-400' : 'bg-slate-200')} style={{ width }} />;
}

export function CvThumbnail({ layout, accent, className }: {layout: Layout;accent: string;className?: string;}) {
  return (
    <div
      className={cn(
        'aspect-[1/1.414] w-full overflow-hidden rounded border border-line bg-white p-3 shadow-card',
        className
      )}
      aria-hidden="true">
      
      {layout === 'sidebar' ?
      <div className="flex h-full gap-2">
          <div className="flex w-1/3 flex-col gap-1.5 rounded-sm p-1.5" style={{ backgroundColor: `${accent}14` }}>
            <span className="h-6 w-6 rounded-full" style={{ backgroundColor: accent }} />
            <Line width="80%" dark />
            <Line width="60%" />
            <span className="mt-2 block h-1 w-10 rounded-sm" style={{ backgroundColor: accent }} />
            <Line width="90%" />
            <Line width="70%" />
            <Line width="85%" />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Line width="70%" dark />
            <Line width="45%" />
            <span className="mt-1.5 block h-1 w-8 rounded-sm" style={{ backgroundColor: accent }} />
            <Line width="100%" />
            <Line width="95%" />
            <Line width="88%" />
            <span className="mt-1.5 block h-1 w-8 rounded-sm" style={{ backgroundColor: accent }} />
            <Line width="100%" />
            <Line width="80%" />
          </div>
        </div> :
      layout === 'editorial' ?
      <div className="flex h-full flex-col gap-2">
          <div className="border-b border-slate-200 pb-2">
            <span className="block h-2 w-2/3 rounded-sm bg-slate-500" />
            <span className="mt-1.5 block h-1 w-1/3 rounded-sm" style={{ backgroundColor: accent }} />
          </div>
          <div className="grid flex-1 grid-cols-3 gap-2">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Line width="40%" dark />
              <Line width="100%" />
              <Line width="94%" />
              <Line width="88%" />
              <Line width="40%" dark />
              <Line width="100%" />
              <Line width="82%" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Line width="70%" dark />
              <Line width="100%" />
              <Line width="80%" />
              <Line width="90%" />
            </div>
          </div>
        </div> :

      <div className="flex h-full flex-col gap-1.5">
          <span className="block h-2 w-1/2 rounded-sm bg-slate-500" />
          <Line width="35%" />
          <span className="my-1 block h-px w-full bg-slate-200" />
          <span className="block h-1 w-8 rounded-sm" style={{ backgroundColor: accent }} />
          <Line width="100%" />
          <Line width="92%" />
          {layout === 'compact' ? null : <Line width="86%" />}
          <span className="mt-1 block h-1 w-8 rounded-sm" style={{ backgroundColor: accent }} />
          <Line width="100%" />
          <Line width="90%" />
          <Line width="78%" />
          <span className="mt-1 block h-1 w-8 rounded-sm" style={{ backgroundColor: accent }} />
          <div className="flex flex-wrap gap-1">
            {['18px', '24px', '20px', '16px'].map((width, index) =>
          <span key={index} className="h-2 rounded-sm bg-slate-100" style={{ width }} />
          )}
          </div>
        </div>
      }
    </div>);

}