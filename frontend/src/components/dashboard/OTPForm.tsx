import { useState } from "react";

interface Props {
  onSuccess: (token: string, email: string) => void;
}

export default function OTPForm({ onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendOTP() {
    if (!email || !email.includes("@")) {
      setError("Enter a valid email");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed to send code");
      setStep("code");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error sending code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) throw new Error("Invalid or expired code");
      const { token } = await res.json();
      onSuccess(token, email);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-8 max-w-md mx-auto">
      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-1">
        My Cases
      </p>
      <h2 className="text-2xl font-bold text-[#191918] mb-6">Sign in with email</h2>

      {step === "email" ? (
        <>
          <p className="text-sm text-[rgba(25,25,24,0.6)] mb-4">
            Enter the email you used when submitting your case.
          </p>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
            placeholder="your@email.com"
            type="email"
            className="w-full border border-[rgba(25,25,24,0.12)] rounded-md px-4 py-3 text-sm mb-4 focus:outline-none focus:border-[#FCAA2D]"
          />
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <button
            onClick={handleSendOTP}
            disabled={loading}
            className="w-full rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide min-h-[44px] disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Login Code"}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-[rgba(25,25,24,0.6)] mb-4">
            We sent a 6-digit code to <strong>{email}</strong>. Enter it below.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
            placeholder="123456"
            maxLength={6}
            className="w-full border border-[rgba(25,25,24,0.12)] rounded-md px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] mb-4 focus:outline-none focus:border-[#FCAA2D]"
          />
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <button
            onClick={handleVerifyOTP}
            disabled={loading || code.length < 6}
            className="w-full rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide min-h-[44px] disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify Code"}
          </button>
          <button
            onClick={() => setStep("email")}
            className="w-full mt-2 text-sm text-[rgba(25,25,24,0.4)] hover:text-[#191918]"
          >
            Use a different email
          </button>
        </>
      )}
    </div>
  );
}
