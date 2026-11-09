<?php
$ch = curl_init('https://www.thesettlersonline.ru/amf/');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_POST, true);
$amfBody = file_get_contents('debug_zone_req.amf');
if (!$amfBody) $amfBody = pack('n', 3) . pack('n', 0) . pack('n', 0);
curl_setopt($ch, CURLOPT_POSTFIELDS, $amfBody);
curl_setopt($ch, CURLOPT_COOKIEFILE, __DIR__ . '/cookies.txt');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/x-amf',
    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Referer: https://r02-ls.thesettlersonline.ru/',
    'Origin: https://r02-ls.thesettlersonline.ru',
    'X-Requested-With: ShockwaveFlash/32.0.0.465',
    'Accept: */*'
]);
curl_setopt($ch, CURLINFO_HEADER_OUT, true);
curl_setopt($ch, CURLOPT_HEADER, true);
$res = curl_exec($ch);
$info = curl_getinfo($ch);
$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$header = substr($res, 0, $header_size);
$body = substr($res, $header_size);
echo "Req Headers:\n" . $info['request_header'] . "\n";
echo "Res Headers:\n" . $header . "\n";
echo "Status: " . $info['http_code'] . "\n";
echo "Size: " . strlen($body) . "\n";
echo "First 20: " . bin2hex(substr($body, 0, 20)) . "\n";
if ($info['http_code'] == 301 || $info['http_code'] == 302) {
    echo "Redirect: " . curl_getinfo($ch, CURLINFO_REDIRECT_URL) . "\n";
}
