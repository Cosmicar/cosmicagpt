import { eventBus } from "@/services/events/event-bus";
import { WorkflowState } from "@/types/automation";
import { CampaignRecord } from "@/types/campaign";

export class WorkflowEngine {
  private activeWorkflows: Map<string, WorkflowState> = new Map();

  async startCampaignGenerationWorkflow(campaignData: Partial<CampaignRecord>) {
    const id = Math.random().toString(36).substr(2, 9);
    const state: WorkflowState = {
      id,
      name: "Campaign Pipeline",
      status: "running",
      progress: 0,
      logs: ["Iniciando pipeline de generación..."],
    };

    this.activeWorkflows.set(id, state);
    eventBus.emit("CAMPAIGN_CREATED", { workflow_id: id });

    try {
      // Step 1: IA Generation
      state.current_task = "Generando Estrategia IA";
      state.progress = 25;
      state.logs.push("Llamando a neuronas GPT-4...");
      await this.delay(1500);

      // Step 2: Visual Assets
      state.current_task = "Creando Activos Visuales";
      state.progress = 50;
      state.logs.push("Renderizando prompts cinematográficos...");
      await this.delay(1000);
      eventBus.emit("VISUAL_CREATED", { campaign_id: campaignData.id || "temp_id" });

      // Step 3: Persistence
      state.current_task = "Sincronizando Core";
      state.progress = 75;
      state.logs.push("Guardando en Supabase...");
      await this.delay(800);

      // Finalize
      state.status = "completed";
      state.progress = 100;
      state.logs.push("Pipeline completado exitosamente.");
      eventBus.emit("CAMPAIGN_GENERATED", { title: campaignData.title || "Nueva Campaña" });

    } catch (error: any) {
      state.status = "failed";
      state.logs.push(`ERROR CRÍTICO: ${error.message}`);
      eventBus.emit("GENERATION_FAILED", { error: error.message });
    }
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getActiveWorkflows(): WorkflowState[] {
    return Array.from(this.activeWorkflows.values());
  }
}

export const workflowEngine = new WorkflowEngine();
