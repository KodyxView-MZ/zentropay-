export default async function handler(req, res) {
    // 1. Headers para evitar bloqueios
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { amount, payment_method, customer, reference, description } = req.body;

        // 2. Validação e Formatação do Telefone (Essencial para Moçambique)
        let phone = customer.phone.replace(/\s/g, '');
        if (!phone.startsWith('258')) {
            phone = '258' + phone; // Garante que tem o código do país
        }

        const merchantId = "f2a41c3a-4ed7-482c-8d16-4fd9c376f9c8";
        const apiKey = "sk_sandbox_sM9q5NuDelfYwKSrV1xzORYoha0inrIq";

        // 3. Montagem do Payload conforme a documentação técnica
        const payload = {
            merchant_id: merchantId,
            service_code: (payment_method === 'mpesa') ? 'MPESA_C2B' : 'EMOLA_C2B',
            amount: parseFloat(amount),
            currency: 'MZN',
            payment_method: payment_method,
            reference: reference || `ZNP-${Date.now()}`,
            description: description || "Pagamento ZentroPay",
            customer: {
                name: customer.name,
                email: customer.email,
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

        // 4. Retorna a resposta da operadora (M-Pesa/e-Mola)
        return res.status(response.status).json(result);

    } catch (error) {
        console.error("ERRO CRÍTICO:", error.message);
        return res.status(500).json({ status: "error", message: error.message });
    }
}
