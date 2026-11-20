import { LENSES, SOURCE_LABEL, SOURCE_TONE, Swatch } from './words';
import type { SwatchKind } from './words';
import type { SourceKey } from './model';

/**
 * "How to read the Lantern": how the tower is built, what its windows and
 * the numbers beside them mean, and the three more views kept in the
 * full-screen view, with a drawn sample beside each line. Plain content for
 * a sheet; it draws nothing in 3D.
 */
const lower = (t: string) => (/^(ISAs|State)/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
const Row = ({ kind, colour, children }: { kind: SwatchKind; colour?: string; children: React.ReactNode }) => (
  <li className="flex items-start gap-2.5 py-1">
    <span className="mt-0.5"><Swatch kind={kind} colour={colour} /></span>
    <span className="text-[0.86rem] leading-snug" style={{ color: 'var(--color-ink-dim)' }}>{children}</span>
  </li>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl p-4" style={{ background: 'var(--color-canvas)' }}>
    <h3 className="font-bold text-[0.95rem]">{title}</h3>
    {children}
  </section>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-1 text-[0.86rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>{children}</p>
);

const SOURCES: SourceKey[] = ['pension', 'isa', 'cash', 'scheme', 'work', 'sp', 'partnerSp'];

export default function LanternKey({ couple, structured }: { couple: boolean; structured: boolean }) {
  return (
    <div data-lantern-key-sheet className="space-y-3 pb-2">
      <Section title="How the tower is built">
        <P>Each floor is one year of your plan, from the year you stop work at the bottom to your plan age at the top. Your age is beside the floors.</P>
        <P>A floor is as wide as what you plan to spend that year, so the tower steps in where your spending steps down.</P>
        <P>Tap a floor to open it and read that year in words; tap it again to close it.</P>
        <ul className="mt-2">
          <Row kind="strip" colour={SOURCE_TONE.sp}>A strip of light up a corner: {couple ? 'a State Pension, from the year it starts (violet is yours, lilac your partner’s)' : 'your State Pension, from the year it starts'}.</Row>
          {structured && <Row kind="stone">Stone posts at the foot: your safe ladder, as tall as the years of spending it holds.</Row>}
        </ul>
      </Section>

      <Section title={LENSES[0]}>
        <P>Every floor has 10 windows. Each window is 10 of every 100 simulated futures for that year, sorted from the worst on the left to the best on the right. A window that is half lit is 5.</P>
        <ul className="mt-2">
          <Row kind="full">Lit and gold: that year’s plan is paid in full.</Row>
          <Row kind="short">Unlit, a slate pane: less than the plan is paid that year.</Row>
        </ul>
        <P>The number beside a floor is the count of lit windows: “75 of 100” means seven and a half windows are lit, so 75 of 100 futures pay your plan in full that year.</P>
        <P>Where the lights go out, up and to the left, is where the plan is at risk: late in life, in the worst futures.</P>
      </Section>

      <Section title="Three more views">
        <P>The home shows this one face of the tower. The full-screen view turns it to three more, each with its own key.</P>
        <ul className="mt-2">
          <Row kind="block" colour={SOURCE_TONE.pension}><b>{LENSES[1]}.</b> Each floor is a bar showing where that year’s spending comes from if returns are steady: {SOURCES.filter(k => couple || k !== 'partnerSp').map(k => lower(SOURCE_LABEL[k])).join(', ')}.</Row>
          <Row kind="bar"><b>{LENSES[2]}.</b> The money still left at the end of each year, in today’s money, on the same scale for every floor: a bright bar for the middle future over a band from the 10th to the 90th of 100 futures.</Row>
          <Row kind="ghost"><b>{LENSES[3]}.</b> The same windows after markets fall by 30% in the year you stop. A white outline marks a window the fall dimmed or put out.</Row>
        </ul>
        <a data-lantern-key-more href="./?lantern=1" className="mt-3 flex items-center justify-center min-h-[44px] rounded-xl text-[0.86rem] font-semibold"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)', color: 'var(--color-ink)', textDecoration: 'none' }}>
          Open the full-screen view <span aria-hidden="true">&nbsp;›</span>
        </a>
      </Section>

      <p className="text-[0.78rem] leading-relaxed px-1" style={{ color: 'var(--color-ink-faint)' }}>
        The futures are simulated, not predicted. An estimate, not a guarantee.
      </p>
    </div>
  );
}
