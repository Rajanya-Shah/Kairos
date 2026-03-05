<?php
// ============================================================
// Kairos – Friend Request & Contact Management
// Actions: search | send | accept | reject | pending | list
// ============================================================
session_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated.']);
    exit;
}

$me = (int)$_SESSION['user_id'];
$action = $_REQUEST['action'] ?? '';
$db = getDB();

switch ($action) {

    // ----------------------------------------------------------
    // Search users by username (exclude self & existing contacts)
    // ----------------------------------------------------------
    case 'search':
        $q = trim($_GET['q'] ?? '');
        if ($q === '') {
            echo json_encode([]);
            exit;
        }

        $stmt = $db->prepare(
            'SELECT id, username, avatar FROM users
             WHERE username LIKE ? AND id != ?
             AND id NOT IN (
                 SELECT CASE WHEN user_id_1 = ? THEN user_id_2 ELSE user_id_1 END
                 FROM contacts WHERE user_id_1 = ? OR user_id_2 = ?
             )
             LIMIT 20'
        );
        $stmt->execute(['%' . $q . '%', $me, $me, $me, $me]);
        echo json_encode($stmt->fetchAll());
        break;

    // ----------------------------------------------------------
    // Send a friend request
    // ----------------------------------------------------------
    case 'send':
        $receiverId = (int)($_POST['receiver_id'] ?? 0);
        if ($receiverId === $me || $receiverId === 0) {
            echo json_encode(['error' => 'Invalid receiver.']);
            exit;
        }

        // Check if a request already exists in either direction
        $check = $db->prepare(
            'SELECT id FROM friend_requests
             WHERE (sender_id = ? AND receiver_id = ?)
                OR (sender_id = ? AND receiver_id = ?)'
        );
        $check->execute([$me, $receiverId, $receiverId, $me]);
        if ($check->fetch()) {
            echo json_encode(['error' => 'Request already exists.']);
            exit;
        }

        $ins = $db->prepare(
            'INSERT INTO friend_requests (sender_id, receiver_id) VALUES (?, ?)'
        );
        $ins->execute([$me, $receiverId]);
        echo json_encode(['success' => true]);
        break;

    // ----------------------------------------------------------
    // Accept a friend request
    // ----------------------------------------------------------
    case 'accept':
        $requestId = (int)($_POST['request_id'] ?? 0);

        $stmt = $db->prepare(
            'SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = "pending"'
        );
        $stmt->execute([$requestId, $me]);
        $req = $stmt->fetch();

        if (!$req) {
            echo json_encode(['error' => 'Request not found.']);
            exit;
        }

        $db->beginTransaction();
        try {
            // Mark as accepted
            $db->prepare('UPDATE friend_requests SET status = "accepted" WHERE id = ?')
                ->execute([$requestId]);

            // Add to contacts (canonical order: smaller id first)
            $uid1 = min($req['sender_id'], $me);
            $uid2 = max($req['sender_id'], $me);
            $db->prepare(
                'INSERT IGNORE INTO contacts (user_id_1, user_id_2) VALUES (?, ?)'
            )->execute([$uid1, $uid2]);

            $db->commit();
            echo json_encode(['success' => true]);
        }
        catch (Exception $e) {
            $db->rollBack();
            echo json_encode(['error' => 'Failed to accept request.']);
        }
        break;

    // ----------------------------------------------------------
    // Reject a friend request
    // ----------------------------------------------------------
    case 'reject':
        $requestId = (int)($_POST['request_id'] ?? 0);
        $db->prepare(
            'UPDATE friend_requests SET status = "rejected" WHERE id = ? AND receiver_id = ?'
        )->execute([$requestId, $me]);
        echo json_encode(['success' => true]);
        break;

    // ----------------------------------------------------------
    // List incoming pending friend requests
    // ----------------------------------------------------------
    case 'pending':
        $stmt = $db->prepare(
            'SELECT fr.id as request_id, u.id, u.username, u.avatar, fr.created_at
             FROM friend_requests fr
             JOIN users u ON u.id = fr.sender_id
             WHERE fr.receiver_id = ? AND fr.status = "pending"
             ORDER BY fr.created_at DESC'
        );
        $stmt->execute([$me]);
        echo json_encode($stmt->fetchAll());
        break;

    // ----------------------------------------------------------
    // List all accepted contacts for the current user
    // ----------------------------------------------------------
    case 'list':
        $stmt = $db->prepare(
            'SELECT u.id, u.username, u.avatar, c.theme
             FROM contacts c
             JOIN users u ON u.id = CASE WHEN c.user_id_1 = ? THEN c.user_id_2 ELSE c.user_id_1 END
             WHERE c.user_id_1 = ? OR c.user_id_2 = ?
             ORDER BY u.username ASC'
        );
        $stmt->execute([$me, $me, $me]);
        echo json_encode($stmt->fetchAll());
        break;

    // ----------------------------------------------------------
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action.']);
}
