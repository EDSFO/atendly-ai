import dotenv from "dotenv";
dotenv.config();

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype) ||
        file.originalname.endsWith('.txt') ||
        file.originalname.endsWith('.pdf') ||
        file.originalname.endsWith('.docx')) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});
import { initDb, db } from "./server/db";
import { handleChat, handleMultiAgentChat, extractInfoFromUrl } from "./server/ai";
import { handleIncomingMessage, sendMessage, configureWebhook, getQrCode, getInstanceStatus } from "./server/whatsapp";
import {
  AGENT_TEMPLATES,
  getAgents,
  getAgent,
  createAgent,
  createAgentFromTemplate,
  updateAgent,
  deleteAgent,
  addDocument,
  getDocuments,
  deleteDocument,
  searchDocuments
} from "./server/agents";
import {
  getCatalogAgents,
  getCatalogAgentsWithSubAgents,
  getCatalogAgent,
  createCatalogAgent,
  updateCatalogAgent,
  deleteCatalogAgent,
  getSubAgents,
  addSubAgent,
  updateSubAgent,
  deleteSubAgent,
  getTenantAgents,
  getTenantAgentsWithOrchestrator,
  getTenantAgent,
  activateTenantAgent,
  deactivateTenantAgent,
  updateTenantAgentPersonality,
  updateTenantSubAgentPersonality,
  checkAgentAccess,
  activateSubscription,
  getSubscription,
  getCatalogSubAgentDocuments,
  addCatalogSubAgentDocument,
  deleteCatalogSubAgentDocument,
  getTenantSubAgentDocuments,
  addTenantSubAgentDocument,
  deleteTenantSubAgentDocument
} from "./server/catalog";

let dbStatus = "unknown";
let dbInitError: any = null;

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Initialize Database (Non-blocking)
  console.log("Starting DB Initialization...");
  initDb().then(() => {
    console.log("DB Initialized successfully");
    dbStatus = "connected";
  }).catch(e => {
    console.error("DB Init Failed:", e);
    dbStatus = "failed";
    dbInitError = e;
  });

  app.use(express.json());

  // API Routes
  
  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", dbStatus, dbInitError });
  });

  app.get("/api/check-columns", async (req, res) => {
    try {
      const result = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants'");
      res.json(result.rows.map(r => r.column_name));
    } catch (e) {
      res.status(500).json({ error: e });
    }
  });

  // DB Check
  app.get("/api/db-check", async (req, res) => {
    try {
      const result = await db.query('SELECT 1');
      res.json({ status: "ok", result: result.rows });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Database connection failed" });
    }
  });

  // Scan Website Endpoint
  app.post("/api/scan-website", async (req, res) => {
    const { url } = req.body;
    try {
      const info = await extractInfoFromUrl(url);
      res.json({ context: info });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to scan website" });
    }
  });
  
  // Get All Tenants
  app.get("/api/tenants", async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM tenants ORDER BY id DESC');
      res.json(result.rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Get Tenant by Slug
  app.get("/api/tenants/:slug", async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM tenants WHERE slug = $1', [req.params.slug]);
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: "Tenant not found" });
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Create Tenant
  app.post("/api/tenants", async (req, res) => {
    console.log("Received create tenant request:", req.body);
    const { name, slug, segment, theme_color } = req.body;
    
    try {
      console.log("Executing insert query...");
      const result = await db.query(
        "INSERT INTO tenants (name, slug, segment, theme_color, ai_context) VALUES ($1, $2, $3, $4, '') RETURNING id",
        [name, slug, segment, theme_color || '#000000']
      );
      console.log("Insert successful, result:", result.rows[0]);
      res.json({ id: result.rows[0].id, slug });
    } catch (error: any) {
      console.error("Error creating tenant:", error);
      res.status(500).json({ 
        error: "Failed to create tenant", 
        details: error.message,
        stack: error.stack 
      });
    }
  });

  // Update Tenant (Settings & AI Context)
  app.put("/api/tenants/:id", async (req, res) => {
    const { name, theme_color, ai_context, default_agent_id } = req.body;
    try {
      await db.query(
        "UPDATE tenants SET name = $1, theme_color = $2, ai_context = $3, default_agent_id = $4 WHERE id = $5",
        [name, theme_color, ai_context, default_agent_id || null, req.params.id]
      );
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update tenant" });
    }
  });

  // Get Services for Tenant
  app.get("/api/tenants/:id/services", async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM services WHERE tenant_id = $1', [req.params.id]);
      // Convert price string to number if needed (pg returns decimals as strings usually)
      const services = result.rows.map(s => ({...s, price: parseFloat(s.price)}));
      res.json(services);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Add Service
  app.post("/api/services", async (req, res) => {
    const { tenant_id, name, duration_minutes, price } = req.body;
    try {
      const result = await db.query(
        "INSERT INTO services (tenant_id, name, duration_minutes, price) VALUES ($1, $2, $3, $4) RETURNING id",
        [tenant_id, name, duration_minutes, price]
      );
      res.json({ id: result.rows[0].id, success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to add service" });
    }
  });

  // Delete Service
  app.delete("/api/services/:id", async (req, res) => {
    try {
      await db.query("DELETE FROM services WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete service" });
    }
  });

  // Get Professionals for Tenant
  app.get("/api/tenants/:id/professionals", async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM professionals WHERE tenant_id = $1', [req.params.id]);
      res.json(result.rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Add Professional
  app.post("/api/professionals", async (req, res) => {
    const { tenant_id, name, specialty } = req.body;
    try {
      const result = await db.query(
        "INSERT INTO professionals (tenant_id, name, specialty) VALUES ($1, $2, $3) RETURNING id",
        [tenant_id, name, specialty]
      );
      res.json({ id: result.rows[0].id, success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to add professional" });
    }
  });

  // Delete Professional
  app.delete("/api/professionals/:id", async (req, res) => {
    try {
      await db.query("DELETE FROM professionals WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete professional" });
    }
  });

  // Create Appointment
  app.post("/api/appointments", async (req, res) => {
    const { tenant_id, professional_id, service_id, customer_name, customer_phone, start_time } = req.body;
    
    try {
      const result = await db.query(`
        INSERT INTO appointments (tenant_id, professional_id, service_id, customer_name, customer_phone, start_time)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [tenant_id, professional_id, service_id, customer_name, customer_phone, start_time]);
      res.json({ id: result.rows[0].id, success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  // Get Appointments (Simple list for MVP dashboard)
  app.get("/api/tenants/:id/appointments", async (req, res) => {
    try {
      const result = await db.query(`
        SELECT a.*, s.name as service_name, p.name as professional_name 
        FROM appointments a
        JOIN services s ON a.service_id = s.id
        JOIN professionals p ON a.professional_id = p.id
        WHERE a.tenant_id = $1
        ORDER BY a.start_time DESC
      `, [req.params.id]);
      
      // Format dates if needed, but JS usually handles ISO strings fine
      res.json(result.rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Database error" });
    }
  });

  // WhatsApp Configuration Endpoint
  app.post("/api/whatsapp/config", async (req, res) => {
    const { tenant_id, instance_key, webhook_url, access_token } = req.body;
    try {
      // Check if config exists
      const existing = await db.query("SELECT * FROM whatsapp_config WHERE tenant_id = $1", [tenant_id]);
      
      if (existing.rows.length > 0) {
        await db.query(
          "UPDATE whatsapp_config SET instance_key = $1, webhook_url = $2, access_token = $3 WHERE tenant_id = $4",
          [instance_key, webhook_url, access_token, tenant_id]
        );
      } else {
        await db.query(
          "INSERT INTO whatsapp_config (tenant_id, instance_key, webhook_url, access_token) VALUES ($1, $2, $3, $4)",
          [tenant_id, instance_key, webhook_url, access_token]
        );
      }
      
      // Attempt to configure webhook on MegaAPI side
      try {
        await configureWebhook(instance_key, webhook_url);
      } catch (e) {
        console.error("Failed to configure webhook on MegaAPI:", e);
        // Don't fail the request, just log it
      }

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save WhatsApp config" });
    }
  });

  // Get WhatsApp QR Code
  app.get("/api/whatsapp/qrcode/:tenantId", async (req, res) => {
    try {
      const config = await db.query("SELECT instance_key FROM whatsapp_config WHERE tenant_id = $1", [req.params.tenantId]);
      if (config.rows.length === 0) {
        return res.status(404).json({ error: "WhatsApp not configured for this tenant" });
      }
      
      const instanceKey = config.rows[0].instance_key;
      const result = await getQrCode(instanceKey);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get QR code" });
    }
  });

  // Get WhatsApp Status
  app.get("/api/whatsapp/status/:tenantId", async (req, res) => {
    try {
      const config = await db.query("SELECT instance_key FROM whatsapp_config WHERE tenant_id = $1", [req.params.tenantId]);
      if (config.rows.length === 0) {
        return res.status(404).json({ error: "WhatsApp not configured for this tenant" });
      }
      
      const instanceKey = config.rows[0].instance_key;
      const result = await getInstanceStatus(instanceKey);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  // WhatsApp Webhook Endpoint
  app.post("/api/whatsapp/webhook/:instanceKey", async (req, res) => {
    const { instanceKey } = req.params;
    const payload = req.body;
    
    try {
      console.log(`Received webhook for instance ${instanceKey}`);
      await handleIncomingMessage(payload);
      res.json({ success: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // Send WhatsApp Message Endpoint (for testing)
  app.post("/api/whatsapp/send", async (req, res) => {
    const { tenant_id, to, message } = req.body;
    try {
      const config = await db.query("SELECT instance_key FROM whatsapp_config WHERE tenant_id = $1", [tenant_id]);
      if (config.rows.length === 0) {
        return res.status(404).json({ error: "WhatsApp not configured for this tenant" });
      }
      
      const instanceKey = config.rows[0].instance_key;
      const result = await sendMessage(instanceKey, to, message);
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Chat Endpoint
  app.post("/api/chat", async (req, res) => {
    const { message, tenant_id, history, agent_id, auto_route } = req.body;
    try {
      let response = '';
      let agentIdUsed: number | null = null;

      if (agent_id || auto_route) {
        // Use multi-agent chat
        const result = await handleMultiAgentChat(message, tenant_id, history || [], {
          agent_id,
          auto_route
        });
        response = result.response;
        agentIdUsed = result.agent_id_used;
        res.json({ text: response, ...result });
      } else {
        // Legacy single-agent mode
        response = await handleChat(message, tenant_id, history || []);
        res.json({ text: response });
      }

      // Salvar mensagens no banco com agent_id
      if (agentIdUsed) {
        try {
          await db.query(
            `INSERT INTO messages (tenant_id, agent_id, contact_id, role, content, platform)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [tenant_id, agentIdUsed, 'web_session', 'user', message, 'web']
          );
          await db.query(
            `INSERT INTO messages (tenant_id, agent_id, contact_id, role, content, platform)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [tenant_id, agentIdUsed, 'web_session', 'assistant', response, 'web']
          );
        } catch (saveError) {
          console.error("Error saving messages to database:", saveError);
          // Don't fail the request if message saving fails
        }
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Chat failed" });
    }
  });

  // ========== AGENTS API ==========

  // Get agent templates
  app.get("/api/agents/templates", (req, res) => {
    const templates = Object.entries(AGENT_TEMPLATES).map(([key, value]) => ({
      key,
      ...value
    }));
    res.json(templates);
  });

  // ========== GLOBAL AGENTS API ==========

  // Get all global agents
  app.get("/api/agents/global", async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM agents WHERE is_global = true ORDER BY created_at DESC'
      );
      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get global agents" });
    }
  });

  // Create global agent
  app.post("/api/agents/global", async (req, res) => {
    try {
      const { name, description, system_prompt, agent_type, personality, parent_agent_id } = req.body;
      const agent = await createAgent({
        name,
        description,
        system_prompt,
        agent_type,
        is_global: true,
        personality,
        parent_agent_id
      });
      res.json(agent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create global agent" });
    }
  });

  // Get global agent by ID
  app.get("/api/agents/global/:id", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const agent = await getAgent(agentId);
      if (!agent || !agent.is_global) {
        return res.status(404).json({ error: "Global agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get global agent" });
    }
  });

  // Update global agent
  app.put("/api/agents/global/:id", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const { name, description, system_prompt, personality, is_active } = req.body;
      const existing = await getAgent(agentId);
      if (!existing || !existing.is_global) {
        return res.status(404).json({ error: "Global agent not found" });
      }
      const agent = await updateAgent(agentId, { name, description, system_prompt, personality, is_active });
      res.json(agent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update global agent" });
    }
  });

  // Delete global agent
  app.delete("/api/agents/global/:id", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const existing = await getAgent(agentId);
      if (!existing || !existing.is_global) {
        return res.status(404).json({ error: "Global agent not found" });
      }
      await deleteAgent(agentId);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete global agent" });
    }
  });

  // ========== CATALOG AGENTS API (GESTOR) ==========

  // Get all catalog agents
  app.get("/api/catalog/agents", async (req, res) => {
    try {
      const agents = await getCatalogAgents();
      res.json(agents);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get catalog agents" });
    }
  });

  // Create catalog agent
  app.post("/api/catalog/agents", async (req, res) => {
    try {
      const { name, description, system_prompt, agent_type, personality, monthly_price, is_orchestrator, sub_agents } = req.body;
      if (!name || !system_prompt || !agent_type) {
        return res.status(400).json({ error: "name, system_prompt, and agent_type are required" });
      }
      const agent = await createCatalogAgent({ name, description, system_prompt, agent_type, personality, monthly_price, is_orchestrator, sub_agents });
      res.json(agent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create catalog agent" });
    }
  });

  // Update catalog agent
  app.put("/api/catalog/agents/:id", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const { name, description, system_prompt, personality, is_active, monthly_price } = req.body;
      const agent = await updateCatalogAgent(agentId, { name, description, system_prompt, personality, is_active, monthly_price });
      if (!agent) {
        return res.status(404).json({ error: "Catalog agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update catalog agent" });
    }
  });

  // Delete catalog agent
  app.delete("/api/catalog/agents/:id", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      await deleteCatalogAgent(agentId);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete catalog agent" });
    }
  });

  // Get catalog agents with sub-agents (orchestrators)
  app.get("/api/catalog/agents-with-subagents", async (req, res) => {
    try {
      const agents = await getCatalogAgentsWithSubAgents();
      res.json(agents);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get catalog agents" });
    }
  });

  // Get sub-agents of an orchestrator
  app.get("/api/catalog/agents/:id/sub-agents", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const subAgents = await getSubAgents(agentId);
      res.json(subAgents);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get sub-agents" });
    }
  });

  // Add sub-agent to orchestrator
  app.post("/api/catalog/agents/:id/sub-agents", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const { name, description, system_prompt, agent_type, personality } = req.body;
      if (!name || !system_prompt || !agent_type) {
        return res.status(400).json({ error: "name, system_prompt, and agent_type are required" });
      }
      const subAgent = await addSubAgent(agentId, { name, description, system_prompt, agent_type, personality });
      res.json(subAgent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to add sub-agent" });
    }
  });

  // Update sub-agent
  app.put("/api/catalog/sub-agents/:id", async (req, res) => {
    try {
      const subAgentId = parseInt(req.params.id);
      const { name, description, system_prompt, personality, agent_order } = req.body;
      const subAgent = await updateSubAgent(subAgentId, { name, description, system_prompt, personality, agent_order });
      res.json(subAgent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update sub-agent" });
    }
  });

  // Delete sub-agent
  app.delete("/api/catalog/sub-agents/:id", async (req, res) => {
    try {
      const subAgentId = parseInt(req.params.id);
      await deleteSubAgent(subAgentId);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete sub-agent" });
    }
  });

  // ========== CATALOG SUB-AGENT DOCUMENTS API (RAG) ==========

  // Get documents for catalog sub-agent
  app.get("/api/catalog/sub-agents/:id/documents", async (req, res) => {
    try {
      const subAgentId = parseInt(req.params.id);
      const documents = await getCatalogSubAgentDocuments(subAgentId);
      res.json(documents);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get sub-agent documents" });
    }
  });

  // Add document to catalog sub-agent
  app.post("/api/catalog/sub-agents/:id/documents", async (req, res) => {
    try {
      const subAgentId = parseInt(req.params.id);
      const { source_type, content, file_url, website_url } = req.body;
      if (!source_type) {
        return res.status(400).json({ error: "source_type is required" });
      }
      const document = await addCatalogSubAgentDocument(subAgentId, { source_type, content, file_url, website_url });
      res.json(document);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to add sub-agent document" });
    }
  });

  // Delete document from catalog sub-agent
  app.delete("/api/catalog/sub-agents/:id/documents/:docId", async (req, res) => {
    try {
      const docId = parseInt(req.params.docId);
      await deleteCatalogSubAgentDocument(docId);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete sub-agent document" });
    }
  });

  // ========== TENANT AGENTS API ==========

  // Get tenant's activated agents
  app.get("/api/tenants/:tenantId/agents", async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const agents = await getTenantAgents(tenantId);
      res.json(agents);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get tenant agents" });
    }
  });

  // Get tenant's activated agents with orchestrator grouping
  app.get("/api/tenants/:tenantId/agents-with-orchestrator", async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const agents = await getTenantAgentsWithOrchestrator(tenantId);
      res.json(agents);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get tenant agents" });
    }
  });

  // Activate agent from catalog
  app.post("/api/tenants/:tenantId/agents/activate", async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const { agent_id } = req.body;
      if (!agent_id) {
        return res.status(400).json({ error: "agent_id is required" });
      }

      // Check payment if active
      const access = await checkAgentAccess(tenantId, agent_id);
      if (!access.allowed) {
        return res.status(402).json({ error: "Payment required", payment_required: true });
      }

      const tenantAgent = await activateTenantAgent(tenantId, agent_id);
      res.json(tenantAgent);
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message || "Failed to activate agent" });
    }
  });

  // Deactivate agent
  app.delete("/api/tenants/:tenantId/agents/:agentId", async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const agentId = parseInt(req.params.agentId);
      await deactivateTenantAgent(tenantId, agentId);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to deactivate agent" });
    }
  });

  // Update tenant agent personality
  app.put("/api/tenant-agents/:id/personality", async (req, res) => {
    try {
      const tenantAgentId = parseInt(req.params.id);
      const { custom_personality } = req.body;
      if (!custom_personality) {
        return res.status(400).json({ error: "custom_personality is required" });
      }
      const agent = await updateTenantAgentPersonality(tenantAgentId, custom_personality);
      if (!agent) {
        return res.status(404).json({ error: "Tenant agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update personality" });
    }
  });

  // Update tenant sub-agent personality
  app.put("/api/tenant-sub-agents/:id/personality", async (req, res) => {
    try {
      const subAgentId = parseInt(req.params.id);
      const { custom_personality } = req.body;
      if (!custom_personality) {
        return res.status(400).json({ error: "custom_personality is required" });
      }
      const agent = await updateTenantSubAgentPersonality(subAgentId, custom_personality);
      if (!agent) {
        return res.status(404).json({ error: "Tenant sub-agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update sub-agent personality" });
    }
  });

  // ========== TENANT SUB-AGENT DOCUMENTS API (RAG) ==========

  // Get documents for tenant's sub-agent
  app.get("/api/tenant-sub-agents/:id/documents", async (req, res) => {
    try {
      const tenantAgentId = parseInt(req.params.id);
      const documents = await getTenantSubAgentDocuments(tenantAgentId);
      res.json(documents);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get tenant sub-agent documents" });
    }
  });

  // Add document to tenant's sub-agent
  app.post("/api/tenant-sub-agents/:id/documents", async (req, res) => {
    try {
      const tenantAgentId = parseInt(req.params.id);
      const { source_type, content, file_url, website_url } = req.body;
      if (!source_type) {
        return res.status(400).json({ error: "source_type is required" });
      }
      const document = await addTenantSubAgentDocument(tenantAgentId, { source_type, content, file_url, website_url });
      res.json(document);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to add tenant sub-agent document" });
    }
  });

  // Delete document from tenant's sub-agent
  app.delete("/api/tenant-sub-agents/:id/documents/:docId", async (req, res) => {
    try {
      const tenantAgentId = parseInt(req.params.id);
      const tenantId = parseInt(req.query.tenant_id as string);
      const docId = parseInt(req.params.docId);
      if (!tenantId) {
        return res.status(400).json({ error: "tenant_id is required" });
      }
      await deleteTenantSubAgentDocument(docId, tenantId);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete tenant sub-agent document" });
    }
  });

  // Get subscription status
  app.get("/api/tenant-agents/:id/subscription", async (req, res) => {
    try {
      const tenantAgentId = parseInt(req.params.id);
      const subscription = await getSubscription(tenantAgentId);
      res.json(subscription);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get subscription" });
    }
  });

  // Activate subscription (webhook callback)
  app.post("/api/tenant-agents/:id/subscription/activate", async (req, res) => {
    try {
      const tenantAgentId = parseInt(req.params.id);
      await activateSubscription(tenantAgentId);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to activate subscription" });
    }
  });

  // Get single agent
  app.get("/api/agents/:id", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const agent = await getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get agent" });
    }
  });

  // Create agent
  app.post("/api/agents", async (req, res) => {
    try {
      const { tenant_id, name, description, system_prompt, agent_type } = req.body;
      const agent = await createAgent({ tenant_id, name, description, system_prompt, agent_type });
      res.json(agent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  // Create agent from template
  app.post("/api/agents/from-template", async (req, res) => {
    try {
      const { tenant_id, template_key, custom_name, custom_description, custom_prompt } = req.body;
      const agent = await createAgentFromTemplate({
        tenant_id,
        template_key,
        custom_name,
        custom_description,
        custom_prompt
      });
      res.json(agent);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to create agent from template" });
    }
  });

  // Update agent
  app.put("/api/agents/:id", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const { name, description, system_prompt, is_active } = req.body;
      const agent = await updateAgent(agentId, { name, description, system_prompt, is_active });
      res.json(agent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  // Delete agent
  app.delete("/api/agents/:id", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      await deleteAgent(agentId);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  // Get documents for agent
  app.get("/api/agents/:agentId/documents", async (req, res) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const documents = await getDocuments(agentId);
      res.json(documents);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get documents" });
    }
  });

  // Add document to agent (text/manual)
  app.post("/api/agents/:agentId/documents", async (req, res) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const { source_type, content, file_url, website_url } = req.body;
      const document = await addDocument({ agent_id: agentId, source_type, content, file_url, website_url });
      res.json(document);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to add document" });
    }
  });

  // Add website scan to agent
  app.post("/api/agents/:agentId/documents/website", async (req, res) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const { url } = req.body;

      // Extract info from website
      const content = await extractInfoFromUrl(url);

      const document = await addDocument({
        agent_id: agentId,
        source_type: 'website',
        content,
        website_url: url
      });
      res.json(document);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to scan website" });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      await deleteDocument(documentId);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Search documents
  app.get("/api/agents/:agentId/documents/search", async (req, res) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const { q } = req.query;
      if (!q) {
        return res.json([]);
      }
      const documents = await searchDocuments(agentId, q as string);
      res.json(documents);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to search documents" });
    }
  });

  // File upload for RAG
  app.post("/api/agents/:agentId/documents/upload", upload.single('file'), async (req, res) => {
    try {
      const agentId = parseInt(req.params.agentId);

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      let content = '';

      // Parse file based on type
      if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
        content = fs.readFileSync(file.path, 'utf-8');
      } else if (file.mimetype === 'application/pdf') {
        try {
          const pdfParse = await import('pdf-parse');
          const dataBuffer = fs.readFileSync(file.path);
          const data = await pdfParse.default(dataBuffer);
          content = data.text;
        } catch (e) {
          console.error("Error parsing PDF:", e);
          content = `[PDF: ${file.originalname}] - Unable to parse content`;
        }
      } else if (file.originalname.endsWith('.docx')) {
        try {
          const docx = await import('docx');
          const fs2 = await import('fs');
          const buffer = fs2.readFileSync(file.path);
          // Simple text extraction for docx - in production use a proper parser
          content = `[DOCX: ${file.originalname}] - File uploaded successfully. Content extraction requires additional processing.`;
        } catch (e) {
          console.error("Error parsing DOCX:", e);
          content = `[DOCX: ${file.originalname}] - Unable to parse content`;
        }
      } else {
        content = `[Arquivo: ${file.originalname}] - Tipo não suportado para parsing`;
      }

      // Save to database
      const document = await addDocument({
        agent_id: agentId,
        source_type: 'file',
        content: content.substring(0, 50000), // Limit content size
        file_url: `/uploads/${file.filename}`
      });

      // Clean up uploaded file after processing
      fs.unlinkSync(file.path);

      res.json(document);
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Serve static files from dist/
  app.use(express.static(path.join(process.cwd(), 'dist')));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // SPA fallback - serve index.html for non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    } else {
      res.status(404).json({ message: `Cannot GET ${req.path}`, error: 'Not Found', statusCode: 404 });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
