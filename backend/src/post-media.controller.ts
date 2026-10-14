import {Controller,Inject,Post,Get,Param,ParseIntPipe,Body,Req,Res,UseGuards,UseInterceptors,UploadedFile} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {ApiTags,ApiCookieAuth,ApiOperation,ApiConsumes,ApiBody} from '@nestjs/swagger';
import {IsOptional,IsString,Length} from 'class-validator';
import {SessionGuard} from './controller';
import {SocialService} from './social.service';
import {MAX_MEDIA_BYTES} from './media';
class MediaPostDto {@IsOptional() @IsString() @Length(0,1000) content?:string;}
@ApiTags('Publicaciones multimedia')
@Controller('posts/media')
export class PostMediaController {
 constructor(@Inject(SocialService) private social:SocialService){}
 @Post() @UseGuards(SessionGuard) @ApiCookieAuth('campus_session') @ApiOperation({summary:'Publicar un archivo visible para la comunidad; descripción opcional'})
 @ApiConsumes('multipart/form-data') @ApiBody({schema:{type:'object',required:['file'],properties:{content:{type:'string',maxLength:1000},file:{type:'string',format:'binary'}}}})
 @UseInterceptors(FileInterceptor('file',{limits:{fileSize:MAX_MEDIA_BYTES,files:1,fields:1,fieldSize:6000}}))
 create(@Req() req:any,@Body() dto:MediaPostDto,@UploadedFile() file:any){return this.social.createMediaPost(req.userId,dto.content||'',file);}
 @Get(':id') @ApiOperation({summary:'Consultar imagen/audio/video de una publicación pública; admite Range'}) media(@Req() req:any,@Res() res:any,@Param('id',ParseIntPipe) id:number){
  const media=this.social.publicMedia(id),size=media.buffer.length;
  res.setHeader('Content-Type',media.mime);res.setHeader('Cache-Control','no-store');res.setHeader('Cross-Origin-Resource-Policy','cross-origin');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Accept-Ranges','bytes');
  if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);let start=match&&match[1]?Number(match[1]):0,end=match&&match[2]?Number(match[2]):size-1;
   if(match&&!match[1]&&match[2]){start=Math.max(0,size-Number(match[2]));end=size-1;}
   if(!match||(!match[1]&&!match[2])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start){res.setHeader('Content-Range',`bytes */${size}`);return res.status(416).end();}
   end=Math.min(end,size-1);res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);res.setHeader('Content-Length',end-start+1);return res.status(206).end(media.buffer.subarray(start,end+1));
  }
  res.setHeader('Content-Length',size);return res.end(media.buffer);
 }
}
