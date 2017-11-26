import React from 'react';
import VoteSummary from './VoteSummary';
import VoteCreator from './VoteCreator';
import List from 'material-ui/List';

class VoteSummaryList extends React.Component {
  render() {
    return <List>
      <VoteCreator selected={this.props.voteCreatorSelected}
                   onClick={() => this.props.onSelectVoteCreator()}
      />
      {
        this.props.votes.map(vote =>
            <VoteSummary key={vote.id} vote={vote} onClick={() => this.props.onSelectVote(vote.id)}/>)
      }
    </List>;
  }
}

export default VoteSummaryList;
