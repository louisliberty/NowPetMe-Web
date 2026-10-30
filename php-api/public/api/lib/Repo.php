<?php
declare(strict_types=1);

/** Database access + shape conversion. Output arrays match the JSON the React client already expects. */
final class Repo
{
    // ---------- shaping ----------

    public static function userOut(array $u): array
    {
        $xp = (int)$u['xp'];
        $lvl = level_from_xp($xp);
        return [
            'id' => (int)$u['id'],
            'username' => $u['username'],
            'email' => $u['email'],
            'emailVerified' => (bool)$u['email_verified'],
            'xp' => $xp,
            'level' => $lvl,
            'xpForNextLevel' => xp_for_level($lvl + 1),
            'xpForCurrentLevel' => xp_for_level($lvl),
            'votingStreak' => (int)$u['voting_streak'],
            'bio' => $u['bio'],
        ];
    }

    public static function petOut(array $r): array
    {
        $tags = json_decode((string)($r['personality_tags'] ?? '[]'), true);
        return [
            'id' => (int)$r['id'],
            'name' => $r['name'],
            'category' => $r['category'],
            'breed' => $r['breed'],
            'photoUrl' => $r['photo_url'],
            'story' => $r['story'],
            'personalityTags' => is_array($tags) ? array_values($tags) : [],
            'totalScore' => (int)$r['total_score'],
            'voteCount' => (int)$r['vote_count'],
            'bayesianScore' => (float)$r['bayesian_score'],
            'reportCount' => (int)$r['report_count'],
            'hidden' => (bool)$r['hidden'],
            'ownerId' => $r['owner_id'] === null ? null : (int)$r['owner_id'],
            'createdAt' => iso($r['created_at']),
        ];
    }

    // ---------- users ----------

    public static function userById(int $id): ?array
    {
        return Db::one('SELECT * FROM users WHERE id = ?', [$id]);
    }

    public static function userByEmail(string $email): ?array
    {
        return Db::one('SELECT * FROM users WHERE email = ?', [strtolower(trim($email))]);
    }

    public static function userByUsername(string $username): ?array
    {
        return Db::one('SELECT * FROM users WHERE username = ?', [$username]);
    }

    public static function createUser(string $username, string $email, string $passwordHash, string $verificationToken): array
    {
        $id = Db::insert('users', [
            'username' => $username,
            'email' => $email,
            'password_hash' => $passwordHash,
            'verification_hash' => hash('sha256', $verificationToken),
            'created_at' => now_utc(),
        ]);
        return self::userById($id);
    }

    public static function setVerificationToken(int $userId, string $token): void
    {
        Db::exec('UPDATE users SET verification_hash = ? WHERE id = ?', [hash('sha256', $token), $userId]);
    }

    public static function verifyByToken(string $token): bool
    {
        return Db::exec(
            'UPDATE users SET email_verified = 1, verification_hash = NULL WHERE verification_hash = ?',
            [hash('sha256', $token)]
        ) > 0;
    }

    public static function setResetToken(int $userId, string $token, string $expiresAt): void
    {
        Db::exec('UPDATE users SET reset_hash = ?, reset_expires = ? WHERE id = ?', [hash('sha256', $token), $expiresAt, $userId]);
    }

    public static function userByResetToken(string $token): ?array
    {
        return Db::one(
            'SELECT * FROM users WHERE reset_hash = ? AND reset_expires > ?',
            [hash('sha256', $token), now_utc()]
        );
    }

    public static function updatePassword(int $userId, string $hash): void
    {
        Db::exec('UPDATE users SET password_hash = ?, reset_hash = NULL, reset_expires = NULL WHERE id = ?', [$hash, $userId]);
    }

    public static function updateBio(int $userId, string $bio): void
    {
        Db::exec('UPDATE users SET bio = ? WHERE id = ?', [$bio, $userId]);
    }

    // ---------- pets ----------

    public static function pet(int $id): ?array
    {
        return Db::one('SELECT * FROM pets WHERE id = ?', [$id]);
    }

    public static function pets(?string $category, string $sort, int $limit, int $offset): array
    {
        $where = 'hidden = 0';
        $params = [];
        if ($category !== null && $category !== '') {
            $where .= ' AND category = ?';
            $params[] = $category;
        }
        $order = match ($sort) {
            'highest', 'top-rated' => 'bayesian_score DESC, id DESC',
            'most_votes' => 'vote_count DESC, id DESC',
            default => 'created_at DESC, id DESC',
        };
        $params[] = $limit;
        $params[] = $offset;
        return Db::all("SELECT * FROM pets WHERE $where ORDER BY $order LIMIT ? OFFSET ?", $params);
    }

    public static function topPets(int $limit, ?string $category): array
    {
        $where = 'vote_count > 0 AND hidden = 0';
        $params = [];
        if ($category !== null && $category !== '') {
            $where .= ' AND category = ?';
            $params[] = $category;
        }
        $params[] = $limit;
        return Db::all("SELECT * FROM pets WHERE $where ORDER BY bayesian_score DESC, id DESC LIMIT ?", $params);
    }

    public static function petCount(?string $category): int
    {
        if ($category !== null && $category !== '') {
            return (int)Db::val('SELECT COUNT(*) FROM pets WHERE hidden = 0 AND category = ?', [$category]);
        }
        return (int)Db::val('SELECT COUNT(*) FROM pets WHERE hidden = 0');
    }

    public static function randomPet(): ?array
    {
        return Db::one('SELECT * FROM pets WHERE hidden = 0 ORDER BY ' . Db::random() . ' LIMIT 1');
    }

    public static function hotPets(int $limit): array
    {
        $since = gmdate('Y-m-d H:i:s', time() - 7 * 86400);
        return Db::all(
            'SELECT p.*, COALESCE(v.recent, 0) AS recent_votes
             FROM pets p
             LEFT JOIN (SELECT pet_id, COUNT(*) AS recent FROM votes WHERE created_at >= ? GROUP BY pet_id) v ON v.pet_id = p.id
             WHERE p.hidden = 0
             ORDER BY COALESCE(v.recent, 0) DESC, p.bayesian_score DESC, p.id DESC
             LIMIT ?',
            [$since, $limit]
        );
    }

    public static function userPets(int $userId): array
    {
        return Db::all('SELECT * FROM pets WHERE owner_id = ? AND hidden = 0 ORDER BY created_at DESC, id DESC', [$userId]);
    }

    public static function createPet(array $d, string $ownerIp, int $ownerId): array
    {
        $id = Db::insert('pets', [
            'name' => $d['name'],
            'category' => $d['category'],
            'breed' => $d['breed'],
            'photo_url' => $d['photo_url'],
            'story' => $d['story'],
            'personality_tags' => json_encode($d['tags']),
            'bayesian_score' => self::globalAverage(),
            'owner_ip' => $ownerIp,
            'owner_id' => $ownerId,
            'created_at' => now_utc(),
        ]);
        return self::pet($id);
    }

    public static function uploadCountToday(string $ip, int $userId): int
    {
        $midnight = gmdate('Y-m-d 00:00:00');
        return (int)Db::val(
            'SELECT COUNT(*) FROM pets WHERE (owner_ip = ? OR owner_id = ?) AND created_at >= ?',
            [$ip, $userId, $midnight]
        );
    }

    // ---------- Pet of the Day ----------

    /** @return array{pet:array,isNew:bool}|null */
    public static function petOfTheDay(): ?array
    {
        $today = gmdate('Y-m-d');
        $existing = Db::one('SELECT pet_id FROM pet_of_the_day WHERE `date` = ?', [$today]);
        if ($existing) {
            return self::potdResult((int)$existing['pet_id'], false);
        }

        $since = gmdate('Y-m-d', time() - 30 * 86400);
        $ids = array_map(fn($r) => (int)$r['pet_id'], Db::all('SELECT pet_id FROM pet_of_the_day WHERE `date` >= ?', [$since]));

        $pick = null;
        if ($ids) {
            $marks = implode(',', array_fill(0, count($ids), '?'));
            $pick = Db::one(
                "SELECT * FROM pets WHERE vote_count > 0 AND hidden = 0 AND id NOT IN ($marks) ORDER BY bayesian_score DESC, id ASC LIMIT 1",
                $ids
            );
        }
        if (!$pick) {
            $pick = Db::one('SELECT * FROM pets WHERE vote_count > 0 AND hidden = 0 ORDER BY bayesian_score DESC, id ASC LIMIT 1');
        }
        if (!$pick) {
            return null;
        }
        if (Db::insertIgnore('pet_of_the_day', ['pet_id' => (int)$pick['id'], 'date' => $today])) {
            return ['pet' => $pick, 'isNew' => true];
        }
        // Another request picked first.
        $again = Db::one('SELECT pet_id FROM pet_of_the_day WHERE `date` = ?', [$today]);
        return $again ? self::potdResult((int)$again['pet_id'], false) : ['pet' => $pick, 'isNew' => false];
    }

    private static function potdResult(int $petId, bool $isNew): ?array
    {
        $pet = self::pet($petId);
        return ($pet && !(int)$pet['hidden']) ? ['pet' => $pet, 'isNew' => $isNew] : null;
    }

    // ---------- votes / ranking ----------

    public static function hasVoted(int $petId, string $ip): bool
    {
        return Db::one('SELECT 1 AS x FROM votes WHERE pet_id = ? AND voter_ip = ?', [$petId, $ip]) !== null;
    }

    public static function globalAverage(): float
    {
        $row = Db::one('SELECT SUM(total_score) AS s, SUM(vote_count) AS c FROM pets WHERE vote_count > 0');
        $c = (int)($row['c'] ?? 0);
        return $c > 0 ? ((float)$row['s']) / $c : 5.0;
    }

    /** Returns false if this IP has already voted for the pet. */
    public static function castVote(int $petId, int $score, string $ip): bool
    {
        return (bool)Db::tx(function () use ($petId, $score, $ip) {
            $inserted = Db::insertIgnore('votes', ['pet_id' => $petId, 'voter_ip' => $ip, 'score' => $score, 'created_at' => now_utc()]);
            if (!$inserted) {
                return false;
            }
            Db::exec('UPDATE pets SET total_score = total_score + ?, vote_count = vote_count + 1 WHERE id = ?', [$score, $petId]);
            self::recalcBayesian();
            return true;
        });
    }

    /**
     * Bayesian weighted score: (v/(v+m))*R + (m/(v+m))*C
     * v = votes, R = pet's average, m = BAYES_M, C = global average.
     */
    public static function recalcBayesian(): void
    {
        $m = BAYES_M;
        $c = self::globalAverage();
        Db::exec(
            'UPDATE pets SET bayesian_score =
               (vote_count * 1e0 / (vote_count + ?)) * (CASE WHEN vote_count > 0 THEN total_score * 1e0 / vote_count ELSE 0 END)
               + (? * 1e0 / (vote_count + ?)) * ?',
            [$m, $m, $m, $c]
        );
    }

    // ---------- comments ----------

    public static function comment(int $id): ?array
    {
        return Db::one('SELECT * FROM comments WHERE id = ?', [$id]);
    }

    public static function comments(int $petId, string $ip): array
    {
        $rows = Db::all(
            'SELECT c.id, c.pet_id, c.text, c.user_id, c.created_at, u.username,
                    (SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = c.id) AS like_count,
                    EXISTS(SELECT 1 FROM comment_likes m WHERE m.comment_id = c.id AND m.voter_ip = ?) AS has_liked
             FROM comments c LEFT JOIN users u ON u.id = c.user_id
             WHERE c.pet_id = ?
             ORDER BY c.created_at DESC, c.id DESC',
            [$ip, $petId]
        );
        $reactions = self::reactionsFor(array_map(fn($r) => (int)$r['id'], $rows), $ip);
        return array_map(fn($r) => [
            'id' => (int)$r['id'],
            'petId' => (int)$r['pet_id'],
            'text' => $r['text'],
            'userId' => $r['user_id'] === null ? null : (int)$r['user_id'],
            'createdAt' => iso($r['created_at']),
            'username' => $r['username'],
            'likeCount' => (int)$r['like_count'],
            'hasLiked' => (bool)$r['has_liked'],
            'reactions' => $reactions[(int)$r['id']] ?? [],
        ], $rows);
    }

    public static function commentOut(array $r): array
    {
        return [
            'id' => (int)$r['id'],
            'petId' => (int)$r['pet_id'],
            'text' => $r['text'],
            'userId' => $r['user_id'] === null ? null : (int)$r['user_id'],
            'createdAt' => iso($r['created_at']),
        ];
    }

    public static function createComment(int $petId, string $text, string $ip, int $userId): array
    {
        $id = Db::insert('comments', [
            'pet_id' => $petId, 'text' => $text, 'commenter_ip' => $ip, 'user_id' => $userId, 'created_at' => now_utc(),
        ]);
        return self::comment($id);
    }

    public static function updateComment(int $id, string $text): array
    {
        Db::exec('UPDATE comments SET text = ? WHERE id = ?', [$text, $id]);
        return self::comment($id);
    }

    public static function deleteComment(int $id): void
    {
        Db::tx(function () use ($id) {
            Db::exec('DELETE FROM comment_likes WHERE comment_id = ?', [$id]);
            Db::exec('DELETE FROM comment_reactions WHERE comment_id = ?', [$id]);
            Db::exec('DELETE FROM comments WHERE id = ?', [$id]);
        });
    }

    /** Toggle a like; returns [likeCount, hasLiked]. */
    public static function toggleLike(int $commentId, string $ip): array
    {
        $has = Db::one('SELECT 1 AS x FROM comment_likes WHERE comment_id = ? AND voter_ip = ?', [$commentId, $ip]) !== null;
        if ($has) {
            Db::exec('DELETE FROM comment_likes WHERE comment_id = ? AND voter_ip = ?', [$commentId, $ip]);
        } else {
            Db::insertIgnore('comment_likes', ['comment_id' => $commentId, 'voter_ip' => $ip, 'created_at' => now_utc()]);
        }
        $count = (int)Db::val('SELECT COUNT(*) FROM comment_likes WHERE comment_id = ?', [$commentId]);
        return [$count, !$has];
    }

    /** @return array<int,array<int,array{emoji:string,count:int,mine:bool}>> */
    public static function reactionsFor(array $commentIds, string $ip): array
    {
        if (!$commentIds) {
            return [];
        }
        $marks = implode(',', array_fill(0, count($commentIds), '?'));
        $rows = Db::all(
            "SELECT comment_id, emoji, COUNT(*) AS cnt, MAX(CASE WHEN voter_ip = ? THEN 1 ELSE 0 END) AS mine
             FROM comment_reactions WHERE comment_id IN ($marks)
             GROUP BY comment_id, emoji ORDER BY MIN(id)",
            array_merge([$ip], $commentIds)
        );
        $out = [];
        foreach ($rows as $r) {
            $out[(int)$r['comment_id']][] = ['emoji' => $r['emoji'], 'count' => (int)$r['cnt'], 'mine' => (bool)$r['mine']];
        }
        return $out;
    }

    /** Returns true if the reaction was added, false if it was removed. */
    public static function toggleReaction(int $commentId, string $ip, string $emoji): bool
    {
        $deleted = Db::exec('DELETE FROM comment_reactions WHERE comment_id = ? AND voter_ip = ? AND emoji = ?', [$commentId, $ip, $emoji]);
        if ($deleted > 0) {
            return false;
        }
        Db::insertIgnore('comment_reactions', ['comment_id' => $commentId, 'voter_ip' => $ip, 'emoji' => $emoji, 'created_at' => now_utc()]);
        return true;
    }

    // ---------- XP / achievements ----------

    public static function unlockAchievement(int $userId, string $code): bool
    {
        return Db::insertIgnore('achievements', ['user_id' => $userId, 'code' => $code, 'unlocked_at' => now_utc()]);
    }

    public static function achievements(int $userId): array
    {
        return Db::all('SELECT code, unlocked_at FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC, id DESC', [$userId]);
    }

    /** @return array{xp:int,level:int,leveledUp:bool,newAchievements:string[]} */
    public static function addXp(int $userId, int $delta): array
    {
        $before = self::userById($userId);
        if (!$before) {
            return ['xp' => 0, 'level' => 1, 'leveledUp' => false, 'newAchievements' => []];
        }
        $oldLevel = level_from_xp((int)$before['xp']);
        Db::exec('UPDATE users SET xp = xp + ? WHERE id = ?', [$delta, $userId]);
        $newXp = (int)Db::val('SELECT xp FROM users WHERE id = ?', [$userId]);
        $newLevel = level_from_xp($newXp);
        $new = [];
        foreach ([5 => 'level_5', 10 => 'level_10'] as $lvl => $code) {
            if ($newLevel >= $lvl && $oldLevel < $lvl && self::unlockAchievement($userId, $code)) {
                $new[] = $code;
            }
        }
        return ['xp' => $newXp, 'level' => $newLevel, 'leveledUp' => $newLevel > $oldLevel, 'newAchievements' => $new];
    }

    /** @return array{count:int,newAchievements:string[]} */
    public static function incrementVotesCast(int $userId): array
    {
        Db::exec('UPDATE users SET votes_cast = votes_cast + 1 WHERE id = ?', [$userId]);
        $count = (int)Db::val('SELECT votes_cast FROM users WHERE id = ?', [$userId]);
        $new = [];
        foreach ([10 => 'vote_10', 100 => 'vote_100'] as $threshold => $code) {
            if ($count >= $threshold && self::unlockAchievement($userId, $code)) {
                $new[] = $code;
            }
        }
        return ['count' => $count, 'newAchievements' => $new];
    }

    /** @return array{streak:int,newAchievements:string[]} */
    public static function updateVotingStreak(int $userId): array
    {
        $u = self::userById($userId);
        if (!$u) {
            return ['streak' => 0, 'newAchievements' => []];
        }
        $today = gmdate('Y-m-d');
        $last = $u['last_vote_date'] !== null ? substr((string)$u['last_vote_date'], 0, 10) : null;
        if ($last === $today) {
            return ['streak' => (int)$u['voting_streak'], 'newAchievements' => []];
        }
        $yesterday = gmdate('Y-m-d', time() - 86400);
        $streak = $last === $yesterday ? (int)$u['voting_streak'] + 1 : 1;
        Db::exec('UPDATE users SET voting_streak = ?, last_vote_date = ? WHERE id = ?', [$streak, $today, $userId]);
        $new = [];
        foreach ([3 => 'streak_3', 7 => 'streak_7', 30 => 'streak_30'] as $threshold => $code) {
            if ($streak >= $threshold && self::unlockAchievement($userId, $code)) {
                $new[] = $code;
            }
        }
        return ['streak' => $streak, 'newAchievements' => $new];
    }

    // ---------- reports ----------

    /** @return array{created:bool,hidden:bool} */
    public static function createReport(string $type, int $targetId, string $ip, ?string $reason): array
    {
        Db::insertIgnore('reports', [
            'target_type' => $type, 'target_id' => $targetId, 'reporter_ip' => $ip, 'reason' => $reason, 'created_at' => now_utc(),
        ]);
        if ($type === 'pet') {
            $cnt = (int)Db::val("SELECT COUNT(*) FROM reports WHERE target_type = 'pet' AND target_id = ?", [$targetId]);
            Db::exec('UPDATE pets SET report_count = ? WHERE id = ?', [$cnt, $targetId]);
            if ($cnt >= REPORTS_TO_HIDE) {
                Db::exec('UPDATE pets SET hidden = 1 WHERE id = ?', [$targetId]);
                return ['created' => true, 'hidden' => true];
            }
        }
        return ['created' => true, 'hidden' => false];
    }
}
