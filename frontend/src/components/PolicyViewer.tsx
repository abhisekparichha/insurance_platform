import { useState } from 'react';
import { ChevronDown, Anchor } from 'lucide-react';
import { PolicyDocument, PolicySection } from '../types';
import { getHighlightSegments } from '../lib/highlightMatch';

export type PolicyViewerProps = {
  excerpt: string;
  fullText: string;
  sections: PolicySection[];
  documents: PolicyDocument[];
  searchTerm?: string;
};

const PolicyViewer = ({ excerpt, fullText, sections, documents, searchTerm }: PolicyViewerProps) => {
  const [expanded, setExpanded] = useState(false);
  const excerptSegments = getHighlightSegments(excerpt, searchTerm);
  const fullSegments = getHighlightSegments(fullText, searchTerm);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/50">Policy wording</p>
          <h3 className="text-lg font-semibold text-white">Clause explorer</h3>
        </div>
        <button
          className="flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Collapse' : 'Expand'} <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div className="mt-3 text-sm text-white/80">
        {(expanded ? fullSegments : excerptSegments).map((segment, index) => (
          <span key={`${segment.text}-${index}`} className={segment.match ? 'bg-brand/40 px-0.5' : undefined}>
            {segment.text}
          </span>
        ))}
        {!expanded && <span className="text-brand-light"> …</span>}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {sections.map((section) => (
          <article key={section.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{section.title}</h4>
              <Anchor className="h-4 w-4 text-brand-light" />
            </div>
            <p className="mt-2 text-xs text-white/70">{section.content}</p>
            {section.anchors && (
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-brand-light">
                {section.anchors.map((anchor) => (
                  <span key={anchor.id} className="rounded-full border border-brand/30 px-2 py-0.5">
                    #{anchor.label}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/80">
        {documents.map((document) => (
          <a
            key={document.id}
            href={document.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/20 px-3 py-1"
          >
            {document.label}
          </a>
        ))}
      </div>
    </div>
  );
};

export default PolicyViewer;
