<?php
// Invoke the upstream CLI installer without putting the password in process arguments.
if (PHP_SAPI !== 'cli') { exit(1); }
$private = json_decode(file_get_contents('/run/iris-private/config.json'), true, 512, JSON_THROW_ON_ERROR);
$argv = ['install_database.php', '--agree-license', '--lang=en', '--adminuser=irisadmin',
    '--adminpass=' . $private['adminPassword'], '--adminemail=admin@example.invalid',
    '--fullname=IRIS Synthetic ' . $private['source'], '--shortname=IRIS-' . $private['source']];
$argc = count($argv);
$_SERVER['argv'] = $argv;
$_SERVER['argc'] = $argc;
require('/var/www/html/admin/cli/install_database.php');
