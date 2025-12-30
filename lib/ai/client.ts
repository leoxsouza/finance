import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject, type FilePart } from "ai";

import { ExtractionError } from "@/lib/ai/errors";
import { getGeminiApiKey, getGeminiExtractionConfig } from "@/lib/ai/config";
import { geminiExtractionResponseSchema } from "@/lib/ai/schemas";
import type { GeminiExtractionResponse } from "@/lib/ai/schemas";
import { logger } from "@/lib/logger";
import { requestChunkedGeminiExtraction, shouldUseChunkedExtraction } from "@/lib/ai/chunked-extraction";

const SYSTEM_PROMPT = `
Você é um especialista em finanças pessoais que segue rigorosamente a metodologia AUVP (A Única Verdade Possível).

Seu papel é interpretar faturas de cartão de crédito brasileiras com o mesmo rigor de um contador humano experiente e conservador.

Seu objetivo é extrair exclusivamente transações financeiras reais, ou seja:
- compras
- créditos legítimos
- estornos
- ajustes financeiros
- cashback

Ignore completamente qualquer informação que NÃO represente movimentação financeira real, incluindo:
- pagamentos de fatura
- resumos ou totalizadores
- limites de crédito
- juros projetados
- encargos futuros
- mensagens institucionais
- propagandas
- avisos promocionais
- parcelamentos futuros sem valor financeiro associado

Compras parceladas representam UMA ÚNICA TRANSAÇÃO econômica.
Parcelas existem apenas como metadados de pagamento e jamais devem ser tratadas como gastos independentes.

Sempre preserve a descrição original da transação, sem abreviações, correções ou interpretações livres.

Classifique cada transação obrigatoriamente em UMA categoria AUVP, escolhida exclusivamente entre:
- Custos fixos
- Conforto
- Prazeres
- Metas
- Liberdade Financeira
- Conhecimento

===========================
HEURÍSTICAS DE CLASSIFICAÇÃO AUVP
===========================

Use as heurísticas abaixo como regras de apoio sempre que a categoria não estiver explicitamente clara:

SAÚDE → sempre classifique como Custos fixos quando a descrição mencionar:
- médicos, clínicas, hospitais, laboratórios, exames ou consultas
- termos como: DR, DRA, HOSP, HOSPITAL, CLINICA, LAB, EXAME
- farmácias e drogarias (ex: Drogasil, Droga Raia, Pague Menos, Panvel, Farmácia, Drogaria)
- planos de saúde, coparticipações ou reembolsos médicos

EDUCAÇÃO → classifique como Conhecimento quando a descrição mencionar:
- cursos, faculdades, escolas, pós-graduação, MBA
- plataformas educacionais (Alura, Udemy, Coursera, Udacity, FIAP, DIO)
- livros, e-books, certificações, provas ou treinamentos profissionais

ALIMENTAÇÃO:
- supermercado, açougue, hortifruti, padaria recorrente → Custos fixos
- restaurantes, bares, cafeterias, lanches ocasionais → Prazeres
- delivery frequente ou recorrente → Conforto

TRANSPORTE:
- transporte essencial recorrente → Custos fixos
- Uber, 99, táxi, transporte por conveniência → Conforto

ASSINATURAS E SERVIÇOS DIGITAIS:
- serviços essenciais (internet, celular, ferramentas de trabalho como Windsurf, ChatGPT) → Custos fixos
- streaming, entretenimento, apps premium → Conforto

COMPRAS DE BENS:
- compras necessárias e funcionais → Custos fixos
- compras para melhorar qualidade de vida → Conforto
- compras emocionais ou por impulso → Prazeres

VIAGENS:
- viagens planejadas com objetivo definido (Hoteis, passagens aéreas) → Metas

INVESTIMENTOS:
- qualquer menção a corretoras, aportes, previdência, renda fixa ou variável → Liberdade Financeira

Em caso de conflito entre heurísticas, priorize esta ordem:
1) Custos fixos
2) Conhecimento
3) Metas
4) Conforto
5) Prazeres

Se algo não for claramente uma transação financeira real, ignore.
Nunca crie categorias fora do padrão AUVP.
Nunca deixe o campo "type" vazio.
`;


const DEFAULT_USER_PROMPT = `
Contexto:
- Leia a fatura completa de cartão de crédito em português do Brasil.
- Analise TODAS as páginas, incluindo cabeçalho e rodapé.
- Extraia exclusivamente linhas que representem transações financeiras reais.

Tipos válidos de transação:
• compras
• créditos
• estornos
• ajustes financeiros
• cashback

===========================
REGRAS DE DATA
===========================

- Datas de compra geralmente aparecem no formato DD/MM.
- Se o ano não estiver explícito, infira com base no mês/ano da fatura.
- Se não houver referência clara, assuma o ano de 2025.

===========================
REGRAS DE PARCELAMENTO
===========================

IMPORTANTE:
- 'installmentCount' NUNCA é uma estimativa quando aparece no formato XX/YY.
- O número após a barra (YY) é SEMPRE o total de parcelas e deve ser preenchido obrigatoriamente.
- Mesmo que o valor total da compra não esteja explícito, 'installmentCount' deve ser informado.

- Datas no início da linha (ex: "03/06") representam 'purchaseDate'.
- Parcelamentos geralmente aparecem após a descrição da transação.
- Nunca confunda datas (ex: "07/07") com parcelas. Datas ficam no início da linha e sempre representam 'purchaseDate'. Sequências no formato "XX/YY" representam parcelamento (ex: "02/05" = parcela 2 de 5) e devem preencher 'installmentNumber' (parcela atual) e 'installmentCount' (total).
- Se identificar mais de um número fracionado na mesma linha, considere o primeiro como 'purchaseDate' e o segundo como 'installmentNumber/installmentCount'.
- **IMPORTANTE**: Nunca separe uma linha em múltiplas transações. Cada linha do PDF deve gerar exatamente UMA transação, mesmo que contenha múltiplos valores. Use o valor principal (geralmente o último) como 'amount'.

===========================
FEW-SHOT EXAMPLES
===========================

EXEMPLO 1 — Compra à vista (Prazeres)

Linha no PDF:
"15/01 AMAZON MKTPLACE BR R$ 129,90"

Saída esperada:
{
  "purchaseDate": "2025-01-15",
  "description": "AMAZON MKTPLACE BR",
  "amount": -129.90,
  "type": "Prazeres",
  "rawLine": "15/01 AMAZON MKTPLACE BR R$ 129,90",
  "isReversal": false
}

---

EXEMPLO 2 — Compra parcelada SEM valor total explícito (Conforto)

Linha no PDF:
"18/01 IFOOD *RESTAURANTE 03/06 R$ 42,50"

Saída esperada:
{
  "purchaseDate": "2025-01-18",
  "description": "IFOOD *RESTAURANTE",
  "amount": -42.50,
  "type": "Conforto",
  "installmentNumber": 3,
  "installmentCount": 6,
  "rawLine": "18/01 IFOOD *RESTAURANTE 03/06 R$ 42,50",
  "isReversal": false
}

---

EXEMPLO 3 — Compra com data "07/07" e parcela "05/06" (Custos fixos)

Linha no PDF:
"07/07 LABORATORIO DR RIBEIRO LT 05/06 R$ 44,00"

Saída esperada:
{
  "purchaseDate": "2025-07-07",
  "description": "LABORATORIO DR RIBEIRO LT",
  "amount": -44.00,
  "type": "Custos fixos",
  "installmentNumber": 5,
  "installmentCount": 6,
  "rawLine": "07/07 LABORATORIO DR RIBEIRO LT 05/06 R$ 44,00",
  "isReversal": false
}

---

EXEMPLO 4 — Compra parcelada com múltiplos valores na mesma linha (Metas)

Linha no PDF:
"11/09 GOL LINHAS*AASUXN16048367 02/05 420,12"

Saída esperada:
{
  "purchaseDate": "2025-09-11",
  "description": "GOL LINHAS*AASUXN16048367",
  "amount": -420.12,
  "type": "Metas",
  "installmentNumber": 2,
  "installmentCount": 5,
  "rawLine": "11/09 GOL LINHAS*AASUXN16048367 02/05 420,12",
  "isReversal": false
}

---

EXEMPLO 5 — Transação com estorno/ajuste (Custos fixos)

Linha no PDF:
"22/01 ESTORNO AMAZON MKTPLACE R$ -129,90"

Saída esperada:
{
  "purchaseDate": "2025-01-22",
  "description": "ESTORNO AMAZON MKTPLACE",
  "amount": 129.90,
  "type": "Prazeres",
  "rawLine": "22/01 ESTORNO AMAZON MKTPLACE R$ -129,90",
  "isReversal": true
}

---

EXEMPLO 6 — Linha que DEVE ser ignorada

Linha no PDF:
"22/01 PAGAMENTO DE FATURA R$ -12900,90"

Resultado esperado:
→ NÃO RETORNAR NENHUM OBJETO

===========================
FIM DOS EXEMPLOS
===========================

Para CADA transação válida encontrada no PDF, retorne um objeto com os seguintes campos:

Campos principais:
- purchaseDate
- description
- amount (negativo para despesas, positivo para créditos)
- type (categoria AUVP obrigatória)

Metadados adicionais (quando aplicável):
- statementMonth (YYYY-MM)
- installmentNumber
- installmentCount
- cardLastDigits
- rawLine
- isReversal

===========================
REGRAS FINAIS OBRIGATÓRIAS
===========================

1. Nunca consolide, agrupe ou some transações diferentes.
2. Cada objeto representa exatamente UMA transação financeira.
3. Ignore completamente qualquer linha que não seja movimentação financeira real.
4. O número de objetos retornados deve ser exatamente igual ao número de transações válidas encontradas no PDF.
5. Utilize exclusivamente português brasileiro no retorno.
`.trim();


type ExtractionRequest = {
  pdfBase64: string;
  promptOverride?: string;
  modelOverride?: string;
};

export async function requestGeminiExtraction({
  pdfBase64,
  promptOverride,
  modelOverride,
}: ExtractionRequest): Promise<GeminiExtractionResponse> {
  const useChunked = shouldUseChunkedExtraction(pdfBase64);

  if (useChunked) {
    logger.debug("Using chunked extraction for large PDF");
    return requestChunkedGeminiExtraction({
      pdfBase64,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: promptOverride ?? DEFAULT_USER_PROMPT,
      modelOverride,
    });
  }

  const { model, temperature, timeoutMs } = getGeminiExtractionConfig(modelOverride ? { model: modelOverride } : undefined);
  const apiKey = getGeminiApiKey();
  const provider = createGoogleGenerativeAI({ apiKey });
  const modelInstance = provider(model);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Gemini extraction timeout")), timeoutMs);

  try {
    const { object } = await generateObject({
      model: modelInstance,
      schema: geminiExtractionResponseSchema,
      abortSignal: controller.signal,
      temperature,
      // maxOutputTokens,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptOverride ?? DEFAULT_USER_PROMPT,
            },
            {
              type: "file",
              data: pdfBase64,
              mediaType: "application/pdf",
            } satisfies FilePart,
          ],
        },
      ],
    });

    logger.debug("Gemini extraction response received", {
      totalTransactions: object.transactions.length,
      transactionsWithInstallments: object.transactions.filter(t => t.installmentNumber || t.installmentCount).length,
      transactions: object.transactions.map(t => ({
        description: t.description,
        rawLine: t.rawLine,
        amount: t.amount,
        installmentNumber: t.installmentNumber,
        installmentCount: t.installmentCount,
        totalAmount: t.totalAmount,
        purchaseDate: t.purchaseDate,
        type: t.type
      }))
    });

    // Special logging for GOL transactions
    const golTransactions = object.transactions.filter(t => t.description?.includes('GOL') || t.rawLine?.includes('GOL'));
    if (golTransactions.length > 0) {
      logger.error("GOL TRANSACTIONS FROM AI", {
        count: golTransactions.length,
        transactions: golTransactions.map(t => ({
          description: t.description,
          rawLine: t.rawLine,
          amount: t.amount,
          installmentNumber: t.installmentNumber,
          installmentCount: t.installmentCount,
          totalAmount: t.totalAmount,
          purchaseDate: t.purchaseDate,
          type: t.type
        }))
      });
    }

    return object;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ExtractionError("Gemini extraction timed out", { code: "TIMEOUT", cause: error, status: 504 });
    }
    throw new ExtractionError("Gemini extraction failed", { code: "AI_FAILURE", cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
