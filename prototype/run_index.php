<?php
$params = json_decode(file_get_contents('debug_flash_vars.json'), true);
session_start();
$_SESSION['tso_auth'] = $params;
$_POST['action'] = 'get_zone';
$_SERVER['REQUEST_METHOD'] = 'POST';
require 'index.php';
