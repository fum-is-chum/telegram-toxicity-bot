import * as toxicity from '@tensorflow-models/toxicity';

// The minimum prediction confidence.
const THRESHOLD = 0.9;
let modelPromise: Promise<toxicity.ToxicityClassifier> | null = null;

const init = async () => {
  modelPromise = toxicity.load(THRESHOLD, []);
  await modelPromise;
}

const classifySentences = async (sentences: string[]) => {
  if (!modelPromise) {
    throw new Error("Model not initialized. Please call init first.");
  }
  const model = await modelPromise;
  const predictions = await model.classify(sentences);
  return predictions;
}

export const classifier = {
  init,
  classifySentences
};