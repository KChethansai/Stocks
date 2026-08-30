/**
 * Exports data to an Excel-compatible CSV file and triggers a browser download.
 * @param {string[]} headers The column header labels.
 * @param {any[][]} rows The grid rows, each as an array of values.
 * @param {string} filename The output file name (e.g. 'holdings.csv').
 */
export const exportToCSV = (headers, rows, filename) => {
  const csvContent = [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map((row) =>
      row
        .map((val) => {
          const stringVal = val === null || val === undefined ? '' : String(val)
          const escaped = stringVal.replace(/"/g, '""')
          return `"${escaped}"`
        })
        .join(',')
    )
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
