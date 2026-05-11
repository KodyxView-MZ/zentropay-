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
    const rawPhone = payload.customer.phone || '';
    const formattedPhone = rawPhone.startsWith('258') ? rawPhone : '258' + rawPhone;

    const debitoPayload = {
      action: "process",
      payment_method: payload.method,
      merchant_id: DEBITO_MERCHANT_ID,
      wallet_code: DEBITO_WALLET_CODE,
      amount: parseFloat(payload.amount), // Número, não string
      currency: "MZN",
      source: "gateway",
      source_id: payload.reference,
      phone: formattedPhone,
      customer_phone: formattedPhone,
      customer_name: payload.customer.name,
      customer_email: payload.customer.email,
      return_url: payload.return_url
    };

    console.log("Enviando para Debito:", debitoPayload);

    const response = await fetch(DEBITO_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DEBITO_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(debitoPayload)
    });

    const responseText = await response.text();
    console.log("Resposta bruta Debito:", responseText);
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Erro ao interpretar JSON Debito:", e.message);
      // Fallback to PaySuite se a resposta for inválida
      return await fallbackToPaySuite(payload, res);
    }

    if (!response.ok || !data.success) {
      console.error("Debito Error:", data);
      // Se for erro 500, tenta PaySuite como fallback
      if (response.status >= 500) {
        console.warn("Debito falhou (status 500). Tentando PaySuite como fallback.");
        return await fallbackToPaySuite(payload, res);
      }
      return res.status(response.status || 400).json(data);
    }

    // Sucesso
    return res.status(200).json(data);
  } catch (error) {
    console.error("Serverless Function Error:", error);
    return res.status(500).json({ error: "Internal Server Error", message: error.message, detail: error.stack });
  }
}

// Função de fallback para PaySuite (mantida conforme código já existente em checkoutip.html)
async function fallbackToPaySuite(originalPayload, res) {
  // Reutiliza a lógica de PaySuite já presente no frontend, mas versão simplificada aqui
  const paysuitePayload = {
    amount: originalPayload.amount,
    reference: originalPayload.reference,
    description: originalPayload.description,
    method: originalPayload.method,
    return_url: originalPayload.return_url,
    webhook_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook`,
    webhook_secret: process.env.WEBHOOK_SECRET,
    customer: {
      name: originalPayload.customer.name,
      phone: originalPayload.customer.phone,
      email: originalPayload.customer.email
    }
  };

  console.log("Fallback para PaySuite com payload:", paysuitePayload);

  const paysuiteResponse = await fetch(PAYSUITE_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${PAYSUITE_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(paysuitePayload)
  });

  const paysuiteData = await paysuiteResponse.json();
  if (!paysuiteResponse.ok || !paysuiteData.success) {
    console.error("PaySuite fallback error:", paysuiteData);
    return res.status(paysuiteResponse.status || 400).json(paysuiteData);
  }
  return res.status(200).json(paysuiteData);
}
