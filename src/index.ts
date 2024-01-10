import cluster, { Worker } from 'cluster';
import os from 'os';
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { Logger } from "./utils/logger";
dotenv.config();

type ResponseMessage = {
  msg: TelegramBot.Message,
  result: string;
}

const isResponseMessage = (obj: any): obj is ResponseMessage => {
  return obj && typeof obj === 'object' && 'msg' in obj && 'result' in obj;
}

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  Logger.info(`Master ${process.pid} is running`);

  const bot = new TelegramBot(process.env.BOT_TOKEN!, { polling: true });
  Logger.success('Bot started')

  const queue: TelegramBot.Message[] = [];
  const availableWorkers: Map<number, Worker> = new Map();

  const sendToAvailableWorker = () => {
    if (queue.length > 0 && availableWorkers.size > 0) {
      const msg = queue.shift();
      const workerId = Array.from(availableWorkers.keys())[0];
      const worker = availableWorkers.get(workerId);
      if (msg && worker) {
        worker.send(msg);
        availableWorkers.delete(workerId);
      }
    }
  }

  bot.on('message', (msg) => {
    queue.push(msg);
    sendToAvailableWorker();
  });

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();

    worker.on('message', (response: ResponseMessage | string) => {
      if (isResponseMessage(response)) {
        bot.sendMessage(response.msg.chat.id, response.result);
      } else {
        availableWorkers.set(worker.id, worker);
        sendToAvailableWorker();
      }
    });
  }

  cluster.on('exit', (worker, code, signal) => {
    Logger.error(`worker ${worker.process.pid} died`);
    availableWorkers.delete(worker.id);
  });
} else {
  process.on('message', (msg: TelegramBot.Message) => {
    // Process the update
    Logger.success(`Worker ${process.pid} received message: ${msg.text}`);
    // Process text and return response
    if (process.send) {
      const response: ResponseMessage = {
        msg,
        result: 'Sucess'
      }
      process.send(response);
    }
  });

  process.send && process.send('ready');

  Logger.success(`Worker ${process.pid} started`);
}