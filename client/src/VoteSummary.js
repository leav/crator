import React from 'react';
import {Card, CardText} from 'material-ui/Card';

// const style = {
//   borderStyle: 'solid',
//   borderWidth: '2px',
//   margin: '2px',
//   padding: '2px',
// };

const VoteSummary = ({vote, onClick}) => (
    <Card onClick={() => onClick()}>
      <CardText>
        <div>{vote.name}</div>
        <div>{vote.cutoffTimestamp}</div>
        <div>{vote.voteWinnerCount}</div>
        <div>{vote.seed}</div>
        <div>{vote.postCount - vote.pending}/{vote.postCount}</div>
        {vote.winners &&
        <div>
          <div>
          Winners
          </div>
          {vote.winners.map(winner => <div key={winner.id}>{winner.name}</div>)}
        </div>
        }
      </CardText>
    </Card>
);

export default VoteSummary;
