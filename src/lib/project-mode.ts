import { supabase } from "./supabase";

export type ProjectMode = "DEV" | "LIVE";

export interface ProjectModeState {
  mode: ProjectMode;
  locked: boolean;
  description: string;
  updated_at: string;
  updated_by?: string;
}

const DEFAULT_DEV_STATE: ProjectModeState = {
  mode: "DEV",
  locked: true,
  description: "DEV mode active. All WhatsApp group additions and removals are strictly blocked.",
  updated_at: new Date().toISOString(),
};

/**
 * Recupera la modalità corrente del sistema (DEV o LIVE).
 * Per sicurezza, di default ricade SEMPRE su "DEV".
 */
export async function getProjectMode(): Promise<ProjectModeState> {
  try {
    const { data, error } = await supabase
      .from("jvc_community_settings")
      .select("value")
      .eq("key", "project_mode")
      .maybeSingle();

    if (error || !data?.value) {
      const envMode = (process.env.APP_MODE || "DEV").toUpperCase() as ProjectMode;
      return {
        ...DEFAULT_DEV_STATE,
        mode: envMode === "LIVE" ? "LIVE" : "DEV",
      };
    }

    const state = data.value as ProjectModeState;
    return {
      mode: state.mode === "LIVE" ? "LIVE" : "DEV",
      locked: state.locked ?? true,
      description: state.description || DEFAULT_DEV_STATE.description,
      updated_at: state.updated_at || new Date().toISOString(),
      updated_by: state.updated_by,
    };
  } catch (err) {
    console.error("[ProjectMode] Error getting mode, defaulting to DEV for safety:", err);
    return DEFAULT_DEV_STATE;
  }
}

/**
 * Restituisce true se il sistema è attualmente in modalità DEV (protetta).
 */
export async function isDevMode(): Promise<boolean> {
  const current = await getProjectMode();
  return current.mode === "DEV";
}

/**
 * Aggiorna la modalità del sistema.
 * Per passare da DEV a LIVE sono tassativamente richieste 3 conferme consecutive.
 */
export async function setProjectMode(
  newMode: ProjectMode,
  options?: {
    confirmationCount?: number;
    confirmationPhrase?: string;
    adminUser?: string;
  }
): Promise<{ success: boolean; mode: ProjectMode; message: string }> {
  // Se si vuole attivare DEV mode, è sempre consentito all'istante
  if (newMode === "DEV") {
    const devState: ProjectModeState = {
      mode: "DEV",
      locked: true,
      description: "DEV mode active. All WhatsApp group additions and removals are strictly blocked.",
      updated_at: new Date().toISOString(),
      updated_by: options?.adminUser || "admin",
    };

    await supabase.from("jvc_community_settings").upsert(
      { key: "project_mode", value: devState },
      { onConflict: "key" }
    );

    await supabase.from("jvc_verification_logs").insert({
      run_type: "security_mode_change",
      previous_status: "LIVE",
      new_status: "DEV",
      action_taken: "locked_to_dev",
      details: { updated_by: options?.adminUser || "admin" },
    });

    return {
      success: true,
      mode: "DEV",
      message: "System safely locked into DEV Mode. All WhatsApp actions are blocked.",
    };
  }

  // Se si richiede il passaggio a LIVE, verifica rigorosamente la tripla conferma
  if (newMode === "LIVE") {
    const count = options?.confirmationCount || 0;
    const phrase = (options?.confirmationPhrase || "").trim().toUpperCase();

    if (count < 3) {
      return {
        success: false,
        mode: "DEV",
        message: `Triple confirmation required to exit DEV mode (Received confirmation ${count}/3).`,
      };
    }

    if (phrase !== "ENABLE LIVE") {
      return {
        success: false,
        mode: "DEV",
        message: 'Security validation failed: Confirmation phrase must be exact ("ENABLE LIVE").',
      };
    }

    const liveState: ProjectModeState = {
      mode: "LIVE",
      locked: false,
      description: "LIVE mode active. Real WhatsApp group additions and removals enabled.",
      updated_at: new Date().toISOString(),
      updated_by: options?.adminUser || "admin",
    };

    await supabase.from("jvc_community_settings").upsert(
      { key: "project_mode", value: liveState },
      { onConflict: "key" }
    );

    await supabase.from("jvc_verification_logs").insert({
      run_type: "security_mode_change",
      previous_status: "DEV",
      new_status: "LIVE",
      action_taken: "unlocked_to_live",
      details: {
        updated_by: options?.adminUser || "admin",
        confirmationCount: count,
        confirmationPhrase: phrase,
      },
    });

    return {
      success: true,
      mode: "LIVE",
      message: "LIVE Mode activated. Real WhatsApp modifications are now enabled.",
    };
  }

  return { success: false, mode: "DEV", message: "Invalid mode specified." };
}
