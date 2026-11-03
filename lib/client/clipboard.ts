/**
 * 클립보드의 사진 꺼내기 (패들렛처럼 캡처한 사진을 바로 붙여 넣기)
 * - Ctrl+V / ⌘+V: paste 이벤트에서 꺼낸다 (거의 모든 브라우저)
 * - '붙여넣기' 버튼: navigator.clipboard.read() (크롬·엣지·사파리·안드로이드. 파이어폭스는 Ctrl+V 로 안내)
 */
export const pasteKey = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘+V" : "Ctrl+V";

/** paste 이벤트 안의 사진 파일 (없으면 null) */
export function imageFromPaste(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const it of Array.from(data.items ?? [])) {
    if (it.kind === "file" && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) return f;
    }
  }
  const f = data.files?.[0];
  return f && f.type.startsWith("image/") ? f : null;
}

/** 버튼으로 클립보드 읽기 */
export async function readClipboardImage(): Promise<{ file?: File; message?: string }> {
  const key = pasteKey();
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) {
    return { message: `이 브라우저는 버튼 붙여넣기를 지원하지 않아요. ${key}를 눌러 붙여 넣어 주세요.` };
  }
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (type) {
        const blob = await item.getType(type);
        return { file: new File([blob], `clipboard.${type.split("/")[1] || "png"}`, { type }) };
      }
    }
    return { message: "클립보드에 사진이 없어요. 사진을 복사하거나 화면을 캡처한 뒤 다시 눌러 주세요." };
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    return {
      message:
        name === "NotAllowedError"
          ? `붙여넣기 허용이 막혀 있어요. ${key}로 붙여 넣어 보세요.`
          : `클립보드를 읽지 못했어요. ${key}로 붙여 넣어 보세요.`,
    };
  }
}
