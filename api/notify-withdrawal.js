import { Resend } from 'resend';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const { email, nome, valor, metodo, dados_carteira } = req.body;
    console.log("📨 [Serverless] Solicitação de e-mail de saque:", { email, valor });

    if (!email || !valor) {
        return res.status(400).json({ error: 'Dados insuficientes' });
    }

    const resend = new Resend(process.env.RESEND_API_KEY || "re_UaA6Rucy_H8mnicg5TTBRjdUFZymypwxu");

    try {
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

        console.log("✅ [Serverless] E-mail enviado para:", email);
        return res.status(200).json({ success: true, message: 'E-mail de saque enviado' });
    } catch (error) {
        console.error("Erro ao enviar e-mail de saque:", error);
        return res.status(500).json({ error: 'Erro ao enviar e-mail' });
    }
}
