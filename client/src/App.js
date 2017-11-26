import LeftPanel from './LeftPanel';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import React from 'react';
import RightPanel from './RightPanel';
import * as api from './api';
import moment from 'moment';
import Post from './Post';
import RasedButton from 'material-ui/RaisedButton';
import Slider from 'material-ui/Slider';
import {Card, CardText} from 'material-ui/Card';
import VoteCreator from './VoteCreator';
import VoteSummary from './VoteSummary';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      voteCreatorSelected: false,
      selectedVoteID: null,
      votes: [],
      posts: [],
      getSavedPostTimestamp: moment().subtract(3, 'months').unix(),
      pastPostMonths: 3,
      userID: 5999662002,
      selectedMinPostID: null,
      selectedMaxPostID: null,
      fetchingUserPosts: false
    };
  }

  componentDidMount() {
    this.selectVoteCreator();
    api.api('get_vote_summaries').
        then(res => res.json()).
        then(votes => this.setVoteSummaries(votes));
  }

  setVoteSummaries(votes) {
    this.setState(prevState => ({
          ...prevState,
          votes: votes
        })
    );
    votes.forEach(vote => this.pollVote(vote));
  }

  pollVote(vote) {
    if (vote.pending === 0) {
      return Promise.resolve();
    }

    console.log(`pollVote ${JSON.stringify(vote)}`);

    return api.api(`get_vote_summary?id=${vote.id}`).then(res => res.json()).then(vote => {
      this.setState(prevState => {
        const votes = prevState.votes;
        const index = votes.findIndex(prevVote => prevVote.id === vote.id);
        votes[index] = vote;
        return {
          ...prevState,
          votes
        };
      });
      return this.pollVote(vote);
    });
  }

  selectVote(id) {
    console.log(`select vote ${id}`);
    this.resetPostSelection();
    this.setState(prevState => ({
      ...prevState,
      voteCreatorSelected: false,
      selectedVoteID: id,
    }));
    const vote = this.state.votes.find(vote => vote.id === id);
    if (!vote) {
      console.log(`Error: selectVote(${id}) does not exist!`);
      return;
    }
    if (!vote.posts) {
      api.api(`get_vote?id=${vote.id}`).then(res => res.json()).then(updatedVote => {
        this.setState(prevState => {
          const votes = prevState.votes;
          const index = votes.findIndex(vote => vote.id === updatedVote.id);
          if (index !== -1) {
            votes[index] = updatedVote;
          }
          return {
            ...prevState,
            votes,
            posts: updatedVote.posts
          };
        });
      });
    } else {
      this.setState(prevState => (
          {
            ...prevState,
            posts: vote.posts
          }
      ));
    }
  }

  selectVoteCreator() {
    console.log(`select vote creator`);
    if (this.state.voteCreatorSelected) {
      return;
    }
    this.setState(prevState => ({
      ...prevState,
      voteCreatorSelected: true
    }));
    api.api(`get_saved_user_posts?user_id=${this.state.userID}` +
        `&timestamp=${moment().subtract(this.state.pastPostMonths, 'months').unix()}`).
        then(res => res.json()).
        then(json =>
            this.setState(prevState => (
                {
                  ...prevState,
                  posts: json
                }
            )));
  }

  resetPostSelection() {
    this.setState(prevState => ({
      ...prevState,
      selectedMinPostID: null,
      selectedMaxPostID: null
    }));
  }

  selectPost(id) {
    // Cancel selection.
    if (this.isPostIDSelected(id)) {
      this.setState(prevState => ({
        ...prevState,
        selectedMinPostID: null,
        selectedMaxPostID: null
      }));
      return;
    }
    // Start selecting.
    if (this.state.selectedMinPostID === null) {
      this.setState(prevState => ({
        ...prevState,
        selectedMinPostID: id,
        selectedMaxPostID: id
      }));
      return;
    }
    // Expand selection.
    if (id > this.state.selectedMaxPostID) {
      this.setState(prevState => ({
        ...prevState,
        selectedMinPostID: prevState.selectedMinPostID,
        selectedMaxPostID: id
      }));
    } else if (id < this.state.selectedMinPostID) {
      this.setState(prevState => ({
        ...prevState,
        selectedMinPostID: id,
        selectedMaxPostID: prevState.selectedMaxPostID
      }));
    }
  }

  isPostSelected(post) {
    return this.isPostIDSelected(post.id);
  }

  isPostIDSelected(id) {
    return this.state.selectedVoteID === null &&
        this.anyPostSelected() &&
        id >= this.state.selectedMinPostID &&
        id <= this.state.selectedMaxPostID;
  }

  anyPostSelected() {
    return this.state.selectedMinPostID !== null;
  }

  selectedPostsCount() {
    if (!this.anyPostSelected()) {
      return 0;
    }
    return this.state.posts.filter(post => this.isPostSelected(post)).length;
  }

  fetchFromWeibo() {
    this.setState(prevState => ({
      ...prevState,
      fetchingUserPosts: true
    }));
    api.api(`fetch_user_posts?user_id=${this.state.userID}` +
        `&timestamp=${moment().subtract(this.state.pastPostMonths, 'months').unix()}`).then(res =>
        res.json()).then(posts =>
        this.setState(prevState => ({
          ...prevState,
          posts: posts,
          fetchingUserPosts: false
        }))
    ).catch(() => this.setState(prevState => ({
          ...prevState,
          fetchingUserPosts: false
        })
    ));
  }

  createVote(name, cutoffTimestamp, voteWinnerCount, seed) {
    console.log(`createVote()`);
    const postIDs = this.state.posts.filter(post => this.isPostSelected(post)).map(post => post.id);
    api.createVote(name, postIDs, cutoffTimestamp, voteWinnerCount, seed).then(res => res.json()).
        then(votes => {
          this.resetPostSelection();
          this.setVoteSummaries(votes);
        });
  }

  render() {
    return <MuiThemeProvider>
      <div className="row">
        <LeftPanel>
          <VoteCreator selected={this.state.voteCreatorSelected}
                       anyPostSelected={this.anyPostSelected()}
                       selectedPostsCount={this.selectedPostsCount()}
                       onClick={() => this.selectVoteCreator()}
                       onCreateVote={(
                           name, cutoffTimestamp, voteWinnerCount, seed) => this.createVote(
                           name, cutoffTimestamp, voteWinnerCount, seed
                       )}
          />
          {
            this.state.votes.map(vote =>
                <VoteSummary key={vote.id} vote={vote} onClick={() => this.selectVote(vote.id)}/>)
          }
        </LeftPanel>
        <RightPanel>
          <Card>
            <CardText>
              <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                <div style={{width: '320px'}}>
                  <Slider
                      id="pastPostMonthsSlider"
                      min={1}
                      max={12}
                      step={1}
                      value={this.state.pastPostMonths}
                      sliderStyle={{marginTop: '4px', marginBottom: '4px'}}
                      onChange={(event, value) => this.setState(prevState => ({
                        ...prevState,
                        pastPostMonths: value
                      }))}
                  />
                </div>
                <CardText>{`Past ${this.state.pastPostMonths} Months`}</CardText>
              </div>
              <RasedButton label={`Fetch from Weibo`}
                           onClick={() => this.fetchFromWeibo()}
                           disabled={this.state.fetchingUserPosts}/>
              <RasedButton label={`Get from local`}/>
            </CardText>
          </Card>
          {this.state.posts.map(post => (
              <Post key={post.id}
                    post={post}
                    onSelect={(id) => this.selectPost(id)}
                    selected={this.isPostSelected(post)}
              />
          ))}
        </RightPanel>
      </div>
    </MuiThemeProvider>;
  }
}

export default App;
