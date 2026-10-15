<?php
// Local sandbox configuration. Source stays in an ignored external checkout.
unset($CFG);
global $CFG;
$CFG = new stdClass();
$private = json_decode(file_get_contents('/run/iris-private/config.json'), true, 512, JSON_THROW_ON_ERROR);
$CFG->dbtype = 'pgsql';
$CFG->dblibrary = 'native';
$CFG->dbhost = 'db';
$CFG->dbname = 'moodle';
$CFG->dbuser = 'moodle';
$CFG->dbpass = $private['dbPassword'];
$CFG->prefix = 'm_';
$CFG->dboptions = ['dbcollation' => ''];
$CFG->wwwroot = 'http://127.0.0.1:' . $private['port'];
$CFG->dataroot = '/var/www/moodledata';
$CFG->admin = 'admin';
$CFG->directorypermissions = 0770;
$CFG->debug = 0;
$CFG->debugdisplay = false;
$CFG->passwordpolicy = true;
$CFG->cronclionly = true;
$CFG->pathtophp = '/usr/local/bin/php';
$CFG->noreplyaddress = 'noreply@example.invalid';
$CFG->noemailever = true;
$CFG->disableupdateautodeploy = true;
$CFG->updateautocheck = false;
$CFG->site_is_public = false;
require_once(__DIR__ . '/lib/setup.php');
