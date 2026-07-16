/** Consistent page title block — breadcrumbs live in ContextBar above. */
export default function PageHeader({ title, children, meta, actions }) {
  return (
    <header className="page-header page-header-unified">
      <div className="page-header-main">
        <h1>{title}</h1>
        {children && <p className="page-header-desc">{children}</p>}
        {meta && <div className="page-header-meta">{meta}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
