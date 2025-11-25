import { GoogleGenAI, Type } from "@google/genai";
import { DailyContent, Verse } from "../types";
import { PROVERBS_DATA } from "../data/proverbsData";

// CHAVE DE API CHUMBADA (HARDCODED)
// Isso garante que funcione no Vercel/GitHub Pages sem configuração de variáveis de ambiente.
const API_KEY = 'AIzaSyBupxKTUvWaqkXPPIHI2Jj03elqs5I7D7g';

// --- ESQUEMA DE RESPOSTA (SCHEMA) ---
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    interpretation: { 
      type: Type.STRING, 
      description: "Uma explicação teológica breve e direta sobre o texto." 
    },
    practicalSteps: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Exatamente 3 ações práticas curtas. Não coloque perguntas aqui."
    },
    reflectionQuestion: { 
      type: Type.STRING, 
      description: "Uma única pergunta para o leitor refletir sobre sua vida." 
    },
    historicalCuriosity: { 
      type: Type.STRING, 
      description: "Um fato histórico ou cultural sobre a época de Salomão." 
    }
  },
  required: ["interpretation", "practicalSteps", "reflectionQuestion", "historicalCuriosity"]
};

// --- FUNÇÃO PRINCIPAL ---
export const fetchDailyWisdom = async (day: number): Promise<DailyContent | null> => {
  // 1. Carrega o Texto Bíblico do Banco de Dados Local (100% Fiel e Offline)
  const chapterLines = PROVERBS_DATA[day];

  // Fallback de segurança caso o dia não exista no banco
  if (!chapterLines || chapterLines.length === 0) {
    return {
      day,
      scriptureReference: `Provérbios ${day}`,
      scriptureVerses: [{ verse: 1, text: "Texto indisponível no momento." }],
      interpretation: "Capítulo não encontrado no banco de dados.",
      practicalSteps: [],
      reflectionQuestion: "",
      historicalCuriosity: ""
    };
  }

  // Formata os versículos para o Frontend
  const verses: Verse[] = chapterLines.map((text, index) => ({
    verse: index + 1,
    text: text
  }));

  const fullTextForAI = chapterLines.join(" ");

  // Variável para armazenar o resultado da IA ou o ERRO
  let aiContent;

  try {
    // Tenta inicializar a IA com a chave hardcoded
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    const prompt = `
      Você é um especialista bíblico e historiador.
      Analise o texto abaixo de Provérbios Capítulo ${day}:
      
      "${fullTextForAI.substring(0, 10000)}"

      Tarefa: Gere um objeto JSON com insights sobre este texto específico.
      
      Regras Rígidas:
      1. interpretation: Máximo 2 frases. Foco teológico.
      2. practicalSteps: Crie exatamente 3 frases curtas imperativas (ex: "Faça isso", "Evite aquilo"). NUNCA coloque perguntas aqui.
      3. reflectionQuestion: Uma pergunta pessoal e profunda baseada no texto.
      4. historicalCuriosity: Um fato interessante sobre costumes antigos ou contexto histórico.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.5,
      },
    });

    if (response.text) {
      const parsedData = JSON.parse(response.text);
      
      // Validação básica e Sanitização
      const cleanSteps = Array.isArray(parsedData.practicalSteps)
        ? parsedData.practicalSteps.slice(0, 3).map((s: any) => String(s).replace(/["']/g, ""))
        : ["Erro ao gerar passos práticos."];

      aiContent = {
        interpretation: parsedData.interpretation || "Interpretação indisponível.",
        practicalSteps: cleanSteps,
        reflectionQuestion: parsedData.reflectionQuestion || "Reflexão indisponível.",
        historicalCuriosity: parsedData.historicalCuriosity || "Curiosidade indisponível."
      };
    } else {
      throw new Error("A IA retornou uma resposta vazia.");
    }

  } catch (error: any) {
    // --- EXIBIÇÃO DE ERRO NA TELA ---
    // Em vez de texto genérico, mostramos o erro real para depuração.
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error("Erro CRÍTICO na IA:", error);

    aiContent = {
      interpretation: `⚠️ ERRO DE SISTEMA: ${errorMessage}\n\nPOR QUE ISSO ACONTECEU?\nO sistema tentou conectar à Inteligência Artificial mas falhou. Isso geralmente ocorre se a Chave de API for inválida, se houver bloqueio de rede ou se a cota gratuita excedeu.`,
      practicalSteps: [
        "Verifique sua conexão com a internet.",
        "Se você é o desenvolvedor: Verifique o console (F12) para detalhes.",
        `Código do erro: ${errorMessage.substring(0, 50)}...`
      ],
      reflectionQuestion: "Não foi possível gerar a reflexão devido ao erro acima.",
      historicalCuriosity: "Dados históricos indisponíveis no momento."
    };
  }

  // 4. Retorno Final
  return {
    day: day,
    scriptureReference: `Provérbios ${day}`,
    scriptureVerses: verses,
    interpretation: aiContent.interpretation,
    practicalSteps: aiContent.practicalSteps,
    reflectionQuestion: aiContent.reflectionQuestion,
    historicalCuriosity: aiContent.historicalCuriosity
  };
};