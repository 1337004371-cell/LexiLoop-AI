import { STORY_SYSTEM_PROMPT, buildStoryUserPrompt } from '../prompts/story-generator';

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
export const getGeminiResponse = async (
  prompt: string,
  systemInstruction?: string
) => {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
          { role: "user", content: prompt }
        ],
        stream: false
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "DeepSeek API Error");
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error("DeepSeek API Error:", error);
    return "Sorry, I'm having trouble connecting to the AI service right now.";
  }
};

// 注意：确保文件顶部有这两行导入，如果没有请加上
import { db } from './firebase'; 
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const generateWordDetails = async (word: string) => {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  const wordKey = word.toLowerCase().trim();

  // 1. 先尝试从 Firestore 云端数据库获取（实现跨设备同步的关键）
  try {
    const docRef = doc(db, "word_cache", wordKey);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log("从云端获取到单词详情:", word);
      return docSnap.data();
    }
  } catch (e) {
    console.error("云端读取失败:", e);
    // 如果云端读取失败，继续尝试 API 调用
  }

  // 2. 如果云端没有，则调用 DeepSeek API
  const wordCount = word.trim().split(/\s+/).length;
  const isSentence = wordCount > 3 || /[.!?]$/.test(word.trim());

  const prompt = isSentence
    ? `The user saved an English sentence/phrase: "${word}". Provide the following in strict JSON format:
  {
    "pos": "sentence/phrase",
    "ukPhonetic": "",
    "usPhonetic": "",
    "definition": "完整中文翻译",
    "collocations": [{ "phrase": "key phrase from the sentence", "translation": "该短语的中文翻译" }],
    "examples": [{ "sentence": "a similar sentence using the same structure", "translation": "该句的中文翻译" }]
  }
  Important: "definition" must be the COMPLETE Chinese translation of the entire sentence. Extract 2-3 key phrases into collocations. Return ONLY the JSON object, no other text.`
    : `Analyze the English word/phrase "${word}". Provide the following information in strict JSON format:
  {
    "pos": "part of speech",
    "ukPhonetic": "UK phonetic",
    "usPhonetic": "US phonetic",
    "definition": "Chinese definition",
    "collocations": [{ "phrase": "phrase", "translation": "translation" }],
    "examples": [{ "sentence": "sentence", "translation": "translation" }]
  }
  Important: Return ONLY the JSON object, no other text.`;

  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a professional English teacher. Response must be in JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    const contentString = data.choices[0].message.content;
    const content = JSON.parse(contentString);

    // 3. 拿到结果后，立刻存入 Firestore 云端
    // 这样下次你用另一台设备打开，就能直接从第1步获取，不用再花钱调 API 了
    try {
      await setDoc(doc(db, "word_cache", wordKey), content);
      console.log("单词已同步至云端");
    } catch (e) {
      console.error("同步至云端失败:", e);
    }

    return content;
  } catch (error) {
    console.error("DeepSeek 单词解析错误:", error);
    return null;
  }
};

export const generatePodcastDialogue = async (words: string[]) => {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: STORY_SYSTEM_PROMPT },
          { role: "user", content: buildStoryUserPrompt(words) }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("API error:", data.error?.message);
      return null;
    }

    const contentStr = data.choices?.[0]?.message?.content;
    if (!contentStr) {
      console.error("Empty response from API");
      return null;
    }

    const parsed = JSON.parse(contentStr);
    if (!parsed.lines || !Array.isArray(parsed.lines)) {
      console.error("Invalid response format:", parsed);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("DeepSeek Story Generation Error:", error);
    return null;
  }
};

export const parseScenarioFromImage = async (textContent: string) => {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;

  const prompt = `Based on the following text content, create a language learning conversation scenario.
The text might come from a screenshot, photo, or typed content. Analyze what the text is about, who the speakers might be, and what context this conversation would take place in.

User's text content:
"""
${textContent}
"""

Return in JSON format:
{
  "title": "string (Short catchy name for the scenario)",
  "description": "string (Brief context of what to practice, based on the text)",
  "category": "Workplace",
  "systemPrompt": "string (Detailed instructions for AI on how to behave, tone, and specific topics to cover. Include key vocabulary and phrases from the original text so the AI practices them with the user.)",
  "initialMessage": "string (The first message AI should say to start the exchange, naturally incorporating elements from the text)"
}

Note: category MUST be one of: "Workplace", "Daily", "Travel", "Other".`;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a language learning scenario designer. Response must be in JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("API error:", data.error?.message);
      return null;
    }

    const contentStr = data.choices?.[0]?.message?.content;
    if (!contentStr) {
      console.error("Empty response from API");
      return null;
    }

    return JSON.parse(contentStr);
  } catch (error) {
    console.error("DeepSeek Scenario Extraction Error:", error);
    return null;
  }
};
