import { MASTER_PROMPT } from "@/prompts/master-prompt";

// Using native fetch for OpenAI API interaction
export class OpenAIService {
  private apiKey: string;
  private isMockMode: boolean;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || "";
    // If no real API key is set, or if it's the placeholder from .env.example, use mock mode
    this.isMockMode = !this.apiKey || this.apiKey.includes("sk-placeholder") || this.apiKey.includes("sk-your_openai_api_key");
  }

  async generateChatCompletion(systemPrompt: string, userPrompt: string, useJsonFormat = false): Promise<string> {
    if (this.isMockMode) {
      console.warn("OpenAIService: Running in MOCK mode. Returning simulated response.");
      return this.getMockResponse(userPrompt, useJsonFormat);
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4-turbo-preview", // or gpt-3.5-turbo for cost saving
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

    } catch (error) {
      console.error("OpenAIService Error:", error);
      throw error;
    }
  }

  private getMockResponse(prompt: string, useJsonFormat: boolean): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (useJsonFormat) {
          const mockJson = {
            title: "Desata el poder de la IA en tu empresa",
            copy: "¿Todavía gestionas tus procesos manualmente? 🚫\n\nEl futuro pertenece a quienes automatizan. Con nuestra nueva plataforma SaaS, puedes reducir los tiempos operativos hasta un 80% y multiplicar tus ventas sin esfuerzo extra. 🚀\n\nNo te quedes atrás. Da el salto tecnológico hoy mismo. 🌌",
            hashtags: "#Tech #SaaS #IA #Automatizacion #CosmicaTech #InnovacionDigital",
            cta: "Haz clic en el enlace de nuestra bio y solicita tu Demo Gratuita hoy.",
            storyboard: "1. (0-2s) Plano detalle de un usuario frustrado con hojas de cálculo.\n2. (2-5s) Transición holográfica a nuestra interfaz de usuario (modo oscuro, acentos neón).\n3. (5-10s) Gráfico de métricas disparándose hacia arriba.\n4. (10-15s) Texto en pantalla 'Automatiza tu éxito' + Logo de Cósmica y CTA.",
            visualPrompt: {
              description: "A highly advanced holographic dashboard floating in a dark minimalist office space, blue and orange neon glowing data streams, photorealistic, 8k resolution, cinematic lighting.",
              style: "cyberpunk minimalista, 3d render",
              aspectRatio: "--ar 16:9",
              rawPrompt: "A highly advanced holographic dashboard floating in a dark minimalist office space, blue and orange neon glowing data streams, photorealistic, 8k resolution, cinematic lighting, cyberpunk minimalista, 3d render --ar 16:9 --v 6.0"
            },
            whatsapp: {
              message: "¡Hola! 🚀 Vimos que te interesa optimizar procesos. Nuestra nueva plataforma basada en IA puede automatizar tus flujos de trabajo. ¿Te gustaría ver una demo rápida de 5 min?",
              callToAction: "¿A qué hora te viene bien mañana?"
            }
          };
          resolve(JSON.stringify(mockJson));
        } else {
          resolve("Respuesta mockeada por defecto.");
        }
      }, 2000); // Simulate network latency
    });
  }
}

export const openAI = new OpenAIService();
