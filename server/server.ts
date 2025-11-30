import express from 'express';
import { GoogleGenAI } from '@google/genai';

const app = express();
// Fix for TypeScript error: Argument of type 'NextHandleFunction' is not assignable to parameter of type 'PathParams'
app.use(express.json() as express.RequestHandler);

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

app.post('/api/analyze', async (req, res) => {
  const { prompt, systemInstruction } = req.body;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3,
      }
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error('GenAI Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));