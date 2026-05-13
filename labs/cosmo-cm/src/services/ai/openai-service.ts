import { MASTER_PROMPT } from "@/prompts/master-prompt";

export class OpenAIService {
  private apiKey: string;
  private isMockMode: boolean;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || "";
    // Hardened detection: If explicitly in demo mode or missing key
    this.isMockMode = 
      process.env.NEXT_PUBLIC_DEMO_MODE === "true" || 
      !this.apiKey || 
      this.apiKey.includes("sk-placeholder");
  }

  async generateChatCompletion(systemPrompt: string, userPrompt: string, useJsonFormat = false): Promise<string> {
    if (this.isMockMode) {
      console.warn("[OpenAIService] Operating in MOCK mode.");
      return this.getMockResponse(userPrompt, useJsonFormat);
    }

    if (!this.apiKey) {
      throw new Error("CRITICAL: OpenAI API Key is missing for production generation.");
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4-turbo-preview",
          messages: [
            { role: "system", content: `${MASTER_PROMPT}\n\n${systemPrompt}` },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
          response_format: useJsonFormat ? { type: "json_object" } : { type: "text" }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API Error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;

    } catch (error: any) {
      console.error("[OpenAIService] Fatal Error:", error.message);
      throw error;
    }
  }

  private getMockResponse(prompt: string, useJsonFormat: boolean): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (useJsonFormat) {
          const mockJson = {
            title: "Revolución IA para tu marca",
            copy: "El futuro ya está aquí. ¿Estás preparado para escalar? Con Cósmica, tu presencia digital alcanza una nueva dimensión. 🌌✨",
            hashtags: "#IA #Marketing #Cosmica #Innovacion",
            cta: "Descubre más en el enlace.",
            storyboard: "1. Intro tecnológica.\n2. Beneficios IA.\n3. Logo Cósmica.",
            visualPrompt: {
              description: "Cinematic shot of a futuristic data center with holographic projections, neon lighting, photorealistic.",
              style: "cyberpunk",
              aspectRatio: "--ar 16:9",
              rawPrompt: "Futuristic data center, holographic projections, neon lighting, photorealistic --ar 16:9"
            },
            whatsapp: {
              message: "¡Hola! ¿Listo para el siguiente nivel?",
              callToAction: "Solicita tu demo."
            }
          };
          resolve(JSON.stringify(mockJson));
        } else {
          resolve("AI Response Simulated.");
        }
      }, 1500);
    });
  }
}

export const openAI = new OpenAIService();
