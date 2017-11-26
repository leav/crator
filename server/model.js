const moment = require('moment');
const db = require('./db');
const seedrandom = require('seedrandom');
const weiboAPI = require('./weibo_api');

const FETCH_LIMIT = 100;

exports.fetchUserPosts = function(
    userID = 5999662002, timestamp = moment().subtract(1, 'months').unix()) {
  console.log(`fetchUserPosts userID ${userID} timestamp ${timestamp}`);
  return fetchUserPostsPaged(userID, timestamp, 1).then(insertPostsAndUsers);
};

function fetchUserPostsPaged(userID, timestamp, page) {
  return weiboAPI.getUserPostsWithRetry(userID, page).then(posts => {
    console.log(`fetched page ${page}`);
    if (page >= FETCH_LIMIT) {
      return Promise.resolve(posts);
    }
    if (posts.some(post => post.timestamp < timestamp)) {
      return Promise.resolve(posts);
    }
    return fetchUserPostsPaged(userID, timestamp, page + 1).
        then(nextPosts => posts.concat(nextPosts));
  }).catch(error => console.log(error));
}

exports.getSavedUserPosts = function(
    userID = 5999662002, timestamp = moment().subtract(1, 'months').unix()) {
  return db.getPostsByUserAfterTimestamp(userID, timestamp).
      then(associateUserToPosts).
      then(associateRepostToToPosts);
};

function associateUserToPosts(posts) {
  return Promise.all(
      posts.map(post => db.getUser(post.userID).then(user => {
            post.user = user;
            return Promise.resolve(post);
          }).catch(error => {
            console.log(`associateUserToPosts ${post} error: ${error}`);
            throw error;
          })
      )
  );
}

function associateUserToPost(post) {
  return db.getUser(post.userID).then(user => {
    post.user = user;
    return Promise.resolve(post);
  });
}

function associateRepostToToPosts(posts) {
  return Promise.all(posts.filter(post => post.repostToID).
      map(post => db.getPost(post.repostToID).then(associateUserToPost).then(repostTo => {
            post.repostTo = repostTo;
            return Promise.resolve(post);
          }).catch(error => {
            console.log(`associateRepostToToPosts ${post.id} error: ${error}`);
            throw error;
          })
      )
  );
}

exports.createVote = function(name, postIDs, cutoffTimestamp, voteWinnerCount, seed) {
  const newFetchedTimestamp = moment().unix();
  if (cutoffTimestamp > newFetchedTimestamp) {
    cutoffTimestamp = newFetchedTimestamp;
  }
  const insertVotePromise = db.insertVote(name, postIDs, cutoffTimestamp, voteWinnerCount, seed);
  fetchAllRepostsForEntryIfStale(postIDs, cutoffTimestamp, newFetchedTimestamp);
  return insertVotePromise;
};

// fetchAllRepostsForEntryIfStale will fetch all reposts for specified postIDs and their repostTo.
// Note that this only traverse one level deep of repostTo.
function fetchAllRepostsForEntryIfStale(postIDs, cutoffTimestamp, newFetchedTimestamp) {
  return Promise.all(
      postIDs.map(postID =>
          db.getPost(postID).then(post => Promise.all([
            fetchRepostsIfStale(post.id, cutoffTimestamp, newFetchedTimestamp),
            fetchRepostsIfStale(post.repostToID, cutoffTimestamp, newFetchedTimestamp)
          ]))
      )
  );
}

function fetchRepostsIfStale(postID, cutoffTimestamp, newFetchedTimestamp) {

  console.log(`fetchRepostsIfStale(${postID}, ${cutoffTimestamp}, ${newFetchedTimestamp})`);

  if (!postID) {
    return Promise.resolve();
  }
  const lastFetchTimestamp = db.getLastRepostFetchTimestamp(postID);
  if (lastFetchTimestamp !== null && cutoffTimestamp <= lastFetchTimestamp) {
    return Promise.resolve();
  }
  return fetchReposts(postID).
      then(() => db.updateLastRepostFetchTimestamp(postID, newFetchedTimestamp));
}

function fetchReposts(postID) {
  return weiboAPI.getRepostsWithRetry(postID).then(insertPostsAndUsers);
}

function insertPostsAndUsers(posts) {
  const insertPosts = posts.map(
      post => db.insertOrUpdatePost(
          post.id,
          post.user.id,
          post.text,
          post.timestamp,
          post.repostToID));
  const insertRepostTos = posts.map(post => post.repostTo).
      filter(post => post).
      map(post => db.insertOrUpdatePost(
          post.id,
          post.user.id,
          post.text,
          post.timestamp,
          post.repostToID
      ));
  const insertUsers = [];
  posts.reduce((userMap, post) => {
    if (post.user) {
      userMap.set(post.user.id, post.user);
    }
    if (post.repostTo && post.repostTo.user) {
      const repostTo = post.repostTo;
      userMap.set(repostTo.user.id, repostTo.user);
    }
    return userMap;
  }, new Map()).
      forEach(user => insertUsers.push(
          db.insertOrUpdateUser(user.id, user.name, user.profileImageURL)));
  return Promise.all(insertPosts.concat(insertRepostTos).concat(insertUsers)).catch(error => {
    console.log(`insertPostsAndUsers error: ${error}`);
    throw error;
  });
}

exports.getVote = function(id) {
  const votePromise = db.getVote(id);
  const pendingPromise = db.getNumberOfVotePostPendingFetches(id);
  const postsPromise = db.getVotePosts(id).then(associateUserToPosts).then(associateRepostToToPosts);
  const countPostPromises = Promise.all([votePromise, postsPromise]).then(([vote, posts]) =>
      Promise.all(posts.filter(post =>
          post.lastRepostFetchTimestamp >= vote.cutoffTimestamp).
          map(post => {
                const votersPromise = db.getVotersForPost(post.id, post.repostToID, vote.cutoffTimestamp);
                return votersPromise.then(voters => {
                  post.voters = voters;
                  // if (post.repostToID) {
                  //   return db.getVotersForPost(post.repostToID, vote.cutoffTimestamp).
                  //       then(repostToVoters => {
                  //         post.voters.concat(repostToVoters);
                  //         return Promise.resolve(post);
                  //       });
                  // }
                  return Promise.resolve(post);
                });
              }
          )
      )
  );
  const votersPromise = db.getVotersForVote(id);
  return Promise.all(
      [votePromise, pendingPromise, postsPromise, votersPromise].concat(countPostPromises)).
      then(([vote, pending, posts, voters]) => {
        vote.pending = pending;
        vote.posts = posts;
        vote.postCount = posts.length;
        vote.voters = voters;
        vote.winners = selectWinner(voters.slice(), vote.voteWinnerCount, vote.seed);
        return vote;
      });
};

function selectWinner(voters, count, seed) {
  if (voters.length <= count) {
    return voters;
  }
  const rng = seedrandom(seed);
  return voters.sort(() => .5 - rng()).slice(0, count);
}

exports.getVoteSummaries = function() {
  return db.getVotesWithPostCount().then(votes => {
        return Promise.all(votes.map(vote =>
                db.getNumberOfVotePostPendingFetches(vote.id).then(pending => {
                      vote.pending = pending;
                      return Promise.resolve(vote);
                    }
                )
            )
        );
      }
  );
};

exports.getVoteSummary = function(id) {
  return db.getVoteWithPostCount(id).then(vote =>
      db.getNumberOfVotePostPendingFetches(vote.id).then(pending => {
            vote.pending = pending;
            return Promise.resolve(vote);
          }
      )
  );
};




