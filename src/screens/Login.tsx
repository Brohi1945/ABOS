import React, { useState } from "react";
import { ArrowLeft, Lock, Mail as MailIcon, User, Phone, ShieldCheck } from "lucide-react";
import { displayFont, bodyFont } from "../theme";
import { Button, Field, inputCls } from "../components/ui";
import { supabase } from "../supabaseClient";

interface LoginScreenProps {
  onBack: () => void;
  onLoginAs: (role: string) => void;
}

// Admin surface ke teen steps: sign in (existing account), register
// (naya account — email/SMS OTP verify hone tak inactive rehta hai),
// verify (6-digit code submit karna).
type AdminStep = "signin" | "register" | "verify";

export default function LoginScreen({ onBack, onLoginAs }: LoginScreenProps) {
  const [role, setRole] = useState("admin");
  const [step, setStep] = useState<AdminStep>("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const resetMessages = () => {
    setErrorMsg("");
    setInfoMsg("");
  };

  // 🔒 SECURITY FIX: admin login ab real Supabase Auth se verify hota hai.
  // Customer role ke liye koi password check nahi (store browsing public
  // hai), is liye woh pehle jaisa hi seedha navigate karta hai.
  const handleSignIn = async () => {
    resetMessages();

    if (role === "customer") {
      onLoginAs("customer");
      return;
    }

    if (!supabase) {
      setErrorMsg("Supabase connect nahi hai — .env variables check karein.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setErrorMsg("Email ya password ghalat hai, ya account abhi verify nahi hua.");
      return;
    }

    onLoginAs("admin");
  };

  // Step 1 — /api/admin-register: Supabase Auth user create hota hai
  // (unconfirmed) aur 6-digit code Email + SMS dono par jata hai.
  const handleRegister = async () => {
    resetMessages();
    if (!name || !email || !phone || !password) {
      setErrorMsg("Naam, email, phone aur password sab zaroori hain.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Password kam se kam 8 characters ka hona chahiye.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setErrorMsg(data?.error || "Registration nahi ho saki.");
        return;
      }

      const channels = [data.emailSent && "email", data.smsSent && "SMS"].filter(Boolean).join(" aur ");
      setInfoMsg(channels ? `Verification code ${channels} par bheja gaya hai.` : "Account ban gaya — verification code check karein.");
      setStep("verify");
    } catch {
      setLoading(false);
      setErrorMsg("Network error — dobara koshish karein.");
    }
  };

  // Step 2 — /api/admin-verify-code: code sahi ho to account confirm
  // hota hai, phir turant seedha sign in kar dete hain (password abhi
  // state mein hai, dobara mangwane ki zaroorat nahi).
  const handleVerify = async () => {
    resetMessages();
    if (code.trim().length !== 6) {
      setErrorMsg("6-digit code daalein.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin-verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLoading(false);
        setErrorMsg(data?.error || "Code verify nahi ho saka.");
        return;
      }

      if (!supabase) {
        setLoading(false);
        setErrorMsg("Supabase connect nahi hai.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);

      if (error) {
        setErrorMsg("Verify ho gaya, lekin sign in nahi ho saka — Sign in tab se try karein.");
        setStep("signin");
        return;
      }

      onLoginAs("admin");
    } catch {
      setLoading(false);
      setErrorMsg("Network error — dobara koshish karein.");
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-app flex items-center justify-center p-5" style={{ fontFamily: bodyFont }}>
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-brand/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative w-full max-w-sm rounded-3xl border shadow-2xl p-2 bg-surface">
        <div className="rounded-[20px] p-7">
          <button
            onClick={() => (role === "admin" && step !== "signin" ? (setStep("signin"), resetMessages()) : onBack())}
            className="flex items-center gap-1 text-xs font-semibold text-muted mb-5 hover:text-fg"
          >
            <ArrowLeft size={13} /> Back
          </button>

          <div className="w-11 h-11 rounded-2xl bg-brand flex items-center justify-center text-white mb-4">
            {step === "verify" ? <ShieldCheck size={18} /> : <Lock size={18} />}
          </div>

          {step === "verify" ? (
            <>
              <h2 className="text-xl font-bold text-fg mb-1" style={{ fontFamily: displayFont }}>Verify your account</h2>
              <p className="text-xs text-muted mb-5">
                {email} aur aapke phone par bheja gaya 6-digit code daalein.
              </p>

              <Field label="Verification code">
                <div className="relative">
                  <ShieldCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    placeholder="123456"
                    className={`${inputCls} pl-9 tracking-[0.4em] text-center font-bold`}
                  />
                </div>
              </Field>

              {infoMsg && <p className="text-xs text-success mb-3">{infoMsg}</p>}
              {errorMsg && <p className="text-xs text-red-500 mb-3">{errorMsg}</p>}

              <Button className="w-full mt-2" size="lg" onClick={handleVerify} disabled={loading}>
                {loading ? "Verify ho raha hai..." : "Verify & sign in"}
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-fg mb-1" style={{ fontFamily: displayFont }}>
                {step === "register" ? "Create admin account" : "Welcome back"}
              </h2>
              <p className="text-xs text-muted mb-5">
                {step === "register" ? "Register karein — verification code email aur SMS par milega." : "Sign in to continue to AB OS."}
              </p>

              <div className="flex gap-1.5 mb-5 bg-app p-1 rounded-xl">
                {[{ key: "admin", label: "Admin" }, { key: "customer", label: "Customer" }].map((r) => (
                  <button
                    key={r.key}
                    onClick={() => { setRole(r.key); setStep("signin"); resetMessages(); }}
                    className={`flex-1 text-xs font-semibold py-2 rounded-lg transition ${
                      role === r.key ? "bg-brand text-white" : "text-muted"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {role === "admin" && (
                <>
                  {step === "register" && (
                    <>
                      <Field label="Full name">
                        <div className="relative">
                          <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={`${inputCls} pl-9`} />
                        </div>
                      </Field>
                      <Field label="Phone number">
                        <div className="relative">
                          <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 3XX XXXXXXX" className={`${inputCls} pl-9`} />
                        </div>
                      </Field>
                    </>
                  )}

                  <Field label="Email address">
                    <div className="relative">
                      <MailIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@business.com" className={`${inputCls} pl-9`} />
                    </div>
                  </Field>

                  <Field label="Password">
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" className={`${inputCls} pl-9`} />
                    </div>
                  </Field>

                  {errorMsg && <p className="text-xs text-red-500 mb-3">{errorMsg}</p>}

                  <Button className="w-full mt-2" size="lg" onClick={step === "register" ? handleRegister : handleSignIn} disabled={loading}>
                    {loading
                      ? "Please wait..."
                      : step === "register"
                      ? "Register & send code"
                      : "Sign in as Admin"}
                  </Button>

                  <button
                    onClick={() => { setStep(step === "register" ? "signin" : "register"); resetMessages(); }}
                    className="w-full text-center text-xs text-muted hover:text-fg mt-3"
                  >
                    {step === "register" ? "Already have an account? Sign in" : "New admin? Create an account"}
                  </button>
                </>
              )}

              {role === "customer" && (
                <Button className="w-full mt-2" size="lg" onClick={handleSignIn} disabled={loading}>
                  Sign in as Customer
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
