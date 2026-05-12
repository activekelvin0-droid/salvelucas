// Vercel Serverless Function — WayMB webhook receiver
// POST /api/webhook
// WayMB requires HTTP 200 response — always return 200 even if processing fails

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    console.log("[WayMB webhook]", JSON.stringify(req.body || {}));
    // TODO: validate `signature` once WayMB documents how
    // TODO: trigger business logic on COMPLETED / DECLINED
  } catch (err) {
    console.error("[WayMB webhook] error:", err);
  }
  return res.status(200).json({ received: true });
}
