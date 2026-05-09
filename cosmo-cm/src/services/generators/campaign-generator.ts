import { openAI } from "@/services/ai/openai-service";
import { getCampaignSystemPrompt, buildCampaignUserPrompt } from "@/prompts/campaign-prompt";
import { CampaignInput, CampaignOutput } from "@/types/campaign";

export class CampaignGenerator {
  async generate(input: CampaignInput): Promise<CampaignOutput> {
    try {
      const systemPrompt = getCampaignSystemPrompt();
      const userPrompt = buildCampaignUserPrompt(input);

      const responseString = await openAI.generateChatCompletion(
        systemPrompt,
        userPrompt,
        true // Use JSON format
      );

      // Parse the JSON response
      const output: CampaignOutput = JSON.parse(responseString);
      
      // Tag it if it was mocked (handled inside OpenAIService based on env)
      return {
        ...output,
        mocked: !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes("placeholder")
      };

    } catch (error) {
      console.error("CampaignGenerator Error:", error);
      throw new Error("No se pudo generar la campaña. Por favor, intenta de nuevo.");
    }
  }
}

export const campaignGenerator = new CampaignGenerator();
