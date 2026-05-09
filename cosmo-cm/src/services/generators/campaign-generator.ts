import { openAI } from "@/services/ai/openai-service";
import { CampaignInput, CampaignOutput } from "@/types/campaign";
import { getCampaignSystemPrompt, buildCampaignUserPrompt } from "@/prompts/campaign-prompt";
import { contextEngine } from "@/services/context/context-engine";

export class CampaignGenerator {
  async generate(input: CampaignInput): Promise<CampaignOutput> {
    try {
      // 1. Recover AI Memory & Context
      const aiContext = await contextEngine.buildGenerationContext(input.plataforma);

      // 2. Build Rich Prompts
      const systemPrompt = getCampaignSystemPrompt() + "\n\n" + aiContext;
      const userPrompt = buildCampaignUserPrompt(input);

      // 3. Generate with OpenAI (Hardened)
      const response = await openAI.generateChatCompletion(
        systemPrompt,
        userPrompt,
        true // useJsonFormat
      );

      // 4. Robust Parsing
      let parsed: any;
      try {
        // Handle cases where AI might include markdown backticks
        const cleanResponse = response.replace(/```json\n?|```/g, '').trim();
        parsed = JSON.parse(cleanResponse);
      } catch (parseError) {
        console.error("JSON Parse Error. Raw response:", response);
        throw new Error("La IA no devolvió un formato JSON válido.");
      }

      // 5. Validation and Fallback
      return this.validateOutput(parsed);

    } catch (error: any) {
      console.error("CampaignGenerator Error:", error.message);
      throw error;
    }
  }

  private validateOutput(data: any): CampaignOutput {
    if (!data.title || !data.copy) {
      throw new Error("Datos de campaña incompletos generados por la IA.");
    }

    return {
      title: data.title || "Sin título",
      copy: data.copy || "Contenido no generado.",
      hashtags: data.hashtags || "#Cosmica #MarketingIA",
      cta: data.cta || "Contáctanos ahora.",
      storyboard: data.storyboard || "No detallado.",
      visual_prompt: {
        description: data.visualPrompt?.description || "Imagen tecnológica abstracta",
        style: data.visualPrompt?.style || "modern",
        aspectRatio: data.visualPrompt?.aspectRatio || "--ar 16:9",
        rawPrompt: data.visualPrompt?.rawPrompt || "abstract technology background --ar 16:9"
      },
      whatsapp_version: {
        message: data.whatsapp?.message || data.copy || "",
        callToAction: data.whatsapp?.callToAction || "Escríbenos."
      }
    };
  }
}

export const campaignGenerator = new CampaignGenerator();
