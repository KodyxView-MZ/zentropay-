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
        // Nota: Ajustar URL se a Debito mudar o endpoint de status
        const DEBITO_API_URL = `https://gyqoaningqhurhvdugne.supabase.co/functions/v1/payment-orchestrator?action=status&reference=${reference}`;

        const response = await fetch(DEBITO_API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${DEBITO_API_KEY}`,
                'Accept': 'application/json'
            }
        });

        const data = await response.json();
        console.log(`📥 Resposta Status (${reference}):`, data);

        if (data.success && (data.status === 'completed' || data.status === 'success' || data.status === 'paid')) {
            const SUPABASE_URL = "https://pbxufurblxmbzflaiqmh.supabase.co";
            const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBieHVmdXJibHhtYnpmbGFpcW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MDY5MjcsImV4cCI6MjA5MzE4MjkyN30.wDSSnT4QWm1HK9dQDcXutyM271Qsg5kmFqQZFytA4pA";
            const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

            await supabase.from('pedidos').update({ status: 'pago' }).eq('transaction_id', reference);
            return res.json({ success: true, status: 'pago' });
        }

        res.json({ success: true, status: data.status || 'pending' });
    } catch (error) {
        console.error("Erro ao verificar status:", error);
        res.status(500).json({ error: 'Erro ao verificar status' });
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
        console.log("📦 Payload recebido do Webhook:", JSON.stringify(paymentData));

        const isDebito = paymentData.event !== undefined || paymentData.data !== undefined;

        let reference, status;

        if (isDebito) {
            // Debito Pay pode enviar 'payment.completed' ou vir dentro de data.status
            status = paymentData.event === 'payment.completed' || paymentData.data?.status === 'completed' || paymentData.status === 'success' ? 'completed' : 'failed';
            reference = paymentData.data?.source_id || paymentData.data?.payment_id || paymentData.reference || paymentData.data?.reference;
        } else {
            reference = paymentData.reference;
            status = paymentData.status;
        }

        console.log(`🔍 Processando Webhook - Ref: ${reference} | Status: ${status}`);

        if (status === 'completed' || status === 'success' || status === 'paid' || status === 'pago') {
            // 1. ATUALIZAR STATUS NO PEDIDO IMEDIATAMENTE (Prioridade)
            await supabase.from('pedidos').update({ status: 'pago' }).eq('transaction_id', reference);
            console.log("✅ Tabela 'pedidos' atualizada para 'pago'.");

            // 2. BUSCAR DADOS COMPLETOS PARA NOTIFICAÇÃO E VENDA
            const { data: pedido, error: pedidoError } = await supabase
                .from('pedidos')
                .select('*, produtos(*)')
                .eq('transaction_id', reference)
                .single();

            if (pedidoError || !pedido) {
                console.error("⚠️ Pedido não encontrado para processamento de venda:", reference);
                return res.status(200).json({ received: true, warning: "Pedido não encontrado no banco" });
            }

            const taxa_plataforma = pedido.valor * 0.10;
            const valor_liquido = pedido.valor - taxa_plataforma;

            // Se o join falhou, buscar o vendedor na mão
            let vendedor_id = pedido.produtos?.vendedor_id;
            if (!vendedor_id && pedido.produto_id) {
                const { data: prodData } = await supabase.from('produtos').select('vendedor_id').eq('id', pedido.produto_id).single();
                vendedor_id = prodData?.vendedor_id;
            }

            const venda = {
                vendedor_id: vendedor_id || null,
                produto_id: pedido.produto_id,
                cliente_nome: pedido.cliente_nome,
                cliente_email: pedido.cliente_email,
                cliente_telefone: pedido.cliente_telefone,
                valor_total: pedido.valor,
                valor_liquido: valor_liquido,
                metodo_pagamento: pedido.metodo_pagamento || 'debito',
                status_venda: 'sucesso',
                transaction_id: reference,
                criado_em: new Date().toISOString(),
                pago_em: new Date().toISOString()
            };

            await supabase.from('vendas').insert([venda]);

            // --- ENVIO DE E-MAIL VIA RESEND ---
            const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_123456789";
            try {
                const { Resend } = await import('resend');
                const resend = new Resend(RESEND_API_KEY);

                // Buscar email do vendedor
                const { data: vendedor } = await supabase
                    .from('usuarios')
                    .select('email, nome')
                    .eq('id', venda.vendedor_id)
                    .single();

                if (vendedor && vendedor['email']) {
                    await resend.emails.send({
                        from: 'ZentroPay <onboarding@resend.dev>',
                        to: vendedor.email,
                        subject: `🎉 Nova Venda Realizada: ${pedido.produtos?.nome}`,
                        html: `
                            <div style="font-family: sans-serif; color: #333;">
                                <h2>Parabéns, ${vendedor.nome}!</h2>
                                <p>Você acaba de realizar uma nova venda na ZentroPay.</p>
                                <hr>
                                <p><strong>Produto:</strong> ${pedido.produtos?.nome}</p>
                                <p><strong>Valor Total:</strong> MT ${venda.valor_total.toLocaleString()}</p>
                                <p><strong>Seu Lucro (Líquido):</strong> MT ${venda.valor_liquido.toLocaleString()}</p>
                                <hr>
                                <p><strong>Cliente:</strong> ${venda.cliente_nome}</p>
                                <p><strong>Método:</strong> ${venda.metodo_pagamento.toUpperCase()}</p>
                                <br>
                                <p>Continue com o excelente trabalho!</p>
                                <p style="font-size: 12px; color: #999;">Equipa ZentroPay</p>
                            </div>
                        `
                    });
                    console.log("📧 E-mail de notificação enviado para:", vendedor['email']);
                }
            } catch (emailErr) {
                console.error("⚠️ Erro ao enviar email no server.js (Resend):", emailErr.message);
            }

            await supabase.from('pedidos').update({ status: 'pago' }).eq('transaction_id', reference);
            console.log("✅ Venda registada com sucesso localmente!");
            return res.status(200).json({ success: true });
        } else {
            // NOVO: Se o pagamento falhou ou foi cancelado, atualizar o status no banco
            console.log(`❌ Pagamento falhou para a referência: ${reference}`);
            await supabase.from('pedidos').update({ status: 'falhou' }).eq('transaction_id', reference);
        }
        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Erro no webhook local:", error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// ---------- ROTA: ATUALIZAR STATUS (ADMIN) ----------
app.post('/api/admin/update-status', async (req, res) => {
    const { table, id, status } = req.body;
    console.log(`[Admin API] Atualizando ${table} ID: ${id} para Status: ${status}`);

    const SUPABASE_URL = "https://pbxufurblxmbzflaiqmh.supabase.co";
    const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBieHVmdXJibHhtYnpmbGFpcW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MDY5MjcsImV4cCI6MjA5MzE4MjkyN30.wDSSnT4QWm1HK9dQDcXutyM271Qsg5kmFqQZFytA4pA";
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);

    try {
        // Usamos .select() para confirmar se a linha foi realmente alterada
        const { data, error } = await supabaseAdmin
            .from(table)
            .update({ status: status })
            .eq('id', id)
            .select();

        if (error) {
            console.error("Erro Supabase Admin:", error.message);
            return res.status(500).json({ error: error.message });
        }

        if (!data || data.length === 0) {
            console.warn("⚠️ Nenhuma linha atualizada. Verifique se a chave no .env é a 'service_role'.");
            return res.status(403).json({ 
                error: "Permissão Negada", 
                detail: "O Supabase não permitiu a alteração. Use a chave 'service_role' no seu ficheiro .env para ter permissões de admin." 
            });
        }

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use(express.static(path.join(__dirname)));

// ---------- ROTA: NOTIFICAÇÃO DE SAQUE ----------
app.post('/api/notify-withdrawal', async (req, res) => {
    console.log("📨 Solicitação de email de saque recebida:", req.body);
    const { email, nome, valor, metodo, dados_carteira } = req.body;
    const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_UaA6Rucy_H8mnicg5TTBRjdUFZymypwxu";

    try {
        const { Resend } = await import('resend');
        const resend = new Resend(RESEND_API_KEY);

        await resend.emails.send({
            from: 'ZentroPay <onboarding@resend.dev>',
            to: email,
            subject: '💰 Saque Solicitado - ZentroPay',
            html: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #a855f7;">Olá, ${nome || 'Vendedor'}!</h2>
                    <p>Recebemos o seu pedido de saque na plataforma ZentroPay.</p>
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Valor Solicitado:</strong> MT ${parseFloat(valor).toLocaleString()}</p>
                        <p><strong>Método:</strong> ${metodo.toUpperCase()}</p>
                        <p><strong>Destino:</strong> ${dados_carteira}</p>
                        <p><strong>Status:</strong> <span style="color: #f59e0b; font-weight: bold;">PENDENTE</span></p>
                    </div>
                    <p>O nosso departamento financeiro irá analisar o seu pedido e o pagamento será processado em breve.</p>
                    <hr style="border: none; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #999; text-align: center;">ZentroPay - O seu ecossistema de pagamentos</p>
                </div>
            `
        });
        console.log("✅ E-mail de saque enviado com sucesso para:", email);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Erro ao enviar email de saque local:", error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// ---------- ROTA: NOTIFICAÇÃO DE BEM-VINDO ----------
app.post('/api/notify-welcome', async (req, res) => {
    const { email, nome } = req.body;
    const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_UaA6Rucy_H8mnicg5TTBRjdUFZymypwxu";

    try {
        const { Resend } = await import('resend');
        const resend = new Resend(RESEND_API_KEY);

        await resend.emails.send({
            from: 'ZentroPay <onboarding@resend.dev>',
            to: email,
            subject: '🚀 Bem-vindo à ZentroPay!',
            html: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; background-color: #fcfcfc;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #a855f7;">Bem-vindo à ZentroPay!</h1>
                    </div>
                    <p>Olá, <strong>${nome || 'Vendedor'}</strong>!</p>
                    <p>É um prazer ter você connosco. A ZentroPay foi criada para simplificar os seus recebimentos e ajudar o seu negócio a crescer.</p>
                    <div style="background: #ffffff; border-left: 4px solid #a855f7; padding: 15px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <p style="margin: 0;"><strong>O que você pode fazer agora:</strong></p>
                        <ul style="margin-top: 10px;">
                            <li>Cadastrar seus primeiros produtos</li>
                            <li>Configurar seus métodos de recebimento (M-Pesa/e-Mola)</li>
                            <li>Acompanhar suas vendas em tempo real</li>
                        </ul>
                    </div>
                    <p>Se precisar de qualquer ajuda, a nossa equipe de suporte está à sua disposição.</p>
                    <br>
                    <div style="text-align: center;">
                        <a href="https://zentropay.digital/dashboard.html" style="background-color: #a855f7; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Aceder ao Painel</a>
                    </div>
                    <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
                    <p style="font-size: 12px; color: #999; text-align: center;">ZentroPay - O seu ecossistema de pagamentos</p>
                </div>
            `
        });
        console.log("📧 E-mail de boas-vindas enviado para:", email);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Erro ao enviar email de boas-vindas:", error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR ZENTROPAY RODANDO NA PORTA ${PORT}!\n`);
    console.log(`🔗 Checkout: http://localhost:${PORT}/checkoutip.html`);
    console.log(`🔗 Dashboard: http://localhost:${PORT}/infoproductos.html`);
});
