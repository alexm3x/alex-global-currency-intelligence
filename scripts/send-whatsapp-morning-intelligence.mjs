import fs from 'node:fs';

const latestPath = 'podcast/latest.json';
const required = ['WHATSAPP_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_TO','WHATSAPP_TEMPLATE_NAME'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.log(`WhatsApp omitido; faltan secretos: ${missing.join(', ')}`);
  process.exit(0);
}

if (!fs.existsSync(latestPath)) throw new Error('Falta podcast/latest.json');
const ep = JSON.parse(fs.readFileSync(latestPath,'utf8'));
if (!ep.audioUrl || !ep.date) throw new Error('Episodio sin audioUrl/date');

const base = process.env.AGCI_PUBLIC_BASE || 'https://alexm3x.github.io/alex-global-currency-intelligence/';
const listenUrl = new URL('podcast/', base).href;
const duration = Number(ep.durationSeconds || 0);
const mm = Math.floor(duration / 60);
const ss = String(Math.round(duration % 60)).padStart(2,'0');
const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || 'v23.0';
const endpoint = `https://graph.facebook.com/${graphVersion}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

const payload = {
  messaging_product: 'whatsapp',
  to: process.env.WHATSAPP_TO,
  type: 'template',
  template: {
    name: process.env.WHATSAPP_TEMPLATE_NAME,
    language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'es_MX' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: ep.date },
          { type: 'text', text: `${mm}:${ss}` },
          { type: 'text', text: listenUrl }
        ]
      }
    ]
  }
};

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

const body = await response.text();
if (!response.ok) {
  throw new Error(`WhatsApp API ${response.status}: ${body.slice(0,1200)}`);
}
console.log(`WhatsApp enviado para episodio ${ep.date}: ${body.slice(0,500)}`);
