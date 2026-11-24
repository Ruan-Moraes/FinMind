import { createNormalizedMovement } from "@/features/reconciliation/parsers/movement-metadata-builder";
import { extractLeadingOrInlineDateMatch, isPdfNoiseOrHeaderLine, STATEMENT_MONEY_REGEX, stitchMultiLineStatementRows } from "@/features/reconciliation/parsers/pdf-text-stitcher";
import { isNonEffectiveBalanceLine } from "@/features/reconciliation/parsers/statement-detectors";
import { NormalizedRawMovement, StatementFileFormat, StatementFileInput } from "@/features/reconciliation/parsers/statement-parser-types";
import { parseDeterministicDate, parseDeterministicMonetaryAmount, parseSignedMoneyTokenToCents } from "@/features/reconciliation/parsers/statement-value-normalizers";

export function parseStitchedTextMovements(params: {
  input: StatementFileInput;
  rawLines: string[];
  format: StatementFileFormat;
  bankName: string;
  filePeriodHint: { periodStart: string | null; periodEnd: string | null; fallbackYear: number | undefined };
}): { movements: NormalizedRawMovement[]; ignoredLines: number } {
  const { input, rawLines, format, bankName, filePeriodHint } = params;
  const movements: NormalizedRawMovement[] = [];
  let ignoredNonEffectiveLines = 0;
    const stitchedLines = stitchMultiLineStatementRows(rawLines, filePeriodHint.fallbackYear);
    const defaultFallbackDate = filePeriodHint.periodStart || new Date().toISOString().slice(0, 10);

    const hasAnyDatedLine = stitchedLines.some((line) => {
      const dm = extractLeadingOrInlineDateMatch(line);
      const hasMoney = Array.from(line.matchAll(STATEMENT_MONEY_REGEX)).length > 0;
      return Boolean(dm && parseDeterministicDate(dm[1], filePeriodHint.fallbackYear) && hasMoney);
    });

    for (let i = 0; i < stitchedLines.length; i++) {
      const line = stitchedLines[i];
      if (/^[\s|:-]+$/.test(line)) continue;
      if (isPdfNoiseOrHeaderLine(line)) continue;

      let lineDate = defaultFallbackDate;
      let hadExplicitDate = false;
      let workingLine = line;

      const dateTokenMatch = extractLeadingOrInlineDateMatch(workingLine);
      if (dateTokenMatch) {
        const dCandidate = parseDeterministicDate(dateTokenMatch[1], filePeriodHint.fallbackYear);
        if (dCandidate) {
          lineDate = dCandidate;
          hadExplicitDate = true;
          workingLine = workingLine.replace(dateTokenMatch[0], ' ');
        }
      }

      if (hasAnyDatedLine && !hadExplicitDate) {
        ignoredNonEffectiveLines += 1;
        continue;
      }

      const moneyMatches = Array.from(workingLine.matchAll(STATEMENT_MONEY_REGEX));
      if (moneyMatches.length === 0) continue;

      const chosenMoneyToken =
        moneyMatches.length >= 2
          ? moneyMatches[moneyMatches.length - 2][0]
          : moneyMatches[moneyMatches.length - 1][0];
      const runningBalanceInCents =
        moneyMatches.length >= 2
          ? parseSignedMoneyTokenToCents(moneyMatches[moneyMatches.length - 1][0])
          : null;

      let rawDesc = workingLine;
      for (const m of moneyMatches) {
        rawDesc = rawDesc.replace(m[0], ' ');
      }

      let extractedFitId: string | null = null;
      const opIdMatch = rawDesc.match(/\b(\d{7,18})\b/);
      if (opIdMatch) {
        extractedFitId = opIdMatch[1];
        rawDesc = rawDesc.replace(opIdMatch[0], ' ');
      }

      rawDesc = rawDesc
        .replace(/[|;]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[-,.\s]+|[-,.\s]+$/g, '')
        .trim();

      if (isNonEffectiveBalanceLine(rawDesc)) {
        ignoredNonEffectiveLines += 1;
        continue;
      }

      const parsedAmt = parseDeterministicMonetaryAmount(chosenMoneyToken, rawDesc);
      if (!parsedAmt || parsedAmt.amountInCents <= 0) continue;

      movements.push(
        createNormalizedMovement({
          fileId: input.fileId,
          fileName: input.fileName,
          fileFormat: format,
          bankName,
          lineIndex: i + 1,
          date: lineDate,
          amountInCents: parsedAmt.amountInCents,
          direction: parsedAmt.direction,
          originalDescription: rawDesc || 'Movimentação de Extrato',
          fitId: extractedFitId,
          runningBalanceInCents,
        })
      );
    }
  return { movements, ignoredLines: ignoredNonEffectiveLines };
}