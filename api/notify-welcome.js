import { Resend } from 'resend';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, nome } = req.body;
    const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_UaA6Rucy_H8mnicg5TTBRjdUFZymypwxu";

    try {
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

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Erro no Servidor (Welcome Email):", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
