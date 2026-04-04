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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Holistic London quiz running on http://localhost:' + PORT);
});

