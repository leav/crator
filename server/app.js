const cors = require('cors');
const express = require('express');
const model = require('./model');
const moment = require('moment');
const sqlite = require('sqlite');

const app = express();
app.use(cors());
app.use(function(req, res, next) {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', function(chunk) {
    data += chunk;
  });

  req.on('end', function() {
    req.body = data;
    next();
  });
});

// user_id: the user id to fetch posts.
// timestamp: fetch posts greater or equal to the specified timestamp.
app.get('/fetch_user_posts', function(req, res) {
  console.log(`/fetch_user_posts ${req.query.user_id} ${req.query.timestamp}`);
  const postsPromise = model.fetchUserPosts(req.query.user_id, req.query.timestamp).
      then(() => model.getSavedUserPosts(req.query.user_id, req.query.timestamp));
  postsPromise.then(posts => res.send(JSON.stringify(posts)));
});

// user_id: the user id to get posts.
// timestamp: get posts greater or equal to the specified timestamp.
app.get('/get_saved_user_posts', function(req, res) {
  console.log(`/get_saved_user_posts ${req.query.user_id} ${req.query.timestamp}`);
  model.getSavedUserPosts(req.query.user_id, req.query.timestamp).then(posts =>
      res.send(JSON.stringify(posts)));
});

// create_vote takes an json object with the following parameters:
// name: the name of this vote. Must be unique.
// ids: the posts that this vote consists of.
//   each post and its repost_to is considered an entry.
// timestamp: the cutoff timestamp of effective vote.
// vote_winner_count: the count of the vote winners.
//
// It does not return the result immediately because it takes a long time to fetch all the requests.
// Use get_vote to fetch the result.
app.post('/create_vote', function(req, res) {
  console.log(`create_vote ${JSON.parse(req.body)}`);
  const reqJSON = JSON.parse(req.body);
  if (!reqJSON.name) {
    res.status(400).send('name must not be empty');
    return;
  }
  if (!reqJSON.postIDs || reqJSON.postIDs.length === 0) {
    res.status(400).send('postIDs must not be empty');
    return;
  }
  const createVotePromise = model.createVote(reqJSON.name,
      reqJSON.postIDs,
      reqJSON.cutoffTimestamp,
      reqJSON.voteWinnerCount,
      reqJSON.seed);
  createVotePromise.then(() => model.getVoteSummaries()).then(votes =>
      res.send(JSON.stringify(votes)));
});

// id: the vote id.
app.get('/get_vote', function(req, res) {
  console.log(`/get_vote ${req.query.id}`);
  model.getVote(req.query.id).then(vote => res.send(JSON.stringify(vote)));
});

app.get('/get_vote_summaries', function(req, res) {
  model.getVoteSummaries().then(votes => res.send(JSON.stringify(votes)));
});

// id: the vote id.
app.get('/get_vote_summary', function(req, res) {
  model.getVoteSummary(req.query.id).then(vote => res.send(JSON.stringify(vote)));
});

Promise.resolve().
    then(() => sqlite.open('./database.sqlite', {Promise})).
    then(() => sqlite.migrate({
      // force: 'last'
    })).
    then(() => app.listen(8080));
