<?php
session_start();

require_once 'config.php';
require_once 'auth.php';
require_once 'amf.php';

$error = null;
$success = null;
$result = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    if ($action === 'login') {
        try {
            $auth = new TsoAuth($_POST['region']);
            // Try Migrated flow for now
            $params = $auth->loginMigrated($_POST['username'], $_POST['password']);
            
            $_SESSION['tso_auth'] = $params;
            $_SESSION['tso_region'] = $_POST['region'];
            
            $success = "Авторизация успешна!";
        } catch (Exception $e) {
            $error = $e->getMessage();
        }
    } elseif ($action === 'logout') {
        session_destroy();
        header('Location: index.php');
        exit;
    } elseif ($action === 'stop_production' || $action === 'start_production') {
        try {
            $params = $_SESSION['tso_auth'];
            $grid = (int)$_POST['grid'];
            
            // Build the command
            $call = new defaultGame_Communication_VO_dServerCall();
            $call->type = $COMMANDS['STOP_PRODUCTION']; // 107
            $call->zoneID = (int)$params['dsoAuthUser'];
            $call->dsoAuthUser = (int)$params['dsoAuthUser'];
            $call->dsoAuthToken = $params['dsoAuthToken'];
            $call->dsoAuthRandomClientID = 1; // Default
            
            $actionObj = new defaultGame_Communication_VO_dServerAction();
            $actionObj->type = ($action === 'stop_production') ? 0 : 1; // 0 for stop, 1 for start
            $actionObj->grid = $grid;
            $actionObj->endGrid = 0;
            $actionObj->data = null;
            
            $call->data = $actionObj;
            
            // Send AMF
            $amfServerUrl = getRealAmfUrl($params['bb'] ?? 'https://r02-ls.thesettlersonline.ru/', $params['dsoAuthUser'], $params['dsoAuthToken']);
            
            $client = new TsoAmfClient($amfServerUrl);
            $rawResponse = $client->sendCommand($call);
            file_put_contents('debug_action.amf', $rawResponse);
            
            $success = "Команда отправлена! Результат сохранен в debug_action.amf (размер: " . strlen($rawResponse) . " байт).";
            $result = bin2hex($rawResponse);
            
        } catch (Exception $e) {
            $error = $e->getMessage();
        }
    } elseif ($action === 'get_zone') {
        try {
            $params = $_SESSION['tso_auth'];
            
            $call = new defaultGame_Communication_VO_dServerCall();
            $call->type = $COMMANDS['GET_ZONE']; // 1001
            $call->zoneID = (int)$params['dsoAuthUser']; // Home zone id is player id
            $call->dsoAuthUser = (int)$params['dsoAuthUser'];
            $call->dsoAuthToken = $params['dsoAuthToken'];
            $call->dsoAuthRandomClientID = 1;
            
            // data is 'false' (boolean) for GET_ZONE
            $call->data = false;
            
            // Poll load server for actual AMF endpoint
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
                // Sometime it returns //domain.com/amf/
                if (strpos($amfServerUrl, '//') === 0) {
                    $amfServerUrl = "https:" . $amfServerUrl;
                } else {
                    $amfServerUrl = rtrim($lsUrl, '/') . $amfServerUrl;
                }
            }
            
            // Now we have the correct AMF URL!
            $client = new TsoAmfClient($amfServerUrl);
            $rawResponse = $client->sendCommand($call);
            file_put_contents('debug_zone.amf', $rawResponse);
            $success = "Команда GET_ZONE отправлена. Результат сохранен в debug_zone.amf (размер: " . strlen($rawResponse) . " байт).";
            
            // Print a snippet of the hex
            $result = bin2hex(substr($rawResponse, 0, 500)) . "...";
        } catch (Exception $e) {
            $error = $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>TSO Headless Prototype</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #1e1e1e; color: #fff; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: #2d2d2d; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .alert { padding: 10px; margin-bottom: 20px; border-radius: 4px; }
        .alert-error { background: #ff4a4a; color: #fff; }
        .alert-success { background: #4caf50; color: #fff; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; color: #aaa; }
        input, select, button { padding: 8px; border-radius: 4px; border: 1px solid #444; background: #1e1e1e; color: #fff; width: 100%; box-sizing: border-box; }
        button { background: #007acc; cursor: pointer; border: none; font-weight: bold; margin-top: 10px; }
        button:hover { background: #0098ff; }
        .btn-danger { background: #d9534f; }
        .btn-danger:hover { background: #c9302c; }
        .btn-success { background: #5cb85c; }
        .btn-success:hover { background: #4cae4c; }
        pre { background: #111; padding: 10px; border-radius: 4px; overflow-x: auto; color: #0f0; }
        .row { display: flex; gap: 10px; }
        .row > * { flex: 1; }
    </style>
</head>
<body>
    <div class="container">
        <h1>TSO Headless Prototype</h1>
        
        <?php if ($error): ?>
            <div class="alert alert-error"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>
        
        <?php if ($success): ?>
            <div class="alert alert-success"><?= htmlspecialchars($success) ?></div>
        <?php endif; ?>
        
        <?php if (!isset($_SESSION['tso_auth'])): ?>
            <!-- Форма авторизации -->
            <form method="POST">
                <input type="hidden" name="action" value="login">
                <div class="form-group">
                    <label>Email / Логин (CipSoft Migrated)</label>
                    <input type="text" name="username" required>
                </div>
                <div class="form-group">
                    <label>Пароль</label>
                    <input type="password" name="password" required>
                </div>
                <div class="form-group">
                    <label>Регион</label>
                    <select name="region">
                        <option value="ru">RU (Тандрия/Курон/Эвеланс)</option>
                        <option value="en">EN</option>
                        <option value="de">DE</option>
                    </select>
                </div>
                <button type="submit">Авторизоваться</button>
            </form>
        <?php else: ?>
            <!-- Панель управления -->
            <div style="background: #111; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p><strong>Аккаунт:</strong> Успешно авторизован.</p>
                <p><strong>Никнейм:</strong> <?= htmlspecialchars($_SESSION['tso_auth']['nickName'] ?? 'Unknown') ?></p>
                <p><strong>UserID:</strong> <?= htmlspecialchars($_SESSION['tso_auth']['dsoAuthUser']) ?></p>
                <p><strong>Token:</strong> <?= substr($_SESSION['tso_auth']['dsoAuthToken'], 0, 10) ?>...</p>
                <p><strong>ZoneID:</strong> <?= htmlspecialchars($_SESSION['tso_auth']['zoneId'] ?? 'Неизвестно') ?></p>
                <p><strong>AMF Endpoint:</strong> <?= htmlspecialchars(rtrim($_SESSION['tso_auth']['bburl'], '/') . "/amf") ?></p>
                <form method="POST" style="margin-top: 10px; display: inline-block;">
                    <input type="hidden" name="action" value="logout">
                    <button type="submit" class="btn-danger" style="width: auto;">Выйти</button>
                </form>
                <form method="POST" style="margin-top: 10px; display: inline-block; margin-left: 10px;">
                    <input type="hidden" name="action" value="get_zone">
                    <button type="submit" style="width: auto;">Получить список зданий</button>
                </form>
            </div>
            
            <hr style="border-color: #444; margin: 20px 0;">
            
            <h3>Тест команд</h3>
            <form method="POST">
                <div class="row">
                    <div class="form-group">
                        <label>Grid Index (позиция здания)</label>
                        <input type="number" name="grid" required placeholder="Например: 12345">
                    </div>
                </div>
                <div class="row">
                    <button type="submit" name="action" value="stop_production" class="btn-danger">⏹ Остановить здание</button>
                    <button type="submit" name="action" value="start_production" class="btn-success">▶ Запустить здание</button>
                </div>
            </form>
            
            <?php if ($result): ?>
                <h4 style="margin-top: 20px;">Ответ сервера (Hex):</h4>
                <pre><?= htmlspecialchars($result) ?></pre>
                <p style="font-size: 12px; color: #888;">* Если ответ содержит AMF-ошибку, значит команда не прошла.</p>
            <?php endif; ?>
        <?php endif; ?>
    </div>
</body>
</html>
