'use client';
export default function Modal({ open, title, children, onClose }:{
  open:boolean; title:string; children:React.ReactNode; onClose:()=>void;
}) {
  if(!open) return null;
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <div className="row">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <div className="spacer" />
          <button className="btn secondary" onClick={onClose}>Schließen</button>
        </div>
        <div style={{ height: 12 }} />
        {children}
      </div>
    </div>
  );
}
