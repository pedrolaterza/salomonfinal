import { GoogleGenAI, Type } from "@google/genai";
import { DailyContent, Verse } from "../types";
import { PROVERBS_DATA } from "../data/proverbsData";

// CHAVE DE API CHUMBADA (HARDCODED)
const API_KEY = 'AIzaSyAGrJZzdfLq_b5J2f6EPmSmedmMtQkM500';

// --- ESQUEMA DE RESPOSTA (SCHEMA) ---
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    interpretation: { 
      type: Type.STRING, 
      description: "Uma explicação teológica profunda, detalhada e surpreendente sobre o texto. Pode incluir nuances do hebraico ou contexto histórico." 
    },
    practicalSteps: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Exatamente 3 ações práticas curtas e impactantes. Não coloque perguntas aqui."
    },
    reflectionQuestion: { 
      type: Type.STRING, 
      description: "Uma única pergunta para o leitor refletir sobre sua vida." 
    },
    historicalCuriosity: { 
      type: Type.STRING, 
      description: "Um fato histórico, cultural ou arqueológico sobre a época de Salomão." 
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
    
    // PROMPT OTIMIZADO PARA PROFUNDIDADE
    const prompt = `
      Atue como um teólogo sábio, historiador profundo e mentor espiritual.
      Analise o texto abaixo de Provérbios Capítulo ${day} (Versão NVI):
      
      "${fullTextForAI.substring(0, 15000)}"

      Sua missão é extrair sabedoria que surpreenda o leitor.
      
      Diretrizes para o JSON:
      1. interpretation: NÃO SEJA GENÉRICO. Escreva um parágrafo rico (aprox 4-6 linhas). Se possível, traga o significado de uma palavra-chave no original hebraico ou explique uma metáfora difícil. Faça o leitor pensar: "Uau, eu nunca tinha visto por esse ângulo". Conecte a sabedoria antiga com a alma humana moderna.
      2. practicalSteps: 3 ordens diretas e aplicáveis hoje. Use verbos de ação fortes.
      3. reflectionQuestion: Uma pergunta que penetre a alma e force uma autoanálise sincera.
      4. historicalCuriosity: Traga um fato específico sobre os costumes do Antigo Oriente Próximo, a corte de Salomão ou arqueologia que ilumine o texto. Evite curiosidades óbvias.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7, // Um pouco mais criativo para gerar insights surpreendentes
        topK: 40,
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erro CRÍTICO na IA:", error);

    aiContent = {
      interpretation: `⚠️ A sabedoria está carregando... (Erro Técnico: ${errorMessage})`,
      practicalSteps: ["Verifique sua conexão.", "Tente recarregar a página."],
      reflectionQuestion: "Tente novamente em instantes.",
      historicalCuriosity: "Sem dados."
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