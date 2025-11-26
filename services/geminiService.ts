
import { DailyContent, Verse } from "../types";
import { PROVERBS_DATA } from "../data/proverbsData";
import { WISDOM_DATA } from "../data/wisdomData";

// --- FUNÇÃO PRINCIPAL (AGORA ESTÁTICA E OFFLINE) ---
export const fetchDailyWisdom = async (day: number): Promise<DailyContent | null> => {
  
  // 1. Simula tempo de carregamento para manter a experiência do usuário (mágica)
  await new Promise(resolve => setTimeout(resolve, 7000));

  // 2. Carrega o Texto Bíblico do Banco de Dados Local
  const chapterLines = PROVERBS_DATA[day];

  // Fallback de segurança
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

  // 3. Formata os versículos
  const verses: Verse[] = chapterLines.map((text, index) => ({
    verse: index + 1,
    text: text
  }));

  // 4. Carrega o Conteúdo de Sabedoria do Banco de Dados Estático
  const wisdom = WISDOM_DATA[day] || {
    interpretation: "Interpretação em breve.",
    practicalSteps: ["Leia o capítulo.", "Reflita.", "Ore."],
    historicalCuriosity: "Curiosidade em breve.",
    reflectionQuestion: "O que Deus falou com você hoje?"
  };

  // 5. Retorno Final
  return {
    day: day,
    scriptureReference: `Provérbios ${day}`,
    scriptureVerses: verses,
    interpretation: wisdom.interpretation,
    practicalSteps: wisdom.practicalSteps,
    reflectionQuestion: wisdom.reflectionQuestion,
    historicalCuriosity: wisdom.historicalCuriosity
  };
};
