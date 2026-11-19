import type { ReactNode } from "react";

/**
 * App shell building blocks (styles in app/app-shell.css). Copy both files into the next
 * list-style app; see APP-SHELL.md for the page structure.
 */

export const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
);

export type Tone = "green" | "amber" | "grey" | "red";

export function AppTop({ name, tagline }: { name: string; tagline: string }) {
  return (
    <header className="as-top">
      <div className="as-brand">{name}<small>{tagline}</small></div>
      <nav aria-label="Site">
        <a href="https://bookchaowalit.com/">Bookchaowalit</a>
      </nav>
    </header>
  );
}

export function AppFoot({ source }: { source: string }) {
  return (
    <footer className="as-foot">
      <a href="https://bookchaowalit.com/">More projects</a>
      <a href={source}>Source</a>
      <a href="https://bookchaowalit.com/privacy">Privacy</a>
      <a href="https://monitor.bookchaowalit.com/">Status</a>
    </footer>
  );
}

/** One entry in the sidebar list of lists. */
/** `countText` replaces the bare number on screen (e.g. "1/3"); `countLabel` is what a screen reader hears instead (e.g. "1 of 3 done"). */
export function ListButton({ label, count, countText, countLabel, tone, current, onSelect }: { label: string; count: number; countText?: string; countLabel?: string; tone?: Tone; current: boolean; onSelect: () => void }) {
  return (
    <li>
      <button type="button" aria-current={current ? "true" : undefined} onClick={onSelect}>
        <span>{tone ? <span className="as-dot" data-tone={tone} aria-hidden="true" /> : null}{label}</span>
        {countLabel ? (
          <span className="as-count"><span aria-hidden="true">{countText ?? count}</span><span className="as-sr">{`, ${countLabel}`}</span></span>
        ) : (
          <span className="as-count">{countText ?? count}</span>
        )}
      </button>
    </li>
  );
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className="as-pill" data-tone={tone}>{children}</span>;
}
