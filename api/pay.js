export default async function handler(req, res) {
  const fetch = (await import('node-fetch')).default;
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body;

    // ==========================================
    // COLOQUE SUAS CHAVES DA DEBITO.CO.MZ AQUI
    // ==========================================
    const DEBITO_API_KEY = "sk_live_ItHJ7fJQT5BL4vlqzqwwTjEYhx3ZuROg";
    const DEBITO_MERCHANT_ID = "f2a41c3a-4ed7-482c-8d16-4fd9c376f9c8";

    // Como você tem carteiras diferentes para cada método, preencha os códigos abaixo:
    const WALLET_CODES = {
      "mpesa": "28409",
      "emola": "26724",
      "mkesh": "58843"
    };

    const DEBITO_WALLET_CODE = WALLET_CODES[payload.method];

    if (!DEBITO_WALLET_CODE) {
      return res.status(400).json({ error: "Método de pagamento inválido ou carteira não configurada." });
    }

    const DEBITO_API_URL = "https://gyqoaningqhurhvdugne.supabase.co/functions/v1/payment-orchestrator";

    // Formatar o Payload exigido pela Debito
    const debitoPayload = {
      action: "process",
      payment_method: payload.method, // 'mpesa' ou 'emola'
      merchant_id: DEBITO_MERCHANT_ID,
      wallet_code: DEBITO_WALLET_CODE,
      amount: parseFloat(payload.amount),
      currency: "MZN",
      source: "gateway",
      source_id: payload.reference,
      phone: payload.customer.phone,
      customer_name: payload.customer.name,
      customer_email: payload.customer.email,
      return_url: payload.return_url
    };

    console.log("Enviando para Debito:", debitoPayload);

    const response = await fetch(DEBITO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEBITO_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(debitoPayload)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('Debito Error:', data);
      return res.status(response.status || 400).json(data);
    }

    // Sucesso
    return res.status(200).json(data);
  } catch (error) {
    console.error('Serverless Function Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
