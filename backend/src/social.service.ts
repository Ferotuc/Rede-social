import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { Subject } from 'rxjs';
import { openDatabase } from './database';
import { RegisterDto, LoginDto, ProfileDto } from './dto';
import { Upload, mediaFormat, MAX_MEDIA_BYTES } from './media';
type User = {
  id: number;
  name: string;
  username: string;
  email: string;
  bio: string;
  password_hash: string;
};
@Injectable()
export class SocialService {
  readonly db = openDatabase(process.env.DATABASE_PATH || './data/campus.db');
  readonly changes = new Subject<{ data: { type: string; postId?: number } }>();
  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  private publicUser(user: User) {
    return { id: user.id, name: user.name, username: user.username, bio: user.bio };
  }
  register(dto: RegisterDto) {
    const salt = randomBytes(16).toString('hex');
    const password_hash = salt + ':' + scryptSync(dto.password, salt, 64).toString('hex');
    if (
      this.db
        .prepare('SELECT id FROM users WHERE username=? OR email=?')
        .get(dto.username, dto.email)
    )
      throw new ConflictException('El correo o usuario ya está registrado.');
    const result = this.db
      .prepare('INSERT INTO users(name,username,email,password_hash) VALUES(?,?,?,?)')
      .run(dto.name.trim(), dto.username, dto.email.toLowerCase(), password_hash);
    return this.session(Number(result.lastInsertRowid));
  }
  login(dto: LoginDto) {
    const user = this.db
      .prepare('SELECT * FROM users WHERE email=?')
      .get(dto.email.toLowerCase()) as User | undefined;
    // Run a password derivation even for unknown addresses.
    const [salt, hash] = (user?.password_hash || 'invalid:' + '00'.repeat(64)).split(':');
    const derived = scryptSync(dto.password, salt, 64);
    if (!user || !timingSafeEqual(derived, Buffer.from(hash, 'hex')))
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    return this.session(user.id);
  }
  private session(id: number) {
    this.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    const token = randomBytes(32).toString('hex');
    this.db
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run(this.hashToken(token), id, Date.now() + 7 * 86400000);
    return {
      token,
      user: this.publicUser(this.db.prepare('SELECT * FROM users WHERE id=?').get(id) as User),
    };
  }
  authenticate(token?: string) {
    if (!token) throw new UnauthorizedException('Inicia sesión para continuar.');
    const row = this.db
      .prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?')
      .get(this.hashToken(token), Date.now());
    if (!row) throw new UnauthorizedException('La sesión expiró. Inicia sesión nuevamente.');
    return Number(row.user_id);
  }
  logout(token: string) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(this.hashToken(token));
  }
  user(id: number, viewer?: number) {
    const user = this.db.prepare('SELECT * FROM users WHERE id=?').get(id) as User | undefined;
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return {
      ...this.publicUser(user),
      followers: Number(
        this.db.prepare('SELECT count(*) n FROM follows WHERE following_id=?').get(id)!.n,
      ),
      following: Number(
        this.db.prepare('SELECT count(*) n FROM follows WHERE follower_id=?').get(id)!.n,
      ),
      isFollowing: !!this.db
        .prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?')
        .get(viewer || 0, id),
    };
  }
  users(viewer?: number) {
    return this.db
      .prepare('SELECT id FROM users ORDER BY id DESC LIMIT 50')
      .all()
      .map((row) => this.user(Number(row.id), viewer));
  }
  updateUser(id: number, dto: ProfileDto) {
    if (dto.name !== undefined && !dto.name.trim())
      throw new BadRequestException('El nombre no puede estar vacío.');
    this.db
      .prepare('UPDATE users SET name=COALESCE(?,name),bio=COALESCE(?,bio) WHERE id=?')
      .run(dto.name?.trim() ?? null, dto.bio ?? null, id);
    return this.user(id, id);
  }
  feed(viewer: number | undefined, mode: string, author?: number, page = 1) {
    if (mode === 'following' && !viewer) throw new UnauthorizedException();
    const where = author
      ? 'p.user_id=?'
      : mode === 'following'
        ? 'p.user_id IN (SELECT following_id FROM follows WHERE follower_id=?)'
        : '1=1';
    const params = author ? [author] : mode === 'following' ? [viewer!] : [];
    const rows = this.db
      .prepare(
        `SELECT p.*,u.name,u.username,a.media_kind,a.media_type,(SELECT count(*) FROM likes l WHERE l.post_id=p.id) likes,(SELECT count(*) FROM comments c WHERE c.post_id=p.id) comments,EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.user_id=?) liked FROM posts p JOIN users u ON p.user_id=u.id LEFT JOIN post_attachments a ON a.post_id=p.id WHERE ${where} ORDER BY p.id DESC LIMIT 20 OFFSET ?`,
      )
      .all(viewer || 0, ...params, (page - 1) * 20);
    return rows.map((r) => ({
      ...r,
      liked: !!r.liked,
      media_url: r.media_kind ? `/api/posts/media/${r.id}` : null,
    }));
  }
  post(id: number) {
    const row = this.db.prepare('SELECT * FROM posts WHERE id=?').get(id);
    if (!row) throw new NotFoundException('Publicación no encontrada.');
    return row;
  }
  createPost(user: number, content: string) {
    const r = this.db
      .prepare('INSERT INTO posts(user_id,content) VALUES(?,?)')
      .run(user, content.trim());
    this.emit('post', Number(r.lastInsertRowid));
    return this.post(Number(r.lastInsertRowid));
  }
  createMediaPost(user: number, content: string, file?: Upload) {
    if (!file) throw new BadRequestException('Selecciona una imagen, audio o video.');
    if (!file.buffer.length || file.buffer.length > MAX_MEDIA_BYTES)
      throw new BadRequestException('El archivo debe tener contenido y pesar como máximo 20 MB.');
    const format = mediaFormat(file);
    content = content.trim();
    if (content.length > 1000)
      throw new BadRequestException('La publicación permite hasta 1000 caracteres.');
    const used = Number(
      this.db
        .prepare(
          'SELECT COALESCE(sum(length(a.media)),0) size FROM post_attachments a JOIN posts p ON p.id=a.post_id WHERE p.user_id=?',
        )
        .get(user)!.size,
    );
    if (used + file.buffer.length > 200 * 1024 * 1024)
      throw new BadRequestException('Alcanzaste el límite de 200 MB de archivos publicados.');
    if (!content)
      content =
        format.kind === 'image'
          ? 'Imagen compartida'
          : format.kind === 'audio'
            ? 'Audio compartido'
            : 'Video compartido';
    this.db.exec('BEGIN');
    let id: number;
    try {
      const result = this.db
        .prepare('INSERT INTO posts(user_id,content) VALUES(?,?)')
        .run(user, content);
      id = Number(result.lastInsertRowid);
      this.db
        .prepare('INSERT INTO post_attachments VALUES(?,?,?,?)')
        .run(id, file.buffer, format.mime, format.kind);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    this.emit('post', id);
    return { ...this.post(id), media_kind: format.kind, media_url: `/api/posts/media/${id}` };
  }
  publicMedia(id: number) {
    const row = this.db
      .prepare('SELECT media,media_type FROM post_attachments WHERE post_id=?')
      .get(id);
    if (!row) throw new NotFoundException('Archivo no encontrado.');
    return { buffer: Buffer.from(row.media as Uint8Array), mime: String(row.media_type) };
  }
  deletePost(user: number, id: number) {
    const p = this.post(id);
    if (Number(p.user_id) !== user)
      throw new ForbiddenException('Solo puedes eliminar tus propias publicaciones.');
    this.db.prepare('DELETE FROM posts WHERE id=?').run(id);
    this.emit('post', id);
  }
  like(user: number, id: number, on: boolean) {
    this.post(id);
    if (on) this.db.prepare('INSERT OR IGNORE INTO likes VALUES(?,?)').run(user, id);
    else this.db.prepare('DELETE FROM likes WHERE user_id=? AND post_id=?').run(user, id);
    this.emit('like', id);
    return {
      likes: Number(this.db.prepare('SELECT count(*) n FROM likes WHERE post_id=?').get(id)!.n),
      liked: on,
    };
  }
  comments(id: number) {
    this.post(id);
    return this.db
      .prepare(
        'SELECT c.id,c.content,c.created_at,c.user_id,u.name,u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE post_id=? ORDER BY c.id DESC LIMIT 100',
      )
      .all(id);
  }
  comment(user: number, id: number, content: string) {
    this.post(id);
    const r = this.db
      .prepare('INSERT INTO comments(user_id,post_id,content) VALUES(?,?,?)')
      .run(user, id, content.trim());
    this.emit('comment', id);
    return this.db
      .prepare('SELECT id,content,created_at,user_id,post_id FROM comments WHERE id=?')
      .get(r.lastInsertRowid);
  }
  follow(user: number, target: number, on: boolean) {
    this.user(target);
    if (user === target) throw new BadRequestException('No puedes seguirte a ti mismo.');
    if (on) this.db.prepare('INSERT OR IGNORE INTO follows VALUES(?,?)').run(user, target);
    else
      this.db
        .prepare('DELETE FROM follows WHERE follower_id=? AND following_id=?')
        .run(user, target);
    this.emit('follow');
    return this.user(target, user);
  }
  private emit(type: string, postId?: number) {
    this.changes.next({ data: { type, postId } });
  }
  onModuleDestroy() {
    this.changes.complete();
    this.db.close();
  }
}
