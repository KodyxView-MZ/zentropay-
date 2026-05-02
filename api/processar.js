export default async function handler(req, res) {
    // Configuração de CORS para permitir que o site fale com a API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ message: "Apenas POST permitido" });
    }

    try {
        // GARANTIA: Se o body vier como string, a gente transforma em objeto
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

        if (!body || !body.customer) {
            throw new Error("Dados do formulário não foram recebidos corretamente.");
        }

        // Formatação do Telefone (Essencial: Adiciona 258 se não tiver)
        let phone = body.customer.phone.replace(/\s/g, '');
        if (!phone.startsWith('258')) phone = '258' + phone;

        const merchantId = "f2a41c3a-4ed7-482c-8d16-4fd9c376f9c8";
        const apiKey = "sk_sandbox_sM9q5NuDelfYwKSrV1xzORYoha0inrIq";

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

        const response = await fetch("https://api.debito.co.mz/v1/transactions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'X-Merchant-Id': merchantId
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        return res.status(response.status).json(result);

    } catch (error) {
        console.error("ERRO NO BACKEND:", error.message);
        return res.status(500).json({ 
            status: "error", 
            message: "Erro interno: " + error.message 
        });
    }
}

