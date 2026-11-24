export interface HolidaySeedItem {
  date: string; // YYYY-MM-DD
  year: number;
  name: string;
  scope: 'NATIONAL' | 'STATE' | 'MUNICIPAL';
  stateCode?: string | null;
  cityName?: string | null;
  source: 'BRASIL_API' | 'STATE_CATALOG' | 'AI' | 'MANUAL';
}

export const BRAZIL_STATES: Array<{ code: string; name: string }> = [
  { code: 'AC', name: 'Acre' }, { code: 'AL', name: 'Alagoas' }, { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' }, { code: 'BA', name: 'Bahia' }, { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' }, { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' }, { code: 'MA', name: 'Maranhão' },
  { code: 'MT', name: 'Mato Grosso' }, { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' }, { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' }, { code: 'PR', name: 'Paraná' },
  { code: 'PE', name: 'Pernambuco' }, { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' }, { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' }, { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' }, { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' }, { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' },
];

/**
 * Feriados estaduais oficiais fixos por UF (MM-DD).
 */
const STATE_FIXED_HOLIDAYS: Record<string, Array<{ mmdd: string; name: string }>> = {
  AC: [
    { mmdd: '01-23', name: 'Dia do Evangélico (AC)' },
    { mmdd: '06-15', name: 'Aniversário do Acre' },
    { mmdd: '09-05', name: 'Dia da Amazônia (AC)' },
    { mmdd: '11-17', name: 'Assinatura do Tratado de Petrópolis (AC)' },
  ],
  AL: [
    { mmdd: '06-24', name: 'São João (AL)' },
    { mmdd: '06-29', name: 'São Pedro (AL)' },
    { mmdd: '09-16', name: 'Emancipação Política de Alagoas' },
  ],
  AP: [
    { mmdd: '03-19', name: 'Dia de São José (AP)' },
    { mmdd: '09-13', name: 'Criação do Território Federal do Amapá' },
  ],
  AM: [{ mmdd: '09-05', name: 'Elevação do Amazonas à Categoria de Província' }],
  BA: [{ mmdd: '07-02', name: 'Independência da Bahia' }],
  CE: [
    { mmdd: '03-19', name: 'Dia de São José (CE)' },
    { mmdd: '03-25', name: 'Data Magna do Ceará (Abolição)' },
  ],
  DF: [
    { mmdd: '04-21', name: 'Fundação de Brasília (DF)' },
    { mmdd: '11-30', name: 'Dia do Evangélico (DF)' },
  ],
  ES: [],
  GO: [],
  MA: [{ mmdd: '07-28', name: 'Adesão do Maranhão à Independência' }],
  MT: [],
  MS: [{ mmdd: '10-11', name: 'Criação do Estado de Mato Grosso do Sul' }],
  MG: [{ mmdd: '04-21', name: 'Data Magna de Minas Gerais (Tiradentes)' }],
  PA: [{ mmdd: '08-15', name: 'Adesão do Grão-Pará à Independência' }],
  PB: [{ mmdd: '08-05', name: 'Fundação da Paraíba' }],
  PR: [{ mmdd: '12-19', name: 'Emancipação Política do Paraná' }],
  PE: [{ mmdd: '03-06', name: 'Revolução Pernambucana (Data Magna PE)' }],
  PI: [{ mmdd: '10-19', name: 'Dia do Piauí' }],
  RJ: [{ mmdd: '04-23', name: 'Dia de São Jorge (RJ)' }],
  RN: [{ mmdd: '10-03', name: 'Mártires de Cunhaú e Uruaçu (RN)' }],
  RS: [{ mmdd: '09-20', name: 'Revolução Farroupilha (Dia do Gaúcho)' }],
  RO: [
    { mmdd: '01-04', name: 'Criação do Estado de Rondônia' },
    { mmdd: '06-18', name: 'Dia do Evangélico (RO)' },
  ],
  RR: [{ mmdd: '10-05', name: 'Criação do Estado de Roraima' }],
  SC: [{ mmdd: '08-11', name: 'Criação da Capitania de Santa Catarina' }],
  SP: [{ mmdd: '07-09', name: 'Revolução Constitucionalista de 1932 (SP)' }],
  SE: [{ mmdd: '07-08', name: 'Emancipação Política de Sergipe' }],
  TO: [
    { mmdd: '09-08', name: 'Nossa Senhora da Natividade (TO)' },
    { mmdd: '10-05', name: 'Criação do Estado do Tocantins' },
  ],
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatUtcDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function addDaysUtc(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

/**
 * Algoritmo de Meeus/Jones/Butcher para o Domingo de Páscoa no calendário gregoriano.
 */
export function computeEasterSundayUtc(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function buildFallbackNationalHolidays(year: number): HolidaySeedItem[] {
  const easter = computeEasterSundayUtc(year);
  const carnavalSeg = formatUtcDate(addDaysUtc(easter, -48));
  const carnavalTer = formatUtcDate(addDaysUtc(easter, -47));
  const sextaSanta = formatUtcDate(addDaysUtc(easter, -2));
  const corpusChristi = formatUtcDate(addDaysUtc(easter, 60));

  const list: Array<{ date: string; name: string }> = [
    { date: `${year}-01-01`, name: 'Confraternização Universal' },
    { date: carnavalSeg, name: 'Carnaval (Segunda-feira)' },
    { date: carnavalTer, name: 'Carnaval (Terça-feira)' },
    { date: sextaSanta, name: 'Sexta-feira Santa' },
    { date: `${year}-04-21`, name: 'Tiradentes' },
    { date: `${year}-05-01`, name: 'Dia do Trabalho' },
    { date: corpusChristi, name: 'Corpus Christi' },
    { date: `${year}-09-07`, name: 'Independência do Brasil' },
    { date: `${year}-10-12`, name: 'Nossa Senhora Aparecida' },
    { date: `${year}-11-02`, name: 'Finados' },
    { date: `${year}-11-15`, name: 'Proclamação da República' },
    { date: `${year}-11-20`, name: 'Dia Nacional da Consciência Negra' },
    { date: `${year}-12-25`, name: 'Natal' },
  ];

  return list
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((h) => ({
      date: h.date,
      year,
      name: h.name,
      scope: 'NATIONAL',
      source: 'BRASIL_API',
    }));
}

export function buildStateHolidays(stateCode: string, year: number): HolidaySeedItem[] {
  const uf = stateCode.trim().toUpperCase();
  const entries = STATE_FIXED_HOLIDAYS[uf] || [];
  return entries.map((e) => ({
    date: `${year}-${e.mmdd}`,
    year,
    name: e.name,
    scope: 'STATE',
    stateCode: uf,
    source: 'STATE_CATALOG',
  }));
}
