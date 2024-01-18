import { ResponseMessage } from "../types/response";

const formatResponse = (response: ResponseMessage) => {
  const { msg, result } = response;
  const { chat, from } = msg;
  const { id } = chat;

  let text = '';
  const matchedLabels: string[] = [];

  result.forEach(({ label, results }) => {
    const { match } = results[0];
    if (match) {
      matchedLabels.push(label);
    }
  });

  if (matchedLabels.length > 0) {
    const labels = matchedLabels.join(', ');
    text = `@${from?.username}, you are warned! ${labels} are detected!`;
  }

  return {
    chat_id: id,
    msg_id: msg.message_id,
    text,
  };
}

export default formatResponse;