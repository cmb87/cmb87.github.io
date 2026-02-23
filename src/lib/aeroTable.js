export const AERO_COEFFICIENT_KEYS = ["cx", "cy", "cz", "cl", "cm", "cn"];

function isHeaderRow(columns) {
  if (columns.length !== 8) {
    return false;
  }
  return columns[0].toLowerCase() === "alpha" && columns[1].toLowerCase() === "beta";
}

function asFinite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseAeroTableText(text) {
  const source = String(text ?? "");
  const rawLines = source.split(/\r?\n/);
  const rows = [];

  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
    const rawLine = rawLines[lineIndex];
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }

    const columns = trimmed.split(",").map((item) => item.trim());
    if (rows.length === 0 && isHeaderRow(columns)) {
      continue;
    }

    if (columns.length !== 8) {
      throw new Error(`Line ${lineIndex + 1}: expected 8 comma-separated values`);
    }

    const alpha = asFinite(columns[0]);
    const beta = asFinite(columns[1]);
    const coefficients = columns.slice(2).map(asFinite);
    if (!Number.isFinite(alpha) || !Number.isFinite(beta) || coefficients.some((value) => !Number.isFinite(value))) {
      throw new Error(`Line ${lineIndex + 1}: contains non-numeric values`);
    }

    rows.push({
      alpha,
      beta,
      coefficients,
    });
  }

  if (!rows.length) {
    throw new Error("No aerodynamic rows found. Expected alpha,beta,cx,cy,cz,cl,cm,cn");
  }

  rows.sort((a, b) => (a.alpha === b.alpha ? a.beta - b.beta : a.alpha - b.alpha));
  const alphaValues = Array.from(new Set(rows.map((row) => row.alpha))).sort((a, b) => a - b);
  const betaValues = Array.from(new Set(rows.map((row) => row.beta))).sort((a, b) => a - b);

  return {
    rows,
    alphaValues,
    betaValues,
  };
}
