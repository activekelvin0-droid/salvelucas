// Vercel Serverless Function — WayMB payment status polling
// GET /api/payment-status?id=<transactionId>

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = req.query && req.query.id;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing 'id' parameter" });
  }

  const {
    WAYMB_CLIENT_ID,
    WAYMB_CLIENT_SECRET,
    WAYMB_BASE_URL = "https://api.waymb.com",
  } = process.env;

  if (!WAYMB_CLIENT_ID || !WAYMB_CLIENT_SECRET) {
    return res.status(500).json({ error: "WayMB credentials not configured" });
  }

  try {
    const upstream = await fetch(`${WAYMB_BASE_URL}/transactions/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: WAYMB_CLIENT_ID,
        client_secret: WAYMB_CLIENT_SECRET,
        id,
      }),
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return res.status(502).json({
        error: data.message || "Status query error",
        status: upstream.status,
      });
    }

    return res.status(200).json({
      id: data.id,
      status: data.status,
      method: data.method,
      amount: data.amount,
      updatedAt: data.updatedAt,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Gateway communication failure",
      message: err && err.message ? err.message : String(err),
    });
  }
}
