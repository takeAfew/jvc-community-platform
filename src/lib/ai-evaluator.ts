export interface VCEvaluationResult {
  is_eligible_vc: boolean;
  firm_name: string;
  firm_category: "venture_capital" | "venture_studio" | "accelerator" | "family_office" | "venture_debt" | "non_vc";
  seniority_level: "analyst" | "associate" | "principal" | "partner" | "platform_ops" | "other";
  confidence: number;
  reasoning: string;
  rejection_reason_message: string | null;
}

export async function evaluateVCEligibility(profile: {
  full_name: string;
  role_title?: string | null;
  current_firm?: string | null;
  summary?: string | null;
  current_positions?: any[];
  past_positions?: any[];
}): Promise<VCEvaluationResult> {
  const apiKey = process.env.GEMINI_API_KEY || "";

  const systemInstruction = `
You are the Chief Admissions Officer for JVC (Junior VC Community Europe), an exclusive European community for junior professionals working in the venture capital ecosystem.
One fundamental rule: members MUST be actively and currently working in the VC ecosystem.

Eligible entities:
- Venture Capital funds (Seed, Early-stage, Series A/B+, Growth tech)
- Corporate Venture Capital (CVC) arms
- Venture Studios & Startup Studios
- Accelerators & Incubators (e.g. Y Combinator, Techstars, Antler, Station F, Hexa, Entrepreneur First)
- Family Offices with active direct venture capital / startup investment programs
- Venture Debt funds

Eligible roles (especially junior/mid career):
- Analyst, Associate, Senior Associate, Investment Manager, Principal
- Platform, Head of Community, Talent, Operations INSIDE a VC fund
- Venture Partner or Scouting roles inside a fund

Disqualified:
- Traditional M&A / Corporate Finance / Advisory consultants (e.g. Big 4, Bain, McKinsey without direct VC role)
- Traditional Private Equity buyout (non-tech/mature buyouts)
- Startup Founders / Operators (unless running an accelerator/venture studio)
- Service providers, agency recruiters, lawyers, outsourced accountants
- Ex-VC professionals who have already transitioned to another industry/startup

Analyze the candidate's current role, company, and career summary. Output ONLY a valid JSON object matching this schema:
{
  "is_eligible_vc": boolean,
  "firm_name": "name of current VC firm",
  "firm_category": "venture_capital" | "venture_studio" | "accelerator" | "family_office" | "venture_debt" | "non_vc",
  "seniority_level": "analyst" | "associate" | "principal" | "partner" | "platform_ops" | "other",
  "confidence": number between 0.0 and 1.0,
  "reasoning": "Clear concise explanation of why the candidate qualifies or does not qualify",
  "rejection_reason_message": "Polite explanation of why they do not meet the criteria (or null if approved)"
}
`;

  const userPrompt = `
Candidate Name: ${profile.full_name}
Declared Role: ${profile.role_title || "Not specified"}
Declared Firm: ${profile.current_firm || "Not specified"}
LinkedIn Summary: ${profile.summary || "None"}
Scraped Current Positions: ${JSON.stringify(profile.current_positions || [])}
Scraped Past Positions: ${JSON.stringify(profile.past_positions || [])}
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", errText);
      // Fallback heuristic if API error
      return fallbackHeuristic(profile);
    }

    const json = await response.json();
    const rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) {
      return fallbackHeuristic(profile);
    }

    return JSON.parse(rawContent) as VCEvaluationResult;
  } catch (error) {
    console.error("Evaluation exception:", error);
    return fallbackHeuristic(profile);
  }
}

function fallbackHeuristic(profile: {
  full_name: string;
  role_title?: string | null;
  current_firm?: string | null;
}): VCEvaluationResult {
  const role = (profile.role_title || "").toLowerCase();
  const firm = (profile.current_firm || "").toLowerCase();

  const vcKeywords = ["venture", "vc", "accelerator", "capital", "early stage", "seed", "fund", "investor"];
  const isVC = vcKeywords.some((kw) => role.includes(kw) || firm.includes(kw));

  return {
    is_eligible_vc: isVC,
    firm_name: profile.current_firm || "Unknown Firm",
    firm_category: isVC ? "venture_capital" : "non_vc",
    seniority_level: role.includes("analyst")
      ? "analyst"
      : role.includes("associate")
      ? "associate"
      : role.includes("principal")
      ? "principal"
      : "other",
    confidence: isVC ? 0.75 : 0.6,
    reasoning: isVC
      ? "Identified VC-related keywords in role or firm name via heuristic fallback."
      : "No VC-related keywords found in role or firm name.",
    rejection_reason_message: isVC
      ? null
      : "We could not confirm an active role in a venture capital firm, accelerator, or venture studio.",
  };
}
