import React from 'react';
import { profile } from '../../data/activity';
import { cn } from '../../utils/cn';

export function CvPreview({
  accent = '#2563eb',
  summary,
  className




}: {accent?: string;summary: string;className?: string;}) {
  return (
    <article
      className={cn('mx-auto w-full max-w-[720px] bg-white p-8 text-[11px] leading-relaxed text-slate-700 shadow-raised', className)}
      style={{ aspectRatio: '1 / 1.414' }}>
      
      <header className="border-b pb-3" style={{ borderColor: accent }}>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-slate-900">
          {profile.firstName} {profile.lastName}
        </h1>
        <p className="mt-0.5 text-[12px] font-medium" style={{ color: accent }}>
          {profile.title}
        </p>
        <p className="mt-1.5 text-[10px] text-slate-500">
          {profile.city} · {profile.email} · {profile.phone} · {profile.links[0].value}
        </p>
      </header>

      <section className="mt-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-900">Profil</h2>
        <p className="mt-1.5 text-slate-600">{summary}</p>
      </section>

      <section className="mt-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-900">Expériences</h2>
        <div className="mt-2 space-y-3">
          {profile.experiences.map((experience) =>
          <div key={experience.company}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[12px] font-semibold text-slate-900">
                  {experience.role} — {experience.company}
                </p>
                <p className="shrink-0 text-[10px] text-slate-500">{experience.period}</p>
              </div>
              <p className="text-[10px] text-slate-500">{experience.city}</p>
              <p className="mt-1 text-slate-600">{experience.description}</p>
            </div>
          )}
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-5">
        <section>
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-900">Formation</h2>
          <ul className="mt-2 space-y-1.5">
            {profile.education.map((item) =>
            <li key={item.degree}>
                <p className="text-[11px] font-medium text-slate-800">{item.degree}</p>
                <p className="text-[10px] text-slate-500">
                  {item.school} · {item.period}
                </p>
              </li>
            )}
          </ul>
        </section>
        <section>
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-900">Langues</h2>
          <ul className="mt-2 space-y-1">
            {profile.languages.map((language) =>
            <li key={language.name} className="flex justify-between gap-3 text-[11px]">
                <span className="text-slate-800">{language.name}</span>
                <span className="text-slate-500">{language.level}</span>
              </li>
            )}
          </ul>
        </section>
      </div>

      <section className="mt-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-900">Compétences</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {profile.skills.map((skill) =>
          <span
            key={skill}
            className="rounded border px-1.5 py-0.5 text-[10px] text-slate-700"
            style={{ borderColor: `${accent}40`, backgroundColor: `${accent}0d` }}>
            
              {skill}
            </span>
          )}
        </div>
      </section>

      <section className="mt-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-900">Projets</h2>
        <ul className="mt-2 space-y-1">
          {profile.projects.map((project) =>
          <li key={project.name}>
              <span className="text-[11px] font-medium text-slate-800">{project.name}</span>
              <span className="text-slate-600"> — {project.detail}</span>
            </li>
          )}
        </ul>
      </section>
    </article>);

}