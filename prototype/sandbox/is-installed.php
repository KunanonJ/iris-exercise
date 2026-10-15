<?php
if (PHP_SAPI !== 'cli') { exit(1); }
// Avoid bootstrapping Moodle before the database exists. Use the extension required by Moodle's pgsql driver.
$private = json_decode(file_get_contents('/run/iris-private/config.json'), true, 512, JSON_THROW_ON_ERROR);
if (!preg_match('/^[A-Za-z0-9_-]+$/', $private['dbPassword'])) { exit(1); }
$connection = @pg_connect('host=db dbname=moodle user=moodle password=' . $private['dbPassword']);
if (!$connection) { fwrite(STDERR, "Local database connection unavailable\n"); exit(1); }
$query = pg_query($connection, "SELECT to_regclass('public.m_config')");
echo pg_fetch_result($query, 0, 0) ? 'installed' : 'empty';
