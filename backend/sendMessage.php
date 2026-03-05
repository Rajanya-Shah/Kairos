<?php
// ============================================================
// Kairos – Send a Message
// ============================================================
session_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated.']);
    exit;
}

$me = (int)$_SESSION['user_id'];
$receiverId = (int)($_POST['receiver_id'] ?? 0);
$content = trim($_POST['content'] ?? '');

if ($receiverId === 0 || $content === '') {
    http_response_code(400);
    echo json_encode(['error' => 'receiver_id and content are required.']);
    exit;
}

if (mb_strlen($content) > 5000) {
    http_response_code(400);
    echo json_encode(['error' => 'Message too long.']);
    exit;
}

$db = getDB();

// Verify the receiver is actually a contact
$uid1 = min($me, $receiverId);
$uid2 = max($me, $receiverId);
$check = $db->prepare(
    'SELECT id FROM contacts WHERE user_id_1 = ? AND user_id_2 = ?'
);
$check->execute([$uid1, $uid2]);
if (!$check->fetch()) {
    http_response_code(403);
    echo json_encode(['error' => 'You are not connected with this user.']);
    exit;
}

$ins = $db->prepare(
    'INSERT INTO messages (sender_id, receiver_id, content, status) VALUES (?, ?, ?, "sent")'
);
$ins->execute([$me, $receiverId, $content]);
$msgId = (int)$db->lastInsertId();

// Return the inserted message for immediate rendering
$stmt = $db->prepare('SELECT * FROM messages WHERE id = ?');
$stmt->execute([$msgId]);
$msg = $stmt->fetch();

echo json_encode([
    'success' => true,
    'message' => $msg,
]);
