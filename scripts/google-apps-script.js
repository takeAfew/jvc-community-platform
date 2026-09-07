// CONFIGURAZIONE JVC COMMUNITY PLATFORM
const API_URL = "https://jvc-community-platform.vercel.app/api/apply";
const SECRET_TOKEN = "jvc_secret_monthly_verification_2026";
const DEFAULT_HUB = "Paris";

/**
 * 1. SINCRONIZZA TUTTI I CANDIDATI GIÀ PRESENTI NEL FOGLIO
 * (Esegui questa funzione per importare o ri-sincronizzare lo storico con Cognome, Data e Hub)
 */
function syncAllExistingRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    SpreadsheetApp.getUi().alert("Nessun dato trovato nel foglio (solo intestazioni o vuoto).");
    return;
  }
  
  const headers = data[0];
  const colMap = mapHeaders(headers);
  
  const candidates = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const candidate = extractCandidateFromRow(row, colMap);
    if (candidate && candidate.fullName && candidate.phoneNumber && candidate.linkedinUrl) {
      candidates.push(candidate);
    }
  }
  
  if (candidates.length === 0) {
    SpreadsheetApp.getUi().alert("Nessun candidato valido trovato con Nome, Telefono e LinkedIn.");
    return;
  }
  
  Logger.log("Invio " + candidates.length + " candidati a JVC Community Platform...");
  
  const response = sendToJVC(candidates);
  
  if (response && response.success) {
    SpreadsheetApp.getUi().alert("✅ SUCCESSO!\nSincronizzati " + response.syncedCount + " candidati con Nome, Cognome, Data e Hub Parigi nella Control Room JVC!");
  } else {
    SpreadsheetApp.getUi().alert("⚠️ Errore o sincronizzazione parziale:\n" + JSON.stringify(response));
  }
}

/**
 * 2. ATTIVATORE AUTOMATICO: Invia ogni nuova candidatura appena viene inviato il Google Form
 */
function onFormSubmit(e) {
  let candidate = null;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colMap = mapHeaders(headers);

  if (e && e.values) {
    candidate = extractCandidateFromRow(e.values, colMap);
  } else {
    const lastRow = sheet.getLastRow();
    const rowData = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    candidate = extractCandidateFromRow(rowData, colMap);
  }
  
  if (candidate && candidate.fullName && candidate.phoneNumber && candidate.linkedinUrl) {
    Logger.log("Nuova candidatura ricevuta: " + candidate.fullName);
    sendToJVC([candidate]);
  }
}

/**
 * Mappa automaticamente le colonne in base alle intestazioni del foglio
 */
function mapHeaders(headers) {
  const map = { timestamp: -1, name: -1, surname: -1, phone: -1, linkedin: -1, firm: -1, role: -1, hub: -1 };
  
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i]).toLowerCase().trim();
    if (/crono|timestamp|data|informazioni cronologiche/i.test(h) && map.timestamp === -1) map.timestamp = i;
    else if (/^name$|^nome$|first\s*name/i.test(h) && map.name === -1) map.name = i;
    else if (/surname|cognome|last\s*name/i.test(h) && map.surname === -1) map.surname = i;
    else if (/telefono|phone|whatsapp|cellulare|numero/i.test(h) && map.phone === -1) map.phone = i;
    else if (/linkedin|link|profilo/i.test(h) && map.linkedin === -1) map.linkedin = i;
    else if (/company|fondo|firm|azienda|vc/i.test(h) && map.firm === -1) map.firm = i;
    else if (/role|ruolo|title|titolo/i.test(h) && map.role === -1) map.role = i;
    else if (/^hub$|^citt[àa]$|^city$/i.test(h) && map.hub === -1) map.hub = i;
  }
  
  return map;
}

/**
 * Estrae l'oggetto candidato unendo Name e Surname, Timestamp e Hub
 */
function extractCandidateFromRow(row, map) {
  const firstName = String(map.name !== -1 ? row[map.name] : (row[1] || "")).trim();
  const lastName = String(map.surname !== -1 ? row[map.surname] : (row[2] || "")).trim();
  const fullName = (firstName + " " + lastName).trim();
  
  const rawTimestamp = map.timestamp !== -1 ? row[map.timestamp] : row[0];
  let appliedAt = null;
  if (rawTimestamp instanceof Date) {
    appliedAt = rawTimestamp.toISOString();
  } else if (rawTimestamp) {
    appliedAt = String(rawTimestamp).trim();
  }

  return {
    firstName: firstName,
    lastName: lastName,
    fullName: fullName,
    phoneNumber: String(map.phone !== -1 ? row[map.phone] : (row[3] || "")).trim(),
    linkedinUrl: String(map.linkedin !== -1 ? row[map.linkedin] : (row[5] || "")).trim(),
    currentFirm: String(map.firm !== -1 ? row[map.firm] : (row[6] || "")).trim(),
    roleTitle: String(map.role !== -1 ? row[map.role] : (row[8] || "")).trim(),
    hubCity: map.hub !== -1 && row[map.hub] ? String(row[map.hub]).trim() : DEFAULT_HUB,
    appliedAt: appliedAt
  };
}

/**
 * Chiamata API HTTPS verso Vercel
 */
function sendToJVC(payload) {
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-secret-token": SECRET_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const res = UrlFetchApp.fetch(API_URL, options);
    const code = res.getResponseCode();
    const content = res.getContentText();
    Logger.log("Risposta API (" + code + "): " + content);
    return JSON.parse(content);
  } catch (err) {
    Logger.log("Errore chiamata HTTP: " + err);
    return { success: false, error: err.toString() };
  }
}
