-- ============================================================
-- Kairos Messaging Platform – Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS kairos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kairos;

-- -------------------------------------------------------
-- Table: users
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar        VARCHAR(255) DEFAULT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------
-- Table: friend_requests
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS friend_requests (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sender_id   INT UNSIGNED NOT NULL,
    receiver_id INT UNSIGNED NOT NULL,
    status      ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_request (sender_id, receiver_id)
) ENGINE=InnoDB;

-- -------------------------------------------------------
-- Table: contacts  (established friendships – mutual)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id_1      INT UNSIGNED NOT NULL,
    user_id_2      INT UNSIGNED NOT NULL,
    established_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_contact (user_id_1, user_id_2)
) ENGINE=InnoDB;

-- -------------------------------------------------------
-- Table: messages
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sender_id   INT UNSIGNED NOT NULL,
    receiver_id INT UNSIGNED NOT NULL,
    content     TEXT         NOT NULL,
    status      ENUM('sent','delivered','seen') NOT NULL DEFAULT 'sent',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
