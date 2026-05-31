const SectionHeader = ({ title, subtitle, actions = null }) => (
  <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
    <div>
      <h2 className="font-display text-2xl font-semibold text-white">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-300">{subtitle}</p> : null}
    </div>
    {actions}
  </div>
);

export default SectionHeader;
