<?php
// Original glue using installed Moodle APIs. Synthetic local fixtures only.
// STDOUT contains credentials and is always routed to a permission-restricted file.
if (PHP_SAPI !== 'cli') { exit(1); }
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/course/modlib.php');
require_once($CFG->dirroot . '/user/lib.php');
require_once($CFG->libdir . '/enrollib.php');
require_once($CFG->libdir . '/completionlib.php');
require_once($CFG->dirroot . '/completion/criteria/completion_criteria_activity.php');
require_once($CFG->libdir . '/externallib.php');
$private = json_decode(file_get_contents('/run/iris-private/config.json'), true, 512, JSON_THROW_ON_ERROR);
$source = $private['source'];
$system = context_system::instance();
\core\session\manager::set_user(get_admin());
set_config('enablewebservices', 1);
set_config('webserviceprotocols', 'rest');
set_config('enablecompletion', 1);
set_config('enableavailability', 1);
set_config('enrol_plugins_enabled', 'manual');

function iris_user(string $username, string $idnumber, string $password): stdClass {
    global $DB, $CFG;
    $user = $DB->get_record('user', ['username' => $username, 'mnethostid' => $CFG->mnet_localhost_id]);
    if (!$user) {
        $id = user_create_user((object)['username' => $username, 'idnumber' => $idnumber, 'auth' => 'manual',
            'password' => $password, 'firstname' => 'Synthetic', 'lastname' => $idnumber, 'email' => $username . '@example.invalid',
            'confirmed' => 1, 'mnethostid' => $CFG->mnet_localhost_id, 'lang' => 'en',
            'calendartype' => 'gregorian', 'maildisplay' => 0, 'mailformat' => 1, 'maildigest' => 0,
            'autosubscribe' => 0, 'trackforums' => 0, 'city' => 'Bangkok', 'country' => 'TH', 'timezone' => 'Asia/Bangkok']);
        $user = $DB->get_record('user', ['id' => $id], '*', MUST_EXIST);
    }
    return $user;
}
function iris_role(string $shortname, string $name, array $capabilities, context $context, int $userid): int {
    global $DB;
    $roleid = $DB->get_field('role', 'id', ['shortname' => $shortname]);
    if (!$roleid) { $roleid = create_role($name, $shortname, 'Local IRIS synthetic integration role'); }
    set_role_contextlevels($roleid, [CONTEXT_SYSTEM, CONTEXT_COURSECAT, CONTEXT_COURSE]);
    foreach ($capabilities as $capability) { assign_capability($capability, CAP_ALLOW, $roleid, $context->id, true); }
    role_assign($roleid, $userid, $context->id);
    return (int)$roleid;
}
function iris_service(string $name, string $shortname, array $functions, int $userid): stdClass {
    global $DB;
    $service = $DB->get_record('external_services', ['shortname' => $shortname]);
    if (!$service) {
        $id = $DB->insert_record('external_services', (object)['name' => $name, 'shortname' => $shortname,
            'enabled' => 1, 'restrictedusers' => 1, 'requiredcapability' => '', 'timecreated' => time(),
            'downloadfiles' => 0, 'uploadfiles' => 0]);
        $service = $DB->get_record('external_services', ['id' => $id], '*', MUST_EXIST);
    }
    $allowed = $DB->get_fieldset_select('external_services_functions', 'functionname', 'externalserviceid = ?', [$service->id]);
    foreach ($allowed as $function) {
        if (!in_array($function, $functions, true)) { throw new RuntimeException('Existing service has unexpected functions'); }
    }
    foreach ($functions as $function) {
        if (!$DB->record_exists('external_services_functions', ['externalserviceid' => $service->id, 'functionname' => $function])) {
            $DB->insert_record('external_services_functions', (object)['externalserviceid' => $service->id, 'functionname' => $function]);
        }
    }
    if (!$DB->record_exists('external_services_users', ['externalserviceid' => $service->id, 'userid' => $userid])) {
        $DB->insert_record('external_services_users', (object)['externalserviceid' => $service->id, 'userid' => $userid, 'timecreated' => time()]);
    }
    return $service;
}
function iris_token(stdClass $service, int $userid, context $context): string {
    global $DB;
    $existing = $DB->get_record('external_tokens', ['externalserviceid' => $service->id, 'userid' => $userid, 'tokentype' => EXTERNAL_TOKEN_PERMANENT]);
    if ($existing) {
        if ($existing->validuntil && $existing->validuntil <= time()) { throw new RuntimeException('Local token expired; renew explicitly'); }
        return $existing->token;
    }
    return \core_external\util::generate_token(EXTERNAL_TOKEN_PERMANENT, $service, $userid, $context, time() + 7 * DAYSECS, '', 'IRIS synthetic sandbox');
}

$categoryrecord = $DB->get_record('course_categories', ['idnumber' => 'iris-synthetic']);
$category = $categoryrecord ? core_course_category::get($categoryrecord->id) : core_course_category::create([
    'name' => 'IRIS synthetic learning', 'idnumber' => 'iris-synthetic', 'parent' => 0]);
$shortname = 'IRIS-' . strtoupper(substr($source, -1)) . '-1';
$course = $DB->get_record('course', ['shortname' => $shortname]);
if (!$course) {
    $course = create_course((object)['fullname' => 'Synthetic safety lesson ' . strtoupper(substr($source, -1)),
        'shortname' => $shortname, 'idnumber' => $shortname, 'category' => $category->id,
        'summary' => 'Self-created synthetic demonstration content only.', 'summaryformat' => FORMAT_PLAIN,
        'format' => 'topics', 'visible' => 1, 'enablecompletion' => 1, 'numsections' => 1, 'startdate' => time() - DAYSECS]);
}
$coursecontext = context_course::instance($course->id);
$categorycontext = context_coursecat::instance($category->id);
$student = iris_user('irislearner', 'E0001', $private['learnerPassword']);
$serviceuser = iris_user('irisconnector', 'IRIS-SERVICE', $private['servicePassword']);
$studentrole = $DB->get_record('role', ['shortname' => 'student'], '*', MUST_EXIST);
$restrole = iris_role('irisrest', 'IRIS REST transport only', ['webservice/rest:use'], $system, $serviceuser->id);
role_assign($restrole, $student->id, $system->id);
$connectorrole = iris_role('irisconnector', 'IRIS category connector', [
    'moodle/category:viewcourselist', 'moodle/course:view', 'moodle/course:viewparticipants', 'moodle/user:viewdetails',
    'report/completion:view', 'moodle/role:assign', 'enrol/manual:enrol'], $categorycontext, $serviceuser->id);
if (!$DB->record_exists('role_allow_assign', ['roleid' => $connectorrole, 'allowassign' => $studentrole->id])) {
    $DB->insert_record('role_allow_assign', (object)['roleid' => $connectorrole, 'allowassign' => $studentrole->id]);
}
$manual = enrol_get_plugin('manual');
$instances = enrol_get_instances($course->id, false);
$manualinstance = null;
foreach ($instances as $instance) { if ($instance->enrol === 'manual') { $manualinstance = $instance; } }
if (!$manualinstance) {
    $instanceid = $manual->add_instance($course, ['roleid' => $studentrole->id, 'status' => ENROL_INSTANCE_ENABLED]);
    $manualinstance = $DB->get_record('enrol', ['id' => $instanceid], '*', MUST_EXIST);
}

$pagemodule = $DB->get_record('modules', ['name' => 'page'], '*', MUST_EXIST);
$cm = $DB->get_record('course_modules', ['course' => $course->id, 'module' => $pagemodule->id, 'idnumber' => 'iris-synthetic-page']);
if (!$cm) {
    $page = add_moduleinfo((object)['modulename' => 'page', 'module' => $pagemodule->id, 'course' => $course->id,
        'section' => 1, 'name' => 'Synthetic safety practice', 'visible' => 1, 'cmidnumber' => 'iris-synthetic-page',
        'introeditor' => ['text' => 'Read the self-created lesson, then mark this activity complete.', 'format' => FORMAT_HTML, 'itemid' => 0],
        'content' => '<p>Synthetic practice: stop, check the work area, report hazards, and follow the supervisor instruction.</p>',
        'contentformat' => FORMAT_HTML, 'display' => 5, 'printintro' => 1, 'printlastmodified' => 0,
        'completion' => COMPLETION_TRACKING_MANUAL, 'completionview' => 0], $course);
    $cm = $DB->get_record('course_modules', ['id' => $page->coursemodule], '*', MUST_EXIST);
}
if (!$DB->record_exists('course_completion_criteria', ['course' => $course->id, 'criteriatype' => COMPLETION_CRITERIA_TYPE_ACTIVITY, 'moduleinstance' => $cm->id])) {
    $criteria = new completion_criteria_activity();
    $settings = (object)['id' => $course->id, 'criteria_activity' => [$cm->id => 1]];
    $criteria->update_config($settings);
}
$service = iris_service('IRIS category integration', 'iris-connector', [
    'core_course_get_courses_by_field', 'enrol_manual_enrol_users', 'core_enrol_get_users_courses', 'core_completion_get_course_completion_status'
], $serviceuser->id);
$learnerService = iris_service('IRIS learner activity proof', 'iris-learner', [
    'core_completion_update_activity_completion_status_manually'
], $student->id);
$token = iris_token($service, $serviceuser->id, $categorycontext);
$learnerToken = iris_token($learnerService, $student->id, $coursecontext);
rebuild_course_cache($course->id, true);
$record = [
    'source' => $source, 'baseUrl' => $CFG->wwwroot, 'categoryId' => (int)$category->id, 'courseId' => (int)$course->id,
    'courseKey' => $source . ':' . $course->id, 'activityId' => (int)$cm->id, 'userId' => (int)$student->id,
    'employeeId' => 'E0001', 'roleId' => (int)$studentrole->id, 'serviceUserId' => (int)$serviceuser->id,
    'serviceToken' => $token, 'learnerToken' => $learnerToken, 'learnerUsername' => 'irislearner',
    'learnerPassword' => $private['learnerPassword'], 'adminUsername' => 'irisadmin', 'adminPassword' => $private['adminPassword'],
    'serviceAdmin' => is_siteadmin($serviceuser->id), 'serviceFunctions' => [
        'core_course_get_courses_by_field', 'enrol_manual_enrol_users', 'core_enrol_get_users_courses', 'core_completion_get_course_completion_status'],
    'tokenExpiresWithinDays' => 7,
];
if ($record['serviceAdmin']) { throw new RuntimeException('Connector must never be a site admin'); }
echo json_encode($record, JSON_THROW_ON_ERROR);
