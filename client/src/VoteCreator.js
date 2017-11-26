import React from 'react';
import moment from 'moment';
import {Card, CardActions, CardText, CardTitle} from 'material-ui/Card';
import RaisedButton from 'material-ui/RaisedButton';
import TextField from 'material-ui/TextField';
import DatePicker from 'material-ui/DatePicker';
import TimePicker from 'material-ui/TimePicker';
import Slider from 'material-ui/Slider';

class VoteCreator extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: '',
      cutoffTime: moment().startOf('day').toDate(),
      voteWinnerCount: 3,
      seed: moment().unix(),
    };
  }

  canCreate() {
    return this.state.name && this.props.anyPostSelected;
  }

  handleCutoffDatePickerChange(date) {
    const time = this.state.cutoffTime;
    this.setState({
      cutoffTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(),
          time.getHours(), time.getMinutes(), time.getSeconds()),
    });
  }

  handleCutoffTimePickerChange(time) {
    const date = this.state.cutoffTime;
    this.setState({
      cutoffTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(),
          time.getHours(), time.getMinutes(), time.getSeconds()),
    });
  }

  handleVoteWinnerCountChange(value) {
    this.setState({
      voteWinnerCount: value,
    });
  }

  render() {
    return <Card onClick={() => this.props.onClick()}>
      <CardTitle title="New Vote"/>
      {this.props.selected &&
      <CardText>
        <TextField
            floatingLabelText="Name"
            value={this.state.name}
            onChange={(event, value) => this.setState({name: value})}
        />
        <DatePicker floatingLabelText="Cutoff Date"
                    autoOk={true}
                    value={this.state.cutoffTime}
                    onChange={(event, date) => this.handleCutoffDatePickerChange(date)}/>
        <TimePicker floatingLabelText="Cutoff Time"
                    autoOk={true}
                    format="24hr"
                    minutesStep={5}
                    value={this.state.cutoffTime}
                    onChange={(event, time) => this.handleCutoffTimePickerChange(time)}/>
        <div style={{marginTop: '8px'}}>{`Vote Winner Count: ${this.state.voteWinnerCount}`}</div>
        <Slider
            id="VoteCreatorSlider"
            min={0}
            max={10}
            step={1}
            value={this.state.voteWinnerCount}
            sliderStyle={{marginTop: '4px', marginBottom: '4px'}}
            onChange={(event, value) => this.handleVoteWinnerCountChange(value)}
        />
        <TextField
            floatingLabelText="Seed"
            value={this.state.seed}
            onChange={(event, value) => this.setState({seed: value})}
        />
        <div style={{marginTop: '8px'}}>{`${this.props.selectedPostsCount} Posts Selected`}</div>
        <CardActions>
          <RaisedButton label="Create"
                        primary={true}
                        disabled={!this.canCreate()}
                        onClick={(event) => {
            this.props.onCreateVote(
                this.state.name, this.state.cutoffTime.getTime() / 1000, this.state.voteWinnerCount,
                this.state.seed,
            );
            event.stopPropagation();
          }}/>
        </CardActions>
      </CardText>
      }
    </Card>;
  }
}

export default VoteCreator;
