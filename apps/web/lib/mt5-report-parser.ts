/**
 * MT5 Report & Text Parser for Step 3 Real Tick Evidence
 * Extracts key metrics from MT5 Strategy Tester report text, HTML, or OCR output.
 */

export interface ParsedMT5Report {
  profit: number | null;
  equity_dd: number | null;
  profit_factor: number | null;
  trades: number | null;
  period_from?: string | null;
  period_to?: string | null;
  expected_payoff?: number | null;
  recovery_factor?: number | null;
  sharpe?: number | null;
  deposit?: number | null;
  gross_profit?: number | null;
  gross_loss?: number | null;
  history_quality?: number | null;
  raw_matches: Record<string, string>;
}

function cleanNumber(str: string): number | null {
  if (!str) return null;
  // Replace non-breaking spaces and regular spaces in numbers e.g. "9 175.59" -> "9175.59"
  const cleaned = str.replace(/[\s\u00a0]/g, "").replace(/,/g, ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function parseMT5ReportText(text: string): ParsedMT5Report {
  const result: ParsedMT5Report = {
    profit: null,
    equity_dd: null,
    profit_factor: null,
    trades: null,
    raw_matches: {}
  };

  if (!text || typeof text !== "string") return result;

  // 1. Total Net Profit
  // Examples:
  // "Total Net Profit        9 175.59"
  // "Total Net Profit: 9,175.59"
  // "Net Profit: 7933.13"
  const profitMatch = text.match(/(?:Total\s+Net\s+Profit|Net\s+Profit)[\s:=]+([-\d\s\u00a0.,]+)/i);
  if (profitMatch && profitMatch[1]) {
    // Only capture before the next label
    const token = profitMatch[1].trim().split(/\n|\r|[A-Za-z]/)[0].trim();
    result.profit = cleanNumber(token);
    result.raw_matches.profit = token;
  }

  // 2. Equity Drawdown Maximal / Relative
  // Examples:
  // "Equity Drawdown Maximal    976.99 (11.16%)"
  // "Equity Drawdown Maximal: 1 110.05 (12.76%)"
  // "Equity Drawdown %: 11.16"
  // "Equity Drawdown Relative   16.26% (496.32)"
  const eqDdPctMatch = text.match(/Equity\s+Drawdown\s+(?:Maximal|Relative)[\s:=]+[^\n\r(]*\(\s*([\d\s.,]+)%\s*\)/i);
  if (eqDdPctMatch && eqDdPctMatch[1]) {
    result.equity_dd = cleanNumber(eqDdPctMatch[1]);
    result.raw_matches.equity_dd = eqDdPctMatch[1] + "%";
  } else {
    // Fallback if format is just "Equity Drawdown %: 11.16%" or "Equity DD %: 11.16"
    const fallbackDd = text.match(/Equity\s+(?:DD|Drawdown)\s*(?:%|Relative|Maximal)?[\s:=]+([\d\s.,]+)%?/i);
    if (fallbackDd && fallbackDd[1]) {
      const token = fallbackDd[1].trim().split(/\n|\r|[A-Za-z]/)[0].trim();
      const num = cleanNumber(token);
      if (num !== null && num <= 100) {
        result.equity_dd = num;
        result.raw_matches.equity_dd = token + "%";
      }
    }
  }

  // 3. Profit Factor
  // Examples:
  // "Profit Factor               3.94"
  // "Profit Factor: 3.52"
  const pfMatch = text.match(/Profit\s+Factor[\s:=]+([\d\s.,]+)/i);
  if (pfMatch && pfMatch[1]) {
    const token = pfMatch[1].trim().split(/\n|\r|[A-Za-z]/)[0].trim();
    result.profit_factor = cleanNumber(token);
    result.raw_matches.profit_factor = token;
  }

  // 4. Total Trades
  // Examples:
  // "Total Trades                 667"
  // "Total Trades: 636"
  // "Trades: 104"
  const tradesMatch = text.match(/(?:Total\s+Trades|Trades)[\s:=]+([\d\s]+)/i);
  if (tradesMatch && tradesMatch[1]) {
    const token = tradesMatch[1].trim().split(/\n|\r|[A-Za-z]/)[0].trim();
    const num = cleanNumber(token);
    if (num !== null) {
      result.trades = Math.round(num);
      result.raw_matches.trades = String(result.trades);
    }
  }

  // 5. Period Date Range
  // Examples: "Period: 2021.01.01 - 2024.10.01", "2021/01/01 to 2024/10/01"
  const periodMatch = text.match(/(?:Period[\s:=]*)?(\d{4})[./-](\d{2})[./-](\d{2})\s*(?:-|to)\s*(\d{4})[./-](\d{2})[./-](\d{2})/i);
  if (periodMatch) {
    result.period_from = `${periodMatch[1]}-${periodMatch[2]}-${periodMatch[3]}`;
    result.period_to = `${periodMatch[4]}-${periodMatch[5]}-${periodMatch[6]}`;
    result.raw_matches.period = `${result.period_from} to ${result.period_to}`;
  }

  // Extra Metrics
  // Expected Payoff
  const payoffMatch = text.match(/Expected\s+Payoff[\s:=]+([\d\s.,]+)/i);
  if (payoffMatch && payoffMatch[1]) {
    result.expected_payoff = cleanNumber(payoffMatch[1].trim().split(/\n|\r|[A-Za-z]/)[0].trim());
  }

  // Recovery Factor
  const recMatch = text.match(/Recovery\s+Factor[\s:=]+([\d\s.,]+)/i);
  if (recMatch && recMatch[1]) {
    result.recovery_factor = cleanNumber(recMatch[1].trim().split(/\n|\r|[A-Za-z]/)[0].trim());
  }

  // Sharpe Ratio
  const sharpeMatch = text.match(/Sharpe\s+Ratio[\s:=]+([\d\s.,]+)/i);
  if (sharpeMatch && sharpeMatch[1]) {
    result.sharpe = cleanNumber(sharpeMatch[1].trim().split(/\n|\r|[A-Za-z]/)[0].trim());
  }

  // Initial Deposit
  const depMatch = text.match(/Initial\s+Deposit[\s:=]+([\d\s.,]+)/i);
  if (depMatch && depMatch[1]) {
    result.deposit = cleanNumber(depMatch[1].trim().split(/\n|\r|[A-Za-z]/)[0].trim());
  }

  // History Quality
  const hqMatch = text.match(/History\s+Quality[\s:=]+([\d.,]+)%/i);
  if (hqMatch && hqMatch[1]) {
    result.history_quality = cleanNumber(hqMatch[1]);
  }

  return result;
}
