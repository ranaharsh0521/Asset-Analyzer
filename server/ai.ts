import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

// Load env explicitly
dotenv.config();

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey || apiKey === 'invalid-key-use-.env') {
  console.error('Missing API key. Set GOOGLE_API_KEY in .env');
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(apiKey!);

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIAnalysis {
  threatLevel: string;
  recommendations: string[];
  summary: string;
}

// System prompts
const SYSTEM_PROMPT = `You are a helpful AI assistant. Answer questions on any topic, provide information, and engage in general conversation. Be friendly and informative.`;

const ANALYSIS_PROMPT = `Cybersecurity expert. Respond ONLY with valid JSON:
{
  "threatLevel": "CRITICAL|HIGH|MEDIUM|LOW",
  "summary": "1-2 sentences",
  "recommendations": ["Action 1", "Action 2"]
}`;

// Chat function
export async function getAIResponse(messages: ChatMessage[]): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const chatPrompt = [
      SYSTEM_PROMPT,
      ...messages.map(m => `${m.role.toUpperCase()}: ${m.content}`)
    ].join('\n\n');
    
    const result = await model.generateContent(chatPrompt);
    return result.response.text()?.trim() || "Error generating response";
  } catch (error: any) {
    console.error("Gemini chat error:", error.message);
    if (error.status === 429) {
      return "API quota exceeded. Please try again later or upgrade your plan at https://ai.google.dev.";
    }
    return "Gemini API error. Check key and quota.";
  }
}

// Threat analysis
export async function analyzeThreat(
  alertData: string,
  networkData?: string
): Promise<AIAnalysis> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `${ANALYSIS_PROMPT}\n\nAlert: ${alertData}\nNetwork: ${networkData || 'N/A'}`;

    const result = await model.generateContent(prompt);
    const content = result.response.text()?.trim() || '';

    // Extract JSON
    const jsonMatch = content.match(/\{[^}]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as AIAnalysis;
      } catch {}
    }

    return {
      threatLevel: "MEDIUM",
      summary: content.slice(0, 100),
      recommendations: ["Review manually"],
    };
  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    if (error.status === 429) {
      return {
        threatLevel: "QUOTA_EXCEEDED",
        summary: "API quota exceeded. Unable to analyze threat at this time.",
        recommendations: ["Wait for quota reset", "Upgrade to paid plan at https://ai.google.dev"],
      };
    }
    return {
      threatLevel: "UNKNOWN",
      summary: "API error",
      recommendations: ["Check GOOGLE_API_KEY", "Verify quota"],
    };
  }
}

export default genAI;

