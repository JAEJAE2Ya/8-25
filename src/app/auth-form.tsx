"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackendError, backendFetch } from "@/lib/backend-api";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const signup = mode === "signup";
  const [form, setForm] = useState({ email: "", nickname: "", password: "", confirmation: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (signup && form.password !== form.confirmation) return setError("비밀번호가 서로 달라요.");
    setLoading(true);
    setError("");
    try {
      await backendFetch(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(signup ? { email: form.email, nickname: form.nickname, password: form.password } : { email: form.email, password: form.password }),
      });
      router.replace("/");
      router.refresh();
    } catch (caught) {
      const code = caught instanceof BackendError ? caught.code : "backend_unavailable";
      setError(code === "invalid_email_or_password" ? "이메일 또는 비밀번호를 확인해 주세요." : code === "email_or_nickname_already_exists" || code === "already_exists" ? "이미 사용 중인 이메일 또는 닉네임이에요." : code === "invalid_request" ? "입력값을 다시 확인해 주세요." : "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  const update = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="auth-logo">m</span>
        <span className="section-kicker">MEALFIT</span>
        <h1>{signup ? "내 식단 시작하기" : "다시 만나서 반가워요"}</h1>
        <p>먹은 것과 먹을 예정인 식단을 안전하게 저장해요.</p>
        <form onSubmit={submit}>
          <label>이메일<input type="email" autoComplete="email" required value={form.email} onChange={(event) => update("email")(event.target.value)} /></label>
          {signup && <label>닉네임<input type="text" autoComplete="nickname" minLength={2} maxLength={30} required value={form.nickname} onChange={(event) => update("nickname")(event.target.value)} /></label>}
          <label>비밀번호<input type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={8} required value={form.password} onChange={(event) => update("password")(event.target.value)} /></label>
          {signup && <label>비밀번호 확인<input type="password" autoComplete="new-password" minLength={8} required value={form.confirmation} onChange={(event) => update("confirmation")(event.target.value)} /></label>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="primary-cta" disabled={loading}>{loading ? "처리 중…" : signup ? "회원가입" : "로그인"}</button>
        </form>
        <div className="auth-switch">{signup ? "이미 계정이 있나요?" : "Mealfit이 처음인가요?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "로그인" : "회원가입"}</Link></div>
      </section>
    </main>
  );
}
