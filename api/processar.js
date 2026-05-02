export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

        const merchantId = "f2a41c3a-4ed7-482c-8d16-4fd9c376f9c8";
        const apiKey = "sk_sandbox_sM9q5NuDelfYwKSrV1xzORYoha0inrIq";

        // Formatação do telefone para garantir o 258
        let phone = body.customer.phone.replace(/\s/g, '');
        if (!phone.startsWith('258')) phone = '258' + phone;

        const payload = {
            merchant_id: merchantId,
            service_code: (body.payment_method === 'mpesa') ? 'MPESA_C2B' : 'EMOLA_C2B',
            amount: parseFloat(body.amount),
            currency: 'MZN',
            payment_method: body.payment_method,
            reference: body.reference || `ZNP-${Date.now()}`,
            description: body.description || "Pagamento ZentroPay",
            customer: {
                name: body.customer.name,
                email: body.customer.email,
                phone: phone
            }
        };

        // Adicionamos um timeout e um cabeçalho de User-Agent para a API não bloquear a Vercel
        const response = await fetch("https://api.debito.co.mz/v1/transactions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'X-Merchant-Id': merchantId,
                'User-Agent': 'VantixTech/1.0'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000) // 10 segundos de espera
        });

        const result = await response.json();
        return res.status(response.status).json(result);

    } catch (error) {
        console.error("FALHA NA CONEXÃO:", error.message);
        
        // Resposta amigável para o erro "fetch failed"
        return res.status(500).json({ 
            status: "error", 
            message: "A API da operadora (M-Pesa/e-Mola) não respondeu. Tente novamente em instantes." 
        });
    }
}
