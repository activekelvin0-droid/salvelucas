// Vercel Serverless Function — create WayMB donation (Solenari clone)
// POST /api/create-payment

const ALLOWED_AMOUNTS = new Set([18, 19, 28, 39, 59, 79, 99, 139, 199, 299]);
const ALLOWED_METHODS = new Set(["mbway", "multibanco"]);

const isEmail = (s) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isNIF = (s) => typeof s === "string" && /^\d{9}$/.test(s);
const isPhone = (s) => typeof s === "string" && /^\d{9,15}$/.test(s.replace(/\D/g, ""));

const toIntlPhone = (s) => {
  const d = String(s || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("351")) return `+${d}`;
  if (d.length === 9 && d[0] === "9") return `+351${d}`;
  return d.startsWith("+") ? d : `+${d}`;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { amount, method, name, email, phone, document } = req.body || {};
  const numericAmount = Number(amount);

  if (!ALLOWED_AMOUNTS.has(numericAmount)) {
    return res.status(400).json({ error: "Invalid donation amount" });
  }
  if (!method || !ALLOWED_METHODS.has(method)) {
    return res.status(400).json({ error: "Invalid payment method" });
  }
  if (typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({ error: "Invalid name" });
  }
  if (!isEmail(email)) return res.status(400).json({ error: "Invalid e-mail" });
  if (!isNIF(document)) return res.status(400).json({ error: "Invalid NIF (9 digits)" });
  if (!isPhone(phone)) return res.status(400).json({ error: "Invalid phone" });

  const {
    WAYMB_CLIENT_ID,
    WAYMB_CLIENT_SECRET,
    WAYMB_ACCOUNT_EMAIL,
    WAYMB_BASE_URL = "https://api.waymb.com",
    CALLBACK_URL,
    SUCCESS_URL,
    FAILED_URL,
  } = process.env;

  if (!WAYMB_CLIENT_ID || !WAYMB_CLIENT_SECRET || !WAYMB_ACCOUNT_EMAIL) {
    return res.status(500).json({ error: "WayMB credentials not configured" });
  }

  const waymbPayload = {
    client_id: WAYMB_CLIENT_ID,
    client_secret: WAYMB_CLIENT_SECRET,
    account_email: WAYMB_ACCOUNT_EMAIL,
    amount: numericAmount,
    method,
    payer: {
      email: email.trim(),
      name: name.trim(),
      document: String(document).trim(),
      phone: toIntlPhone(phone),
    },
    paymentDescription: `Donation Lucas ${numericAmount}EUR`.slice(0, 50),
    currency: "EUR",
  };
  if (CALLBACK_URL) waymbPayload.callbackUrl = CALLBACK_URL;
  if (SUCCESS_URL) waymbPayload.success_url = SUCCESS_URL;
  if (FAILED_URL) waymbPayload.failed_url = FAILED_URL;

  console.log(
    "[WayMB /create] REQUEST payload (no secret):",
    JSON.stringify({ ...waymbPayload, client_id: "***", client_secret: "***" })
  );

  try {
    const upstream = await fetch(`${WAYMB_BASE_URL}/transactions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(waymbPayload),
    });

    const rawText = await upstream.text();
    let data = {};
    try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = { raw: rawText }; }

    console.log("[WayMB /create] RESPONSE http=%d body=%s", upstream.status, rawText.slice(0, 1500));

    if (!upstream.ok || (data.statusCode && data.statusCode !== 200)) {
      const reason = data.message || data.error || data.errors ||
        (data.raw ? `Invalid response: ${String(data.raw).slice(0, 200)}` : null) ||
        `HTTP ${upstream.status}`;
      return res.status(502).json({
        error: typeof reason === "string" ? reason : JSON.stringify(reason),
        gatewayStatus: upstream.status,
      });
    }

    return res.status(200).json({
      id: data.id || data.transactionID,
      method: data.method,
      amount: data.amount,
      generatedMBWay: data.generatedMBWay === true,
      referenceData: data.referenceData || null,
      createdAt: data.createdAt,
    });
  } catch (err) {
    console.error("[WayMB /create] EXCEPTION:", err);
    return res.status(500).json({
      error: "Gateway communication failure",
      message: err && err.message ? err.message : String(err),
    });
  }
}
