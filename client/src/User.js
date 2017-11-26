import React from 'react';
import {Card} from 'material-ui/Card';

const divStyle = {
  padding: '2px',
};

const User = ({user}) => (
    <Card>
      <img src={user.profileImageURL}/>
      <div>{user.name}</div>
    </Card>
);

export default User;
