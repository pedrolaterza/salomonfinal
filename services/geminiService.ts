import { GoogleGenAI, Type } from "@google/genai";
import { DailyContent, Verse } from "../types";
import { PROVERBS_DATA } from "../data/proverbsData";

// --- ESQUEMA DE RESPOSTA (SCHEMA) ---
// Isso força a IA a seguir estritamente este formato, impossibilitando erros de estrutura.
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

  // Fallback de segurança caso o dia não exista no banco (raro)
  if (!chapterLines || chapterLines.length === 0) {
    return {
      day,
      scriptureReference: `Provérbios ${day}`,
      scriptureVerses: [{ verse: 1, text: "Texto indisponível no momento." }],
      interpretation: "Leia o capítulo na sua Bíblia.",
      practicalSteps: ["Ler", "Meditar", "Orar"],
      reflectionQuestion: "O que Deus falou com você?",
      historicalCuriosity: "Salomão escreveu 3000 provérbios."
    };
  }

  // Formata os versículos para o Frontend
  const verses: Verse[] = chapterLines.map((text, index) => ({
    verse: index + 1,
    text: text
  }));

  // Prepara o texto para enviar para a IA
  const fullTextForAI = chapterLines.join(" ");

  // 2. Valores Padrão (Caso a IA falhe ou esteja sem internet)
  let aiContent = {
    interpretation: "A sabedoria de Salomão é um convite para vivermos com prudência, justiça e temor ao Senhor. Medite nestas palavras.",
    practicalSteps: [
      "Leia o capítulo novamente com calma.",
      "Identifique um versículo que chamou sua atenção.",
      "Faça uma oração pedindo sabedoria."
    ],
    reflectionQuestion: "Como você pode aplicar a sabedoria deste capítulo nas suas decisões de hoje?",
    historicalCuriosity: "O livro de Provérbios foi compilado principalmente para instruir os jovens na corte real de Israel."
  };

  // 3. Chamada à Inteligência Artificial
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Configuração do Prompt (Comando)
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
        responseSchema: responseSchema, // Força a estrutura
        temperature: 0.5, // Baixa criatividade para evitar alucinações
      },
    });

    if (response.text) {
      const parsedData = JSON.parse(response.text);
      
      // Validação final antes de usar
      if (parsedData.interpretation && 
          Array.isArray(parsedData.practicalSteps) && 
          parsedData.practicalSteps.length > 0 &&
          parsedData.reflectionQuestion) {
          
          // Sanitização Extra: Garante que só pegamos os 3 primeiros passos e limpamos strings
          const cleanSteps = parsedData.practicalSteps
            .slice(0, 3)
            .map((s: any) => String(s).replace(/["']/g, ""));

          aiContent = {
            interpretation: parsedData.interpretation,
            practicalSteps: cleanSteps,
            reflectionQuestion: parsedData.reflectionQuestion,
            historicalCuriosity: parsedData.historicalCuriosity || aiContent.historicalCuriosity
          };
      }
    }

  } catch (error) {
    console.warn("AI Generation failed, using fallback content.", error);
    // Não fazemos nada, mantemos o aiContent padrão definido acima
  }

  // 4. Retorno Final (Texto Fixo + Sabedoria da IA)
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