<?php
require_once 'config.php';

class TsoAuth {
    private $cookieFile;
    private $region;
    private $server;

    public function __construct($region) {
        global $SERVERS;
        if (!isset($SERVERS[$region])) {
            throw new Exception("Invalid region: $region");
        }
        $this->region = $region;
        $this->server = $SERVERS[$region];
        $this->cookieFile = __DIR__ . '/cookies.txt';
    }

    public function __destruct() {
        // Do not delete cookies.txt so it can be used for AMF requests
    }

    private function curlRequest($url, $postData = null) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_COOKIEJAR, $this->cookieFile);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $this->cookieFile);
        
        $headers = [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        ];
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        if ($postData) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
        }
        
        $response = curl_exec($ch);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            throw new Exception("cURL Error: " . $error);
        }
        
        return $response;
    }

    public function loginMigrated($username, $password) {
        $loginUrl = $this->server['domain'] . str_replace("uplay", "login", $this->server['uplay']);
        
        $postData = [
            'name' => $username,
            'password' => $password
        ];

        // 1. POST Login
        $loginRes = $this->curlRequest($loginUrl, $postData);
        if (strpos($loginRes, 'OKAY') === false) {
            throw new Exception("Login failed: " . $loginRes);
        }

        // 2. GET Main
        $mainUrl = $this->server['domain'] . $this->server['main'];
        $this->curlRequest($mainUrl, ['start' => '1']);

        // 3. GET Play
        $playUrl = $this->server['domain'] . $this->server['play'];
        $playHtml = $this->curlRequest($playUrl);

        return $this->extractParams($playHtml);
    }

    private function extractParams($html) {
        $params = [];
        // Look for: return "lang=ru-ru&dsoAuthUser=123&...
        if (preg_match('/return\s+"([^"]+)"/i', $html, $matches) || preg_match('/thisProgram:\s+"([^"]+)"/i', $html, $matches)) {
            parse_str($matches[1], $parsedParams);
            $params = $parsedParams;
        }

        $nickName = "Unknown";
        if (preg_match("/loggedInUserName\s*=\s*'([^']+)'/i", $html, $matches)) {
            $nickName = $matches[1];
        }

        // Always save for debugging
        file_put_contents('debug_play_page.html', $html);

        if (empty($params) || !isset($params['dsoAuthToken'])) {
            throw new Exception("Не удалось найти токены авторизации на странице. Возможно, капча или техработы. Ответ сохранен в debug_play_page.html");
        }
        
        file_put_contents('debug_flash_vars.json', json_encode($params, JSON_PRETTY_PRINT));
            
        return [
            'dsoAuthToken' => $params['dsoAuthToken'],
            'dsoAuthUser' => $params['dsoAuthUser'],
            'bburl' => $params['bb'],
            'zoneId' => isset($params['zoneID']) ? $params['zoneID'] : null,
            'nickName' => $nickName
        ];
    }
}
