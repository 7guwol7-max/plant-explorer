"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ✏️ 관찰 그림판
 * - 손가락·펜·마우스로 그린다 (pointer events, 화면 스크롤과 겹치지 않게 touch-action: none)
 * - 도구: 펜 색 7가지, 굵기 3가지, 지우개, 글자 넣기, 되돌리기, 모두 지우기
 * - 바탕: 흰 종이 / 모눈 / 내가 찍은 사진 위에(흐리게) — 사진 위에 특징을 표시하며 관찰할 수 있게
 * - 두 겹 캔버스: 바탕(bg) + 그림(draw). 지우개는 그림 겹만 지운다
 * - 저장할 때 두 겹을 합쳐 JPEG(1000×750)로 넘긴다
 */
const W = 1000;
const H = 750;
const COLORS = [
  { c: "#1f2a1f", n: "검정" },
  { c: "#2f7d4a", n: "초록" },
  { c: "#7a4a1f", n: "갈색" },
  { c: "#d83a3a", n: "빨강" },
  { c: "#f2b705", n: "노랑" },
  { c: "#2b6cd8", n: "파랑" },
  { c: "#8e44ad", n: "보라" },
];
const SIZES = [
  { s: 4, n: "가늘게" },
  { s: 10, n: "보통" },
  { s: 22, n: "굵게" },
];
type Tool = "pen" | "eraser" | "text";
type Bg = "white" | "grid" | "photo" | "initial";

export default function DrawingPad({
  photo,
  initial,
  onSave,
  onClose,
}: {
  photo?: string;
  initial?: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const undo = useRef<ImageData[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[0].c);
  const [size, setSize] = useState(SIZES[1].s);
  const [tool, setTool] = useState<Tool>("pen");
  const [bg, setBg] = useState<Bg>(initial ? "initial" : "white");
  const [canUndo, setCanUndo] = useState(false);

  // 바탕 그리기
  useEffect(() => {
    const ctx = bgRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    if (bg === "grid") {
      ctx.strokeStyle = "#dfe8f2";
      ctx.lineWidth = 2;
      for (let x = 50; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 50; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    }
    const src = bg === "photo" ? photo : bg === "initial" ? initial : undefined;
    if (src) {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(W / img.width, H / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.globalAlpha = bg === "photo" ? 0.45 : 1;
        ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        ctx.globalAlpha = 1;
      };
      img.src = src;
    }
  }, [bg, photo, initial]);

  // Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const snapshot = useCallback(() => {
    const ctx = drawRef.current?.getContext("2d");
    if (!ctx) return;
    undo.current.push(ctx.getImageData(0, 0, W, H));
    if (undo.current.length > 20) undo.current.shift();
    setCanUndo(true);
  }, []);

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = drawRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    if (tool === "text") {
      const text = window.prompt("그림에 넣을 글자를 써요 (예: 잎맥, 톱니 모양 가장자리)");
      if (!text?.trim()) return;
      snapshot();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = color;
      ctx.font = `bold ${16 + size * 1.6}px "Pretendard", "Noto Sans KR", sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(text.trim(), p.x, p.y);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    snapshot();
    last.current = p;
    // 점 하나 찍기
    stroke(ctx, p, p, e.pressure);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!last.current) return;
    const ctx = drawRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    stroke(ctx, last.current, p, e.pressure);
    last.current = p;
  }

  function up() {
    last.current = null;
  }

  function stroke(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, pressure: number) {
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    const pr = pressure > 0 && pressure !== 0.5 ? 0.6 + pressure * 0.8 : 1; // 펜 압력이 있으면 반영
    ctx.lineWidth = (tool === "eraser" ? size * 2.5 : size) * pr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x + 0.01, b.y + 0.01);
    ctx.stroke();
  }

  function doUndo() {
    const ctx = drawRef.current?.getContext("2d");
    const prev = undo.current.pop();
    if (ctx && prev) ctx.putImageData(prev, 0, 0);
    setCanUndo(undo.current.length > 0);
  }

  function clearAll() {
    if (!confirm("그린 것을 모두 지울까요?")) return;
    snapshot();
    drawRef.current?.getContext("2d")?.clearRect(0, 0, W, H);
  }

  function save() {
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const ctx = out.getContext("2d");
    if (!ctx || !bgRef.current || !drawRef.current) return;
    ctx.drawImage(bgRef.current, 0, 0);
    ctx.drawImage(drawRef.current, 0, 0);
    onSave(out.toDataURL("image/jpeg", 0.78));
  }

  return (
    <div className="draw-overlay" role="dialog" aria-modal="true" aria-label="관찰 그림 그리기">
      <div className="draw-box">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <strong>✏️ 내가 관찰한 특징을 그려요</strong>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="draw-tools">
          <div className="tool-group" aria-label="도구">
            <button className={`tool ${tool === "pen" ? "on" : ""}`} onClick={() => setTool("pen")}>🖊️ 펜</button>
            <button className={`tool ${tool === "eraser" ? "on" : ""}`} onClick={() => setTool("eraser")}>🧽 지우개</button>
            <button className={`tool ${tool === "text" ? "on" : ""}`} onClick={() => setTool("text")}>🔤 글자</button>
          </div>
          <div className="tool-group" aria-label="색">
            {COLORS.map((c) => (
              <button key={c.c} className={`swatch ${color === c.c ? "on" : ""}`} style={{ background: c.c }} aria-label={c.n} title={c.n} onClick={() => { setColor(c.c); if (tool === "eraser") setTool("pen"); }} />
            ))}
          </div>
          <div className="tool-group" aria-label="굵기">
            {SIZES.map((s) => (
              <button key={s.s} className={`tool ${size === s.s ? "on" : ""}`} onClick={() => setSize(s.s)} title={s.n}>
                <span className="dot-size" style={{ width: 4 + s.s / 2, height: 4 + s.s / 2 }} /> {s.n}
              </button>
            ))}
          </div>
        </div>

        <div className="draw-stage">
          <canvas ref={bgRef} width={W} height={H} className="layer" />
          <canvas
            ref={drawRef}
            width={W}
            height={H}
            className={`layer top ${tool}`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerLeave={up}
          />
        </div>

        <div className="row" style={{ marginTop: 8, justifyContent: "space-between" }}>
          <div className="tool-group" aria-label="바탕">
            <span className="small muted">바탕:</span>
            <button className={`tool ${bg === "white" ? "on" : ""}`} onClick={() => setBg("white")}>흰 종이</button>
            <button className={`tool ${bg === "grid" ? "on" : ""}`} onClick={() => setBg("grid")}>모눈</button>
            {photo && <button className={`tool ${bg === "photo" ? "on" : ""}`} onClick={() => setBg("photo")}>내 사진 위에</button>}
            {initial && <button className={`tool ${bg === "initial" ? "on" : ""}`} onClick={() => setBg("initial")}>그리던 그림</button>}
          </div>
          <div className="tool-group">
            <button className="tool" onClick={doUndo} disabled={!canUndo}>↩️ 되돌리기</button>
            <button className="tool" onClick={clearAll}>🗑️ 모두 지우기</button>
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={save}>💾 그림 저장</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
