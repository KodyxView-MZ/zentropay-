<?php
// Configurações de exibição de erros (importante para não quebrar o JSON)
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// 1. Configurações da Debito Pay
$merchantId = "f2a41c3a-4ed7-482c-8d16-4fd9c376f9c8";
$apiKey = "sk_sandbox_sM9q5NuDelfYwKSrV1xzORYoha0inrIq";
$apiUrl = "https://api.debito.co.mz/v1/transactions";

try {
    // 2. Captura e validação dos dados
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!$data) {
        throw new Exception('Dados de entrada inválidos ou vazios.');
    }

    // Define o código de serviço conforme documentação
    $serviceCode = ($data['payment_method'] === 'mpesa') ? 'MPESA_C2B' : 'EMOLA_C2B';

    // 3. Montagem do Payload oficial
    $payload = [
        'merchant_id'    => $merchantId,
        'service_code'   => $serviceCode,
        'amount'         => (float)$data['amount'],
        'currency'       => 'MZN',
        'payment_method' => $data['payment_method'],
        'reference'      => $data['reference'],
        'description'    => $data['description'],
        'customer'       => [
            'name'  => $data['customer']['name'],
            'email' => $data['customer']['email'],
            'phone' => $data['customer']['phone']
        ]
    ];

    // 4. Execução do CURL
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
        throw new Exception("Erro na conexão com a API: " . $curlError);
    }

    // Retorna a resposta exatamente como a API enviou
    http_response_code($httpCode);
    echo $response;

} catch (Exception $e) {
    // Caso algo falhe, garante que o retorno seja um JSON válido
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
?>
