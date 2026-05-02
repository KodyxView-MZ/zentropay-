<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Configurações extraídas da sua conta ZentroPay/DebitoPay
$merchantId = "f2a41c3a-4ed7-482c-8d16-4fd9c376f9c8";
$apiKey = "sk_sandbox_sM9q5NuDelfYwKSrV1xzORYoha0inrIq";
$apiUrl = "https://api.debito.co.mz/v1/transactions";

// Captura o envio do formulário
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Dados inválidos']);
    exit;
}

// Mapeamento de Service Codes conforme documentação Debito Pay
$serviceCode = ($data['payment_method'] === 'mpesa') ? 'MPESA_C2B' : 'EMOLA_C2B';

// Estrutura exata da API de Payments
$payload = [
    'merchant_id'    => $merchantId,
    'service_code'   => $serviceCode,
    'amount'         => (float)$data['amount'],
    'currency'       => 'MZN',
    'payment_method' => $data['payment_method'],
    'reference'      => $data['reference'],
    'description'    => $data['description'],
    'customer' => [
        'name'  => $data['customer']['name'],
        'email' => $data['customer']['email'],
        'phone' => $data['customer']['phone'] // Ex: 84XXXXXXX ou 86XXXXXXX
    ],
    // URL para onde a DebitoPay avisará quando o cliente digitar o PIN
    'callback_url' => 'https://' . $_SERVER['HTTP_HOST'] . '/webhook.php' 
];

$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $apiKey,
    'X-Merchant-Id: ' . $merchantId
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Erro de conexão: ' . $curlError]);
} else {
    http_response_code($httpCode);
    echo $response;
}
?>

