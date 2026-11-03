"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { videoToDataUrl } from "@/lib/client/image";

/**
 * 컴퓨터(노트북·태블릿 웹캠)용 카메라 창
 * - 휴대폰은 <input capture> 로 기본 카메라 앱을 여는 편이 초점·확대가 좋아서 그쪽을 쓴다
 * - https 주소(또는 localhost)에서만 브라우저가 카메라를 허락한다
 * - 찍은 장면은 긴 변 1024px JPEG 로 줄여 넘기고, 창을 닫으면 카메라를 바로 끈다
 */
export default function CameraCapture({ onCapture, onClose }: { onCapture: (dataUrl: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [canSwitch, setCanSwitch] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setErr(null);
    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setErr("이 주소에서는 카메라를 쓸 수 없어요. https 주소로 열거나 '사진 파일 고르기'를 써 주세요.");
        return;
      }
      try {
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelled) setCanSwitch(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        setErr(
          name === "NotAllowedError"
            ? "카메라 사용이 막혀 있어요. 주소창 옆 자물쇠(또는 카메라) 아이콘에서 카메라를 '허용'으로 바꿔 주세요."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "이 컴퓨터에서 카메라를 찾지 못했어요. '사진 파일 고르기'를 써 주세요."
              : name === "NotReadableError"
                ? "다른 프로그램(화상 수업 등)이 카메라를 쓰고 있어요. 그 프로그램을 닫고 다시 시도해 주세요."
                : "카메라를 켜지 못했어요. '사진 파일 고르기'를 써 주세요.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing, stop]);

  // Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function shoot() {
    const v = videoRef.current;
    if (!v) return;
    try {
      const url = videoToDataUrl(v, 1024);
      stop();
      onCapture(url);
    } catch {
      setErr("사진을 만들지 못했어요. 다시 눌러 보세요.");
    }
  }

  return (
    <div className="cam-overlay" role="dialog" aria-modal="true" aria-label="카메라로 찍기">
      <div className="cam-box">
        <div className="cam-view">
          <video ref={videoRef} playsInline muted onLoadedData={() => setReady(true)} className={facing === "user" ? "mirror" : ""} />
          {!ready && !err && <div className="cam-msg">카메라를 켜는 중…</div>}
          {err && <div className="cam-msg err">{err}</div>}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={!ready} onClick={shoot}>📸 찍기</button>
          {canSwitch && (
            <button className="btn" style={{ flex: 1 }} onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}>🔄 카메라 바꾸기</button>
          )}
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>닫기</button>
        </div>
        <p className="muted small" style={{ margin: "8px 0 0" }}>잎과 식물 전체가 화면에 잘 보이게 맞춘 뒤 찍어요.</p>
      </div>
    </div>
  );
}
