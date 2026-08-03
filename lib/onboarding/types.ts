export type OnboardingStepType = "task" | "knowledge_hub" | "manager_approval";

export type OnboardingTemplateStep = {
  id: string;
  template_id: string;
  position: number;
  step_type: OnboardingStepType;
  title: string;
  description: string | null;
  knowledge_hub_content_id: string | null;
  due_offset_days: number;
};

export type OnboardingTemplate = {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
};

export type OnboardingInstanceStep = {
  id: string;
  instance_id: string;
  position: number;
  step_type: OnboardingStepType;
  title: string;
  description: string | null;
  knowledge_hub_content_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
};
