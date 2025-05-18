import net   from 'node:net';
import { WebSocketServer } from 'ws';
import chalk from 'chalk';

const HOST = '0.0.0.0';
const TCP_PORT = 5001;
const WS_PORT = 8765;

const wss = new WebSocketServer({ port: WS_PORT });
wss.on('listening',  () => 
  console.log(chalk.magenta(`[WS ] listening ws://localhost:${WS_PORT}`))
);
wss.on('connection', ws => {
  console.log(chalk.green  (`[WS ] client connected`));
});

function broadcast(msg)
{
  wss.clients.forEach(c =>{
    if (c.readyState === c.OPEN)
    {
      c.send(msg);
    }
  });
}

const server = net.createServer(socket => {
  console.log(chalk.green(
    `[TCP] client → ${socket.remoteAddress}:${socket.remotePort}`
  ));

  socket.on('data', buf => {
    const msg = buf.toString().trim();
    console.log(chalk.cyan('[TCP] recv →'), msg);
    broadcast(msg);
  });

  socket.on('close', () => console.log(chalk.yellow('[TCP] client closed')));
  socket.on('error', err => console.error('[TCP] error', err.message));
});

server.listen(TCP_PORT, HOST, () => {
  console.log(chalk.magenta(`[TCP] listening on ${HOST}:${TCP_PORT}`));
});
