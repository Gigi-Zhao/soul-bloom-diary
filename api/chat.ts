import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).json({ error: "Method Not Allowed" });
	}

	try {
		const apiKey = process.env.OPENROUTER_API_KEY;
		if (!apiKey) {
			return res.status(500).json({ error: "Server misconfigured: OPENROUTER_API_KEY missing" });
		}

		const { model, messages } = req.body || {};
		if (!Array.isArray(messages) || messages.length === 0) {
			return res.status(400).json({ error: "Invalid request: messages required" });
		}

		const usedModel = typeof model === "string" && model.trim() ? model : "minimax/minimax-m2:free";

		const openrouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${apiKey}`,
				"HTTP-Referer": req.headers.referer || "https://soul-bloom-diary.vercel.app",
				"X-Title": "Soul Bloom Diary",
			},
			body: JSON.stringify({
				model: usedModel,
				messages,
				stream: false,
			}),
		});

		if (!openrouterRes.ok) {
			const text = await openrouterRes.text().catch(() => "");
			return res.status(openrouterRes.status).json({ error: `Upstream error: ${text}` });
		}

		const data = await openrouterRes.json();
		const content =
			data?.choices?.[0]?.message?.content ??
			data?.choices?.[0]?.text ??
			"";

		return res.status(200).json({ content, raw: data });
	} catch (err: any) {
		return res.status(500).json({ error: err?.message || "Unexpected server error" });
	}
}
