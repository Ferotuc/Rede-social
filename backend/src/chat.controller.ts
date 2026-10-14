import {Controller,Inject,Get,Post,Param,Query,ParseIntPipe,Body,Req,Res,UseGuards,UseInterceptors,UploadedFile,Sse,BadRequestException} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {ApiTags,ApiCookieAuth,ApiOperation,ApiConsumes,ApiBody,ApiQuery,ApiProduces} from '@nestjs/swagger';
import {IsOptional,IsString,Length} from 'class-validator';
import {merge,interval,filter,map} from 'rxjs';
import {SessionGuard} from './controller';
import {ChatService,MAX_MEDIA_BYTES} from './chat.service';
class MessageDto {
 @IsOptional() @IsString() @Length(0,2000) content?:string;
}
@ApiTags('Mensajes privados')
@ApiCookieAuth('campus_session')
@UseGuards(SessionGuard)
@Controller('chat')
export class ChatController {
 constructor(@Inject(ChatService) private chat:ChatService){}
 @Get(':id/messages') @ApiQuery({name:'before',required:false,type:Number}) @ApiOperation({summary:'Últimos 50 mensajes con un usuario; before permite consultar mensajes anteriores'}) history(@Req() req:any,@Param('id',ParseIntPipe) id:number,@Query('before') before?:string){
  if(before!==undefined&&(!/^\d+$/.test(before)||Number(before)<1||!Number.isSafeInteger(Number(before))))throw new BadRequestException('Cursor inválido.');
  return this.chat.history(req.userId,id,before?Number(before):undefined);
 }
 @Post(':id/messages') @ApiOperation({summary:'Enviar texto, emojis o archivo privado (20 MB máximo)'})
 @ApiConsumes('multipart/form-data') @ApiBody({schema:{type:'object',properties:{content:{type:'string',maxLength:2000},file:{type:'string',format:'binary'}}}})
 @UseInterceptors(FileInterceptor('file',{limits:{fileSize:MAX_MEDIA_BYTES,files:1,fields:1,fieldSize:10000}}))
 send(@Req() req:any,@Param('id',ParseIntPipe) id:number,@Body() dto:MessageDto,@UploadedFile() file:any){return this.chat.send(req.userId,id,dto.content||'',file);}
 @Get('media/:id') @ApiOperation({summary:'Reproducir archivo; acceso solo para emisor/receptor, admite Range'}) media(@Req() req:any,@Res() res:any,@Param('id',ParseIntPipe) id:number){
  const media=this.chat.media(req.userId,id),size=media.buffer.length;
  res.setHeader('Content-Type',media.mime);res.setHeader('Cache-Control','private, no-store');res.setHeader('Cross-Origin-Resource-Policy','cross-origin');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Accept-Ranges','bytes');
  const range=req.headers.range;
  if(range){
   const match=/^bytes=(\d*)-(\d*)$/.exec(range);
   let start=match&&match[1]?Number(match[1]):0,end=match&&match[2]?Number(match[2]):size-1;
   if(match&&!match[1]&&match[2]){start=Math.max(0,size-Number(match[2]));end=size-1;}
   if(!match||(!match[1]&&!match[2])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start){res.setHeader('Content-Range',`bytes */${size}`);return res.status(416).end();}
   end=Math.min(end,size-1);res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);res.setHeader('Content-Length',end-start+1);return res.status(206).end(media.buffer.subarray(start,end+1));
  }
  res.setHeader('Content-Length',size);return res.end(media.buffer);
 }
 @Sse('events') @ApiProduces('text/event-stream') @ApiOperation({summary:'Eventos privados filtrados por participantes de la conversación'}) events(@Req() req:any){
  return merge(this.chat.changes.pipe(filter(event=>event.participants.includes(req.userId)),map(event=>({data:{type:'message',peerId:event.participants.find(id=>id!==req.userId)}}))),interval(25000).pipe(map(()=>({data:{type:'heartbeat'}}))));
 }
}
