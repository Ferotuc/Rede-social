import {BadRequestException} from '@nestjs/common';
export const MAX_MEDIA_BYTES=20*1024*1024;
export type Upload={buffer:Buffer;mimetype:string;size:number};
export function mediaFormat(file:Upload){
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

