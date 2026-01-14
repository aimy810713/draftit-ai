
import { GoogleGenAI } from "@google/genai";

/**
 * PRODUCTION SECURITY & DEPLOYMENT GUIDE:
 * 
 * 1. API KEY PROTECTION:
 *    The Gemini API key is accessed exclusively via `process.env.API_KEY`.
 *    This key is injected by the secure build/deployment environment.
 *    The frontend code never hardcodes or exposes this key to public users.
 * 
 * 2. WHERE TO ADD YOUR KEY:
 *    - Vercel/Render/Netlify: Add "API_KEY" in the 'Environment Variables' section of your project settings.
 *    - Local Development: Use a `.env` file (which is ignored by git) containing: API_KEY=your_key_here
 * 
 * 3. COST CONTROL:
 *    We use the 'gemini-3-flash-preview' model for an optimal balance of speed, 
 *    accuracy, and cost-efficiency for formal drafting tasks.
 */

// Basic configuration check to prevent app crashes if environment is not set up
const isAiConfigured = Boolean(process.env.API_KEY);

export async function generateDocument(docType: string, formData: any): Promise<string> {
  if (!isAiConfigured) {
    console.error("AI Configuration Missing: The API_KEY environment variable is not set.");
    // We throw a user-friendly error that the UI can catch and display gracefully
    throw new Error("System configuration error. Please contact support.");
  }

  // Always use the required constructor format
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    You are an experienced Indian office professional and documentation expert. 
    Your task is to write a ${docType} that is calm, polite, and follows standard Indian formal English.
    
    Guidelines:
    - Tone: Professional, respectful, and confident. 
    - Style: Standard Indian business letter format.
    - Audience: Indian HR managers, Bank managers, Police officers, or College Principals.
    - No Filler: Do not include introductory text. Just provide the letter content.

    User Details provided:
    ${JSON.stringify(formData, null, 2)}
    
    Length: Maximum 350 words.
    Return ONLY the final document text ready for printing.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        maxOutputTokens: 1000,
        thinkingConfig: { thinkingBudget: 400 },
        temperature: 0.7,
      }
    });

    // Access .text as a property as per SDK requirements
    const text = response.text;
    
    if (!text) {
      throw new Error("The AI returned an empty response. Please try again.");
    }
    
    return text.trim();
  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    
    // Check for common API errors to provide better feedback
    if (error.message?.includes('429')) {
      throw new Error("Server is busy. Please try again in 1 minute.");
    }
    
    throw new Error("We couldn't generate your draft right now. Please try again.");
  }
}
