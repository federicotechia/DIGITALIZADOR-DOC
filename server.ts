import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Configuración de multer para manejar archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ 
  limits: { fileSize: 20 * 1024 * 1024 }, // Límite de 20MB
  storage: storage 
});

// Inicialización con soporte de inicialización ociosa (Lazy Initialization)
let genAIInstance: GoogleGenAI | null = null;
function getGenAI() {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no está configurada en las variables de entorno del servidor.");
    }
    genAIInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAIInstance;
}

app.use(express.json());

// Endpoint para procesar documentos
app.post("/api/digitize", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se subió ningún archivo." });
    }

    const ai = getGenAI();
    const model = "gemini-3.5-flash";
    const prompt = `
      Analiza este documento y extrae toda la información relevante.
      Devuelve los datos en 3 formatos específicos:
      1. TEXTO PLANO: Una transcripción clara y organizada del contenido.
      2. JSON: Un objeto estructurado con campos clave-valor (ej. fecha, emisor, receptor, conceptos, montos, impuestos, total).
      3. CSV: La información en formato tabular (Comma Separated Values).

      Separa cada sección claramente con marcadores:
      ---TEXTO---
      [Contenido aquí]
      ---JSON---
      [Contenido aquí]
      ---CSV---
      [Contenido aquí]

      El idioma de salida debe ser español.
    `;

    const filePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    const response = await ai.models.generateContent({
      model,
      contents: { parts: [filePart, { text: prompt }] },
    });

    const resultText = response.text;
    
    // Procesar el texto para separar las secciones
    const sections = {
      plainText: "",
      json: "",
      csv: ""
    };

    const textMatch = resultText.match(/---TEXTO---([\s\S]*?)(?=---JSON---|---CSV---|$)/);
    const jsonMatch = resultText.match(/---JSON---([\s\S]*?)(?=---CSV---|---TEXTO---|$)/);
    const csvMatch = resultText.match(/---CSV---([\s\S]*?)(?=---JSON---|---TEXTO---|$)/);

    sections.plainText = textMatch ? textMatch[1].trim() : "No se encontró texto plano.";
    sections.json = jsonMatch ? jsonMatch[1].trim() : "{}";
    sections.csv = csvMatch ? csvMatch[1].trim() : "No se encontró CSV.";

    // Limpiar JSON si viene con bloque de código markdown
    if (sections.json.includes("```json")) {
      sections.json = sections.json.replace(/```json|```/g, "").trim();
    }
    if (sections.csv.includes("```csv")) {
      sections.csv = sections.csv.replace(/```csv|```/g, "").trim();
    }

    res.json(sections);
  } catch (error: any) {
    console.error("Error al procesar con Gemini:", error);
    res.status(500).json({ error: "Error interno al procesar el documento: " + error.message });
  }
});

// Configuración de Vite
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
  });
}

setupVite();
