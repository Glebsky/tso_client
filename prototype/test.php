<?php
require_once 'config.php';
require_once 'amf.php';

$params = [
    'dsoAuthToken' => 'iF5PB8sbJIEAvNboOmIlcrU3843pX4F9',
    'dsoAuthUser' => '1601416',
    'bburl' => 'https://r02-ls.thesettlersonline.ru/',
    'zoneId' => null
];

$call = new defaultGame_Communication_VO_dServerCall();
$call->type = $COMMANDS['GET_ZONE']; // 1001
$call->zoneID = (int)$params['dsoAuthUser']; 
$call->dsoAuthUser = (int)$params['dsoAuthUser'];
$call->dsoAuthToken = $params['dsoAuthToken'];
$call->dsoAuthRandomClientID = 1;
$call->data = false;

$amfServerUrl = $params['bburl'] . "amf"; // Removed slash since bburl already has it

$client = new TsoAmfClient($amfServerUrl);
try {
    $rawResponse = $client->sendCommand($call);
    file_put_contents('debug_test.amf', $rawResponse);
    echo "Success! Response size: " . strlen($rawResponse) . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
