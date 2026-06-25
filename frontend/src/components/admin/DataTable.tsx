import type { ReactNode } from 'react'

interface DataTableProps {
  headers: ReactNode[]
  children: ReactNode
}

export function DataTable({ headers, children }: DataTableProps) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
