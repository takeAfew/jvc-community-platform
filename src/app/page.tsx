"use client";

import { useState } from "react";
import { JVCLogo } from "@/components/JVCLogo";
import Link from "next/link";
import { ArrowRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function HomePage() {
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    linkedinUrl: "",
    currentFirm: "",
    roleTitle: "",
    hubCity: "Paris",
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const europeanHubs = [
    "Paris",
    "London",
    "Milan",
    "Berlin",
    "Munich",
    "Madrid",
    "Barcelona",
    "Stockholm",
    "Amsterdam",
    "Zurich",
    "Dublin",
    "Other / Remote Europe",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      setSubmitted(true);
      setSuccessMsg(data.message);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit application.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center px-6 md:px-12 py-16 md:py-24">
      {/* Header & Logo */}
      <header className="flex flex-col items-center text-center mb-12">
        <div className="w-48 h-48 md:w-64 md:h-64 flex items-center justify-center mb-6">
          <JVCLogo size={220} className="hover:opacity-85 transition-opacity" />
        </div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          Junior VC Community • Europe
        </p>
      </header>

      {/* Manifesto Section */}
      <section className="w-full max-w-2xl mx-auto mb-16">
        <div className="space-y-6 text-lg md:text-xl leading-relaxed text-pretty text-foreground/90 font-normal">
          <p>
            You&apos;re early in your VC career, and most of it you figure out on your own.
            We are the people who are figuring it out at the same time.
          </p>

          <p>
            <strong>JVC</strong> is a European community for junior professionals across the venture
            capital ecosystem. Funds, venture studios, accelerators, family offices, venture debt,
            and the roles that keep them running. If you work in it, you&apos;re in.
          </p>

          <p>
            <strong>One Rule:</strong> this is for people currently in the ecosystem. You connect your
            WhatsApp and LinkedIn when you join, and every month we quietly check. If your path takes
            you elsewhere, you step out until you&apos;re back. Quality over quantity. No noise, just
            your peers.
          </p>

          <p>
            <strong>The Idea Is Simple:</strong> these are the people you&apos;ll grow up in this
            industry with. The ones you&apos;ll keep running into over the years, at events, across
            deals, on the other side of the table, until one day you&apos;re both partners. The sooner
            you know each other, the more you&apos;ll build together.
          </p>
        </div>
      </section>

      {/* Application Form */}
      <section className="w-full max-w-xl mx-auto bg-white/70 backdrop-blur-sm border border-foreground/10 rounded-2xl p-8 md:p-10 shadow-sm">
        {submitted ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-foreground/5 rounded-full flex items-center justify-center mx-auto text-foreground">
              <CheckCircle2 className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h3 className="text-2xl font-medium tracking-tight">Application Received</h3>
            <p className="text-muted-foreground leading-relaxed">
              {successMsg ||
                "Your application has been received! Our monthly verification engine will review your profile. You will receive a WhatsApp message once verified."}
            </p>
            <div className="pt-4">
              <button
                onClick={() => setSubmitted(false)}
                className="text-sm text-foreground underline underline-offset-4 hover:opacity-60 transition-opacity"
              >
                Submit another application
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-medium tracking-tight mb-2">Join the Ecosystem</h2>
              <p className="text-sm text-muted-foreground">
                Connect your WhatsApp and LinkedIn. We verify your active role every month.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-foreground/70 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Andrea Pigliapoco"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-foreground/15 bg-background/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-foreground transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-foreground/70 mb-2">
                  WhatsApp Phone Number (with country code)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+39 340 123 4567"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-foreground/15 bg-background/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-foreground transition-all text-sm font-mono"
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Used exclusively to add you to the official European WhatsApp group and send monthly updates.
                </span>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-foreground/70 mb-2">
                  LinkedIn Profile URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://linkedin.com/in/andrea-pigliapoco"
                  value={formData.linkedinUrl}
                  onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-foreground/15 bg-background/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-foreground transition-all text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-foreground/70 mb-2">
                    Current VC Firm / Fund
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Partech, Antler, Hexa"
                    value={formData.currentFirm}
                    onChange={(e) => setFormData({ ...formData, currentFirm: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-foreground/15 bg-background/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-foreground transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-foreground/70 mb-2">
                    Current Role / Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Investment Associate"
                    value={formData.roleTitle}
                    onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-foreground/15 bg-background/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-foreground transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-foreground/70 mb-2">
                  Primary European Hub
                </label>
                <select
                  value={formData.hubCity}
                  onChange={(e) => setFormData({ ...formData, hubCity: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-foreground/15 bg-background/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-foreground transition-all text-sm"
                >
                  {europeanHubs.map((hub) => (
                    <option key={hub} value={hub}>
                      {hub}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-xl bg-foreground text-background font-medium hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting Application...
                    </>
                  ) : (
                    <>
                      Apply for Membership
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="w-full max-w-2xl mx-auto mt-24 pt-8 border-t border-foreground/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
        <p>© 2026 JVC. Hand-crafted in Europe.</p>
        <div className="flex items-center gap-6">
          <a
            href="https://jvc-community.com/hubs"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Hubs
          </a>
          <a
            href="https://www.linkedin.com/company/jvc-community/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            LinkedIn
          </a>
          <Link href="/admin" className="hover:text-foreground transition-colors font-medium">
            Admin Portal
          </Link>
        </div>
      </footer>
    </main>
  );
}
