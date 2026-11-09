<?php
// Minimal AMF3 Encoder for TSO Headless Prototype

class Amf3Encoder {
    private $out = '';

    public function encode($data) {
        if (is_null($data)) {
            $this->out .= chr(0x01);
        } elseif (is_bool($data)) {
            $this->out .= $data ? chr(0x03) : chr(0x02);
        } elseif (is_int($data)) {
            if ($data >= -268435456 && $data <= 268435455) {
                $this->out .= chr(0x04);
                $this->writeU29($data);
            } else {
                $this->out .= chr(0x05);
                $this->writeDouble($data);
            }
        } elseif (is_float($data)) {
            $this->out .= chr(0x05);
            $this->writeDouble($data);
        } elseif (is_string($data)) {
            $this->out .= chr(0x06);
            $this->writeString($data);
        } elseif (is_array($data)) {
            // Assume strict array or associative
            if (array_keys($data) !== range(0, count($data) - 1)) {
                // Dictionary / associative array as dynamic object
                $this->out .= chr(0x0A);
                $this->out .= chr(0x0B); // dynamic, no class name, 0 sealed traits
                $this->writeString(""); // empty class name
                foreach ($data as $k => $v) {
                    $this->writeString((string)$k);
                    $this->encode($v);
                }

                $this->writeString(""); // end of dynamic traits
            } else {
                // Strict array
                $this->out .= chr(0x09);
                $this->writeU29((count($data) << 1) | 1);
                $this->writeString("");
                foreach ($data as $v) {
                    $this->encode($v);
                }
            }
        } elseif (is_object($data)) {
            $this->out .= chr(0x0A);
            $className = get_class($data);
            if ($className == 'stdClass') $className = '';
            
            // Hack for AS3 classes
            if (strpos($className, 'defaultGame_') === 0 || strpos($className, 'Communication_') === 0 || strpos($className, 'flex_messaging_') === 0) {
                $className = str_replace('_', '.', $className);
            }
            
            $props = get_object_vars($data);
            $propCount = count($props);
            
            // Format: (propCount << 4) | 0x03
            $this->writeU29(($propCount << 4) | 0x03);
            $this->writeString($className);
            
            foreach ($props as $k => $v) {
                $this->writeString((string)$k);
            }
            foreach ($props as $k => $v) {
                $this->encode($v);
            }
        }
    }

    private function writeU29($value) {
        $value = $value & 0x1FFFFFFF;
        if ($value < 0x80) {
            $this->out .= chr($value);
        } elseif ($value < 0x4000) {
            $this->out .= chr(($value >> 7 & 0x7F) | 0x80) . chr($value & 0x7F);
        } elseif ($value < 0x200000) {
            $this->out .= chr(($value >> 14 & 0x7F) | 0x80) . chr(($value >> 7 & 0x7F) | 0x80) . chr($value & 0x7F);
        } else {
            $this->out .= chr(($value >> 22 & 0x7F) | 0x80) . chr(($value >> 15 & 0x7F) | 0x80) . chr(($value >> 8 & 0x7F) | 0x80) . chr($value & 0xFF);
        }
    }

    private function writeDouble($value) {
        $this->out .= strrev(pack("d", $value)); // Big endian
    }

    private function writeString($value) {
        if ($value === "") {
            $this->out .= chr(0x01);
            return;
        }
        $len = strlen($value);
        $this->writeU29(($len << 1) | 1);
        $this->out .= $value;
    }

    public function getOutput() {
        return $this->out;
    }
}

// AMF0 Remoting Envelope wrapper
function wrapAmf0Remoting($targetUri, $responseUri, $amf3Body) {
    $out = "";
    // AMF0 Version 3
    $out .= pack("n", 3);
    
    // Headers length (0)
    $out .= pack("n", 0);
    
    // Bodies length (1)
    $out .= pack("n", 1);
    
    // Target URI
    $out .= pack("n", strlen($targetUri)) . $targetUri;
    
    // Response URI
    $out .= pack("n", strlen($responseUri)) . $responseUri;
    
    // Body length (-1)
    $out .= pack("N", 0xFFFFFFFF);
    
    // AMF0 marker for AMF3 content (0x11 = 17)
    $out .= chr(0x11);
    
    // AMF3 Content
    $out .= $amf3Body;
    
    return $out;
}

// Helper to get real AMF URL from Load Server
function getRealAmfUrl($bbUrl, $dsoAuthUser, $dsoAuthToken) {
    $lsUrl = $bbUrl;
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
            'DSOAUTHTOKEN' => $dsoAuthToken,
            'DSOAUTHUSER' => $dsoAuthUser
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
        
        if ($lsStatus != 202) {
            $amfServerUrl = str_replace(":123443", "", trim($lsRes));
            break;
        }
        sleep(2);
    }
    
    if (empty($amfServerUrl)) {
        throw new Exception("Timeout waiting for Load Server. Last status: $lsStatus, Resp: $lsRes");
    }
    
    if (strpos($amfServerUrl, 'http') !== 0) {
        if (strpos($amfServerUrl, '//') === 0) {
            $amfServerUrl = "https:" . $amfServerUrl;
        } else {
            $amfServerUrl = rtrim($lsUrl, '/') . $amfServerUrl;
        }
    }
    
    return $amfServerUrl;
}


// AMF3 HTTP Sender
class TsoAmfClient {
    private $serverUrl;

    public function __construct($serverUrl) {
        $this->serverUrl = $serverUrl;
    }

    public function sendCommand($dServerCall) {
        $message = new flex_messaging_messages_RemotingMessage();
        $message->destination = "SMC";
        $message->operation = 'ExecuteServerCall';
        $message->source = "com.bluebyte.game.servlet.EventHandler";
        $message->messageId = sprintf('%04X%04X-%04X-%04X-%04X-%04X%04X%04X', mt_rand(0, 65535), mt_rand(0, 65535), mt_rand(0, 65535), mt_rand(16384, 20479), mt_rand(32768, 49151), mt_rand(0, 65535), mt_rand(0, 65535), mt_rand(0, 65535));
        $message->headers = new stdClass();
        $message->headers->DSId = "nil";
        $message->headers->DSEndpoint = "SMC-Endpoint";
        $message->body = [$dServerCall];

        $encoder = new Amf3Encoder();
        $encoder->encode([$message]); // Must be an array of arguments!
        $amf3Body = $encoder->getOutput();
        
        // Target URI for Flex Remoting is 'null'
        $amf0Envelope = wrapAmf0Remoting("null", "/1", $amf3Body);
        
        file_put_contents('debug_zone_req.amf', $amf0Envelope);
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $this->serverUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_POSTREDIR, 3); // Maintain POST on redirects
        
        // Use the auth cookies
        curl_setopt($ch, CURLOPT_COOKIEFILE, __DIR__ . '/cookies.txt');
        
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/x-amf',
            'Connection: Keep-Alive',
            'Accept: */*',
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Referer: ' . $this->serverUrl,
            'Origin: ' . dirname($this->serverUrl)
        ]);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $amf0Envelope);
        
        $response = curl_exec($ch);
        $error = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($error) {
            throw new Exception("AMF cURL Error: " . $error);
        }
        if ($httpCode != 200) {
            throw new Exception("AMF Server returned HTTP $httpCode. Response: " . $response);
        }
        
        return $response; // Raw AMF0 response
    }
}

// VO Classes
class defaultGame_Communication_VO_dServerCall {
    public $dsoAuthToken;
    public $type;
    public $zoneID;
    public $dsoAuthUser;
    public $data;
    public $dsoAuthRandomClientID;
}

class defaultGame_Communication_VO_dServerAction {
    public $endGrid;
    public $grid;
    public $data;
    public $type;
}

class flex_messaging_messages_RemotingMessage {
    public $destination;
    public $operation;
    public $source;
    public $timestamp = 0;
    public $timeToLive = 0;
    public $messageId;
    public $clientId = null;
    public $headers;
    public $body;
}

// To use correct class names in AMF3, PHP uses get_class(). 
// But PHP class names can't contain dots. 
// So our Amf3Encoder needs a hack to replace underscores with dots for "defaultGame_Communication_VO_dServerCall".
