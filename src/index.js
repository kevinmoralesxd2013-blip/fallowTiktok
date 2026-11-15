import 'dotenv/config';
import { startPoller } from './poller.js';
import { startServer } from './server.js';

startPoller();
startServer();
