import React from 'react';
import User from './User';
import {Card, CardText, CardHeader} from 'material-ui/Card';
import * as color from 'material-ui/styles/colors';

const divStyle = {
  borderStyle: 'solid',
  borderWidth: '2px',
  margin: '2px',
  padding: '2px',
};

const Post = ({post, selected, onSelect}) => {
  return (
    <Card style={{backgroundColor: selected ? color.indigo200 : 'initial'}}
          onClick={()=>onSelect && onSelect(post.id)}
    >
      {post.user && <CardHeader    title={post.user.name}
                                   avatar={post.user.profileImageURL}/>}
      <CardText dangerouslySetInnerHTML={{__html:post.text}}/>
      {post.repostTo && <Post post={post.repostTo}/>}
    </Card>
)};

export default Post;
