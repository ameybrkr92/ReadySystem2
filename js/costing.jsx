// Costing — a worklist of orders awaiting pricing. Detail lives in the Order Workspace.
const { useState: coUseState } = React;

function Costing({ readOnly = false }) {
  const { useStore, openOrder, computeCosting, Card, Pill, Table, Empty, fmtINR } = window;
  const orders = useStore(s => s.orders);
  const queue = orders.filter(o => ["Costing", "Quote"].includes(o.stage));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Costing</h1>
        <p className="text-sm text-muted-foreground">Orders waiting to be priced or quoted. Open one to use the costing engine — material from the harness, labour from build-time, your margin, the quote.</p>
      </div>

      <Card title={`Costing worklist (${queue.length})`}>
        {queue.length === 0 ? <Empty title="Nothing waiting" hint="Finalise a BOM in Planning to send it here." /> : (
          <Table headers={["W/O No", "Client", "Config", "Qty", "Engine cost", "Margin", "Quote", "Stage", ""]}>
            {queue.map(o => {
              const c = computeCosting(o);
              return (
                <tr key={o.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => openOrder(o.id, "costing")}>
                  <td className="px-4 py-3 font-mono text-xs num">{o.woNo}</td>
                  <td className="px-4 py-3 text-sm">{o.client}</td>
                  <td className="px-4 py-3 font-mono text-xs">{o.config}</td>
                  <td className="px-4 py-3 num">{o.qty}</td>
                  <td className="px-4 py-3 num text-xs">{fmtINR(c.cost)}</td>
                  <td className="px-4 py-3 num text-xs">{c.marginPct}%</td>
                  <td className="px-4 py-3 num text-xs">{o.quote ? fmtINR(o.quote.total) : <span className="text-muted-foreground">{fmtINR(c.total)}*</span>}</td>
                  <td className="px-4 py-3"><Pill tone={o.stage === "Quote" ? "done" : "active"}>{o.stage}</Pill></td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">Price →</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}

Object.assign(window, { Costing });
