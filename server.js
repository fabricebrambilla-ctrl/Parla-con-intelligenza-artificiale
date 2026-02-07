require("dotenv").config();

const express = require("express");

const app = express();
const PORT = 3000;

// CHANGE THIS STRING if you want to confirm you're running the new server
const SERVER_VERSION = "server-v2-messages-2026-02-05";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

console.log("✅ SERVER VERSION:", SERVER_VERSION);

app.post("/api/chat", async (req, res) => {
  try {
    console.log("API HIT keys:", Object.keys(req.body || {}));

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.json({ reply: "Errore: manca GROQ_API_KEY nel file .env" });
    }

    // Accept BOTH formats:
    // 1) { messages: [...] }  (multi-turn)
    // 2) { text: "..." }      (fallback)
    const incomingMessages = req.body?.messages;
    const incomingText = (req.body?.text || "").trim();

    let messages = [];

    if (Array.isArray(incomingMessages) && incomingMessages.length > 0) {
      // validate/sanitize
      messages = incomingMessages
        .filter((m) => m && typeof m === "object")
        .map((m) => ({
          role: String(m.role || ""),
          content: String(m.content || "")
        }))
        .filter(
          (m) =>
            (m.role === "system" || m.role === "user" || m.role === "assistant") &&
            m.content.trim().length > 0
        );

      console.log("USING messages[] mode. count =", messages.length);
    } else if (incomingText) {
      console.log("USING text mode.");
      messages = [
        {
          role: "system",
          content:
            "Rispondi in italiano. Usa un tono chiaro, calmo e accessibile per un utente non vedente."
        },
        { role: "user", content: incomingText }
      ];
    } else {
      console.log("ERROR: received neither messages nor text:", req.body);
      return res.json({ reply: "Non ho ricevuto alcun testo." });
    }

    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        stream: false
      })
    });

    const raw = await groqRes.text();
    console.log("GROQ STATUS:", groqRes.status);

    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (!groqRes.ok) {
      const msg = data?.error?.message || data?.message || raw || "Errore sconosciuto da Groq.";
      return res.json({ reply: `Errore Groq (HTTP ${groqRes.status}): ${msg}` });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.json({
        reply:
          "Nessuna risposta disponibile. (Il server non ha trovato choices[0].message.content nella risposta Groq.)"
      });
    }

    return res.json({ reply });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.json({ reply: "Errore nel server AI." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});