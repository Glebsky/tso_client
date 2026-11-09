<?php
$ch = curl_init('https://www.thesettlersonline.ru/ru/play');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_COOKIEFILE, __DIR__ . '/cookies.txt');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
]);
$res = curl_exec($ch);
echo 'Status: ' . curl_getinfo($ch, CURLINFO_HTTP_CODE) . "\n";
if (strpos($res, 'dsoAuthToken') !== false) {
    echo 'AUTH OK!';
} else {
    echo 'AUTH FAILED';
}
