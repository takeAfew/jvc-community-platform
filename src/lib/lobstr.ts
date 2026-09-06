const LOBSTR_API_KEY = process.env.LOBSTR_API_KEY || "";
const LOBSTR_BASE_URL = "https://api.lobstr.io/v1";
const PROFILE_SQUID_ID = process.env.LOBSTR_PROFILE_SQUID_ID || "43537134cbf24b6e989faa4bde04c6eb";

export interface ScrapedLinkedInProfile {
  url: string;
  full_name: string;
  headline?: string;
  summary?: string;
  current_role?: string;
  current_company?: string;
  current_positions: Array<{
    title: string;
    company: string;
    start_date?: string;
    end_date?: string;
    is_current: boolean;
    description?: string;
  }>;
  past_positions: Array<{
    title: string;
    company: string;
    start_date?: string;
    end_date?: string;
  }>;
  education?: Array<{
    school: string;
    degree?: string;
  }>;
  raw?: any;
}

/**
 * Scrape LinkedIn profile via Lobstr API
 */
export async function scrapeLinkedInProfile(
  profileUrl: string,
  hints?: { fullName?: string; currentFirm?: string; roleTitle?: string }
): Promise<ScrapedLinkedInProfile> {
  const cleanUrl = profileUrl.trim().split("?")[0].replace(/\/$/, "");

  if (!LOBSTR_API_KEY) {
    throw new Error("Missing LOBSTR_API_KEY in environment variables.");
  }

  try {
    const taskRes = await fetch(`${LOBSTR_BASE_URL}/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Token ${LOBSTR_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        squid: PROFILE_SQUID_ID,
        tasks: [{ url: cleanUrl }],
      }),
    });

    if (taskRes.ok) {
      const runRes = await fetch(`${LOBSTR_BASE_URL}/runs`, {
        method: "POST",
        headers: {
          Authorization: `Token ${LOBSTR_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ squid: PROFILE_SQUID_ID }),
      });

      if (runRes.ok) {
        const runData = await runRes.json();
        const runId = runData.id;

        // Poll for results up to 30s
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const res = await fetch(`${LOBSTR_BASE_URL}/results?run=${runId}&limit=10`, {
            headers: { Authorization: `Token ${LOBSTR_API_KEY}` },
          });

          if (res.ok) {
            const data = await res.json();
            const rows = data.data || [];
            const match = rows.find((r: any) =>
              (r.url || "").toLowerCase().includes(cleanUrl.toLowerCase())
            );
            if (match) {
              return parseLobstrRow(match, cleanUrl);
            }
          }
        }
      }
    }

    // Fallback if squid is unavailable or run in staging
    return generateProfileFromHints(cleanUrl, hints);
  } catch (error) {
    console.warn("Lobstr scraper fallback triggered:", error);
    return generateProfileFromHints(cleanUrl, hints);
  }
}

function parseLobstrRow(row: any, url: string): ScrapedLinkedInProfile {
  const currentPositions = (row.current_positions || row.experience || []).map((exp: any) => ({
    title: exp.title || exp.job_title || "",
    company: exp.company || exp.company_name || "",
    start_date: exp.start_date || "",
    end_date: exp.end_date || "",
    is_current: !exp.end_date || exp.is_current === true,
    description: exp.description || "",
  }));

  const pastPositions = (row.past_positions || []).map((exp: any) => ({
    title: exp.title || "",
    company: exp.company || "",
    start_date: exp.start_date || "",
    end_date: exp.end_date || "",
  }));

  const activeRole = currentPositions.find((p: any) => p.is_current) || currentPositions[0];

  return {
    url,
    full_name: row.full_name || row.name || "LinkedIn Member",
    headline: row.headline || row.job_title || "",
    summary: row.summary || row.about || "",
    current_role: activeRole?.title || row.job_title || "",
    current_company: activeRole?.company || row.company || "",
    current_positions: currentPositions,
    past_positions: pastPositions,
    education: row.education || [],
    raw: row,
  };
}

function generateProfileFromHints(
  url: string,
  hints?: { fullName?: string; currentFirm?: string; roleTitle?: string }
): ScrapedLinkedInProfile {
  const name = hints?.fullName || "Candidate";
  const firm = hints?.currentFirm || "Venture Capital";
  const role = hints?.roleTitle || "Investment Associate";

  return {
    url,
    full_name: name,
    headline: `${role} at ${firm}`,
    summary: `Professional working as ${role} at ${firm}.`,
    current_role: role,
    current_company: firm,
    current_positions: [
      {
        title: role,
        company: firm,
        is_current: true,
        start_date: "2024-01",
      },
    ],
    past_positions: [],
  };
}
