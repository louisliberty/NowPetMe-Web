-- Optional: the 5 sample pets from the original app (photos ship with the React build in /images).
-- Run once, after schema.sql. bayesian_score values match the app's formula (m = 10).
INSERT INTO pets (name, category, breed, photo_url, story, personality_tags, total_score, vote_count, bayesian_score, owner_ip, created_at) VALUES
('Buddy',    'dog',    'Golden Retriever',  '/images/dog2.jpg',   'Loves belly rubs and chasing squirrels in the park!', '[]', 2314, 247, 9.354572593173373, 'seed', UTC_TIMESTAMP()),
('Whiskers', 'cat',    'Orange Tabby',      '/images/cat.jpg',    'Professional napper and treat connoisseur.',          '[]', 1890, 203, 9.2963622368336,   'seed', UTC_TIMESTAMP()),
('Rio',      'bird',   'Blue & Gold Macaw', '/images/bird.jpg',   'Can say ''hello'' in three languages!',               '[]', 1256, 148, 8.519779471174411, 'seed', UTC_TIMESTAMP()),
('Snowball', 'rabbit', 'Holland Lop',       '/images/rabbit.jpg', 'Hops around the garden like a fluffy cloud.',         '[]',  985, 112, 8.81250128234063,  'seed', UTC_TIMESTAMP()),
('Neptune',  'fish',   'Betta Fish',        '/images/fish.jpg',   'The most majestic swimmer in the tank!',              '[]',  756,  89, 8.546718751975323, 'seed', UTC_TIMESTAMP());
