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

let dbStatus = "unknown";
let dbInitError: any = null;

async function startServer() {
  const app = express();
  const PORT = 3000;

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
    const { name, theme_color, ai_context } = req.body;
    try {
      await db.query(
        "UPDATE tenants SET name = $1, theme_color = $2, ai_context = $3 WHERE id = $4",
        [name, theme_color, ai_context, req.params.id]
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
      if (agent_id || auto_route) {
        // Use multi-agent chat
        const result = await handleMultiAgentChat(message, tenant_id, history || [], {
          agent_id,
          auto_route
        });
        res.json({ text: result.response, ...result });
      } else {
        // Legacy single-agent mode
        const response = await handleChat(message, tenant_id, history || []);
        res.json({ text: response });
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

  // Get all agents for a tenant
  app.get("/api/tenants/:tenantId/agents", async (req, res) => {
    try {
      const tenantId = parseInt(req.params.tenantId);
      const agents = await getAgents(tenantId);
      res.json(agents);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get agents" });
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
