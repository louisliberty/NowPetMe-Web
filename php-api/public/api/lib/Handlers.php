<?php
declare(strict_types=1);

/** Route handlers. Each one ends by calling respond() (or throwing HttpError). */
final class Handlers
{
    // ---------------------------------------------------------------- auth

    public static function register(array $p): void
    {
        $ip = client_ip();
        if (!RateLimit::hit('register:' . $ip, 10, 3600)) {
            throw new HttpError(429, 'Too many sign-up attempts. Please try again later.');
        }
        [$data, $err] = validate_register(request_body());
        if ($err !== null) {
            throw new HttpError(400, $err);
        }
        if (Repo::userByEmail($data['email'])) {
            throw new HttpError(409, 'An account with this email already exists');
        }
        if (Repo::userByUsername($data['username'])) {
            throw new HttpError(409, 'This username is already taken');
        }

        $hash = password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 10]);
        $token = bin2hex(random_bytes(32));
        try {
            $user = Repo::createUser($data['username'], $data['email'], $hash, $token);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') { // lost a race on a unique key
                throw new HttpError(409, 'An account with this email or username already exists');
            }
            throw $e;
        }

        try {
            Mailer::verification($data['email'], $token);
        } catch (Throwable $e) {
            error_log('Failed to send verification email: ' . $e->getMessage());
        }

        Auth::login((int)$user['id']);
        respond(201, Repo::userOut($user));
    }

    public static function login(array $p): void
    {
        if (!RateLimit::hit('login:' . client_ip(), 20, 900)) {
            throw new HttpError(429, 'Too many login attempts. Please wait a few minutes and try again.');
        }
        $b = request_body();
        $email = is_string($b['email'] ?? null) ? strtolower(trim($b['email'])) : '';
        $password = $b['password'] ?? '';
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new HttpError(400, 'Invalid email address');
        }
        if (!is_string($password) || $password === '') {
            throw new HttpError(400, 'Password is required');
        }
        $user = Repo::userByEmail($email);
        // Always run a bcrypt verify so response time doesn't reveal whether the email exists.
        $hash = $user['password_hash'] ?? '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';
        $ok = password_verify($password, $hash);
        if (!$user || !$ok) {
            throw new HttpError(401, 'Invalid email or password');
        }
        Auth::login((int)$user['id']);
        respond(200, Repo::userOut($user));
    }

    public static function logout(array $p): void
    {
        Auth::logout();
        respond(200, ['message' => 'Logged out']);
    }

    public static function me(array $p): void
    {
        $id = Auth::userId();
        if ($id === null) {
            throw new HttpError(401, 'Not logged in');
        }
        $user = Repo::userById($id);
        if (!$user) {
            throw new HttpError(401, 'User not found');
        }
        respond(200, Repo::userOut($user));
    }

    public static function forgotPassword(array $p): void
    {
        if (!RateLimit::hit('forgot:' . client_ip(), 5, 3600)) {
            throw new HttpError(429, 'Too many requests. Please try again later.');
        }
        $email = request_body()['email'] ?? null;
        if (!is_string($email) || !filter_var(trim($email), FILTER_VALIDATE_EMAIL)) {
            throw new HttpError(400, 'Invalid email');
        }
        $user = Repo::userByEmail($email);
        if ($user) {
            $token = bin2hex(random_bytes(32));
            Repo::setResetToken((int)$user['id'], $token, gmdate('Y-m-d H:i:s', time() + 3600));
            try {
                Mailer::passwordReset($user['email'], $token);
            } catch (Throwable $e) {
                error_log('Reset email failed: ' . $e->getMessage());
            }
        }
        respond(200, ['message' => 'If that email exists, a reset link has been sent.']);
    }

    public static function resetPassword(array $p): void
    {
        $b = request_body();
        $token = $b['token'] ?? null;
        $password = $b['password'] ?? null;
        if (!is_string($token) || $token === '') {
            throw new HttpError(400, 'Invalid or expired reset link');
        }
        if (!is_string($password) || mb_strlen($password) < 6) {
            throw new HttpError(400, 'Password must be at least 6 characters');
        }
        if (strlen($password) > 72) {
            throw new HttpError(400, 'Password must be 72 characters or fewer');
        }
        $user = Repo::userByResetToken($token);
        if (!$user) {
            throw new HttpError(400, 'Invalid or expired reset link');
        }
        Repo::updatePassword((int)$user['id'], password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]));
        respond(200, ['message' => 'Password updated. You can now log in.']);
    }

    public static function verifyEmail(array $p): void
    {
        $token = $_GET['token'] ?? '';
        $ok = is_string($token) && $token !== '' && Repo::verifyByToken($token);
        header('Location: /?verified=' . ($ok ? 'success' : 'error'), true, 302);
        exit;
    }

    public static function resendVerification(array $p): void
    {
        $uid = Auth::require();
        $user = Repo::userById($uid);
        if (!$user) {
            throw new HttpError(404, 'User not found');
        }
        if ((int)$user['email_verified']) {
            respond(200, ['message' => 'Email already verified']);
        }
        if (!RateLimit::hit('resend:' . $uid, 5, 3600)) {
            throw new HttpError(429, 'Too many requests. Please try again later.');
        }
        $token = bin2hex(random_bytes(32));
        Repo::setVerificationToken($uid, $token);
        if (!Mailer::verification($user['email'], $token)) {
            throw new HttpError(500, 'Failed to resend verification email');
        }
        respond(200, ['message' => 'Verification email sent']);
    }

    // --------------------------------------------------------------- users

    public static function userProfile(array $p): void
    {
        $user = Repo::userByUsername(urldecode($p[1]));
        if (!$user) {
            throw new HttpError(404, 'User not found');
        }
        $pets = Repo::userPets((int)$user['id']);
        $xp = (int)$user['xp'];
        $lvl = level_from_xp($xp);
        $achievements = array_map(function ($a) {
            $def = ACHIEVEMENT_DEFS[$a['code']] ?? null;
            return [
                'code' => $a['code'],
                'unlockedAt' => iso($a['unlocked_at']),
                'label' => $def['label'] ?? $a['code'],
                'emoji' => $def['emoji'] ?? "\u{2B50}",
                'description' => $def['description'] ?? '',
            ];
        }, Repo::achievements((int)$user['id']));
        respond(200, [
            'username' => $user['username'],
            'bio' => $user['bio'],
            'xp' => $xp,
            'level' => $lvl,
            'xpForNextLevel' => xp_for_level($lvl + 1),
            'xpForCurrentLevel' => xp_for_level($lvl),
            'votingStreak' => (int)$user['voting_streak'],
            'createdAt' => iso($user['created_at']),
            'pets' => array_map([Repo::class, 'petOut'], $pets),
            'achievements' => $achievements,
            'totalVotesReceived' => array_sum(array_map(fn($x) => (int)$x['vote_count'], $pets)),
            'petCount' => count($pets),
        ]);
    }

    public static function updateProfile(array $p): void
    {
        $uid = Auth::require();
        $bio = request_body()['bio'] ?? null;
        if ($bio !== null) {
            if (!is_string($bio) || mb_strlen($bio) > 500) {
                throw new HttpError(400, 'Invalid data');
            }
            Repo::updateBio($uid, trim($bio));
        }
        respond(200, ['message' => 'Updated']);
    }

    // ---------------------------------------------------------------- pets

    private static function intParam(string $key, int $default, int $min, int $max): int
    {
        $v = $_GET[$key] ?? null;
        if (!is_string($v) || !preg_match('/^-?\d+$/', $v)) {
            return $default;
        }
        return max($min, min($max, (int)$v));
    }

    private static function categoryParam(): ?string
    {
        $c = $_GET['category'] ?? null;
        return is_string($c) && $c !== '' ? $c : null;
    }

    public static function listPets(array $p): void
    {
        $sort = is_string($_GET['sort'] ?? null) ? $_GET['sort'] : 'newest';
        $rows = Repo::pets(self::categoryParam(), $sort, self::intParam('limit', 12, 1, 100), self::intParam('offset', 0, 0, 1000000));
        respond(200, array_map([Repo::class, 'petOut'], $rows));
    }

    public static function petCount(array $p): void
    {
        respond(200, ['count' => Repo::petCount(self::categoryParam())]);
    }

    public static function randomPet(array $p): void
    {
        $pet = Repo::randomPet();
        if (!$pet) {
            throw new HttpError(404, 'No pets available');
        }
        respond(200, Repo::petOut($pet));
    }

    public static function hotPets(array $p): void
    {
        $rows = Repo::hotPets(self::intParam('limit', 12, 1, 50));
        respond(200, array_map(fn($r) => Repo::petOut($r) + ['recentVotes' => (int)$r['recent_votes']], $rows));
    }

    public static function topPets(array $p): void
    {
        $rows = Repo::topPets(self::intParam('limit', 10, 1, 100), self::categoryParam());
        respond(200, array_map([Repo::class, 'petOut'], $rows));
    }

    public static function petOfTheDay(array $p): void
    {
        $res = Repo::petOfTheDay();
        if (!$res) {
            respond(200, null);
        }
        $pet = $res['pet'];
        if ($res['isNew'] && $pet['owner_id'] !== null) {
            $ownerId = (int)$pet['owner_id'];
            Repo::unlockAchievement($ownerId, 'potd_owner');
            $owner = Repo::userById($ownerId);
            if ($owner && (int)$owner['email_verified']) {
                after_response(fn() => Mailer::petOfTheDay($owner['email'], $pet));
            }
        }
        respond(200, Repo::petOut($pet));
    }

    public static function getPet(array $p): void
    {
        $pet = Repo::pet((int)$p[1]);
        if (!$pet || (int)$pet['hidden']) {
            throw new HttpError(404, 'Pet not found');
        }
        respond(200, Repo::petOut($pet) + ['hasVoted' => Repo::hasVoted((int)$pet['id'], ip_hash())]);
    }

    public static function createPet(array $p): void
    {
        $uid = Auth::require();
        $user = Repo::userById($uid);
        if (!$user || !(int)$user['email_verified']) {
            throw new HttpError(403, 'Please verify your email before uploading');
        }
        $ip = ip_hash();
        if (Repo::uploadCountToday($ip, $uid) >= UPLOADS_PER_DAY) {
            throw new HttpError(429, 'Upload limit reached (5 per day)');
        }

        // --- validate text fields before spending an AI moderation call
        $b = $_POST;
        $name = clean_text($b['name'] ?? null, 50);
        if ($name === null) {
            throw new HttpError(400, 'Pet name is required');
        }
        $category = $b['category'] ?? null;
        if (!is_string($category) || !in_array($category, CATEGORIES, true)) {
            throw new HttpError(400, 'Please choose a valid category');
        }
        $breed = clean_text($b['breed'] ?? null, 80);
        $story = clean_text($b['story'] ?? null, 280);
        $tags = [];
        $raw = $b['personalityTags'] ?? null;
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            $tags = is_array($decoded) ? $decoded : [];
        } elseif (is_array($raw)) {
            $tags = $raw;
        }
        $tags = array_values(array_unique(array_filter($tags, fn($t) => is_string($t) && in_array($t, PERSONALITY_TAGS, true))));
        $tags = array_slice($tags, 0, 5);

        // --- validate the file
        $file = $_FILES['photo'] ?? null;
        if (!$file && empty($_POST) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
            throw new HttpError(400, 'Photo must be 5MB or smaller');
        }
        if (!$file || $file['error'] === UPLOAD_ERR_NO_FILE) {
            throw new HttpError(400, 'Photo is required');
        }
        if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE || $file['size'] > MAX_UPLOAD_BYTES) {
            throw new HttpError(400, 'Photo must be 5MB or smaller');
        }
        if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
            throw new HttpError(400, 'Photo upload failed. Please try again.');
        }
        $mime = Images::detectMime($file['tmp_name']);
        if ($mime === null) {
            throw new HttpError(400, 'Photo must be a JPG, PNG, GIF or WebP image');
        }

        $stored = Images::store($file['tmp_name'], $mime);
        $path = uploads_dir() . '/' . $stored;

        $moderation = Moderation::check($path);
        if (!$moderation['approved']) {
            @unlink($path);
            throw new HttpError(400, 'Photo rejected: ' . $moderation['reason']);
        }

        $pet = Repo::createPet([
            'name' => $name, 'category' => $category, 'breed' => $breed, 'story' => $story,
            'tags' => $tags, 'photo_url' => '/uploads/' . $stored,
        ], $ip, $uid);

        $xp = Repo::addXp($uid, XP_PER_UPLOAD);
        $newAch = $xp['newAchievements'];
        if (Repo::unlockAchievement($uid, 'first_upload')) {
            $newAch[] = 'first_upload';
        }
        respond(201, Repo::petOut($pet) + ['_xp' => $xp, '_newAchievements' => $newAch]);
    }

    public static function vote(array $p): void
    {
        $petId = (int)$p[1];
        $score = request_body()['score'] ?? null;
        if (is_string($score) && preg_match('/^\d+$/', $score)) {
            $score = (int)$score;
        }
        if (!is_int($score)) {
            throw new HttpError(400, 'Score must be a whole number');
        }
        if ($score < 1 || $score > 10) {
            throw new HttpError(400, 'Score must be between 1 and 10');
        }
        $pet = Repo::pet($petId);
        if (!$pet || (int)$pet['hidden']) {
            throw new HttpError(404, 'Pet not found');
        }
        if (!Repo::castVote($petId, $score, ip_hash())) {
            throw new HttpError(409, 'You already voted for this pet');
        }

        $xpResult = null;
        $streakResult = null;
        $newAch = [];
        $uid = Auth::userId();
        if ($uid !== null) {
            $xpResult = Repo::addXp($uid, XP_PER_VOTE);
            $streakResult = Repo::updateVotingStreak($uid);
            $milestones = Repo::incrementVotesCast($uid);
            $newAch = array_merge($xpResult['newAchievements'], $streakResult['newAchievements'], $milestones['newAchievements']);
            if (Repo::unlockAchievement($uid, 'first_vote')) {
                $newAch[] = 'first_vote';
            }
        }
        respond(200, Repo::petOut(Repo::pet($petId)) + [
            '_xp' => $xpResult, '_streak' => $streakResult, '_newAchievements' => $newAch,
        ]);
    }

    // ------------------------------------------------------------ comments

    public static function listComments(array $p): void
    {
        respond(200, Repo::comments((int)$p[1], ip_hash()));
    }

    public static function createComment(array $p): void
    {
        $uid = Auth::require();
        $user = Repo::userById($uid);
        if (!$user || !(int)$user['email_verified']) {
            throw new HttpError(403, 'Please verify your email before commenting');
        }
        $petId = (int)$p[1];
        $text = request_body()['text'] ?? null;
        $text = is_string($text) ? trim($text) : '';
        if ($text === '' || mb_strlen($text) > 50) {
            throw new HttpError(400, 'Comment must be 1-50 characters');
        }
        $pet = Repo::pet($petId);
        if (!$pet || (int)$pet['hidden']) {
            throw new HttpError(404, 'Pet not found');
        }
        $comment = Repo::createComment($petId, $text, ip_hash(), $uid);
        $xp = Repo::addXp($uid, XP_PER_COMMENT);
        $newAch = $xp['newAchievements'];
        if (Repo::unlockAchievement($uid, 'first_comment')) {
            $newAch[] = 'first_comment';
        }
        respond(201, Repo::commentOut($comment) + ['_xp' => $xp, '_newAchievements' => $newAch]);
    }

    private static function ownedComment(int $id, string $verb): array
    {
        $uid = Auth::require();
        $comment = Repo::comment($id);
        if (!$comment) {
            throw new HttpError(404, 'Comment not found');
        }
        if ((int)$comment['user_id'] !== $uid) {
            throw new HttpError(403, "You can only $verb your own comments");
        }
        return $comment;
    }

    public static function editComment(array $p): void
    {
        $id = (int)$p[1];
        self::ownedComment($id, 'edit');
        $text = request_body()['text'] ?? null;
        $text = is_string($text) ? trim($text) : '';
        if ($text === '' || mb_strlen($text) > 50) {
            throw new HttpError(400, 'Comment must be 1-50 characters');
        }
        respond(200, Repo::commentOut(Repo::updateComment($id, $text)));
    }

    public static function deleteComment(array $p): void
    {
        $id = (int)$p[1];
        self::ownedComment($id, 'delete');
        Repo::deleteComment($id);
        respond(200, ['message' => 'Comment deleted']);
    }

    public static function likeComment(array $p): void
    {
        $id = (int)$p[1];
        if (!Repo::comment($id)) {
            throw new HttpError(404, 'Comment not found');
        }
        [$count, $liked] = Repo::toggleLike($id, ip_hash());
        respond(200, ['likeCount' => $count, 'hasLiked' => $liked]);
    }

    public static function reactToComment(array $p): void
    {
        $id = (int)$p[1];
        $emoji = request_body()['emoji'] ?? '';
        $canonical = is_string($emoji) ? canonical_emoji($emoji) : null;
        if ($canonical === null) {
            throw new HttpError(400, 'Invalid emoji');
        }
        if (!Repo::comment($id)) {
            throw new HttpError(404, 'Comment not found');
        }
        respond(200, ['added' => Repo::toggleReaction($id, ip_hash(), $canonical)]);
    }

    // ------------------------------------------------------------- reports

    public static function report(array $p): void
    {
        $b = request_body();
        $type = $b['targetType'] ?? null;
        $targetId = $b['targetId'] ?? null;
        $reason = $b['reason'] ?? null;
        if (!in_array($type, ['pet', 'comment'], true) || !is_int($targetId) || $targetId < 1
            || ($reason !== null && (!is_string($reason) || mb_strlen($reason) > 500))) {
            throw new HttpError(400, 'Invalid report');
        }
        if (!RateLimit::hit('report:' . client_ip(), 30, 3600)) {
            throw new HttpError(429, 'Too many reports. Please try again later.');
        }
        $exists = $type === 'pet' ? Repo::pet($targetId) : Repo::comment($targetId);
        if (!$exists) {
            throw new HttpError(404, 'Not found');
        }
        respond(200, Repo::createReport($type, $targetId, ip_hash(), $reason === null ? null : trim($reason)));
    }
}
