"use client";

import { useState } from "react";
import { JVCLogo } from "@/components/JVCLogo";
import { Lock, User, Eye, EyeOff, ArrowRight, Loader2, ShieldCheck, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both Username and Password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        window.location.href = "/";
      } else {
        setError(data.error || "Invalid credentials. Please try again.");
      }
    } catch (err: any) {
      setError("Connection error. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background px-4 py-8 sm:py-12">
      {/* Background soft ambient accents */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="w-[600px] h-[350px] bg-neutral-200/40 rounded-full blur-3xl -top-20 opacity-70" />
      </div>

      {/* Header minimal */}
      <header className="relative max-w-5xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <JVCLogo size={80} />
          <span className="text-xs font-semibold tracking-wider text-neutral-400 uppercase">
            Europe
          </span>
        </div>
        <a
          href="https://jvc-community.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          jvc-community.com &rarr;
        </a>
      </header>

      {/* Main card */}
      <main className="relative z-10 max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-neutral-200/80 shadow-xl shadow-neutral-900/5 p-8 sm:p-10">
          {/* Logo & Headline */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-900 border border-neutral-200/80 mb-4 shadow-2xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Control Room Access
            </h1>
            <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
              Junior VC Community Europe &bull; Administrative Hub Operations
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white/60 text-neutral-900 placeholder:text-neutral-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-neutral-200 bg-white/60 text-neutral-900 placeholder:text-neutral-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] text-white font-medium text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-neutral-950/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Control Room</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security badge note */}
        <div className="text-center mt-6 text-[11px] text-neutral-400 flex items-center justify-center gap-1.5">
          <Lock className="w-3 h-3" />
          <span>Restricted Access &bull; Authorized Personnel Only</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative max-w-5xl mx-auto w-full text-center text-[11px] text-neutral-400 py-2 z-10">
        Junior VC Community Europe &copy; {new Date().getFullYear()} &bull; All rights reserved
      </footer>
    </div>
  );
}
