<?php
$ch = curl_init('https://r02-ls.thesettlersonline.ru/');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_HEADER, true);
$res = curl_exec($ch);
echo "Result:\n" . substr($res, 0, 500) . "\n";
