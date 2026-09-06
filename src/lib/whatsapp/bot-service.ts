import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import pino from "pino";
import path from "path";
import fs from "fs";
import { supabase } from "../supabase";
import { WhatsAppActionResult, WhatsAppBotState } from "./types";

const AUTH_FOLDER = path.join(process.cwd(), "wa_auth_info");
const logger = pino({ level: "silent" });

let sock: WASocket | null = null;
let currentQR: string | null = null;
let currentState: WhatsAppBotState = {
  status: "disconnected",
  qrCodeDataUrl: null,
  phoneNumber: null,
  lastConnectedAt: null,
};

export function getBotState(): WhatsAppBotState {
  return currentState;
}

/**
 * Initializes and starts the WhatsApp Web client connection
 */
export async function startWhatsAppClient(): Promise<WASocket> {
  if (sock && currentState.status === "connected") {
    return sock;
  }

  if (!fs.existsSync(AUTH_FOLDER)) {
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  currentState.status = "connecting";

  sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: true,
    auth: state,
    browser: ["JVC Community Europe", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      try {
        const dataUrl = await QRCode.toDataURL(qr);
        currentState = {
          ...currentState,
          status: "qr_ready",
          qrCodeDataUrl: dataUrl,
        };

        // Save QR code state to Supabase settings for frontend viewing
        await supabase
          .from("jvc_community_settings")
          .upsert({
            key: "wa_bot_live_status",
            value: {
              status: "qr_ready",
              qrCodeDataUrl: dataUrl,
              updated_at: new Date().toISOString(),
            },
          });
      } catch (err) {
        console.error("Failed to generate QR code data URL:", err);
      }
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      currentState.status = "disconnected";
      currentState.qrCodeDataUrl = null;

      await supabase
        .from("jvc_community_settings")
        .upsert({
          key: "wa_bot_live_status",
          value: {
            status: "disconnected",
            error: lastDisconnect?.error?.message,
            updated_at: new Date().toISOString(),
          },
        });

      if (shouldReconnect) {
        console.log("WhatsApp disconnected, reconnecting in 5s...");
        setTimeout(() => startWhatsAppClient(), 5000);
      }
    } else if (connection === "open") {
      const userPhone = sock?.user?.id?.split(":")[0] || "connected";
      currentState = {
        status: "connected",
        qrCodeDataUrl: null,
        phoneNumber: userPhone,
        lastConnectedAt: new Date().toISOString(),
      };

      console.log(`✅ WhatsApp Bot connected successfully as ${userPhone}!`);

      await supabase
        .from("jvc_community_settings")
        .upsert({
          key: "wa_bot_live_status",
          value: {
            status: "connected",
            phoneNumber: userPhone,
            updated_at: new Date().toISOString(),
          },
        });
    }
  });

  // Handle incoming messages (e.g. member appeals or replies to rejection/offboarding)
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.key.fromMe && msg.message) {
        const senderJid = msg.key.remoteJid;
        if (!senderJid || senderJid.endsWith("@g.us")) continue; // Ignore group messages

        const phone = senderJid.split("@")[0];
        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          "";

        if (!text) continue;

        console.log(`📩 Inbound WhatsApp message from +${phone}: "${text}"`);

        // Find member in Supabase
        const { data: member } = await supabase
          .from("jvc_members")
          .select("id, full_name, status")
          .eq("phone_number", `+${phone}`)
          .maybeSingle();

        // Log message in Supabase
        await supabase.from("jvc_wa_messages").insert({
          member_id: member?.id || null,
          phone_number: `+${phone}`,
          direction: "inbound",
          message_text: text,
        });

        // If member was rejected or removed, mark as flagged_manual for Andrea's review
        if (member && (member.status === "rejected" || member.status === "removed_churned")) {
          await supabase
            .from("jvc_members")
            .update({
              status: "flagged_manual",
              rejection_reason: `Candidate contested via WhatsApp: "${text.slice(0, 150)}"`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", member.id);
        }
      }
    }
  });

  return sock;
}

/**
 * Format phone number to WhatsApp JID (e.g. +393401234567 -> 393401234567@s.whatsapp.net)
 */
export function formatPhoneToJid(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return `${digits}@s.whatsapp.net`;
}

/**
 * Send a direct WhatsApp text message
 */
export async function sendDirectMessage(phone: string, text: string): Promise<boolean> {
  const client = await startWhatsAppClient();
  const jid = formatPhoneToJid(phone);

  try {
    await client.sendMessage(jid, { text });

    // Log outbound message
    await supabase.from("jvc_wa_messages").insert({
      phone_number: phone,
      direction: "outbound",
      message_text: text,
    });

    return true;
  } catch (err) {
    console.error(`Failed to send WhatsApp message to ${phone}:`, err);
    return false;
  }
}

/**
 * Add a qualified candidate to the JVC WhatsApp group.
 * If privacy restrictions block direct addition, sends private invite link!
 */
export async function addCandidateToGroup(
  phone: string,
  fullName: string,
  firmName: string,
  groupJid?: string,
  inviteLink?: string
): Promise<WhatsAppActionResult> {
  const client = await startWhatsAppClient();
  const jid = formatPhoneToJid(phone);

  // Fallback defaults from settings if not passed
  const targetGroup = groupJid || process.env.WHATSAPP_GROUP_JID || "";
  const groupInviteUrl = inviteLink || process.env.WHATSAPP_GROUP_INVITE_LINK || "https://chat.whatsapp.com/JVCCommunityInvite";

  if (!targetGroup) {
    // If no group JID configured yet, send direct welcome message with invite link
    const welcomeMsg = `Hey ${fullName}! 👋\n\nWelcome to JVC (Junior VC Community Europe)!\nWe verified your profile at ${firmName} and are thrilled to have you with us.\n\nHere is your exclusive link to join your European peers:\n${groupInviteUrl}\n\nOne rule: active VC peers only. See you inside! 🚀`;
    await sendDirectMessage(phone, welcomeMsg);

    return {
      success: true,
      action: "invite_sent_dm",
      recipient: phone,
      details: "No group JID specified; sent direct message with exclusive invite link.",
    };
  }

  try {
    const res = await client.groupParticipantsUpdate(targetGroup, [jid], "add");
    const resultStatus = res?.[0]?.status;

    if (resultStatus === "200") {
      // Added directly!
      const welcomeDirectMsg = `Hey ${fullName}! 👋\n\nWelcome to JVC (Junior VC Community Europe)!\nWe verified your profile at ${firmName} and have just added you to the official group.\n\nGreat to have you in the ecosystem! 🇪🇺`;
      await sendDirectMessage(phone, welcomeDirectMsg);

      return {
        success: true,
        action: "added_to_group",
        recipient: phone,
        details: "Directly added to WhatsApp group.",
      };
    } else {
      // Privacy restriction (status 403 or code 408) -> Send invite link via DM
      const welcomeInviteMsg = `Hey ${fullName}! 👋\n\nWelcome to JVC (Junior VC Community Europe)!\nYour profile at ${firmName} is verified.\n\nBecause of your WhatsApp privacy settings, we couldn't add you directly. Please join via your private invite link:\n${groupInviteUrl}\n\nLooking forward to meeting you!`;
      await sendDirectMessage(phone, welcomeInviteMsg);

      return {
        success: true,
        action: "invite_sent_dm",
        recipient: phone,
        details: `Privacy settings restricted direct add (status ${resultStatus}). Sent invite link via DM.`,
      };
    }
  } catch (err: any) {
    console.warn(`Direct group add failed for ${phone}, falling back to DM invite:`, err?.message);
    const fallbackMsg = `Hey ${fullName}! 👋\n\nWelcome to JVC! Your profile at ${firmName} has been approved.\nHere is the link to join the official group:\n${groupInviteUrl}`;
    await sendDirectMessage(phone, fallbackMsg);

    return {
      success: true,
      action: "invite_sent_dm",
      recipient: phone,
      details: `Fallback invite link sent via DM.`,
    };
  }
}

/**
 * Remove a member from the group who no longer works in VC, and send explanation message
 */
export async function removeMemberFromGroup(
  phone: string,
  fullName: string,
  reason: string,
  groupJid?: string
): Promise<WhatsAppActionResult> {
  const client = await startWhatsAppClient();
  const jid = formatPhoneToJid(phone);
  const targetGroup = groupJid || process.env.WHATSAPP_GROUP_JID || "";

  if (targetGroup) {
    try {
      await client.groupParticipantsUpdate(targetGroup, [jid], "remove");
    } catch (err: any) {
      console.warn(`Could not remove ${phone} from group (might not be in group or not admin):`, err?.message);
    }
  }

  // Send polite offboarding message
  const offboardMsg = `Hi ${fullName},\n\nAs part of our monthly JVC ecosystem check, we noticed your LinkedIn profile no longer indicates an active role in venture capital (${reason}).\n\nTo ensure the community remains 100% focused on active peers, we have stepped you out of the group for now.\n\nYou are always welcome back as soon as your path returns to the ecosystem! If this was an error or you transitioned to a new fund, please reply directly to this message. 🙏`;
  await sendDirectMessage(phone, offboardMsg);

  return {
    success: true,
    action: "removed_from_group",
    recipient: phone,
    details: `Removed from group and sent offboarding DM.`,
  };
}

/**
 * Send polite rejection message with reasoning and feedback loop
 */
export async function sendRejectionNotice(
  phone: string,
  fullName: string,
  reason: string
): Promise<WhatsAppActionResult> {
  const rejectionMsg = `Hi ${fullName},\n\nThank you for applying to JVC (Junior VC Community Europe).\n\nOur single community rule is that members must currently work within the European venture capital ecosystem (funds, venture studios, accelerators, family offices, venture debt).\n\nBased on your current profile, we were unable to confirm an active junior VC role: ${reason}.\n\nIf there was a mistake or your status has recently changed, simply reply directly to this message and we will review it personally! 🙌`;

  await sendDirectMessage(phone, rejectionMsg);

  return {
    success: true,
    action: "message_sent",
    recipient: phone,
    details: "Rejection notice sent with feedback loop.",
  };
}
