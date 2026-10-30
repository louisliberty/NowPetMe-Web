<?php
declare(strict_types=1);

const CATEGORIES = ['dog', 'cat', 'bird', 'rabbit', 'fish', 'other'];
const PERSONALITY_TAGS = ['playful', 'lazy', 'mischievous', 'cuddly', 'energetic', 'shy', 'smart', 'goofy', 'majestic', 'derpy', 'sassy', 'adventurous'];
// Reaction emoji (heart stored with its variation selector, matching the React client).
const REACTION_EMOJIS = ["\u{2764}\u{FE0F}", "\u{1F602}", "\u{1F62E}", "\u{1F43E}", "\u{1F44F}"];

const BAYES_M = 10;
const XP_PER_VOTE = 5;
const XP_PER_UPLOAD = 50;
const XP_PER_COMMENT = 10;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const UPLOADS_PER_DAY = 5;
const REPORTS_TO_HIDE = 5;

const ACHIEVEMENT_DEFS = [
    'first_vote' => ['label' => 'First Vote', 'emoji' => "\u{1F5F3}\u{FE0F}", 'description' => 'Cast your first vote'],
    'vote_10' => ['label' => 'Voter', 'emoji' => "\u{1F43E}", 'description' => 'Cast 10 votes'],
    'vote_100' => ['label' => 'Super Voter', 'emoji' => "\u{2B50}", 'description' => 'Cast 100 votes'],
    'first_upload' => ['label' => 'Pet Parent', 'emoji' => "\u{1F436}", 'description' => 'Upload your first pet'],
    'first_comment' => ['label' => 'Conversationalist', 'emoji' => "\u{1F4AC}", 'description' => 'Post your first comment'],
    'streak_3' => ['label' => 'On a Roll', 'emoji' => "\u{1F525}", 'description' => 'Vote 3 days in a row'],
    'streak_7' => ['label' => 'Dedicated', 'emoji' => "\u{1F525}\u{1F525}", 'description' => 'Vote 7 days in a row'],
    'streak_30' => ['label' => 'Unstoppable', 'emoji' => "\u{1F525}\u{1F525}\u{1F525}", 'description' => 'Vote 30 days in a row'],
    'level_5' => ['label' => 'Rising Star', 'emoji' => "\u{1F31F}", 'description' => 'Reach level 5'],
    'level_10' => ['label' => 'Pet Pro', 'emoji' => "\u{1F3C6}", 'description' => 'Reach level 10'],
    'potd_owner' => ['label' => 'Pet of the Day', 'emoji' => "\u{1F451}", 'description' => 'Have a Pet of the Day'],
];

function xp_for_level(int $level): int
{
    return max(0, ($level - 1) * ($level - 1) * 50);
}

function level_from_xp(int $xp): int
{
    return max(1, 1 + (int)floor(sqrt(max(0, $xp) / 50)));
}

function canonical_emoji(string $emoji): ?string
{
    $strip = static fn(string $s) => str_replace("\u{FE0F}", '', $s);
    foreach (REACTION_EMOJIS as $e) {
        if ($strip($e) === $strip($emoji)) {
            return $e;
        }
    }
    return null;
}

/** @return array{0:?array,1:?string} [data, error] */
function validate_register(array $b): array
{
    $username = $b['username'] ?? null;
    $email = $b['email'] ?? null;
    $password = $b['password'] ?? null;
    if (!is_string($username)) {
        return [null, 'Username is required'];
    }
    $len = mb_strlen($username);
    if ($len < 3) {
        return [null, 'Username must be at least 3 characters'];
    }
    if ($len > 30) {
        return [null, 'Username must be 30 characters or fewer'];
    }
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
        return [null, 'Username can only contain letters, numbers, and underscores'];
    }
    $email = is_string($email) ? strtolower(trim($email)) : '';
    if ($email === '' || strlen($email) > 191 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return [null, 'Invalid email address'];
    }
    if (!is_string($password) || mb_strlen($password) < 6) {
        return [null, 'Password must be at least 6 characters'];
    }
    if (strlen($password) > 72) {
        return [null, 'Password must be 72 characters or fewer'];
    }
    return [['username' => $username, 'email' => $email, 'password' => $password], null];
}

function clean_text(mixed $v, int $max): ?string
{
    if (!is_string($v)) {
        return null;
    }
    $v = trim($v);
    if ($v === '') {
        return null;
    }
    return mb_substr($v, 0, $max);
}
