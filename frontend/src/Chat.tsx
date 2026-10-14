import {useEffect,useRef,useState,useCallback,FormEvent} from 'react';
import {api,BASE,User} from './api';
import './chat.css';
type Message={id:number;sender_id:number;recipient_id:number;content:string;media_url:string|null;media_kind:'image'|'audio'|'video'|null;created_at:string};
const EMOJIS=['😀','😂','😊','😍','🥳','😎','🤔','😢','❤️','👍','👏','🙏','🔥','🎉','📚','💡'];
const LIMIT=20*1024*1024;
function Attachment({url,kind}:{url:string;kind:string}){
 if(kind==='image')return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Imagen adjunta al mensaje" className="chat-image" crossOrigin="use-credentials"/></a>;
 if(kind==='audio')return <audio controls preload="metadata" src={url} crossOrigin="use-credentials">Tu navegador no puede reproducir este audio.</audio>;
 return <video controls preload="metadata" src={url} crossOrigin="use-credentials">Tu navegador no puede reproducir este video.</video>;
}
function MessageComposer({peer,onSent}:{peer:User;onSent:()=>void}){
 const [text,setText]=useState(''),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[error,setError]=useState(''),[sending,setSending]=useState(false),[recording,setRecording]=useState(false),[requestingMic,setRequestingMic]=useState(false),[seconds,setSeconds]=useState(0),[emojis,setEmojis]=useState(false);
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),mounted=useRef(true),discard=useRef(false),recordTimer=useRef<ReturnType<typeof setTimeout>|null>(null),input=useRef<HTMLInputElement>(null),textarea=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;discard.current=true;if(recordTimer.current)clearTimeout(recordTimer.current);if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());};},[]);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 useEffect(()=>{if(!recording)return;setSeconds(0);const timer=setInterval(()=>setSeconds(value=>value+1),1000);return()=>clearInterval(timer);},[recording]);
 function attach(next:File|undefined){setError('');if(!next)return;if(next.size>LIMIT){setError('El archivo supera el límite de 20 MB.');return;}if(!next.size){setError('El archivo está vacío.');return;}setFile(next);}
 function emoji(value:string){const start=textarea.current?.selectionStart??text.length,end=textarea.current?.selectionEnd??start;setText(text.slice(0,start)+value+text.slice(end));textarea.current?.focus();}
 async function startRecording(){
  if(requestingMic||recording)return;
  setError('');
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setError('Este navegador no permite grabar. Puedes adjuntar un archivo de audio.');return;}
  setRequestingMic(true);try{
   const tracks=await navigator.mediaDevices.getUserMedia({audio:true});
   if(!mounted.current){tracks.getTracks().forEach(t=>t.stop());return;}
   stream.current=tracks;discard.current=false;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
   const rec=new MediaRecorder(tracks,mime?{mimeType:mime}:undefined),parts:BlobPart[]=[];recorder.current=rec;
   rec.ondataavailable=event=>{if(event.data.size)parts.push(event.data);};
   rec.onstop=()=>{
    tracks.getTracks().forEach(t=>t.stop());if(recordTimer.current)clearTimeout(recordTimer.current);
    if(!mounted.current)return;setRecording(false);
    if(discard.current)return;
    const type=rec.mimeType.split(';')[0]||'audio/webm',extension=type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm';
    attach(new File(parts,`nota-de-voz.${extension}`,{type}));
   };
   rec.onerror=()=>{discard.current=true;tracks.getTracks().forEach(t=>t.stop());if(mounted.current){setRecording(false);setError('No se pudo grabar el audio. Inténtalo nuevamente.');}};
   rec.start();setRecording(true);recordTimer.current=setTimeout(()=>{if(rec.state==='recording')rec.stop();},120000);
  }catch{if(mounted.current)setError('No se pudo acceder al micrófono. Revisa el permiso del navegador o adjunta un audio.');stream.current?.getTracks().forEach(t=>t.stop());}finally{if(mounted.current)setRequestingMic(false);}
 }
 async function send(e:FormEvent){
  e.preventDefault();if(sending||recording||(!text.trim()&&!file))return;
  setSending(true);setError('');
  try{const data=new FormData();if(text.trim())data.set('content',text.trim());if(file)data.set('file',file);const response=await fetch(`${BASE}/api/chat/${peer.id}/messages`,{method:'POST',credentials:'include',body:data});if(!response.ok){const result=await response.json().catch(()=>({message:'No se pudo enviar el mensaje.'}));throw Error(result.message);}if(mounted.current){setText('');setFile(null);setEmojis(false);onSent();}}
  catch(err){if(mounted.current)setError((err as Error).message);}finally{if(mounted.current)setSending(false);}
 }
 return <form className="message-composer" onSubmit={send}>
  {file&&<div className="attachment-preview"><div>{file.type.startsWith('image/')?<img src={preview} alt="Vista previa del archivo seleccionado"/>:file.type.startsWith('audio/')?<audio controls src={preview}/>:file.type.startsWith('video/')?<video controls src={preview}/>:null}<small>{file.name} · {(file.size/1024/1024).toFixed(1)} MB</small></div><button type="button" className="text-btn" disabled={sending||recording} onClick={()=>setFile(null)}>Quitar</button></div>}
  {recording&&<div className="recording-status" role="status">● Grabando {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}<button type="button" className="outline" onClick={()=>recorder.current?.stop()}>Terminar</button><button type="button" className="text-btn" onClick={()=>{discard.current=true;recorder.current?.stop();}}>Cancelar</button></div>}
  <label className="sr-only" htmlFor="message-text">Mensaje para {peer.name}</label><textarea ref={textarea} id="message-text" value={text} onChange={e=>setText(e.target.value)} placeholder={`Escribe a ${peer.name.split(' ')[0]}…`} maxLength={2000} disabled={sending||recording}/>
  {emojis&&<div className="emoji-picker" aria-label="Emojis">{EMOJIS.map(value=><button type="button" key={value} aria-label={`Insertar ${value}`} disabled={sending||recording||text.length>1997} onClick={()=>emoji(value)}>{value}</button>)}</div>}
  <div className="message-tools"><div><button type="button" className="outline" disabled={sending||recording||requestingMic} aria-expanded={emojis} onClick={()=>setEmojis(!emojis)}>😊</button><button type="button" className="outline" disabled={sending||recording||requestingMic} onClick={()=>input.current?.click()}>📎 Adjuntar</button><button type="button" className="outline" disabled={sending||recording||requestingMic} onClick={()=>void startRecording()}>{requestingMic?'Esperando permiso…':'🎙 Voz'}</button></div><button className="primary" disabled={sending||recording||requestingMic||(!text.trim()&&!file)}>{sending?'Enviando…':'Enviar ↗'}</button></div>
  <input className="sr-only" ref={input} type="file" accept="image/png,image/jpeg,image/gif,image/webp,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,audio/webm,video/mp4,video/webm" aria-label="Adjuntar imagen, audio o video" onChange={e=>{attach(e.target.files?.[0]);e.target.value='';}}/>
  <small className="muted">Un archivo por mensaje, hasta 20 MB. Notas de voz de hasta 2 minutos.</small>{error&&<p className="error" role="alert">{error}</p>}
 </form>;
}
export default function Chat({me,users,onClose}:{me:User;users:User[];onClose:()=>void}){
 const peers=users.filter(u=>u.id!==me.id),[peerId,setPeerId]=useState<number|null>(peers[0]?.id??null),[messages,setMessages]=useState<Message[]>([]),[error,setError]=useState(''),[live,setLive]=useState(false),[loading,setLoading]=useState(false),[hasOlder,setHasOlder]=useState(false);
 const peer=peers.find(user=>user.id===peerId),currentPeer=useRef(peerId),bottom=useRef<HTMLDivElement>(null),loadVersion=useRef(0);
 currentPeer.current=peerId;
 const load=useCallback(async()=>{
  if(peerId===null)return;const version=++loadVersion.current;
  try{const result=await api<Message[]>(`/chat/${peerId}/messages`);if(version===loadVersion.current&&currentPeer.current===peerId){setMessages(result);setHasOlder(result.length===50);setError('');}}
  catch(err){if(version===loadVersion.current)setError((err as Error).message);}finally{if(version===loadVersion.current)setLoading(false);}
 },[peerId]);
 useEffect(()=>{setMessages([]);setLoading(true);void load();return()=>{loadVersion.current++;};},[load]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'});},[messages.length,peerId]);
 useEffect(()=>{const events=new EventSource(`${BASE}/api/chat/events`,{withCredentials:true});events.onopen=()=>{setLive(true);void load();};events.onerror=()=>setLive(false);events.onmessage=e=>{const event=JSON.parse(e.data);if(event.type==='message'&&event.peerId===peerId)void load();};return()=>events.close();},[load,peerId]);
 async function older(){if(!peer||!messages.length)return;const target=peer.id;try{const history=await api<Message[]>(`/chat/${target}/messages?before=${messages[0].id}`);if(currentPeer.current===target){setMessages(previous=>[...history,...previous]);setHasOlder(history.length===50);}}catch(err){setError((err as Error).message);}}
 return <div className="overlay"><section className="chat-modal" role="dialog" aria-modal="true" aria-label="Mensajes privados"><header className="chat-title"><div><h2>Mensajes</h2><small className={live?'connected':'muted'}>● {live?'En vivo · Conversaciones privadas':'Reconectando…'}</small></div><button className="close" onClick={onClose} aria-label="Cerrar mensajes">×</button></header><div className="chat-layout"><aside className="chat-people"><h3>Tu comunidad</h3>{peers.map(user=><button key={user.id} className={peerId===user.id?'selected-peer':''} onClick={()=>setPeerId(user.id)}><strong>{user.name}</strong><small>@{user.username}</small></button>)}{!peers.length&&<p className="muted">Registra otra cuenta o invita a un compañero para conversar.</p>}</aside><div className="chat-conversation">{peer?<><div className="chat-peer"><strong>{peer.name}</strong><small>@{peer.username}</small></div><div className="message-history" aria-label="Historial de mensajes">{hasOlder&&<button className="text-btn" onClick={()=>void older()}>Ver mensajes anteriores</button>}{loading&&<p className="muted" role="status">Cargando conversación…</p>}{error&&<p className="error" role="alert">{error}<button className="text-btn" onClick={()=>void load()}>Reintentar</button></p>}{!loading&&!error&&!messages.length&&<div className="empty"><h3>Saluda a {peer.name.split(' ')[0]} 👋</h3><p>Comparte texto, emojis, imágenes, audio o video.</p></div>}{messages.map(message=><article className={`chat-bubble ${message.sender_id===me.id?'mine':''}`} key={message.id}>{message.media_url&&message.media_kind&&<Attachment url={BASE+message.media_url} kind={message.media_kind}/>} {message.content&&<p>{message.content}</p>}<small>{message.sender_id===me.id?'Tú':peer.name.split(' ')[0]} · {new Date(message.created_at.replace(' ','T')+'Z').toLocaleString('es-GT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></article>)}<div ref={bottom}/></div><MessageComposer key={peer.id} peer={peer} onSent={()=>void load()}/></>:<div className="empty"><h3>Selecciona una persona</h3><p>Los mensajes y archivos solo están disponibles para los dos participantes.</p></div>}</div></div></section></div>;
}
