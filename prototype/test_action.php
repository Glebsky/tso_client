<?php
$params = json_decode(file_get_contents('debug_flash_vars.json'), true);
session_start();
$_SESSION['tso_auth'] = $params;
$_POST['action'] = 'stop_production';
$_POST['grid'] = 15309; // Some grid, it doesn't matter if we just want to see the error from the server
$_SERVER['REQUEST_METHOD'] = 'POST';
require 'index.php';
