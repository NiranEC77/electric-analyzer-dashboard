interface Column {
  key: string;
  label: string;
}

interface Props {
  columns: Column[];
  rows: Array<Record<string, string | number>>;
  caption: string;
}

/** Accessible alternative to every chart: the same data, as a table. */
export function DataTable({ columns, rows, caption }: Props) {
  return (
    <details className="explain">
      <summary>View as table</summary>
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className="num">
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
