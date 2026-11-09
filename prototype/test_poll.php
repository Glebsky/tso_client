<?php
$params = json_decode(file_get_contents('debug_flash_vars.json'), true);
$lsUrl = $params['bb'] ?? 'https://r02-ls.thesettlersonline.ru/';
$amfServerUrl = "";

$maxRetries = 20;
for ($i = 0; $i < $maxRetries; $i++) {
    $ch_ls = curl_init();
    curl_setopt($ch_ls, CURLOPT_URL, rtrim($lsUrl, '/') . "/Z" . (time() * 1000));
    curl_setopt($ch_ls, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch_ls, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch_ls, CURLOPT_POST, true);
    
    $data = http_build_query([
        'zoneID' => 0,
        'DSOAUTHTOKEN' => $params['dsoAuthToken'],
        'DSOAUTHUSER' => $params['dsoAuthUser']
    ]);
    curl_setopt($ch_ls, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch_ls, CURLOPT_COOKIEFILE, __DIR__ . '/cookies.txt');
    curl_setopt($ch_ls, CURLOPT_HTTPHEADER, [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Referer: ' . $lsUrl,
        'Origin: ' . rtrim($lsUrl, '/')
    ]);
    
    $lsRes = curl_exec($ch_ls);
    $lsStatus = curl_getinfo($ch_ls, CURLINFO_HTTP_CODE);
    curl_close($ch_ls);
    
    echo "Attempt $i: Status $lsStatus, Resp $lsRes\n";
    
    if ($lsStatus != 202) {
        $amfServerUrl = str_replace(":123443", "", trim($lsRes));
        break;
    }
    sleep(2);
}

echo "AMF URL: $amfServerUrl\n";
