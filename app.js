const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));
const app = require('express')();
const server = app.listen(8081);

const io = require('socket.io')(server, {
  cors: {
    origin: 'http://localhost:3000',
  },
  pingTimeout: 20000,
});

const ft = async (token, url, method, body) => {
  const response = await fetch(`http://localhost:8080${url}`, {
    method: method ? method : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });
  let data = null;
  try {
    data = await response.json();
  } catch (e) {}
  return data;
};

io.on('connection', (socket) => {
  console.log('Client connected : ' + socket);

  socket.on('init', async (action) => {
    socket.join(action.roomId);
    const data = await ft(action.token, '/items');
    socket.emit('menu-item', { type: 'SET_MENU_ITEMS', menuItems: data });
  });

  const sendAction = (action) => {
    if (action.type !== 'ADD') {
      io.sockets.in(action.roomId).emit('menu-item', action);
    }
  };

  socket.on('ts-menu-item', async (action) => {
    switch (action.type) {
      case 'ADD':
        const data = await ft(action.token, '/item', 'POST', action.menuItem);
        io.sockets.in(action.roomId).emit('menu-item', {
          ...action,
          menuItem: data,
        });
        break;
      case 'REMOVE':
        if (!action.menuItem) {
          sendAction(action);
          ft(action.token, `/item/${action.id}`, 'DELETE');
        } else {
          sendAction(action);
          ft(action.token, `/item/${action.id}`, 'PUT', action.menuItem);
        }
        break;
      case 'MAKE_ITEM_AVAILABLE':
        sendAction(action);
        ft(action.token, `/item/${action.id}/true`, 'PUT');
        break;
      case 'MAKE_ITEM_UNAVAILABLE':
        sendAction(action);
        ft(action.token, `/item/${action.id}/false`, 'PUT');
        break;
      case 'UPDATE_AVAILABLE':
        sendAction(action);
        ft(action.token, `/item/${action.id}/u/${action.updateType}`, 'PUT');
        break;
      default:
        return;
    }
  });
});
