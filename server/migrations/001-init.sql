-- Up
CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  text TEXT,
  timestamp INTEGER NOT NULL,
  last_repost_fetch_timestamp INTEGER,
  repost_to_id INTEGER
);
CREATE INDEX posts_user_id_timestamp ON posts (user_id, timestamp);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  profile_image_url TEXT
);

CREATE TABLE votes (
  id INTEGER PRIMARY KEY,
  name TEXT,
  cutoff_timestamp INTEGER NOT NULL,
  vote_winner_count INTEGER NOT NULL DEFAULT 0,
  seed INTEGER
);
CREATE INDEX votes_name ON votes (name);

CREATE TABLE vote_post_ids (
  id INTEGER PRIMARY KEY,
  vote_id INTEGER,
  post_id INTEGER
);

CREATE TABLE vote_winners (
  id INTEGER PRIMARY KEY,
  vote_id INTEGER,
  user_id INTEGER
);

-- Down
DROP TABLE posts;
DROP TABLE users;
DROP TABLE votes;
DROP TABLE vote_post_ids;
DROP TABLE vote_winners;
