import {Controller,Get,Post,Patch,Put,Delete,Body,Param,Query,Req,Res,UseGuards,Injectable,CanActivate,ExecutionContext,Inject,ParseIntPipe,HttpCode,Sse,BadRequestException,applyDecorators} from '@nestjs/common';
import {ApiTags,ApiOperation,ApiCookieAuth,ApiQuery,ApiResponse,ApiProduces} from '@nestjs/swagger';
import {merge,map,interval} from 'rxjs';
import {SocialService} from './social.service';
import {RegisterDto,LoginDto,PostDto,CommentDto,ProfileDto} from './dto';
export function token(req:any):string|undefined {return req.headers.cookie?.split(';').map((v:string)=>v.trim()).find((v:string)=>v.startsWith('campus_session='))?.slice(15);}
@Injectable()
export class SessionGuard implements CanActivate {
 constructor(@Inject(SocialService) private social:SocialService){}
 canActivate(context:ExecutionContext){const req=context.switchToHttp().getRequest();req.userId=this.social.authenticate(token(req));return true;}
}
const Protected=()=>applyDecorators(UseGuards(SessionGuard),ApiCookieAuth('campus_session'));
@ApiTags('Campus')
@Controller()
export class SocialController {
 constructor(@Inject(SocialService) private social:SocialService){}
 private viewer(req:any){try{return this.social.authenticate(token(req));}catch{return undefined;}}
 private cookie(res:any,value:string){res.cookie('campus_session',value,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:process.env.COOKIE_CROSS_SITE==='true'?'none':'lax',maxAge:7*86400000,path:'/api'});}
 @Get('health') @ApiOperation({summary:'Comprobar servicio y conexión con base de datos'}) health(){this.social.db.prepare('SELECT 1').get();return {status:'ok'};}
 @Post('auth/register') @ApiOperation({summary:'Registrar usuario y abrir sesión'}) register(@Body() dto:RegisterDto,@Res({passthrough:true}) res:any){const s=this.social.register(dto);this.cookie(res,s.token);return s.user;}
 @Post('auth/login') @HttpCode(200) @ApiOperation({summary:'Iniciar sesión mediante cookie HttpOnly'}) login(@Body() dto:LoginDto,@Res({passthrough:true}) res:any){const s=this.social.login(dto);this.cookie(res,s.token);return s.user;}
 @Post('auth/logout') @HttpCode(204) @Protected() @ApiOperation({summary:'Cerrar y revocar sesión'}) logout(@Req() req:any,@Res({passthrough:true}) res:any){this.social.logout(token(req)!);res.clearCookie('campus_session',{path:'/api'});}
 @Get('auth/me') @Protected() @ApiOperation({summary:'Consultar usuario de sesión'}) me(@Req() req:any){return this.social.user(req.userId,req.userId);}
 @Patch('users/me') @Protected() @ApiOperation({summary:'Editar nombre y biografía propios'}) update(@Req() req:any,@Body() dto:ProfileDto){return this.social.updateUser(req.userId,dto);}
 @Get('users') @ApiOperation({summary:'Consultar comunidad, máximo 50 usuarios'}) users(@Req() req:any){return this.social.users(this.viewer(req));}
 @Get('users/:id') @ApiOperation({summary:'Consultar perfil público'}) user(@Param('id',ParseIntPipe) id:number,@Req() req:any){return this.social.user(id,this.viewer(req));}
 @Put('users/:id/follow') @Protected() @ApiOperation({summary:'Seguir usuario (idempotente)'}) follow(@Req() req:any,@Param('id',ParseIntPipe) id:number){return this.social.follow(req.userId,id,true);}
 @Delete('users/:id/follow') @Protected() @ApiOperation({summary:'Dejar de seguir usuario'}) unfollow(@Req() req:any,@Param('id',ParseIntPipe) id:number){return this.social.follow(req.userId,id,false);}
 @Get('posts') @ApiQuery({name:'mode',required:false,enum:['all','following']}) @ApiQuery({name:'author',required:false,type:Number}) @ApiQuery({name:'page',required:false,type:Number}) @ApiOperation({summary:'Feed paginado de 20 publicaciones'}) posts(@Req() req:any,@Query('mode') mode='all',@Query('author') author?:string,@Query('page') page='1'){
   if(!['all','following'].includes(mode)||!/^\d+$/.test(page)||Number(page)<1||Number(page)>100000|| (author!==undefined&&(!/^\d+$/.test(author)||Number(author)<1))) throw new BadRequestException('Parámetros de consulta inválidos.');
   return this.social.feed(this.viewer(req),mode,author?Number(author):undefined,Number(page));
 }
 @Get('posts/:id') @ApiOperation({summary:'Consultar publicación individual'}) post(@Param('id',ParseIntPipe) id:number){return this.social.post(id);}
 @Post('posts') @Protected() @ApiOperation({summary:'Crear publicación de texto'}) create(@Req() req:any,@Body() dto:PostDto){return this.social.createPost(req.userId,dto.content);}
 @Delete('posts/:id') @HttpCode(204) @Protected() @ApiOperation({summary:'Eliminar publicación propia y sus interacciones'}) remove(@Req() req:any,@Param('id',ParseIntPipe) id:number){this.social.deletePost(req.userId,id);}
 @Put('posts/:id/like') @Protected() @ApiOperation({summary:'Dar me gusta (idempotente)'}) like(@Req() req:any,@Param('id',ParseIntPipe) id:number){return this.social.like(req.userId,id,true);}
 @Delete('posts/:id/like') @Protected() @ApiOperation({summary:'Retirar me gusta'}) unlike(@Req() req:any,@Param('id',ParseIntPipe) id:number){return this.social.like(req.userId,id,false);}
 @Get('posts/:id/comments') @ApiOperation({summary:'Consultar hasta 100 comentarios recientes'}) comments(@Param('id',ParseIntPipe) id:number){return this.social.comments(id);}
 @Post('posts/:id/comments') @Protected() @ApiOperation({summary:'Crear comentario'}) comment(@Req() req:any,@Param('id',ParseIntPipe) id:number,@Body() dto:CommentDto){return this.social.comment(req.userId,id,dto.content);}
 @Sse('events') @ApiProduces('text/event-stream') @ApiOperation({summary:'Eventos públicos en vivo por SSE; reconexión requiere recargar el feed'}) events(){return merge(this.social.changes,interval(25000).pipe(map(()=>({data:{type:'heartbeat'}}))));}
}

