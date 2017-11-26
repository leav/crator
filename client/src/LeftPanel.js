import React from 'react';
import Drawer from 'material-ui/Drawer';

// const style = {
//   position: 'fixed',
//   width: '320px',
//   backgroundColor: '#EEEEEE',
//   height: '100%',
// };

const LeftPanel = ({children}) => (
    <Drawer>{children}</Drawer>
);

export default LeftPanel;
