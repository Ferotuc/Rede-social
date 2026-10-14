import 'reflect-metadata';
import 'dotenv/config';
import {
  Module,
  ValidationPipe,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { SocialController, SessionGuard } from './controller';
import { SocialService } from './social.service';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { PostMediaController } from './post-media.controller';
@Catch()
class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const body = error instanceof HttpException ? error.getResponse() : null;
    if (status === 500) console.error(error);
    const raw = typeof body === 'string' ? body : (body as any)?.message;
    host
      .switchToHttp()
      .getResponse()
      .status(status)
      .json({
        statusCode: status,
        message: Array.isArray(raw) ? raw.join(' · ') : raw || 'Ocurrió un error interno.',
        timestamp: new Date().toISOString(),
      });
  }
}
@Module({
  controllers: [SocialController, ChatController, PostMediaController],
  providers: [SocialService, SessionGuard, ChatService],
})
class AppModule {}
async function start() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (proxyHops > 0) app.getHttpAdapter().getInstance().set('trust proxy', proxyHops);
  const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim());
  if (origins.some((s) => !/^https?:\/\//.test(s) || s.includes('*')))
    throw Error('FRONTEND_ORIGIN debe contener orígenes exactos.');
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.use(helmet({ contentSecurityPolicy: false }));
  // Exact-origin checks protect cookie-authenticated mutations against CSRF.
  const attempts = new Map<string, { count: number; until: number }>();
  const limiter = setInterval(() => {
    for (const [key, value] of attempts) if (value.until < Date.now()) attempts.delete(key);
  }, 60000);
  limiter.unref();
  app.use((req: any, res: any, next: any) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.headers.origin && !origins.includes(req.headers.origin))
        return res.status(403).json({ statusCode: 403, message: 'Origen no permitido.' });
      if (req.headers.cookie && !req.headers.origin)
        return res.status(403).json({ statusCode: 403, message: 'Se requiere encabezado Origin.' });
    }
    if (['/api/auth/login', '/api/auth/register'].includes(req.path) && req.method === 'POST') {
      const key = req.ip || req.socket.remoteAddress || 'unknown';
      const old = attempts.get(key);
      const value =
        old && old.until > Date.now() ? old : { count: 0, until: Date.now() + 15 * 60000 };
      value.count++;
      attempts.set(key, value);
      if (value.count > 30) {
        res.setHeader('Retry-After', Math.ceil((value.until - Date.now()) / 1000));
        return res
          .status(429)
          .json({ statusCode: 429, message: 'Demasiados intentos. Espera 15 minutos.' });
      }
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new Errors());
  const config = new DocumentBuilder()
    .setTitle('Campus API')
    .setDescription(
      'Mini red social estudiantil. Autenticación con cookie HttpOnly. GET públicos; mutaciones requieren sesión y Origin autorizado. Errores: {statusCode,message,timestamp}.',
    )
    .setVersion('1.0')
    .addCookieAuth('campus_session')
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  for (const item of Object.values(doc.paths))
    for (const op of Object.values(item || {}))
      if (op && typeof op === 'object' && 'responses' in op) {
        const responses = (op as any).responses;
        for (const [code, description] of Object.entries({
          '400': 'Datos inválidos',
          '401': 'Sesión requerida o expirada',
          '403': 'Operación no permitida',
          '404': 'Recurso no encontrado',
          '409': 'Correo o usuario duplicado',
          '413': 'Archivo demasiado grande',
          '429': 'Límite de autenticación superado',
        }))
          responses[code] ??= { description };
      }
  SwaggerModule.setup('api/docs', app, doc, {
    jsonDocumentUrl: 'api/openapi.json',
    swaggerOptions: { withCredentials: true },
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3001), '0.0.0.0');
}
start().catch((error) => {
  console.error(error);
  process.exit(1);
});
