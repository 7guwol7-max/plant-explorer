/** 사진을 브라우저에서 줄여 base64(JPEG)로 만든다. 긴 변 기준. */
export async function fileToDataUrl(file: File, maxSide = 1024, quality = 0.85): Promise<string> {
  const bitmap = await loadImage(file);
  return drawToDataUrl(bitmap, maxSide, quality);
}

/** 이미 있는 data URL을 더 작게(도감 카드 저장용) */
export async function shrinkDataUrl(dataUrl: string, maxSide = 640, quality = 0.8): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  return drawToDataUrl(img, maxSide, quality);
}

/** 웹캠 화면의 지금 장면을 사진으로 (컴퓨터 카메라용) */
export function videoToDataUrl(video: HTMLVideoElement, maxSide = 1024, quality = 0.85): string {
  return drawToDataUrl(video, maxSide, quality);
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      // 휴대폰 사진의 회전 정보(EXIF)를 반영
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* 지원 안 하면 아래로 */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function drawToDataUrl(img: ImageBitmap | HTMLImageElement | HTMLVideoElement, maxSide: number, quality: number): string {
  const isVideo = typeof HTMLVideoElement !== "undefined" && img instanceof HTMLVideoElement;
  const w = isVideo ? img.videoWidth : img.width;
  const h = isVideo ? img.videoHeight : img.height;
  if (!w || !h) throw new Error("사진 크기를 읽지 못했어요");
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들 수 없어요");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}
