// HSE training visuals.
//
// Each concept in config/hseTrainingCatalog.js names a `visual`. This module
// renders that visual as a self-contained, resolution-independent SVG scene:
// depth-shaded, brand-consistent, and legible at both card-thumbnail and
// hero size, with no network fetch and nothing to lazy-load.
//
// `RENDER_BRIEFS` below carries the cinematic 3D brief for each scene. That is
// the commissioning spec: when the organisation produces real 3D renders or
// animation for a concept, the brief is what the studio works to, and the
// finished asset is uploaded against the training record (`thumbnail`/`video`),
// at which point the uploaded media takes precedence over the SVG here. The
// SVG is the always-available floor, never a placeholder for missing content.

export const RENDER_BRIEFS = Object.freeze({
  constructionSite:
    "3D cinematic safety training scene showing a realistic construction site worker wearing a bright yellow safety helmet, safety glasses, high-visibility vest and properly attached safety harness while working safely on scaffolding. Show correct PPE, secure access, barricading and clean housekeeping. Professional industrial safety training visualization, realistic lighting, high detail.",
  fireEvacuation:
    "3D instructional office evacuation scene showing glowing green emergency exit signs, clearly marked evacuation routes and employees calmly moving toward the designated assembly area. Professional HSE training visualization.",
  manufacturing:
    "3D industrial safety scene showing a robotic machine operating inside a guarded safety zone. Highlight the danger zone and emergency stop button using clear safety overlays.",
  chemicalSpill:
    "3D HSE training animation showing a trained worker wearing correct chemical PPE responding to a controlled chemical spill using an appropriate spill kit.",
  workingAtHeight:
    "3D realistic construction safety training scene showing a worker correctly wearing a full-body safety harness connected to an approved anchor point while working at height.",
  electrical:
    "3D industrial safety training scene showing proper electrical isolation, PPE, warning signage and Lockout/Tagout procedure before maintenance.",
  roadSafety:
    "3D highway safety training scene showing a correctly signed and coned lane closure on a toll road at night, with a Class 3 high-visibility crew working inside the protected zone and traffic guided past by an illuminated taper.",
  ppe:
    "3D personal protective equipment training scene showing a full PPE set — helmet, safety glasses, ear protection, gloves, high-visibility vest, safety shoes and full-body harness — laid out and labelled for inspection."
});

const Defs = ({ id, accent }) => (
  <defs>
    <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#0b1220" />
      <stop offset="60%" stopColor="#111a2b" />
      <stop offset="100%" stopColor="#1a2436" />
    </linearGradient>
    <linearGradient id={`${id}-accent`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor={accent} stopOpacity="0.95" />
      <stop offset="100%" stopColor={accent} stopOpacity="0.45" />
    </linearGradient>
    <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#1d2635" />
      <stop offset="100%" stopColor="#0d131d" />
    </linearGradient>
    <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
      <stop offset="100%" stopColor={accent} stopOpacity="0" />
    </radialGradient>
  </defs>
);

/** Shared worker figure: helmet, glasses, hi-vis vest, gloves, boots. */
const Worker = ({ x = 0, y = 0, scale = 1, harness = false, vest = "#f59e0b" }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    {/* legs */}
    <path d="M-9 34 L-8 62 M9 34 L8 62" stroke="#334155" strokeWidth="9" strokeLinecap="round" />
    <path d="M-13 64 h11 M2 64 h11" stroke="#0f172a" strokeWidth="7" strokeLinecap="round" />
    {/* torso / hi-vis vest */}
    <path d="M-13 0 h26 l3 34 h-32 z" fill={vest} />
    <path d="M-11 10 h22 M-11 20 h22" stroke="#e2e8f0" strokeWidth="3" opacity="0.9" />
    {/* arms */}
    <path d="M-13 4 L-24 24 M13 4 L24 20" stroke="#475569" strokeWidth="8" strokeLinecap="round" />
    <circle cx="-25" cy="26" r="4.5" fill="#1e293b" />
    <circle cx="25" cy="22" r="4.5" fill="#1e293b" />
    {/* head + helmet + glasses */}
    <circle cx="0" cy="-11" r="8.5" fill="#cbb59a" />
    <path d="M-12 -13 a12 11 0 0 1 24 0 z" fill="#facc15" />
    <path d="M-14 -13 h28" stroke="#eab308" strokeWidth="3" strokeLinecap="round" />
    <path d="M-7 -11 h14" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
    {/* chinstrap */}
    <path d="M-8 -8 q8 8 16 0" stroke="#eab308" strokeWidth="1.6" fill="none" />
    {harness ? (
      <g stroke="#22c55e" strokeWidth="2.6" fill="none">
        <path d="M-9 2 L0 16 L9 2" />
        <path d="M-12 16 h24" />
        <path d="M0 16 L0 26" />
      </g>
    ) : null}
  </g>
);

const Cone = ({ x, y, scale = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d="M0 -22 L10 6 H-10 Z" fill="#f97316" />
    <path d="M-6 -6 h12 M-8 -1 h16" stroke="#f8fafc" strokeWidth="3" />
    <rect x="-13" y="6" width="26" height="5" rx="2" fill="#c2410c" />
  </g>
);

/* ------------------------------------------------------------- scenes */

const ConstructionScene = ({ id }) => (
  <>
    <rect width="800" height="450" fill={`url(#${id}-sky)`} />
    <circle cx="640" cy="110" r="150" fill={`url(#${id}-glow)`} />
    {/* scaffold */}
    <g stroke="#64748b" strokeWidth="6" fill="none">
      <path d="M120 380 V150 M300 380 V150 M480 380 V150" />
      <path d="M120 150 H480 M120 240 H480 M120 320 H480" />
      <path d="M120 150 L300 240 M300 150 L480 240 M120 240 L300 320 M300 240 L480 320" strokeWidth="3" opacity=".55" />
    </g>
    {/* boarded platform with toe board + guard rail */}
    <rect x="112" y="228" width="376" height="14" rx="3" fill="#a16207" />
    <rect x="112" y="242" width="376" height="7" rx="2" fill="#78350f" />
    <path d="M112 190 H488 M112 210 H488" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" />
    {/* anchor + lifeline */}
    <circle cx="300" cy="150" r="8" fill="#22c55e" />
    <path d="M300 158 L300 196" stroke="#22c55e" strokeWidth="3" strokeDasharray="6 4" />
    <Worker x={300} y={196} scale={1.05} harness />
    {/* access ladder */}
    <g stroke="#94a3b8" strokeWidth="4">
      <path d="M520 380 V228 M552 380 V228" />
      <path d="M520 250 h32 M520 280 h32 M520 310 h32 M520 340 h32" strokeWidth="3" />
    </g>
    {/* ground, barricade, tidy housekeeping */}
    <rect y="380" width="800" height="70" fill={`url(#${id}-ground)`} />
    <Cone x={620} y={392} scale={0.9} />
    <Cone x={690} y={400} scale={1} />
    <path d="M600 372 H760" stroke="#f59e0b" strokeWidth="6" strokeDasharray="18 10" />
    <rect x="60" y="352" width="46" height="28" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
    <path d="M68 366 h30" stroke="#64748b" strokeWidth="3" />
  </>
);

const HeightScene = ({ id }) => (
  <>
    <rect width="800" height="450" fill={`url(#${id}-sky)`} />
    <circle cx="180" cy="90" r="170" fill={`url(#${id}-glow)`} />
    {/* structure edge */}
    <path d="M0 300 H520 L520 450 H0 Z" fill="#1e293b" />
    <path d="M0 300 H520" stroke="#475569" strokeWidth="6" />
    {/* guard rail + toe board */}
    <path d="M60 300 V210 M240 300 V210 M420 300 V210" stroke="#64748b" strokeWidth="6" />
    <path d="M40 218 H440 M40 252 H440" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" />
    <rect x="40" y="286" width="400" height="10" rx="3" fill="#a16207" />
    {/* rated anchor point above the worker */}
    <path d="M600 60 H700" stroke="#475569" strokeWidth="12" strokeLinecap="round" />
    <circle cx="650" cy="70" r="12" fill="#22c55e" />
    <circle cx="650" cy="70" r="20" fill="none" stroke="#22c55e" strokeWidth="2" opacity=".55" />
    <text x="650" y="40" textAnchor="middle" fill="#86efac" fontSize="15" fontWeight="700" fontFamily="Inter, sans-serif">
      RATED ANCHOR
    </text>
    {/* lanyard kept short and above */}
    <path d="M650 84 Q652 150 640 196" stroke="#22c55e" strokeWidth="4" fill="none" />
    <Worker x={640} y={200} scale={1.15} harness />
    <rect y="404" width="800" height="46" fill={`url(#${id}-ground)`} />
    {/* exclusion zone below */}
    <Cone x={560} y={402} scale={0.8} />
    <Cone x={730} y={402} scale={0.8} />
    <path d="M540 386 H760" stroke="#f59e0b" strokeWidth="5" strokeDasharray="16 9" />
  </>
);

const FireScene = ({ id }) => (
  <>
    <rect width="800" height="450" fill={`url(#${id}-sky)`} />
    <rect y="360" width="800" height="90" fill={`url(#${id}-ground)`} />
    {/* corridor */}
    <path d="M120 90 H680 V360 H120 Z" fill="#131c2c" stroke="#334155" strokeWidth="3" />
    <path d="M120 90 L220 170 M680 90 L580 170 M220 170 V360 M580 170 V360" stroke="#334155" strokeWidth="2.5" opacity=".7" />
    {/* exit sign */}
    <g>
      <rect x="596" y="120" width="120" height="46" rx="8" fill="#052e16" stroke="#22c55e" strokeWidth="3" />
      <text x="640" y="152" fill="#4ade80" fontSize="24" fontWeight="800" fontFamily="Inter, sans-serif">EXIT</text>
      <path d="M686 143 l16 -10 v20 z" fill="#4ade80" />
      <circle cx="656" cy="143" r="60" fill={`url(#${id}-glow)`} />
    </g>
    {/* marked evacuation route */}
    <path d="M180 348 H600" stroke="#22c55e" strokeWidth="8" strokeDasharray="26 14" opacity=".85" />
    <path d="M560 348 l24 -12 v24 z" fill="#22c55e" />
    {/* calmly walking employees */}
    <Worker x={260} y={276} scale={0.62} vest="#38bdf8" />
    <Worker x={350} y={282} scale={0.66} vest="#38bdf8" />
    <Worker x={445} y={288} scale={0.7} vest="#38bdf8" />
    {/* assembly point */}
    <g transform="translate(716 300)">
      <rect x="-34" y="-52" width="68" height="52" rx="6" fill="#052e16" stroke="#22c55e" strokeWidth="3" />
      <circle cx="0" cy="-34" r="7" fill="#4ade80" />
      <path d="M-14 -20 a14 12 0 0 1 28 0 z" fill="#4ade80" />
      <path d="M0 0 V44" stroke="#475569" strokeWidth="6" />
      <text x="0" y="60" textAnchor="middle" fill="#86efac" fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif">
        ASSEMBLY
      </text>
    </g>
  </>
);

const ManufacturingScene = ({ id }) => (
  <>
    <rect width="800" height="450" fill={`url(#${id}-sky)`} />
    <rect y="352" width="800" height="98" fill={`url(#${id}-ground)`} />
    {/* guarded cell */}
    <rect x="150" y="110" width="420" height="242" rx="8" fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray="14 8" />
    <text x="360" y="98" textAnchor="middle" fill="#fcd34d" fontSize="15" fontWeight="700" fontFamily="Inter, sans-serif">
      DANGER ZONE — GUARDED ENVELOPE
    </text>
    {/* mesh guard */}
    <g stroke="#475569" strokeWidth="1.6" opacity=".65">
      {Array.from({ length: 15 }).map((_, index) => (
        <path key={`v${index}`} d={`M${168 + index * 28} 118 V344`} />
      ))}
      {Array.from({ length: 8 }).map((_, index) => (
        <path key={`h${index}`} d={`M158 ${126 + index * 30} H562`} />
      ))}
    </g>
    {/* robot arm */}
    <g stroke="#94a3b8" strokeWidth="16" strokeLinecap="round" fill="none">
      <path d="M300 344 V262" />
      <path d="M300 262 L392 200" />
      <path d="M392 200 L462 236" />
    </g>
    <circle cx="300" cy="344" r="26" fill="#334155" />
    <circle cx="300" cy="262" r="12" fill={`url(#${id}-accent)`} />
    <circle cx="392" cy="200" r="11" fill={`url(#${id}-accent)`} />
    <rect x="452" y="230" width="30" height="20" rx="4" fill="#64748b" />
    {/* conveyor */}
    <rect x="470" y="300" width="290" height="16" rx="8" fill="#334155" />
    {Array.from({ length: 6 }).map((_, index) => (
      <circle key={index} cx={492 + index * 52} cy={308} r="9" fill="#475569" />
    ))}
    {/* emergency stop */}
    <g transform="translate(660 170)">
      <circle r="46" fill={`url(#${id}-glow)`} />
      <circle r="30" fill="#fbbf24" stroke="#b45309" strokeWidth="4" />
      <circle r="19" fill="#dc2626" stroke="#7f1d1d" strokeWidth="3" />
      <text y="62" textAnchor="middle" fill="#fca5a5" fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif">
        EMERGENCY STOP
      </text>
    </g>
    {/* operator safely outside the envelope */}
    <Worker x={92} y={268} scale={0.85} vest="#a78bfa" />
  </>
);

const ChemicalScene = ({ id }) => (
  <>
    <rect width="800" height="450" fill={`url(#${id}-sky)`} />
    <rect y="344" width="800" height="106" fill={`url(#${id}-ground)`} />
    {/* bunded spill area */}
    <ellipse cx="430" cy="392" rx="180" ry="38" fill="#34d399" opacity=".22" />
    <ellipse cx="430" cy="392" rx="180" ry="38" fill="none" stroke="#34d399" strokeWidth="2.5" strokeDasharray="10 7" />
    {/* absorbent boom containing from outside in */}
    <path d="M258 396 q172 -46 344 0" stroke="#fbbf24" strokeWidth="11" fill="none" strokeLinecap="round" />
    {/* toppled drum */}
    <g transform="translate(596 356) rotate(-16)">
      <rect x="-46" y="-26" width="92" height="52" rx="9" fill="#475569" stroke="#64748b" strokeWidth="3" />
      <path d="M-46 -10 h92 M-46 8 h92" stroke="#64748b" strokeWidth="3" />
      <path d="M-6 -40 l12 0 l-6 12 z" fill="#f59e0b" />
    </g>
    {/* responder in full chemical PPE */}
    <g transform="translate(250 264)">
      <path d="M-9 34 L-8 62 M9 34 L8 62" stroke="#f8fafc" strokeWidth="10" strokeLinecap="round" />
      <path d="M-14 64 h12 M2 64 h12" stroke="#0f172a" strokeWidth="8" strokeLinecap="round" />
      <path d="M-15 -2 h30 l4 38 h-38 z" fill="#f1f5f9" />
      <path d="M-15 2 L-27 26 M15 2 L27 22" stroke="#e2e8f0" strokeWidth="9" strokeLinecap="round" />
      <circle cx="-28" cy="28" r="5" fill="#0ea5e9" />
      <circle cx="28" cy="24" r="5" fill="#0ea5e9" />
      {/* full-face respirator hood */}
      <circle cx="0" cy="-16" r="15" fill="#e2e8f0" />
      <path d="M-10 -18 a10 9 0 0 1 20 0 v6 a10 9 0 0 1 -20 0 z" fill="#0ea5e9" opacity=".85" />
      <circle cx="13" cy="-12" r="5" fill="#94a3b8" />
    </g>
    {/* spill kit */}
    <g transform="translate(118 356)">
      <rect x="-34" y="-40" width="68" height="46" rx="6" fill="#facc15" stroke="#a16207" strokeWidth="3" />
      <path d="M-18 -22 h36 M-18 -12 h36" stroke="#a16207" strokeWidth="3" />
      <text y="24" textAnchor="middle" fill="#fde68a" fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif">
        SPILL KIT
      </text>
    </g>
    {/* hazard sign */}
    <g transform="translate(700 168)">
      <path d="M0 -40 L40 30 H-40 Z" fill="#0b1220" stroke="#fbbf24" strokeWidth="4" />
      <path d="M0 -14 V10 M0 18 v3" stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" />
    </g>
  </>
);

const ElectricalScene = ({ id }) => (
  <>
    <rect width="800" height="450" fill={`url(#${id}-sky)`} />
    <rect y="360" width="800" height="90" fill={`url(#${id}-ground)`} />
    {/* switchboard */}
    <rect x="420" y="80" width="270" height="280" rx="10" fill="#1e293b" stroke="#475569" strokeWidth="4" />
    <path d="M555 80 V360" stroke="#475569" strokeWidth="3" />
    {Array.from({ length: 5 }).map((_, index) => (
      <g key={index}>
        <rect x="442" y={112 + index * 48} width="90" height="30" rx="4" fill="#334155" />
        <rect x="578" y={112 + index * 48} width="90" height="30" rx="4" fill="#334155" />
      </g>
    ))}
    {/* arc-flash label */}
    <rect x="436" y="88" width="112" height="20" rx="4" fill="#7f1d1d" />
    <text x="492" y="103" textAnchor="middle" fill="#fecaca" fontSize="11" fontWeight="700" fontFamily="Inter, sans-serif">
      ARC FLASH PPE 2
    </text>
    {/* isolator locked off, multi-hasp + tag */}
    <g transform="translate(348 210)">
      <rect x="-30" y="-46" width="60" height="92" rx="8" fill="#334155" stroke="#64748b" strokeWidth="3" />
      <path d="M0 -20 V16" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" />
      <circle cx="0" cy="-30" r="6" fill="#ef4444" />
      {/* padlock */}
      <rect x="-13" y="30" width="26" height="22" rx="4" fill="#facc15" />
      <path d="M-7 30 v-8 a7 7 0 0 1 14 0 v8" stroke="#facc15" strokeWidth="4" fill="none" />
      {/* danger tag */}
      <rect x="20" y="26" width="52" height="34" rx="4" fill="#dc2626" transform="rotate(8 20 26)" />
      <text x="46" y="48" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="800" fontFamily="Inter, sans-serif" transform="rotate(8 20 26)">
        DANGER
      </text>
      <text x="0" y="-58" textAnchor="middle" fill="#fcd34d" fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif">
        LOCKED OUT
      </text>
    </g>
    {/* technician proving dead with a tester */}
    <g transform="translate(150 250)">
      <Worker x={0} y={0} scale={0.95} vest="#f97316" />
      <path d="M24 22 L86 6" stroke="#f8fafc" strokeWidth="3" />
      <rect x="86" y="-6" width="20" height="14" rx="3" fill="#22c55e" />
    </g>
    <text x="150" y="392" textAnchor="middle" fill="#86efac" fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif">
      TEST FOR DEAD BEFORE WORK
    </text>
  </>
);

const RoadScene = ({ id }) => (
  <>
    <rect width="800" height="450" fill={`url(#${id}-sky)`} />
    {/* carriageway */}
    <path d="M0 450 L250 190 H560 L800 450 Z" fill="#161d2b" />
    <path d="M300 190 L196 450" stroke="#e2e8f0" strokeWidth="5" strokeDasharray="30 26" opacity=".7" />
    <path d="M470 190 L640 450" stroke="#e2e8f0" strokeWidth="5" strokeDasharray="30 26" opacity=".7" />
    <path d="M250 190 L0 450 M560 190 L800 450" stroke="#facc15" strokeWidth="4" opacity=".8" />
    {/* lit taper of cones closing the left lane */}
    {[
      [268, 232, 0.4],
      [258, 268, 0.5],
      [244, 306, 0.6],
      [226, 348, 0.72],
      [204, 396, 0.85]
    ].map(([cx, cy, scale]) => (
      <Cone key={`${cx}-${cy}`} x={cx} y={cy} scale={scale} />
    ))}
    {/* advance warning board */}
    <g transform="translate(96 214)">
      <rect x="-42" y="-42" width="84" height="84" rx="8" fill="#0b1220" stroke="#f59e0b" strokeWidth="5" transform="rotate(45)" />
      <path d="M0 -16 V8 M0 16 v3" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
      <path d="M0 46 V116" stroke="#475569" strokeWidth="7" />
    </g>
    {/* protected crew inside the closure */}
    <Worker x={196} y={318} scale={0.62} vest="#f97316" />
    <Worker x={236} y={330} scale={0.66} vest="#f97316" />
    {/* shielding works vehicle with beacons */}
    <g transform="translate(600 320)">
      <rect x="-70" y="-34" width="140" height="46" rx="8" fill="#334155" />
      <rect x="-46" y="-58" width="60" height="26" rx="6" fill="#475569" />
      <circle cx="-44" cy="18" r="13" fill="#0f172a" />
      <circle cx="42" cy="18" r="13" fill="#0f172a" />
      <circle cx="16" cy="-66" r="8" fill="#f59e0b" />
      <circle cx="16" cy="-66" r="18" fill={`url(#${id}-glow)`} />
      <path d="M-70 -12 h140" stroke="#f8fafc" strokeWidth="4" opacity=".8" />
    </g>
    {/* toll gantry */}
    <path d="M250 190 H560" stroke="#475569" strokeWidth="10" />
    <path d="M250 190 V120 M560 190 V120" stroke="#475569" strokeWidth="8" />
    <rect x="330" y="128" width="70" height="26" rx="4" fill="#052e16" stroke="#22c55e" strokeWidth="2" />
    <text x="365" y="147" textAnchor="middle" fill="#4ade80" fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif">
      OPEN
    </text>
    <rect x="420" y="128" width="70" height="26" rx="4" fill="#450a0a" stroke="#ef4444" strokeWidth="2" />
    <text x="455" y="147" textAnchor="middle" fill="#fca5a5" fontSize="16" fontWeight="800" fontFamily="Inter, sans-serif">
      ✕
    </text>
  </>
);

const PpeScene = ({ id }) => {
  const items = [
    ["Helmet", 130, 150],
    ["Glasses", 300, 150],
    ["Ear Protection", 470, 150],
    ["Respirator", 640, 150],
    ["Gloves", 130, 320],
    ["Hi-Vis Vest", 300, 320],
    ["Harness", 470, 320],
    ["Safety Shoes", 640, 320]
  ];
  return (
    <>
      <rect width="800" height="450" fill={`url(#${id}-sky)`} />
      <circle cx="400" cy="225" r="280" fill={`url(#${id}-glow)`} />
      {items.map(([label, cx, cy], index) => (
        <g key={label} transform={`translate(${cx} ${cy})`}>
          <rect x="-72" y="-58" width="144" height="112" rx="14" fill="#131c2c" stroke="#334155" strokeWidth="2.5" />
          <circle cx="0" cy="-14" r="30" fill={`url(#${id}-accent)`} opacity=".22" />
          {index === 0 ? (
            <>
              <path d="M-22 -6 a22 20 0 0 1 44 0 z" fill="#facc15" />
              <path d="M-26 -6 h52" stroke="#eab308" strokeWidth="5" strokeLinecap="round" />
            </>
          ) : index === 1 ? (
            <>
              <path d="M-26 -14 h52 v12 a10 10 0 0 1 -20 0 a10 10 0 0 1 -12 0 a10 10 0 0 1 -20 0 z" fill="#0ea5e9" opacity=".9" />
            </>
          ) : index === 2 ? (
            <>
              <path d="M-22 -26 v24 a10 10 0 0 0 20 0 v-24" stroke="#94a3b8" strokeWidth="5" fill="none" />
              <rect x="-30" y="-30" width="16" height="30" rx="7" fill="#f97316" />
              <rect x="14" y="-30" width="16" height="30" rx="7" fill="#f97316" />
            </>
          ) : index === 3 ? (
            <>
              <path d="M-20 -20 h40 v16 a20 18 0 0 1 -40 0 z" fill="#e2e8f0" />
              <circle cx="-24" cy="-10" r="8" fill="#64748b" />
              <circle cx="24" cy="-10" r="8" fill="#64748b" />
            </>
          ) : index === 4 ? (
            <>
              <path d="M-16 4 v-22 a5 5 0 0 1 10 0 v10 v-16 a5 5 0 0 1 10 0 v16 v-12 a5 5 0 0 1 10 0 v24 a14 14 0 0 1 -30 6 z" fill="#38bdf8" />
            </>
          ) : index === 5 ? (
            <>
              <path d="M-24 -26 h48 l4 44 h-56 z" fill="#f59e0b" />
              <path d="M-20 -12 h40 M-20 0 h40" stroke="#f8fafc" strokeWidth="4" />
            </>
          ) : index === 6 ? (
            <g stroke="#22c55e" strokeWidth="5" fill="none">
              <path d="M-16 -26 L0 -6 L16 -26" />
              <path d="M-22 -6 h44" />
              <path d="M0 -6 V14" />
            </g>
          ) : (
            <>
              <path d="M-28 6 v-16 a8 8 0 0 1 16 0 l4 8 h20 a8 8 0 0 1 8 8 z" fill="#334155" />
              <path d="M-28 6 h56" stroke="#eab308" strokeWidth="5" />
            </>
          )}
          <text y="40" textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="600" fontFamily="Inter, sans-serif">
            {label}
          </text>
        </g>
      ))}
    </>
  );
};

const SCENES = {
  constructionSite: { Scene: ConstructionScene, accent: "#f59e0b", label: "Construction site safety" },
  workingAtHeight: { Scene: HeightScene, accent: "#22c55e", label: "Working at height" },
  fireEvacuation: { Scene: FireScene, accent: "#ef4444", label: "Fire evacuation" },
  manufacturing: { Scene: ManufacturingScene, accent: "#a78bfa", label: "Manufacturing safety" },
  chemicalSpill: { Scene: ChemicalScene, accent: "#34d399", label: "Chemical spill response" },
  electrical: { Scene: ElectricalScene, accent: "#facc15", label: "Electrical isolation" },
  roadSafety: { Scene: RoadScene, accent: "#38bdf8", label: "Road and highway safety" },
  ppe: { Scene: PpeScene, accent: "#60a5fa", label: "Personal protective equipment" }
};

export const VISUAL_KEYS = Object.keys(SCENES);

/**
 * Renders the named scene. `className` controls size — the SVG scales to its
 * container and preserves aspect ratio, so the same component is used for a
 * 320px card thumbnail and a full-width detail hero.
 */
const HseTrainingVisual = ({ name = "constructionSite", className = "", title }) => {
  const entry = SCENES[name] || SCENES.constructionSite;
  const { Scene, accent, label } = entry;
  // Gradient ids must be unique per scene name so two visuals on the same page
  // don't resolve each other's <defs>.
  const id = `hse-visual-${name}`;

  return (
    <svg
      viewBox="0 0 800 450"
      className={className}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={title || label}
    >
      <title>{title || label}</title>
      <Defs id={id} accent={accent} />
      <Scene id={id} />
    </svg>
  );
};

export default HseTrainingVisual;
