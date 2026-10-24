import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * A paged carousel.
 *
 * Native scroll-snap does the moving, so a swipe feels like the phone's own —
 * momentum, rubber-banding, interruption mid-flight — in a way a JS drag
 * never quite does. The arrows and the rail scroll the same element, so
 * finger, keyboard and tap all drive one mechanism and can never disagree.
 *
 * The frame takes the height of the page you are on, rather than the tallest
 * page, so a three-question page is three questions tall and the sheet below
 * it does not end in a field of nothing.
 */
export interface Page { id: string; title: string; blurb?: string; body: React.ReactNode }

export default function Carousel({ pages, index, onIndex, footer, railBg = 'var(--color-surface)' }: {
  pages: Page[]; index: number; onIndex: (i: number) => void; footer?: React.ReactNode;
  /** The surface the rail sits on when it sticks. */
  railBg?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const paneRefs = useRef<(HTMLElement | null)[]>([]);
  const railRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [h, setH] = useState<number | undefined>(undefined);
  const programmatic = useRef(false);
  const settle = useRef<number | undefined>(undefined);
  const arrive = useRef<number | undefined>(undefined);

  const i = Math.max(0, Math.min(pages.length - 1, index));

  // The frame breathes to fit the page you are on. Measured after layout and
  // on any content change (a toggle that reveals two more fields).
  useLayoutEffect(() => {
    const el = paneRefs.current[i];
    if (!el) return;
    const measure = () => setH(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [i, pages]);

  const goTo = useCallback((n: number, smooth = true) => {
    const sc = scroller.current; const el = paneRefs.current[n];
    if (!sc || !el) return;
    programmatic.current = true;
    window.clearTimeout(arrive.current);
    sc.scrollTo({ left: el.offsetLeft - sc.offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
    if (!smooth) { programmatic.current = false; return; }
    // Hold the guard until the scroll has ARRIVED, not for a guessed duration.
    // A jump across five pages on a slow device takes far longer than any
    // fixed timeout; releasing early makes the carousel act on a position it
    // is still travelling through and dump you on a page you did not choose.
    const started = Date.now();
    const check = () => {
      const s2 = scroller.current, e2 = paneRefs.current[n];
      if (!s2 || !e2) { programmatic.current = false; return; }
      const want = e2.offsetLeft - s2.offsetLeft;
      if (Math.abs(s2.scrollLeft - want) <= 2 || Date.now() - started > 4000) programmatic.current = false;
      else arrive.current = window.setTimeout(check, 60);
    };
    arrive.current = window.setTimeout(check, 60);
  }, []);

  // Index changed from outside (rail, arrows, a jump) → move the scroller.
  // Neighbouring pages slide, because that reads as movement and is over in a
  // blink. A jump across the rail goes straight there: at that distance the
  // slide is a blur, and a long animation in flight is state that can disagree
  // with the page you asked for.
  const prevI = useRef(i);
  useEffect(() => {
    const adjacent = Math.abs(i - prevI.current) === 1;
    prevI.current = i;
    goTo(i, adjacent);
  }, [i, goTo]);
  // Page set changed under us (a partner added) → stay put, no animation.
  useEffect(() => { goTo(Math.min(i, pages.length - 1), false); }, [pages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // A finger-driven scroll reports where it LANDED, once it has stopped —
  // a scroll in flight passes over every page in between, and reacting to
  // those would both flicker the frame height and mark the destination inert.
  const onScroll = () => {
    if (programmatic.current) return;
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const sc = scroller.current; if (!sc) return;
      const left = sc.scrollLeft;
      let best = 0, bestD = Infinity;
      paneRefs.current.forEach((el, n) => {
        if (!el) return;
        const d = Math.abs((el.offsetLeft - sc.offsetLeft) - left);
        if (d < bestD) { bestD = d; best = n; }
      });
      if (best !== i) onIndex(best);
    }, 140);
  };
  useEffect(() => () => { window.clearTimeout(settle.current); window.clearTimeout(arrive.current); }, []);

  // Keep the current step visible in the rail without yanking the page.
  useEffect(() => {
    railRefs.current[i]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [i]);

  const page = pages[i];
  return (
    <div>
      {/* The rail: every step named, the current one lit, any of them one tap
          away. You are never more than a glance from knowing where you are. */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-2 mb-1 overflow-x-auto no-scrollbar" style={{ background: railBg }}>
        <div className="flex gap-1.5 w-max">
          {pages.map((p, n) => (
            <button key={p.id} ref={el => { railRefs.current[n] = el; }} onClick={() => onIndex(n)}
              aria-current={n === i ? 'step' : undefined}
              className="shrink-0 rounded-full px-3 py-1.5 text-[0.76rem] font-semibold whitespace-nowrap transition-colors"
              style={{
                background: n === i ? 'var(--color-calm)' : 'var(--color-canvas)',
                color: n === i ? 'var(--color-ink)' : 'var(--color-ink-dim)',
                border: '1px solid ' + (n === i ? 'var(--color-calm)' : 'var(--color-hairline)'),
              }}>
              {p.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-[1.3rem] font-extrabold tracking-tight leading-tight">{page.title}</h2>
        <span className="tnum shrink-0 text-[0.74rem] font-semibold" style={{ color: 'var(--color-ink-faint)' }}>
          {i + 1} / {pages.length}
        </span>
      </div>
      {page.blurb && <p className="text-[0.84rem] leading-relaxed mb-4" style={{ color: 'var(--color-ink-dim)' }}>{page.blurb}</p>}

      {/* The scroller IS the flex row, so a page is exactly one frame wide —
          nothing of the next page peeks in and nothing is clipped. */}
      <div ref={scroller} onScroll={onScroll}
           className="flex items-start gap-6 overflow-x-auto overflow-y-hidden snap-x snap-mandatory
                      no-scrollbar transition-[height] duration-300 ease-out"
           style={{ height: h, scrollbarWidth: 'none' }}>
        {pages.map((p, n) => (
          <section key={p.id} ref={el => { paneRefs.current[n] = el; }}
            className="flex-[0_0_100%] snap-start space-y-5 pb-1"
            data-pane={p.id} data-title={p.title}
            // Every page stays in the DOM so the scroll is real; this marks
            // the one actually on screen, for anything that needs to tell
            // them apart (tests included).
            {...(n === i ? { 'data-active': '' } : {})}
            aria-hidden={n === i ? undefined : true}
            // Only the page in view takes focus, so Tab never lands you in a
            // field you cannot see. React 19 treats inert as a true boolean:
            // an empty string reads as FALSE and silently drops it.
            inert={n !== i}>
            {p.body}
          </section>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button onClick={() => onIndex(i - 1)} disabled={i === 0} aria-label="Previous"
          className="flex items-center justify-center rounded-full shrink-0 transition-opacity"
          style={{ width: 46, height: 46, background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)',
                   color: 'var(--color-calm-strong)', opacity: i === 0 ? 0.35 : 1 }}>
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">{footer}</div>
        <button onClick={() => onIndex(i + 1)} disabled={i === pages.length - 1} aria-label="Next"
          className="flex items-center justify-center rounded-full shrink-0 transition-opacity"
          style={{ width: 46, height: 46, background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)',
                   color: 'var(--color-calm-strong)', opacity: i === pages.length - 1 ? 0.35 : 1 }}>
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
