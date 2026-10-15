<?php
// STDIN only. Never print the incoming credential document.
if (PHP_SAPI !== 'cli') { exit(1); }
$raw = stream_get_contents(STDIN, 16384);
$config = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
if (!isset($config['dbPassword'], $config['adminPassword'], $config['learnerPassword'], $config['source'], $config['port'])) { exit(1); }
$path = '/run/iris-private/config.json';
file_put_contents($path, $raw, LOCK_EX);
chmod($path, 0600);
chown($path, 'www-data');
chgrp($path, 'www-data');
