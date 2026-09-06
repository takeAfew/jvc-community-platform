export interface WhatsAppActionResult {
  success: boolean;
  action: "added_to_group" | "invite_sent_dm" | "removed_from_group" | "message_sent" | "failed";
  recipient: string;
  details?: string;
  error?: string;
}

export interface WhatsAppBotState {
  status: "disconnected" | "connecting" | "qr_ready" | "connected";
  qrCodeDataUrl: string | null;
  phoneNumber: string | null;
  lastConnectedAt: string | null;
}
