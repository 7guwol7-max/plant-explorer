/**
 * 🎯 해 볼 활동 진행 막대 — '해 볼 활동 3개 [■■□] ✅ 1개 적었어요'
 * total: 해 볼 활동 수, done: 답을 적은 활동 수 (연수 미션 4)
 */
export default function MissionProgress({ total, done }: { total: number; done: number }) {
  const all = total > 0 && done >= total;
  const percent = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div className={`mission-progress ${all ? "all" : ""}`} aria-live="polite">
      <span>🎯 해 볼 활동 <strong>{total}</strong>개</span>
      <span className="mission-meter" aria-hidden>
        <span style={{ width: `${percent}%` }} />
      </span>
      <span>{all ? "🎉 모두 적었어요" : `✅ ${done}개 적었어요`}</span>
    </div>
  );
}
