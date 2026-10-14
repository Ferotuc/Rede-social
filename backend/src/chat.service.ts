import {Injectable,Inject,BadRequestException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {Subject} from 'rxjs';
import {SocialService} from './social.service';
export const MAX_MEDIA_BYTES=20*1024*1024;
type Upload={buffer:Buffer;mimetype:string;size:number};
function mediaFormat(file:Upload){
 const b=file.buffer,head=b.subarray(0,16),ascii=head.toString('ascii');
 if(head.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {kind:'image',mime:'image/png'};
 if(b[0]===255&&b[1]===216&&b[2]===255)return {kind:'image',mime:'image/jpeg'};
 if(ascii.startsWith('GIF87a')||ascii.startsWith('GIF89a'))return {kind:'image',mime:'image/gif'};
 if(ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP')return {kind:'image',mime:'image/webp'};
 if(ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WAVE')return {kind:'audio',mime:'audio/wav'};
 if(ascii.startsWith('OggS')&&file.mimetype.startsWith('audio/'))return {kind:'audio',mime:'audio/ogg'};
 if(ascii.startsWith('ID3')||(b[0]===255&&(b[1]&0xe0)===0xe0&&file.mimetype==='audio/mpeg'))return {kind:'audio',mime:'audio/mpeg'};
 if(head.subarray(0,4).equals(Buffer.from([26,69,223,163]))&&['audio/webm','video/webm'].includes(file.mimetype.split(';')[0]))return {kind:file.mimetype.startsWith('audio/')?'audio':'video',mime:file.mimetype.startsWith('audio/')?'audio/webm':'video/webm'};
 if(ascii.slice(4,8)==='ftyp'&&['audio/mp4','audio/x-m4a','video/mp4'].includes(file.mimetype.split(';')[0]))return {kind:file.mimetype.startsWith('audio/')?'audio':'video',mime:file.mimetype.startsWith('audio/')?'audio/mp4':'video/mp4'};
 throw new BadRequestException('Formato no admitido. Usa JPG, PNG, GIF, WebP, MP3, WAV, OGG, M4A, MP4 o WebM.');
}
@Injectable()
export class ChatService {
 readonly changes=new Subject<{participants:number[]}>();
 constructor(@Inject(SocialService) private social:SocialService){}
 private peer(user:number,target:number){this.social.user(target);if(user===target)throw new BadRequestException('Selecciona otra persona para conversar.');}
 history(user:number,target:number,before?:number){
  this.peer(user,target);
  const rows=this.social.db.prepare(`SELECT id,sender_id,recipient_id,content,media_type,media_kind,length(media) media_size,created_at FROM messages WHERE ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)) AND id<? ORDER BY id DESC LIMIT 50`).all(user,target,target,user,before||Number.MAX_SAFE_INTEGER);
  return rows.reverse().map(row=>({...row,media_url:row.media_kind?`/api/chat/media/${row.id}`:null}));
 }
 send(user:number,target:number,content:string,file?:Upload){
  this.peer(user,target);content=content.trim();
  if(content.length>2000)throw new BadRequestException('El mensaje permite hasta 2000 caracteres.');
  if(!content&&!file)throw new BadRequestException('Escribe un mensaje o adjunta un archivo.');
  let format:{kind:string;mime:string}|undefined;
  if(file){
   if(!file.buffer.length||file.buffer.length>MAX_MEDIA_BYTES)throw new BadRequestException('El archivo debe tener contenido y pesar como máximo 20 MB.');
   format=mediaFormat(file);
   const used=Number(this.social.db.prepare('SELECT COALESCE(sum(length(media)),0) size FROM messages WHERE sender_id=?').get(user)!.size);
   if(used+file.buffer.length>200*1024*1024)throw new BadRequestException('Alcanzaste el límite de 200 MB de archivos por cuenta.');
  }
  const r=this.social.db.prepare('INSERT INTO messages(sender_id,recipient_id,content,media,media_type,media_kind) VALUES(?,?,?,?,?,?)').run(user,target,content,file?.buffer||null,format?.mime||null,format?.kind||null);
  const row=this.social.db.prepare('SELECT id,sender_id,recipient_id,content,media_type,media_kind,length(media) media_size,created_at FROM messages WHERE id=?').get(r.lastInsertRowid)!;
  this.changes.next({participants:[user,target]});
  return {...row,media_url:format?`/api/chat/media/${row.id}`:null};
 }
 media(user:number,id:number){
  const row=this.social.db.prepare('SELECT sender_id,recipient_id,media,media_type FROM messages WHERE id=?').get(id);
  if(!row||!row.media)throw new NotFoundException('Archivo no encontrado.');
  if(Number(row.sender_id)!==user&&Number(row.recipient_id)!==user)throw new ForbiddenException('Este archivo pertenece a una conversación privada.');
  return {buffer:Buffer.from(row.media as Uint8Array),mime:String(row.media_type)};
 }
 onModuleDestroy(){this.changes.complete();}
}
