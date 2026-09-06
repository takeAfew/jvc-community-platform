# 🚀 JVC Community Platform & Monthly Automation Engine

Piattaforma end-to-end per **JVC (Junior VC Community Europe)** con stack **Next.js (Vercel) + Supabase + Lobstr API + Gemini 3.6 Flash + WhatsApp Automation Open-Source (Baileys)**.

---

## 🌟 Funzionalità Principali

1. **Design & Identità Visiva JVC**:
   - Palette colori esatta OKLCH, font `Inter` e logo vettoriale SVG estratti da [jvc-community.com](https://jvc-community.com).
   - Form di candidatura elegante (`/`) con selezione hub europeo (Parigi, Londra, Milano, Berlino, Madrid, ecc.).

2. **Verifica Mensile & Requisiti Venture Capital (Two-Way Lifecycle)**:
   - **Nuovi Candidati**:
     - Idonei: aggiunta al gruppo WhatsApp dedicato (o invio del link di invito privato se la privacy WhatsApp del candidato blocca l'aggiunta diretta) + messaggio di benvenuto.
     - Non idonei: invio messaggio WhatsApp esplicativo con motivazione dettagliata + invito a rispondere direttamente per contestare/chiarire.
   - **Membri Esistenti**:
     - Idonei: continuano nel gruppo.
     - Non più in VC (cambio lavoro verso corporate/consulenza): rimozione automatica dal gruppo WhatsApp + messaggio esplicativo con possibilità di replica.

3. **Motore di Eleggibilità VC con Gemini 3.6 Flash**:
   - Classifica fondi VC, Corporate VC, Venture Studio, Acceleratori, Family Office ed esclude consulenza tradizionale, private equity buyout e fornitori di servizi.
   - 100% accuratezza nei test benchmark.

4. **Admin Control Room (`/admin`)**:
   - Dashboard con statistiche in tempo reale (Membri attivi, Candidature in sospeso, Usciti, Rifiutati).
   - Scanner QR Code per collegare il bot WhatsApp in 5 secondi.
   - Pulsanti per eseguire la verifica mensile in **Dry Run (Simulazione)** o **Live**.
   - Gestione manuale e risoluzione contestazioni.

---

## 🛠️ Comandi Rapidi

```bash
# Avvio del server di sviluppo (Web & Admin Dashboard)
npm run dev

# Avvio del Bot WhatsApp in background
npm run wa:bot

# Esecuzione manuale della Verifica Mensile (Modalità Simulazione / Dry Run)
npm run verify:monthly -- --dry-run

# Esecuzione manuale della Verifica Mensile (LIVE)
npm run verify:monthly

# Build di produzione
npm run build
```

---

## 🔑 Variabili d'Ambiente (`.env.local`)

- `NEXT_PUBLIC_SUPABASE_URL`: Endpoint Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Chiave pubblica Supabase
- `LOBSTR_API_KEY`: API Key Lobstr
- `GEMINI_API_KEY`: API Key Gemini (modello: `gemini-3.6-flash`)
- `CRON_SECRET`: Token di autorizzazione per cron job
- `WHATSAPP_GROUP_JID`: ID del gruppo WhatsApp ufficiale (es. `120363xxx@g.us`)
- `WHATSAPP_GROUP_INVITE_LINK`: Link d'invito al gruppo
