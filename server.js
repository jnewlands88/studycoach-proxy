const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/generate', async (req, res) => {
  const { apiKey, messages, model, max_tokens } = req.body;

  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return res.status(400).json({ error: { message: 'Invalid API key' } });
  }

  // Force all images to jpeg (canvas always outputs jpeg)
  const sanitized = (messages || []).map(msg => {
    if (!Array.isArray(msg.content)) return msg;
    return {
      ...msg,
      content: msg.content.map(block => {
        if (block.type === 'image' && block.source?.type === 'base64') {
          return { ...block, source: { ...block.source, media_type: 'image/jpeg' } };
        }
        return block;
      })
    };
  });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 6000,
        messages: sanitized,
      }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: 'Proxy error: ' + err.message } });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('StudyCoach proxy running on port', PORT));
