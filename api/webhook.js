// api/webhook.js
import crypto from 'crypto';

const WEBHOOK_SECRET = "whsec_eec693e8334351177963120cd7ad6c7a8ab658a3908cd3f5cb195180296e1eb5";

export default async function handler(req, res) {
    // Permitir apenas POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    // VERIFICAR ASSINATURA DO WEBHOOK (segurança)
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
        console.warn("⚠️ Webhook sem assinatura - verificar se o PaySuite está a enviar");
    }

    const SUPABASE_URL = "https://pbxufurblxmbzflaiqmh.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBieHVmdXJibHhtYnpmbGFpcW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MDY5MjcsImV4cCI6MjA5MzE4MjkyN30.wDSSnT4QWm1HK9dQDcXutyM271Qsg5kmFqQZFytA4pA";
    
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    try {
        const paymentData = req.body;
        console.log("Webhook recebido:", paymentData);

        // Identificar se o webhook é da Debito Pay ou PaySuite
        const isDebito = paymentData.event !== undefined && paymentData.data !== undefined;
        
        let reference, status, amount, method;

        if (isDebito) {
            // Formato Debito.co.mz
            status = paymentData.event === 'payment.completed' ? 'completed' : 'failed';
            // Usa o source_id se a Debito retornar, ou o próprio payment_id / reference
            reference = paymentData.data.source_id || paymentData.data.payment_id || paymentData.data.reference;
            amount = paymentData.data.amount;
            method = paymentData.data.method || paymentData.data.payment_method;
        } else {
            // Formato Antigo (PaySuite)
            reference = paymentData.reference;
            status = paymentData.status;
            amount = paymentData.amount;
            method = paymentData.method;
        }
        
        // Se o pagamento foi bem sucedido
        if (status === 'completed' || status === 'success' || status === 'paid') {
            // Buscar o pedido pendente
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

            // Registrar na tabela vendas
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

            const { error: vendaError } = await supabase.from('vendas').insert([venda]);
            
            if (vendaError) {
                console.error("Erro ao salvar venda:", vendaError);
                return res.status(500).json({ error: 'Erro ao salvar venda' });
            }

            // Atualizar pedido para pago
            await supabase.from('pedidos').update({ status: 'pago' }).eq('transaction_id', reference);

            console.log("✅ Venda registada com sucesso via webhook!");
            return res.status(200).json({ success: true });
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Erro no webhook:", error);
        res.status(500).json({ error: 'Erro interno' });
    }
}