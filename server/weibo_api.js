const fetch = require('node-fetch');
const moment = require('moment');
const promiseRetry = require('promise-retry');

exports.getUserPosts = function(userID = 5999662002, page = 1) {
  const url = `https://m.weibo.cn/api/container/getIndex?containerid=230413${userID}_-_WEIBO_SECOND_PROFILE_WEIBO&page=${page}`;
  return fetch(url).then(response => {
    return response.json().then(json => {
      if (json.ok !== 1) {
        console.log(`getUserPosts unexpected ok status: ${json.ok} for ${url}`);
        return [];
      }
      return json.cards.filter(card => validatePost(card.mblog)).
          map(card => {
            let post = parsePost(card.mblog);
            if (card.mblog.retweeted_status) {
              post.repostTo = parsePost(card.mblog.retweeted_status);
              post.repostToID = post.repostTo.id;
            }
            return post;
          });
    });
  }).catch(error => {
    console.log(`getUserPosts(userID ${userID}, page ${page}) error: ${error}`);
    throw error;
  });
};

function validatePost(post) {
  if (!post) {
    return false;
  }
  if (!post.id) {
    return false;
  }
  if (!post.user) {
    return false;
  }
  if (!post.user.id) {
    return false;
  }
  if (post.retweeted_status) {
    return validatePost(post.retweeted_status);
  }
  return true;
}

exports.getUserPostsWithRetry = function(userID = 5999662002, page = 1) {
  return promiseRetry(function(retry, number) {
    console.log(`getUserPosts ${userID} page ${page} attempt number ${number}`);
    return exports.getUserPosts(userID, page).catch(retry);
  }).catch(error => {
    console.log(`getUserPosts ${userID} failed: ${error}`);
    throw error;
  });
};

exports.getReposts = function(postID) {
  return getRepostsPaged(postID, 1, 1);
};

exports.getRepostsWithRetry = function(postID) {
  return promiseRetry(function(retry, number) {
    console.log(`getReposts ${postID} attempt number ${number}`);
    return exports.getReposts(postID).catch(retry);
  }).catch(error => {
    console.log(`getReposts ${postID} failed: ${error}`);
    throw error;
  });
};

function getRepostsPaged(postID, currentPage, maxPage) {
  if (currentPage > maxPage) {
    return Promise.resolve([]);
  }
  const url = `https://m.weibo.cn/api/statuses/repostTimeline?id=${postID}&page=${currentPage}`;
  return fetch(url).then(response => response.json().then(json => {
    // No reposts.
    if (json.ok === 0) {
      return Promise.resolve([]);
    }
    if (json.ok !== 1) {
      console.log(`unexpected ok status: ${json.ok} ${json.msg} for ${url}`);
      return Promise.resolve([]);
    }
    const posts = json.data.map(parsePost);
    posts.forEach(post => post.repostToID = postID);
    if (json.max && json.max > maxPage) {
      maxPage = json.max;
    }
    return getRepostsPaged(postID, currentPage + 1, maxPage).
        then(nextPosts => posts.concat(nextPosts));
  }));
}

function parsePost(json) {
  const timestampObject = parseDate(json.created_at);
  return {
    id: json.id,
    user: parseUser(json.user),
    text: json.text,
    timestampObject,
    timestamp: timestampObject.unix(),
  };
}

function parseDate(date) {
  return moment(date, ['MM-DD']);
}

function parseUser(json) {
  return {
    id: json.id, name: json.screen_name, profileImageURL: json.profile_image_url,
  };
}
