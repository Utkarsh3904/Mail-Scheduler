interface Column {
  key: string;
  label: string;
}

interface Row {
  [key: string]: string | number | undefined | null;
}

function StatusBadge({ status, error }: { status: string; error?: string }) {
  const colors: Record<string, string> = {
    sent: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    scheduled: "bg-yellow-100 text-yellow-700",
    sending: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span
        title={error || undefined}
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-700"}`}
      >
        {status}
      </span>
      {error && (
        <span className="text-[11px] text-red-500 max-w-[200px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}

export default function EmailTable({
  columns,
  rows,
  loading,
  emptyMessage,
}: {
  columns: Column[];
  rows: Row[];
  loading: boolean;
  emptyMessage: string;
}) {
  if (loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>;
  }

  if (rows.length === 0) {
    return <div className="p-8 text-center text-gray-400 text-sm">{emptyMessage}</div>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-200">
          {columns.map((col) => (
            <th key={col.key} className="py-2 px-3 font-medium">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-gray-100">
            {columns.map((col) => (
              <td key={col.key} className="py-2 px-3">
                {col.key === "status" ? (
                  <StatusBadge
                    status={String(row[col.key])}
                    error={row.error_message ? String(row.error_message) : undefined}
                  />
                ) : (
                  String(row[col.key] ?? "")
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
