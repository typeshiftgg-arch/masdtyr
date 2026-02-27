import { GoogleGenAI, Type } from "@google/genai";

export const scanReceipt = async (base64Image: string) => {
  const apiKey = (process.env.GEMINI_API_KEY as string) || "";
  
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please set GEMINI_API_KEY in your environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyze this receipt/bill image. Extract all items, their prices, and categorize each item. 
  Also provide a general category for the entire receipt.
  Return the data in a structured JSON format.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                category: { type: Type.STRING },
              },
              required: ["title", "amount", "category"],
            },
          },
          totalAmount: { type: Type.NUMBER },
          mainCategory: { type: Type.STRING },
          merchantName: { type: Type.STRING },
          date: { type: Type.STRING, description: "ISO format date if found, else null" },
        },
        required: ["items", "totalAmount", "mainCategory"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
};
