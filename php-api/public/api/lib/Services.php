<?php
declare(strict_types=1);

function e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** POST JSON with cURL. Returns [httpStatus, decodedBody|null]. */
function http_post_json(string $url, array $payload, array $headers, int $timeout): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => $timeout,
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    if ($body === false) {
        error_log('HTTP request to ' . $url . ' failed: ' . curl_error($ch));
    }
    curl_close($ch);
    return [$status, is_string($body) ? json_decode($body, true) : null];
}

final class Mailer
{
    public static function send(string $to, string $subject, string $html): bool
    {
        $key = (string)config('resend_api_key', '');
        $from = (string)config('from_email', 'NowPetMe <onboarding@resend.dev>');

        if ($key === '') {
            // Development fallback: append the email to a log file instead of sending it.
            $log = (string)config('mail_log_file', '');
            if ($log !== '') {
                file_put_contents($log, "TO: $to\nSUBJECT: $subject\n$html\n-----\n", FILE_APPEND);
                return true;
            }
            error_log('Mailer: resend_api_key is not configured, email to ' . $to . ' not sent');
            return false;
        }

        [$status, $body] = http_post_json(
            'https://api.resend.com/emails',
            ['from' => $from, 'to' => [$to], 'subject' => $subject, 'html' => $html],
            ['Authorization: Bearer ' . $key],
            15
        );
        if ($status < 200 || $status >= 300) {
            error_log('Resend error ' . $status . ': ' . json_encode($body));
            return false;
        }
        return true;
    }

    public static function verification(string $to, string $token): bool
    {
        $url = e(base_url() . '/api/auth/verify?token=' . $token);
        $html = <<<HTML
<div style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <div style="display: inline-block; width: 48px; height: 48px; border-radius: 50%; background: #f87171; line-height: 48px; text-align: center;">
      <span style="color: white; font-size: 24px;">&#10084;</span>
    </div>
    <h1 style="margin: 12px 0 0; font-size: 24px; color: #1a1a1a;">NowPetMe</h1>
  </div>
  <h2 style="font-size: 20px; color: #1a1a1a; text-align: center;">Verify your email</h2>
  <p style="color: #555; font-size: 15px; line-height: 1.6; text-align: center;">
    Click the button below to verify your email address and start sharing your pets with the world!
  </p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="$url" style="display: inline-block; background: #f87171; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">Verify Email</a>
  </div>
  <p style="color: #999; font-size: 13px; text-align: center;">If you didn't create an account, you can safely ignore this email.</p>
</div>
HTML;
        return self::send($to, 'Verify your NowPetMe account', $html);
    }

    public static function passwordReset(string $to, string $token): bool
    {
        $url = e(base_url() . '/reset-password?token=' . $token);
        $html = <<<HTML
<div style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
  <h1 style="color: #FF6B6B; margin-bottom: 12px;">Reset your password</h1>
  <p style="color: #333; font-size: 15px; line-height: 1.6;">
    Someone (hopefully you!) requested a password reset for your NowPetMe account. Click the button below to choose a new password. This link expires in 1 hour.
  </p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="$url" style="display: inline-block; background: #FF6B6B; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600;">Reset Password</a>
  </div>
  <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
</div>
HTML;
        return self::send($to, 'Reset your NowPetMe password', $html);
    }

    public static function petOfTheDay(string $to, array $pet): bool
    {
        $votes = (int)$pet['vote_count'];
        $avg = $votes > 0 ? number_format(((int)$pet['total_score']) / $votes, 1) : '0.0';
        $name = e((string)$pet['name']);
        $url = e(base_url() . '/pet/' . (int)$pet['id']);
        $label = $votes === 1 ? 'vote' : 'votes';
        $html = <<<HTML
<div style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <div style="font-size: 56px;">&#128081;</div>
    <h1 style="margin: 8px 0 0; font-size: 26px; color: #1a1a1a;">Pet of the Day!</h1>
  </div>
  <p style="color: #333; font-size: 16px; line-height: 1.6; text-align: center;">
    Huge congrats &mdash; <strong>$name</strong> has been crowned today's Pet of the Day on NowPetMe! &#127881;
  </p>
  <div style="background: linear-gradient(135deg, #FF6B6B22, #4ECDC422); border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
    <div style="font-size: 14px; color: #555;">Current rating</div>
    <div style="font-size: 32px; font-weight: 700; color: #1a1a1a;">&#11088; $avg / 10</div>
    <div style="font-size: 13px; color: #666; margin-top: 4px;">$votes $label</div>
  </div>
  <div style="text-align: center; margin: 28px 0;">
    <a href="$url" style="display: inline-block; background: #FF6B6B; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">View {$name}'s page</a>
  </div>
  <p style="color: #555; font-size: 14px; line-height: 1.6; text-align: center;">
    Now's the perfect time to share $name on social media and rack up votes while they're in the spotlight!
  </p>
</div>
HTML;
        return self::send($to, "\u{1F389} " . $pet['name'] . " is today's Pet of the Day on NowPetMe!", $html);
    }
}

final class Moderation
{
    private const PROMPT = 'You are an image moderator for a pet photo website called NowPetMe. Analyze the uploaded image and respond with a JSON object: {"approved": true/false, "reason": "brief explanation"}.

Rules:
- APPROVE if the image contains a pet animal (dog, cat, bird, rabbit, fish, hamster, turtle, lizard, etc.)
- REJECT if the image is a selfie or photo of a human without any pet
- REJECT if the image contains offensive, violent, or inappropriate content
- REJECT if the image does not contain any animal at all (e.g. food, objects, landscapes)
- If a human appears WITH a pet, that is acceptable - APPROVE it
- Respond ONLY with the JSON object, no other text.';

    /** @return array{approved:bool,reason:string} */
    public static function check(string $imagePath): array
    {
        if (config('moderation', 'openai') === 'off') {
            return ['approved' => true, 'reason' => 'moderation disabled'];
        }
        $key = (string)config('openai_api_key', '');
        if ($key === '') {
            error_log('Moderation: openai_api_key is not configured');
            return ['approved' => false, 'reason' => 'Image moderation service unavailable. Please try again later.'];
        }

        $dataUrl = 'data:image/jpeg;base64,' . base64_encode(Images::moderationJpeg($imagePath));
        [$status, $body] = http_post_json(
            'https://api.openai.com/v1/chat/completions',
            [
                'model' => 'gpt-4o-mini',
                'max_tokens' => 150,
                'messages' => [
                    ['role' => 'system', 'content' => self::PROMPT],
                    ['role' => 'user', 'content' => [['type' => 'image_url', 'image_url' => ['url' => $dataUrl, 'detail' => 'low']]]],
                ],
            ],
            ['Authorization: Bearer ' . $key],
            40
        );
        $unavailable = ['approved' => false, 'reason' => 'Image moderation service unavailable. Please try again later.'];
        if ($status !== 200 || !is_array($body)) {
            error_log('Moderation: OpenAI returned HTTP ' . $status);
            return $unavailable;
        }
        $content = trim((string)($body['choices'][0]['message']['content'] ?? ''));
        if ($content === '') {
            return ['approved' => false, 'reason' => 'Unable to analyze image'];
        }
        $content = trim(preg_replace('/```(?:json)?/i', '', $content));
        $result = json_decode($content, true);
        if (!is_array($result)) {
            return $unavailable;
        }
        return [
            'approved' => !empty($result['approved']),
            'reason' => (string)($result['reason'] ?? 'No reason provided'),
        ];
    }
}

final class Images
{
    private const EXT = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'];

    public static function detectMime(string $path): ?string
    {
        $f = finfo_open(FILEINFO_MIME_TYPE);
        $mime = $f ? finfo_file($f, $path) : false;
        return ($mime && isset(self::EXT[$mime])) ? $mime : null;
    }

    /**
     * Validates an uploaded image, strips metadata (GPS/EXIF) by re-encoding, caps size at 1600px,
     * and saves it into /uploads. Returns the stored file name.
     */
    public static function store(string $tmpPath, string $mime): string
    {
        $info = @getimagesize($tmpPath);
        if (!$info || $info[0] < 1 || $info[1] < 1) {
            throw new HttpError(400, 'That file does not look like a valid image');
        }
        if ($info[0] * $info[1] > 40_000_000) {
            throw new HttpError(400, 'That photo is too large in dimensions. Please use a smaller one.');
        }
        @ini_set('memory_limit', '512M');

        $dir = uploads_dir();
        $name = time() . '-' . bin2hex(random_bytes(6)) . '.' . self::EXT[$mime];
        $dest = $dir . '/' . $name;

        // Animated GIFs are kept byte-for-byte; everything else is re-encoded.
        if ($mime === 'image/gif' || !function_exists('imagecreatefromstring')) {
            if (!copy($tmpPath, $dest)) {
                throw new HttpError(500, 'Failed to save photo');
            }
            return $name;
        }

        $img = @imagecreatefromstring((string)file_get_contents($tmpPath));
        if (!$img) {
            throw new HttpError(400, 'That file does not look like a valid image');
        }

        if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
            $exif = @exif_read_data($tmpPath);
            $rot = match ((int)($exif['Orientation'] ?? 1)) {
                3 => 180,
                6 => -90,
                8 => 90,
                default => 0,
            };
            if ($rot !== 0) {
                $rotated = imagerotate($img, $rot, 0);
                if ($rotated) {
                    $img = $rotated;
                }
            }
        }

        $w = imagesx($img);
        $h = imagesy($img);
        $max = 1600;
        if (max($w, $h) > $max) {
            $scaled = $w >= $h ? imagescale($img, $max, -1, IMG_BICUBIC) : imagescale($img, (int)round($w * $max / $h), $max, IMG_BICUBIC);
            if ($scaled) {
                $img = $scaled;
            }
        }

        $ok = match ($mime) {
            'image/png' => (function () use ($img, $dest) {
                imagealphablending($img, false);
                imagesavealpha($img, true);
                return imagepng($img, $dest, 6);
            })(),
            'image/webp' => function_exists('imagewebp') ? imagewebp($img, $dest, 85) : imagejpeg($img, $dest, 85),
            default => imagejpeg($img, $dest, 85),
        };
        if (!$ok) {
            throw new HttpError(500, 'Failed to save photo');
        }
        return $name;
    }

    /** Small JPEG (max 768px) used for the AI moderation request. */
    public static function moderationJpeg(string $path): string
    {
        $raw = (string)file_get_contents($path);
        if (!function_exists('imagecreatefromstring')) {
            return $raw;
        }
        $img = @imagecreatefromstring($raw);
        if (!$img) {
            return $raw;
        }
        $w = imagesx($img);
        $h = imagesy($img);
        if (max($w, $h) > 768) {
            $s = $w >= $h ? imagescale($img, 768, -1) : imagescale($img, (int)round($w * 768 / $h), 768);
            if ($s) {
                $img = $s;
            }
        }
        // Flatten transparency onto white so PNG/WebP with alpha encode cleanly as JPEG.
        $flat = imagecreatetruecolor(imagesx($img), imagesy($img));
        imagefill($flat, 0, 0, imagecolorallocate($flat, 255, 255, 255));
        imagecopy($flat, $img, 0, 0, 0, 0, imagesx($img), imagesy($img));
        ob_start();
        imagejpeg($flat, null, 80);
        return (string)ob_get_clean();
    }
}
