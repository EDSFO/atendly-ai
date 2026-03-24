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
