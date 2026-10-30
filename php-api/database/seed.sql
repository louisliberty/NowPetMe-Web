-- Optional starter pets so a brand-new site isn't empty. Run once, after schema.sql.
-- They start with ZERO votes, so every rating you see on the site is a real one.
INSERT INTO pets (name, category, breed, photo_url, story, personality_tags, total_score, vote_count, bayesian_score, owner_ip, created_at) VALUES
('Buddy',    'dog',    'Golden Retriever',  '/images/dog2.jpg',   'Loves belly rubs and chasing squirrels in the park!', '["playful","energetic"]', 0, 0, 5, 'seed', UTC_TIMESTAMP()),
('Whiskers', 'cat',    'Orange Tabby',      '/images/cat.jpg',    'Professional napper and treat connoisseur.',          '["lazy","sassy"]',        0, 0, 5, 'seed', UTC_TIMESTAMP()),
('Rio',      'bird',   'Blue & Gold Macaw', '/images/bird.jpg',   'Can say ''hello'' in three languages!',               '["smart","majestic"]',    0, 0, 5, 'seed', UTC_TIMESTAMP()),
('Snowball', 'rabbit', 'Holland Lop',       '/images/rabbit.jpg', 'Hops around the garden like a fluffy cloud.',         '["cuddly","shy"]',        0, 0, 5, 'seed', UTC_TIMESTAMP()),
('Neptune',  'fish',   'Betta Fish',        '/images/fish.jpg',   'The most majestic swimmer in the tank!',              '["majestic"]',            0, 0, 5, 'seed', UTC_TIMESTAMP());
