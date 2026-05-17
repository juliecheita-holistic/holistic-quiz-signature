const express = require('express');
const path = require('path');
require('dotenv').config();
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/api/result', async (req, res) => {
  const { answers, profile } = req.body || {};

  try {
    const recommendationsPath = path.join(__dirname, 'recommendations.json');
    const recommendationsRaw = fs.readFileSync(recommendationsPath, 'utf8');
    const recommendations = JSON.parse(recommendationsRaw);

    let recommendationText = '';
    const direct = recommendations && typeof recommendations === 'object' ? recommendations[profile] : undefined;
    if (typeof direct === 'string') {
      recommendationText = direct;
    } else if (direct && typeof direct === 'object') {
      recommendationText = direct.text || direct.recommendation || '';
    } else if (typeof recommendations === 'string') {
      recommendationText = recommendations;
    }

    const prompt =
      'You are Holistic London. Voice: warm, quiet, confident. ' +
      'Write exactly two paragraphs about the person and their home, based on their answers. ' +
      'No candle names. No markdown. ' +
      '60-80 words total. ' +
      'Profile: ' + String(profile) + '. ' +
      'Answers: ' + JSON.stringify(answers || {}) + '.';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    });

    const claudeText = (message && Array.isArray(message.content))
      ? message.content.map(c => (c && typeof c.text === 'string') ? c.text : '').join('')
      : '';

    const cleaned = claudeText.replace(/\*/g, '');

    const text = cleaned + '\n\n\n' + String(recommendationText || '');
    res.json({ result: text });
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

app.post('/api/subscribe', async (req, res) => {
  const { email, profile } = req.body || {};

  try {
    const response = await fetch('https://a.klaviyo.com/api/profiles/', {
      method: 'POST',
      headers: {
        'Authorization': 'Klaviyo-API-Key ' + process.env.KLAVIYO_API_KEY,
        'Content-Type': 'application/json',
        'revision': '2023-12-15'
      },
      body: JSON.stringify({
        data: {
          type: 'profile',
          attributes: {
            email,
            properties: {
              scent_profile: profile
            }
          }
        }
      })
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'Failed' });
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/sage', async (req, res) => {
  const { messages, disclaimer } = req.body;

  const system = `You are Sage, a warm and thoughtful companion created by Holistic London — a B Corp certified home fragrance brand based in London.

Your role is to listen, ask gentle questions, offer perspective and warmth, and occasionally recommend a candle when it feels right and natural. You speak like a trusted friend — unhurried, curious, never judgmental.

You ask ONE question at a time. Never more.
You never rush to sell or recommend a product.
You hold space first. You listen before you suggest anything.
You are not a therapist. You are not a sales bot. You are a friend who understands home and how it feels to need a moment of stillness.
You never offer medical or clinical advice. You never diagnose. You never use clinical language.
You keep responses warm, short and conversational — never more than 3-4 sentences.
You speak in the Holistic London brand voice: poetic but grounded, warm but not saccharine, thoughtful but never heavy.

The four candles you can recommend from THE EDIT collection are:
- EMBER (vetiver, dark berries, amber) — for grounding, restoration, the end of the day
- SETTLE (clary sage, patchouli, lavender) — for balance, restoration, when you need to truly stop
- VESPER (dark rose, frankincense, sandalwood) — for ritual, depth, evenings that deserve to feel significant
- OPEN (bergamot, basil, ylang ylang) — for uplift, presence, mornings and fresh starts

When you recommend a candle, end your message naturally and include the candle name in CAPS (e.g. EMBER) on its own line at the very end, preceded by the text "CANDLE:". Example: "CANDLE: EMBER". Only do this when a recommendation feels genuinely earned and natural — not forced.

If the person has NOT shared how they are feeling yet, do NOT recommend a candle. Keep listening.

${disclaimer ? 'The person has used a word related to mental health or medical topics. Acknowledge their feeling with warmth and care first. At the end of your response, add this one quiet line on a new paragraph: "I\'m here to listen and offer a little comfort — for anything deeper, talking to someone you trust always helps."' : ''}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });

    const raw = response.content[0].text.trim();

    // Extract candle recommendation if present
    const candleMatch = raw.match(/CANDLE:\s*(EMBER|SETTLE|VESPER|OPEN)/i);
    const candle = candleMatch ? candleMatch[1].toUpperCase() : null;
    const reply = raw.replace(/\nCANDLE:\s*(EMBER|SETTLE|VESPER|OPEN)/i, '').trim();

    res.json({ reply, candle });
  } catch (error) {
    console.error('Sage API error:', error);
    res.status(500).json({ reply: "I'm here — something went quiet on my end. Try again?", candle: null });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Holistic London quiz running on http://localhost:' + PORT);
});

