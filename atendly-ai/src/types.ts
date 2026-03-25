export interface Tenant {
  id: number;
  name: string;
  slug: string;
  segment: 'beauty' | 'health' | 'general';
  theme_color: string;
  ai_context?: string;
  default_agent_id?: number;
}

export interface Service {
  id: number;
  tenant_id: number;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
}

export interface Professional {
  id: number;
  tenant_id: number;
  name: string;
  specialty: string;
  bio: string;
}

export interface Appointment {
  id: number;
  tenant_id: number;
  professional_id: number;
  service_id: number;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  service_name?: string;
  professional_name?: string;
}

// User (funcionário)
export interface User {
  id: number;
  tenant_id: number;
  email: string;
  name: string;
  role: 'user' | 'manager' | 'admin';
  is_active: boolean;
  created_at: string;
}

// User Agent (agente liberado para usuário)
export interface UserAgent {
  id: number;
  user_id: number;
  tenant_agent_id: number;
  is_active: boolean;
  agent_id?: number;
  agent_name?: string;
  agent_type?: string;
  custom_personality?: any;
  system_prompt?: string;
  is_orchestrator?: boolean;
}

// Rich Content Types
export type RichContentType = 'text' | 'image' | 'card' | 'carousel' | 'link' | 'code' | 'composite';

export interface RichContent {
  type: RichContentType;
  content: any;
  panel?: 'marketing' | 'sales' | 'support' | 'default';
}

export interface AgentChatResponse {
  text: string;
  rich_content?: RichContent;
  panel_to_open?: string;
  agent_used?: {
    id: number;
    name: string;
    sub_agent_id?: number;
    sub_agent_name?: string;
  };
}
