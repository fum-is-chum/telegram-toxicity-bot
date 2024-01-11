import tf from '@tensorflow/tfjs-node';
import cluster, { Worker } from 'cluster';
import os from 'os';
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { Logger } from "./utils/logger";
import { classifier } from "./utils/classifier";
import { ResponseMessage } from "./types/response";
import formatResponse from "./utils/message";
dotenv.config();

const isResponseMessage = (obj: any): obj is ResponseMessage => {
  return obj && typeof obj === 'object' && 'msg' in obj && 'result' in obj;
};

const numCPUs = Math.min(os.cpus().length, 3); // adjust how many workers to spawn

(async () => {
  if (cluster.isPrimary) {
    Logger.info(`Master ${process.pid} is running`);

    const bot = new TelegramBot(process.env.BOT_TOKEN!, { polling: true });
    Logger.success('Bot started');

    const queue: TelegramBot.Message[] = [];
    const availableWorkers: Worker[] = [];

    const sendToAvailableWorker = () => {
      if (queue.length > 0 && availableWorkers.length > 0) {
        const msg = queue.shift();
        const worker = availableWorkers.shift();
        if (msg && worker) {
          worker.send(msg);
        }
      }
    };

    bot.on('message', (msg) => {
      queue.push(msg);
      sendToAvailableWorker();
    });

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
      const worker = cluster.fork();

      worker.on('message', async (response: ResponseMessage | string) => {
        if (isResponseMessage(response)) {
          const formattedResponse = formatResponse(response);
          try {
            if(formattedResponse.text !== '') {
              bot.sendMessage(formattedResponse.chat_id, formattedResponse.text)
            }
          } finally {
            // Mark the worker as available after the message has been sent
            availableWorkers.push(worker);
            sendToAvailableWorker(); // check whether there are messages to process
          }
        } else {
          availableWorkers.push(worker);
          sendToAvailableWorker(); // check whether there are messages to process
        }
      });
    }

    cluster.on('exit', (worker, code, signal) => {
      Logger.error(`worker ${worker.process.pid} died`);
      const index = availableWorkers.indexOf(worker);
      if (index > -1) {
        availableWorkers.splice(index, 1);
      }
    });
  } else {
    try {
      Logger.highlight('Loading model...');
      await classifier.init();
      Logger.success('Model loaded successfully');
    } catch (error: any) {
      Logger.error('Failed to load model');
      Logger.error(error.message);
      process.exit(1);
    }
    process.on('message', (msg: TelegramBot.Message) => {
      // Process the update
      if (!msg.text) return;
      Logger.success(`Worker ${process.pid} received message: ${msg.text}`);

      // Process text and return response
      setTimeout(async () => {
        if (process.send) {
          const result = await classifier.classifySentences([msg.text!]);
          const response: ResponseMessage = {
            msg,
            result
          };
          process.send(response);
        }
      });
    });

    process.send && process.send('ready');

    Logger.success(`Worker ${process.pid} started`);
  }
})();