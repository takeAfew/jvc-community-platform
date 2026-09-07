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
- Venture Capital funds (Seed, Early-stage, Series A/B+, Growth tech - e.g. Partech, Elaia, Daphni, XAnge, Cathay Innovation, Serena, Newfund, IRIS, Inovexus, Shift4Good, Revaia, BPI Large Cap)
- Corporate Venture Capital (CVC) arms
- Venture Studios & Startup Studios (e.g. Hexa, Marble)
- Accelerators & Incubators (e.g. Plug and Play, Station F, Y Combinator, Techstars, Antler, Entrepreneur First)
- Family Offices with active direct venture capital / startup investment programs
- Venture Debt funds

Eligible roles:
- Analyst, Associate, Senior Associate, Investment Manager, Principal, Intern inside a VC fund/accelerator
- Platform, Head of Community, Talent, Operations INSIDE a VC fund
- Venture Partner or Scouting roles inside a fund

Disqualified:
- Traditional M&A / Corporate Finance / Advisory consultants (e.g. Big 4, Bain, McKinsey without direct VC role)
- Traditional Private Equity buyout (non-tech/mature buyouts)
- Startup Founders / Operators (unless running an accelerator/venture studio)
- Service providers, agency recruiters, lawyers, outsourced accountants
- Ex-VC professionals who have already transitioned to another industry/startup

Evaluation Mode:
- Evaluate the candidate based on their declared firm and role.
- If scraped LinkedIn data is provided, use it to further confirm active employment. If scraped data is not provided, evaluate directly on declared firm and role. Do not reject a candidate simply because scraped LinkedIn data is not provided.

Output ONLY a valid JSON object matching this schema:
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

  let userPrompt = `Candidate Name: ${profile.full_name}\nDeclared Role: ${profile.role_title || "Not specified"}\nDeclared Firm: ${profile.current_firm || "Not specified"}`;
  if (profile.summary) {
    userPrompt += `\nLinkedIn Summary: ${profile.summary}`;
  }
  if (profile.current_positions && profile.current_positions.length > 0) {
    userPrompt += `\nScraped Current Positions: ${JSON.stringify(profile.current_positions)}`;
  }
  if (profile.past_positions && profile.past_positions.length > 0) {
    userPrompt += `\nScraped Past Positions: ${JSON.stringify(profile.past_positions)}`;
  }

  const models = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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

        if (response.status === 429 || response.status === 503) {
          // Wait 1.5s before retrying
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`Gemini API error with model ${model}:`, errText);
          break; // Try next model
        }

        const json = await response.json();
        const rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawContent) continue;

        const cleaned = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleaned) as VCEvaluationResult;
      } catch (error) {
        console.warn(`Evaluation error on model ${model}:`, error);
      }
    }
  }

  return fallbackHeuristic(profile);
}

function fallbackHeuristic(profile: {
  full_name: string;
  role_title?: string | null;
  current_firm?: string | null;
}): VCEvaluationResult {
  const role = (profile.role_title || "").toLowerCase();
  const firm = (profile.current_firm || "").toLowerCase();

  const knownVCFirms = [
    "partech", "plug and play", "station f", "cathay", "serena", "elaia", "daphni",
    "xange", "newfund", "inovexus", "shift4good", "bpi", "ternel", "revaia", "sowefund",
    "hexa", "iris", "115k", "welovefounders", "marble", "antler", "techstars", "venture", "capital"
  ];

  const isVC = knownVCFirms.some((f) => firm.includes(f)) ||
    role.includes("venture") || role.includes("vc") || role.includes("investor");

  const isJuniorRole = role.includes("analyst") || role.includes("associate") ||
    role.includes("intern") || role.includes("stage") || role.includes("principal");

  const confidence = isVC && isJuniorRole ? 0.95 : isVC ? 0.85 : 0.6;

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
    confidence,
    reasoning: isVC
      ? `${profile.current_firm || "Firm"} is an established venture capital fund or accelerator, and the ${profile.role_title || "role"} qualifies for junior VC community membership.`
      : `${profile.current_firm || "The declared firm"} could not be verified as an active venture capital fund, accelerator, or venture studio.`,
    rejection_reason_message: isVC
      ? null
      : "We could not confirm an active investment or platform role within an eligible venture capital entity.",
  };
}
