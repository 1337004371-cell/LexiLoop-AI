import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "AIzaSyD12hpd8lyv5ikBZu830dbZszd-FE-GIJs“});

export const getGeminiResponse = async (
  prompt: string,
  systemInstruction?: string
) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I'm having trouble connecting right now.";
  }
};

export const generateWordDetails = async (word: string) => {
  const prompt = `Provide detailed info for the English word or phrase: "${word}". 
  Include: 
  1. Part of Speech (词性), e.g. "adj.", "noun", "verb".
  2. British (UK) and American (US) Phonetics (IPA).
  3. Concise Chinese definition.
  4. 2-3 Common Collocations (常见搭配) with translations.
  5. 3 real-world professional or daily life example sentences with Chinese translations.
  
  Return in JSON format:
  {
    "pos": string,
    "ukPhonetic": string,
    "usPhonetic": string,
    "definition": string,
    "collocations": [{ "phrase": string, "translation": string }],
    "examples": [{ "sentence": string, "translation": string }]
  }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pos: { type: Type.STRING },
            ukPhonetic: { type: Type.STRING },
            usPhonetic: { type: Type.STRING },
            definition: { type: Type.STRING },
            collocations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  phrase: { type: Type.STRING },
                  translation: { type: Type.STRING }
                },
                required: ["phrase", "translation"]
              }
            },
            examples: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sentence: { type: Type.STRING },
                  translation: { type: Type.STRING }
                },
                required: ["sentence", "translation"]
              }
            }
          },
          required: ["pos", "ukPhonetic", "usPhonetic", "definition", "collocations", "examples"]
        }
      },
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Word Detail Error:", error);
    return null;
  }
};

export const generatePodcastDialogue = async (words: string[]) => {
  const prompt = `Create a realistic workplace or daily life conversation script between two people (Person A and Person B) that naturally incorporates these English words/phrases: ${words.join(', ')}.
  
  Requirements:
  1. Setting: A specific professional or daily scenario.
  2. Length: Approximately 250-320 words.
  3. Tone: Very natural and conversational.
  4. Format: Line by line dialogue.
  5. Characters: Give Person A and Person B realistic names (e.g., Sarah, Mark, etc.).
  
  You must provide:
  1. A list of lines, each with the speaker's name, the English text, and Chinese translation.
  2. The character identity mapping (which name corresponds to speaker A or B role).

  Return in JSON format:
  {
    "characters": { "A": "string", "B": "string" },
    "lines": [
      {
        "speaker": "A" | "B",
        "name": "string",
        "text": "string",
        "translation": "string"
      }
    ]
  }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            characters: {
              type: Type.OBJECT,
              properties: {
                A: { type: Type.STRING },
                B: { type: Type.STRING }
              },
              required: ["A", "B"]
            },
            lines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING, enum: ["A", "B"] },
                  name: { type: Type.STRING },
                  text: { type: Type.STRING },
                  translation: { type: Type.STRING }
                },
                required: ["speaker", "name", "text", "translation"]
              }
            }
          },
          required: ["characters", "lines"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Podcast Generation Error:", error);
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
