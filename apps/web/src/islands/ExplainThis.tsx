interface Fact {
  label: string;
  value: number;
}

interface Props {
  facts: Fact[];
}

/** The "explain this" affordance every chart and suggestion carries — the underlying facts, in the open. */
export function ExplainThis({ facts }: Props) {
  if (facts.length === 0) return null;
  return (
    <details className="explain">
      <summary>Explain this</summary>
      <ul className="fact-list">
        {facts.map((f) => (
          <li key={f.label}>
            {f.label}: <span className="num">{f.value.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
