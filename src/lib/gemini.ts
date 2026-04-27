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

export const generateWordDetails = async (word: string) => {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  const cacheKey = `word_detail_v1_${word.toLowerCase()}`;

  // 1. 尝试从本地缓存获取
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      localStorage.removeItem(cacheKey);
    }
  }

  // 2. DeepSeek Prompt
  const prompt = `Analyze the English word/phrase "${word}". Provide the following information in strict JSON format:
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
    const content = data.choices[0].message.content;

    // 3. 存入缓存并返回
    localStorage.setItem(cacheKey, content);
    return JSON.parse(content);
  } catch (error) {
    console.error("DeepSeek Word Detail Error:", error);
    return null;
  }
};

export const generatePodcastDialogue = async (words: string[]) => {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;

  const prompt = `Create a realistic workplace or daily life conversation script between two people (Person A and Person B) that naturally incorporates these English words: ${words.join(', ')}.
  
  Requirements:
  1. Setting: A specific professional or daily scenario.
  2. Tone: Very natural and conversational.
  3. Format: Line by line dialogue.

  Return the dialogue in strict JSON format:
  {
    "characters": { "A": "Name", "B": "Name" },
    "lines": [
      { "speaker": "A", "name": "Name", "text": "English text", "translation": "Chinese translation" },
      { "speaker": "B", "name": "Name", "text": "English text", "translation": "Chinese translation" }
    ]
  }`;

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
          { role: "system", content: "You are a professional language learning content creator. Response must be in JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error("DeepSeek Podcast Error:", error);
    return null;
  }
};

export const parseScenarioFromImage = async (base64Image: string, mimeType: string) => {
  const prompt = `Analyze this image and create a language learning conversation scenario based on its content. 
  Extract the key situation, the roles involved, and determine a professional or life category.
  
  Return in JSON format:
  {
    "title": "string (Short catchy name)",
    "description": "string (Brief context of what to practice)",
    "category": "Workplace",
    "systemPrompt": "string (Detailed instructions for AI on how to behave, tone, and specific topics to cover)",
    "initialMessage": "string (The first message AI should say to start the exchange)"
  }
  
  Note: category MUST be one of: "Workplace", "Daily", "Travel", "Other".`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { inlineData: { data: base64Image, mimeType: mimeType } },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            systemPrompt: { type: Type.STRING },
            initialMessage: { type: Type.STRING }
          },
          required: ["title", "description", "category", "systemPrompt", "initialMessage"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Image Scenario Error:", error);
    return null;
  }
};
