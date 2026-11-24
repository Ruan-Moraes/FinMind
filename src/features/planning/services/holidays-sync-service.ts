import { prisma } from '@/shared/lib/prisma';
import {
  buildFallbackNationalHolidays,
  buildStateHolidays,
  type HolidaySeedItem,
} from '@/features/planning/domain/brazil-holidays-catalog';
import {
  callProviderApiJson,
  extractJsonFromAiResponse,
  getAiModelDescriptor,
  resolveDynamicModelRoute,
} from '@/features/ai-copilot/providers';

interface BrasilApiHolidayRow {
  date?: string;
  name?: string;
  type?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Consulta a BrasilAPI (gratuita e sem chave) para os feriados nacionais de um ano.
 * Em caso de indisponibilidade de rede, retorna o fallback determinístico local.
 */
export async function fetchNationalHolidaysForYear(year: number): Promise<{
  items: HolidaySeedItem[];
  source: 'BRASIL_API' | 'FALLBACK_LOCAL';
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { items: buildFallbackNationalHolidays(year), source: 'FALLBACK_LOCAL' };
    }

    const rows = (await res.json()) as BrasilApiHolidayRow[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return { items: buildFallbackNationalHolidays(year), source: 'FALLBACK_LOCAL' };
    }

    const items: HolidaySeedItem[] = rows
      .filter((r) => typeof r.date === 'string' && ISO_DATE_RE.test(r.date) && r.name)
      .map((r) => ({
        date: String(r.date).trim(),
        year,
        name: String(r.name).trim(),
        scope: 'NATIONAL',
        source: 'BRASIL_API',
      }));

    if (items.length === 0) {
      return { items: buildFallbackNationalHolidays(year), source: 'FALLBACK_LOCAL' };
    }
    return { items, source: 'BRASIL_API' };
  } catch {
    return { items: buildFallbackNationalHolidays(year), source: 'FALLBACK_LOCAL' };
  }
}

export async function collectOfficialHolidaysForYears(params: {
  years: number[];
  stateCode?: string | null;
}): Promise<{ items: HolidaySeedItem[]; apiUsed: boolean }> {
  const uniqueYears = Array.from(
    new Set(params.years.filter((y) => Number.isInteger(y) && y >= 2020 && y <= 2040))
  );
  const results = await Promise.all(uniqueYears.map((y) => fetchNationalHolidaysForYear(y)));

  const items: HolidaySeedItem[] = [];
  let apiUsed = false;

  results.forEach((res, idx) => {
    if (res.source === 'BRASIL_API') apiUsed = true;
    items.push(...res.items);
    if (params.stateCode?.trim()) {
      items.push(...buildStateHolidays(params.stateCode, uniqueYears[idx]));
    }
  });

  return { items, apiUsed };
}

/**
 * Usa o provedor de IA configurado na conta do usuário (OpenAI, Gemini ou Claude)
 * para sugerir os feriados municipais oficiais de uma cidade/UF em determinado ano.
 */
export async function discoverMunicipalHolidaysWithAi(params: {
  userId: string;
  cityName: string;
  stateCode: string;
  year: number;
}): Promise<{ ok: true; suggestions: HolidaySeedItem[]; modelUsed: string } | { ok: false; error: string }> {
  const city = params.cityName.trim();
  const uf = params.stateCode.trim().toUpperCase();
  if (!city || uf.length !== 2) {
    return { ok: false, error: 'Informe o estado (UF) e o nome da cidade para buscar feriados municipais.' };
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    include: { settings: true },
  });
  const provider = (user?.settings?.aiProvider || 'OPENAI') as 'OPENAI' | 'GEMINI' | 'CLAUDE';
  const modelId =
    provider === 'OPENAI'
      ? user?.settings?.openaiModel || 'gpt-4o-mini'
      : provider === 'GEMINI'
      ? user?.settings?.geminiModel || 'gemini-2.5-flash'
      : user?.settings?.claudeModel || 'claude-3-5-sonnet-latest';
  const descriptor = getAiModelDescriptor(modelId);
  const route = resolveDynamicModelRoute(descriptor.id, {
    openaiApiKey: user?.settings?.openaiApiKey,
    geminiApiKey: user?.settings?.geminiApiKey,
    claudeApiKey: user?.settings?.claudeApiKey,
  });

  if (!route.hasExternalApiKey) {
    return {
      ok: false,
      error: `Conecte sua chave de IA (${descriptor.providerGroupLabel}) na aba Copiloto IA para pesquisar feriados municipais automaticamente, ou cadastre-os manualmente abaixo.`,
    };
  }

  const prompt = [
    `Liste SOMENTE os feriados MUNICIPAIS oficiais da cidade de ${city} (${uf}), Brasil, para o ano de ${params.year}.`,
    'Não inclua feriados nacionais (como Natal, Tiradentes, Finados, 7 de Setembro) nem estaduais já conhecidos.',
    'Inclua apenas datas municipais oficiais como aniversário da cidade e dia do(a) padroeiro(a) municipal.',
    'Responda ESTRITAMENTE em JSON válido no formato:',
    '{"holidays":[{"date":"YYYY-MM-DD","name":"Nome oficial do feriado municipal"}]}',
    'Se não tiver certeza de nenhum feriado municipal oficial, retorne {"holidays":[]}.',
  ].join('\n');

  try {
    const raw = await callProviderApiJson({
      provider,
      apiKey: route.effectiveApiKey,
      model: descriptor.id,
      prompt,
    });
    const parsed = extractJsonFromAiResponse<{
      holidays?: Array<{ date?: string; name?: string }>;
    }>(raw);
    const list = Array.isArray(parsed?.holidays) ? parsed.holidays : [];
    const suggestions: HolidaySeedItem[] = list
      .filter(
        (h) =>
          typeof h.date === 'string' &&
          ISO_DATE_RE.test(h.date.trim()) &&
          h.date.startsWith(`${params.year}-`) &&
          typeof h.name === 'string' &&
          h.name.trim().length > 1
      )
      .map((h) => ({
        date: String(h.date).trim(),
        year: params.year,
        name: String(h.name).trim(),
        scope: 'MUNICIPAL',
        stateCode: uf,
        cityName: city,
        source: 'AI',
      }));

    return { ok: true, suggestions, modelUsed: descriptor.displayName };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Não foi possível consultar a IA para feriados municipais.',
    };
  }
}
