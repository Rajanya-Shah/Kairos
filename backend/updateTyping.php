<?php
session_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated.']);
    exit;
}

$me = (int)$_SESSION['user_id'];
$typingToId = (int)($_POST['typing_to_id'] ?? 0);
$db = getDB();

if ($typingToId > 0) {
    $db->prepare('UPDATE users SET typing_to_id = ?, last_typing = NOW() WHERE id = ?')
        ->execute([$typingToId, $me]);
}
else {
    $db->prepare('UPDATE users SET typing_to_id = NULL, last_typing = NULL WHERE id = ?')
        ->execute([$me]);
}

echo json_encode(['success' => true]);
