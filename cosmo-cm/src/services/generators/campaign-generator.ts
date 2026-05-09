import { openAIService } from "@/services/ai/openai-service";
import { CampaignInput, CampaignOutput } from "@/types/campaign";
import { buildCampaignPrompt } from "@/prompts/campaign-prompt";
import { contextEngine } from "@/services/context/context-engine";

export class CampaignGenerator {
  async generate(input: CampaignInput): Promise<CampaignOutput> {
    // 1. Recover AI Memory & Context
    const aiContext = await contextEngine.buildGenerationContext(input.plataforma);

    // 2. Build Rich Prompt with Context
    const prompt = buildCampaignPrompt(input) + "\n\n" + aiContext;

    // 3. Generate with OpenAI
    const response = await openAIService.generateChatCompletion(prompt);

    // 4. Parse and return
    try {
      const parsed = JSON.parse(response);
      return parsed as CampaignOutput;
    } catch (e) {
      console.error("Error parsing campaign JSON:", e);
      throw new Error("La IA devolvió un formato inválido. Intenta de nuevo.");
    }
  }
}

export const campaignGenerator = new CampaignGenerator();
