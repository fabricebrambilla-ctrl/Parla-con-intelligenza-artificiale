require("dotenv").config({ quiet: true });

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

// Simple health check
app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.json({ reply: "Errore: manca GROQ_API_KEY nel file .env (o in Render Env Vars)." });
    }

    const incomingMessages = req.body?.messages;
    if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
      return res.json({ reply: "Non ho ricevuto messaggi (messages) dal browser." });
    }

    const messages = incomingMessages
      .filter((m) => m && typeof m === "object")
      .map((m) => ({
        role: String(m.role || "").trim(),
        content: String(m.content || "").trim(),
      }))
      .filter(
        (m) =>
          (m.role === "system" || m.role === "user" || m.role === "assistant") &&
          m.content.length > 0
      );

    if (messages.length === 0) {
      return res.json({ reply: "I messaggi ricevuti sono vuoti o non validi." });
    }

    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        stream: false,
      }),
    });

    const raw = await groqRes.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (!groqRes.ok) {
      const msg =
        data?.error?.message ||
        data?.message ||
        raw ||
        "Errore sconosciuto da Groq.";
      return res.json({ reply: `Errore Groq (HTTP ${groqRes.status}): ${msg}` });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.json({
        reply:
          "Nessuna risposta disponibile. (choices[0].message.content mancante nella risposta Groq.)",
      });
    }

    return res.json({ reply });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.json({ reply: "Errore nel server AI." });
  }
});

// Serve the UI
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});