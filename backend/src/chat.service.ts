import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Subject } from 'rxjs';
import { SocialService } from './social.service';
export { MAX_MEDIA_BYTES } from './media';
import { MAX_MEDIA_BYTES, mediaFormat, Upload } from './media';
@Injectable()
export class ChatService {
  readonly changes = new Subject<{ participants: number[] }>();
  constructor(@Inject(SocialService) private social: SocialService) {}
  private peer(user: number, target: number) {
    this.social.user(target);
    if (user === target) throw new BadRequestException('Selecciona otra persona para conversar.');
  }
  history(user: number, target: number, before?: number) {
    this.peer(user, target);
    const rows = this.social.db
      .prepare(
        `SELECT id,sender_id,recipient_id,content,media_type,media_kind,length(media) media_size,created_at FROM messages WHERE ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)) AND id<? ORDER BY id DESC LIMIT 50`,
      )
      .all(user, target, target, user, before || Number.MAX_SAFE_INTEGER);
    return rows
      .reverse()
      .map((row) => ({ ...row, media_url: row.media_kind ? `/api/chat/media/${row.id}` : null }));
  }
  send(user: number, target: number, content: string, file?: Upload) {
    this.peer(user, target);
    content = content.trim();
    if (content.length > 2000)
      throw new BadRequestException('El mensaje permite hasta 2000 caracteres.');
    if (!content && !file)
      throw new BadRequestException('Escribe un mensaje o adjunta un archivo.');
    let format: { kind: string; mime: string } | undefined;
    if (file) {
      if (!file.buffer.length || file.buffer.length > MAX_MEDIA_BYTES)
        throw new BadRequestException('El archivo debe tener contenido y pesar como máximo 20 MB.');
      format = mediaFormat(file);
      const used = Number(
        this.social.db
          .prepare('SELECT COALESCE(sum(length(media)),0) size FROM messages WHERE sender_id=?')
          .get(user)!.size,
      );
      if (used + file.buffer.length > 200 * 1024 * 1024)
        throw new BadRequestException('Alcanzaste el límite de 200 MB de archivos por cuenta.');
    }
    const r = this.social.db
      .prepare(
        'INSERT INTO messages(sender_id,recipient_id,content,media,media_type,media_kind) VALUES(?,?,?,?,?,?)',
      )
      .run(user, target, content, file?.buffer || null, format?.mime || null, format?.kind || null);
    const row = this.social.db
      .prepare(
        'SELECT id,sender_id,recipient_id,content,media_type,media_kind,length(media) media_size,created_at FROM messages WHERE id=?',
      )
      .get(r.lastInsertRowid)!;
    this.changes.next({ participants: [user, target] });
    return { ...row, media_url: format ? `/api/chat/media/${row.id}` : null };
  }
  media(user: number, id: number) {
    const row = this.social.db
      .prepare('SELECT sender_id,recipient_id,media,media_type FROM messages WHERE id=?')
      .get(id);
    if (!row || !row.media) throw new NotFoundException('Archivo no encontrado.');
    if (Number(row.sender_id) !== user && Number(row.recipient_id) !== user)
      throw new ForbiddenException('Este archivo pertenece a una conversación privada.');
    return { buffer: Buffer.from(row.media as Uint8Array), mime: String(row.media_type) };
  }
  onModuleDestroy() {
    this.changes.complete();
  }
}
