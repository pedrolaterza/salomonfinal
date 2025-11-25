
import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { DailyContent, Verse } from "../types";
import { PROVERBS_DATA } from "../data/proverbsData";

// API KEY HARDCODED PARA GARANTIA EM PRODUÇÃO (VERCEL)
const FALLBACK_KEY = 'AIzaSyBupxKTUvWaqkXPPIHI2Jj03elqs5I7D7g';

const metadataSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    interpretation: { type: Type.STRING, description: "Interpretação única e específica para ESTE capítulo." },
    practicalSteps: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "3 passos práticos."
    },
    reflectionQuestion: { type: Type.STRING, description: "Uma pergunta profunda." },
    historicalCuriosity: { type: Type.STRING, description: "Uma curiosidade histórica." }
  },
  required: ["interpretation", "practicalSteps", "reflectionQuestion", "historicalCuriosity"]
};

// Função para limpar sujeira da IA (Senior Fix)
const sanitizeResponse = (aiData: any): any => {
  const cleanData = { ...aiData };

  // 1. Corrigir Practical Steps
  if (Array.isArray(cleanData.practicalSteps)) {
    // Filtra chaves técnicas que a IA vazou como texto
    cleanData.practicalSteps = cleanData.practicalSteps.filter((step: string) => {
      const s = step.toLowerCase().trim();
      return s !== 'reflectionquestion' && 
             s !== 'historicalcuriosity' && 
             s !== 'interpretation' &&
             s.length > 5; // Remove lixo curto
    });

    // Se a IA colocou a reflexão dentro dos passos práticos (comum no erro relatado)
    // Tenta identificar itens muito longos ou que parecem perguntas no final da lista
    if (cleanData.practicalSteps.length > 3) {
        // Mantém apenas os 3 primeiros como passos reais
        cleanData.practicalSteps = cleanData.practicalSteps.slice(0, 3);
    }
  }

  // 2. Garantia de Strings
  if (!cleanData.interpretation || typeof cleanData.interpretation !== 'string') {
      cleanData.interpretation = "A sabedoria deste capítulo é profunda. Reflita sobre cada versículo.";
  }
  if (!cleanData.reflectionQuestion || typeof cleanData.reflectionQuestion !== 'string') {
      cleanData.reflectionQuestion = "O que este capítulo falou ao seu coração?";
  }
  
  return cleanData;
};

export const fetchDailyWisdom = async (day: number): Promise<DailyContent | null> => {
  const chapterLines = PROVERBS_DATA[day];

  if (!chapterLines || chapterLines.length === 0) {
    return {
      day,
      scriptureReference: `Provérbios ${day}`,
      scriptureVerses: [{ verse: 1, text: "Texto em breve..." }],
      interpretation: "...",
      practicalSteps: [],
      reflectionQuestion: "...",
      historicalCuriosity: ""
    };
  }

  const verses: Verse[] = chapterLines.map((text, index) => ({
    verse: index + 1,
    text: text
  }));
  
  const fullTextForAI = chapterLines.join(" ");

  // Default Fallback
  let interpretation = "A sabedoria de Salomão nos convida a uma vida de disciplina e temor ao Senhor. Este capítulo oferece conselhos práticos para evitar armadilhas comuns.";
  let practicalSteps = [
    "Leia o texto pausadamente.",
    "Identifique um princípio para aplicar hoje.",
    "Ore pedindo sabedoria."
  ];
  let reflectionQuestion = "Qual versículo mais chamou sua atenção e por quê?";
  let historicalCuriosity = "Provérbios era usado no antigo Israel para instruir jovens na corte real.";

  try {
    // Tenta pegar a chave do ambiente, se falhar, usa a Fallback
    // @ts-ignore
    const apiKey = process.env.API_KEY || (window.process && window.process.env && window.process.env.API_KEY) || FALLBACK_KEY;

    if (!apiKey) {
        console.error("SEM API KEY DEFINIDA");
        throw new Error("No API Key");
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });
    const model = "gemini-2.5-flash";

    const prompt = `
      Analise PROVÉRBIOS CAPÍTULO ${day}:
      "${fullTextForAI.substring(0, 8000)}"

      Gere um JSON VÁLIDO.
      1. interpretation: Resumo teológico (2 linhas).
      2. practicalSteps: EXATAMENTE 3 frases curtas de ação. NÃO inclua perguntas aqui.
      3. reflectionQuestion: Uma única pergunta pessoal.
      4. historicalCuriosity: Um fato histórico breve.

      NÃO repita os nomes das chaves (ex: não escreva "reflectionQuestion" no valor).
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: metadataSchema,
        temperature: 0.6, // Reduzido para ser mais "quadrado" e respeitar o JSON
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      },
    });

    const responseText = response.text;
    if (responseText) {
      let aiData = JSON.parse(responseText);
      
      // APLICA A SANITIZAÇÃO SÊNIOR
      aiData = sanitizeResponse(aiData);

      if (aiData) {
        if (aiData.interpretation) interpretation = aiData.interpretation;
        if (aiData.practicalSteps && Array.isArray(aiData.practicalSteps)) practicalSteps = aiData.practicalSteps;
        if (aiData.reflectionQuestion) reflectionQuestion = aiData.reflectionQuestion;
        if (aiData.historicalCuriosity) historicalCuriosity = aiData.historicalCuriosity;
      }
    }
  } catch (aiError) {
    console.error("Gemini Error:", aiError);
    // Fallback silencioso mantendo o texto bíblico intacto
  }
  
  return {
    day: day,
    scriptureReference: `Provérbios ${day}`,
    scriptureVerses: verses,
    interpretation: interpretation,
    practicalSteps: practicalSteps,
    reflectionQuestion: reflectionQuestion,
    historicalCuriosity: historicalCuriosity
  };
};
