<?php
// ============================================================
// Kairos – Global Notification Poll
// Returns: new messages across ALL contacts + new friend requests
// Called every 3s by the frontend global poller
// ============================================================
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
$afterMsgId = (int)($_GET['after_msg_id'] ?? 0);
$activeContactId = (int)($_GET['active_contact_id'] ?? 0);
$db = getDB();

// ── 1. New messages received (across all conversations) ──────────
$msgStmt = $db->prepare(
    'SELECT m.id, m.sender_id, m.receiver_id, m.type, m.content, m.status, m.is_ephemeral, m.created_at,
            u.username as sender_username, u.avatar as sender_avatar
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.receiver_id = ?
       AND m.id > ?
     ORDER BY m.created_at ASC'
);
$msgStmt->execute([$me, $afterMsgId]);
$newMessages = $msgStmt->fetchAll();

// Cast ints
foreach ($newMessages as &$m) {
    $m['id'] = (int)$m['id'];
    $m['sender_id'] = (int)$m['sender_id'];
    $m['receiver_id'] = (int)$m['receiver_id'];
}
unset($m);

// ── 2. New friend requests (pending, not yet seen) ───────────────
$frStmt = $db->prepare(
    'SELECT fr.id as request_id, u.id, u.username, fr.created_at
     FROM friend_requests fr
     JOIN users u ON u.id = fr.sender_id
     WHERE fr.receiver_id = ? AND fr.status = "pending"
     ORDER BY fr.created_at DESC
     LIMIT 20'
);
$frStmt->execute([$me]);
$friendRequests = $frStmt->fetchAll();
foreach ($friendRequests as &$r) {
    $r['request_id'] = (int)$r['request_id'];
    $r['id'] = (int)$r['id'];
}

// ── 3. Latest message id for next poll ──────────────────────────
$maxId = $afterMsgId;
if (!empty($newMessages)) {
    $maxId = max(array_column($newMessages, 'id'));
}

// ── 4. Typing status of active contact ──────────────────────────
$isTypingToMe = false;
if ($activeContactId > 0) {
    $typeStmt = $db->prepare('SELECT id FROM users WHERE id = ? AND typing_to_id = ? AND last_typing >= DATE_SUB(NOW(), INTERVAL 3 SECOND)');
    $typeStmt->execute([$activeContactId, $me]);
    if ($typeStmt->fetch()) {
        $isTypingToMe = true;
    }
}

echo json_encode([
    'new_messages' => $newMessages,
    'friend_requests' => $friendRequests,
    'max_msg_id' => $maxId,
    'is_typing' => $isTypingToMe
]);
