import perf from "../../data/perf-summary.json";
import type { PerfSummary } from "../../data/types";

const data = perf as PerfSummary;

export function PerformanceSummary() {
  const max = Math.max(1, data.max_speedup || 1);

  return (
    <div className="bench-table-wrap">
      <table className="bench-table perf-table">
        <thead>
          <tr>
            <th>operation</th>
            {data.architectures.map((arch) => (
              <th key={arch.id}>
                {arch.name}
                <small>median speedup</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={`${row.test}-${row.distribution}-${row.config}`}>
              <td>
                {row.test}, {row.distribution}, <code>{row.config}</code>
              </td>
              {row.values.map((value, index) => (
                <td key={`${row.test}-${row.distribution}-${index}`}>
                  {value === null ? (
                    "n/a"
                  ) : (
                    <div className="perf-cell">
                      <div className="bench-track">
                        <i
                          className="kd3"
                          style={{
                            width: `${Math.min(100, Math.max(1, (value / max) * 100)).toFixed(1)}%`,
                          }}
                        />
                      </div>
                      <strong>{value.toFixed(2)}x</strong>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
