"use client";
import Link from "next/link";
import { useRole } from "@/lib/client/prefs";

/** 머리글의 선생님 버튼. 선생님 보기로 쓰는 기기면 눈에 띄게 표시한다 */
export default function TeacherLink() {
  const role = useRole();
  return (
    <Link href="/teacher" className={`teacher-link ${role === "teacher" ? "on" : ""}`} title={role === "teacher" ? "선생님 보기로 쓰는 중" : "선생님 모드"}>
      👩‍🏫 {role === "teacher" ? "선생님 보기" : "선생님"}
    </Link>
  );
}
