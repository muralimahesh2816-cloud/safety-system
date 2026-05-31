const buildCsv = (rows = []) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  rows.forEach((row) => {
    const line = headers
      .map((header) => {
        const value = row[header] ?? "";
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(",");
    lines.push(line);
  });

  return lines.join("\n");
};

const filterByPeriod = (records, period) => {
  if (!period || period === "all") return records;
  const now = new Date();
  const rangeMap = {
    daily: 1,
    weekly: 7,
    monthly: 31,
    yearly: 365
  };
  const days = rangeMap[period] || 365;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return records.filter((record) => new Date(record.createdAt) >= start);
};

module.exports = {
  buildCsv,
  filterByPeriod
};
