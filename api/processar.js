export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Bloqueia se não for POST (evita o erro que apareceu no seu print)
    if (req.method !== 'POST') {
        return res.status(405).json({ status: "error", message: "Use POST para enviar dados." });
    }

    try {
        const data = req.body;

        // Validação de segurança
        if (!data || !data.customer || !data.amount) {
            return res.status(400).json({ status: "error", message: "Dados incompletos." });
        }

        // Formatação do telefone para Moçambique (essencial)
        let phone = data.customer.phone.replace(/\s/g, '');
        if (!phone.startsWith('258')) {
            phone = '258' + phone;
        }

        const merchantId = "f2a41c3a-4ed7-482c-8d16-4fd9c376f9c8";
        const apiKey = "sk_sandbox_sM9q5NuDelfYwKSrV1xzORYoha0inrIq";

        const payload = {
            merchant_id: merchantId,
            service_code: (data.payment_method === 'mpesa') ? 'MPESA_C2B' : 'EMOLA_C2B',
            amount: parseFloat(data.amount),
            currency: 'MZN',
            payment_method: data.payment_method,
            reference: data.reference,
            description: data.description,
            customer: {
                name: data.customer.name,
                email: data.customer.email,
                phone: phone
            }
        };

        const response = await fetch("https://debito.co.mz/v1/transactions", {
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
        return res.status(500).json({ status: "error", message: error.message });
    }
}
