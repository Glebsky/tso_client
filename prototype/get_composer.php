<?php
// Script to download a single file AMF library or composer phar
file_put_contents('composer.phar', file_get_contents('https://getcomposer.org/composer-stable.phar'));
