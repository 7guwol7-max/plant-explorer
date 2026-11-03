const LABELS = ["1 발견", "2 추정", "3 확인", "4 기록"];

/** 수업 흐름 그대로인 진행 표시줄 */
export default function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <div className="steps" aria-label="진행 단계">
      {LABELS.map((l, i) => {
        const n = i + 1;
        const cls = n < current ? "step done" : n === current ? "step now" : "step";
        return (
          <div key={l} className={cls}>
            <div className="bar" />
            {l}
          </div>
        );
      })}
    </div>
  );
}
