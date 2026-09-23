import { isDevMode } from "./project-mode";

export interface WhatsAppParticipantResult {
  id: string;
  code: number;
  message?: string;
  inviteCode?: string;
}

export interface WhatsAppSessionInfo {
  name: string;
  status: "WORKING" | "CONNECTED" | "SCAN_QR_CODE" | "STARTING" | "FAILED" | "STOPPED";
  phoneNumber?: string;
  pushName?: string;
  engine?: string;
  engineState?: string;
  lastActivity?: number;
}

class WhatsAppClient {
  private baseUrl: string;
  private apiKey: string;
  private session: string;
  public defaultGroupId: string;

  constructor() {
    this.baseUrl = (process.env.WHATSAPP_API_URL || "http://35.209.138.44:3000").replace(/\/$/, "");
    this.apiKey = process.env.WHATSAPP_API_KEY || "f51afd5f752a4013b555397b13e77d41";
    this.session = process.env.WHATSAPP_SESSION || "default";
    this.defaultGroupId = process.env.WHATSAPP_PARIS_GROUP_ID || "120363426447392585@g.us";
  }

  private normalizePhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, "");
    return `${cleaned}@c.us`;
  }

  private normalizeChatId(chatId: string): string {
    if (chatId.includes("@")) return chatId;
    return this.normalizePhone(chatId);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      "X-Api-Key": this.apiKey,
      ...options.headers,
    };

    const res = await fetch(url, { ...options, headers, cache: "no-store" });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`[WhatsApp API ${res.status}] ${errorBody}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Recupera lo stato reale della sessione WhatsApp dal server WAHA (Google Cloud).
   */
  async getSessionStatus(): Promise<{
    connected: boolean;
    status: string;
    phoneNumber?: string;
    pushName?: string;
    engineState?: string;
    raw?: any;
  }> {
    try {
      const sessionData = await this.request<any>(`/api/sessions/${this.session}`);
      const isConnected =
        sessionData.status === "WORKING" ||
        sessionData.engine?.state === "CONNECTED";

      let phone: string | undefined = undefined;
      if (sessionData.me?.id) {
        phone = "+" + sessionData.me.id.split("@")[0];
      }

      return {
        connected: isConnected,
        status: sessionData.status || "UNKNOWN",
        phoneNumber: phone,
        pushName: sessionData.me?.pushName || "JVC",
        engineState: sessionData.engine?.state || "UNKNOWN",
        raw: sessionData,
      };
    } catch (err: any) {
      console.error("[WhatsAppClient] Error fetching session status:", err.message);
      return {
        connected: false,
        status: "DISCONNECTED",
        raw: { error: err.message },
      };
    }
  }

  /**
   * Recupera i gruppi WhatsApp a cui partecipa l'account.
   */
  async getGroups(): Promise<any[]> {
    try {
      return await this.request<any[]>(`/api/${this.session}/groups`);
    } catch (err: any) {
      console.error("[WhatsAppClient] Error fetching groups:", err.message);
      return [];
    }
  }

  /**
   * REGOLA D'ORO / SAFEGUARD:
   * Aggiunge un partecipante a un gruppo SOLO se non si è in DEV Mode.
   * In modalità DEV, l'operazione viene RIGOROSAMENTE BLOCCATA.
   */
  async addParticipant(
    groupId: string,
    phoneNumber: string
  ): Promise<{
    success: boolean;
    blocked: boolean;
    devMode: boolean;
    message: string;
    participants?: WhatsAppParticipantResult[];
  }> {
    const dev = await isDevMode();
    const targetGroup = groupId || this.defaultGroupId;

    if (dev) {
      console.warn(
        `🛡️ [DEV MODE SAFEGUARD] Prevented adding participant ${phoneNumber} to group ${targetGroup}. Operation blocked!`
      );
      return {
        success: false,
        blocked: true,
        devMode: true,
        message:
          "DEV MODE SAFEGUARD: System is in DEV mode. No candidate will be added to WhatsApp groups.",
      };
    }

    const participantJid = this.normalizePhone(phoneNumber);
    const res = await this.request<{ participants: WhatsAppParticipantResult[] }>(
      `/api/${this.session}/groups/${encodeURIComponent(targetGroup)}/participants/add`,
      {
        method: "POST",
        body: JSON.stringify({ participants: [participantJid] }),
      }
    );

    return {
      success: true,
      blocked: false,
      devMode: false,
      message: "Participant added successfully",
      participants: res.participants,
    };
  }

  /**
   * REGOLA D'ORO / SAFEGUARD:
   * Rimuove un partecipante da un gruppo SOLO se non si è in DEV Mode.
   * In modalità DEV, l'operazione viene RIGOROSAMENTE BLOCCATA.
   */
  async removeParticipant(
    groupId: string,
    phoneNumber: string
  ): Promise<{
    success: boolean;
    blocked: boolean;
    devMode: boolean;
    message: string;
    participants?: WhatsAppParticipantResult[];
  }> {
    const dev = await isDevMode();
    const targetGroup = groupId || this.defaultGroupId;

    if (dev) {
      console.warn(
        `🛡️ [DEV MODE SAFEGUARD] Prevented removing participant ${phoneNumber} from group ${targetGroup}. Operation blocked!`
      );
      return {
        success: false,
        blocked: true,
        devMode: true,
        message:
          "DEV MODE SAFEGUARD: System is in DEV mode. No member will be removed from WhatsApp groups.",
      };
    }

    const participantJid = this.normalizePhone(phoneNumber);
    const res = await this.request<{ participants: WhatsAppParticipantResult[] }>(
      `/api/${this.session}/groups/${encodeURIComponent(targetGroup)}/participants/remove`,
      {
        method: "POST",
        body: JSON.stringify({ participants: [participantJid] }),
      }
    );

    return {
      success: true,
      blocked: false,
      devMode: false,
      message: "Participant removed successfully",
      participants: res.participants,
    };
  }

  /**
   * Invia un messaggio WhatsApp. In DEV Mode i messaggi automatici ai candidati sono simulati.
   */
  async sendMessage(
    chatId: string,
    text: string,
    forceLive: boolean = false
  ): Promise<{ id: string; blocked: boolean; devMode: boolean; message: string }> {
    const dev = await isDevMode();

    if (dev && !forceLive) {
      console.warn(
        `🛡️ [DEV MODE SAFEGUARD] Simulated message to ${chatId}: "${text.slice(0, 80)}..."`
      );
      return {
        id: `dev_sim_${Date.now()}`,
        blocked: true,
        devMode: true,
        message: "Message simulated in DEV mode (not dispatched).",
      };
    }

    const res = await this.request<{ id: string }>(`/api/sendText`, {
      method: "POST",
      body: JSON.stringify({
        session: this.session,
        chatId: this.normalizeChatId(chatId),
        text,
      }),
    });

    return {
      id: res.id,
      blocked: false,
      devMode: false,
      message: "Message sent",
    };
  }
}

export const whatsapp = new WhatsAppClient();
