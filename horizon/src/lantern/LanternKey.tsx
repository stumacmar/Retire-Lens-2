import { LENSES, SOURCE_LABEL, SOURCE_TONE, Swatch } from './words';
import type { SwatchKind } from './words';
import type { SourceKey } from './model';

/**
 * "How to read the Lantern": how the tower is built, then what every mark
 * means on each of its four faces, with a drawn sample beside each line.
 * Plain content for a sheet; it draws nothing in 3D.
 */
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

export default function LanternKey({ essential, couple, structured }: { essential: string; couple: boolean; structured: boolean }) {
  return (
    <div data-lantern-key-sheet className="space-y-3 pb-2">
      <Section title="How the tower is built">
        <P>Each floor is one year of your plan, from the year you stop work at the bottom to your plan age at the top. The ages are beside the floors.</P>
        <P>A floor is as wide as what you plan to spend that year, so the tower steps in where your spending steps down.</P>
        <P>The tower has four faces. Each button under it turns the tower to one face, and each face answers one question. Tap a floor to open it and read that year in words; tap it again to close it.</P>
        <ul className="mt-2">
          <Row kind="strip" colour={SOURCE_TONE.sp}>A strip of light up a corner: {couple ? 'a State Pension, from the year it starts (violet is yours, lilac your partner’s)' : 'your State Pension, from the year it starts'}.</Row>
          {structured && <Row kind="stone">Stone posts at the foot: your safe ladder, as tall as the years of spending it holds.</Row>}
        </ul>
      </Section>

      <Section title={LENSES[0]}>
        <P>Every floor has 20 windows. Each window is 5 of every 100 simulated futures for that year, sorted from the worst on the left to the best on the right. So a floor with 15 gold windows means 75 of 100 futures pay your plan in full that year.</P>
        <ul className="mt-2">
          <Row kind="full">Tall and gold: that year’s plan is paid in full.</Row>
          <Row kind="floor">Half height and white: less than the plan is paid, but the essentials ({essential} a year) are covered.</Row>
          <Row kind="short">Dark with a red foot: less than the essentials is paid.</Row>
          <Row kind="outline">A white outline on the open floor: the middle future.</Row>
        </ul>
        <P>Where the lights go out, up and to the left, is where the plan is at risk: late in life, in the worst futures.</P>
      </Section>

      <Section title={LENSES[1]}>
        <P>Each floor is a bar showing where that year’s spending comes from if returns are steady (the central case). The colours add up to the whole year; a gap at the right would be a year that was not fully paid.</P>
        <ul className="mt-2">
          {SOURCES.filter(k => couple || k !== 'partnerSp').map(k => <Row key={k} kind="block" colour={SOURCE_TONE[k]}>{SOURCE_LABEL[k]}{k === 'pension' ? ', including tax-free cash' : k === 'cash' ? ' and any general account' : k === 'scheme' ? ' and annuities' : ''}.</Row>)}
        </ul>
      </Section>

      <Section title={LENSES[2]}>
        <P>Each floor shows the money still left at the end of that year, in today’s money. Every floor uses the same scale, so a shorter bar higher up means the money is running down.</P>
        <ul className="mt-2">
          <Row kind="bar">The bright bar: the middle future.</Row>
          <Row kind="halo">The wider band behind it: from the 10th to the 90th of 100 futures.</Row>
        </ul>
      </Section>

      <Section title={LENSES[3]}>
        <P>The same windows as “{LENSES[0]}”, after markets fall by 30% in the year you stop. Every other year of every future is unchanged, so the difference is the fall alone.</P>
        <ul className="mt-2">
          <Row kind="ghost">A gold outline: a light that was on in your plan and that the fall dimmed or put out.</Row>
        </ul>
      </Section>

      <p className="text-[0.78rem] leading-relaxed px-1" style={{ color: 'var(--color-ink-faint)' }}>
        The futures are simulated, not predicted. An estimate, not a guarantee.{' '}
        <a href="./?lantern=1" className="underline" style={{ color: 'var(--color-ink-dim)' }}>Open the Lantern full screen</a>
      </p>
    </div>
  );
}
