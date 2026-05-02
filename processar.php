<?php
// Bloqueia qualquer erro de texto que possa corromper o JSON
ini_set('display_errors', 0);
header('Content-Type: application/json');

$merchantId = "f2a41c3a-4ed7-482c-8d16-4fd9c376f9c8";
$apiKey = "sk_sandbox_sM9q5NuDelfYwKSrV1xzORYoha0inrIq";
$apiUrl = "https://api.debito.co.mz/v1/transactions";

try {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!$data) {
        throw new Exception("Nenhum dado recebido pelo PHP.");
    }

    $serviceCode = ($data['payment_method'] === 'mpesa') ? 'MPESA_C2B' : 'EMOLA_C2B';

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
    
    if (curl_errno($ch)) {
        throw new Exception("CURL Error: " . curl_error($ch));
    }
    curl_close($ch);

    // Se a API retornar vazio, criamos nossa própria mensagem de erro
    if (empty($response)) {
        http_response_code(500);
        echo json_encode(["message" => "API da Debito Pay retornou uma resposta vazia (HTTP $httpCode)"]);
    } else {
        http_response_code($httpCode);
        echo $response;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Erro interno: " . $e->getMessage()]);
}
?>
