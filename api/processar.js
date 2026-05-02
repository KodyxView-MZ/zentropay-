export default async function handler(req, res) {
    // Cabeçalhos CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const merchantId = "f2a41c3a-4ed7-482c-8d16-4fd9c376f9c8";
    const apiKey = "sk_sandbox_sM9q5NuDelfYwKSrV1xzORYoha0inrIq";

    try {
        const body = req.body;
        
        // Verificação básica se os dados chegaram
        if (!body || !body.customer) {
            throw new Error("Dados do cliente ausentes no corpo da requisição.");
        }

        const payload = {
            merchant_id: merchantId,
            service_code: (body.payment_method === 'mpesa') ? 'MPESA_C2B' : 'EMOLA_C2B',
            amount: parseFloat(body.amount),
            currency: 'MZN',
            payment_method: body.payment_method,
            reference: body.reference,
            description: body.description,
            customer: body.customer
        };

        const apiRes = await fetch("https://debito.co.mz/v1/transactions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'X-Merchant-Id': merchantId
            },
            body: JSON.stringify(payload)
        });

        const result = await apiRes.json();
        
        // Se a API da Debito retornar erro, repassamos o erro dela
        if (!apiRes.ok) {
            return res.status(apiRes.status).json({ 
                message: result.message || "Erro na API da Débito" 
            });
        }

        return res.status(200).json(result);

    } catch (error) {
        // Isso ajuda a debugar nos Logs da Vercel
        console.error("DETALHE DO ERRO:", error.message);
        return res.status(500).json({ 
            status: "error", 
            message: error.message 
        });
    }
}
