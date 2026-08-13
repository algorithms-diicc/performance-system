import InlineState from "../components/InlineState";
import { requestJson } from "../common/requestErrorModel";
import React,{useEffect,useState} from "react";
import "./AdminOps.css";

const PAGE_SIZE=25;
const fmt=new Intl.DateTimeFormat("es-CL",{dateStyle:"medium",timeStyle:"short"});
const date=v=>v?fmt.format(new Date(v)):"—";
const countLabel=(count,singular,plural)=>`${count} ${count===1?singular:plural}`;

async function api(url){
  return requestJson(url,{credentials:"include"},{fallback:"No fue posible cargar la auditoría."});
}

export default function AdminAuditLog(){
  const[action,setAction]=useState("");
  const[from,setFrom]=useState("");
  const[to,setTo]=useState("");
  const[page,setPage]=useState(1);
  const[items,setItems]=useState([]);
  const[total,setTotal]=useState(0);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(null);
  const[reload,setReload]=useState(0);

  useEffect(()=>setPage(1),[action,from,to]);

  useEffect(()=>{
    const c=new AbortController();
    (async()=>{
      try{
        setLoading(true);setError(null);
        const p=new URLSearchParams({page:String(page),page_size:String(PAGE_SIZE)});
        if(action.trim())p.set("action",action.trim());
        if(from)p.set("from",from);
        if(to)p.set("to",`${to}T23:59:59.999999`);
        const d=await api(`/api/admin/audit-log?${p}`);
        setItems(Array.isArray(d.items)?d.items:[]);
        setTotal(d.total||0);
      }catch(e){if(e.name!=="AbortError"){setError(e.message);setItems([]);}}
      finally{if(!c.signal.aborted)setLoading(false);}
    })();
    return()=>c.abort();
  },[action,from,to,page,reload]);

  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));

  return <div className="app-page admin-page admin-ops-page container-fluid py-4">
    <div className="row justify-content-center"><div className="col-12 col-xxl-11">
      <header className="admin-ops-header"><p>Administración</p><h1>Auditoría</h1><span>Registro persistido de acciones administrativas.</span></header>
      <section className="admin-ops-filter admin-ops-filter--audit">
        <div><label>Acción exacta</label><input className="form-control" value={action} onChange={e=>setAction(e.target.value)} placeholder="Ej. approve_access_request"/></div>
        <div><label>Desde</label><input className="form-control" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div>
        <div><label>Hasta</label><input className="form-control" type="date" min={from||undefined} value={to} onChange={e=>setTo(e.target.value)}/></div>
        <button className="btn" disabled={!action&&!from&&!to} onClick={()=>{setAction("");setFrom("");setTo("");}}>Limpiar</button>
      </section>
      <section className="admin-ops-card">
        {loading&&items.length===0&&<div className="admin-ops-state"><InlineState type="loading" title="Cargando auditoría" compact/></div>}
        {error&&<div className="admin-ops-state"><InlineState type="error" title="No pudimos cargar la auditoría" description={error} actionLabel="Reintentar" onAction={()=>setReload(v=>v+1)} compact/></div>}
        {!loading&&!error&&items.length===0&&<div className="admin-ops-state"><InlineState type="empty" title="Sin eventos para mostrar" compact/></div>}
        {!error&&items.length>0&&<>
          <div className="admin-audit-list">{items.map(item=><article key={item.id} className="admin-audit-row">
            <div><strong>{item.action||"Acción"}</strong><time>{date(item.createdAt)}</time></div>
            <p>{item.description||"Sin descripción registrada."}</p>
            <small>{item.userName||"Usuario no disponible"} · {item.userEmail||"—"}{item.userId?` · ID ${item.userId}`:""}</small>
          </article>)}</div>
          <footer className="admin-ops-pagination"><span>{countLabel(total,"evento","eventos")}</span><div>
            <button className="btn btn-sm" disabled={page<=1||loading} onClick={()=>setPage(v=>Math.max(1,v-1))}>Anterior</button>
            <span>Página {page} de {pages}</span>
            <button className="btn btn-sm" disabled={page>=pages||loading} onClick={()=>setPage(v=>Math.min(pages,v+1))}>Siguiente</button>
          </div></footer>
        </>}
      </section>
    </div></div>
  </div>;
}
