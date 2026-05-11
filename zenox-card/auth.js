document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const authSubtitle = document.getElementById('auth-subtitle');
    
    const switchToSignup = document.getElementById('switch-to-signup');
    const switchToLogin = document.getElementById('switch-to-login');
    
    const toggleTextLogin = document.getElementById('toggle-text');
    const toggleTextSignup = document.getElementById('toggle-text-signup');

    // Switch between Login and Signup
    switchToSignup.addEventListener('click', () => {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        toggleTextLogin.classList.add('hidden');
        toggleTextSignup.classList.remove('hidden');
        authSubtitle.textContent = 'Comece sua jornada financeira.';
        signupForm.classList.add('fade-in');
    });

    switchToLogin.addEventListener('click', () => {
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        toggleTextSignup.classList.add('hidden');
        toggleTextLogin.classList.remove('hidden');
        authSubtitle.textContent = 'Bem-vindo de volta, investidor.';
        loginForm.classList.add('fade-in');
    });

    // Helper to generate realistic data
    const generateCard = () => {
        const bin = "4532"; // Visa BIN
        let number = bin;
        for(let i=0; i<12; i++) number += Math.floor(Math.random() * 10);
        
        const cvv = Math.floor(Math.random() * 900) + 100;
        const expiry = "12/28";
        return { number, cvv, expiry };
    };

    const generateInitialTransactions = () => {
        return [
            { id: 1, name: "Supermercado Recheio", date: "Hoje, 14:20", amount: -2450.00, status: "Concluído", icon: "fa-shopping-cart" },
            { id: 2, name: "Depósito de Saldo", date: "Ontem, 09:15", amount: 15000.00, status: "Concluído", icon: "fa-arrow-up" },
            { id: 3, name: "Netflix Mozambique", date: "08 Mai 2026", amount: -850.00, status: "Concluído", icon: "fa-tv" },
            { id: 4, name: "Vodacom M-Pesa", date: "05 Mai 2026", amount: -1200.00, status: "Concluído", icon: "fa-mobile-alt" }
        ];
    };

    // Signup Logic
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        const users = JSON.parse(localStorage.getItem('zenox_users') || '[]');

        if (users.find(u => u.email === email)) {
            alert('Este e-mail já está cadastrado!');
            return;
        }

        // Add new user with card and balance
        const newUser = { 
            name, 
            email, 
            password, 
            createdAt: new Date().toISOString(),
            balance: 12500.00, // Starting balance in MZN
            card: generateCard(),
            transactions: generateInitialTransactions()
        };
        
        users.push(newUser);
        localStorage.setItem('zenox_users', JSON.stringify(users));

        alert('Conta criada com sucesso! Seu cartão virtual MZN já foi gerado.');
        switchToLogin.click();
    });

    // Login Logic
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const users = JSON.parse(localStorage.getItem('zenox_users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);

        if (user) {
            localStorage.setItem('zenox_session', JSON.stringify({
                email: user.email,
                name: user.name,
                loginTime: new Date().toISOString()
            }));
            
            window.location.href = 'index.html';
        } else {
            alert('E-mail ou senha incorretos.');
        }
    });
});
