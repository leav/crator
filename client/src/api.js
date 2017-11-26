export function api(url) {
  console.log(`api(${url})`);
  return fetch(`http://localhost:8080/${url}`);
}


// name, postIDs, cutoffTimestamp, voteWinnerCount, seed
export function createVote(name, postIDs, cutoffTimestamp, voteWinnerCount, seed) {
  return fetch('http://localhost:8080/create_vote', {
    method: "POST",
    body: JSON.stringify({
      name,
      postIDs,
      cutoffTimestamp,
      voteWinnerCount,
      seed,
    })
  });
}
