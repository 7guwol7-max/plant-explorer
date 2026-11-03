import Link from "next/link";

/** 오류 안내. 키 문제면 설정 화면으로 가는 길을 함께 보여 준다. */
export default function ErrorAlert({ message, needsSettings }: { message: string; needsSettings?: boolean }) {
  return (
    <div className="alert err" role="alert">
      {message}
      {needsSettings && (
        <div style={{ marginTop: 8 }}>
          <Link href="/settings" className="btn btn-sm" style={{ background: "#fff" }}>⚙️ 키 설정 확인하기</Link>
        </div>
      )}
    </div>
  );
}
