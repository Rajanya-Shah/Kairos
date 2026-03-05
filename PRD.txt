# Product Requirements Document (PRD): Kairos

## Overview
**Kairos** is a luxury, mysterious, editorial-styled messaging platform designed to provide a premium and exclusive communication experience. Unlike conventional messaging apps, Kairos focuses on aesthetic refinement, combining dark, moody backgrounds with subtle metallic accents and cinematic transitions to evoke a sense of intrigue, intimacy, and high-end exclusivity.

## Goals & Non-Goals
### Goals
- **Polished UI:** Deliver a meticulous, visually stunning interface with high attention to detail.
- **Smooth Chat Flow:** Provide seamless, real-time-feeling messaging interactions.
- **Luxury Aesthetic:** Cultivate an editorial, high-fashion, and premium vibe through typography and color palette choices.
- **Mysterious Vibe:** Incorporate moody contrast, subtle shadows, and a dark-mode paradigm to maintain an aura of secrecy and elegance.
- **Basic Social Layer:** Enable users to search out others by username and establish connections through an "Add Friend" flow.

### Non-Goals
- **Advanced Encryption (v1):** End-to-end encryption (E2EE) and complex cryptographic security are out of scope for the initial release.
- **Media heavy features:** Advanced file sharing, voice/video calling, and story features are excluded from v1.
- **Mass Social Networking:** No public feeds or discovery algorithms. The focus is strictly on intentional, one-on-one private messaging.

## Tech Stack
- **Frontend:** HTML5, CSS3 (Vanilla), JavaScript (Vanilla/ES6+)
- **Backend:** PHP (Standard library, session-based)
- **Database:** MySQL
- **Architecture Pattern:** Client-Server Monolith (fetching data via AJAX/Fetch API to PHP scripts)

## Design System
### Color Palette
- **Primary Backgrounds:** Deep Blacks (`#0A0A0A`), Charcoal (`#1A1A1A`)
- **Accents:** Muted Metallics (Silver, Pewter, Bronze - avoiding dominant golds to maintain subtlety, e.g., `#B0A8B9`, `#8A8D91`)
- **Text:** Off-white/Soft Gray (`#EAEAEA` for primary, `#A1A1A1` for secondary)
- **Styling:** Subtle gradients, deep shadows, and high-contrast text layering.

### Typography
- **Headings & Accents:** *Playfair Display* (Serif) – for editorial elegance and dramatic scale.
- **Body & UI Elements:** *DM Sans* (Sans-Serif) – for superior legibility in chat bubbles and dense interfaces.

### Motion Principles
- **Transitions:** Fade-slide (elements gently fading in while sliding slightly upwards).
- **Chat:** Message pop-in with a soft ease-out curve.
- **Typing Indicator:** Smooth, staggered dot bounce with a slight glow effect.
- **Interactions:** Button morph animations and subtle, lingering hover states (e.g., dimming or border highlights rather than scale jumps).

## App Architecture & File Management
```text
kairos/
├── frontend/
│   ├── index.html        # Main SPA skeleton (Login, Inbox, Chat)
│   ├── style.css         # All UI styling and animations
│   └── script.js         # Frontend routing, DOM manipulation, AJAX calls
├── backend/
│   ├── db.php            # MySQL Database connection setup
│   ├── auth.php          # User registration, login, session management
│   ├── addFriend.php     # Friend request sending and accepting
│   ├── sendMessage.php   # Recording new messages to DB
│   └── getMessages.php   # Fetching chat history between users
├── database/
│   └── schema.sql        # Definitions for users, contacts, messages, friend_requests
└── assets/
    └── avatars/          # User profile images / default mysterious silhouettes
```

## Features
### 1. Sidebar
- Displays a vertical or sliding list of connected contacts and their avatars.
- Elegant, unread message indicators (e.g., a subtle metallic dot).

### 2. Chat Window
- **Message Bubbles:** Distinct styling for sent vs. received messages, utilizing the dark and metallic color system.
- **Date Separators:** Minimalist, centered timestamps utilizing *Playfair Display* italics.
- **Status Ticks:** Sent (single tick), Delivered (double tick), Seen (highlighted/metallic double tick).

### 3. Typing Indicator
- Animated typing dots (bouncing/glowing) simulating real-time presence.

### 4. Inbox View
- A home state displaying multiple active conversations with previews of the latest message and timestamp.

### 5. Add Friend Functionality
- Modal or separate view to search users by exact username.
- Send friend requests, view pending requests, and accept them.

### 6. Profile / Settings Panel (Optional for v1)
- Minimalist panel to change username, upload a mysterious silhouette avatar, or log out.

## Database Schema
To support the feature set, the relational model will include:

1. **`users`**
   - `id` (PK, INT, Auto-increment)
   - `username` (VARCHAR, Unique)
   - `password_hash` (VARCHAR)
   - `created_at` (TIMESTAMP)

2. **`contacts`** (Established friendships)
   - `id` (PK, INT)
   - `user_id_1` (FK to users.id)
   - `user_id_2` (FK to users.id)
   - `established_at` (TIMESTAMP)

3. **`messages`**
   - `id` (PK, INT)
   - `sender_id` (FK to users.id)
   - `receiver_id` (FK to users.id)
   - `content` (TEXT)
   - `status` (ENUM: 'sent', 'delivered', 'seen')
   - `created_at` (TIMESTAMP)

4. **`friend_requests`**
   - `id` (PK, INT)
   - `sender_id` (FK to users.id)
   - `receiver_id` (FK to users.id)
   - `status` (ENUM: 'pending', 'accepted', 'rejected')
   - `created_at` (TIMESTAMP)

## Routing & Flow
Since the interface is highly cinematic, transitions between these states should be handled smoothly via JavaScript (Single Page App feel):
1. **Login/Register:** User arrives, is greeted with a bold, editorial typography intro, logs in or registers.
2. **Inbox:** Fades in upon successful login. Displays active chats.
3. **Chat:** Clicking a conversation smooth-slides the Chat Window over or alongside the Inbox.
4. **Add Friend:** Accessible via a subtle metallic '+' icon, dimming the background and bringing up a search prompt.
5. **Settings:** Accessible via the user's avatar, sliding in softly from the screen edge.

## Deliverables Checklist
- [ ] **Responsive Layout:** Adapts flawlessly from mobile devices up to ultra-wide desktop monitors.
- [ ] **Polished UI:** Adherence to defined dark aesthetic, *Playfair/DM Sans* combo, and custom scrollbars/input fields.
- [ ] **Cinematic Animations:** Implementation of fade-slide, message pop-ins, and button morphs using CSS keyframes/transitions.
- [ ] **PHP + MySQL Integration:** Functional backend supporting auth, friend management, and messaging.
- [ ] **Functional Chat Simulation:** Ability to log in as two different users and exchange messages.
- [ ] **Add Friend Feature:** User look-up, request sending, and request acceptance flow fully operational.
