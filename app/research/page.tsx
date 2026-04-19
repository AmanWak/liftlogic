import Link from "next/link";
import type { Metadata } from "next";
import { IDEAL_SQUAT, THRESHOLDS, IDEAL_LIFT, WORKER_THRESHOLDS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Research · LiftLogic",
  description: "The peer-reviewed basis for LiftLogic's ideal squat and worksite thresholds.",
};

interface IdealRow {
  dimension: string;
  ideal: string;
  ourTrigger: string;
  source: string;
}

const ROWS: IdealRow[] = [
  {
    dimension: "depth",
    ideal: `knee flexion ${IDEAL_SQUAT.DEPTH_KNEE_FLEXION_PARALLEL_DEG[0]}°–${IDEAL_SQUAT.DEPTH_KNEE_FLEXION_PARALLEL_DEG[1]}° (parallel) or ${IDEAL_SQUAT.DEPTH_KNEE_FLEXION_DEEP_DEG[0]}°–${IDEAL_SQUAT.DEPTH_KNEE_FLEXION_DEEP_DEG[1]}° (deep)`,
    ourTrigger: `thigh pitch above ${THRESHOLDS.DEPTH_PARALLEL}° at bottom`,
    source: "Escamilla 2001 · Straub 2024",
  },
  {
    dimension: "lumbar",
    ideal: `≈ ${IDEAL_SQUAT.LUMBAR_NEUTRAL_DEG}° from neutral zone`,
    ourTrigger: `> ${THRESHOLDS.LUMBAR_FLEXION}° deviation from standing baseline`,
    source: "Stiehl 2023",
  },
  {
    dimension: "knee valgus",
    ideal: `≈ ${IDEAL_SQUAT.KNEE_VALGUS_IDEAL_DEG}° (knees over toes); > ${IDEAL_SQUAT.KNEE_VALGUS_UNDESIRABLE_ABOVE_DEG}° is undesirable`,
    ourTrigger: `> ${THRESHOLDS.KNEE_VALGUS}° left-right thigh roll asymmetry`,
    source: "Mistry 2005 · Meeusen 2020",
  },
  {
    dimension: "hip shift",
    ideal: `≈ ${IDEAL_SQUAT.HIP_LATERAL_SHIFT_IDEAL_CM} cm lateral shift`,
    ourTrigger: `> ${THRESHOLDS.HIP_SHIFT}° left-right thigh pitch asymmetry`,
    source: "Straub 2024",
  },
  {
    dimension: "forward lean",
    ideal: "trunk and tibia within ~10° of each other",
    ourTrigger: `> ${THRESHOLDS.FORWARD_LEAN}° torso pitch from vertical (proxy — see future work)`,
    source: "Escamilla 2001",
  },
];

interface Citation {
  ref: string;
  url: string;
}

const CITATIONS: Citation[] = [
  {
    ref: "Escamilla, R. F. (2001). Knee biomechanics of the dynamic squat exercise. Medicine & Science in Sports & Exercise, 33(1), 127–141.",
    url: "https://journals.lww.com/acsm-msse/Fulltext/2001/01000/Knee_biomechanics_of_the_dynamic_squat_exercise.20.aspx",
  },
  {
    ref: "Straub, R. K., Barrack, A. J., Cannon, J., & Powers, C. M. (2024). A biomechanical review of the squat exercise: Implications for clinical practice. International Journal of Sports Physical Therapy, 19(4), 490–501.",
    url: "https://pubmed.ncbi.nlm.nih.gov/38576838/",
  },
  {
    ref: "Stiehl, J. B., Komistek, R. D., & Cloutier, J. M. (2023). Defining the lumbar and trunk-thigh neutral zone during the deep squat. Journal of Orthopaedic Research.",
    url: "https://pubmed.ncbi.nlm.nih.gov/37449565/",
  },
  {
    ref: "Mistry, J. J., Hughes, G., & Onambele-Pearson, G. (2005). Differences in peak knee valgus angles between individuals with high and low Q-angles during a single-limb squat. Clinical Biomechanics.",
    url: "https://pubmed.ncbi.nlm.nih.gov/16172957/",
  },
  {
    ref: "Meeusen, R., et al. (2020). Dynamic knee valgus in single-leg movement tasks: A systematic review. Journal of Orthopaedic & Sports Physical Therapy.",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7253927/",
  },
];

const WORKER_ROWS: IdealRow[] = [
  {
    dimension: "trunk flexion",
    ideal: `as close to ${IDEAL_LIFT.TRUNK_FLEXION_NEUTRAL_DEG}° (neutral) as possible; > ${IDEAL_LIFT.TRUNK_FLEXION_HIGH_RISK_ABOVE_DEG}° is high-risk in field studies`,
    ourTrigger: `> ${WORKER_THRESHOLDS.OVERLOADED_LEAN}° torso pitch (extreme fold-over)`,
    source: "CDC/NIOSH 2007 · CDC MMWR 2021",
  },
  {
    dimension: "lumbar rounding",
    ideal: "spine stays in the neutral zone — 0° deviation from standing baseline",
    ourTrigger: `> ${WORKER_THRESHOLDS.BACK_ROUNDED_DELTA}° lumbar (s2) deviation from upright baseline`,
    source: "CDC/NIOSH 2007",
  },
  {
    dimension: "leg drive",
    ideal: `knee flexion > ${IDEAL_LIFT.LEG_DRIVE_IDEAL_KNEE_FLEXION_DEG}° during the lift ("lift with the legs, not the back")`,
    ourTrigger: `torso flexion > ${WORKER_THRESHOLDS.STIFF_LEG_TORSO_MIN}° while thighs barely flex (< ${WORKER_THRESHOLDS.STIFF_LEG_THIGH_MAX}°)`,
    source: "CDC/NIOSH 2007 · CDC MMWR 2021",
  },
  {
    dimension: "asymmetry",
    ideal: `symmetric stance and torso — ${IDEAL_LIFT.LEG_LOAD_ASYMMETRY_IDEAL_DEG}° leg-load split, ${IDEAL_LIFT.TRUNK_SIDE_BEND_IDEAL_DEG}° side-bend`,
    ourTrigger: `leg roll split > ${WORKER_THRESHOLDS.LEG_ASYMMETRY}° OR torso side-bend > ${WORKER_THRESHOLDS.TORSO_SIDE_BEND}°`,
    source: "Holte 2022 · Höyland 2022",
  },
];

const WORKER_CITATIONS: Citation[] = [
  {
    ref: "Centers for Disease Control and Prevention. (2007). Ergonomic guidelines for manual material handling (DHHS [NIOSH] Publication No. 2007-131).",
    url: "https://www.cdc.gov/niosh/media/pdfs/Ergonomic-Guidelines-for-Manual-Material-Handling_2007-131.pdf",
  },
  {
    ref: "Centers for Disease Control and Prevention. (2021). Workers' compensation claim rates and costs for musculoskeletal disorders related to overexertion among construction workers — Ohio, 2007–2017. MMWR, 70(16), 577–582.",
    url: "http://www.cdc.gov/mmwr/volumes/70/wr/mm7016a1.htm?s_cid=mm7016a1_w",
  },
  {
    ref: "Frings-Dresen, M. H. W., & Kuijer, P. P. F. M. (1999). Assessment of exposure to pushing and pulling in epidemiological field studies: An overview of methods, exposure measures, and measurement strategies. Ergonomics, 42(12), 1610–1623.",
    url: "https://linkinghub.elsevier.com/retrieve/pii/S0169814199000086",
  },
  {
    ref: "Holte, K. A., Westgaard, R. H., & colleagues. (2022). Occupational lifting, carrying, pushing, pulling loads and risk of subacromial impingement syndrome surgery. Scandinavian Journal of Work, Environment & Health.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9453562/",
  },
  {
    ref: "Höyland, E., & colleagues. (2022). Surgery for subacromial impingement syndrome and occupational biomechanical risk factors in a 16-year prospective study among male construction workers. Scandinavian Journal of Work, Environment & Health.",
    url: "http://www.sjweh.fi/show_abstract.php?abstract_id=4075",
  },
];

export default function ResearchPage() {
  return (
    <main
      className="mx-auto w-full max-w-[520px] px-4 pb-16"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <header className="mb-4 flex items-center justify-between gap-2 border border-border bg-surface px-3 py-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span
            className="font-display text-base font-semibold tracking-tight text-foreground"
            style={{ letterSpacing: "-0.01em" }}
          >
            liftlogic
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
            / research
          </span>
        </div>
        <Link
          href="/"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted hover:text-foreground"
        >
          ← back
        </Link>
      </header>

      <section className="mb-6 border border-border bg-surface px-4 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
          premise
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground text-balance">
          Every form error LiftLogic flags maps to a threshold grounded in
          peer-reviewed biomechanics literature. The &quot;ideal&quot; column
          below comes from the research; the &quot;we flag&quot; column is the
          permissive demo threshold we actually check against in real time.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
          workout mode · ideal values vs. our triggers
        </h2>
        <div className="border-t border-border">
          {ROWS.map((row) => (
            <div
              key={row.dimension}
              className="grid grid-cols-1 gap-1.5 border-b border-border px-3 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                  {row.dimension}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
                  {row.source}
                </span>
              </div>
              <div className="flex flex-col gap-1 pt-0.5">
                <div className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 inline-block min-w-[54px] font-mono text-[9px] uppercase tracking-wider text-muted">
                    ideal
                  </span>
                  <span className="flex-1 text-foreground">{row.ideal}</span>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 inline-block min-w-[54px] font-mono text-[9px] uppercase tracking-wider text-muted">
                    we flag
                  </span>
                  <span className="flex-1 text-muted-strong">{row.ourTrigger}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
          worksite mode · ideal lift vs. our triggers
        </h2>
        <p className="mb-3 px-1 text-xs leading-relaxed text-muted-strong text-balance">
          Worksite mode detects unsafe manual-material-handling patterns using
          the same 5-IMU garment. Thresholds are grounded in CDC/NIOSH
          ergonomic guidance and construction-injury surveillance data.
        </p>
        <div className="border-t border-border">
          {WORKER_ROWS.map((row) => (
            <div
              key={row.dimension}
              className="grid grid-cols-1 gap-1.5 border-b border-border px-3 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                  {row.dimension}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
                  {row.source}
                </span>
              </div>
              <div className="flex flex-col gap-1 pt-0.5">
                <div className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 inline-block min-w-[54px] font-mono text-[9px] uppercase tracking-wider text-muted">
                    ideal
                  </span>
                  <span className="flex-1 text-foreground">{row.ideal}</span>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 inline-block min-w-[54px] font-mono text-[9px] uppercase tracking-wider text-muted">
                    we flag
                  </span>
                  <span className="flex-1 text-muted-strong">{row.ourTrigger}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 border border-border bg-surface-2 px-4 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
          future work
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-strong text-balance">
          The trunk–tibia alignment test (Escamilla 2001) is the most
          biomechanically correct forward-lean check — trunk and tibia should
          stay within ~{IDEAL_SQUAT.TRUNK_TIBIA_ALIGNMENT_DEG}° of each other.
          It needs two more IMUs on the shins that the current garment
          doesn&apos;t carry. Planned upgrade.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
          workout citations · apa 7
        </h2>
        <ol className="space-y-3 border-t border-border pt-3">
          {CITATIONS.map((c, i) => (
            <li key={c.url} className="flex gap-3 px-1">
              <span className="font-mono text-[10px] tabular-nums text-muted">
                [{i + 1}]
              </span>
              <div className="flex-1 text-xs leading-relaxed text-muted-strong">
                <span>{c.ref}</span>{" "}
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-accent hover:brightness-110"
                >
                  {c.url}
                </a>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
          worksite citations · apa 7
        </h2>
        <ol className="space-y-3 border-t border-border pt-3">
          {WORKER_CITATIONS.map((c, i) => (
            <li key={c.url} className="flex gap-3 px-1">
              <span className="font-mono text-[10px] tabular-nums text-muted">
                [{i + 1}]
              </span>
              <div className="flex-1 text-xs leading-relaxed text-muted-strong">
                <span>{c.ref}</span>{" "}
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-accent hover:brightness-110"
                >
                  {c.url}
                </a>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 border-t border-border pt-4 text-center">
        <Link
          href="/"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:brightness-110"
        >
          ← return to session
        </Link>
      </div>
    </main>
  );
}
