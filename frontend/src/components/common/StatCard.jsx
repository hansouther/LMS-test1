export default function StatCard({ icon: Icon, label, value, hint, accent = "#4361EE", testid }) {
  return (
    <div
      className="bg-white rounded-xl border border-[#E2E8F0] p-6 transition-transform duration-200 hover:-translate-y-1"
      data-testid={testid}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#475569] font-medium">{label}</p>
          <p className="mt-2 text-3xl font-bold text-[#0A1128] font-head">{value}</p>
          {hint && <p className="mt-1 text-xs text-[#94A3B8]">{hint}</p>}
        </div>
        {Icon && (
          <div
            className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accent}1A`, color: accent }}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
