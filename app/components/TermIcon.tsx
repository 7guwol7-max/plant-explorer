/**
 * 관찰 낱말 그림 (잎 모양·잎맥·줄기). 실제 그림 파일 없이 SVG로 그린다.
 * 같은 이름(lib/terms.ts 의 키)으로 부른다.
 */
const LEAF = "#7cc48f";
const LEAF_DARK = "#2f7d4a";
const BARK = "#8a5a2b";

function Leaf({ d, veins }: { d: string; veins?: React.ReactNode }) {
  return (
    <>
      <path d={d} fill={LEAF} stroke={LEAF_DARK} strokeWidth={2} strokeLinejoin="round" />
      {veins}
    </>
  );
}

const V = { stroke: LEAF_DARK, strokeWidth: 1.6, fill: "none", strokeLinecap: "round" as const };
const BROAD = "M32 6 C50 14 54 36 32 56 C10 36 14 14 32 6Z";
const FAN = "M32 58 L8 24 Q18 8 29 10 L32 19 L35 10 Q46 8 56 24 Z";

const ICONS: Record<string, React.ReactNode> = {
  "넓적한 잎": (
    <Leaf d={BROAD} veins={<g {...V}><path d="M32 8 L32 58" /><path d="M32 22 L22 16 M32 22 L42 16 M32 32 L19 25 M32 32 L45 25 M32 42 L21 36 M32 42 L43 36" /></g>} />
  ),
  "길쭉한 잎": <Leaf d="M32 3 C41 18 41 44 32 61 C23 44 23 18 32 3Z" veins={<path d="M32 6 L32 60" {...V} />} />,
  "바늘 잎": (
    <g strokeLinecap="round">
      <path d="M30 58 L14 6 M34 58 L50 6 M32 58 L32 4" stroke={LEAF_DARK} strokeWidth={3} />
      <rect x="27" y="52" width="10" height="8" rx="2" fill={BARK} />
    </g>
  ),
  "부채 모양": <Leaf d={FAN} veins={<g {...V}><path d="M32 56 L14 24 M32 56 L22 16 M32 56 L32 20 M32 56 L42 16 M32 56 L50 24" /></g>} />,
  "손바닥 모양": (
    <>
      <path d="M32 46 L14 52 L18 42 L4 36 L16 30 L10 16 L23 21 L25 6 L32 16 L39 6 L41 21 L54 16 L48 30 L60 36 L46 42 L50 52 Z" fill={LEAF} stroke={LEAF_DARK} strokeWidth={2} strokeLinejoin="round" />
      <g {...V}><path d="M32 46 L32 18 M32 46 L12 22 M32 46 L52 22 M32 46 L10 36 M32 46 L54 36" /><path d="M32 46 L32 62" strokeWidth={2.5} /></g>
    </>
  ),
  "깃털처럼 갈라짐": (
    <>
      <path d="M32 4 L32 62" stroke={LEAF_DARK} strokeWidth={2.5} strokeLinecap="round" />
      {[12, 22, 32, 42].map((y) => (
        <g key={y} fill={LEAF} stroke={LEAF_DARK} strokeWidth={1.5}>
          <ellipse cx={22} cy={y + 2} rx={9} ry={4.5} transform={`rotate(-20 22 ${y + 2})`} />
          <ellipse cx={42} cy={y + 2} rx={9} ry={4.5} transform={`rotate(20 42 ${y + 2})`} />
        </g>
      ))}
      <ellipse cx={32} cy={6} rx={4.5} ry={8} fill={LEAF} stroke={LEAF_DARK} strokeWidth={1.5} />
    </>
  ),
  그물맥: (
    <Leaf
      d={BROAD}
      veins={
        <g {...V}>
          <path d="M32 8 L32 56" />
          <path d="M32 20 L20 14 M32 20 L44 14 M32 30 L17 24 M32 30 L47 24 M32 40 L19 36 M32 40 L45 36" />
          <path d="M24 16 L22 26 L26 34 L22 40 M40 16 L42 26 L38 34 L42 40 M20 26 L27 25 M44 26 L37 25" strokeWidth={1.1} />
        </g>
      }
    />
  ),
  나란히맥: (
    <Leaf
      d="M32 3 C44 18 44 44 32 61 C20 44 20 18 32 3Z"
      veins={<g {...V}><path d="M32 6 L32 60" /><path d="M32 8 Q26 32 30 58 M32 8 Q38 32 34 58 M31 10 Q22 32 27 54 M33 10 Q42 32 37 54" strokeWidth={1.1} /></g>}
    />
  ),
  부챗살맥: (
    <Leaf
      d={FAN}
      veins={<g {...V} strokeWidth={1.1}><path d="M32 56 L10 26 M32 56 L15 19 M32 56 L22 13 M32 56 L28 12 M32 56 L36 12 M32 56 L42 13 M32 56 L49 19 M32 56 L54 26" /></g>}
    />
  ),
  "굵은 나무줄기": (
    <>
      <circle cx={32} cy={14} r={12} fill={LEAF} stroke={LEAF_DARK} strokeWidth={2} />
      <path d="M24 60 L26 22 L38 22 L40 60 Z" fill={BARK} stroke="#5d3b1a" strokeWidth={2} strokeLinejoin="round" />
      <path d="M29 28 L28 40 M35 30 L36 44 M31 46 L30 56 M35 50 L36 58" stroke="#5d3b1a" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M24 60 L16 62 M40 60 L48 62" stroke="#5d3b1a" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  "가는 풀줄기": (
    <>
      <path d="M32 62 Q30 36 33 6" stroke="#4f9a5e" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M31 44 Q20 38 16 30 Q26 32 31 40 Z M32 30 Q44 24 48 16 Q38 18 32 26 Z M33 16 Q26 10 24 4 Q31 8 33 12 Z" fill={LEAF} stroke={LEAF_DARK} strokeWidth={1.4} />
    </>
  ),
  덩굴: (
    <>
      <path d="M32 2 L32 62" stroke="#b9a58a" strokeWidth={5} strokeLinecap="round" />
      <path d="M32 60 C20 56 20 48 32 46 C44 44 44 36 32 34 C20 32 20 24 32 22 C44 20 44 12 32 10" stroke="#3f8f52" strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <path d="M22 50 Q14 46 12 40 Q20 42 22 48 Z M42 38 Q50 34 52 28 Q44 30 42 36 Z M22 26 Q14 22 13 16 Q21 18 22 24 Z" fill={LEAF} stroke={LEAF_DARK} strokeWidth={1.3} />
    </>
  ),
  모름: (
    <>
      <circle cx={32} cy={32} r={26} fill="#eef2ea" stroke="#9aa69a" strokeWidth={2} />
      <text x="32" y="43" textAnchor="middle" fontSize="32" fontWeight="700" fill="#5f6b5f">?</text>
    </>
  ),
};

export default function TermIcon({ name, size = 24 }: { name: string; size?: number }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" className="term-icon">
      {icon}
    </svg>
  );
}
