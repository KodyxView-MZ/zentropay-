// Este arquivo substitui o seu processar.php para funcionar na Vercel
export default async function handler(req, res) {
    // 1. Configurações de CORS (Para permitir que o seu HTML envie dados para aqui)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: "Apenas métodos POST são permitidos" });
    }

    // 2. Credenciais (As mesmas do seu PHP)
    const merchantId = "f2a41c3a-4ed7-482c-8d16-4fd9c376f9c8";
    const apiKey = "sk_sandbox_sM9q5NuDelfYwKSrV1xzORYoha0inrIq";
    const apiUrl = "https://api.debito.co.mz/v1/transactions";

    try {
        const body = req.body;

        // 3. Montar o Payload (Corpo da Requisição) conforme a documentação
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
                phone: body.customer.phone
            }
        };

        // 4. Enviar para a DebitoPay usando Fetch (Node.js nativo na Vercel)
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'X-Merchant-Id': merchantId
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        // 5. Retornar a resposta para o seu Frontend
        return res.status(response.status).json(result);

    } catch (error) {
        console.error("Erro no processamento:", error);
        return res.status(500).json({ 
            status: "error", 
            message: "Erro interno ao processar pagamento",
            details: error.message 
        });
    }
}

