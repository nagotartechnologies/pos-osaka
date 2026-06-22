"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts"

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"]

interface ChartsProps {
  ventasPorDia: { dia: string; ventas: number; pedidos: number }[]
  metodosPago: { name: string; value: number }[]
  ingresosAcumulados: { dia: string; acumulado: number }[]
  tiposOrden: { name: string; value: number }[]
  productosMasVendidos: { nombre: string; cantidad: number; ingresos: number }[]
}

export default function DashboardCharts({
  ventasPorDia,
  metodosPago,
  ingresosAcumulados,
  tiposOrden,
  productosMasVendidos,
}: ChartsProps) {
  return (
    <>
      {/* Gráficos Fila 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="lg:col-span-2 rounded-2xl bg-card p-3 sm:p-5 shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-card-foreground mb-3 sm:mb-4">Ventas por Día</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ventasPorDia}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="dia" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px" }}
                formatter={(value: number) => [`$ ${value}`, "Ventas"]}
              />
              <Bar dataKey="ventas" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-card p-3 sm:p-5 shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-card-foreground mb-3 sm:mb-4">Métodos de Pago</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={metodosPago} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                {metodosPago.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px" }}
                formatter={(value: number) => [`$ ${value}`, ""]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {metodosPago.map((item, i) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-xs text-muted-foreground">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gráficos Fila 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="lg:col-span-2 rounded-2xl bg-card p-3 sm:p-5 shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-card-foreground mb-3 sm:mb-4">Ingresos Acumulados</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={ingresosAcumulados}>
              <defs>
                <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="dia" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px" }}
                formatter={(value: number) => [`$ ${value}`, "Acumulado"]}
              />
              <Area type="monotone" dataKey="acumulado" stroke="var(--primary)" strokeWidth={2} fill="url(#colorAcumulado)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-card p-3 sm:p-5 shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-card-foreground mb-3 sm:mb-4">Tipo de Orden</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={tiposOrden} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                {tiposOrden.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {tiposOrden.map((item, i) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-xs text-muted-foreground">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Productos más vendidos */}
      <div className="rounded-2xl bg-card p-3 sm:p-5 shadow-sm border border-border">
        <h3 className="text-sm font-semibold text-card-foreground mb-3 sm:mb-4">Productos Más Vendidos</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={productosMasVendidos} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
            <YAxis dataKey="nombre" type="category" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={120} />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px" }}
              formatter={(value: number) => [value, "Unidades"]}
            />
            <Bar dataKey="cantidad" fill="#10b981" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
