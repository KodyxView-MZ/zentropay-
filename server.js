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
const PORT = process.env.PORT || 3000;

// Configurar o parser para JSON
app.use(express.json());

// Servir arquivos estáticos (HTML, CSS, JS, Imagens)
app.use(express.static(path.join(__dirname)));

// ---------- ROTA: API PAY ----------
app.post('/api/pay', async (req, res) => {
    console.log("Recebido pedido de pagamento:", req.body);

    try {
        const payload = req.body;
        const DEBITO_API_KEY = process.env.DEBITO_API_KEY || "sk_live_ItHJ7fJQT5BL4vlqzqwwTjEYhx3ZuROg";
        const DEBITO_MERCHANT_ID = process.env.DEBITO_MERCHANT_ID || "f2a41c3a-4ed7-482c-8d16-4fd9c376f9c8";

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

        const debitoPayload = {
            action: "process",
            payment_method: payload.method,
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

        return res.status(200).json(data);
    } catch (error) {
        console.error('Local Server Error (api/pay):', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});

// ---------- ROTA: WEBHOOK ----------
app.post('/api/webhook', async (req, res) => {
    console.log("Webhook recebido localmente:", req.body);

    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "whsec_eec693e8334351177963120cd7ad6c7a8ab658a3908cd3f5cb195180296e1eb5";
    const SUPABASE_URL = "https://pbxufurblxmbzflaiqmh.supabase.co";
    const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBieHVmdXJibHhtYnpmbGFpcW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MDY5MjcsImV4cCI6MjA5MzE4MjkyN30.wDSSnT4QWm1HK9dQDcXutyM271Qsg5kmFqQZFytA4pA";

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    try {
        const paymentData = req.body;
        const isDebito = paymentData.event !== undefined && paymentData.data !== undefined;

        let reference, status;

        if (isDebito) {
            status = paymentData.event === 'payment.completed' ? 'completed' : 'failed';
            reference = paymentData.data.source_id || paymentData.data.payment_id || paymentData.data.reference;
        } else {
            reference = paymentData.reference;
            status = paymentData.status;
        }

        if (status === 'completed' || status === 'success' || status === 'paid') {
            const { data: pedido, error: pedidoError } = await supabase
                .from('pedidos')
                .select('*, produtos(*)')
                .eq('transaction_id', reference)
                .single();

            if (pedidoError || !pedido) {
                console.error("Pedido não encontrado:", reference);
                return res.status(404).json({ error: 'Pedido não encontrado' });
            }

            const taxa_plataforma = pedido.valor * 0.10;
            const valor_liquido = pedido.valor - taxa_plataforma;

            const venda = {
                vendedor_id: pedido.produtos?.vendedor_id || null,
                produto_id: pedido.produto_id,
                cliente_nome: pedido.cliente_nome,
                cliente_email: pedido.cliente_email,
                cliente_telefone: pedido.cliente_telefone,
                valor_total: pedido.valor,
                valor_liquido: valor_liquido,
                metodo_pagamento: pedido.metodo_pagamento,
                status_venda: 'sucesso',
                transaction_id: reference,
                criado_em: new Date().toISOString(),
                pago_em: new Date().toISOString()
            };

            await supabase.from('vendas').insert([venda]);
            await supabase.from('pedidos').update({ status: 'pago' }).eq('transaction_id', reference);

            console.log("✅ Venda registada com sucesso localmente!");
            return res.status(200).json({ success: true });
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Erro no webhook local:", error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR ZENTROPAY RODANDO!\n`);
    console.log(`🔗 Checkout: http://localhost:${PORT}/checkoutip.html`);
    console.log(`🔗 Dashboard: http://localhost:${PORT}/infoproductos.html`);
    console.log(`\nUse o atalho F5 no VS Code para iniciar.\n`);
});
