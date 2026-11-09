<?php
$ch = curl_init('https://r02-ls.thesettlersonline.ru/Z' . (time() * 1000));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_POST, true);
$data = http_build_query([
    'zoneID' => 0,
    'DSOAUTHTOKEN' => 'KdgfpHWm5zRjpz6jKVrRMZQYTacASUJd',
    'DSOAUTHUSER' => '1601416'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_COOKIEFILE, __DIR__ . '/cookies.txt');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Referer: https://r02-ls.thesettlersonline.ru/',
    'Origin: https://r02-ls.thesettlersonline.ru'
]);
$res = curl_exec($ch);
echo "Status: " . curl_getinfo($ch, CURLINFO_HTTP_CODE) . "\n";
echo "Response: " . $res . "\n";
