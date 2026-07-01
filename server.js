import express from 'express';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Configurar o parser para JSON
app.use(express.json());

// Servir arquivos estáticos (HTML, CSS, JS, Imagens)
app.use(express.static(path.join(__dirname)));

// ---------- ROTA: API PAY ----------
app.post('/api/pay', async (req, res) => {
    console.log("Recebido pedido de pagamento:", req.body);

    try {
        const payload = req.body;

        // BUG FIX: validação básica de campos obrigatórios
        if (!payload || !payload.method || !payload.amount || !payload.customer) {
            return res.status(400).json({ error: "Campos obrigatórios em falta: method, amount, customer." });
        }

        const DEBITO_API_KEY = process.env.DEBITO_API_KEY || "sk_live_ItHJ7fJQT5BL4vlqzqwwTjEYhx3ZuROg";
        const DEBITO_MERCHANT_ID = process.env.DEBITO_MERCHANT_ID || "f2a41c3a-4ed7-482c-8d16-4fd9c376f9c8";

        const WALLET_CODES = {
            "mpesa": "28409",
            "emola": "26724",
            "mkesh": "58843",
            "visa_mastercard": "21544"
        };

        const DEBITO_WALLET_CODE = WALLET_CODES[payload.method];

        if (!DEBITO_WALLET_CODE) {
            return res.status(400).json({ error: "Método de pagamento inválido ou carteira não configurada." });
        }

        const DEBITO_API_URL = "https://gyqoaningqhurhvdugne.supabase.co/functions/v1/payment-orchestrator";

        // Formatar Telefone conforme o método
        const rawPhone = payload.customer.phone || '';
        // BUG FIX (api/pay.js): remover caracteres não numéricos antes de verificar prefixo
        let formattedPhone = rawPhone.replace(/\D/g, '');
        if (!formattedPhone.startsWith('258') && formattedPhone.length === 9) {
            formattedPhone = '258' + formattedPhone;
        }

        // M-Pesa exige o prefixo '+' conforme documentação
        if (payload.method === 'mpesa' && !formattedPhone.startsWith('+')) {
            formattedPhone = '+' + formattedPhone;
        }

        const debitoPayload = {
            action: "process",
            payment_method: payload.method,
            merchant_id: DEBITO_MERCHANT_ID,
            wallet_code: DEBITO_WALLET_CODE,
            amount: parseFloat(payload.amount),
            currency: "MZN",
            source: "gateway",
            source_id: payload.reference,
            phone: formattedPhone,
            customer_name: payload.customer.name,
            customer_email: payload.customer.email,
            customer_phone: formattedPhone,
            webhook_url: payload.webhook_url
        };

        console.log("📤 Enviando para Debito (Payload Completo):", debitoPayload);

        const response = await fetch(DEBITO_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DEBITO_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Idempotency-Key': payload.reference
            },
            body: JSON.stringify(debitoPayload)
        });

        const responseText = await response.text();
        console.log("Resposta bruta da Debito:", responseText);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error("Erro ao processar JSON da Debito:", e.message);
            return res.status(500).json({ error: "Resposta inválida da API de pagamento", detail: responseText });
        }

        if (!response.ok || !data.success) {
            console.error('Debito Error:', data);
            return res.status(response.status || 400).json(data);
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Local Server Error (api/pay):', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
        });
    }
});

// ---------- ROTA: VERIFICAR STATUS (SINCRO) ----------
app.get('/api/check-status/:reference', async (req, res) => {
    const { reference } = req.params;
    console.log(`🔍 Verificando status da transação: ${reference}`);

    try {
        const DEBITO_API_KEY = process.env.DEBITO_API_KEY || "sk_live_ItHJ7fJQT5BL4vlqzqwwTjEYhx3ZuROg";
        const DEBITO_API_URL = `https://gyqoaningqhurhvdugne.supabase.co/functions/v1/payment-orchestrator?action=status&reference=${reference}`;

        const response = await fetch(DEBITO_API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${DEBITO_API_KEY}`,
                'Accept': 'application/json'
            }
        });

        // BUG FIX: o código original terminava abruptamente com 'c' na linha 146.
        // Adicionado parse seguro e bloco Supabase completo.
        let data;
        try {
            data = await response.json();
        } catch (e) {
            return res.status(500).json({ error: "Resposta inválida da API de status", detail: e.message });
        }

        console.log(`📥 Resposta Status (${reference}):`, data);

        if (data.success && (data.status === 'completed' || data.status === 'success' || data.status === 'paid')) {
            const SUPABASE_URL = process.env.SUPABASE_URL || "https://slwodwkpfciakhxdbjko.supabase.co";
            const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_gpAdRCtp33UGfOV4NGd76A_GDb5ko-V";
            const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

            const { error: dbError } = await supabase
                .from('transactions')
                .update({ status: 'completed', updated_at: new Date().toISOString() })
                .eq('reference', reference);

            if (dbError) {
                console.error('Supabase update error:', dbError.message);
            } else {
                console.log(`✅ Transação ${reference} marcada como concluída no Supabase.`);
            }
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Local Server Error (check-status):', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
        });
    }
});

// ---------- ROTA: WEBHOOK RECEBIDO ----------
app.post('/api/webhook', async (req, res) => {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "whsec_eec693e8334351177963120cd7ad6c7a8ab658a3908cd3f5cb195180296e1eb5";
    const SUPABASE_URL = process.env.SUPABASE_URL || "https://slwodwkpfciakhxdbjko.supabase.co";
    const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_gpAdRCtp33UGfOV4NGd76A_GDb5ko-V";
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Verificar assinatura
    const signature = req.headers['x-webhook-signature'];
    if (signature) {
        const bodyString = JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHmac('sha256', WEBHOOK_SECRET)
            .update(bodyString)
            .digest('hex');

        if (signature !== expectedSignature) {
            console.error("Assinatura inválida!");
            return res.status(401).json({ error: 'Assinatura inválida' });
        }
        console.log("✅ Assinatura verificada com sucesso!");
    } else {
        console.warn("⚠️ Webhook sem assinatura.");
    }

    try {
        const paymentData = req.body;
        console.log("Webhook recebido:", paymentData);

        const isDebito = paymentData.event !== undefined && paymentData.data !== undefined;

        let reference, status, amount, method;

        if (isDebito) {
            status = paymentData.event === 'payment.completed' ? 'completed' : 'failed';
            reference = paymentData.data.source_id || paymentData.data.payment_id || paymentData.data.reference;
            amount = paymentData.data.amount;
            // BUG FIX (webhook.js): linha estava truncada com 'method = p', completado corretamente:
            method = paymentData.data.method || paymentData.data.payment_method;
        } else {
            // Formato Antigo (PaySuite)
            reference = paymentData.reference;
            status = paymentData.status;
            amount = paymentData.amount;
            method = paymentData.method;
        }

        if (!reference) {
            console.error("Webhook sem referência válida:", paymentData);
            return res.status(400).json({ error: "Referência de transação em falta." });
        }

        const { error: dbError } = await supabase
            .from('transactions')
            .update({
                status: status,
                amount: amount,
                method: method,
                updated_at: new Date().toISOString()
            })
            .eq('reference', reference);

        if (dbError) {
            console.error('Supabase webhook update error:', dbError.message);
            return res.status(500).json({ error: dbError.message });
        }

        console.log(`✅ Webhook processado: ${reference} → ${status}`);
        return res.status(200).json({ received: true, reference, status });
    } catch (error) {
        console.error('Webhook handler error:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 ZentroPay servidor iniciado na porta ${PORT}`);
});
