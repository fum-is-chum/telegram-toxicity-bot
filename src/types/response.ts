import TelegramBot from "node-telegram-bot-api";

export type ResponseMessage = {
  msg: TelegramBot.Message,
  result: {
    label: string;
    results: {
      probabilities: Float32Array;
      match: boolean;
    }[];
  }[];
};
