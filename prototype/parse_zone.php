<?php
require_once 'vendor/autoload.php';

$data = file_get_contents('debug_zone.amf');

try {
    $inputStream = new SabreAMF_InputStream($data);
    $message = new SabreAMF_Message();
    $message->deserialize($inputStream);
    $result = $message;
    
    // Dump structure summary to see what we got
    $out = "Parsed Successfully!\n";
    $out .= "Type: " . gettype($result) . "\n";
    
    file_put_contents('debug_zone_parsed.txt', print_r($result, true));
    echo "Saved to debug_zone_parsed.txt";
    
} catch (Exception $e) {
    echo "Error parsing: " . $e->getMessage();
}
