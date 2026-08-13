import InlineState from "../components/InlineState";
import { requestJson } from "../common/requestErrorModel";
import React,{useEffect,useState} from "react";
import "./AdminOps.css";

const PAGE_SIZE=20;
const LABEL={PENDING:"Pendiente",APPROVED:"Aprobada",REJECTED:"Rechazada"};
const ROLE_LABEL={Student:"Estudiante",Teacher:"Profesor",Admin:"Administrador"};
const roleLabel=value=>ROLE_LABEL[value]||value||"Sin cambio";
const countLabel=(count,singular,plural)=>`${count} ${count===1?singular:plural}`;
const fmt=new Intl.DateTimeFormat("es-CL",{dateStyle:"medium",timeStyle:"short"});

async function api(url,options={}){
  return requestJson(url,{credentials:"include",headers:{"Content-Type":"application/json"},...options},{fallback:"No fue posible procesar la solicitud."});
}
const date=v=>v?fmt.format(new Date(v)):"—";

export default function AdminAccessRequests(){
  const[status,setStatus]=useState("PENDING");
  const[search,setSearch]=useState("");
  const[page,setPage]=useState(1);
  const[items,setItems]=useState([]);
  const[summary,setSummary]=useState({pending:0,approved:0,rejected:0});
  const[total,setTotal]=useState(0);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(null);
  const[reload,setReload]=useState(0);

  useEffect(()=>setPage(1),[status,search]);

  useEffect(()=>{
    const c=new AbortController();
    const timer=setTimeout(async()=>{
      try{
        setLoading(true); setError(null);
        const p=new URLSearchParams({status,page:String(page),page_size:String(PAGE_SIZE)});
        if(search.trim()) p.set("search",search.trim());
        const d=await api(`/api/admin/access-requests?${p}`,{signal:c.signal});
        setItems(Array.isArray(d.items)?d.items:[]);
        setSummary(d.summary||{pending:0,approved:0,rejected:0});
        setTotal(d.total||0);
      }catch(e){
        if(e.name!=="AbortError"){setError(e.message);setItems([]);}
      }finally{if(!c.signal.aborted)setLoading(false);}
    },search.trim()?250:0);
    return()=>{clearTimeout(timer);c.abort();};
  },[status,search,page,reload]);

  const resolve=async(item,mode)=>{
    const verb=mode==="approve"?"aprobar":"rechazar";
    if(!window.confirm(`¿Confirmas ${verb} la solicitud #${item.id}?`)) return;
    let body={};
    if(mode==="reject"){
      const reason=window.prompt("Motivo de rechazo (opcional):","")||"";
      body={reason};
    }
    try{
      await api(`/api/admin/access-requests/${item.id}/${mode}`,{method:"POST",body:JSON.stringify(body)});
      setReload(v=>v+1);
    }catch(e){window.alert(e.message||"No fue posible procesar la solicitud.");}
  };

  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));

  return <div className="app-page admin-page admin-ops-page container-fluid py-4">
    <div className="row justify-content-center"><div className="col-12 col-xxl-11">
      <header className="admin-ops-header">
        <p>Administración</p><h1>Solicitudes de acceso</h1>
        <span>Revisa y resuelve solicitudes de acceso institucional.</span>
      </header>

      <section className="admin-ops-summary">
        <button onClick={()=>setStatus("PENDING")} className={status==="PENDING"?"active":""}><span>Pendientes</span><strong>{summary.pending||0}</strong></button>
        <button onClick={()=>setStatus("APPROVED")} className={status==="APPROVED"?"active":""}><span>Aprobadas</span><strong>{summary.approved||0}</strong></button>
        <button onClick={()=>setStatus("REJECTED")} className={status==="REJECTED"?"active":""}><span>Rechazadas</span><strong>{summary.rejected||0}</strong></button>
      </section>

      <section className="admin-ops-filter">
        <div><label>Buscar</label><input className="form-control" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre, correo o curso"/></div>
        <div><label>Estado</label><select className="form-select" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="PENDING">Pendientes</option><option value="APPROVED">Aprobadas</option><option value="REJECTED">Rechazadas</option><option value="ALL">Todas</option>
        </select></div>
      </section>

      <section className="admin-ops-card">
        {loading&&items.length===0&&<div className="admin-ops-state"><InlineState type="loading" title="Cargando solicitudes" compact/></div>}
        {error&&<div className="admin-ops-state"><InlineState type="error" title="No pudimos cargar las solicitudes" description={error} actionLabel="Reintentar" onAction={()=>setReload(v=>v+1)} compact/></div>}
        {!loading&&!error&&items.length===0&&<div className="admin-ops-state"><InlineState type="empty" title="No hay solicitudes para mostrar" compact/></div>}
        {!error&&items.length>0&&<>
          <div className="table-responsive"><table className="table admin-ops-table align-middle mb-0">
            <thead><tr><th>Usuario</th><th>Rol solicitado</th><th>Curso / profesor</th><th>Estado</th><th>Fecha</th><th className="text-end">Acción</th></tr></thead>
            <tbody>{items.map(item=><tr key={item.id}>
              <td><strong>{item.user?.fullName||"—"}</strong><small>{item.user?.email||"—"}</small></td>
              <td>{roleLabel(item.user?.roleName)}{item.message&&<small>{item.message}</small>}</td>
              <td><strong>{item.courseCode||"—"}</strong><small>{item.professorEmail||"—"}</small></td>
              <td><span className="admin-ops-status">{LABEL[item.status]||item.status}</span></td>
              <td>{date(item.createdAt)}</td>
              <td className="text-end">{item.status==="PENDING"?<div className="admin-ops-actions">
                <button className="btn btn-sm admin-ops-approve" onClick={()=>resolve(item,"approve")}>Aprobar</button>
                <button className="btn btn-sm admin-ops-reject" onClick={()=>resolve(item,"reject")}>Rechazar</button>
              </div>:<small>{item.resolvedBy?.fullName||"Resuelta"}</small>}</td>
            </tr>)}</tbody>
          </table></div>
          <footer className="admin-ops-pagination"><span>{countLabel(total,"solicitud","solicitudes")}</span><div>
            <button className="btn btn-sm" disabled={page<=1||loading} onClick={()=>setPage(v=>Math.max(1,v-1))}>Anterior</button>
            <span>Página {page} de {pages}</span>
            <button className="btn btn-sm" disabled={page>=pages||loading} onClick={()=>setPage(v=>Math.min(pages,v+1))}>Siguiente</button>
          </div></footer>
        </>}
      </section>
    </div></div>
  </div>;
}
