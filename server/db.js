const sqlite = require('sqlite');

exports.withinTransaction = function() {
  return begin().then(() => Promise.all(arguments)).then(() => commit(), error => {
    rollback();
    throw(error);
  });
};

exports.insertOrUpdatePost = function(id, userID, text, timestamp, repostToID) {
  return sqlite.run(
      'INSERT INTO posts (id, user_id, text, timestamp, repost_to_id) VALUES (?, ?, ?, ?, ?)',
      id, userID, text, timestamp, repostToID).catch(() => sqlite.run(
      'UPDATE posts SET user_id = ?, text = ?, timestamp = ?, repost_to_id = ? WHERE id = ?',
      userID, text, timestamp, repostToID, id)
  );
};

exports.getPostsByUserAfterTimestamp = function(userID, timestamp) {
  return sqlite.all('SELECT * from posts WHERE user_id = ? AND timestamp >= ?', userID, timestamp).
      then(mapPostRecords);
};

exports.getPost = function(id) {
  return sqlite.get('SELECT * from posts WHERE id = ?', id).
      then(mapPostRecord);
};

exports.getLastRepostFetchTimestamp = function(postID) {
  return sqlite.get('SELECT last_repost_fetch_timestamp from posts where id = ?', postID);
};

exports.updateLastRepostFetchTimestamp = function(postID, timestamp) {
  console.log(`updateLastRepostFetchTimestamp(${postID}, ${timestamp})`);

  return sqlite.run('UPDATE posts SET last_repost_fetch_timestamp = ? where id = ?', timestamp,
      postID);
};

exports.getVotePosts = function(vote_id) {
  return sqlite.all(
      'SELECT posts.* FROM posts INNER JOIN vote_post_ids ON posts.id = vote_post_ids.post_id WHERE vote_post_ids.vote_id = ?',
      vote_id).then(mapPostRecords);
};

function mapPostRecords(records) {
  return records.map(mapPostRecord);
}

function mapPostRecord(record) {
  return {
    id: record.id,
    userID: record.user_id,
    text: record.text,
    timestamp: record.timestamp,
    repostToID: record.repost_to_id,
    lastRepostFetchTimestamp: record.last_repost_fetch_timestamp
  };
}

exports.insertOrUpdateUser = function(id, name, profileImageURL) {
  return sqlite.run('INSERT INTO users (id, name, profile_image_url) VALUES (?, ?, ?)',
      id, name, profileImageURL).catch(() =>
      sqlite.run('UPDATE users SET name = ?, profile_image_url = ? WHERE id = ?',
          name, profileImageURL, id)
  );
};

exports.getUser = function(id) {
  return sqlite.get('SELECT * FROM users WHERE id = ?', id).then(mapUserRecord);
};

exports.insertVote = function(name, postIDs, cutoffTimestamp, voteWinnerCount, seed) {
  const votePromise = sqlite.run(
      'INSERT INTO votes (name, cutoff_timestamp, vote_winner_count, seed) VALUES (?, ?, ?, ?)',
      name, cutoffTimestamp, voteWinnerCount, seed);
  const postPromise = votePromise.then(({lastID}) => Promise.all(postIDs.map(
      postID => sqlite.run('INSERT INTO vote_post_ids (vote_id, post_id) VALUES (?, ?)', lastID,
          postID))));
  return Promise.all([votePromise, postPromise]).then(([lastID]) => {
    return {
      id: lastID, name, cutoffTimestamp, voteWinnerCount, seed
    };
  });
};

exports.getVotesWithPostCount = function() {
  return sqlite.all('SELECT votes.*, COUNT(vote_post_ids.post_id) as post_count from votes'
      + ' JOIN vote_post_ids ON votes.id = vote_post_ids.vote_id'
      + ' GROUP BY vote_post_ids.vote_id ORDER BY votes.id DESC').
      then(votes => {
        return votes.map(vote => {
          return {
            id: vote.id,
            name: vote.name,
            cutoffTimestamp: vote.cutoff_timestamp,
            voteWinnerCount: vote.vote_winner_count,
            seed: vote.seed,
            postCount: vote.post_count
          };
        });
      });
};

exports.getVoteWithPostCount = function(id) {
  return sqlite.get('SELECT votes.*, COUNT(vote_post_ids.post_id) as post_count from votes'
      + ' JOIN vote_post_ids ON votes.id = vote_post_ids.vote_id'
      + ' where votes.id = ?', id).
      then(vote => ({
            id: vote.id,
            name: vote.name,
            cutoffTimestamp: vote.cutoff_timestamp,
            voteWinnerCount: vote.vote_winner_count,
            seed: vote.seed,
            postCount: vote.post_count
          })
      );
};

exports.getVote = function(id) {
  return sqlite.get('SELECT * from votes WHERE id = ?', id).
      then(vote => {
        return {
          id: vote.id,
          name: vote.name,
          cutoffTimestamp: vote.cutoff_timestamp,
          voteWinnerCount: vote.vote_winner_count,
          seed: vote.seed
        };
      });
};

exports.getNumberOfVotePostPendingFetches = function(voteID) {
  const matchVoteID = 'vote_post_ids.vote_id = ?';
  const postPending = 'posts.last_repost_fetch_timestamp IS null OR posts.last_repost_fetch_timestamp < votes.cutoff_timestamp';
  const repostNotNull = 'posts.repost_to_id IS NOT NULL';
  const repostPending = 'repost_tos.last_repost_fetch_timestamp IS null OR repost_tos.last_repost_fetch_timestamp < votes.cutoff_timestamp';
  return sqlite.get(
      'SELECT COUNT(*) as count FROM posts'
      + ' LEFT JOIN posts repost_tos ON posts.repost_to_id = repost_tos.id'
      + ' INNER JOIN vote_post_ids ON posts.id = vote_post_ids.post_id'
      + ' INNER JOIN votes ON votes.id = vote_post_ids.vote_id'
      + ` WHERE ${matchVoteID} AND (${postPending} OR (${repostNotNull} AND ${repostPending}))`,
      voteID).then(result => result.count);
};

exports.getVotersForPost = function(postID, repostToID, cutoffTimestamp) {
  return sqlite.all('SELECT users.*  FROM posts INNER JOIN users ON users.id = posts.user_id'
      + ' WHERE (posts.repost_to_id = ? OR posts.repost_to_id = ?)'
      + ' AND posts.timestamp <= ? GROUP BY users.id',
      postID, repostToID, cutoffTimestamp).then(mapUserRecords);
};

// getVotersForVote() guarantees order consistency in order to support random winner polling.
exports.getVotersForVote = function(voteID) {
  const selectvoterPosts = 'SELECT users.* FROM posts voter_posts';
  const joinUsers = 'INNER JOIN users ON users.id = voter_posts.user_id';
  const joinVotedTos = 'INNER JOIN posts voted_tos ON voted_tos.id = voter_posts.repost_to_id';
  const joinVotePosts = 'LEFT JOIN posts vote_posts ON vote_posts.repost_to_id = voted_tos.id';
  const joinVotePostIDs = 'INNER JOIN vote_post_ids ON vote_post_ids.post_id = voted_tos.id OR'
      + ' vote_post_ids.post_id = vote_posts.id';
  const joinVotes = 'INNER JOIN votes ON votes.id = vote_post_ids.vote_id';
  const where = 'WHERE votes.id = ? AND voter_posts.timestamp <= votes.cutoff_timestamp';
  const groupOrderBy = 'GROUP BY voter_posts.user_id ORDER BY voter_posts.user_id ASC';

  return sqlite.all(`${selectvoterPosts}
        ${joinUsers}
        ${joinVotedTos}
        ${joinVotePosts}
        ${joinVotePostIDs}
        ${joinVotes}
        ${where}
        ${groupOrderBy}`,
      voteID).
      then(mapUserRecords);
};

function mapUserRecords(records) {
  return records.map(mapUserRecord);
}

function mapUserRecord(record) {
  return {
    id: record.id,
    name: record.name,
    profileImageURL: record.profile_image_url
  };
}

function begin() {
  return sqlite.run('begin');
}

function commit() {
  return sqlite.run('commit');
}

function rollback() {
  return sqlite.run('rollback');
}

