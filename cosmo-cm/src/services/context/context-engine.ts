import { memoryEngine } from "@/services/memory/memory-engine";
import { knowledgeEngine } from "@/services/knowledge/knowledge-engine";
import { KnowledgeContext } from "@/types/memory";

export class ContextEngine {
  async buildGenerationContext(platform: string): Promise<string> {
    const hooks = await knowledgeEngine.getViralHooks(platform);
    const branding = await knowledgeEngine.getBrandingRules();
    
    const context = `
CONTEXTO DE MEMORIA CÓSMICA:
- Reglas de Branding: ${branding.join(", ")}
- Hooks Virales Exitosos para ${platform}: ${hooks.map(h => h.hook).join(" | ")}
- Identidad Histórica: Enfocada en transformación digital y alta tecnología.
`;

    return context;
  }
}

export const contextEngine = new ContextEngine();
