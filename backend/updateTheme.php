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
$contactId = (int)($_POST['contact_id'] ?? 0);
$theme = trim($_POST['theme'] ?? 'default');

if ($contactId === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'contact_id is required.']);
    exit;
}

$db = getDB();

$uid1 = min($me, $contactId);
$uid2 = max($me, $contactId);

$stmt = $db->prepare('UPDATE contacts SET theme = ? WHERE user_id_1 = ? AND user_id_2 = ?');
$stmt->execute([$theme, $uid1, $uid2]);

echo json_encode(['success' => true]);
