import { describe, it, expect } from 'vitest';
import {
  runIntelligentReconciliationPipeline,
  sanitizeTextForExternalAi,
} from '@/features/reconciliation/engine';
import { TEST_CATEGORIES, TEST_RECURRENCE_RULES } from '../helpers/statement-fixtures';

describe('Camada 4 — Motor de Conciliação Inteligente (Cenários 1 a 18 e 22)', () => {
  const csvExample52 = [
    'Data;Descrição;Valor',
    '10/11/2026;PIX ENVIADO IMOBILIARIA ABC;-R$ 1.200,00',
    '12/11/2026;PAGAMENTO CLARO NET;-R$ 120,00',
    '12/11/2026;DEBITO SMART FIT;-R$ 120,00',
    '05/11/2026;TED RECEBIDA EMPRESA XYZ;+R$ 3.500,00',
    '14/11/2026;COMPRA SUPERMERCADO;-R$ 250,00',
  ].join('\n');

  it('Cenários 1, 5, 6, 9, 10: diferencia obrigações de mesmo valor (Internet R$ 120 vs Academia R$ 120)', async () => {
    const plan52 = await runIntelligentReconciliationPipeline({
      files: [{ fileId: 'f1', fileName: 'extrato-nubank-novembro.csv', content: csvExample52 }],
      categories: TEST_CATEGORIES,
      recurrenceRules: TEST_RECURRENCE_RULES,
      existingTransactions: [],
    });

    expect(plan52.items).toHaveLength(5);
    const itemAluguel = plan52.items.find((i) => i.originalDescription.includes('IMOBILIARIA ABC'))!;
    const itemClaro = plan52.items.find((i) => i.originalDescription.includes('CLARO NET'))!;
    const itemSmartFit = plan52.items.find((i) => i.originalDescription.includes('SMART FIT'))!;
    const itemSalario = plan52.items.find((i) => i.originalDescription.includes('EMPRESA XYZ'))!;
    const itemMercado = plan52.items.find((i) => i.originalDescription.includes('SUPERMERCADO'))!;

    expect(itemAluguel.matchedRuleId).toBe('rule-aluguel');
    expect(itemClaro.matchedRuleId).toBe('rule-internet');
    expect(itemClaro.reasonSummary).toContain('Academia');
    expect(itemSmartFit.matchedRuleId).toBe('rule-academia');
    expect(itemSmartFit.reasonSummary).toContain('Internet');
    expect(itemSalario.matchedRuleId).toBe('rule-salario');
    expect(itemMercado.decisionType).toBe('CREATE_NEW');
    expect(itemMercado.categoryId).toBe('cat-mercado');
  });

  it('Cenários 2, 3, 4, 15: deduplica movimentações em múltiplos extratos sobrepostos (Nubank + Itaú OFX + Bradesco PDF)', async () => {
    const ofxItau = `OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>0341<ACCTID>12345</BANKACCTFROM><BANKTRANLIST><DTSTART>20261101<DTEND>20261120<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261112<TRNAMT>-120.00<FITID>ITAU-001<MEMO>PAGAMENTO CLARO NET</STMTTRN><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261118<TRNAMT>-89.90<FITID>ITAU-002<MEMO>COMPRA UBER TRIP</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const pdfBradescoText = `Extrato Mensal Bradesco S.A.\nSALDO ANTERIOR R$ 5.000,00\n18/11/2026 COMPRA UBER TRIP -R$ 89,90\n22/11/2026 ASSINATURA NETFLIX.COM -R$ 55,90\nSALDO FINAL R$ 4.854,20`;

    const multiPlan = await runIntelligentReconciliationPipeline({
      files: [
        { fileId: 'f-csv', fileName: 'nubank-nov-parte1.csv', content: csvExample52 },
        { fileId: 'f-ofx', fileName: 'itau-nov-sobreposto.ofx', content: ofxItau },
        { fileId: 'f-pdf', fileName: 'bradesco-nov.pdf', content: pdfBradescoText },
      ],
      categories: TEST_CATEGORIES,
      recurrenceRules: TEST_RECURRENCE_RULES,
      existingTransactions: [],
    });

    expect(multiPlan.summary.processedFiles).toBe(3);
    expect(multiPlan.files[2].ignoredNonEffectiveLines).toBe(2);
    const duplicateItems = multiPlan.items.filter((i) => i.decisionType === 'SKIP_DUPLICATE');
    expect(duplicateItems).toHaveLength(2);
  });

  it('Cenários 7, 8, 18: compreende abreviações e bloqueia associação cega por valor em PIX genérico', async () => {
    const abbrevAndAmbiguousCsv = [
      'Data;Descrição;Valor',
      '12/11/2026;PAGTO ELETR CLARO SA;-120,00',
      '15/11/2026;PIX ENVIADO;-120,00',
      '16/11/2026;PIX ENVIADO JOAO SILVA;-300,00',
      '16/11/2026;PIX ENVIADO MARIA OLIVEIRA;-300,00',
    ].join('\n');

    const abbrevPlan = await runIntelligentReconciliationPipeline({
      files: [{ fileId: 'f-abb', fileName: 'extrato-abreviado.csv', content: abbrevAndAmbiguousCsv }],
      categories: TEST_CATEGORIES,
      recurrenceRules: TEST_RECURRENCE_RULES,
      existingTransactions: [],
    });

    expect(abbrevPlan.items[0].matchedRuleId).toBe('rule-internet');
    expect(abbrevPlan.items[1].decisionType).toBe('NEEDS_MANUAL_REVIEW');
    expect(abbrevPlan.items[1].matchedRuleId).toBeNull();
    expect(abbrevPlan.items[2].externalHash).not.toBe(abbrevPlan.items[3].externalHash);
  });

  it('Cenários 11, 12, 13, 14: agrupa pagamentos parciais, aceita variação justificável, isola transferência própria e fatura de cartão', async () => {
    const specialCasesCsv = [
      'Data;Descrição;Valor',
      '10/11/2026;PIX ENVIADO IMOBILIARIA ABC;-600,00',
      '11/11/2026;PIX ENVIADO IMOBILIARIA ABC;-600,00',
      '13/11/2026;PAGAMENTO CLARO NET;-126,50',
      '15/11/2026;TRANSF ENTRE CONTAS MESMA TITULARIDADE;-1000,00',
      '16/11/2026;PAGAMENTO DE FATURA NUBANK;-850,00',
    ].join('\n');

    const specialPlan = await runIntelligentReconciliationPipeline({
      files: [{ fileId: 'f-spec', fileName: 'casos-especiais.csv', content: specialCasesCsv }],
      categories: TEST_CATEGORIES,
      recurrenceRules: TEST_RECURRENCE_RULES,
      existingTransactions: [],
      existingInvoices: [
        {
          id: 'inv-nubank-11',
          creditCardId: 'card-nu',
          creditCardName: 'Nubank',
          month: 11,
          year: 2026,
          status: 'CLOSED',
          totalAmountInCents: 85000,
          dueDay: 16,
        },
      ],
    });

    expect(specialPlan.items[0].matchPrecision).toBe('MULTI_MOVEMENT_GROUP');
    expect(specialPlan.items[2].matchPrecision).toBe('VALUE_VARIATION');
    expect(specialPlan.items[3].decisionType).toBe('RECORD_SELF_TRANSFER');
    expect(specialPlan.items[4].decisionType).toBe('PAY_CREDIT_CARD_INVOICE');
    expect(specialPlan.summary.identifiedExpensesCents).toBe(60000 + 60000 + 12650);
  });

  it('Cenários 16, 17 e 22: isola falhas parciais, mascara dados LGPD e não força categories[0] em item desconhecido', async () => {
    const sanitized = sanitizeTextForExternalAi('PIX CPF 123.456.789-00 CNPJ 12.345.678/0001-99 IMOBILIARIA ABC');
    expect(sanitized).not.toContain('123.456.789-00');
    expect(sanitized).toContain('IMOBILIARIA ABC');

    const unknownPlan = await runIntelligentReconciliationPipeline({
      files: [
        { fileId: 'f-empty', fileName: 'vazio.csv', content: '   ' },
        { fileId: 'f-unk', fileName: 'desconhecido.csv', content: '18/11/2026;COMPRA ESTABELECIMENTO XPTO 99812;-77,50' },
      ],
      categories: TEST_CATEGORIES,
      recurrenceRules: [],
      existingTransactions: [],
    });

    expect(unknownPlan.summary.errorFiles).toBe(1);
    expect(unknownPlan.summary.processedFiles).toBe(1);
    expect(unknownPlan.items[0].categoryId).toBe('');
    expect(unknownPlan.items[0].categoryName).toBe('Sem Categoria');
  });
});
