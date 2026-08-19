export default function PageHeader({ title, subtitle, actions, testid }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8" data-testid={testid || "page-header"}>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#0A1128]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm md:text-base text-[#475569] max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
